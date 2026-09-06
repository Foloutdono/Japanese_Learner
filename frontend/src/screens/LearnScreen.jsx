import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { getSections } from '../config/tabs'
import { HOME_STATION } from '../config/stations'
import { apiJson } from '../lib/api'
import { useTodaySummary } from '../stores/today'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { WallMap } from '../components/station/WallMap'

// ── 学習 — the Learn gate: the route map (plan 068) ──────────
// The wall map the gate hall used to hang beside the fare gate, on
// its own page now: the four lines with the learner's train on each,
// and the shelf of decks. Picking a line still announces it aloud and
// departs through the gate wipe, exactly as it always did.
//
// The map draws from two feeds: /api/stats for the distance travelled
// (domain/lineProgress) and /api/today for the due chips — the latter
// through the shared store the tab bar's badge already reads, so the
// two figures can never disagree. Both fail quiet: the map draws with
// nobody aboard rather than shouting (a broken map is worse than an
// empty one; the run owns up on Today, where the retry lives).
//
// Plan 071 redraws this page on the canvas's route map (.wmap-line
// rows with stops, the decks row); until then the map keeps the
// board's own masthead, which is why the bar prints no <h1>.
export default function LearnScreen({ session }) {
  const { t } = useLang()
  const today = useTodaySummary().data
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let live = true
    apiJson('/api/stats', session)
      .then(data => { if (live) setStats(data) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  function depart(section) {
    playAnnouncement(section.clip)
    beginDeparture(section)
  }

  return (
    <main id="main-content" className="learn">
      <WallMap
        sections={getSections('learn', t)}
        station={HOME_STATION}
        name={t.appTitle}
        stats={stats}
        bySource={today?.by_source}
        onDepart={depart}
      />
    </main>
  )
}
