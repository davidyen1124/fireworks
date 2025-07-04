import { useState } from 'react'
import './InfoBox.css'

export default function InfoBox({
  isPublic,
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
      <div className="info-box" onClick={openEditor}>
        <div className="info-row">
          <span className="info-label">Mode:</span>
          <span className="info-value">{isPublic ? 'Public' : 'Private'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Name:</span>
          <span className="info-value">{name}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Online:</span>
          <span className="info-value">{clientCount}</span>
        </div>
      </div>

      {editing && (
        <div className="name-modal-backdrop" onClick={closeEditor}>
          <div className="name-modal" onClick={e => e.stopPropagation()}>
            <label className="input-label">Display name</label>
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
