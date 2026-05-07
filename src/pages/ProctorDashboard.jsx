import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Shield, Bell, Users, AlertTriangle, TrendingUp, Moon, Sun,
  LogOut, X, Ban, FileText, RefreshCw, ChevronRight, KeyRound,
  ClipboardList, Plus, Trash2, Copy
} from 'lucide-react'
import CandidateCard from '../components/CandidateCard.jsx'
import AlertFeed from '../components/AlertFeed.jsx'
import RiskMeter from '../components/RiskMeter.jsx'
import ReportModal from '../components/ReportModal.jsx'
import BehaviorRadar from '../components/BehaviorRadar.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS  = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

// Colours per candidate for line chart
const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}



export default function ProctorDashboard() {
  const navigate     = useNavigate()
  const wsRef        = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const [dark, setDark]         = useState(true)
  const [section, setSection]   = useState('monitoring')
  const [candidates, setCandidates]   = useState({})   // id → candidate obj
  const [alerts,     setAlerts]       = useState([])   // flat list newest-last
  const [selected,   setSelected]     = useState(null) // candidate_id for detail panel
  const [reportExamId, setReportExamId] = useState(null)
  const [chartData,  setChartData]    = useState([])   // [{time, [cid]: score}]
  const [wsStatus,   setWsStatus]     = useState('connecting')
  const [studentAccounts, setStudentAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [studentForm, setStudentForm] = useState({ name: '', studentId: '', password: '' })
  const [questionBank, setQuestionBank] = useState([])
  const [questionForm, setQuestionForm] = useState({
    type: 'shortanswer',
    question: '',
    answer: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
  })
  const [liveFrames, setLiveFrames] = useState({}) // candidate_id → base64 frame

  // Audio beep for high-severity alerts
  const playAlertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (_) {}
  }, [])

  const name = localStorage.getItem('name') || 'Proctor'

  // ── Dark mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // ── Load student accounts from backend ─────────────────────────────────
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
      const res = await fetch(`${API}/students/accounts`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setStudentAccounts(data)
        }
      } catch (e) {
        console.error('Failed to load student accounts:', e)
      } finally {
        setLoadingAccounts(false)
      }
    }
    fetchAccounts()
  }, [])

  // ── Load questions from API ─────────────────────────────────────────
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${API}/questions`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          setQuestionBank(data)
        }
      } catch (e) {
        console.error('Failed to load questions:', e)
      }
    }
    fetchQuestions()
  }, [])

  // ── WS connection ─────────────────────────────────────────────────────
  useEffect(() => {
    let closedByComponent = false

    const connect = () => {
      setWsStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting')
      const ws = new WebSocket(`${WS}/ws/proctor?role=proctor`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
        setWsStatus('connected')
      }

      ws.onclose = () => {
        if (closedByComponent) return
        setWsStatus('disconnected')
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000)
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => setWsStatus('error')

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          handleWsMessage(msg)
        } catch (_) {}
      }
    }

    connect()

    return () => {
      closedByComponent = true
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  const handleWsMessage = useCallback((msg) => {
    const { type } = msg

    if (type === 'INIT') {
      // Full snapshot on connect
      setCandidates(msg.candidates || {})
      return
    }

    if (type === 'CANDIDATE_JOINED') {
      setCandidates(prev => ({
        ...prev,
        [msg.candidate_id]: {
          candidate_id:   msg.candidate_id,
          candidate_name: msg.candidate_id,
          risk_score:     0,
          status:         'CLEAN',
          is_active:      true,
          last_alert:     null,
          score_history:  [],
        },
      }))
      return
    }

    if (type === 'CANDIDATE_LEFT') {
      setCandidates(prev => {
        const next = { ...prev }
        if (next[msg.candidate_id]) {
          next[msg.candidate_id] = { ...next[msg.candidate_id], is_active: false }
        }
        return next
      })
      return
    }

    if (type === 'SCORE_UPDATE') {
      const cid = msg.candidate_id
      setCandidates(prev => ({ ...prev, [cid]: { ...prev[cid], ...msg } }))

      // Update chart data
      const timeLabel = new Date().toLocaleTimeString()
      setChartData(prev => {
        const last = { ...( prev[prev.length - 1] || {}), time: timeLabel }
        last[cid] = msg.risk_score
        const next = [...prev.slice(-30), last]
        return next
      })
      return
    }

    if (type === 'ALERT') {
      setAlerts(prev => [...prev.slice(-200), msg])

      // Play sound on HIGH/CRITICAL alerts
      if (msg.severity === 'HIGH') playAlertSound()

      // Update candidate
      const cid = msg.candidate_id
      if (cid) {
        setCandidates(prev => {
          const existing = prev[cid] || {}
          return {
            ...prev,
            [cid]: {
              ...existing,
              candidate_id: cid,
              risk_score: msg.score,
              last_alert: msg,
              status: scoreToStatus(msg.score),
            },
          }
        })
      }
      return
    }

    if (type === 'LIVE_FRAME') {
      setLiveFrames(prev => ({ ...prev, [msg.candidate_id]: msg.frame }))
      return
    }
  }, [playAlertSound])

  function scoreToStatus(score) {
    if (score > 90) return 'CRITICAL'
    if (score > 60) return 'HIGH_RISK'
    if (score > 30) return 'SUSPICIOUS'
    return 'CLEAN'
  }

  function terminate(candidateId) {
    if (!confirm(`Terminate exam for ${candidateId}?`)) return
    wsRef.current?.send(JSON.stringify({ action: 'terminate', candidate_id: candidateId }))
    setCandidates(prev => {
      const c = prev[candidateId]
      if (!c) return prev
      return { ...prev, [candidateId]: { ...c, is_active: false, status: 'TERMINATED' } }
    })
  }

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  function generateStudentId(name = '') {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'student'
    return `${base}-${Math.random().toString(36).slice(2, 6)}`
  }

  function generatePassword() {
    return Math.random().toString(36).slice(2, 10)
  }

  async function createStudentAccount() {
    const name = studentForm.name.trim() || 'Student'
    const studentId = studentForm.studentId.trim() || generateStudentId(name)
    const password = studentForm.password.trim() || generatePassword()

    try {
      const res = await fetch(`${API}/students/accounts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, studentId, password }),
      })
      if (res.ok) {
        const newAccount = await res.json()
        setStudentAccounts(prev => [newAccount, ...prev.filter(item => item.studentId !== studentId)])
        setStudentForm({ name: '', studentId: '', password: '' })
      }
    } catch (e) {
      console.error('Failed to create student account:', e)
    }
  }

  async function removeStudentAccount(studentId) {
    try {
      const res = await fetch(`${API}/students/accounts/${studentId}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (res.ok) {
        setStudentAccounts(prev => prev.filter(item => item.studentId !== studentId))
      }
    } catch (e) {
      console.error('Failed to delete student account:', e)
    }
  }

  async function createQuestion() {
    const question = questionForm.question.trim()
    if (!question) return

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    let newQuestion = {
      id,
      type: questionForm.type,
      question,
      createdAt: new Date().toISOString(),
    }

    if (questionForm.type === 'shortanswer') {
      const answer = questionForm.answer.trim()
      if (!answer) return
      newQuestion.answer = answer
    } else if (questionForm.type === 'mcq') {
      const validOptions = questionForm.options.map(o => o.trim()).filter(o => o)
      if (validOptions.length < 2) {
        alert('MCQ must have at least 2 options')
        return
      }
      newQuestion.options = validOptions
      newQuestion.correctAnswer = Math.min(questionForm.correctAnswer, validOptions.length - 1)
    }

    setQuestionBank(prev => [newQuestion, ...prev])

    // Persist to API
    try {
      const res = await fetch(`${API}/questions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newQuestion),
      })
      if (res.ok) {
        const saved = await res.json()
        // Update with server-assigned ID
        setQuestionBank(prev => [
          { ...newQuestion, id: saved.id },
          ...prev.filter(q => q.id !== newQuestion.id),
        ])
      }
    } catch (e) {
      console.error('Failed to save question to API:', e)
    }
    setQuestionForm({
      type: 'shortanswer',
      question: '',
      answer: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
    })
  }

  async function removeQuestion(questionId) {
    setQuestionBank(prev => prev.filter(item => item.id !== questionId))
    try {
      await fetch(`${API}/questions/${questionId}`, { method: 'DELETE', headers: getAuthHeaders() })
    } catch (e) {
      console.error('Failed to delete question from API:', e)
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (_) {}
  }

  // ── Derived stats ─────────────────────────────────────────────────────
  const allCandidates = Object.values(candidates)
  const total       = allCandidates.length
  const active      = allCandidates.filter(c => c.is_active).length
  const flagged     = allCandidates.filter(c => ['HIGH_RISK','CRITICAL','SUSPICIOUS'].includes(c.status)).length
  const highRisk    = allCandidates.filter(c => ['HIGH_RISK','CRITICAL'].includes(c.status)).length
  const selectedCan = selected ? candidates[selected] : null

  // Alerts for selected candidate (detail view)
  const selectedAlerts = selected
    ? alerts.filter(a => a.candidate_id === selected)
    : []

  // Chart lines
  const candidateIds = Object.keys(candidates)

  return (
    <div className={`min-h-screen flex flex-col ${dark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100">

        {/* ── Top bar ── */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600" size={24} />
            <span className="font-bold text-lg text-slate-900 dark:text-white">ProctorAI</span>
            <span className="hidden sm:block text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Dashboard
            </span>
          </div>

          {/* WS status */}
          <div className={`flex items-center gap-1.5 text-xs font-medium ${
            wsStatus === 'connected'    ? 'text-emerald-500' :
            ['connecting', 'reconnecting'].includes(wsStatus) ? 'text-amber-500' :
            'text-red-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'  ? 'bg-emerald-500' :
              ['connecting', 'reconnecting'].includes(wsStatus) ? 'bg-amber-400 animate-pulse' :
              'bg-red-500'
            }`} />
            {wsStatus}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:block">👋 {name}</span>
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* ── Section tabs ── */}
        <div className="px-6 pt-6">
          <div className="card p-2 flex flex-wrap gap-2">
            {[
              { id: 'monitoring', label: 'Live Monitoring', icon: Shield },
              { id: 'students', label: 'Student Access', icon: KeyRound },
              { id: 'questions', label: 'Question Bank', icon: ClipboardList },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  section === id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {section === 'monitoring' ? (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 pt-6">
              {[
                { label: 'Total Candidates', value: total,    color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20',  icon: Users },
                { label: 'Active Now',       value: active,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: RefreshCw },
                { label: 'Flagged',          value: flagged,  color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: AlertTriangle },
                { label: 'High Risk',        value: highRisk, color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',        icon: TrendingUp },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className="card p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={color} size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 flex gap-4 p-6 min-h-0">

              {/* Left: candidates + chart */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">

                {/* Risk score timeline chart */}
                {chartData.length > 1 && (
                  <div className="card p-4">
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-500" />
                      Live Risk Score Timeline
                    </h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {candidateIds.map((cid, idx) => (
                          <Line
                            key={cid}
                            type="monotone"
                            dataKey={cid}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            name={candidates[cid]?.candidate_name || cid}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Candidate grid */}
                <div className="card p-4 flex-1">
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Users size={16} className="text-indigo-500" />
                    Candidates
                    {total === 0 && (
                      <span className="ml-2 text-xs text-slate-400 font-normal">
                        — Waiting for students to connect…
                      </span>
                    )}
                  </h3>

                  {total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Shield size={40} className="mb-4 opacity-20" />
                      <p className="text-sm">No candidates connected yet</p>
                      <p className="text-xs mt-1">Students will appear here when they start the exam</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {allCandidates.map(c => (
                        <CandidateCard
                          key={c.candidate_id}
                          candidate={c}
                          onSelect={c => setSelected(c.candidate_id)}
                          onTerminate={terminate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: alert feed / detail panel */}
              <div className="w-80 flex flex-col gap-4 flex-shrink-0">

                {/* Detail panel for selected candidate */}
                {selectedCan ? (
                  <div className="card p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-800 dark:text-white">{selectedCan.candidate_name}</p>
                        <p className="text-xs text-slate-400">{selectedCan.candidate_id}</p>
                      </div>
                      <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <X size={16} />
                      </button>
                    </div>

                    {/* Live video feed */}
                    {liveFrames[selectedCan.candidate_id] && (
                      <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
                        <img
                          src={liveFrames[selectedCan.candidate_id]}
                          alt="Live feed"
                          className="w-full h-auto"
                        />
                        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-emerald-400 font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                      <RiskMeter score={selectedCan.risk_score} size={110} />
                      <div className="flex-1 w-full max-w-[200px]">
                        <BehaviorRadar alerts={selectedAlerts} dark={dark} />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {selectedCan.is_active && (
                        <button
                          onClick={() => terminate(selectedCan.candidate_id)}
                          className="btn-danger text-xs flex-1 flex items-center justify-center gap-1 py-2"
                        >
                          <Ban size={12} /> Terminate
                        </button>
                      )}
                      <button
                        onClick={() => setReportExamId(selectedCan.exam_id || 'demo')}
                        className="flex-1 text-xs py-2 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        <FileText size={12} /> Report
                      </button>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Alert History</p>
                      <AlertFeed alerts={selectedAlerts} />
                    </div>
                  </div>
                ) : (
                  <div className="card p-4 flex-1">
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <Bell size={16} className="text-indigo-500" />
                      Live Alerts
                      {alerts.length > 0 && (
                        <span className="ml-auto text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                          {alerts.length}
                        </span>
                      )}
                    </h3>
                    <AlertFeed alerts={alerts} />
                  </div>
                )}

                {/* Recent exam list */}
                <ExamList onSelect={examId => setReportExamId(examId)} />
              </div>
            </div>
          </>
        ) : section === 'students' ? (
          <div className="flex-1 p-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <div className="card p-6">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Student Access</h2>
                    <p className="text-sm text-slate-500 mt-1">Generate or manually define a student ID and password for the exam portal.</p>
                  </div>
                  <KeyRound className="text-indigo-500" size={22} />
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Student Name</span>
                    <input
                      value={studentForm.name}
                      onChange={e => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Alice Demo"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Student ID</span>
                    <input
                      value={studentForm.studentId}
                      onChange={e => setStudentForm(prev => ({ ...prev, studentId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="alice-001"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Password</span>
                    <input
                      value={studentForm.password}
                      onChange={e => setStudentForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="student123"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button onClick={createStudentAccount} className="btn-primary flex items-center gap-2">
                      <Plus size={16} /> Create Student
                    </button>
                    <button
                      onClick={() => setStudentForm({
                        name: studentForm.name,
                        studentId: generateStudentId(studentForm.name),
                        password: generatePassword(),
                      })}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Generate ID + Pass
                    </button>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generated Accounts</h2>
                    <p className="text-sm text-slate-500 mt-1">Stored in MongoDB for persistent access.</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {studentAccounts.length} accounts
                  </span>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {loadingAccounts ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-400">
                      Loading accounts...
                    </div>
                  ) : studentAccounts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-400">
                      No student accounts yet.
                    </div>
                  ) : (
                    studentAccounts.map(account => (
                      <div key={account.studentId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{account.name}</p>
                            <p className="text-sm text-slate-500">ID: {account.studentId}</p>
                            <p className="text-sm text-slate-500">Pass: {account.password}</p>
                          </div>
                          <button
                            onClick={() => removeStudentAccount(account.studentId)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            aria-label="Remove student account"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copyText(`${account.id} / ${account.password}`)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Copy size={12} /> Copy login
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <div className="card p-6">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Question With Answer</h2>
                    <p className="text-sm text-slate-500 mt-1">Create a question bank the proctor can reuse during the exam.</p>
                  </div>
                  <ClipboardList className="text-indigo-500" size={22} />
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Question Type</span>
                    <div className="flex gap-3 items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="shortanswer"
                          checked={questionForm.type === 'shortanswer'}
                          onChange={e => setQuestionForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Short Answer</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="mcq"
                          checked={questionForm.type === 'mcq'}
                          onChange={e => setQuestionForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Multiple Choice (MCQ)</span>
                      </label>
                    </div>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Question</span>
                    <textarea
                      rows={4}
                      value={questionForm.question}
                      onChange={e => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Enter your question here..."
                    />
                  </label>

                  {questionForm.type === 'shortanswer' ? (
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-300">Answer</span>
                      <input
                        value={questionForm.answer}
                        onChange={e => setQuestionForm(prev => ({ ...prev, answer: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Provide the expected answer..."
                      />
                    </label>
                  ) : (
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Options (select the correct one)</span>
                      {questionForm.options.map((opt, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="radio"
                            name="correct"
                            checked={questionForm.correctAnswer === i}
                            onChange={() => setQuestionForm(prev => ({ ...prev, correctAnswer: i }))}
                            className="w-4 h-4 accent-green-500"
                          />
                          <input
                            value={opt}
                            onChange={e => {
                              const newOpts = [...questionForm.options]
                              newOpts[i] = e.target.value
                              setQuestionForm(prev => ({ ...prev, options: newOpts }))
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                      <p className="text-xs text-slate-400 mt-1">✓ = Correct answer</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button onClick={createQuestion} className="btn-primary flex items-center gap-2 w-full justify-center">
                      <Plus size={16} /> Add {questionForm.type === 'mcq' ? 'MCQ' : 'Question'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Question Bank</h2>
                    <p className="text-sm text-slate-500 mt-1">Remove any question from the current bank at any time.</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {questionBank.length} questions
                  </span>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {questionBank.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-400">
                      No questions added yet.
                    </div>
                  ) : (
                    questionBank.map(item => (
                      <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-slate-800 dark:text-white">{item.question}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold uppercase">
                                {item.type === 'mcq' ? 'MCQ' : 'Short'}
                              </span>
                            </div>
                            {item.type === 'mcq' ? (
                              <div className="text-sm space-y-1 mt-2">
                                {item.options?.map((opt, i) => (
                                  <div key={i} className={`px-2 py-1 rounded text-xs ${
                                    i === item.correctAnswer
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    <span className="font-mono">{String.fromCharCode(65 + i)}.</span> {opt}
                                    {i === item.correctAnswer && ' ✓'}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 mt-1">Answer: <span className="text-slate-600 dark:text-slate-400 font-medium">{item.answer}</span></p>
                            )}
                          </div>
                          <button
                            onClick={() => removeQuestion(item.id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 flex-shrink-0"
                            aria-label="Remove question"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {reportExamId && (
          <ReportModal examId={reportExamId} onClose={() => setReportExamId(null)} />
        )}
      </div>
    </div>
  )
}

// Small widget to list recent exams
function ExamList({ onSelect }) {
  const [exams, setExams] = useState([])

  useEffect(() => {
    fetch(`${API}/exam/list`)
      .then(r => r.json())
      .then(data => setExams(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {})
  }, [])

  if (exams.length === 0) return null

  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Exams</h3>
      <div className="space-y-2">
        {exams.map(e => (
          <button
            key={e.exam_id}
            onClick={() => onSelect(e.exam_id)}
            className="w-full flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700 px-2 py-1.5 rounded-lg text-xs transition-colors"
          >
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">{e.candidate_name}</p>
              <p className="text-slate-400">{new Date(e.start_time).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                e.status === 'ACTIVE'     ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                e.status === 'COMPLETED'  ? 'bg-slate-100 text-slate-500 dark:bg-slate-700' :
                'bg-red-100 text-red-600 dark:bg-red-900/30'
              }`}>
                {e.status}
              </span>
              <ChevronRight size={12} className="text-slate-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
