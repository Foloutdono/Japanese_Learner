import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { stopsAround } from '../../domain/lineProgress'

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

export function Plate({ section, aside = null, meta = null, foot = null, fill = 1, onClick, className = '' }) {
  const code = stationFor(section.path).code
  return (
    <div className={`plate ${className}`.trim()} style={{ '--line-color': section.color }}>
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
export function StopsFoot({ stops }) {
  const { prev, here, next } = stopsAround(stops)
  return (
    <span className="plate__foot plate__foot--stops">
      <span className="plate__prev">{prev && <>‹ <Mark mark={prev} /></>}</span>
      <span className="plate__here"><Mark mark={here} /></span>
      <span className="plate__next">{next && <><Mark mark={next} /> ›</>}</span>
    </span>
  )
}
