import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useAudioMonitor — monitors ambient audio levels via Web Audio API.
 * Calibrates to the room, then detects sustained spikes in noise.
 */
export function useAudioMonitor({ enabled = false, threshold = 0.08, onAlert }) {
  const [level, setLevel] = useState(0)
  const [error, setError] = useState(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const streamRef = useRef(null)
  const alertCooldown = useRef(0)
  const baselineRef = useRef(null)
  const spikeStartRef = useRef(null)

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close?.()
    ctxRef.current = null
    analyserRef.current = null
    baselineRef.current = null
    spikeStartRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }

    let mounted = true

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(stream => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctxRef.current = ctx

        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        function tick() {
          if (!mounted) return
          analyser.getByteFrequencyData(dataArray)

          // Calculate RMS (root mean square) for volume
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 255
            sum += v * v
          }
          const rms = Math.sqrt(sum / dataArray.length)
          setLevel(rms)

          const baseline = baselineRef.current
          if (baseline === null) {
            baselineRef.current = rms
          } else {
            baselineRef.current = baseline * 0.985 + rms * 0.015
          }

          const adaptiveThreshold = Math.max(threshold, (baselineRef.current || 0) * 2.1 + 0.02)
          const now = Date.now()
          const isSpike = rms > adaptiveThreshold

          if (isSpike && spikeStartRef.current === null) {
            spikeStartRef.current = now
          }
          if (!isSpike) {
            spikeStartRef.current = null
          }

          if (
            isSpike &&
            spikeStartRef.current &&
            now - spikeStartRef.current > 400 &&
            now > alertCooldown.current
          ) {
            alertCooldown.current = now + 3500
            onAlert?.({
              level: rms,
              baseline: baselineRef.current,
              threshold: adaptiveThreshold,
              timestamp: new Date().toISOString(),
            })
          }

          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(err => {
        if (!mounted) return
        setError(err.message || 'Microphone unavailable')
        console.warn('[AudioMonitor]', err)
      })

    return () => {
      mounted = false
      stop()
    }
  }, [enabled, threshold, onAlert, stop])

  return { level, error }
}
