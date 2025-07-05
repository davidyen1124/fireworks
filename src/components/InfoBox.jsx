import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import './InfoBox.css'

export default function InfoBox({
  roomId,
  name,
  clientCount,
  onToggleRoom,
  onSaveName,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [copying, setCopying] = useState(false)

  const openEditor = () => setEditing(true)
  const closeEditor = () => {
    setDraft(name)
    setEditing(false)
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed) onSaveName(trimmed)
    setEditing(false)
  }

  const shareLink = useCallback(async () => {
    const url = new URL(location.href)
    const shareUrl = url.toString()

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        textArea.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 2em;
          height: 2em;
          padding: 0;
          border: none;
          outline: none;
          box-shadow: none;
          background: transparent;
          opacity: 0;
          pointer-events: none;
        `

        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        try {
          document.execCommand('copy')
        } catch (copyError) {
          console.log('Manual copy failed:', copyError)
        }

        document.body.removeChild(textArea)
      }
    } catch (error) {
      console.log('Clipboard access failed:', error)
    }
  }, [])

  return (
    <>
      <div className="info-box">
        <div className="info-row">
          <span className="info-label">Online:</span>
          <span className="info-value">{clientCount}</span>
        </div>
        <div onClick={onToggleRoom}>
          <div className="info-row">
            <span className="info-label">Room:</span>
            <span className="info-value">
              {roomId === 'public' ? 'Public' : roomId}
            </span>
          </div>
          <div className="info-hint">Tap to change room</div>
        </div>
        <div onClick={openEditor}>
          <div className="info-row">
            <span className="info-label">Name:</span>
            <span className="info-value">{name}</span>
          </div>
          <div className="info-hint">Tap to change</div>
        </div>

        <div
          onClick={() => {
            setCopying(true)
            shareLink()
            setTimeout(() => setCopying(false), 1500)
          }}
        >
          <div className="info-row">
            <span className="info-label">Share:</span>
            <span className="info-value">Copy link</span>
          </div>
          {copying && <div className="info-hint">Copied to clipboard</div>}
        </div>
      </div>

      {editing && (
        <div className="name-modal-backdrop" onClick={closeEditor}>
          <div className="name-modal" onClick={e => e.stopPropagation()}>
            <label className="input-label">Name</label>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && save()}
            />
            <div className="buttons">
              <button className="cancel" onClick={closeEditor}>
                Cancel
              </button>
              <button className="ok" onClick={save}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

InfoBox.propTypes = {
  roomId: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  clientCount: PropTypes.number.isRequired,
  onToggleRoom: PropTypes.func.isRequired,
  onSaveName: PropTypes.func.isRequired,
}
