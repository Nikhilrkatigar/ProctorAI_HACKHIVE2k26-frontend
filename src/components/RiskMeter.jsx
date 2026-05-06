export default function RiskMeter({ score = 0, size = 80 }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, score))
  const dashOffset = circumference * (1 - pct / 100)

  const color =
    pct > 90 ? '#ef4444' :
    pct > 60 ? '#f97316' :
    pct > 30 ? '#eab308' :
               '#22c55e'

  const label =
    pct > 90 ? 'CRITICAL' :
    pct > 60 ? 'HIGH RISK' :
    pct > 30 ? 'SUSPICIOUS' :
               'CLEAN'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth="6"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="text-center -mt-12 mb-4">
        <div className="text-xl font-bold" style={{ color }}>{pct}</div>
        <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      </div>
    </div>
  )
}
