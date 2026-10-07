import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useDayClear } from '../stores/dayClear'
import { useProfileSummary } from '../stores/profileSummary'
import { shareTicket } from '../lib/shareTicket'
import DayClearView from '../components/dayclear/DayClearView'

// ── 終着 — the day's run, finished (plan 191) ─────────────────────────
// /today/clear. The day's run (screens/TodayRun.jsx) ends here with its
// tally in the router's state ({ run: { at, cleared, xp, minutes, cards }
// }); this screen asks the server once whether the run cleared the day
// (stores/dayClear) and plays the answer -- the ceremony of the canvas
// "Tsuji — the day cleared", or the partial finish
// (components/dayclear/DayClearView picks). On a phone it is drawn full
// screen, as a run's stage; on the desk beside the rail
// (components/chrome/Shell's DeskShellStage).
//
// A reload carries no state, and a finish with no run to finish is the
// gate's business: back to /today. Every way out replaces this entry,
// so Back from the gate does not replay a ceremony.
export default function DayClearScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const run = useLocation().state?.run ?? null
  const clear = useDayClear(run, session)
  const summary = useProfileSummary()

  if (!run) return <Navigate to="/today" replace />

  const leave = () => navigate('/today', { replace: true })
  const board = () => navigate('/today/run', { replace: true })
  const share = ticket => {
    if (!ticket) return
    shareTicket({
      ...ticket,
      t,
      figures: { reviews: summary?.totalReviews, words: summary?.wordsLearned, level: summary?.jlptLevel },
    })
  }
  return (
    <DayClearView
      status={clear.status}
      result={clear.result}
      run={run}
      levelUp={clear.levelUp}
      onLeave={leave}
      onContinue={board}
      onShare={share}
      onRetry={clear.retry}
    />
  )
}
