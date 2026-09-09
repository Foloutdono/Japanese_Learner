import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { swUpdate, useSwUpdate } from '../../stores/swUpdate'
import { useOnline } from '../../hooks/useOnline'
import { playClick } from '../../lib/audio'

// ── 掲示 — the docked notes ──────────────────────────────────
// One object (.dock-note in index.css) for the two things the shell
// has to say on every screen: the network is gone, or a new build is
// waiting. Both mount beside <DocumentHead/> in App.jsx, inside the
// router, so they survive navigation and can read the route.

// ── ダイヤ改正 — a new build has arrived ──
// The new worker has already taken over (pwa.workbox.js); the one
// action here reloads this page into it at the learner's own moment.
// "Later" dismisses the note and changes nothing else — the next full
// load is on the new build regardless, which is what makes putting it
// off safe.
export function UpdateToast() {
  const { t } = useLang()
  const ready = useSwUpdate()
  if (!ready) return null
  return (
    <div className="dock-note dock-note--update" role="status">
      <span className="dock-note__text">
        <span className="dock-note__jp" lang="ja">ダイヤ改正</span>
        {t.pwaUpdateReady}
      </span>
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
      <span className="dock-note__text">
        <span className="dock-note__jp" lang="ja">運休</span>
        {t.offlineLine}
      </span>
    </div>
  )
}
