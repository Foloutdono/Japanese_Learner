import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { BurgerMenu } from './BurgerMenu'
import { useProfileSummary } from './useProfileSummary'

const MOBILE_BREAKPOINT = 768
const SCROLL_THRESHOLD   = 2     // px of scroll before reacting — just enough to ignore jitter
const REVEAL_DURATION    = 2000  // ms the bar stays visible after a reveal

/**
 * Hidden by default on mobile. Reveals only on scroll-up (call
 * `reveal()` yourself for any other trigger — e.g. a tap on a fallback
 * handle), then auto-hides again after REVEAL_DURATION ms (the timer
 * resets on every fresh reveal). Call `onMenuOpenChange(true)` while a
 * child menu/drawer is open to keep the bar visible and pause the
 * cooldown, and `onMenuOpenChange(false)` when it closes to resume it.
 * Always visible on desktop.
 *
 * Returns { hidden, reveal, onMenuOpenChange }. Exported so screens
 * that roll their own header markup instead of <TopBar/> (e.g.
 * StudyScreen's quiz view) can reuse the same logic — note this now
 * returns an object, not a bare boolean, so update
 * `const hidden = useAutoHideTopBar(...)` to
 * `const { hidden, reveal } = useAutoHideTopBar(...)` there too.
 */
export function useAutoHideTopBar(active = true) {
  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT
  const [hidden, setHidden] = useState(() => active && isMobile())
  const lastY = useRef(0)
  const hideTimer = useRef(null)
  const menuOpen = useRef(false)

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
    if (!menuOpen.current) {
      hideTimer.current = setTimeout(() => setHidden(true), REVEAL_DURATION)
    }
  }

  function onMenuOpenChange(isOpen) {
    menuOpen.current = isOpen
    if (isOpen) {
      // Keep the bar up and freeze the cooldown while the menu is open.
      setHidden(false)
      clearHideTimer()
    } else if (isMobile()) {
      // Menu closed — give the user a fresh REVEAL_DURATION window.
      clearHideTimer()
      hideTimer.current = setTimeout(() => setHidden(true), REVEAL_DURATION)
    }
  }

  useEffect(() => {
    if (!active) { setHidden(false); return }

    setHidden(isMobile())
    lastY.current = window.scrollY
    let ticking = false

    function onScroll() {
      if (!isMobile()) { setHidden(false); return }
      if (menuOpen.current) return
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

  return { hidden, reveal, onMenuOpenChange }
}

// ── Level progress, desktop: ring ────────────────────────
// Sits in the top bar itself next to the title. Tapping it opens the
// full Profile screen. Renders nothing until the summary loads (or if
// there's no session) rather than showing a placeholder ring.
function TopBarProfileRing() {
  const navigate = useNavigate()
  const { t } = useLang()
  const summary = useProfileSummary()
  if (!summary) return null

  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const r = 16
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <button
      type="button"
      className="topbar-profile-ring"
      onClick={() => navigate('/profile')}
      title={`${t.level ?? 'Niveau'} ${summary.level} — ${into}/${span} XP`}
    >
      <svg className="topbar-profile-ring__svg" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="topbar-profile-ring__track" cx="20" cy="20" r={r} />
        <circle
          className="topbar-profile-ring__fill"
          cx="20" cy="20" r={r}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
        />
      </svg>
      <span className="topbar-profile-ring__level">{summary.level}</span>
    </button>
  )
}

// ── Level progress, mobile: bottom bar ───────────────────
// Fixed to the viewport, independent of TopBar's own DOM position, so
// it shows up consistently across every screen that renders <TopBar/>
// without needing every screen to add it individually. CSS keeps it
// mobile-only — see the ≤768px query in index.css.
function MobileLevelBar() {
  const navigate = useNavigate()
  const { t } = useLang()
  const summary = useProfileSummary()
  if (!summary) return null

  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  return (
    <button type="button" className="mobile-level-bar" onClick={() => navigate('/profile')}>
      <span className="mobile-level-bar__level">{t.level ?? 'Niv.'} {summary.level}</span>
      <span className="mobile-level-bar__track">
        <span className="mobile-level-bar__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="mobile-level-bar__xp">{into}/{span} XP</span>
    </button>
  )
}

export function TopBar({
  onBack,
  title,
  autoHide = false,
  actions,
}) {
  const { t } = useLang()
  const currentPath = window.location.pathname
  const { hidden, reveal, onMenuOpenChange } = useAutoHideTopBar(autoHide)

  return (
    <>
      <div className={`top-bar${autoHide ? ' top-bar--autohide' : ''}${hidden ? ' top-bar--hidden' : ''}`}>
        <div className="top-bar__inner">
          <BurgerMenu links={getNavLinks(t)} currentPath={currentPath} onOpenChange={onMenuOpenChange} />

          <span className="top-bar__title">{title}</span>

          <TopBarProfileRing />

          {actions}
          <button className="btn-back" onClick={onBack}>
            {t.back}
          </button>
        </div>
      </div>

      <MobileLevelBar />

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