import Peer from 'peerjs'

let currentColor = '#ff4500'

const colorOptions = [
  '#ff4500',
  '#ff1744',
  '#4ecdc4',
  '#45b7d1',
  '#96ceb4',
  '#ffeaa7',
  '#dda0dd',
  '#98d8c8',
]

function getNextAvailableColor() {
  // Find the next color in the array after the current color
  const currentIndex = colorOptions.indexOf(currentColor)
  const nextIndex = (currentIndex + 1) % colorOptions.length
  return colorOptions[nextIndex]
}

export function initPeer(onEvent) {
  const peer = new Peer({
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    },
  })

  const conns = new Map()
  const roomPeers = new Set()

  peer.on('open', (myId) => {
    const url = new URL(location.href)
    const peerParam = url.searchParams.get('peer')
    if (peerParam && peerParam !== myId) {
      connect(peerParam)
    }
  })

  peer.on('connection', (conn) => {
    wire(conn)
  })

  peer.on('error', (err) => {
    console.error('PeerJS error:', err)
  })

  function connect(remoteId) {
    if (conns.has(remoteId)) return
    const conn = peer.connect(remoteId)
    wire(conn)
  }

  function wire(conn) {
    conns.set(conn.peer, conn)
    roomPeers.add(conn.peer)

    conn.on('open', () => {
      // Exchange colors when connection opens
      conn.send({ t: 'color_exchange', color: currentColor })
    })

    conn.on('data', (data) => {
      if (data.t === 'color_exchange') {
        // Handle color exchange
        if (data.color === currentColor) {
          // Colors are the same - only the peer with the larger ID should change
          if (peer.id > conn.peer) {
            const newColor = getNextAvailableColor()
            currentColor = newColor
            onEvent({ t: 'color_changed', color: newColor })
          }
        }
      }
      onEvent(data)
    })

    conn.on('close', () => {
      conns.delete(conn.peer)
      roomPeers.delete(conn.peer)
    })

    conn.on('error', (err) => {
      console.error('Connection error:', err)
      conns.delete(conn.peer)
      roomPeers.delete(conn.peer)
    })
  }

  return {
    broadcast: (data) => {
      conns.forEach((conn) => {
        if (conn.open) {
          conn.send(data)
        }
      })
    },
    getMyId: () => peer.id,
    getPeerCount: () => conns.size,
    setCurrentColor: (c) => {
      currentColor = c
    },
  }
}
