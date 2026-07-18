import { useState, useEffect, useRef } from 'react'
import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { BurgerMenu } from './BurgerMenu'

// helper: decide when writing toggle should appear
function isKanjiRoute(path) {
  return path?.includes('kanji') // adjust if needed
}

const MOBILE_BREAKPOINT = 768
const SCROLL_THRESHOLD   = 6  // px of scroll before reacting — ignores jitter
const REVEAL_NEAR_TOP    = 8  // px from the top where the bar always shows

/**
 * Hides on scroll-down, reveals on scroll-up (or near the top of the
 * page) — the same pattern mobile browsers use for their address bar.
 * Only ever hides on small screens; pass `active=false` (or be on
 * desktop) and it always reports "not hidden".
 *
 * Exported so screens that roll their own header markup instead of
 * <TopBar/> (e.g. StudyScreen's quiz view) can reuse the same logic.
 */
export function useAutoHideTopBar(active = true) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    if (!active) { setHidden(false); return }

    lastY.current = window.scrollY
    let ticking = false

    function onScroll() {
      if (window.innerWidth > MOBILE_BREAKPOINT) { setHidden(false); return }
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current

        if (y <= REVEAL_NEAR_TOP)            setHidden(false)
        else if (delta > SCROLL_THRESHOLD)   setHidden(true)
        else if (delta < -SCROLL_THRESHOLD)  setHidden(false)

        lastY.current = y
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [active])

  return hidden
}

export function TopBar({
  onBack,
  title,
  drawingEnabled,
  onToggleDrawing,
  autoHide = false,
}) {
  const { t } = useLang()
  const currentPath = window.location.pathname
  const showWritingToggle = isKanjiRoute(currentPath)
  const hidden = useAutoHideTopBar(autoHide)

  return (
    <div className={`top-bar${autoHide ? ' top-bar--autohide' : ''}${hidden ? ' top-bar--hidden' : ''}`}>
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