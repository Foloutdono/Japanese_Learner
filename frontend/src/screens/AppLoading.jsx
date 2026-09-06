import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Loading } from '../components/ui/Loading'

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
// Plan 076: the native splash hides once this has painted —
// SplashScreen.hide() belongs in an effect here, so the learner sees
// one wait, not the splash and then this.
export const WAKE_AFTER_MS = 4000

export default function AppLoading({ wakesServer = false, wakeAfterMs = WAKE_AFTER_MS }) {
  const { t } = useLang()
  const [waking, setWaking] = useState(false)

  useEffect(() => {
    if (!wakesServer) return
    const id = setTimeout(() => setWaking(true), wakeAfterMs)
    return () => clearTimeout(id)
  }, [wakesServer, wakeAfterMs])

  return (
    <div className="app-loading">
      <div className="app-loading__sign" lang="ja" aria-hidden="true">{t.appTitle}</div>
      <Loading />
      {/* Always in the tree, so the line lands in a live region that
          existed before it had anything to say, and the dots do not
          jump when it arrives. */}
      <p className="app-loading__note" role="status" aria-live="polite">
        {waking && (
          <>
            <span className="app-loading__note-jp" lang="ja">サーバー起動中</span>
            {t.waitingServer}
          </>
        )}
      </p>
    </div>
  )
}
