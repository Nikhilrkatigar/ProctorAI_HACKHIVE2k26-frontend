import { useRef, useEffect, useState, useCallback } from 'react'
import { Shield, Camera, Clock, AlertTriangle, Timer, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWebcam } from '../hooks/useWebcam.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useAudioMonitor } from '../hooks/useAudioMonitor.js'
import { useSecureBrowser } from '../hooks/useSecureBrowser.js'
import SecureBrowserOverlay from '../components/SecureBrowserOverlay.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const QUESTION_STORAGE_KEY = 'proctorai.question-bank'
const EXAM_DURATION_SEC = 30 * 60
const COOLDOWN_MS = 2000

const DEFAULT_QUESTIONS = [
  {
    id: 1, type: 'mcq',
    question: 'Which algorithm has the best average-case time complexity for sorting?',
    options: ['Bubble Sort O(n²)', 'Merge Sort O(n log n)', 'Insertion Sort O(n²)', 'Selection Sort O(n²)'],
    correctAnswer: 1,
  },
  {
    id: 2, type: 'mcq',
    question: 'In a neural network, what does the activation function do?',
    options: ['Initialises weights', 'Introduces non-linearity into the output', 'Reduces the learning rate', 'Normalises the input data'],
    correctAnswer: 1,
  },
  {
    id: 3, type: 'mcq',
    question: 'What does "overfitting" mean in machine learning?',
    options: ['Model performs well on training but poorly on test data', 'Model is too simple to learn patterns', 'Training data has too many features', 'Loss function diverges during training'],
    correctAnswer: 0,
  },
]

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

// ── MSB-style lockdown wall shown whenever focus/fullscreen is lost ────────────
function LockWall({ reason, tabSwitches, onResume }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{ background: 'rgba(2,6,23,0.97)', backdropFilter: 'blur(16px)' }}
    >
      {/* Animated border ring */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 border-4 border-red-600/40 animate-pulse rounded-none" />
      </div>

      {/* Lock icon */}
      <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center mb-8 animate-pulse">
        <Lock size={44} className="text-red-400" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Exam Paused</h1>
      <p className="text-red-400 font-semibold mb-1 text-lg">{reason}</p>
      <p className="text-slate-400 text-sm mb-8 max-w-sm text-center">
        This incident has been recorded and sent to your proctor.
        Return to fullscreen to continue your exam.
      </p>

      {/* Violation counter */}
      {tabSwitches > 0 && (
        <div className="mb-6 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
          {tabSwitches} violation{tabSwitches > 1 ? 's' : ''} recorded this session
        </div>
      )}

      {/* Resume button — forces fullscreen */}
      <button
        onClick={onResume}
        className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-500/30"
      >
        Return to Exam (Fullscreen Required)
      </button>

      {/* Warning footer */}
      <p className="mt-6 text-slate-600 text-xs">
        Repeated violations may result in automatic exam termination.
      </p>
    </div>
  )
}

export default function StudentExam() {
  const videoRef    = useRef(null)
  const closeTimer  = useRef(null)
  const name        = localStorage.getItem('name')  || 'Student'
  const email       = localStorage.getItem('email') || 'student'
  const candidateId = email.split('@')[0]

  const { ready: camReady, error: camError, captureFrame } = useWebcam(videoRef)
  const { send, ready: wsReady, addHandler }               = useWebSocket(candidateId, 'student')

  const { notifyExamStart, notifyExamEnd } = useSecureBrowser({
    candidateId,
    onTerminate: () => { toast.error('Exam terminated by proctor.', { icon: '⛔' }); handleEndExam() },
  })

  const loadQuestions = () => {
    try {
      const s = localStorage.getItem(QUESTION_STORAGE_KEY)
      const q = s ? JSON.parse(s) : DEFAULT_QUESTIONS
      return q.length > 0 ? q : DEFAULT_QUESTIONS
    } catch { return DEFAULT_QUESTIONS }
  }

  const [questions,      setQuestions]      = useState(loadQuestions)
  const [examId,         setExamId]         = useState(null)
  const [phase,          setPhase]          = useState('setup') // setup | capturing | active | done
  const [answers,        setAnswers]        = useState({})
  const [currentQ,       setCurrentQ]       = useState(0)
  const [violation,      setViolation]      = useState(false)
  const [elapsedSec,     setElapsedSec]     = useState(0)
  const [remainingSec,   setRemainingSec]   = useState(EXAM_DURATION_SEC)
  const [tabSwitches,    setTabSwitches]    = useState(0)
  const [capturePending, setCapturePending] = useState(false)
  const [audioLevel,     setAudioLevel]     = useState(0)

  // ── Lockdown wall state ────────────────────────────────────────────────────
  // null = no wall. { reason } = wall is up, exam hidden behind it.
  const [lockWall, setLockWall] = useState(null)
  const lockWallRef             = useRef(null)   // mirror for use inside event handlers
  const cooldowns               = useRef({})
  const keystrokeTs             = useRef([])
  const examActiveRef           = useRef(false)  // mirror of phase==='active' for handlers

  // Keep ref in sync
  useEffect(() => { lockWallRef.current = lockWall }, [lockWall])
  useEffect(() => { examActiveRef.current = phase === 'active' }, [phase])

  // ── Violation reporter (deduplicated) ──────────────────────────────────────
  const reportViolation = useCallback((eventType, detail = '') => {
    const key = `${eventType}:${detail}`
    const now  = Date.now()
    if ((cooldowns.current[key] || 0) + COOLDOWN_MS > now) return
    cooldowns.current[key] = now
    send({ type: eventType, detail })
  }, [send])

  // ── Raise the lock wall ────────────────────────────────────────────────────
  const raiseLockWall = useCallback((reason, eventType, detail = '') => {
    if (!examActiveRef.current) return
    setLockWall({ reason })
    setTabSwitches(n => n + 1)
    setViolation(true)
    setTimeout(() => setViolation(false), 3000)
    reportViolation(eventType, detail)
  }, [reportViolation])

  // ── Resume from lock wall (re-enter fullscreen) ────────────────────────────
  const resumeFromLockWall = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      setLockWall(null)
      toast.success('Secure mode restored — exam resumed.')
    } catch {
      toast.error('You must allow fullscreen to continue.')
    }
  }, [])

  // Audio monitor
  useAudioMonitor({
    enabled: phase === 'active',
    threshold: 0.08,
    onAlert: useCallback(({ level }) => {
      setAudioLevel(level)
      send({ type: 'AUDIO_ANOMALY', level: Math.round(level * 100) })
      toast.error('Unusual audio detected — keep quiet', { icon: '🔊' })
    }, [send]),
  })

  // Fetch questions
  useEffect(() => {
    fetch(`${API}/questions`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.length) setQuestions(data) })
      .catch(() => {})
  }, [])

  // ── Start exam ─────────────────────────────────────────────────────────────
  const startExam = useCallback(async () => {
    // Fullscreen is best-effort — don't block exam start if denied
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // Browser may deny fullscreen outside Electron; continue anyway
    }

    let data
    try {
      const res = await fetch(`${API}/exam/start`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ candidate_id: candidateId, candidate_name: name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.detail || 'Could not start exam. Please sign in again.')
        return
      }
      data = await res.json()
    } catch (err) {
      toast.error('Cannot reach server. Is the backend running?')
      return
    }

    setExamId(data.exam_id)
    send({ type: 'CANDIDATE_INFO', name, exam_id: data.exam_id })
    notifyExamStart()
    setPhase('capturing')
  }, [candidateId, name, send, notifyExamStart])

  // ── Capture reference face ─────────────────────────────────────────────────
  const captureReference = useCallback(async () => {
    const frame = captureFrame(0.8)
    if (!frame) {
      toast.error('Camera not ready. Please allow camera access and try again.')
      return
    }
    if (!wsReady) {
      toast.error('Not connected to server yet. Please wait a moment.')
      return
    }
    setCapturePending(true)
    send({ type: 'REFERENCE_FACE', frame })
    // Fallback: if backend doesn't respond in 8s, proceed without face check
    setTimeout(() => {
      setCapturePending(prev => {
        if (!prev) return false
        toast('Verification timed out — proceeding anyway.', { icon: '⚠️' })
        return false
      })
      setPhase(prev => {
        if (prev === 'capturing') {
          setRemainingSec(EXAM_DURATION_SEC)
          return 'active'
        }
        return prev
      })
    }, 8000)
  }, [captureFrame, wsReady, send])

  // ── Frame streaming ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || lockWall) return
    const id = setInterval(() => {
      const frame = captureFrame(0.5)
      if (frame) send({ type: 'FRAME', frame })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, lockWall, captureFrame, send])

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || lockWall) return
    const id = setInterval(() => {
      setElapsedSec(s => s + 1)
      setRemainingSec(s => {
        const n = s - 1
        if (n === 300) toast('5 minutes remaining!', { icon: '⚠️' })
        if (n === 60)  toast('1 minute remaining!',  { icon: '🔴' })
        if (n <= 0)    { handleEndExam(); return 0 }
        return n
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, lockWall])

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsReady) return
    const id = setInterval(() => send({ type: 'HEARTBEAT' }), 10_000)
    return () => clearInterval(id)
  }, [wsReady, send])

  // ── WS messages ───────────────────────────────────────────────────────────
  useEffect(() => {
    return addHandler((msg) => {
      if (msg.type === 'ALERT') {
        setViolation(true)
        setTimeout(() => setViolation(false), 2000)
        toast.error((msg.alert_type || 'ALERT').replaceAll('_', ' '), { icon: '⚠️' })
      }
      if (msg.type === 'REFERENCE_CAPTURED') {
        setCapturePending(false)
        if (msg.success) {
          setPhase('active')
          setLockWall(null)
          setRemainingSec(EXAM_DURATION_SEC)
          toast.success('Identity verified. Exam started.')
        } else {
          toast.error(msg.message || 'No clear face detected. Try again.')
        }
      }
      if (msg.type === 'TERMINATED') {
        toast.error('Exam terminated by proctor.', { icon: '⛔' })
        handleEndExam()
      }
    })
  }, [addHandler])

  // ══════════════════════════════════════════════════════════════════════════
  //  HARD LOCKDOWN — all guards active only during phase === 'active'
  // ══════════════════════════════════════════════════════════════════════════

  // ── 1. Tab switch / visibility ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const handler = () => {
      if (document.hidden) raiseLockWall('Tab switch detected', 'TAB_SWITCH')
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [phase, raiseLockWall])

  // ── 2. Window blur (app switch, taskbar, etc.) ────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const handler = () => {
      // Small delay to avoid false positive when requesting fullscreen
      setTimeout(() => {
        if (!document.hasFocus()) raiseLockWall('Window lost focus', 'WINDOW_BLUR')
      }, 200)
    }
    window.addEventListener('blur', handler)
    return () => window.removeEventListener('blur', handler)
  }, [phase, raiseLockWall])

  // ── 3. Fullscreen exit enforcement ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const onChange = () => {
      if (!document.fullscreenElement) {
        raiseLockWall('Fullscreen exited', 'FULLSCREEN_EXIT')
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    // Periodic re-enforcement every 1.5 s
    const interval = setInterval(() => {
      if (!document.fullscreenElement && !lockWallRef.current) {
        raiseLockWall('Fullscreen exited', 'FULLSCREEN_EXIT')
      }
    }, 1500)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      clearInterval(interval)
    }
  }, [phase, raiseLockWall])

  // ── 4. Prevent back/forward/reload navigation ─────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
      raiseLockWall('Browser navigation blocked', 'NAVIGATION_ATTEMPT', 'back_forward')
    }
    const onUnload = (e) => {
      reportViolation('NAVIGATION_ATTEMPT', 'reload_or_close')
      e.preventDefault(); e.returnValue = ''; return ''
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [phase, raiseLockWall, reportViolation])

  // ── 5. All blocked keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const handler = (e) => {
      const k = e.keyCode
      const c = e.ctrlKey, s = e.shiftKey, a = e.altKey

      // DevTools
      if (k === 123 || (c && s && [73,74,67].includes(k))) {
        e.preventDefault(); e.stopImmediatePropagation()
        raiseLockWall('Developer tools blocked', 'DEVTOOLS_ATTEMPT')
        return
      }
      // Refresh
      if (k === 116 || (c && k === 82)) {
        e.preventDefault(); e.stopImmediatePropagation()
        reportViolation('REFRESH_ATTEMPT')
        toast.error('Refresh is disabled during exam.', { icon: '🔒' })
        return
      }
      // Alt+Tab / Alt+F4
      if (a && (k === 9 || k === 115)) {
        e.preventDefault(); e.stopImmediatePropagation()
        raiseLockWall('Alt+Tab / Alt+F4 blocked', 'KEYBOARD_ANOMALY', 'alt_tab')
        return
      }
      // Windows / Meta key
      if (e.key === 'Meta' || e.key === 'OS') {
        e.preventDefault()
        raiseLockWall('System key blocked', 'KEYBOARD_ANOMALY', 'windows_key')
        return
      }
      // Ctrl+T, Ctrl+N (new tab/window)
      if (c && (k === 84 || k === 78)) {
        e.preventDefault()
        reportViolation('NEW_TAB_ATTEMPT')
        toast.error('Opening new tabs is not allowed.', { icon: '🔒' })
        return
      }
      // PrintScreen
      if (k === 44) {
        e.preventDefault()
        reportViolation('SCREENSHOT_ATTEMPT')
        toast.error('Screenshots are not allowed.', { icon: '🚫' })
        return
      }
      // Escape (fullscreen exit)
      if (k === 27) {
        e.preventDefault()
      }

      // Keystroke anomaly (rapid typing)
      const now = Date.now()
      keystrokeTs.current = [...keystrokeTs.current.filter(t => t > now - 2000), now]
      if (keystrokeTs.current.length > 15) {
        send({ type: 'KEYBOARD_ANOMALY', detail: 'rapid_typing', rate: keystrokeTs.current.length })
        keystrokeTs.current = []
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [phase, raiseLockWall, reportViolation, send])

  // ── 6. Clipboard blocking ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const block = (e) => {
      e.preventDefault()
      reportViolation('CLIPBOARD_ATTEMPT', e.type)
      toast.error('Copy/Paste is disabled.', { icon: '🔒' })
    }
    document.addEventListener('copy', block, true)
    document.addEventListener('paste', block, true)
    document.addEventListener('cut', block, true)
    return () => {
      document.removeEventListener('copy', block, true)
      document.removeEventListener('paste', block, true)
      document.removeEventListener('cut', block, true)
    }
  }, [phase, reportViolation])

  // ── 7. Context menu / right-click ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const block = (e) => {
      e.preventDefault()
      reportViolation('CONTEXT_MENU_ATTEMPT')
    }
    document.addEventListener('contextmenu', block, true)
    return () => document.removeEventListener('contextmenu', block, true)
  }, [phase, reportViolation])

  // ── 8. Drag & drop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return
    const block = (e) => e.preventDefault()
    document.addEventListener('dragover', block, true)
    document.addEventListener('drop', block, true)
    return () => {
      document.removeEventListener('dragover', block, true)
      document.removeEventListener('drop', block, true)
    }
  }, [phase])

  // ── End exam ───────────────────────────────────────────────────────────────
  async function handleEndExam() {
    setPhase('done')
    setLockWall(null)
    document.exitFullscreen?.().catch(() => {})
    if (examId) {
      await fetch(`${API}/exam/end`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ exam_id: examId }),
      })
    }

    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('name')
    localStorage.removeItem('email')
    notifyExamEnd()

    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      if (window.secureBrowser?.isSecureBrowser) {
        window.close()
      }
    }, 2000)
  }

  useEffect(() => {
    return () => clearTimeout(closeTimer.current)
  }, [])

  function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
  }

  const q            = questions[currentQ]
  const timerUrgent  = remainingSec <= 60
  const timerWarning = remainingSec <= 300 && !timerUrgent

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Electron overlay layer */}
      <SecureBrowserOverlay candidateId={candidateId} />

      {/* ══ MSB-style lock wall — covers everything when triggered ══ */}
      {phase === 'active' && lockWall && (
        <LockWall
          reason={lockWall.reason}
          tabSwitches={tabSwitches}
          onResume={resumeFromLockWall}
        />
      )}

      {/* ── Top bar ── */}
      <header className="bg-indigo-700 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Shield size={22} />
          <span className="font-bold text-lg">ProctorAI Exam</span>
          <span className="text-indigo-300 text-sm hidden sm:block">HACKHIVE-2k26</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {phase === 'active' && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-bold ${
              timerUrgent ? 'bg-red-500 animate-pulse text-white' :
              timerWarning ? 'bg-amber-500 text-white' : 'bg-white/20 text-white'
            }`}>
              <Timer size={14} /> {formatTime(remainingSec)}
            </span>
          )}
          <span className="flex items-center gap-1"><Clock size={14} />{formatTime(elapsedSec)}</span>
          <span className="text-indigo-200">👤 {name}</span>
          {phase === 'active' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
              violation ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${violation ? 'bg-red-200' : 'bg-emerald-200'}`} />
              {violation ? 'Violation!' : 'All Clear'}
            </div>
          )}
        </div>
      </header>

      {/* ── Setup ── */}
      {phase === 'setup' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-8 max-w-md w-full text-center">
            <Shield className="mx-auto text-indigo-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome, {name}</h2>
            <p className="text-slate-500 mb-6 text-sm">
              This exam runs in a secure lockdown environment. Switching tabs, minimising, or exiting fullscreen will pause your exam and log a violation.
            </p>
            <ul className="text-left text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-8">
              {[
                'Exam locks to fullscreen once started',
                'Tab switching pauses exam and alerts proctor',
                'Alt+Tab, F12, and system keys are blocked',
                'Copy/Paste is disabled',
                `You have ${EXAM_DURATION_SEC / 60} minutes`,
              ].map(r => (
                <li key={r} className="flex items-center gap-2">
                  <span className="text-indigo-500">✓</span> {r}
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <video ref={videoRef} autoPlay muted playsInline className="w-48 h-36 mx-auto rounded-lg bg-slate-200 object-cover" />
              {camError && <p className="text-red-500 text-xs mt-2">{camError}</p>}
            </div>
            {!wsReady && (
              <p className="text-xs text-amber-500 text-center mb-2">⚠ Connecting to proctor server…</p>
            )}
            <button onClick={startExam} className="btn-primary w-full">
              Start Secure Exam →
            </button>
          </div>
        </div>
      )}

      {/* ── Capture ── */}
      {phase === 'capturing' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-8 max-w-md w-full text-center">
            <Camera className="mx-auto text-indigo-600 mb-4" size={40} />
            <h2 className="text-xl font-bold mb-2">Identity Verification</h2>
            <p className="text-slate-500 text-sm mb-6">Look directly at the camera for your reference photo.</p>
            <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-xs mx-auto rounded-xl bg-slate-200 object-cover aspect-[4/3] mb-6 ring-4 ring-indigo-500" />
            <button onClick={captureReference} className="btn-primary w-full" disabled={!camReady || capturePending}>
              {capturePending ? 'Verifying…' : 'Capture & Begin Exam'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active exam ── */}
      {phase === 'active' && (
        <div className="flex-1 flex flex-col relative">
          {/* Live camera pip */}
          <div className="absolute bottom-6 right-6 z-20 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Live Camera</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">Streaming</span>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-[4/3] object-cover bg-slate-200" />
            <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{camReady ? 'Camera ready' : 'Waiting…'}</span>
              <span className="text-emerald-500 font-medium">AI Active</span>
            </div>
            {phase === 'active' && (
              <div className="px-3 pb-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Mic level</span>
                <span className={audioLevel > 0.08 ? 'text-amber-500 font-semibold' : 'text-slate-400'}>
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
            )}
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
                      placeholder="Type your answer here…"
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
                <button onClick={() => setCurrentQ(q => q + 1)} className="btn-primary">Next →</button>
              ) : (
                <button onClick={handleEndExam} className="btn-danger">Submit Exam</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-10 max-w-md w-full text-center">
            <div className="text-6xl mb-4">🙏</div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Thanks for attending</h2>
            <p className="text-slate-500 mb-4 text-sm">Your exam has been submitted successfully and this session will close shortly.</p>
            {tabSwitches > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 mb-6 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} className="inline mr-1" />
                {tabSwitches} violation{tabSwitches > 1 ? 's' : ''} recorded during exam
              </div>
            )}
            <button
              onClick={() => {
                clearTimeout(closeTimer.current)
                window.close()
              }}
              className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
            >
              Close App
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
