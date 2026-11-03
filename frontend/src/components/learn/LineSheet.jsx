import { Fragment, useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { Sheet } from '../chrome/Sheet'
import { Chip } from '../chrome/Console'
import { DueChip } from '../station/LinePlate'
import { useSheetPager } from '../../hooks/useSheetPager'
import { useStationSamples } from '../../stores/stationSamples'
import { useLearnerModes } from '../../stores/learnerModes'
import { cachedJson } from '../../lib/cachedJson'
import { TRACKED_LINES as TRACKED, deckItems, lineStops, stopLabel } from '../../domain/lineProgress'
import { FAST_REVIEW, modePickerEntries } from '../../domain/studyModes'
import { bare, specimenFor } from '../../domain/specimen'

// ── 引き上げ — a line raised as a sheet (plan 291) ──────────────────
// The phone's Learn gate hangs its lines folded; a plate raises this
// sheet, which holds every line as a page, the one tapped in view and
// the next a swipe away (hooks/useSheetPager, Practice's pager). The
// owner's pick B of the canvas "Tsuji — Learn on the phone", the raised
// plate improved as drawn there:
//
//   the head      the plate that was tapped, risen whole: its roundel,
//                 its name, the stop and its figure, what is due, and
//                 its stripe painted to the stop's share. The sheet is
//                 that plate, not a panel of its own.
//   the line      every stop a ring on the rail, filled to its share,
//                 its figure under its name (the desk's line, across);
//                 a tap chooses the stop, in the selection's gold, and
//                 the stop the learner stands at keeps its halo. The
//                 line's other sources (themes, frequency, radicals)
//                 are doors to the station under it.
//   the card      the run's own card at that stop, in that mode (the
//                 stop's sample, /api/station/{line}/samples, drawn as
//                 domain/specimen maps it onto the mode).
//   the modes     chips, the learner's main mode chosen (plan 273;
//                 grammar's ladder), the fast review last.
//   Embarquer     boards that stop in that mode, and names the stop.
//
// Nothing is boarded by a choice: a stop and a mode are picked, then
// Embarquer goes, so another level or another mode is two taps from the
// gate and both are three. A page asks for what it draws (its samples,
// the learner's modes, grammar's points) only once it or its neighbour
// is in view; the gate under it reads nothing new.

// The sources of a line that are not its stops, each a door to the
// station's own list. Kana and grammar have none.
const SOURCES = {
  '/learn/vocab': [['byThemeShort', '/learn/vocab/themes'], ['byFrequencyShort', '/learn/vocab/tiers']],
  '/learn/kanji': [['byFrequencyShort', '/learn/kanji/tiers'], ['byRadicalShort', '/learn/kanji/radicals']],
}

// Grammar's points per level are the station's (GrammarScreen), kept a
// minute: a mode whose pool is empty at a level is not offered there.
const POINTS_TTL_MS = 60_000

/** A line's record at one stop: the stop in the line's ink, and what of
 *  it the learner knows, learned / total (the stop's own figure, as its
 *  station prints it). Nothing while the stop is not known yet. */
export function StopRecord({ source, stop, stats, guide }) {
  if (!stop) return null
  const { learned, total } = deckItems(stats, source, stop)
  return (
    <span className="lrn-record" data-guide={guide}>
      <b className="lrn-record__stop" lang={source === 'kana' ? 'ja' : undefined}>{stopLabel(source, stop)}</b>
      {total > 0 && <> · {learned} / {total}</>}
    </span>
  )
}

/**
 * sections   the four lines, in the gate's order
 * start      the path of the plate that raised the sheet
 * stops      {source: the learner's stop, or null}
 * stats      /api/stats, or null while it is on its way
 * today      /api/today, or null
 * onBoard(path, browse)   a run, boarded (`browse`: the fast review)
 * onStation(section, to)  a station page, departed for
 */
export function LineSheet({ sections, start, stops, stats, today, session, onClose, onBoard, onStation }) {
  const { t } = useLang()
  const { pager, at, onScroll, slideTo, walk } = useSheetPager(
    sections.length, sections.findIndex(s => s.path === start),
  )
  const main = useLearnerModes().data?.main ?? null
  return (
    <Sheet open onClose={onClose} label={t.learnSheet} className="lrn-sheet">
      <div className="prc-sheet__strip lrn-sheet__strip" role="group" aria-label={t.learnSheet} onKeyDown={walk}>
        {sections.map((s, i) => (
          <button
            key={s.path}
            type="button"
            className="prc-sheet__stop"
            data-page-stop
            style={{ '--line-color': s.color }}
            aria-label={s.title}
            aria-current={i === at ? 'true' : undefined}
            tabIndex={i === at ? 0 : -1}
            onClick={() => slideTo(i)}
          >
            <span className="pf-line__roundel prc-sheet__ring" aria-hidden="true">{stationFor(s.path).code}</span>
          </button>
        ))}
      </div>
      <div className="prc-sheet__deck">
        <div className="prc-sheet__pager" ref={pager} onScroll={onScroll}>
          {sections.map((s, i) => (
            <section
              key={s.path}
              className="prc-page lrn-page"
              style={{ '--line-color': s.color }}
              aria-label={s.title}
              inert={i !== at}
            >
              <LinePage
                section={s}
                near={Math.abs(i - at) <= 1}
                here={stops[TRACKED[s.path]] ?? null}
                main={main}
                stats={stats}
                today={today}
                session={session}
                onBoard={onBoard}
                onStation={onStation}
              />
            </section>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

/** Where a page opens: the learner's stop, else the first not finished. */
function openingStop(stops, here) {
  if (here && stops.some(s => s.key === here)) return here
  return (stops.find(s => s.score < 1) ?? stops[stops.length - 1])?.key ?? null
}

function LinePage({ section, near, here, main, stats, today, session, onBoard, onStation }) {
  const { t, lang } = useLang()
  const source = TRACKED[section.path]
  const stops = lineStops(stats, source)
  const [picked, setPicked] = useState(null)
  const stop = picked ?? openingStop(stops, here)
  const points = useGrammarTotals(source === 'grammar' && near ? stop : null, lang, session)
  const offered = modePickerEntries(t, source)
    .filter(m => m.key === FAST_REVIEW || !points || (points.totals?.[m.key] ?? 1) > 0)
  const [chosen, setChosen] = useState(null)
  const fallback = offered.find(m => m.key === main?.[source]) ?? offered[0]
  const mode = offered.find(m => m.key === chosen) ?? fallback
  const samples = useStationSamples(source, near)
  const card = stop ? samples?.[stop]?.card ?? null : null
  const spec = card && mode
    ? specimenFor(mode.key, card) ?? specimenFor(`${source}.flashcard.f2b`, card)
    : null
  const share = stops.find(s => s.key === stop)?.score ?? 0
  const label = stop ? stopLabel(source, stop) : null

  return (
    <>
      <div className="lrn-page__head">
        <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
        <span className="prc-page__names">
          <h2 className="prc-page__title">{section.title}</h2>
          <span className="prc-page__meta"><StopRecord source={source} stop={stop} stats={stats} /></span>
        </span>
        <DueChip due={today?.by_source?.[source] ?? 0} />
      </div>
      <span className="plate__stripe lrn-page__edge" aria-hidden="true">
        <i style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }} />
      </span>
      <div className="lrn-line" role="group" aria-label={t.learnStop} style={{ '--stops': stops.length }}>
        {stops.map(s => {
          const { learned, total } = deckItems(stats, source, s.key)
          const classes = ['lrn-stop', s.score >= 1 ? 'lrn-stop--done' : '', s.key === here ? 'lrn-stop--here' : '']
            .filter(Boolean).join(' ')
          return (
            <button
              key={s.key}
              type="button"
              className={classes}
              style={{ '--share': `${Math.round(Math.min(1, Math.max(0, s.score)) * 100)}%` }}
              aria-pressed={s.key === stop}
              aria-current={s.key === here ? 'location' : undefined}
              onClick={() => setPicked(s.key)}
            >
              <span className="lrn-stop__ring" aria-hidden="true" />
              <span className="lrn-stop__name" lang={s.jp ? 'ja' : undefined}>{s.label}</span>
              {total > 0 && <span className="lrn-stop__fig">{learned} / {total}</span>}
            </button>
          )
        })}
      </div>
      {SOURCES[section.path] && (
        <div className="lrn-page__doors">
          {SOURCES[section.path].map(([key, to]) => (
            <button key={to} type="button" className="lrn-page__door" onClick={() => onStation(section, to)}>
              {t[key]} ›
            </button>
          ))}
        </div>
      )}
      <span className="lrn-card" aria-hidden="true">{spec && <Face spec={spec} />}</span>
      <div className="lrn-page__modes" role="group" aria-label={t.learnMode}>
        {offered.map(m => (
          <Chip key={m.key} className="lrn-page__mode" on={m.key === mode?.key} onClick={() => setChosen(m.key)}>{m.label}</Chip>
        ))}
      </div>
      {stop && mode && (
        <button
          type="button"
          className="btn-depart prc-page__go"
          onClick={() => onBoard(`${section.path}/${stop}/${mode.key}`, mode.key === FAST_REVIEW)}
        >
          <span className="btn-depart__jp">{t.depart} · <span lang={source === 'kana' ? 'ja' : undefined}>{label}</span></span>
        </button>
      )}
    </>
  )
}

// /api/grammar/points at one level: what each mode can serve there.
// null while on its way, or when not asked (another line, a page far off).
function useGrammarTotals(level, lang, session) {
  const [answer, setAnswer] = useState(null)
  useEffect(() => {
    if (!level) return undefined
    let live = true
    cachedJson(`/api/grammar/points?level=${encodeURIComponent(level)}&lang=${lang}`, session, { ttlMs: POINTS_TTL_MS })
      .then(data => { if (live) setAnswer({ level, data }) })
      .catch(() => {})
    return () => { live = false }
  }, [level, lang, session])
  return answer?.level === level ? answer.data : null
}

// ── 見本 — the run's card, on a phone ──
// The desk draws a mode's card at a car's size (LinePlatforms' Face);
// the sheet draws the same card a rung down, centred in its well: the
// prompt, then what the run asks of it. Decorative, as the desk's is:
// the chips and Embarquer say the rest.
function Part({ part, lead = false }) {
  const cls = lead ? `lrn-card__q${part.jp ? ' lrn-card__q--jp' : ''}` : 'lrn-card__a'
  return <span className={cls} lang={part.jp ? 'ja' : undefined}>{part.text}</span>
}

function Face({ spec }) {
  switch (spec.kind) {
    case 'pair':
      return <><Part part={spec.q} lead /><i className="lrn-card__fold" /><Part part={spec.a} /></>
    case 'type':
      return <><Part part={spec.q} lead /><span className="lrn-card__field">{spec.typed}</span></>
    case 'readings':
      return (
        <>
          <Part part={spec.q} lead />
          <span className="lrn-card__field" lang="ja">{[spec.on, spec.kun].filter(Boolean).join(' · ')}</span>
        </>
      )
    case 'draw':
      return <><Part part={spec.q} lead /><span className="lrn-card__ghost" lang="ja">{spec.ghost}</span></>
    case 'sentence':
      return <><span className="lrn-card__sentence" lang="ja">{spec.sentence}</span><i className="lrn-card__fold" /><Part part={spec.a} /></>
    case 'blank':
      return (
        <>
          <span className="lrn-card__sentence" lang="ja">{spec.before}<span className="lrn-card__hole" />{spec.after}</span>
          <span className="lrn-card__choices" lang="ja">{spec.choices.map(bare).join(' · ')}</span>
        </>
      )
    case 'build':
      return (
        <>
          <span className="lrn-card__sentence" lang="ja">
            {spec.pieces.map((p, i) => (p.gap ? <span key={i} className="lrn-card__hole" /> : <Fragment key={i}>{p.text}</Fragment>))}
          </span>
          {spec.tr && <span className="lrn-card__a">{spec.tr}</span>}
        </>
      )
    case 'write':
      return <><span className="lrn-card__a">{spec.situation}</span><span className="lrn-card__sentence" lang="ja">{spec.typed}</span></>
    default:
      return null
  }
}
