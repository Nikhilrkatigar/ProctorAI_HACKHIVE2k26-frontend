import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Camera, LogOut, Clock, AlertTriangle, Timer, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWebcam } from '../hooks/useWebcam.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useAudioMonitor } from '../hooks/useAudioMonitor.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const QUESTION_STORAGE_KEY = 'proctorai.question-bank'
const EXAM_DURATION_SEC = 30 * 60 // 30 minutes

// Fallback questions if none stored
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    type: 'mcq',
    question: 'Which algorithm has the best average-case time complexity for sorting?',
    options: ['Bubble Sort O(n²)', 'Merge Sort O(n log n)', 'Insertion Sort O(n²)', 'Selection Sort O(n²)'],
    correctAnswer: 1,
  },
  {
    id: 2,
    type: 'mcq',
    question: 'In a neural network, what does the activation function do?',
    options: [
      'Initialises weights',
      'Introduces non-linearity into the output',
      'Reduces the learning rate',
      'Normalises the input data',
    ],
    correctAnswer: 1,
  },
  {
    id: 3,
    type: 'mcq',
    question: 'What does "overfitting" mean in machine learning?',
    options: [
      'Model performs well on training but poorly on test data',
      'Model is too simple to learn patterns',
      'Training data has too many features',
      'Loss function diverges during training',
    ],
    correctAnswer: 0,
  },
]

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export default function StudentExam() {
  const navigate   = useNavigate()
  const videoRef   = useRef(null)
  const name       = localStorage.getItem('name')   || 'Student'
  const email      = localStorage.getItem('email')  || 'student'
  const candidateId = email.split('@')[0]

  const { ready: camReady, error: camError, captureFrame } = useWebcam(videoRef)
  const { send, ready: wsReady, addHandler }               = useWebSocket(candidateId, 'student')

  // Load questions from API first, then localStorage fallback, then defaults
  const loadQuestions = () => {
    try {
      const stored = localStorage.getItem(QUESTION_STORAGE_KEY)
      const questions = stored ? JSON.parse(stored) : DEFAULT_QUESTIONS
      return questions.length > 0 ? questions : DEFAULT_QUESTIONS
    } catch {
      return DEFAULT_QUESTIONS
    }
  }

  const [questions,     setQuestions]     = useState(loadQuestions)
  const [examId,        setExamId]        = useState(null)
  const [phase,         setPhase]         = useState('setup')  // setup | capturing | active | done
  const [answers,       setAnswers]       = useState({})
  const [currentQ,      setCurrentQ]      = useState(0)
  const [violation,     setViolation]     = useState(false)    // flicker flag
  const [elapsedSec,    setElapsedSec]    = useState(0)
  const [remainingSec,  setRemainingSec]  = useState(EXAM_DURATION_SEC)
  const [startTime,     setStartTime]     = useState(null)
  const [tabSwitches,   setTabSwitches]   = useState(0)
  const [inFullscreen,  setInFullscreen]  = useState(false)
  const [capturePending, setCapturePending] = useState(false)

  // Keyboard activity tracking refs
  const keystrokeTimestamps = useRef([])

  // Audio monitoring
  const { level: audioLevel } = useAudioMonitor({
    enabled: phase === 'active',
    threshold: 0.18,
    onAlert: useCallback(({ level }) => {
      send({ type: 'AUDIO_ANOMALY', level: Math.round(level * 100) })
      toast.error('Unusual audio activity detected — please keep quiet', { icon: '🔊' })
    }, [send]),
  })

  // Fetch questions from API on mount
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch(`${API}/questions`, { headers: getAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          if (data.length > 0) {
            setQuestions(data)
            return
          }
        }
      } catch (e) {
        console.warn('Could not fetch questions from API, using local fallback')
      }
    }
    fetchQuestions()
  }, [])

  // ── Start exam ────────────────────────────────────────────────────────
  async function startExam() {
    // Request fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setInFullscreen(true)
      }
    } catch (err) {
      console.warn('Fullscreen not available:', err)
      toast.error('Please enable fullscreen for secure exam mode', { icon: '🔐' })
    }

    const res = await fetch(`${API}/exam/start`, {
      method:  'POST',
      headers: getAuthHeaders(),
      body:    JSON.stringify({ candidate_id: candidateId, candidate_name: name }),
    })
    if (!res.ok) {
      toast.error('Could not start exam. Please sign in again.')
      return
    }
    const data = await res.json()
    setExamId(data.exam_id)

    // Send candidate info over WS
    send({ type: 'CANDIDATE_INFO', name, exam_id: data.exam_id })
    setPhase('capturing')
  }

  // ── Capture reference face ────────────────────────────────────────────
  async function captureReference() {
    const frame = captureFrame(0.8)
    if (!frame) return
    setCapturePending(true)
    send({ type: 'REFERENCE_FACE', frame })
  }

  // ── Stream frames every second ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const id = setInterval(() => {
      const frame = captureFrame(0.5)
      if (frame) send({ type: 'FRAME', frame })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, captureFrame, send])

  // ── Elapsed timer + countdown ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const id = setInterval(() => {
      setElapsedSec(s => s + 1)
      setRemainingSec(s => {
        const next = s - 1
        // Warning toasts
        if (next === 300) toast('⏰ 5 minutes remaining!', { icon: '⚠️' })
        if (next === 60) toast('⏰ 1 minute remaining!', { icon: '🔴' })
        // Auto-submit
        if (next <= 0) {
          handleEndExam()
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── Heartbeat ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsReady) return
    const id = setInterval(() => send({ type: 'HEARTBEAT' }), 10_000)
    return () => clearInterval(id)
  }, [wsReady, send])

  // ── WS messages from server ────────────────────────────────────────────
  useEffect(() => {
    return addHandler((msg) => {
      if (msg.type === 'ALERT') {
        setViolation(true)
        setTimeout(() => setViolation(false), 2000)
        const label = msg.alert_type || msg.type || 'ALERT'
        toast.error(`${label.replaceAll('_', ' ')}`, {
          icon: '⚠️',
        })
      }
      if (msg.type === 'REFERENCE_CAPTURED') {
        setCapturePending(false)
        if (msg.success) {
          setPhase('active')
          setStartTime(Date.now())
          setRemainingSec(EXAM_DURATION_SEC)
          toast.success('Identity verified. Exam started.')
        } else {
          toast.error(msg.message || 'No clear face detected. Try again in better light.')
        }
      }
      if (msg.type === 'TERMINATED') {
        toast.error('Your exam has been terminated by the proctor.', {
          icon: '⛔',
        })
        handleEndExam()
      }
    })
  }, [addHandler])

  // ── Tab/window switch detection (visibilitychange only to prevent double-fire) ──
  useEffect(() => {
    if (phase !== 'active') return

    const onVisibility = () => {
      if (document.hidden) {
        setTabSwitches(n => n + 1)
        send({ type: 'TAB_SWITCH' })
        toast.warning('Tab switch detected', { icon: '⚠️' })
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase, send])

  // ── Clipboard blocking ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const block = (e) => {
      e.preventDefault()
      send({ type: 'CLIPBOARD_VIOLATION' })
      toast.error('Copy/Paste disabled during exam', { icon: '🔒' })
    }
    document.addEventListener('copy',  block)
    document.addEventListener('paste', block)
    document.addEventListener('cut',   block)
    return () => {
      document.removeEventListener('copy',  block)
      document.removeEventListener('paste', block)
      document.removeEventListener('cut',   block)
    }
  }, [phase, send])

  // ── Keyboard activity anomaly detection ───────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return

    const onKeyDown = (e) => {
      const now = Date.now()
      keystrokeTimestamps.current.push(now)

      // Keep only last 2 seconds of timestamps
      const cutoff = now - 2000
      keystrokeTimestamps.current = keystrokeTimestamps.current.filter(t => t > cutoff)

      // If more than 15 keystrokes in 2 seconds → suspicious rapid typing
      if (keystrokeTimestamps.current.length > 15) {
        send({ type: 'KEYBOARD_ANOMALY', detail: 'rapid_typing', rate: keystrokeTimestamps.current.length })
        toast.error('Unusual keyboard activity detected', { icon: '⌨️' })
        keystrokeTimestamps.current = [] // Reset to avoid spam
      }

      // Detect suspicious key combos (even if prevented, detect the attempt)
      if (e.key === 'Meta' || e.key === 'OS') {
        send({ type: 'KEYBOARD_ANOMALY', detail: 'windows_key' })
      }
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        send({ type: 'KEYBOARD_ANOMALY', detail: 'alt_tab' })
        toast.error('Alt+Tab is not allowed', { icon: '🔒' })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [phase, send])

  // ── Anti-cheat security (F12, right-click, screenshot, fullscreen) ────
  useEffect(() => {
    if (phase !== 'active') return

    const blockKeys = (e) => {
      // Block F12 (DevTools)
      if (e.keyCode === 123) {
        e.preventDefault()
        send({ type: 'DEVTOOLS_ATTEMPT' })
        toast.error('Developer tools are disabled', { icon: '🔒' })
        return
      }
      // Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault()
        send({ type: 'DEVTOOLS_ATTEMPT' })
        toast.error('Developer tools are disabled', { icon: '🔒' })
        return
      }
      // Block Ctrl+Shift+C (DevTools inspector)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault()
        send({ type: 'DEVTOOLS_ATTEMPT' })
        return
      }
      // Block Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault()
        send({ type: 'DEVTOOLS_ATTEMPT' })
        return
      }
      // Block PrintScreen
      if (e.keyCode === 44) {
        e.preventDefault()
        send({ type: 'SCREENSHOT_ATTEMPT' })
        toast.error('Screenshots are not allowed', { icon: '🚫' })
        return
      }
    }

    const blockRightClick = (e) => {
      e.preventDefault()
      send({ type: 'RIGHT_CLICK_ATTEMPT' })
      toast.error('Right-click is disabled', { icon: '🔒' })
    }

    const enforceFullscreen = () => {
      if (!document.fullscreenElement && inFullscreen) {
        document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && phase === 'active') {
        setInFullscreen(false)
        send({ type: 'FULLSCREEN_EXIT' })
        toast.warning('Fullscreen exited - please re-enter', { icon: '⚠️' })
      }
    }

    document.addEventListener('keydown', blockKeys)
    document.addEventListener('contextmenu', blockRightClick)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    // Re-enforce fullscreen every 2 seconds
    const fullscreenInterval = setInterval(enforceFullscreen, 2000)

    return () => {
      document.removeEventListener('keydown', blockKeys)
      document.removeEventListener('contextmenu', blockRightClick)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      clearInterval(fullscreenInterval)
    }
  }, [phase, send, inFullscreen])

  // ── End exam ──────────────────────────────────────────────────────────
  async function handleEndExam() {
    setPhase('done')
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    if (examId) {
      await fetch(`${API}/exam/end`, {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify({ exam_id: examId }),
      })
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const q = questions[currentQ]
  const timerUrgent = remainingSec <= 60
  const timerWarning = remainingSec <= 300 && !timerUrgent

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* ── Top bar ── */}
      <header className="bg-indigo-700 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Shield size={22} />
          <span className="font-bold text-lg">ProctorAI Exam</span>
          <span className="text-indigo-300 text-sm hidden sm:block">HACKHIVE-2k26</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {/* Countdown timer */}
          {phase === 'active' && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-bold ${
              timerUrgent ? 'bg-red-500 animate-pulse text-white' :
              timerWarning ? 'bg-amber-500 text-white' :
              'bg-white/20 text-white'
            }`}>
              <Timer size={14} />
              {formatTime(remainingSec)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {formatTime(elapsedSec)}
          </span>
          <span className="text-indigo-200">👤 {name}</span>
          {phase === 'active' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
              violation ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${violation ? 'bg-red-200' : 'bg-emerald-200'}`} />
              {violation ? 'Alert' : 'All Clear'}
            </div>
          )}
        </div>
      </header>

      {/* ── Setup phase ── */}
      {phase === 'setup' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-8 max-w-md w-full text-center">
            <Shield className="mx-auto text-indigo-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome, {name}</h2>
            <p className="text-slate-500 mb-6 text-sm">
              Your exam will be monitored by AI. Please ensure your webcam is working and you are in a well-lit room.
            </p>
            <ul className="text-left text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-8">
              {['Do not switch browser tabs', 'Keep your face visible at all times', 'Do not copy/paste content', 'Ensure only you are in the frame', `You have ${EXAM_DURATION_SEC / 60} minutes to complete the exam`].map(r => (
                <li key={r} className="flex items-center gap-2">
                  <span className="text-indigo-500">✓</span> {r}
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <video ref={videoRef} autoPlay muted playsInline className="w-48 h-36 mx-auto rounded-lg bg-slate-200 object-cover" />
              {camError && <p className="text-red-500 text-xs mt-2">{camError}</p>}
            </div>
            <button
              onClick={startExam}
              disabled={!wsReady}
              className="btn-primary w-full"
            >
              {wsReady ? 'Start Exam →' : 'Connecting…'}
            </button>
          </div>
        </div>
      )}

      {/* ── Reference face capture ── */}
      {phase === 'capturing' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-8 max-w-md w-full text-center">
            <Camera className="mx-auto text-indigo-600 mb-4" size={40} />
            <h2 className="text-xl font-bold mb-2">Identity Verification</h2>
            <p className="text-slate-500 text-sm mb-6">Look directly at the camera. We'll capture your reference photo for the exam session.</p>
            <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-xs mx-auto rounded-xl bg-slate-200 object-cover aspect-[4/3] mb-6 ring-4 ring-indigo-500" />
            <button onClick={captureReference} className="btn-primary w-full" disabled={!camReady || capturePending}>
              {capturePending ? 'Verifying...' : 'Capture & Begin Exam'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active exam ── */}
      {phase === 'active' && (
        <div className="flex-1 flex flex-col relative">
          <div className="absolute bottom-6 right-6 z-20 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Live Camera</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">Streaming</span>
            </div>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-[4/3] object-cover bg-slate-200"
            />
            <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{camReady ? 'Camera ready' : 'Waiting for camera'}</span>
              <span className="text-emerald-500 font-medium">AI Monitoring Active</span>
            </div>
          </div>

          {/* Question area */}
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
            <div className="card p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-400 font-medium">Question {currentQ + 1} of {questions.length}</span>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${
                      i < currentQ ? 'bg-indigo-600' : i === currentQ ? 'bg-indigo-400' : 'bg-slate-200'
                    }`} />
                  ))}
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{q.question}</h2>
              
              {/* MCQ Options or Short Answer */}
              {q.type === 'mcq' ? (
                <div className="space-y-3">
                  {q.options?.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: i }))}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                        answers[q.id] === i
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:text-slate-300'
                      }`}
                    >
                      <span className="mr-3 font-mono text-xs text-slate-400">{String.fromCharCode(65+i)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="grid gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Your Answer:</span>
                    <textarea
                      rows={6}
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Type your answer here..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:text-white"
                    />
                  </label>
                  <p className="text-xs text-slate-400">Character count: {(answers[q.id] || '').length}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                className="px-5 py-2 rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-600 dark:text-white"
              >
                ← Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ(q => q + 1)}
                  className="btn-primary"
                >
                  Next →
                </button>
              ) : (
                <button onClick={handleEndExam} className="btn-danger">
                  Submit Exam
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-10 max-w-md w-full text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Exam Submitted!</h2>
            <p className="text-slate-500 mb-4 text-sm">Your exam has been submitted successfully.</p>
            {tabSwitches > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 mb-6 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} className="inline mr-1" />
                {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''} recorded during exam
              </div>
            )}
            <button
              onClick={() => { localStorage.clear(); navigate('/login') }}
              className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
