import ModeSelector from './ModeSelector'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { ModeFigures } from './ModeFigures'
import { FAST_REVIEW } from '../../domain/studyModes'
import { specimenFor } from '../../domain/specimen'

// ── 机 — a line's platforms, filling the page (plan 137) ─────────────
// The owner's pick A of the station screens canvas: in a line's split
// (a kana set, a JLPT level of vocab, kanji or grammar) the platforms
// share the page's height with the stops beside them, and each earns
// its row with three things — its description, the card it will ask
// (the specimen, from the stop's own card) and its own figures. The
// fast review rates nothing and has no figures, so it is not a
// platform among the others: it is a door at the page's foot, beside
// whatever else the station opens rather than boards (the grammar
// level's points, passed as `door`).
//
// The specimen needs the row's room: beside a lead, a description kept
// at a readable measure and the figures, a well is a third of a row at
// least twice a side column wide. Measured rather than set at a window
// width (the page's width is the window's less the rail and the stops),
// so a laptop's narrower page keeps its descriptions whole and simply
// draws no wells.
const SPECIMEN_MIN = 720

// Rendered only on the desk, by the screens that own a line.
export function LinePlatforms({ source, deck, card, modes, onSelect, door = null }) {
  const [boxRef, width] = useBoxWidth(true)
  const wells = width != null && width >= SPECIMEN_MIN
  const figured = modes.map(m => (m.key === FAST_REVIEW ? m : {
    ...m,
    aside: <ModeFigures source={source} deck={deck} mode={m.key} />,
    specimen: wells ? <Specimen mode={m.key} card={card} /> : null,
  }))
  const rated = figured.filter(m => m.key !== FAST_REVIEW)
  const review = figured.filter(m => m.key === FAST_REVIEW)
  return (
    <div className={wells ? 'desk-platforms desk-platforms--wells' : 'desk-platforms'} ref={boxRef}>
      <ModeSelector modes={rated} onSelect={onSelect} />
      {(review.length > 0 || door) && (
        <div className="desk-split__foot">
          {review.length > 0 && <ModeSelector modes={review} onSelect={onSelect} />}
          {door}
        </div>
      )}
    </div>
  )
}

// The cell keeps its width while the stop's card is on its way, so the
// row does not reflow when it lands; the well is drawn once there is
// something to put in it. Decorative for a screen reader: the card's
// description already says what the specimen shows.
export function Specimen({ mode, card }) {
  const spec = card ? specimenFor(mode, card) : null
  return (
    <span className="desk-spec" aria-hidden="true">
      {spec && <span className={`desk-spec__well desk-spec__well--${spec.kind}${spec.stack ? ' desk-spec__well--stack' : ''}`}>{face(spec)}</span>}
    </span>
  )
}

const To = () => <span className="desk-spec__to">→</span>

// A Japanese face longer than a word (a pattern, a phrase) takes the
// rung under the specimen's, so it reads whole in the well.
function Face({ part, answer = false }) {
  const classes = [
    'desk-spec__face',
    part.jp ? 'desk-spec__face--jp' : '',
    part.jp && part.text.length > 3 ? 'desk-spec__face--long' : '',
    answer ? 'desk-spec__face--answer' : '',
  ]
  return <span className={classes.filter(Boolean).join(' ')} lang={part.jp ? 'ja' : undefined}>{part.text}</span>
}

function face(spec) {
  switch (spec.kind) {
    case 'pair':
      return <><Face part={spec.q} /><To /><Face part={spec.a} answer /></>
    case 'type':
      return <><Face part={spec.q} /><span className="desk-spec__typed">{spec.typed}</span></>
    case 'draw':
      return <><Face part={spec.q} /><To /><span className="desk-spec__grid" lang="ja">{spec.ghost}</span></>
    case 'sentence':
      return (
        <>
          <span className="desk-spec__sentence" lang="ja">{spec.sentence}</span>
          <span className="desk-spec__rule"><To /><Face part={spec.a} answer /></span>
        </>
      )
    case 'blank':
      return (
        <>
          <span className="desk-spec__sentence" lang="ja">
            {spec.before}<span className="desk-spec__gap">＿＿＿</span>{spec.after}
          </span>
          <span className="desk-spec__choices" lang="ja">
            {spec.choices.map(c => <span key={c} className="desk-spec__choice">{c}</span>)}
          </span>
        </>
      )
    default:
      return null
  }
}
