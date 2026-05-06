import { useEffect, useState, useCallback, useRef } from 'react'

/* ──────────────────────────────────────────────────────────────
   SecureBrowserOverlay
   Renders inside the React app when running inside the Electron
   secure browser. Listens to IPC events and shows appropriate
   warning / lockdown overlays.
────────────────────────────────────────────────────────────── */

const SB = window.secureBrowser // null when in normal browser

const SEVERITY_STYLES = {
  HIGH:   { border: 'border-red-500/60',    glow: 'shadow-red-500/30',    badge: 'bg-red-500/20 text-red-400 border-red-500/40',    icon: '🔴', bar: 'bg-red-500' },
  MEDIUM: { border: 'border-yellow-500/60', glow: 'shadow-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: '🟡', bar: 'bg-yellow-500' },
  LOW:    { border: 'border-blue-500/60',   glow: 'shadow-blue-500/30',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',   icon: '🔵', bar: 'bg-blue-500' },
}

function ViolationToast({ violation, onDismiss }) {
  const style = SEVERITY_STYLES[violation.severity] || SEVERITY_STYLES.LOW
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-xl border backdrop-blur-sm
      bg-slate-900/90 ${style.border} shadow-lg ${style.glow}
      animate-slide-in text-sm max-w-sm w-full
    `}>
      <span className="text-base mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-200 truncate">{violation.event?.replace(/_/g, ' ')}</div>
        <div className="text-slate-400 text-xs mt-0.5">{violation.timestamp ? new Date(violation.timestamp).toLocaleTimeString() : ''}</div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.badge}`}>
        {violation.severity}
      </span>
    </div>
  )
}

function WarningOverlay({ overlay, onDismiss }) {
  const [countdown, setCountdown] = useState(overlay.countdown || 0)
  const style = SEVERITY_STYLES[overlay.severity] || SEVERITY_STYLES.MEDIUM

  useEffect(() => {
    if (!overlay.countdown) return
    setCountdown(overlay.countdown)
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); if (!overlay.blocking) onDismiss(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [overlay.countdown, overlay.blocking, onDismiss])

  const canDismiss = !overlay.blocking && (overlay.countdown === 0 || countdown === 0)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      {/* Card */}
      <div className={`
        relative z-10 w-full max-w-md mx-4 rounded-2xl border p-8
        bg-slate-900/95 backdrop-blur-xl
        ${style.border} shadow-2xl ${style.glow}
        animate-scale-in
      `}>
        {/* Severity bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${style.bar} opacity-80`} />

        {/* Shield icon */}
        <div className="flex justify-center mb-5">
          <div className={`w-16 h-16 rounded-full border-2 ${style.border} flex items-center justify-center
            ${overlay.severity === 'HIGH' ? 'animate-pulse' : ''}`}>
            {overlay.severity === 'HIGH' ? (
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            ) : (
              <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            )}
          </div>
        </div>

        {/* Text */}
        <h2 className="text-xl font-bold text-slate-100 text-center mb-2">{overlay.title}</h2>
        <p className="text-slate-400 text-center text-sm leading-relaxed mb-6">{overlay.message}</p>

        {/* Countdown */}
        {overlay.countdown > 0 && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className={`text-4xl font-bold tabular-nums ${
              overlay.severity === 'HIGH' ? 'text-red-400' : 'text-yellow-400'
            }`}>{countdown}</div>
            <div className="text-slate-500 text-sm">seconds</div>
          </div>
        )}

        {/* Dismiss button */}
        {canDismiss && (
          <button
            onClick={onDismiss}
            className={`
              w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
              ${overlay.severity === 'HIGH'
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300'
                : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300'
              }
            `}
          >
            Return to Exam
          </button>
        )}

        {overlay.blocking && (
          <p className="text-center text-xs text-slate-600 mt-3">
            Contact your proctor to continue.
          </p>
        )}
      </div>
    </div>
  )
}

function CloseWarningOverlay({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-red-500/40 p-8
        bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-red-500/20 animate-scale-in">
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-red-500 opacity-80" />

        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full border-2 border-red-500/60 flex items-center justify-center animate-pulse">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-100 text-center mb-2">Exit Exam?</h2>
        <p className="text-slate-400 text-center text-sm mb-7 leading-relaxed">
          Leaving may <span className="text-red-400 font-semibold">terminate your session</span> and
          will be flagged as a security violation.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold text-sm
              bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 text-slate-300
              transition-all duration-200"
          >
            Stay
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold text-sm
              bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300
              transition-all duration-200"
          >
            Exit Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

function WsStatusBar({ connected }) {
  if (connected) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] px-4 py-2
      bg-yellow-500/10 border-b border-yellow-500/30 backdrop-blur-sm
      flex items-center justify-center gap-2 text-yellow-400 text-xs font-medium">
      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
      Reconnecting to ProctorAI server…
    </div>
  )
}

export default function SecureBrowserOverlay({ candidateId }) {
  const [overlay, setOverlay]           = useState(null)
  const [showClose, setShowClose]       = useState(false)
  const [wsConnected, setWsConnected]   = useState(true)
  const [toasts, setToasts]             = useState([])
  const [lockdownActive, setLockdown]   = useState(false)
  const toastId = useRef(0)

  const pushToast = useCallback((violation) => {
    const id = ++toastId.current
    setToasts(t => [...t.slice(-4), { ...violation, _id: id }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x._id !== id))
  }, [])

  const dismissOverlay = useCallback(() => {
    setOverlay(null)
    SB?.dismissOverlay()
  }, [])

  useEffect(() => {
    if (!SB) return // Not inside Electron

    // Register candidate
    if (candidateId) SB.setCandidateId(candidateId)

    const cleanups = [
      SB.onShowOverlay(data   => setOverlay(data)),
      SB.onShowCloseWarning(() => setShowClose(true)),
      SB.onWsStatus(({ connected }) => setWsConnected(connected)),
      SB.onLockdownActive(active   => setLockdown(active)),
      SB.onViolation(v => pushToast(v)),
    ]

    return () => cleanups.forEach(fn => fn?.())
  }, [candidateId, pushToast])

  if (!SB) return null // Normal browser — render nothing

  return (
    <>
      <WsStatusBar connected={wsConnected} />

      {/* Violation toasts — bottom right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9997] flex flex-col-reverse gap-2 pointer-events-none">
          {toasts.map(t => (
            <ViolationToast key={t._id} violation={t} onDismiss={() => removeToast(t._id)} />
          ))}
        </div>
      )}

      {/* Main overlay */}
      {overlay && (
        <WarningOverlay overlay={overlay} onDismiss={dismissOverlay} />
      )}

      {/* Close confirmation */}
      {showClose && (
        <CloseWarningOverlay
          onCancel={() => setShowClose(false)}
          onConfirm={() => { setShowClose(false); SB.confirmClose() }}
        />
      )}

      {/* Lockdown indicator — top-left badge */}
      {lockdownActive && (
        <div className="fixed top-3 left-3 z-[9996] flex items-center gap-2 px-3 py-1.5
          bg-slate-900/90 border border-indigo-500/30 rounded-full backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-indigo-400 text-xs font-semibold tracking-wide">SECURE MODE</span>
        </div>
      )}
    </>
  )
}
