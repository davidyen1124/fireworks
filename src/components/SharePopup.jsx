import { useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import './SharePopup.css'

export default function SharePopup({ onClose }) {
  const [copied, setCopied] = useState(false)

  const handlePopupShareClick = useCallback(async () => {
    const url = new URL(location.href)
    const shareUrl = url.toString()

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.log('Copy failed:', error)
      onClose()
    }
  }, [onClose])

  return (
    <div className="share-popup-backdrop" onClick={onClose}>
      <div className="share-popup" onClick={e => e.stopPropagation()}>
        <div className="popup-content">
          <div className="popup-emoji">🎆</div>
          <div className="popup-message">
            Share this link with friends, family, or loved ones to light up the
            sky together!
          </div>
          <div className="popup-buttons">
            <button
              className="popup-share-button"
              onClick={handlePopupShareClick}
              disabled={copied}
            >
              {copied ? '✅ Copied!' : '🔗 Copy Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

SharePopup.propTypes = {
  onClose: PropTypes.func.isRequired,
}
