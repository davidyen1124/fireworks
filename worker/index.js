// Rate limiting constants
const MAX_TOKENS = 120 // bucket capacity (≈120 msgs / min)
const TOKENS_PER_MS = 2 / 1000 // refill speed: 2 tokens every second
// weak-map so the GC cleans up automatically when a socket closes
// ws → { tokens: number, lastRefill: number }
const buckets = new WeakMap()

// Durable Object for managing fireworks rooms
export class FireworksRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.connections = new Set()
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    return new Response('Room handler', { status: 200 })
  }

  async handleWebSocket() {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    server.accept()

    // Add to connections
    this.connections.add(server)

    console.log(`Room: New connection, total: ${this.connections.size}`)

    // Send connection confirmation
    server.send(
      JSON.stringify({
        type: 'connected',
        clientCount: this.connections.size,
      })
    )

    // Notify other connections about new client
    this.broadcast(
      {
        type: 'client_joined',
        clientCount: this.connections.size,
      },
      server
    )

    this.setupWebSocketHandlers(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  validateLaunchMessage(data) {
    // Check required fields exist
    if (
      !Object.prototype.hasOwnProperty.call(data, 'x') ||
      !Object.prototype.hasOwnProperty.call(data, 'y') ||
      !Object.prototype.hasOwnProperty.call(data, 'color')
    ) {
      return false
    }

    // Validate coordinates are numbers within reasonable canvas bounds
    if (
      typeof data.x !== 'number' ||
      typeof data.y !== 'number' ||
      !Number.isFinite(data.x) ||
      !Number.isFinite(data.y) ||
      data.x < -100 ||
      data.x > 5000 ||
      data.y < -100 ||
      data.y > 5000
    ) {
      return false
    }

    // Validate color format (reasonable length limit as safety net)
    if (typeof data.color !== 'string' || data.color.length > 30) {
      return false
    }

    // Allow hex colors (#RGB, #RRGGBB), HSL, RGB, RGBA, and basic named colors
    const validColor =
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(data.color) ||
      /^[a-zA-Z]+$/.test(data.color) ||
      /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(data.color) ||
      /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[01]?\.?\d*\s*\)$/.test(
        data.color
      ) ||
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(data.color) ||
      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[01]?\.?\d*\s*\)$/.test(
        data.color
      )

    if (!validColor) {
      return false
    }

    // Validate name if present
    if (
      data.name !== undefined &&
      (typeof data.name !== 'string' || data.name.length > 20)
    ) {
      return false
    }

    return true
  }

  setupWebSocketHandlers(webSocket) {
    // Set up automatic ping/pong responses that work even when hibernated
    webSocket.serializeAttachment({
      ...webSocket.deserializeAttachment(),
      hibernatable: true,
    })

    // Configure automatic response for ping messages
    this.state.setWebSocketAutoResponse({
      request: '{"type":"ping"}',
      response: '{"type":"pong"}',
    })

    webSocket.addEventListener('message', event => {
      const now = Date.now()

      // Get or create this socket's bucket
      let bucket = buckets.get(webSocket)
      if (!bucket) {
        bucket = { tokens: MAX_TOKENS, lastRefill: now }
        buckets.set(webSocket, bucket)
      }

      // Refill tokens based on elapsed time
      const elapsed = now - bucket.lastRefill
      bucket.tokens = Math.min(
        MAX_TOKENS,
        bucket.tokens + elapsed * TOKENS_PER_MS
      )
      bucket.lastRefill = now

      // Consume 1 token for this message
      if (bucket.tokens < 1) {
        webSocket.close(1011, 'rate limit')
        return
      }
      bucket.tokens -= 1

      try {
        const data = JSON.parse(event.data)
        console.log('Room: Received message:', data)

        // Validate launch messages
        if (data.t === 'launch') {
          if (!this.validateLaunchMessage(data)) {
            webSocket.close(1003, 'invalid payload')
            return
          }

          console.log(
            'Room: Broadcasting firework to',
            this.connections.size - 1,
            'clients'
          )
          this.broadcast(data, webSocket)
        }
      } catch (error) {
        console.error('Room: Error parsing message:', error)
        webSocket.close(1003, 'invalid json')
      }
    })

    webSocket.addEventListener('close', () => {
      buckets.delete(webSocket)
      console.log('Room: Connection closed')
      this.connections.delete(webSocket)

      this.broadcast({
        type: 'client_left',
        clientCount: this.connections.size,
      })
    })

    webSocket.addEventListener('error', error => {
      console.error('Room: WebSocket error:', error)
      this.connections.delete(webSocket)
    })
  }

  broadcast(message, sender = null) {
    const messageStr = JSON.stringify(message)
    let sentCount = 0

    this.connections.forEach(webSocket => {
      if (webSocket !== sender && webSocket.readyState === 1) {
        try {
          webSocket.send(messageStr)
          sentCount++
        } catch (error) {
          console.error('Room: Error sending message:', error)
          this.connections.delete(webSocket)
        }
      }
    })

    console.log(`Room: Broadcast sent to ${sentCount} connections`)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const roomId = url.searchParams.get('room') || 'public'

      // Get Durable Object for this room
      const roomName = `room-${roomId}`
      const id = env.FIREWORKS_ROOM.idFromName(roomName)
      const roomObject = env.FIREWORKS_ROOM.get(id)

      return roomObject.fetch(request)
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions',
        },
      })
    }

    // Default response for non-WebSocket requests
    return new Response('Fireworks WebSocket Server with Durable Objects', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    })
  },
}
