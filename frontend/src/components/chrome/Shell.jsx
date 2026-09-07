import { Outlet } from 'react-router-dom'
import { useLang } from '../../LangContext'
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

export function Shell() {
  useChrome('shell')
  return (
    <div className="phone">
      <SkipLink />
      <Hud />
      <div className="phone__content">
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
