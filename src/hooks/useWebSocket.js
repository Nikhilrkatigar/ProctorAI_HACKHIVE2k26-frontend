import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
const MAX_RETRIES = 5
const BASE_DELAY = 1000 // 1s, doubles each retry

export function useWebSocket(candidateId, role = 'student') {
  const wsRef     = useRef(null)
  const [ready, setReady]     = useState(false)
  const [lastMsg, setLastMsg] = useState(null)
  const handlersRef = useRef([])
  const retryCount  = useRef(0)
  const retryTimer  = useRef(null)
  const unmounted   = useRef(false)

  const addHandler = useCallback((fn) => {
    handlersRef.current.push(fn)
    return () => {
      handlersRef.current = handlersRef.current.filter(h => h !== fn)
    }
  }, [])

  const connect = useCallback(() => {
    if (!candidateId || unmounted.current) return

    const url = `${WS_BASE}/ws/${candidateId}?role=${role}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setReady(true)
      retryCount.current = 0
      console.log('[WS] connected', url)
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setLastMsg(data)
        handlersRef.current.forEach(fn => fn(data))
      } catch (_) {}
    }

    ws.onerror = (e) => console.error('[WS] error', e)

    ws.onclose = (e) => {
      setReady(false)
      console.log('[WS] closed', e.code, e.reason)

      // Auto-reconnect with exponential backoff
      if (!unmounted.current && retryCount.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount.current)
        retryCount.current += 1
        console.log(`[WS] reconnecting in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`)
        retryTimer.current = setTimeout(connect, delay)
      }
    }
  }, [candidateId, role])

  useEffect(() => {
    unmounted.current = false
    connect()

    return () => {
      unmounted.current = true
      clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, ready, lastMsg, addHandler }
}
