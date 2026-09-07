import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { getSections } from '../config/tabs'
import { HOME_STATION } from '../config/stations'
import { apiJson } from '../lib/api'
import { useTodaySummary } from '../stores/today'
import { useStats } from '../stores/stats'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { Bar } from '../components/chrome/Bar'
import { WallMap } from '../components/station/WallMap'

// ── 学習 — the Learn gate: the route map (plan 071) ──────────
// The bar, then the wall map: the four lines with the learner's train
// on each, and the shelf of decks as one row. Picking a line announces
// it aloud and departs through the gate wipe to its station.
//
// Three feeds, all shared or quiet: /api/stats for the distance
// travelled (the store every station reads too), /api/today for the
// due chips (the store the tab bar's badge reads), and /api/decks for
// the shelf row's figures. All fail quiet: the map draws with nobody
// aboard rather than shouting (the run owns up on Today, where the
// retry lives).
export default function LearnScreen({ session }) {
  const { t } = useLang()
  const today = useTodaySummary().data
  const stats = useStats().data
  const [shelf, setShelf] = useState(null)

  useEffect(() => {
    let live = true
    apiJson('/api/decks', session)
      .then(data => {
        if (!live) return
        const decks = data?.decks ?? []
        setShelf({ count: decks.length, cards: decks.reduce((n, d) => n + (d.card_count ?? 0), 0) })
      })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  function depart(section) {
    playAnnouncement(section.clip)
    beginDeparture(section)
  }

  const sections = getSections('learn', t)
  const decksSection = sections.find(s => s.path === '/learn/decks')

  return (
    <main id="main-content" className="learn">
      <Bar code={HOME_STATION.code} title={t.routeMap} sub={t.learnFourLines} color="var(--accent2)" />
      <WallMap
        sections={sections}
        stats={stats}
        bySource={today?.by_source}
        onDepart={depart}
        decks={decksSection ? {
          section: decksSection,
          count: shelf?.count ?? 0,
          cards: shelf?.cards ?? 0,
          due: today?.by_source?.personal ?? 0,
        } : null}
      />
    </main>
  )
}
