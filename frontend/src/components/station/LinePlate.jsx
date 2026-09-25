import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { deckItems, lineMarks, stopsAround, stopsTravelled } from '../../domain/lineProgress'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'

// ── 駅名標 — a line as its own station plate (plan 094) ──────────
// The Learn and Practice gates hang one plate per section: the roundel
// with the line's code, the name in the learner's language, whatever
// the section has to say at its trailing edge (a due count), and the
// line's pigment as the 4px stripe along the bottom — the stroke every
// station plate in the app carries. Between the head and the stripe,
// a FOOT: what a real 駅名標 prints under the name, the stop behind
// you and the stop ahead, or on a practice platform the grades its
// trains leave for.
//
// It replaced the wall map (plan 071): four tracks of five labels
// each, at the same weight, on a phone whose width gave a label 60px.
// The plate says one stop name where the map said five, and the whole
// line is implied by it; the distance along the line stays on the
// profile's ledger, which already prints it.
//
// Chosen from five directions drawn side by side (plates, platforms,
// the map upright, the ledger, the next train); the owner took the
// plate, without the reading and the caption the mockup gave it: the
// interface speaks the learner's language, and a plate that prints
// かな over Kana over KANA names one thing three times.
//
// The head is the button — the whole plate reads as one, but the foot
// may hold buttons of its own (the grades), and a button cannot hold a
// button. `fill` is how much of the stripe is painted raw: the leg
// being ridden, 0..1, and 1 for a plate with no track behind it.

export function Plate({ section, aside = null, meta = null, foot = null, fill = 1, onClick, className = '', guide }) {
  const code = stationFor(section.path).code
  return (
    <div className={`plate ${className}`.trim()} style={{ '--line-color': section.color }} data-guide={guide}>
      <button type="button" className="plate__head" onClick={onClick}>
        <span className="pf-line__roundel plate__roundel" aria-hidden="true">{code}</span>
        <span className="plate__names">
          <span className="plate__title">{section.title}</span>
          {meta && <span className="plate__meta">{meta}</span>}
        </span>
        {aside && <span className="plate__aside">{aside}</span>}
      </button>
      {foot}
      <span className="plate__stripe" aria-hidden="true">
        <i style={{ width: `${Math.round(Math.min(1, Math.max(0, fill)) * 100)}%` }} />
      </span>
    </div>
  )
}

/** The due count, in the state's ink: an edge and a numeral, never a fill. */
export function DueChip({ due }) {
  const { t } = useLang()
  if (!due) return null
  return (
    <span className="plate__due">
      {due}<span className="plate__due__unit">{t.dueUnit}</span>
    </span>
  )
}

// A stop label. `t` on a mark names a string-table key — the novice's
// stop is a word, not a glyph, so it is written in the learner's
// language (domain/lineProgress.js's ORIGIN_STOP); every other mark
// carries its own label, a level's code or a kana specimen.
function Mark({ mark }) {
  const { t } = useLang()
  if (!mark) return null
  return <span lang={mark.jp ? 'ja' : undefined}>{(mark.t && t[mark.t]) || mark.label}</span>
}

/** The plate's foot on a Learn line: ‹ behind · HERE · ahead ›. */
export function StopsFoot({ stops, guide }) {
  const { prev, here, next } = stopsAround(stops)
  return (
    <span className="plate__foot plate__foot--stops" data-guide={guide}>
      <span className="plate__prev">{prev && <>‹ <Mark mark={prev} /></>}</span>
      <span className="plate__here"><Mark mark={here} /></span>
      <span className="plate__next">{next && <><Mark mark={next} /> ›</>}</span>
    </span>
  )
}

/**
 * The desk's foot on a Learn line (plan 114; upright since plan 130):
 * the whole line, where the phone's plate had room for three stops.
 * The novice's stop at the top, then one row per level going down —
 * the rail through every row filled as far as the level's leg is
 * ridden, the level's station (a ring) at the leg's END (a station is
 * a completion, domain/lineProgress), and beside it the level's own
 * figure, learned over total, the same one its station page prints.
 * The row's bar says what the figure cannot: learned in the line's
 * full pigment, met but not yet learned in half of it.
 *
 * It ran across the plate until plan 130, a strip at the foot of a
 * plate that stood a third of the way down the window. Upright, the
 * rows share the plate's height, and the plates share the window's —
 * the room goes to the line, not to air around it.
 */
//
// Every leg is a door (plan 115): its station's platforms are one click
// from the gate, where the plate's head departs to the stop being
// ridden — marked here as the learner's location. The legs are a list,
// walked like every list on the desk (hooks/useListWalk): one tab stop,
// the ridden leg, and ↑/↓/Home/End along it.
export function LineFoot({ stops, stats, source, guide, onStop }) {
  const marks = lineMarks(stops)
  const reached = Math.min(stops.length, Math.floor(stopsTravelled(stops)))
  const tabStop = Math.min(reached, stops.length - 1)
  const onWalk = useListWalk(true)
  return (
    <div className="plate__foot desk-line" data-guide={guide} onKeyDown={onWalk} aria-keyshortcuts={WALK_KEYS}>
      <span className="desk-line__origin">
        <Rail down={stops[0]?.score ?? 0} />
        <Mark mark={marks[0]} />
      </span>
      {stops.map((stop, i) => {
        const { learned, started, total } = deckItems(stats, source, stop.key)
        const state = i < reached ? ' desk-line__leg--done' : i === reached ? ' desk-line__leg--here' : ''
        return (
          <button
            key={stop.key}
            type="button"
            className={`desk-line__leg${state}`}
            aria-current={i === reached ? 'location' : undefined}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onStop?.(stop.key)}
          >
            <Rail up={stop.score} down={stops[i + 1]?.score ?? 0} />
            <span className="desk-line__stop"><Mark mark={marks[i + 1]} /></span>
            <span className="desk-line__bar" aria-hidden="true">
              <i className="desk-line__met" style={{ width: share(started, total) }} />
              <i className="desk-line__learned" style={{ width: share(learned, total) }} />
            </span>
            {total > 0 && <span className="desk-line__fig"><b>{learned}</b> / {total}</span>}
          </button>
        )
      })}
    </div>
  )
}

// A row's stretch of the rail, and its station. A leg runs from one
// row's ring to the next row's, so its first half is the bottom of the
// row above and its second half the top of its own: `up` is this leg's
// score, `down` the next leg's, and each half fills its share of it.
function Rail({ up = 0, down = 0 }) {
  const half = x => Math.min(1, Math.max(0, x))
  return (
    <span className="desk-line__rail" style={{ '--up': half(2 * up - 1), '--down': half(2 * down) }} aria-hidden="true">
      <i className="desk-line__ring" />
    </span>
  )
}

const share = (n, total) => `${total > 0 ? Math.round(Math.min(1, n / total) * 1000) / 10 : 0}%`
