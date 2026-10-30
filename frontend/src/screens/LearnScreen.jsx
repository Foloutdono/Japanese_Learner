import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getSections, getAllSections } from '../config/tabs'
import { apiJson } from '../lib/api'
import { keepCachedJson, lastCachedJson } from '../lib/cachedJson'
import { GATE_PATHS } from '../lib/warm'
import { useTodaySummary } from '../stores/today'
import { useBasics } from '../stores/basics'
import { useStats } from '../stores/stats'
import { useProfileSummary } from '../stores/profileSummary'
import { linesOrAll } from '../domain/boarding'
import { beginDeparture } from '../stores/departure'
import { board } from '../stores/boarding'
import { noteRide, rideOf } from '../stores/learnRide'
import { playAnnouncement } from '../lib/audio'
import { TRACKED_LINES as TRACKED, deckItems, lineStops, stopLabel, stopsAround } from '../domain/lineProgress'
import { currentKanaSet } from '../domain/kanaSets'
import { dueByDeck } from '../domain/lanes'
import { modeLabel } from '../domain/studyModes'
import { Plate, DueChip, LineFoot } from '../components/station/LinePlate'
import { GateResume } from '../components/station/GateResume'
import { LineSheet, StopRecord } from '../components/learn/LineSheet'
import { useDesk } from '../hooks/useDesk'
import { Guide } from '../components/guide/Guide'
import { DeckShelfPanel, LibraryPanel } from '../components/decks/GateShelf'
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
// ── On the phone, the plates fold and rise as a sheet (plan 291) ──
// Five plates shared the phone's height, about 116px each for two lines
// of type, and their foot named the last stop FINISHED, so a learner
// 87% through N5's kanji read « Débutant » on a plate that opened N4.
// Any other level, the themes or a deck was four taps away. The owner
// took B of the canvas "Tsuji — Learn on the phone", the shape the
// Practice gate took (plan 290), with the raised plate improved as
// drawn there: each line folds to one row, its stop and that stop's
// figure under the name (StopRecord, the stop the plate opens); a row
// raises the line's sheet (components/learn/LineSheet), where a stop
// and a mode are chosen and Embarquer boards them; the last ride a
// station boarded waits over the lines, boarded in one tap
// (stores/learnRide); the decks fold under the lines, one row each.
// The desk keeps its lines across and its shelf beside them.
//
// The gate prints no head. It opened on the concourse's bar — 辻 over
// "Route map", "Four lines" at the far end — and the owner had it
// removed from the four gates (2026-09-20): the tab bar already
// captions the gate you are on, and a bar under the HUD naming the
// same place was a second title. The name stays as the screen's one
// <h1>, clipped, so a screen reader still lands somewhere named.
export default function LearnScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const today = useTodaySummary().data
  const stats = useStats().data
  const desk = useDesk()
  const profile = useProfileSummary()
  const riding = linesOrAll(profile?.lines)
  const here = profile?.jlptLevel ?? null
  // The shelf: on the phone its decks folded under the lines, on the
  // desk every deck in the column beside them (plan 132). `shelfNonce`
  // asks again after a Follow from the library's panel. The last answer
  // kept (lib/warm.js asks it behind Today, plan 292) is drawn at once,
  // and asked again behind it.
  const [decks, setDecks] = useState(() => lastCachedJson(GATE_PATHS.decks, session)?.decks ?? null)
  const [shelfNonce, setShelfNonce] = useState(0)
  // The line whose sheet is raised, by its path (plan 291).
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let live = true
    apiJson(GATE_PATHS.decks, session)
      .then(data => {
        keepCachedJson(GATE_PATHS.decks, session, data)
        if (live) setDecks(data?.decks ?? [])
      })
      .catch(() => { if (live) setDecks(d => d ?? []) })
    return () => { live = false }
  }, [session, shelfNonce])

  // `to` is where the train actually goes; the section is still what
  // the gate wipes in — its pigment, its 漢字, its plate — because a
  // deeper path resolves to the same station (config/stations.js
  // falls back to the longest prefix).
  function depart(section, to = section.path) {
    playAnnouncement(section.clip)
    beginDeparture(to === section.path ? section : { ...section, path: to })
  }

  /** The stop the learner stands at on one line, or null while nobody
   *  is placed on it yet. */
  function stopOf(source) {
    return source === 'kana' ? currentKanaSet(stats?.items?.kana) : here
  }

  /** The stop the learner stands at on one line, as a path, or the
   *  station itself when the line has nobody placed on it yet. */
  function stopPath(section) {
    const stop = stopOf(TRACKED[section.path])
    return stop ? `${section.path}/${stop}` : section.path
  }

  // A run boarded from the gate, as from a station: the sheet goes down
  // first, so the doors are drawn over the gate. It is the last ride
  // now (plan 291); the fast review, a browse, boards with no doors.
  function boardRun(path, browse = false) {
    setOpen(null)
    noteRide(path)
    if (browse) navigate(path)
    else board(() => navigate(path))
  }
  function toStation(section, to) {
    setOpen(null)
    depart(section, to)
  }

  const sections = getSections('learn', t)
  const onRoute = section => TRACKED[section.path] === 'kana' || riding.includes(TRACKED[section.path])
  const lines = sections.filter(s => TRACKED[s.path]).sort((a, b) => Number(onRoute(b)) - Number(onRoute(a)))
  const decksSection = sections.find(s => s.path === '/learn/decks')

  // 案内 — the plates are drawn from config, so the gate is ready at
  // once (plan 100).
  const guide = useGuide('learn', true)

  // 基礎 (plan 186g): while an N5 learner rides the basics, their plate
  // hangs above the lines -- the course is where Today's new cards come
  // from, and the unit at hand is one tap away.
  const basicsSection = getAllSections(t).find(s => s.path === '/learn/basics')
  const basicsPlate = today?.basics && !today.basics.done && basicsSection
    ? <BasicsPlate section={basicsSection} at={today.basics} fold={!desk} onDepart={to => depart(basicsSection, to)} />
    : null

  if (desk) {
    const linePlates = lines.map((section, i) => {
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
          // The desk's plate draws the whole line (plan 114), upright
          // since plan 130, and across the plate since plan 132, where
          // the four stand in one column.
          foot={<LineFoot across stops={stops} stats={stats} source={source} guide={i === 0 ? 'learn.stops' : undefined} onStop={stop => depart(section, `${section.path}/${stop}`)} />}
          fill={stopsAround(stops).leg}
          onClick={() => depart(section, stopPath(section))}
        />
      )
    })
    return (
      <main id="main-content" className="learn">
        <h1 className="sr-only">{t.tabLearn}</h1>
        {guide.open && <Guide gate="learn" onEnd={guide.onEnd} />}
        {/* 棚 (plan 132, the owner's pick "A"): the lines stacked on the
            left, each drawn across the plate; the shelf over the library
            in a column at the entry's width on the right. */}
        <div className="learn-desk">
          <div className="plates plates--across">{basicsPlate}{linePlates}</div>
          <aside className="learn-desk__side" aria-label={t.decksTitle} style={{ '--line-color': 'var(--line-decks)' }}>
            <DeckShelfPanel decks={decks} today={today} guide="learn.shelf" />
            <LibraryPanel session={session} onFollowed={() => setShelfNonce(n => n + 1)} />
          </aside>
        </div>
      </main>
    )
  }

  // ── The phone: the lines folded, the sheet a fold raises (plan 291) ──
  const stops = Object.fromEntries(lines.map(s => [TRACKED[s.path], stopOf(TRACKED[s.path])]))
  const ride = rideOf(profile?.learnRide?.path)
  const rideSection = ride && lines.find(s => TRACKED[s.path] === ride.line)
  return (
    <main id="main-content" className="learn">
      <h1 className="sr-only">{t.tabLearn}</h1>
      {guide.open && <Guide gate="learn" onEnd={guide.onEnd} />}
      {rideSection && (
        <GateResume
          section={rideSection}
          title={<>{rideSection.title} · <span lang={ride.line === 'kana' ? 'ja' : undefined}>{stopLabel(ride.line, ride.stop)}</span></>}
          at={profile.learnRide.at}
          facts={[modeLabel(t, ride.mode)]}
          onClick={() => boardRun(ride.path)}
        />
      )}
      <div className="plates lrn-folds">
        {basicsPlate}
        {lines.map((section, i) => {
          const source = TRACKED[section.path]
          const stop = stopOf(source)
          const off = !onRoute(section)
          return (
            <Plate
              key={section.path}
              section={section}
              className={`plate--line plate--fold${off ? ' plate--off' : ''}`}
              popup="dialog"
              // A line the learner chose not to ride says so where the
              // others print their stop; its sheet still holds it.
              meta={off
                ? t.plateOffRoute
                : <StopRecord source={source} stop={stop} stats={stats} guide={i === 0 ? 'learn.stops' : undefined} />}
              aside={<DueChip due={today?.by_source?.[source] ?? 0} />}
              guide={i === 0 ? 'learn.plate' : undefined}
              // The stripe is painted to the share of the stop the plate
              // names, the figure beside it.
              fill={stop ? deckItems(stats, source, stop).score : 0}
              onClick={() => setOpen(section.path)}
            />
          )
        })}
      </div>
      {decksSection && <Shelf section={decksSection} decks={decks} today={today} onDepart={depart} />}
      {open && (
        <LineSheet
          sections={lines}
          start={open}
          stops={stops}
          stats={stats}
          today={today}
          session={session}
          onClose={() => setOpen(null)}
          onBoard={boardRun}
          onStation={toStation}
        />
      )}
    </main>
  )
}

// ── 棚 — the decks on the phone (plan 291) ──────────────────────────
// Under the lines, captioned as Practice's groups are: the learner's
// decks, owned and followed, folded one row each -- the deck's name over
// its cards, what it is due -- the first few of them, and a row of two
// doors: a new deck, and the library (or every deck, when the shelf
// holds more than the gate shows). A deck's row departs for its page.
const SHELF = 4

function Shelf({ section, decks, today, onDepart }) {
  const { t } = useLang()
  const uid = useId()
  const navigate = useNavigate()
  const due = dueByDeck(today)
  const shown = (decks ?? []).slice(0, SHELF)
  const more = (decks?.length ?? 0) > shown.length
  return (
    <section className="lrn-shelf" aria-labelledby={`${uid}-shelf`} data-guide="learn.shelf">
      <h2 className="prc-group__cap" id={`${uid}-shelf`}>{section.title}</h2>
      {shown.length > 0 && (
        <div className="plates lrn-folds">
          {shown.map(deck => (
            <Plate
              key={deck.id}
              section={{ ...section, path: `/learn/decks/${deck.id}`, title: deck.name }}
              className="plate--fold plate--deck"
              meta={t.cardsCount(deck.card_count ?? 0)}
              aside={<DueChip due={due.get(String(deck.id)) ?? 0} />}
              onClick={() => onDepart(section, `/learn/decks/${deck.id}`)}
            />
          ))}
        </div>
      )}
      <div className="lrn-shelf__doors">
        <button type="button" className="lrn-shelf__door" onClick={() => navigate('/learn/decks', { state: { create: true } })}>
          ＋ {t.newDeck}
        </button>
        <button type="button" className="lrn-shelf__door" onClick={() => onDepart(section, more ? '/learn/decks' : '/learn/decks/library')}>
          {more ? t.learnAllDecks(decks.length) : t.library} ›
        </button>
      </div>
    </section>
  )
}

// ── 基礎 — the basics as a plate (plan 186g) ─────────────────────
// The course's stops are its units: the foot prints the one behind, the
// one at hand and the one ahead, as a line's plate prints its stops, and
// the stripe fills with the unit at hand's cards met. Its ink is the
// section's neutral one -- the course is no line (config/tabs.js). The
// head opens the unit at hand. `at` is /api/today's `basics`, so the
// plate hangs with the gate; the neighbours' names arrive with
// /api/basics. On the phone it folds with the lines (plan 291): the
// unit at hand under the name, and no foot.
function BasicsPlate({ section, at, fold = false, onDepart }) {
  const { t } = useLang()
  const units = useBasics().data?.units ?? []
  const i = at.unit - 1
  const here = units[i]
  const name = u => u && <span lang="ja">{u.jp}</span>
  return (
    <Plate
      section={section}
      className={fold ? 'plate--basics plate--fold' : 'plate--basics'}
      meta={fold ? <>{t.basicsUnit(at.unit, at.of)} · <span lang="ja">{at.jp}</span></> : t.basicsUnit(at.unit, at.of)}
      foot={fold ? null : (
        <span className="plate__foot plate__foot--stops">
          <span className="plate__prev">{units[i - 1] && <>‹ {name(units[i - 1])}</>}</span>
          <span className="plate__here"><span lang="ja">{at.jp}</span></span>
          <span className="plate__next">{units[i + 1] && <>{name(units[i + 1])} ›</>}</span>
        </span>
      )}
      fill={here?.total ? here.met / here.total : 0}
      onClick={() => onDepart(`/learn/basics/${at.id}`)}
    />
  )
}
