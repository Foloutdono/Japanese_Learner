import { useCallback, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { gateBeside } from '../../config/tabs'
import { useGateSwipe } from '../../hooks/useGateSwipe'
import { useDeparture } from '../../stores/departure'
import { playClick } from '../../lib/audio'
import { Hud } from './Hud'
import { TabBar } from './TabBar'
import { useChrome } from './useChrome'

// ── 車内 — the two frames every screen renders in (plan 068) ──
// The canvas's backbone: the HUD across the top (level · goal status ·
// commuter pass), the five gates across the bottom, and the screen
// between them. It is ONE chrome at every width — a phone's frame,
// drawn as a centred column on a wide screen — because the app is
// one app, and the burger drawer, the top bar and the concourse home
// it replaces were a second one.
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

  // ── 乗り換え — the flick between gates ──
  // The tab bar is the navigation; this is the same row of five read
  // with a thumb. hooks/useGateSwipe owns the gesture and everything
  // that outranks it; config/tabs' gateBeside owns which gate is
  // next, and answers null on a station behind a gate and at both
  // ends of the bar. Closed while a 改札 cutscene is running: that is
  // already taking the screen somewhere, and two departures at once
  // is one too many.
  const step = useCallback(dir => {
    const path = gateBeside(pathname, dir)
    if (!path) return
    playClick()
    pull(content.current, dir)
    navigate(path)
  }, [pathname, navigate])

  useGateSwipe(content, step, !departing)

  return (
    <div className="phone">
      <SkipLink />
      <Hud />
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
      <TabBar />
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
