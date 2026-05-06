import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebcam(videoRef) {
  const streamRef = useRef(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState(null)

  const attachStream = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!video || !stream) return
    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    const playPromise = video.play?.()
    if (playPromise?.catch) {
      playPromise.catch(() => {})
    }
  }, [videoRef])

  useEffect(() => {
    let mounted = true

    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          facingMode: 'user',
        },
        audio: false,
      })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        attachStream()
        setReady(true)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err.message || 'Webcam unavailable')
        console.warn('[Webcam]', err)
      })

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [attachStream])

  useEffect(() => {
    attachStream()
  })

  // Capture a single JPEG frame as base64 string
  const captureFrame = useCallback((quality = 0.7) => {
    const video = videoRef.current
    if (!video || !ready) return null

    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 960
    canvas.height = video.videoHeight || 540
    canvas.getContext('2d').drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', quality)
  }, [ready, videoRef])

  return { ready, error, captureFrame }
}
