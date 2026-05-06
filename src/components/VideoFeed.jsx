import { useRef, useEffect } from 'react'
import { CameraOff } from 'lucide-react'

export default function VideoFeed({ stream, className = '' }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (!stream) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 rounded-xl ${className}`}>
        <div className="text-center text-slate-500">
          <CameraOff size={28} className="mx-auto mb-1" />
          <p className="text-xs">No stream</p>
        </div>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`object-cover rounded-xl bg-slate-800 ${className}`}
    />
  )
}
