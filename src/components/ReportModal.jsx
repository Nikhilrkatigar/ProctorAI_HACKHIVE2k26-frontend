import { useState, useEffect } from 'react'
import { X, Download, FileText } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export default function ReportModal({ examId, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!examId) return
    fetch(`${API}/report/${examId}/json`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [examId])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <FileText className="text-indigo-600" size={22} />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Exam Report</h2>
          </div>
          <div className="flex items-center gap-2">
            {examId && (
              <a
                href={`${API}/report/${examId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm flex items-center gap-1"
              >
                <Download size={14} /> PDF
              </a>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && <p className="text-center text-slate-400 py-8">Loading report…</p>}

          {data && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Candidate', data.candidate_name],
                  ['Status',    data.status],
                  ['Duration',  `${data.duration_minutes?.toFixed(1)} min`],
                  ['Violations', data.total_violations],
                  ['Highest Score', data.highest_risk_score],
                  ['Start Time', new Date(data.start_time).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                    <p className="text-xs text-slate-400">{k}</p>
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{v}</p>
                  </div>
                ))}
              </div>

              {/* Violations by type */}
              {data.violations_by_type && Object.keys(data.violations_by_type).length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 text-sm">Violations by Type</h3>
                  <div className="space-y-2">
                    {Object.entries(data.violations_by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">{type.replace(/_/g, ' ')}</span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-bold">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {data.violations?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 text-sm">Violation Timeline</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.violations.map((v, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs border-l-2 border-slate-200 dark:border-slate-600 pl-3 py-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          v.severity === 'HIGH' ? 'bg-red-500' : v.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-blue-400'
                        }`} />
                        <span className="text-slate-400">{new Date(v.timestamp).toLocaleTimeString()}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{v.type?.replace(/_/g, ' ')}</span>
                        <span className={`ml-auto font-mono text-xs ${
                          v.severity === 'HIGH' ? 'text-red-500' : v.severity === 'MEDIUM' ? 'text-amber-500' : 'text-blue-500'
                        }`}>
                          {v.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.violations?.length === 0 && (
                <div className="text-center py-8 text-emerald-600">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold">Clean exam — no violations recorded</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
