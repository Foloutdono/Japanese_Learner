import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Loading } from '../components/ui/Loading'
import { hideSplash } from '../lib/platform'
import { DeskMast } from '../components/chrome/DeskMast'
import { PaperWait } from '../components/boarding/PaperWait'

// ── 待合室 — the boot screen (plan 067) ───────────────────────
// What the app shows before it knows who is here: the sign over the
// three dots, on the page ground, under the notch. It replaces two
// hard-coded "Chargement..." waits in App.jsx — the session check and
// the onboarding gate — that spoke French to every device.
//
// The second of those waits is the one that hurts: the backend sleeps
// on Render's free tier and the first request of the day takes 30–60
// s. Past WAKE_AFTER_MS the screen owns up — "Waking the server" —
// instead of looking hung (plan 064.8; the gate's 45 s timeout in
// App.jsx is the server half of the same decision). Only the gate
// wait asks for the line: the session check is a local read that
// never talks to the server.
//
// The native splash (plan 076) hides once this has painted, so the
// learner sees one wait, not the splash and then this; on the web the
// call is a no-op (lib/platform.js).
export const WAKE_AFTER_MS = 4000

//
// `frame` is the desk's (plan 155): the wait between the Welcome's Board
// and the boarding's first question, drawn in the frame the two share --
// the sumi column down the left edge with its masthead on the same
// pixel, the paper beside it -- so first contact's column is carried
// from the sign-in to the line rather than dropped to the boot screen
// for the length of one request and put back. The paper holds the dots
// alone (PaperWait), the same dots on the same spot the Welcome shows
// while the pass is being issued. `since` is when Board was pressed
// (App's `boardedHere`): the dots are drawn a beat after that press
// whichever of the two screens is up by then, so a wait that ends before
// the beat is the column standing still, and one that crosses from the
// Welcome to here does not blink. The line itself is laid by the
// boarding's first frame (components/boarding/DeskLine).
export default function AppLoading({ wakesServer = false, wakeAfterMs = WAKE_AFTER_MS, frame = false, since = null }) {
  const { t } = useLang()
  const [waking, setWaking] = useState(false)

  useEffect(() => { hideSplash() }, [])

  useEffect(() => {
    if (!wakesServer) return
    const id = setTimeout(() => setWaking(true), wakeAfterMs)
    return () => clearTimeout(id)
  }, [wakesServer, wakeAfterMs])

  if (frame) {
    return (
      <main className="brd desk-brd desk-brd--wait" id="main-content">
        <aside className="desk-brd__side">
          <DeskMast />
        </aside>
        <PaperWait since={since} note={waking ? t.waitingServer : null} />
      </main>
    )
  }

  return (
    <div className="app-loading">
      <div className="app-loading__sign" lang="ja" aria-hidden="true">{t.appTitle}</div>
      <Loading />
      {/* Always in the tree, so the line lands in a live region that
          existed before it had anything to say, and the dots do not
          jump when it arrives. */}
      <p className="app-loading__note" role="status" aria-live="polite">
        {waking && t.waitingServer}
      </p>
    </div>
  )
}

