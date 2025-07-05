import { useState } from 'react'
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
          <div className="info-hint">Tap to change room type</div>
        </div>
        <div onClick={openEditor}>
          <div className="info-row">
            <span className="info-label">Name:</span>
            <span className="info-value">{name}</span>
          </div>
          <div className="info-hint">Tap to change</div>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div className="modal" onClick={e => e.stopPropagation()}>
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
