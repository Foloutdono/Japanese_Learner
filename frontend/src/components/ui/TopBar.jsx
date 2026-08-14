import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getNavLinks } from '../../config/navLinks'
import { sectionFor, stationFor } from '../../config/stations'
import { BurgerMenu } from './BurgerMenu'
import { useProfileSummary } from '../../stores/profileSummary'
import { QuickChange } from '../rewards/QuickChange'
import { playClick } from '../../lib/audio'
import { ChevronIcon } from './Icons'

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
      onClick={() => { playClick(); navigate('/profile') }}
      title={`${t.level} ${summary.level} — ${into}/${span} XP`}
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
  const prevXpRef = useRef(null)
  const [gain, setGain] = useState(null) // { fromPct, toPct, id } — segment to highlight

  // Whenever xp goes up, figure out the percentage span it just moved
  // through and flag it for a highlighted overlay — cleared once its
  // fade-out animation ends (see onAnimationEnd below).
  useEffect(() => {
    if (!summary) return
    const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
    if (prevXpRef.current !== null && summary.xp > prevXpRef.current) {
      // Clamped against the *current* span so a level-up (which shifts
      // xpPrevLevel/xpForNext) still yields a sane highlight instead
      // of a stale or negative offset.
      const prevInto = Math.min(span, Math.max(0, prevXpRef.current - summary.xpPrevLevel))
      const curInto  = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
      const fromPct = Math.round((prevInto / span) * 100)
      const toPct   = Math.round((curInto / span) * 100)
      if (toPct > fromPct) setGain({ fromPct, toPct, id: Date.now() })
    }
    prevXpRef.current = summary.xp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.xp, summary?.xpPrevLevel, summary?.xpForNext])

  if (!summary) return null

  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  return (
    <button type="button" className="mobile-level-bar" onClick={() => { playClick(); navigate('/profile') }}>
      <span className="mobile-level-bar__level">{t.level} {summary.level}</span>
      <span className="mobile-level-bar__track">
        <span className="mobile-level-bar__fill" style={{ width: `${pct}%` }} />
        {gain && (
          <span
            key={gain.id}
            className="mobile-level-bar__gain"
            style={{ left: `${gain.fromPct}%`, width: `${Math.max(0, gain.toPct - gain.fromPct)}%` }}
            onAnimationEnd={() => setGain(null)}
          />
        )}
      </span>
      <span className="mobile-level-bar__xp">{into}/{span} XP</span>
    </button>
  )
}

// ── 車内案内表示器 — the in-car information display ────────
// The strip above a train door: which line you are riding, in its
// colour, and where you are on it. That is exactly a top bar's job,
// and this one used to be a plain dark strip with a serif string in
// it — the only piece of chrome in the app that gave no sign of the
// station it belonged to.
//
// Three things carry that now, all of them objects the app already
// owns rather than new invention:
//
//   the stripe    the section's line colour along the bottom edge, the
//                 same 4px band the station plate ends on.
//   the roundel   駅ナンバリング — the two-letter code from
//                 config/stations.js. It is the one mark you can find
//                 without reading anything, and the top bar was the
//                 last place in the app not using it.
//   the reading   かんじ above 漢字, the 駅名標 register system. The
//                 title below it is frequently a whole journey
//                 ("漢字 N5 — MCQ"), which is precisely what an in-car
//                 display shows under the station name.
//
// `pathname` comes from the router rather than window.location so the
// bar re-reads its line on navigation instead of only on remount.
export function TopBar({
  onBack,
  title,
  autoHide = false,
  actions,
}) {
  const { t } = useLang()
  const { pathname } = useLocation()
  const { hidden, reveal, onMenuOpenChange } = useAutoHideTopBar(autoHide)

  const section = sectionFor(pathname, t)
  const station = stationFor(section?.path ?? pathname)

  return (
    <>
      <div
        className={`top-bar${autoHide ? ' top-bar--autohide' : ''}${hidden ? ' top-bar--hidden' : ''}`}
        style={section ? { '--line-color': section.color } : undefined}
      >
        <div className="top-bar__inner">
          <BurgerMenu links={getNavLinks(t)} currentPath={pathname} onOpenChange={onMenuOpenChange} />

          <span className="top-bar__station">
            {station.code !== '??' && (
              <span className="top-bar__roundel" aria-hidden="true">{station.code}</span>
            )}
            <span className="top-bar__stack">
              {station.kana && (
                <span className="top-bar__kana" lang="ja" aria-hidden="true">{station.kana}</span>
              )}
              <span className="top-bar__title">{title}</span>
            </span>
          </span>

          <TopBarProfileRing />

          {/* 蔵 — the quick-change drawer. In the top bar rather than
              on the storehouse screen because the whole point is to
              reach it *without* leaving what you're doing: the moment
              you want a different paper is the moment you're looking
              at a card printed on the old one. Every screen with a top
              bar has it, mid-quiz included. */}
          <QuickChange />

          {actions}
          <button className="btn-back" onClick={() => { playClick(); onBack() }} aria-label={t.back} title={t.back}>
            <ChevronIcon direction="left" size={16} />
          </button>
        </div>

        {/* The line, along the bottom edge. Same band the station
            plate ends on, so the bar reads as the head of the same
            object rather than a separate piece of chrome. */}
        <div className="top-bar__stripe" aria-hidden="true" />
      </div>

      <MobileLevelBar />

      {/* Fallback affordance: scrolling up reveals the bar, but short
          pages may not be scrollable at all — this small tab is always
          reachable by tap so the burger/back button never gets stranded. */}
      {autoHide && (
        <button
          type="button"
          className={`top-bar__peek${hidden ? ' top-bar__peek--visible' : ''}`}
          onClick={() => { playClick(); reveal() }}
          aria-label={t.back}
          tabIndex={hidden ? 0 : -1}
        >
          <ChevronIcon direction="down" size={14} />
        </button>
      )}
    </>
  )
}