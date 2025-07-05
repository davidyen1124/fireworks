import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebSocket(
  roomId = 'public',
  onMessage = () => {},
  { reconnectAttempts = 5, baseDelay = 1000 } = {}
) {
  const wsRef = useRef(null)
  const reconnectRef = useRef(0)

  const [clientCount, setClientCount] = useState(0)

  const broadcast = useCallback(data => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    let timeoutId
    let pingId

    const connect = () => {
      const baseUrl = import.meta.env.VITE_WS_URL
      if (!baseUrl) {
        throw new Error('VITE_WS_URL environment variable is required')
      }
      const url = `${baseUrl}/?room=${roomId}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectRef.current = 0

        // Start heartbeat ping every 30 seconds to prevent idle disconnects
        pingId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = event => {
        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          return // silently ignore malformed messages
        }

        switch (data.type) {
          case 'connected':
            setClientCount(data.clientCount)
            break
          case 'client_joined':
          case 'client_left':
            setClientCount(data.clientCount)
            break
          default:
            onMessage(data)
        }
      }

      ws.onclose = ev => {
        clearInterval(pingId)
        if (ev.code === 1000) return // intentional

        if (reconnectRef.current < reconnectAttempts) {
          reconnectRef.current += 1
          timeoutId = setTimeout(connect, baseDelay * reconnectRef.current)
        }
      }
    }

    connect()

    return () => {
      clearTimeout(timeoutId)
      clearInterval(pingId)
      wsRef.current?.close(1000, 'intentional disconnect')
    }
  }, [roomId, reconnectAttempts, baseDelay, onMessage])

  return { clientCount, broadcast }
}
