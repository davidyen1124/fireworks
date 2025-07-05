// Rate limiting constants
const MAX_MSGS_PER_MIN = 120
const WINDOW_MS = 60_000

// weak-map so the GC cleans up automatically when a socket closes
const msgTimestamps = new WeakMap() // ws → [t1, t2, …]

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

    // Validate color format (hex colors or basic named colors)
    if (typeof data.color !== 'string' || data.color.length > 50) {
      return false
    }

    // Allow hex colors (#RGB, #RRGGBB) and basic named colors
    const validColor =
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(data.color) ||
      /^[a-zA-Z]+$/.test(data.color)

    if (!validColor) {
      return false
    }

    // Validate name if present
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.length > 20) {
        return false
      }
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
      const arr = msgTimestamps.get(webSocket) || []
      arr.push(now)

      // keep only the ones still inside our rolling window
      const fresh = arr.filter(t => now - t < WINDOW_MS)
      msgTimestamps.set(webSocket, fresh)

      if (fresh.length > MAX_MSGS_PER_MIN) {
        // Too chatty – close with a standard code
        webSocket.close(1011, 'rate limit')
        return
      }

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
      msgTimestamps.delete(webSocket)
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
