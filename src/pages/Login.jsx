import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, Download, Monitor } from 'lucide-react'

const SECURE_BROWSER_URL = 'https://drive.google.com/uc?export=download&id=1wNT8GauuOliukUDVvsbRTZqd2z2QmtJr'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('name', data.name)
      localStorage.setItem('email', email)

      navigate(data.role === 'proctor' ? '/dashboard' : '/exam')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-500/30">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ProctorAI</h1>
          <p className="text-indigo-300 mt-1">Real-Time Exam Integrity System</p>
          <span className="inline-block mt-2 text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-600/50 px-3 py-1 rounded-full">
            HACKHIVE-2k26 - AI/ML Track
          </span>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">ID or Email</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student-id or proctor@hackhive.ai"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Secure Browser Download */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Monitor size={18} className="text-indigo-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">ProctorAI Secure Browser</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Required for desktop exam sessions. Provides a locked-down environment with hardware-level proctoring.
              </p>
            </div>
          </div>
          <a
            href={SECURE_BROWSER_URL}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Download size={16} />
            Download Secure Browser (.exe)
          </a>
          <p className="text-center text-slate-500 text-xs mt-2">Windows · v1.0.0 · HACKHIVE-2k26</p>
        </div>
      </div>
    </div>
  )
}
