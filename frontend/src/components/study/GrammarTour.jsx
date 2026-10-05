import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { track } from '../../lib/track'
import { playClick, playUi } from '../../lib/audio'
import { GateButton } from '../ui/GateButton'
import { CheckIcon } from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { LessonInline } from './GrammarLesson'
import { FuriganaParts } from './Readings'

// ── 発見 — a grammar point found before it is drilled (plan 187b) ──
// The owner's pick of the canvas "Tsuji — grammar, learned by doing":
// the lesson the gate printed (plan 087) was a lump to read once, so a
// never-met point is now ASKED. Three of its own examples with the
// point lit; a guess at what it does, a wrong one answered by the
// lesson's own line for that rival and a hint after one miss, the rule
// given after two; the rule as confirmation; then the terminus, with
// the full lesson a quiet way over the gate. The twist and the scene
// (plans 187c–d) join the line when the point carries them.
//
// The boarding's frame inside a run's stage: a track of stops at the
// head (in the line's pigment -- where you are keeps the line's
// colour, DESIGN.md, "One metal, one selection"), the stop over its
// drawing, and the gate at the foot with a quiet way over it, never
// under (plan 168). The tour grades no card (plan 187, Q1): `onBoard`
// hands the run what it took, and the run's first exercise follows.
//
// `point` is the gate's (the card's identity over its lesson), carrying
// `tour` from study/grammar_tour.py.
const MAX_MISSES = 2

function stopsOf(tour) {
  return ['look', 'guess', 'found', tour.twist && 'twist', tour.scene && 'scene', 'terminus'].filter(Boolean)
}

/** A question with the pattern in it set as Japanese, in the line's ink. */
function Ask({ text, pattern, className = 'tour__q' }) {
  const at = text.indexOf(pattern)
  const body = at < 0
    ? text
    : <>{text.slice(0, at)}<span className="tour-pattern" lang="ja">{pattern}</span>{text.slice(at + pattern.length)}</>
  return <h2 className={className} tabIndex={-1}>{body}</h2>
}

function Pattern({ point }) {
  return (
    <span className="tour-pattern" lang="ja">
      {point.pattern_furigana?.length ? <FuriganaParts parts={point.pattern_furigana} /> : point.pattern}
    </span>
  )
}

function Track({ at, total }) {
  const { t } = useLang()
  const pos = n => (total > 1 ? (n / (total - 1)) * 100 : 0)
  return (
    <div
      className="tour__track"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={at + 1}
      aria-label={t.onbStepsAria(at + 1, total)}
    >
      <div className="tour__rail" />
      <div className="tour__done" style={{ width: `${pos(at)}%` }} />
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`tour__stop tour__stop--${i < at ? 'passed' : i === at ? 'here' : 'ahead'}`}
          style={{ left: `${pos(i)}%` }}
        />
      ))}
    </div>
  )
}

function Mark({ kind }) {
  return (
    <span className={`tour-said__mark tour-said__mark--${kind}`} aria-hidden="true">
      {kind === 'ok'
        ? <CheckIcon size={14} />
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>}
    </span>
  )
}

/** What the tour says back: a verdict over its line. */
function Said({ kind, head, children }) {
  return (
    <div className={`tour-said tour-said--${kind}`} role="status">
      <Mark kind={kind === 'no' ? 'no' : 'ok'} />
      <div className="tour-said__text">
        <p className="tour-said__head">{head}</p>
        {children}
      </div>
    </div>
  )
}

function Look({ tour, point }) {
  const { t } = useLang()
  return (
    <>
      <Ask text={t.tourLookQ(point.pattern)} pattern={point.pattern} />
      <p className="tour__hint">{t.tourLookHint(tour.look.length)}</p>
      <div className="tour-card tour-look">
        {tour.look.map((ex, i) => (
          <ExampleSentence key={ex.jp} ex={{ ...ex, segments: ex.furigana }} senseNumber={i + 1} />
        ))}
      </div>
    </>
  )
}

function Guess({ tour, point, pick, wrong, given, onPick }) {
  const { t } = useLang()
  const last = wrong.length ? tour.guesses[wrong[wrong.length - 1]] : null
  return (
    <>
      <Ask text={t.tourGuessQ(point.pattern)} pattern={point.pattern} />
      <div className="tour-card tour-look tour-look--mini" aria-hidden="true">
        {tour.look.map(ex => (
          <ExampleSentence key={ex.jp} ex={{ ...ex, segments: ex.furigana }} />
        ))}
      </div>
      <div className="tour-guesses" role="radiogroup" aria-label={t.tourGuessQ(point.pattern)}>
        {tour.guesses.map((g, i) => {
          const no = wrong.includes(i)
          const ok = given && g.correct
          const state = ok ? 'ok' : no ? 'no' : pick === i ? 'sel' : 'idle'
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={pick === i}
              className={`tour-guess tour-guess--${state}`}
              disabled={no || given}
              onClick={() => { playClick(); onPick(i) }}
              data-guess={i}
            >
              <span className="tour-guess__key" aria-hidden="true">{i + 1}</span>
              <span className="tour-guess__text">{g.text}</span>
              {(ok || no) && <Mark kind={ok ? 'ok' : 'no'} />}
            </button>
          )
        })}
      </div>
      {given && (
        <Said kind="given" head={t.tourGiven}>
          <p className="tour-said__line">{t.tourGivenNote}</p>
        </Said>
      )}
      {!given && last && (
        <Said kind="no" head={t.tourThatIs(last.pattern)}>
          <p className="tour-said__line"><LessonInline text={last.answer ?? t.tourNotThis} /></p>
          {wrong.length >= 1 && <p className="tour-said__hint">{t.tourHint}</p>}
        </Said>
      )}
    </>
  )
}

function Found({ tour, point, misses, helped }) {
  const { t } = useLang()
  return (
    <>
      {!helped && <Said kind="ok" head={t.tourFound(misses)} />}
      <div className="tour-card tour-rule">
        <p className="tour-rule__text"><LessonInline text={tour.rule ?? point.meaning} /></p>
        {tour.chain
          ? (
            <p className="tour-chain" lang="ja">
              <span className="tour-chain__from">{tour.chain[0]}</span>
              <span className="tour-chain__arrow" aria-hidden="true">→</span>
              <span className="tour-chain__to">{tour.chain[1]}</span>
            </p>
          )
          : tour.structure && <p className="tour-rule__structure" lang="ja">{tour.structure}</p>}
      </div>
    </>
  )
}

function Terminus({ tour, point }) {
  const { t } = useLang()
  const first = tour.look[0]
  return (
    <>
      <div className="tour-head">
        <Pattern point={point} />
        <h2 className="tour__q tour__q--name" tabIndex={-1}>{t.tourTerminus}</h2>
      </div>
      <ol className="tour-card tour-found">
        <li className="tour-found__line">
          <span className="tour-found__n">1</span>
          <div className="tour-found__body">
            <p className="tour-found__say"><LessonInline text={tour.rule ?? point.meaning} /></p>
            {first && <ExampleSentence ex={{ ...first, segments: first.furigana }} showTr={false} />}
          </div>
        </li>
        {tour.rival && (
          <li className="tour-found__line">
            <span className="tour-found__n">2</span>
            <div className="tour-found__body">
              <p className="tour-found__say tour-found__say--rival" lang="ja">{t.tourNotLike(tour.rival.pattern)}</p>
              <p className="tour-found__line-text"><LessonInline text={tour.rival.text} /></p>
            </div>
          </li>
        )}
      </ol>
    </>
  )
}

export function GrammarTour({ point, onBoard, onLesson }) {
  const { t } = useLang()
  const tour = point.tour
  const stops = stopsOf(tour)
  const [at, setAt] = useState(0)
  const [pick, setPick] = useState(null)
  const [wrong, setWrong] = useState([])
  const [helped, setHelped] = useState(false)
  const bodyRef = useRef(null)
  const stop = stops[at]
  const level = point.level

  // A new stop opens at its top, its question in focus.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.scrollTop = 0
    body.querySelector('.tour__q')?.focus({ preventScroll: true })
  }, [at])

  function go(outcome) {
    track('grammar_tour_step', { level, stop, outcome })
    playUi('click-screen-selection')
    setAt(i => i + 1)
  }

  function check() {
    const g = tour.guesses[pick]
    if (g?.correct) {
      go(wrong.length ? 'retry' : 'first')
      return
    }
    const next = [...wrong, pick]
    setWrong(next)
    setPick(null)
    if (next.length >= MAX_MISSES) setHelped(true)
  }

  function board() {
    track('grammar_tour_done', { level, tries: wrong.length, helped, authored: Boolean(tour.twist || tour.scene) })
    playUi('click-screen-selection')
    onBoard?.({ tries: wrong.length, helped })
  }

  let gate
  if (stop === 'look') gate = <GateButton label={t.tourIdea} onClick={() => go('first')} data-action="continue" />
  else if (stop === 'guess' && helped) gate = <GateButton label={t.onbContinue} onClick={() => go('helped')} data-action="continue" />
  else if (stop === 'guess') gate = <GateButton label={t.tourCheck} onClick={check} disabled={pick == null} data-action="check" />
  else if (stop === 'terminus') gate = <GateButton label={t.tourBoard} onClick={board} data-action="board" />
  else gate = <GateButton label={t.onbContinue} onClick={() => go('first')} data-action="continue" />

  return (
    <section className="tour" data-stop={stop} aria-label={t.tourAria(point.pattern)}>
      <Track at={at} total={stops.length} />
      <div className="tour__body" ref={bodyRef} key={stop}>
        {stop === 'look' && <Look tour={tour} point={point} />}
        {stop === 'guess' && (
          <Guess tour={tour} point={point} pick={pick} wrong={wrong} given={helped} onPick={setPick} />
        )}
        {stop === 'found' && <Found tour={tour} point={point} misses={wrong.length} helped={helped} />}
        {stop === 'terminus' && <Terminus tour={tour} point={point} />}
      </div>
      <div className="tour__foot">
        {stop === 'terminus' && onLesson && (
          <button type="button" className="brd__link" onClick={() => { playClick(); onLesson() }} data-action="lesson">
            {t.tourReadLesson}
          </button>
        )}
        {gate}
      </div>
    </section>
  )
}
