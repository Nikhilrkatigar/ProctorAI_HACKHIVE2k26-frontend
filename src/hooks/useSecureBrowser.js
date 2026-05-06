import { useEffect, useRef, useCallback } from 'react'

/* ──────────────────────────────────────────────────────────────
   useSecureBrowser
   Drop-in hook for StudentExam.jsx.
   Detects if running inside ProctorAI Secure Browser (Electron)
   and sets up exam lifecycle + violation reporting bridge.
────────────────────────────────────────────────────────────── */

export const isSecureBrowser = () => !!window.secureBrowser

export function useSecureBrowser({ candidateId, onTerminate } = {}) {
  const SB = window.secureBrowser
  const startedRef = useRef(false)

  // Notify main process of candidate identity once
  useEffect(() => {
    if (!SB || !candidateId) return
    SB.setCandidateId(candidateId)
  }, [SB, candidateId])

  // Notify exam started
  const notifyExamStart = useCallback(() => {
    if (!SB) return
    if (startedRef.current) return
    startedRef.current = true
    SB.notifyExamStarted()
  }, [SB])

  // Notify exam ended
  const notifyExamEnd = useCallback(() => {
    if (!SB) return
    startedRef.current = false
    SB.notifyExamEnded()
  }, [SB])

  // Manual violation (e.g. from existing tab-switch detection)
  const reportViolation = useCallback((event, severity = 'MEDIUM', extra = {}) => {
    if (!SB) return
    SB.sendViolation(event, severity, extra)
  }, [SB])

  // Forward raw WS frame data through Electron's WS connection
  const sendFrame = useCallback((frameData) => {
    if (!SB) return
    SB.wsSend({ type: 'FRAME', frame: frameData })
  }, [SB])

  // Listen for proctor-initiated termination
  useEffect(() => {
    if (!SB || !onTerminate) return
    const cleanup = SB.onExamTerminated((msg) => {
      onTerminate(msg)
    })
    return cleanup
  }, [SB, onTerminate])

  return {
    isSecure: !!SB,
    notifyExamStart,
    notifyExamEnd,
    reportViolation,
    sendFrame,
  }
}
