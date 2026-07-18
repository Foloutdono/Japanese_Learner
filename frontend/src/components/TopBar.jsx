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
 * Hidden by default on mobile. Reveals only on scroll-up (call
 * `reveal()` yourself for any other trigger — e.g. a tap on a fallback
 * handle), then auto-hides again after REVEAL_DURATION ms (the timer
 * resets on every fresh reveal). Always visible on desktop.
 *
 * Returns { hidden, reveal }. Exported so screens that roll their own
 * header markup instead of <TopBar/> (e.g. StudyScreen's quiz view)
 * can reuse the same logic — note this now returns an object, not a
 * bare boolean, so update `const hidden = useAutoHideTopBar(...)` to
 * `const { hidden, reveal } = useAutoHideTopBar(...)` there too.
 */
export function useAutoHideTopBar(active = true) {
  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT
  const [hidden, setHidden] = useState(() => active && isMobile())
  const lastY = useRef(0)
  const hideTimer = useRef(null)

  function clearHideTimer() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function reveal() {
    if (!isMobile()) return
    setHidden(false)
    clearHideTimer()
    hideTimer.current = setTimeout(() => setHidden(true), REVEAL_DURATION)
  }

  useEffect(() => {
    if (!active) { setHidden(false); return }

    setHidden(isMobile())
    lastY.current = window.scrollY
    let ticking = false

    function onScroll() {
      if (!isMobile()) { setHidden(false); return }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return { hidden, reveal }
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
  const { hidden, reveal } = useAutoHideTopBar(autoHide)

  return (
    <>
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

      {/* Fallback affordance: scrolling up reveals the bar, but short
          pages may not be scrollable at all — this small tab is always
          reachable by tap so the burger/back button never gets stranded. */}
      {autoHide && (
        <button
          type="button"
          className={`top-bar__peek${hidden ? ' top-bar__peek--visible' : ''}`}
          onClick={reveal}
          aria-label={t.back}
          tabIndex={hidden ? 0 : -1}
        >
          <span aria-hidden="true">▾</span>
        </button>
      )}
    </>
  )
}