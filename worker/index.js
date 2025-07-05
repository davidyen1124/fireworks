// Rate limiting constants
const MAX_TOKENS = 120 // bucket capacity (≈120 msgs / min)
const TOKENS_PER_MS = 2 / 1000 // refill speed: 2 tokens every second

// Durable Object for managing fireworks rooms
export class FireworksRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
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

    // Use hibernatable accept instead of server.accept()
    this.ctx.acceptWebSocket(server)

    const clientCount = this.ctx.getWebSockets().length

    console.log(`Room: New connection, total: ${clientCount}`)

    // Send connection confirmation
    server.send(
      JSON.stringify({
        type: 'connected',
        clientCount: clientCount,
      })
    )

    // Notify other connections about new client
    this.broadcast(
      {
        type: 'client_joined',
        clientCount: clientCount,
      },
      server
    )

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

    // Validate color format
    if (typeof data.color !== 'string') {
      return false
    }

    // Allow hex colors (#RGB, #RRGGBB), HSL, RGB, RGBA, and basic named colors
    const validColor =
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(data.color) ||
      /^[a-zA-Z]{1,20}$/.test(data.color) ||
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

  async webSocketMessage(ws, raw) {
    const now = Date.now()

    // Get or create rate limiting data from socket attachment (survives hibernation)
    let meta = ws.deserializeAttachment() ?? {
      tokens: MAX_TOKENS,
      last: now,
      lastLaunch: 0,
      launchCount: 0,
    }

    // Refill tokens based on elapsed time
    const elapsed = Math.min(now - meta.last, 600_000) // 10 min cap
    meta.tokens = Math.min(MAX_TOKENS, meta.tokens + elapsed * TOKENS_PER_MS)
    meta.last = now

    // Consume 1 token for this message
    if (meta.tokens < 1) {
      ws.close(1008, 'rate limit')
      return
    }
    meta.tokens -= 1

    try {
      const data = JSON.parse(raw)
      console.log('Room: Received message:', data)

      // Validate launch messages
      if (data.t === 'launch') {
        if (!this.validateLaunchMessage(data)) {
          ws.close(1003, 'invalid payload')
          return
        }

        // Launch frequency limiting (5 launches/sec)
        const launchWindow = 1000 // 1 second window
        if (now - meta.lastLaunch < launchWindow) {
          meta.launchCount += 1
          if (meta.launchCount > 5) {
            ws.close(1008, 'launch rate limit')
            return
          }
        } else {
          meta.launchCount = 1
        }
        meta.lastLaunch = now

        // Only log broadcasts occasionally to avoid log spam
        if (Math.random() < 0.1) {
          console.log(
            'Room: Broadcasting firework to',
            this.ctx.getWebSockets().length - 1,
            'clients'
          )
        }
        this.broadcast(data, ws)
      }
    } catch (error) {
      console.error('Room: Error parsing message:', error)
      ws.close(1003, 'invalid json')
    }

    ws.serializeAttachment(meta)
  }

  async webSocketClose() {
    console.log('Room: Connection closed')

    this.broadcast({
      type: 'client_left',
      clientCount: this.ctx.getWebSockets().length,
    })
  }

  async webSocketError(ws, error) {
    console.error('Room: WebSocket error:', error)
  }

  broadcast(message, sender = null) {
    const messageStr = JSON.stringify(message)
    let sentCount = 0

    this.ctx.getWebSockets().forEach(webSocket => {
      if (webSocket !== sender) {
        try {
          webSocket.send(messageStr)
          sentCount++
        } catch (error) {
          console.error('Room: Error sending message, dropping socket:', error)
          // Socket is likely closed or in bad state, let it be cleaned up
        }
      }
    })

    // Only log broadcast results occasionally to avoid log spam
    if (Math.random() < 0.1) {
      console.log(`Room: Broadcast sent to ${sentCount} connections`)
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      const roomId = url.searchParams.get('room') || 'public'

      // Get Durable Object for this room
      const roomName = `room-${roomId}`
      const id = env.FIREWORKS_ROOM.idFromName(roomName)
      const roomObject = env.FIREWORKS_ROOM.get(id)

      return roomObject.fetch(request)
    }

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

    return new Response('Fireworks WebSocket Server with Durable Objects', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    })
  },
}
