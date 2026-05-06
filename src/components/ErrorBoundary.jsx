import { Component } from 'react'
import { Shield, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 mb-6">
              <Shield className="text-red-400" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-6">
              An unexpected error occurred. Please reload the page to continue.
            </p>
            <p className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2 mb-6 font-mono break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
