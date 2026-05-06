import { useEffect, useRef } from 'react'
import { AlertTriangle, AlertCircle, Info, Eye } from 'lucide-react'

const SEV_CONFIG = {
  HIGH:   { color: 'bg-red-500',    text: 'text-red-700',   bg: 'bg-red-50 dark:bg-red-900/20',   border: 'border-red-200 dark:border-red-800',   icon: AlertCircle },
  MEDIUM: { color: 'bg-amber-400',  text: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  LOW:    { color: 'bg-blue-400',   text: 'text-blue-700',  bg: 'bg-blue-50 dark:bg-blue-900/20',  border: 'border-blue-200 dark:border-blue-800',   icon: Info },
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}

export default function AlertFeed({ alerts = [] }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [alerts])

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-400">
        <Eye size={28} className="mb-2 opacity-30" />
        <p className="text-sm">No violations detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {alerts.map((a, i) => {
        const cfg = SEV_CONFIG[a.severity] || SEV_CONFIG.LOW
        const Icon = cfg.icon
        return (
          <div
            key={i}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs ${cfg.bg} ${cfg.border}`}
          >
            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${cfg.color}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold uppercase tracking-wide ${cfg.text}`}>
                  {a.type?.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-400 flex-shrink-0">{formatTime(a.timestamp)}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-slate-500">{a.candidate_id}</span>
                <span className={`font-mono font-semibold ${cfg.text}`}>Score: {a.score}</span>
              </div>
              {a.snapshot_url && (
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${a.snapshot_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:underline mt-1 inline-block"
                >
                  📷 View snapshot
                </a>
              )}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
