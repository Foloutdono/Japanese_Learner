import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { getSections } from '../config/tabs'
import { HOME_STATION } from '../config/stations'
import { apiJson } from '../lib/api'
import { useTodaySummary } from '../stores/today'
import { useStats } from '../stores/stats'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { TRACKED_LINES as TRACKED, lineStops, stopsAround } from '../domain/lineProgress'
import { Bar } from '../components/chrome/Bar'
import { Plate, DueChip, StopsFoot } from '../components/station/LinePlate'

// ── 学習 — the Learn gate: the plates (plan 093) ──────────────
// The bar, then one station plate per line: the four SRS lines with
// the stop the learner has reached at the foot of each, and the shelf
// of decks as a fifth plate. Picking one announces it aloud and
// departs through the gate wipe to its station.
//
// Three feeds, all shared or quiet: /api/stats for the distance
// travelled (the store every station reads too), /api/today for the
// due chips (the store the tab bar's badge reads), and /api/decks for
// the shelf plate's figures. All fail quiet: the plates hang with
// nobody aboard rather than shouting (the run owns up on Today, where
// the retry lives).
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
  const lines = sections.filter(s => TRACKED[s.path])
  const decksSection = sections.find(s => s.path === '/learn/decks')

  return (
    <main id="main-content" className="learn">
      <Bar code={HOME_STATION.code} title={t.routeMap} sub={t.learnFourLines} color="var(--accent2)" />
      <div className="plates">
        {lines.map(section => {
          const source = TRACKED[section.path]
          const stops = lineStops(stats, source)
          return (
            <Plate
              key={section.path}
              section={section}
              className="plate--line"
              aside={<DueChip due={today?.by_source?.[source] ?? 0} />}
              foot={<StopsFoot stops={stops} />}
              fill={stopsAround(stops).leg}
              onClick={() => depart(section)}
            />
          )
        })}
        {decksSection && (
          <Plate
            section={decksSection}
            className="plate--shelf"
            meta={shelf?.count > 0 ? t.decksRowMeta(shelf.count, shelf.cards) : null}
            aside={<DueChip due={today?.by_source?.personal ?? 0} />}
            onClick={() => depart(decksSection)}
          />
        )}
      </div>
    </main>
  )
}
