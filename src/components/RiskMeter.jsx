import { motion } from 'framer-motion'

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
               
  const isHighRisk = pct > 60

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Pulsing background for high risk */}
        {isHighRisk && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 relative z-10">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#e2e8f0" strokeWidth="6"
            className="dark:stroke-slate-800"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset, stroke: color }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="text-center -mt-12 mb-4 relative z-20 pointer-events-none">
        <motion.div 
          className="text-xl font-bold" 
          animate={{ color }}
          transition={{ duration: 0.8 }}
        >
          {pct}
        </motion.div>
        <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      </div>
    </div>
  )
}
