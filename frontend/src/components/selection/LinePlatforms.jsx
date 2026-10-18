import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import ModeSelector from './ModeSelector'
import { useBoxSize, useBoxWidth } from '../../hooks/useBoxWidth'
import { ModeFigures } from './ModeFigures'
import { FAST_REVIEW } from '../../domain/studyModes'
import { bare, specimenFor } from '../../domain/specimen'
import { carsFor, rungFor } from '../../domain/cars'

// ── 号車 — a line's platforms as cars (plans 137, 251) ───────────────
// The owner's pick C of the canvas "Tsuji — the learning modes on the
// desk": under the line (LineStation), the open stop's exercises stand
// as the cars of a train, side by side, each with its face -- the card
// it asks, drawn as the run draws it, from the stop's own card -- over
// its name, its description and its record. The faces are what tell
// the cars apart at a glance (a flashcard and its back, the field, the
// writing slab, the gap among its rivals, the hole and its translation,
// the situation to say), so they take the room a car has; the words
// under them say the same for a screen reader.
//
// The cars share the page's height in rows of two to four (domain/cars.js),
// and the first -- the line's main exercise, the registry's first: the
// ladder, a word to its meaning -- stretches over the cells a short row
// would leave empty, so the train has no gap in it. A window too short
// or too narrow for them scrolls rather than crush a car (the 机
// section's floor). The fast review, which rates nothing, and the
// grammar level's points, which open rather than board, are doors at
// the foot, side by side.

// Rendered only on the desk, by the screens that own a line.
export function LinePlatforms({ source, deck, card, modes, onSelect, door = null }) {
  const [boxRef, width] = useBoxWidth(true)
  const cars = modes.filter(m => m.key !== FAST_REVIEW).map(m => ({
    ...m,
    aside: <ModeFigures source={source} deck={deck} mode={m.key} line />,
    specimen: <Specimen mode={m.key} card={card} />,
  }))
  const review = modes.filter(m => m.key === FAST_REVIEW)
  const { cols, lead } = carsFor(cars.length, width)
  return (
    <div className="desk-platforms" ref={boxRef} style={{ '--cars': cols, '--lead': lead }}>
      <ModeSelector modes={cars} onSelect={onSelect} />
      {(review.length > 0 || door) && (
        <div className="desk-platforms__foot">
          {review.length > 0 && <ModeSelector modes={review} onSelect={onSelect} />}
          {door}
        </div>
      )}
    </div>
  )
}

// The rungs a face steps down while it overflows its well, from the
// largest the well allows (domain/cars.js's rungFor): a long sentence,
// a meaning on two lines, an N1 word take the rung under. The last step
// keeps the small rung and lets the extras go (the ladder's walk, the
// words Écrire offers), the face itself still whole.
const STEPS = ['lg', 'md', 'sm', 'bare']
const STEP_CLASS = { lg: 'desk-spec--lg', md: 'desk-spec--md', sm: 'desk-spec--sm', bare: 'desk-spec--sm desk-spec--bare' }

// The well keeps its size while the stop's card is on its way, so the
// car does not reflow when it lands; the face is drawn once there is a
// card and the well is measured, and fitted before it is painted.
// Decorative for a screen reader: the car's name and description say
// what the face shows.
export function Specimen({ mode, card }) {
  const [ref, size] = useBoxSize(true)
  const faceRef = useRef(null)
  const spec = card ? specimenFor(mode, card) : null
  const top = rungFor(size)
  // A step down holds for this well's size, this card and this mode;
  // any of them changing tries the top rung again.
  const [fit, setFit] = useState({ size: null, card: null, mode: null, down: 0 })
  const down = fit.size === size && fit.card === card && fit.mode === mode ? fit.down : 0
  const step = top ? STEPS[Math.min(STEPS.indexOf(top) + down, STEPS.length - 1)] : null
  useLayoutEffect(() => {
    const face = faceRef.current
    if (!face || !step || step === 'bare' || !overflows(face)) return
    setFit({ size, card, mode, down: down + 1 })
  }, [step, size, card, mode, down])
  return (
    <span className={step ? `desk-spec ${STEP_CLASS[step]}` : 'desk-spec'} ref={ref} aria-hidden="true">
      {spec && step && (
        <span className={`desk-spec__face desk-spec__face--${spec.kind}`} ref={faceRef}>
          <Face spec={spec} />
        </span>
      )}
    </span>
  )
}

// Whether the face asks for more than its well's content box: taller
// than the room, or wider (a Latin word does not break).
function overflows(face) {
  const well = face.parentElement
  const css = getComputedStyle(well)
  const room = well.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom)
  const wide = well.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
  return face.scrollHeight > room + 1 || face.scrollWidth > wide + 1
}

// A Japanese face sized by its length: one character takes the glyph's
// rung, a phrase longer than a word the rung under the word's.
function Part({ part, role = 'q' }) {
  if (part.jp) {
    const len = part.text.length
    const fit = len === 1 ? ' desk-spec__jp--glyph' : len > 4 ? ' desk-spec__jp--long' : ''
    return <span className={`desk-spec__jp desk-spec__${role}${fit}`} lang="ja">{part.text}</span>
  }
  return <span className={`desk-spec__latin desk-spec__${role}`}>{part.text}</span>
}

const Fold = () => <i className="desk-spec__fold" />
const Caret = () => <i className="desk-spec__caret" />

function Field({ text, tag = null, jp = false, caret = false }) {
  return (
    <span className="desk-spec__field">
      {tag && <span className="desk-spec__tag">{tag}</span>}
      <span className="desk-spec__typed" lang={jp ? 'ja' : undefined}>{text}</span>
      {caret && <Caret />}
    </span>
  )
}

// The run's gap: empty, holding its slot's width, or filled with what
// is typed in it (Construire).
function Hole({ text = null }) {
  return <span className={text ? 'desk-spec__hole desk-spec__hole--in' : 'desk-spec__hole'}>{text ?? '　　'}</span>
}

// The ladder's walk (srs/ladder.py): Choisir three times, Construire
// four, then mastered -- the rung a point starts on lit.
const WALK = [['lineChoose', 3], ['lineBuild', 4]]

function Walk() {
  const { t } = useLang()
  let step = 0
  return (
    <span className="desk-spec__walk">
      {WALK.map(([name, n]) => (
        <span key={name} className="desk-spec__stage">
          <span className="desk-spec__dots">
            {Array.from({ length: n }, () => step++).map(i => (
              <i key={i} className={i === 0 ? 'desk-spec__dot desk-spec__dot--now' : 'desk-spec__dot'} />
            ))}
          </span>
          <span className="desk-spec__stagename">{t[name]}</span>
        </span>
      ))}
      <span className="desk-spec__stage">
        <span className="desk-spec__star">★</span>
        <span className="desk-spec__stagename">{t.lineMastered}</span>
      </span>
    </span>
  )
}

function Face({ spec }) {
  const { t } = useLang()
  switch (spec.kind) {
    case 'pair':
      return (
        <>
          <Part part={spec.q} />
          <Fold />
          {spec.tag
            ? <span className="desk-spec__pair"><span className="desk-spec__tag">{t[spec.tag]}</span><Part part={spec.a} role="a" /></span>
            : <Part part={spec.a} role="a" />}
        </>
      )
    case 'type':
      return <><Part part={spec.q} /><Field text={spec.typed} caret /></>
    case 'readings':
      return (
        <>
          <Part part={spec.q} />
          <span className="desk-spec__fields">
            {spec.on && <Field text={spec.on} tag={t.readingsOnTag} jp caret={!spec.kun} />}
            {spec.kun && <Field text={spec.kun} tag={t.readingsKunTag} jp caret />}
          </span>
        </>
      )
    case 'draw':
      return (
        <>
          <Part part={spec.q} />
          <span className="desk-spec__slab"><span className="desk-spec__ghost" lang="ja">{spec.ghost}</span></span>
        </>
      )
    case 'sentence': {
      const at = spec.point ? spec.sentence.indexOf(spec.point) : -1
      return (
        <>
          <span className="desk-spec__sentence" lang="ja">
            {at < 0 ? spec.sentence : (
              <>
                {spec.sentence.slice(0, at)}
                <span className="desk-spec__mark">{spec.point}</span>
                {spec.sentence.slice(at + spec.point.length)}
              </>
            )}
          </span>
          <Fold />
          <span className="desk-spec__pair">
            <Part part={spec.a} role="a" />
            {spec.gloss && <span className="desk-spec__gloss">{spec.gloss}</span>}
          </span>
        </>
      )
    }
    case 'blank':
      return (
        <>
          <span className="desk-spec__sentence" lang="ja">{spec.before}<Hole />{spec.after}</span>
          <span className="desk-spec__tiles">
            {spec.choices.map((c, i) => (
              <span key={c} className="desk-spec__tile"><b>{i + 1}</b><span lang="ja">{bare(c)}</span></span>
            ))}
          </span>
          {spec.walk && <Walk />}
        </>
      )
    case 'build': {
      const typed = spec.pieces.find(p => p.gap)?.gap
      return (
        <>
          <span className="desk-spec__sentence" lang="ja">
            {spec.pieces.map((p, i) => (p.gap ? <Hole key={i} text={p.gap} /> : <Fragment key={i}>{p.text}</Fragment>))}
          </span>
          {spec.tr && <span className="desk-spec__tr">{spec.tr}</span>}
          <Field text={typed} jp caret />
        </>
      )
    }
    case 'write':
      return (
        <>
          <span className="desk-spec__situation">{spec.situation}</span>
          <span className="desk-spec__helpers">
            <span className="desk-spec__chip desk-spec__chip--point" lang="ja">{spec.point}</span>
            {spec.helpers.map(h => (
              <span key={h.text} className="desk-spec__chip" lang="ja">
                {h.reading ? <ruby>{h.text}<rt>{h.reading}</rt></ruby> : h.text}
              </span>
            ))}
          </span>
          <Field text={spec.typed} jp caret />
        </>
      )
    default:
      return null
  }
}
