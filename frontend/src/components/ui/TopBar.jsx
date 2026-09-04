import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getNavLinks } from '../../config/navLinks'
import { sectionFor, stationFor } from '../../config/stations'
import { identityFor } from '../../config/identity'
import { BurgerMenu } from './BurgerMenu'
import { useProfileSummary } from '../../stores/profileSummary'
import { QuickChange } from '../rewards/QuickChange'
import { playClick } from '../../lib/audio'
import { ChevronIcon } from './Icons'

// Must stay in step with the 768px tablet breakpoint documented in
// index.css's "── Breakpoints ──" block. If one moves, both move.
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
// eslint-disable-next-line react-refresh/only-export-components -- useAutoHideTopBar is a reusable hook consumed by screens that roll their own header markup instead of <TopBar/>; not a component.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this effect's whole point is subscribing to the window scroll listener below; these setHidden calls establish its starting visibility for that subscription (active vs. inactive, mobile vs. desktop), not a standalone id-keyed reset.
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

// ── 運賃 — the fare, reported where it was paid ──────────────
// XP earned by a review used to arrive as a toast in a corner of the
// screen. It reports to the level HUD now — the roundel on a desktop,
// the bottom bar on a phone — because that is the object the figure
// was paid into, and a "+4" rising off it needs no panel, no label
// and no dismissal to be understood. Both HUDs read the same summary
// store, so both notice the same gain; this hook is the one place
// that turns "xp went up" into something to draw, and it does it
// during render (the React docs' adjust-state-during-render pattern)
// so the figure appears in the same frame the bar moves.
//
// Returns { gain, clear }: `gain` is null or { id, delta, fromPct,
// toPct } — the amount, and the span of the level bar it just moved
// through — and `clear` is what the HUD calls once its animation ends.
function useXpGain(summary) {
  const [last, setLast] = useState(summary?.xp ?? null)
  const [gain, setGain] = useState(null)
  const xp = summary?.xp
  if (xp != null && xp !== last) {
    setLast(xp)
    if (last != null && xp > last) {
      const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
      // Clamped against the CURRENT span so a level-up (which shifts
      // xpPrevLevel/xpForNext) still yields a sane highlight instead
      // of a stale or negative offset.
      const prevInto = Math.min(span, Math.max(0, last - summary.xpPrevLevel))
      const curInto  = Math.min(span, Math.max(0, xp - summary.xpPrevLevel))
      setGain({
        // xp only ever climbs, so it is its own unique key — and it
        // keeps this render pure, which a Date.now() here is not.
        id: xp,
        delta: xp - last,
        fromPct: Math.round((prevInto / span) * 100),
        toPct:   Math.round((curInto / span) * 100),
      })
    }
  }
  const clear = useCallback(() => setGain(null), [])
  return { gain, clear }
}

// The figure itself, shared by both HUDs: the amount, and a unit in
// the caption register so a bare number under a level roundel cannot
// be read as levels. `key` on the caller remounts it per gain so the
// rise replays; the caller clears its gain off this element's own
// animationend, never off a timer guessing at the CSS.
function FareFigure({ gain, className, onEnd }) {
  if (!gain) return null
  return (
    <span
      key={gain.id}
      className={className}
      aria-hidden="true"
      onAnimationEnd={e => { if (e.animationName === 'hud-fare') onEnd() }}
    >
      +{gain.delta}<span className="hud-fare__unit">xp</span>
    </span>
  )
}

// ── Level progress, desktop: ring ────────────────────────
// Sits in the top bar itself next to the title. Tapping it opens the
// full Profile screen. Renders nothing until the summary loads (or if
// there's no session) rather than showing a placeholder ring.
function TopBarProfileRing() {
  const navigate = useNavigate()
  const { t } = useLang()
  const summary = useProfileSummary()
  const { gain, clear } = useXpGain(summary)
  if (!summary) return null

  // Still computed: the ring no longer draws an arc (see the roundel
  // below) but the title still reports the figure, which is the only
  // place it was ever readable as a number rather than an angle.
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))

  return (
    <button
      type="button"
      className={`topbar-profile-ring${gain ? ' topbar-profile-ring--gain' : ''}`}
      onClick={() => { playClick(); navigate('/profile') }}
      title={`${t.level} ${summary.level} — ${into}/${span} XP`}
    >
      {/* Study.dc.html draws this as a plain roundel with the level in
          it, not an XP arc. The arc was stroked in --accent9 -- a line
          pigment on an object about the LEARNER, which DESIGN.md
          reserves --pass-ink for. The XP figure is still in the title
          and still on the pass, one tap away. */}
      <span className="topbar-profile-ring__level">{summary.level}</span>
      {/* The fare rising off the roundel it was paid into; the ring
          itself pulses gold once (see --gain in index.css). */}
      <FareFigure gain={gain} className="hud-fare hud-fare--ring" onEnd={clear} />
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
  // The gain: the span of the track it just moved through lights up
  // gold, and the amount rises off the XP figure at the right end.
  // Both are cleared off the figure's own animationend, which is the
  // longer of the two, so the highlight never outlives its figure.
  const { gain, clear } = useXpGain(summary)

  if (!summary) return null

  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  return (
    <button type="button" className="mobile-level-bar" onClick={() => { playClick(); navigate('/profile') }}>
      <span className="mobile-level-bar__level">{t.level} {summary.level}</span>
      <span className="mobile-level-bar__track">
        <span className="mobile-level-bar__fill" style={{ width: `${pct}%` }} />
        {gain && gain.toPct > gain.fromPct && (
          <span
            key={gain.id}
            className="mobile-level-bar__gain"
            style={{ left: `${gain.fromPct}%`, width: `${Math.max(0, gain.toPct - gain.fromPct)}%` }}
          />
        )}
      </span>
      <span className="mobile-level-bar__xp">
        {into}/{span} XP
        <FareFigure gain={gain} className="hud-fare hud-fare--bar" onEnd={clear} />
      </span>
    </button>
  )
}

// ── 車内案内表示器 — the in-car information display ────────
// The strip above a train door. It carries one thing: where you are,
// in the two registers a 駅名標 uses — かんじ above 漢字, the reading
// over the name. The title below is frequently a whole journey
// ("漢字 N5 — MCQ"), which is precisely what an in-car display shows
// under a station name.
//
// It briefly carried a line-coloured roundel and a stripe as well.
// Both are gone: the plate already names the station four lines below,
// and repeating its code and its colour in the chrome made the top of
// every screen an echo of the object underneath it rather than a bar.
// Two registers, quiet, and the controls — that is the whole bar.
//
// On an identity route (/profile, /settings) the small register is the
// card rather than a reading, because a pass is not a place: the bar
// reads "your pass → profile". See config/identity.js.
//
// `pathname` comes from the router rather than window.location so the
// bar re-reads itself on navigation instead of only on remount.
export function TopBar({
  onBack,
  title,
  // A small chip after the name, for the one fact that qualifies the
  // station rather than naming it -- the JLPT level on a study screen.
  // It used to be glued to the title with an em-dash, which made the
  // bar read as one long Latin string; as a chip the name stays the
  // name and the qualifier sits beside it.
  tag,
  autoHide = false,
  actions,
}) {
  const { t } = useLang()
  const { pathname } = useLocation()
  const { hidden, reveal, onMenuOpenChange } = useAutoHideTopBar(autoHide)

  const identity = identityFor(pathname, t)
  // Resolve the section only to canonicalise a nested path
  // (/decks/<id> -> /decks) before asking for its reading.
  const section = identity ? null : sectionFor(pathname, t)
  const station = stationFor(section?.path ?? pathname)

  return (
    <>
      {/* First thing in the tab order on every screen that has chrome.
          Visually hidden until focused — see .skip-link in index.css.
          Targets #main-content, which each screen's <main> carries. */}
      <a href="#main-content" className="skip-link">{t.skipToContent}</a>

      <div
        className={[
          'top-bar',
          autoHide && 'top-bar--autohide',
          hidden && 'top-bar--hidden',
        ].filter(Boolean).join(' ')}
      >
        <div className="top-bar__inner">
          <BurgerMenu links={getNavLinks(t)} currentPath={pathname} onOpenChange={onMenuOpenChange} />

          <span className="top-bar__station">
            <span className="top-bar__stack">
              {/* The reading, above the name — the 駅名標 register, at
                  the size chrome can afford. On an identity route it is
                  the card rather than a reading, so the bar says "your
                  pass → profile" instead of naming a place. */}
              {identity
                ? <span className="top-bar__kana top-bar__kana--pass" lang="ja">定期券</span>
                : station.kana && (
                    <span className="top-bar__kana" lang="ja" aria-hidden="true">{station.kana}</span>
                  )}
              <span className="top-bar__title">
                {title}
                {tag && <span className="top-bar__tag">{tag}</span>}
              </span>
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