import { useCallback, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { gateBeside } from '../../config/tabs'
import { useGateSwipe } from '../../hooks/useGateSwipe'
import { useDeparture } from '../../stores/departure'
import { playClick } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { Hud } from './Hud'
import { TabBar } from './TabBar'
import { DeskRail } from './DeskRail'
import { useChrome } from './useChrome'

// ── 車内 — the two frames every screen renders in (plan 068) ──
// The canvas's backbone: the HUD across the top (level · goal status ·
// commuter pass), the five gates across the bottom, and the screen
// between them — a phone's frame, drawn as a centred column between
// 769 and 1099px.
//
// ── 机 — and the desk's (plan 113) ──
// At 1100px and up (hooks/useDesk.js) the same frame draws the app's
// second chrome instead: the rail down the left edge (DeskRail.jsx),
// which is the HUD and the tab bar in one column. The swap is made in
// JavaScript so that below the line the DOM is exactly the phone's —
// no hidden rail, no class, nothing for a phone to pay for — and it is
// made SLOT BY SLOT: the chrome's two places change what they hold,
// while the screen's container stays the same element at the same
// index, so a window dragged across 1100 swaps the chrome and keeps the
// screen (its state, its scroll, a half-typed field) where it was.
// Shell.desk.browser.test.jsx holds that.
//
// A run, a practice session and an exam are the exception the canvas
// draws: both bars leave, the rating bar (or the field) docks on the
// bottom edge, and `‹ Gate` is the way out. That is the StageFrame.
// The two are layout routes in App.jsx; a screen never mounts its own
// chrome.

function SkipLink() {
  const { t } = useLang()
  // First thing in the tab order on every screen. Visually hidden
  // until focused — see .skip-link in index.css. Targets
  // #main-content, which each screen's <main> carries.
  return <a href="#main-content" className="skip-link">{t.skipToContent}</a>
}

// The arriving gate pulls in from the side the flick came from: the
// boarding's own idiom (`.brd__car--in`) at a gate's scale — one
// screen arriving alone cannot slide a whole width the way a pair of
// cars does, so it is a short pull and a fade. The content element
// SURVIVES the route change, which is the whole point of the chrome,
// so the animation has to be restarted by hand rather than by a fresh
// mount: drop the attribute, force the reflow that ends the old run,
// set it again.
function pull(node, step) {
  if (!node) return
  node.removeAttribute('data-pull')
  void node.offsetWidth
  node.dataset.pull = step > 0 ? 'next' : 'back'
}

export function Shell() {
  useChrome('shell')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const content = useRef(null)
  const departing = useDeparture()
  const desk = useDesk()

  // ── 乗り換え — the flick between gates ──
  // The tab bar is the navigation; this is the same row of five read
  // with a thumb, and it is live on every screen this frame carries —
  // a gate, a station, a platform picker, a settings page.
  // hooks/useGateSwipe owns the gesture and everything that outranks
  // it; config/tabs' gateBeside owns which gate is next, and answers
  // null at both ends of the bar. Closed while a 改札 cutscene is
  // running: that is already taking the screen somewhere, and two
  // departures at once is one too many.
  const step = useCallback(dir => {
    const path = gateBeside(pathname, dir)
    if (!path) return
    playClick()
    pull(content.current, dir)
    navigate(path)
  }, [pathname, navigate])

  // The flick is the phone's: it walks the tab bar's row, and the
  // desk has no row to walk — its gates are a column, in another order.
  useGateSwipe(content, step, !departing && !desk)

  return (
    <div className={desk ? 'phone phone--desk' : 'phone'}>
      <SkipLink />
      {desk ? <DeskRail /> : <Hud />}
      <div
        ref={content}
        className="phone__content"
        // An animation BUBBLES, so a card arriving inside the screen
        // would otherwise clear the attribute mid-pull.
        onAnimationEnd={e => {
          if (e.target === e.currentTarget) e.currentTarget.removeAttribute('data-pull')
        }}
      >
        <Outlet />
      </div>
      {desk ? null : <TabBar />}
    </div>
  )
}

export function StageFrame() {
  useChrome('stage')
  return (
    <div className="phone phone--stage">
      <SkipLink />
      <Outlet />
    </div>
  )
}
