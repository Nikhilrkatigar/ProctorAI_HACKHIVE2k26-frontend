import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts'
import { Activity } from 'lucide-react'

// Synthesizes a behavioral profile based on recent alerts.
// A perfect baseline is 100 on all axes. Alerts reduce the score on specific axes.
function generateBehaviorData(alerts) {
  let gaze = 100, focus = 100, typing = 100, posture = 100, integrity = 100

  alerts.forEach(a => {
    const type = a.type || ''
    if (type.includes('GAZE')) gaze -= 10
    if (type.includes('TAB_SWITCH') || type.includes('FOCUS') || type.includes('BLUR')) focus -= 20
    if (type.includes('KEYBOARD') || type.includes('CLIPBOARD')) typing -= 15
    if (type.includes('HEAD_POSE')) posture -= 15
    if (type.includes('MULTIPLE') || type.includes('PHONE') || type.includes('MISMATCH')) integrity -= 30
  })

  // Ensure minimum score of 20 so the radar shape doesn't completely collapse
  return [
    { subject: 'Gaze Focus', A: Math.max(20, gaze), fullMark: 100 },
    { subject: 'Tab Discipline', A: Math.max(20, focus), fullMark: 100 },
    { subject: 'Typing Rhythm', A: Math.max(20, typing), fullMark: 100 },
    { subject: 'Head Posture', A: Math.max(20, posture), fullMark: 100 },
    { subject: 'Visual Integrity', A: Math.max(20, integrity), fullMark: 100 },
  ]
}

export default function BehaviorRadar({ alerts, dark }) {
  const data = generateBehaviorData(alerts)

  return (
    <div className="card p-4 flex flex-col items-center">
      <h3 className="font-semibold text-xs text-slate-700 dark:text-slate-300 w-full mb-1 flex items-center gap-2">
        <Activity size={14} className="text-indigo-500" />
        Live Behavioral Deviation
      </h3>
      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke={dark ? '#334155' : '#e2e8f0'} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 9 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Behavior"
              dataKey="A"
              stroke="#6366f1"
              strokeWidth={2}
              fill="#8b5cf6"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
