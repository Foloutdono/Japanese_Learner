import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { getSections } from '../config/tabs'
import { apiJson } from '../lib/api'
import { useTodaySummary } from '../stores/today'
import { useStats } from '../stores/stats'
import { useProfileSummary } from '../stores/profileSummary'
import { linesOrAll } from '../domain/boarding'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { TRACKED_LINES as TRACKED, lineStops, stopsAround } from '../domain/lineProgress'
import { currentKanaSet } from '../domain/kanaSets'
import { Plate, DueChip, StopsFoot, LineFoot } from '../components/station/LinePlate'
import { useDesk } from '../hooks/useDesk'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'

// ── 学習 — the Learn gate: the plates (plan 094) ──────────────
// One station plate per line, and no bar over them: the four SRS lines with
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
//
// The lines the learner chose at the boarding (domain/boarding.js
// LINES, backend core/lines.py) hang first; the ones they did not are
// marked off their route and hang after, still one tap away -- the
// choice is a default, never a lock. The kana line is never off: every
// ticket rides it. A profile that never answered (or has not arrived)
// hangs all four as chosen.
//
// ── A plate opens where the learner is ──
// The head used to open the STATION — the line's list of stops — and
// the learner picked the same stop they picked yesterday, every day,
// before the platforms came into view: three taps on 単語 (sources,
// levels, N4) to reach a screen the app already knew the way to. It
// departs for that stop directly now: the one the station itself
// rings as "You are here", so the plate and the stop list cannot
// name two different places.
//
// Where that is, is the app's own answer and not a new one. On a JLPT
// line it is the learner's declared grade (user_profiles.jlpt_level,
// what LevelSelector marks); on かな, which has no declared anything,
// the first set not finished (domain/kanaSets.js's currentKanaSet).
// A landmark, never a lock (ADR 0005): the stop list is one tap back
// — the station's Leave — so this is a default the learner can walk
// out of, not a route they are held on.
//
// Nothing known yet — a profile or a figure that has not arrived, or
// a fetch that failed — and the plate opens the station, exactly as
// it always did. A guess at the stop would be worse than the question.
//
// The gate prints no head. It opened on the concourse's bar — 辻 over
// "Route map", "Four lines" at the far end — and the owner had it
// removed from the four gates (2026-09-20): the tab bar already
// captions the gate you are on, and a bar under the HUD naming the
// same place was a second title. The name stays as the screen's one
// <h1>, clipped, so a screen reader still lands somewhere named.
export default function LearnScreen({ session }) {
  const { t } = useLang()
  const today = useTodaySummary().data
  const stats = useStats().data
  const desk = useDesk()
  const profile = useProfileSummary()
  const riding = linesOrAll(profile?.lines)
  const here = profile?.jlptLevel ?? null
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

  // `to` is where the train actually goes; the section is still what
  // the gate wipes in — its pigment, its 漢字, its plate — because a
  // deeper path resolves to the same station (config/stations.js
  // falls back to the longest prefix).
  function depart(section, to = section.path) {
    playAnnouncement(section.clip)
    beginDeparture(to === section.path ? section : { ...section, path: to })
  }

  /** The stop the learner stands at on one line, as a path, or the
   *  station itself when the line has nobody placed on it yet. */
  function stopPath(section) {
    const stop = TRACKED[section.path] === 'kana' ? currentKanaSet(stats?.items?.kana) : here
    return stop ? `${section.path}/${stop}` : section.path
  }

  const sections = getSections('learn', t)
  const onRoute = section => TRACKED[section.path] === 'kana' || riding.includes(TRACKED[section.path])
  const lines = sections.filter(s => TRACKED[s.path]).sort((a, b) => Number(onRoute(b)) - Number(onRoute(a)))
  const decksSection = sections.find(s => s.path === '/learn/decks')

  // 案内 — the plates are drawn from config, so the gate is ready at
  // once (plan 100).
  const guide = useGuide('learn', true)

  return (
    <main id="main-content" className="learn">
      <h1 className="sr-only">{t.tabLearn}</h1>
      {guide.open && <Guide gate="learn" onEnd={guide.onEnd} />}
      <div className="plates">
        {lines.map((section, i) => {
          const source = TRACKED[section.path]
          const stops = lineStops(stats, source)
          const off = !onRoute(section)
          return (
            <Plate
              key={section.path}
              section={section}
              className={`plate--line${off ? ' plate--off' : ''}`}
              meta={off ? t.plateOffRoute : null}
              aside={<DueChip due={today?.by_source?.[source] ?? 0} />}
              // The guide (plan 100) points at the first plate and its
              // foot; the others say the same thing by looking the same.
              guide={i === 0 ? 'learn.plate' : undefined}
              // The phone's plate has room for the stop behind, the one
              // reached and the one ahead; the desk's draws the whole
              // line (plan 114), upright since plan 130.
              foot={desk
                ? <LineFoot stops={stops} stats={stats} source={source} guide={i === 0 ? 'learn.stops' : undefined} onStop={stop => depart(section, `${section.path}/${stop}`)} />
                : <StopsFoot stops={stops} guide={i === 0 ? 'learn.stops' : undefined} />}
              fill={stopsAround(stops).leg}
              onClick={() => depart(section, stopPath(section))}
            />
          )
        })}
        {decksSection && (
          <Plate
            section={decksSection}
            className="plate--shelf"
            guide="learn.shelf"
            meta={shelf?.count > 0 ? t.decksRowMeta(shelf.count, shelf.cards) : null}
            aside={<DueChip due={today?.by_source?.personal ?? 0} />}
            onClick={() => depart(decksSection)}
          />
        )}
      </div>
    </main>
  )
}
