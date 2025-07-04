import Peer from 'peerjs'

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
      // Clean up URL after initiating connection
      url.searchParams.delete('peer')
      history.replaceState({}, '', url.toString())
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

    conn.on('data', (data) => {
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
  }
}
