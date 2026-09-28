import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Loading } from '../components/ui/Loading'
import { Mark } from '../components/ui/Mark'
import { hideSplash } from '../lib/platform'
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
// `frame` is the desk's (plans 155, 161): the wait between the Welcome's
// Board and the boarding's first question, drawn on the paper the two
// share rather than dropped to the boot screen for the length of one
// request: the dots alone (PaperWait), on the paper's middle, the same
// spot the Welcome draws them on while the pass is being issued.
// `since` is when Board was pressed (App's `boardedHere`): the dots are
// drawn a beat after that press whichever of the two screens is up by
// then, so a wait that ends before the beat is the paper standing still,
// and one that crosses from the Welcome to here does not blink.
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
        <PaperWait since={since} note={waking ? t.waitingServer : null} />
      </main>
    )
  }

  return (
    <div className="app-loading">
      <div className="app-loading__sign" aria-hidden="true"><Mark /></div>
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

