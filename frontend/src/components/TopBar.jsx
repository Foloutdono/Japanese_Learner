import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { BurgerMenu } from './BurgerMenu'

// helper: decide when writing toggle should appear
function isKanjiRoute(path) {
  return path?.includes('kanji') // adjust if needed
}

export function TopBar({
  onBack,
  title,
  drawingEnabled,
  onToggleDrawing,
}) {
  const { t } = useLang()
  const currentPath = window.location.pathname
  const showWritingToggle = isKanjiRoute(currentPath)

  return (
    <div className="top-bar">
      <BurgerMenu links={getNavLinks(t)} currentPath={currentPath} />

      <span className="top-bar__title">{title}</span>

      {showWritingToggle && (
        <button
          onClick={onToggleDrawing}
          className={`btn-writing-toggle ${
            drawingEnabled
              ? 'btn-writing-toggle--on'
              : 'btn-writing-toggle--off'
          }`}
          title={t.toggleWriting}
        >
          ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
        </button>
      )}
      <button className="btn-back" onClick={onBack}>
        {t.back}
      </button>
    </div>
  )
}