import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { swUpdate, useSwUpdate } from '../../stores/swUpdate'
import { useOnline } from '../../hooks/useOnline'
import { releaseNotice, useReleaseNotice } from '../../stores/releaseNotice'
import { refillClock } from '../../domain/credits'
import { playClick } from '../../lib/audio'

// ── 掲示 — the docked notes ──────────────────────────────────
// One object (.dock-note in index.css) for the three things the shell
// has to say on every screen: the network is gone, a release is coming,
// or a new build is waiting. All mount beside <DocumentHead/> in App.jsx,
// inside the router, so they survive navigation and can read the route.
// They share one place on the screen, so one speaks at a time: no
// connection first, then the release, then the new build (which the
// release itself usually brings, and which can wait for it to end).

// ── ダイヤ改正 — a new build has arrived ──
// The new worker has already taken over (pwa.workbox.js); the one
// action here reloads this page into it at the learner's own moment.
// "Later" dismisses the note and changes nothing else — the next full
// load is on the new build regardless, which is what makes putting it
// off safe.
export function UpdateToast() {
  const { t } = useLang()
  const ready = useSwUpdate()
  const release = useReleaseNotice()
  if (!ready || release) return null
  return (
    <div className="dock-note dock-note--update" role="status">
      <span className="dock-note__text">{t.pwaUpdateReady}</span>
      <span className="dock-note__actions">
        <button type="button" className="dock-note__btn dock-note__btn--quiet" onClick={() => swUpdate.dismiss()}>
          {t.pwaUpdateLater}
        </button>
        <button type="button" className="dock-note__btn" onClick={() => { playClick(); swUpdate.apply() }}>
          {t.pwaUpdateBtn}
        </button>
      </span>
    </div>
  )
}

// ── 工事 — a release is coming (plan 265) ──
// The release workflow announced the minute it pushes, and the server
// says so on every answer (stores/releaseNotice.js). For a few minutes
// after it the app may stall or show the boot gate: this says why
// before it happens, and while it does. One quiet action, read.
export function ReleaseNote() {
  const { t, lang } = useLang()
  const online = useOnline()
  const release = useReleaseNotice()
  if (!release || !online) return null
  const text = release.due ? t.releaseNoticeNow : t.releaseNoticeAt(refillClock(release.at, lang))
  return (
    <div className="dock-note dock-note--release" role="status">
      <span className="dock-note__text">{text}</span>
      <span className="dock-note__actions">
        <button type="button" className="dock-note__btn dock-note__btn--quiet" onClick={() => releaseNotice.dismiss()}>
          {t.releaseNoticeOk}
        </button>
      </span>
    </div>
  )
}

// ── 運休 — no connection ──
// One line, no action: the request path keeps its own retry buttons,
// this only says why they will fail. Not on the gate hall, whose
// notice line already carries the same admission (HomeScreen's
// HallNotice) — one place owning up per screen.
export function OfflineNote() {
  const { t } = useLang()
  const online = useOnline()
  const { pathname } = useLocation()
  if (online || pathname === '/') return null
  return (
    <div className="dock-note dock-note--offline" role="status">
      <span className="dock-note__text">{t.offlineLine}</span>
    </div>
  )
}
