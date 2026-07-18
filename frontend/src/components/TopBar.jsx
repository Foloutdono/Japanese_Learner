import { useState, useEffect, useRef } from 'react'
import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { BurgerMenu } from './BurgerMenu'

// helper: decide when writing toggle should appear
function isKanjiRoute(path) {
  return path?.includes('kanji') // adjust if needed
}

const MOBILE_BREAKPOINT = 768
const SCROLL_THRESHOLD   = 2     // px of scroll before reacting — just enough to ignore jitter
const REVEAL_DURATION    = 5000  // ms the bar stays visible after a reveal

/**
 * Hidden by default. Reveals only when the user scrolls up, then
 * auto-hides itself again after REVEAL_DURATION ms (the timer resets
 * on every fresh scroll-up). Only ever active on small screens; pass
 * `active=false` (or be on desktop) and it always reports "not hidden".
 *
 * Exported so screens that roll their own header markup instead of
 * <TopBar/> (e.g. StudyScreen's quiz view) can reuse the same logic.
 */
export function useAutoHideTopBar(active = true) {
  const [hidden, setHidden] = useState(true)
  const lastY = useRef(0)
  const hideTimer = useRef(null)

  useEffect(() => {
    if (!active) { setHidden(false); return }

    setHidden(true)
    lastY.current = window.scrollY
    let ticking = false

    function clearHideTimer() {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }

    function reveal() {
      setHidden(false)
      clearHideTimer()
      hideTimer.current = setTimeout(() => setHidden(true), REVEAL_DURATION)
    }

    function onScroll() {
      if (window.innerWidth > MOBILE_BREAKPOINT) { setHidden(false); return }
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current

        if (delta < -SCROLL_THRESHOLD)       reveal()
        else if (delta > SCROLL_THRESHOLD)   { setHidden(true); clearHideTimer() }

        lastY.current = y
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearHideTimer()
    }
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
      <div className="top-bar__inner">
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
    </div>
  )
}