import { useDialog } from '../../hooks/useDialog'
import { useLang } from '../../LangContext'
import { CrossIcon } from './Icons'

// ── ホーム画面に追加 — the iOS install sheet ──────────────────
// iPhone and iPad install a web app from Safari's share sheet and
// nothing else, so the Settings row cannot install; it explains the two
// taps. The same sheet chrome as the analyzer's tutorial (useDialog owns
// Escape, the focus trap and the return of focus).
export function InstallSheet({ onClose }) {
  const { t } = useLang()
  const dialogRef = useDialog(onClose)
  return (
    <div onClick={onClose} className="detail-overlay-sheet">
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="card detail-sheet install-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-sheet-title"
      >
        <div className="detail-header">
          <h2 className="anl-deckpicker__title" id="install-sheet-title">{t.installIosTitle}</h2>
          <button onClick={onClose} className="detail-close-btn" aria-label={t.close}>
            <CrossIcon size={16} />
          </button>
        </div>
        <p className="install-sheet__body">{t.installIosBody}</p>
        <ol className="install-sheet__steps">
          <li>{t.installIosStep1}</li>
          <li>{t.installIosStep2}</li>
        </ol>
      </div>
    </div>
  )
}
