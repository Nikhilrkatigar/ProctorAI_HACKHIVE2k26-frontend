import RiskMeter from './RiskMeter.jsx'
import { Ban, Eye } from 'lucide-react'

const STATUS_BADGE = {
  CLEAN:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SUSPICIOUS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  HIGH_RISK:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
  FLAGGED:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  TERMINATED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  ACTIVE:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default function CandidateCard({ candidate, onSelect, onTerminate }) {
  const { candidate_name, candidate_id, risk_score, status, last_alert, is_active } = candidate
  const badge = STATUS_BADGE[status] || STATUS_BADGE.CLEAN
  const active = is_active !== false

  return (
    <div
      className={`card p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${
        !active ? 'opacity-60' : ''
      } ${risk_score > 90 ? 'ring-2 ring-red-500' : ''}`}
      onClick={() => onSelect(candidate)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800 dark:text-white text-sm">{candidate_name}</p>
          <p className="text-xs text-slate-400">{candidate_id}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
          {active ? status : 'OFFLINE'}
        </span>
      </div>

      <div className="flex items-center justify-center">
        <RiskMeter score={risk_score} size={90} />
      </div>

      {last_alert && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 truncate">
          ⚠ {last_alert.type?.replace(/_/g, ' ')}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={e => { e.stopPropagation(); onSelect(candidate) }}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Eye size={12} /> Monitor
        </button>
        {active && (
          <button
            onClick={e => { e.stopPropagation(); onTerminate(candidate_id) }}
            className="flex items-center gap-1 text-xs py-1.5 px-2 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
          >
            <Ban size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
