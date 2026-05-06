import { useNavigate } from 'react-router-dom'
import {
  Shield, Eye, Users, AlertTriangle, FileText, Monitor,
  Keyboard, Smartphone, Brain, ChevronRight, Zap, Lock
} from 'lucide-react'

const FEATURES = [
  {
    icon: Eye,
    title: 'Face Recognition & Identity',
    desc: 'AI-powered face verification using deep learning. Continuously matches the student against their reference photo throughout the exam.',
    color: 'from-indigo-500 to-blue-600',
  },
  {
    icon: Monitor,
    title: 'Eye & Head Tracking',
    desc: 'MediaPipe FaceMesh with 468 landmarks tracks iris position, gaze direction, and head pose (yaw/pitch/roll) in real time.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Users,
    title: 'Multi-Person Detection',
    desc: 'YOLOv8 deep learning model detects multiple persons in frame — instantly flags unauthorized people near the student.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Smartphone,
    title: 'Phone Detection',
    desc: 'YOLO-based object detection identifies mobile phones in the camera frame, catching device-based cheating attempts.',
    color: 'from-red-500 to-pink-600',
  },
  {
    icon: AlertTriangle,
    title: 'Tab Switch & Clipboard Guard',
    desc: 'Browser visibility API detects tab switches. Copy/paste/cut events are blocked and logged. DevTools access is prevented.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Keyboard,
    title: 'Keyboard Anomaly Detection',
    desc: 'Monitors keystroke patterns for unusual activity — rapid typing bursts, suspicious key combinations like Alt+Tab or Win key.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Brain,
    title: 'Live Risk Scoring',
    desc: 'Rolling 0-100 risk score with smart decay. Alerts are severity-weighted (LOW +5, MEDIUM +15, HIGH +30) with 2s debounce.',
    color: 'from-fuchsia-500 to-pink-600',
  },
  {
    icon: FileText,
    title: 'Automated PDF Reports',
    desc: 'ReportLab-generated PDF with violation timeline, severity breakdown, snapshot evidence, and risk score history.',
    color: 'from-slate-500 to-slate-700',
  },
]

const TECH_STACK = [
  { name: 'YOLOv8', desc: 'Person & phone detection' },
  { name: 'MediaPipe', desc: '468-point face mesh' },
  { name: 'OpenCV', desc: 'Head pose solvePnP' },
  { name: 'FastAPI', desc: 'Async Python backend' },
  { name: 'WebSocket', desc: 'Real-time bidirectional' },
  { name: 'React', desc: 'Live dashboard UI' },
  { name: 'MongoDB', desc: 'Persistent data store' },
  { name: 'JWT + bcrypt', desc: 'Secure authentication' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white overflow-hidden">
      {/* Animated background grid */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Shield size={22} />
          </div>
          <span className="font-bold text-xl">ProctorAI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-600/50 px-3 py-1 rounded-full hidden sm:block">
            HACKHIVE-2k26 · AI/ML Track
          </span>
          <button
            onClick={() => navigate('/login')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2"
          >
            Launch App <ChevronRight size={16} />
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-28 text-center">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8 backdrop-blur">
            <Zap size={14} className="text-amber-400" />
            <span className="text-slate-300">AI-powered exam integrity for the modern age</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold leading-tight mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              Real-Time Exam
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Proctoring System
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Monitor candidates with <strong className="text-white">AI computer vision</strong>,
            detect cheating in <strong className="text-white">real time</strong>,
            and generate <strong className="text-white">automated reports</strong> — all from the browser.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/login')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Lock size={20} />
              Start Proctoring
            </button>
            <a
              href="#features"
              className="text-slate-400 hover:text-white font-semibold text-lg px-6 py-4 rounded-xl transition-colors border border-white/10 hover:border-white/30"
            >
              Explore Features ↓
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-20 max-w-3xl mx-auto">
            {[
              { value: '8+', label: 'AI Detectors' },
              { value: '<3s', label: 'Alert Latency' },
              { value: '0-100', label: 'Risk Scoring' },
              { value: 'PDF', label: 'Auto Reports' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-5 backdrop-blur">
                <div className="text-2xl font-bold text-indigo-400">{value}</div>
                <div className="text-xs text-slate-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-8 pb-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything the Problem Statement Demands
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Every feature required by HACKHIVE-2k26 AI/ML Track, built with state-of-the-art computer vision and real-time processing.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon size={22} className="text-white" />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pb-28">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 sm:p-12">
          <h2 className="text-2xl font-bold mb-8 text-center">Technology Stack</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TECH_STACK.map(({ name, desc }) => (
              <div key={name} className="bg-white/5 rounded-xl px-4 py-4 text-center border border-white/5 hover:border-indigo-500/30 transition-colors">
                <div className="font-bold text-indigo-400 text-lg">{name}</div>
                <div className="text-xs text-slate-500 mt-1">{desc}</div>
              </div>
            ))}
          </div>

          {/* ASCII Architecture */}
          <div className="mt-8 bg-slate-900/80 rounded-xl p-6 font-mono text-xs sm:text-sm text-slate-400 overflow-x-auto">
            <pre className="leading-relaxed">{`
┌──────────────┐  WebSocket   ┌────────────────────────────────────────────┐
│   Student    │ ────────────►│            FastAPI Backend                 │
│   Browser    │   Frames/s   │                                            │
│   (React)    │              │  WebSocketHandler                          │
└──────────────┘              │  ├── FaceDetector   (face_recognition)     │
                              │  ├── EyeTracker     (MediaPipe FaceMesh)   │
┌──────────────┐              │  ├── HeadPose       (solvePnP)             │
│   Proctor    │◄─ WS alerts ─│  ├── PersonCounter  (YOLOv8n)             │
│   Dashboard  │              │  ├── PhoneDetector  (YOLOv8 class 67)     │
│   (React)    │              │  ├── KeyboardMonitor (anomaly detection)   │
└──────────────┘              │  └── AlertEngine    (rolling risk score)   │
                              │                                            │
                              │  MongoDB ─ JWT Auth ─ PDF Reports          │
                              └────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield size={16} className="text-indigo-500" />
          <span className="font-semibold text-slate-400">ProctorAI</span>
        </div>
        <p>Built for HACKHIVE-2k26 · AI/ML Track</p>
        <p className="mt-1 text-xs text-slate-600">Because academic integrity shouldn't be optional.</p>
      </footer>
    </div>
  )
}
