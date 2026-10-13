import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { track } from '../../lib/track'
import { playClick, playUi, speakLine, stopSpeaking } from '../../lib/audio'
import { GateButton } from '../ui/GateButton'
import { CheckIcon, SpeakerIcon } from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { LessonInline } from './GrammarLesson'
import { FuriganaParts } from './Readings'
import { quizScore, stopKind, stopsOf, twistIndex, twistsOf } from '../../domain/tourStops'
import { bare } from '../../domain/ladderLine'
import { PICK_KEY_DIGIT } from '../../domain/choiceKeys'
import { dialogOpen } from '../../lib/dialogOpen'
import { composing, pressedByPointer, trackPresses } from '../../lib/keyGuards'
import { tourAsk } from '../../domain/ask'
import { AskEntry } from './AskPage'

// ── 発見 — a grammar point found before it is drilled (plan 187b) ──
// The owner's pick of the canvas "Tsuji — grammar, learned by doing":
// the lesson the gate printed (plan 087) was a lump to read once, so a
// never-met point is now ASKED. Three of its own examples with the
// point lit; a guess at what it does, a wrong one answered by the
// lesson's own line for that rival and a hint after one miss, the rule
// given after two; the rule as confirmation; then the terminus, with
// the full lesson a quiet way over the gate. Where the point's tour is
// written (plan 187c), its stops join before the terminus (187d): the
// twists -- one per notion the point has beyond the meaning the guess
// asks (plan 189): a second use, a sense, a form, its rival, each named
// over its question and two readings of it, its translation said once
// it is answered (plan 196) -- the scene, a few voiced lines at a station
// place, then the learner's own line chosen from three, and the quiz.
//
// The boarding's frame inside a run's stage: a track of stops at the
// head (in the line's pigment -- where you are keeps the line's
// colour, DESIGN.md, "One metal, one selection"), the stop over its
// drawing, and the gate at the foot with a quiet way over it, never
// under (plan 168). The tour grades no card (plan 187, Q1): `onBoard`
// hands the run what it took, and the run's first exercise follows.
//
// 一枚 — one card a stop (plan 206, the owner's pick B of the canvas
// "Tsuji — the tour, fuller"): the stops hung from the head in boxes of
// one weight and left the screen's middle empty. Each stop is now one
// card, as the run's own card is, that takes the room between the track
// and the gate: the question at its head, what it asks about in its
// middle -- a sentence centred at the practice card's size, the point
// itself once found -- and what the tour says back at its foot. The
// choices stand under it as the exam's tiles, a row of them where every
// one is short.
//
// `point` is the gate's (the card's identity over its lesson), carrying
// `tour` from study/grammar_tour.py.
const MAX_MISSES = 2

/** A line said aloud, from the server (lib/audio's speakLine): the
    reader's voice for an example, the scene's two voices for its lines. */
function Speak({ text, who = 'reader', onSpeak }) {
  const { t } = useLang()
  return (
    <button type="button" className="tour-speak" aria-label={t.listen} onClick={() => { onSpeak?.(); speakLine(text, who) }} data-action="speak">
      <SpeakerIcon size={20} />
    </button>
  )
}

// A choice short enough to stand in a row of tiles: a form (と, や, か)
// or a word or two, never a sentence.
const SHORT = { ja: 6, text: 10 }

/** Choices that are checked once: the pick in gold, then the right one
    ringed and a wrong pick crossed, the why said under them. Where every
    one is short they stand in a row, four as two by two (plan 206). */
function Choices({ items, pick, done, onPick, label, ja = false }) {
  const { t } = useLang()
  const trapLabel = t.tourTrap
  const row = items.every(c => [...(ja ? c.jp ?? '' : c.text ?? '')].length <= (ja ? SHORT.ja : SHORT.text))
  return (
    <div
      className={`tour-guesses${row ? ' tour-guesses--row' : ''}`}
      style={row ? { '--tour-cols': items.length === 4 ? 2 : items.length } : undefined}
      role="radiogroup"
      aria-label={label}
    >
      {items.map((c, i) => {
        const ok = done && c.correct
        const no = done && pick === i && !c.correct
        const state = ok ? 'ok' : no ? 'no' : pick === i ? 'sel' : 'idle'
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={pick === i}
            className={`tour-guess tour-guess--${state}`}
            disabled={done}
            onClick={() => { playClick(); onPick(i) }}
            data-choice={i}
          >
            <span className="tour-guess__key" aria-hidden="true">{i + 1}</span>
            {ja
              ? <span className="tour-guess__text tour-guess__text--ja" lang="ja">{c.jp}</span>
              : <span className="tour-guess__text">{c.text}</span>}
            {done && c.trap && <span className="tour-trap">{trapLabel}</span>}
            {(ok || no) && <Mark kind={ok ? 'ok' : 'no'} />}
          </button>
        )
      })}
    </div>
  )
}

const JA_RUN = /([぀-ヿ一-鿿々〜ー]+(?:[、。？！][぀-ヿ一-鿿々〜ー]+)*[、。？！]?)/

/** A question as the author wrote it, its Japanese set as Japanese: the
    browser cuts a run it takes for French anywhere (しゅ / くだい), and
    breaks a run it knows is Japanese between its phrases (plan 196). */
function Mixed({ text }) {
  return text.split(JA_RUN).map((part, i) => (i % 2 ? <span key={i} lang="ja">{part}</span> : part))
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
    <div className="tour-leaf">
      <header className="tour-leaf__head">
        <Ask text={t.tourLookQ(point.pattern)} pattern={point.pattern} />
        <p className="tour__hint">{t.tourLookHint(tour.look.length)}</p>
      </header>
      <div className="tour-leaf__mid tour-look">
        {tour.look.map((ex, i) => (
          <div key={ex.jp} className="tour-ex">
            <ExampleSentence ex={{ ...ex, segments: ex.furigana }} senseNumber={i + 1} />
            <Speak text={ex.jp} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Guess({ tour, point, pick, wrong, given, onPick }) {
  const { t } = useLang()
  const last = wrong.length ? tour.guesses[wrong[wrong.length - 1]] : null
  return (
    <>
      <div className="tour-leaf">
        <header className="tour-leaf__head">
          <Ask text={t.tourGuessQ(point.pattern)} pattern={point.pattern} />
        </header>
        <div className="tour-leaf__mid tour-look tour-look--mini" aria-hidden="true">
          {tour.look.map(ex => (
            <ExampleSentence key={ex.jp} ex={{ ...ex, segments: ex.furigana }} />
          ))}
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
    </>
  )
}

/** The rule found: the card turns to the point, as a flashcard turns to
    its answer -- what happened at its head, the point over its shape
    and the rule in its middle, its first example at its foot. */
function Found({ tour, point, misses, helped }) {
  const { t } = useLang()
  const first = tour.look[0]
  return (
    <div className="tour-leaf tour-leaf--found">
      <header className="tour-leaf__head">
        {helped
          ? <p className="tour-verdict tour-verdict--given">{t.tourGiven}</p>
          : <p className="tour-verdict tour-verdict--ok"><Mark kind="ok" />{t.tourFound(misses)}</p>}
      </header>
      <div className="tour-leaf__mid">
        <Pattern point={point} />
        {tour.chain
          ? (
            <p className="tour-chain" lang="ja">
              <span className="tour-chain__from">{tour.chain[0]}</span>
              <span className="tour-chain__arrow" aria-hidden="true">→</span>
              <span className="tour-chain__to">{tour.chain[1]}</span>
            </p>
          )
          : tour.structure && <p className="tour-leaf__structure" lang="ja">{tour.structure}</p>}
        <h2 className="tour__q tour-leaf__rule" tabIndex={-1}><LessonInline text={tour.rule ?? point.meaning} /></h2>
      </div>
      <div className="tour-leaf__foot tour-ex">
        <ExampleSentence ex={{ ...first, segments: first.furigana }} />
        <Speak text={first.jp} />
      </div>
    </div>
  )
}

/** « C'est pas tout ! » (plan 194): one usage at a time -- the sentence,
    two readings, then the why and the sentence's translation, said once it
    is answered: printed under the sentence it was the answer to « que dit
    la phrase ? » (plan 196). A trap (the rival set against the point) says
    so beside its notion. */
function Twist({ twist, n, total, pick, done, onPick }) {
  const { t } = useLang()
  const right = twist.choices.find(c => c.correct)
  const picked = pick != null ? twist.choices[pick] : null
  return (
    <>
      <div className="tour-leaf">
        <header className="tour-leaf__head">
          <p className="tour__notion">
            <span className="tour__notion-head">{t.tourUsageHead}</span>
            {twist.notion && <span className="tour__notion-name">{twist.notion}</span>}
            {twist.kind === 'trap' && <span className="tour-trap">{t.tourTrap}</span>}
            {total > 1 && <span className="tour__notion-count">{t.tourNotionCount(n + 1, total)}</span>}
          </p>
          <h2 className="tour__q" tabIndex={-1}><Mixed text={twist.ask} /></h2>
        </header>
        <div className="tour-leaf__corner"><Speak text={twist.jp} /></div>
        <div className="tour-leaf__mid tour-leaf__mid--spec tour-twist">
          <ExampleSentence ex={{ jp: twist.jp, tr: twist.tr, segments: twist.furigana }} showTr={done && Boolean(twist.tr)} />
        </div>
        {done && (
          <Said kind={picked?.correct ? 'ok' : 'no'} head={picked?.correct ? t.tourRight : `${t.tourNotQuite} ${right.text}`}>
            <p className="tour-said__line"><LessonInline text={twist.why} /></p>
            {twist.pair && (
              <p className="tour-pair" lang="ja">
                <span>{twist.pair[0]}</span>
                <span className="tour-pair__bar" aria-hidden="true">／</span>
                <span>{twist.pair[1]}</span>
              </p>
            )}
          </Said>
        )}
      </div>
      <Choices items={twist.choices} pick={pick} done={done} onPick={onPick} label={twist.ask} />
    </>
  )
}

/** One line of a scene: who says it, what, its translation, its voice. */
function SceneLine({ line, them, onSpeak }) {
  const { t } = useLang()
  return (
    <li className={`tour-line tour-line--${line.who}`}>
      <span className="tour-line__who">{line.who === 'me' ? t.tourMe : them}</span>
      <div className="tour-line__text">
        <ExampleSentence ex={{ jp: line.jp, tr: line.tr, segments: line.furigana }} />
      </div>
      <Speak text={line.jp} who={line.who} onSpeak={onSpeak} />
    </li>
  )
}

function Scene({ scene, phase, pick, done, onPick }) {
  const { t } = useLang()
  const right = scene.ask.choices.find(c => c.correct)
  const picked = pick != null ? scene.ask.choices[pick] : null
  const [playingAll, setPlayingAll] = useState(false)
  // A run of the scene ends when another starts, a line is tapped alone
  // or the stop goes: a stopped line resolves as one that ended, so the
  // loop has to know it was cut rather than go on to the next.
  const run = useRef(0)
  useEffect(() => () => { run.current += 1 }, [])
  async function playAll() {
    const mine = ++run.current
    setPlayingAll(true)
    for (const line of scene.lines) {
      // Each line waits for the one before it; a line that cannot be
      // heard (no engine, muted) passes at once.
      await speakLine(line.jp, line.who)
      if (run.current !== mine) return
    }
    setPlayingAll(false)
  }
  const cut = () => { run.current += 1; setPlayingAll(false) }
  if (phase === 'watch') {
    return (
      <>
        <div className="tour-plate" aria-label={scene.place_caption}>
          <span className="tour-plate__name" lang="ja">
            {scene.place_reading ? <ruby>{scene.place}<rt>{scene.place_reading}</rt></ruby> : scene.place}
          </span>
          <span className="tour-plate__cap">{scene.place_caption}</span>
        </div>
        <div className="tour-leaf tour-leaf--scene">
          <ol className="tour-leaf__mid tour-scene">
            {scene.lines.map((line, i) => <SceneLine key={i} line={line} them={scene.them} onSpeak={cut} />)}
          </ol>
          <div className="tour-leaf__foot">
            <p className="tour-note"><LessonInline text={scene.note} /></p>
            <button type="button" className="brd__link tour-scene__all" onClick={() => { playClick(); playAll() }} disabled={playingAll} data-action="play-scene">
              {t.tourPlayScene}
            </button>
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="tour-leaf">
        <header className="tour-leaf__head">
          <h2 className="tour__q" tabIndex={-1}>{scene.ask.task}</h2>
        </header>
        <ol className="tour-leaf__mid tour-scene">
          <SceneLine line={scene.ask.cue} them={scene.them} />
        </ol>
        {done && (
          <Said kind={picked?.correct ? 'ok' : 'no'} head={picked?.correct ? t.tourRight : t.tourNotQuite}>
            {!picked?.correct && <p className="tour-said__line tour-said__line--ja" lang="ja">{right.jp}</p>}
            <p className="tour-said__line"><LessonInline text={scene.ask.why} /></p>
          </Said>
        )}
      </div>
      <Choices items={scene.ask.choices} pick={pick} done={done} onPick={onPick} label={scene.ask.task} ja />
    </>
  )
}

/** The quiz (plan 194, its questions written in plan 196): up to eight, one
    at a time, checked once, the why said under them. Four kinds, none of
    them a matter of finding the point's characters in a sentence:
    the gap (the point or a rival blanked from a sentence, told apart by
    what it says), the meaning (a sentence read with no translation under
    it until it is answered), the form (a sentence blanked over the form,
    what it says printed under it as the thing to say) and the reply
    (a situation, three Japanese lines). */
function QuizQuestion({ q, n, total, pick, done, onPick }) {
  const { t } = useLang()
  const picked = pick != null ? q.choices[pick] : null
  const right = q.choices.find(c => c.correct)
  let ask = q.ask
  let body = null
  let items = q.choices
  let ja = false
  if (q.kind === 'gap' || q.kind === 'form') {
    const answer = q.kind === 'gap' ? bare(right.pattern) : right.jp
    const segments = q.furigana.map(seg => (seg.blank ? { ...seg, answer } : seg))
    ask = q.kind === 'gap' ? t.tourQuizGap : q.ask
    body = (
      <div className="tour-leaf__mid tour-leaf__mid--spec tour-twist">
        <ExampleSentence ex={{ jp: q.jp, tr: q.tr, segments }} showTr revealed={done} blankLabel={t.glBlank} />
      </div>
    )
    if (q.kind === 'gap') items = q.choices.map(c => ({ ...c, jp: bare(c.pattern) }))
    ja = true
  } else if (q.kind === 'use') {
    ja = true
  } else {
    body = (
      <>
        <div className="tour-leaf__corner"><Speak text={q.jp} /></div>
        <div className="tour-leaf__mid tour-leaf__mid--spec tour-twist">
          <ExampleSentence ex={{ jp: q.jp, tr: q.tr, segments: q.furigana }} showTr={done && Boolean(q.tr)} />
        </div>
      </>
    )
  }
  // A reply's situation has no sentence to show: it is what the card's
  // middle holds, the caption alone at its head.
  const question = <h2 className="tour__q" tabIndex={-1}><Mixed text={ask} /></h2>
  return (
    <>
      <div className="tour-leaf">
        <header className="tour-leaf__head">
          <p className="tour__notion">
            <span className="tour__notion-head">{t.tourQuizKinds[q.kind]}</span>
            <span className="tour__notion-count">{t.tourQuizCount(n + 1, total)}</span>
          </p>
          {body && question}
        </header>
        {body ?? <div className="tour-leaf__mid tour-leaf__mid--spec">{question}</div>}
        {done && (
          <Said kind={picked?.correct ? 'ok' : 'no'} head={picked?.correct ? t.tourRight : t.tourNotQuite}>
            {q.why && <p className="tour-said__line"><LessonInline text={q.why} /></p>}
          </Said>
        )}
      </div>
      <Choices items={items} pick={pick} done={done} onPick={onPick} label={ask} ja={ja} />
    </>
  )
}

/** The score as a dial (plan 195): one arc a question round the figure,
    in the success ink when it was right and the miss's when it was not.
    The ring is the roundel's idiom (PointLine, DESIGN.md, "Colour is an
    edge, a ring, or a numeral"). */
function Tally({ marks, right, total }) {
  const { t } = useLang()
  const r = 40
  const round = 2 * Math.PI * r
  const gap = total > 1 ? 6 : 0
  const arc = round / total - gap
  return (
    <div className="tour-tally" role="img" aria-label={t.tourScore(right, total)}>
      <svg className="tour-tally__dial" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
        {marks.map((ok, i) => (
          <circle
            key={i}
            cx="48" cy="48" r={r}
            className={`tour-tally__arc${ok == null ? '' : ok ? ' tour-tally__arc--ok' : ' tour-tally__arc--no'}`}
            strokeDasharray={`${arc} ${round}`}
            transform={`rotate(${-90 + (i * 360) / total + (gap / round) * 180} 48 48)`}
          />
        ))}
      </svg>
      <p className="tour-score" aria-hidden="true">
        <span className="tour-score__right">{right}</span>
        <span className="tour-score__of">/ {total}</span>
      </p>
    </div>
  )
}

/** A question again on the results: its sentence with the right form in
    it, and for a miss what was taken, struck. */
function Recap({ q, pick }) {
  const { t } = useLang()
  const right = q.choices.find(c => c.correct)
  const taken = pick != null ? q.choices[pick] : null
  const ok = Boolean(taken?.correct)
  let said
  let fix = null
  if (q.kind === 'use') {
    said = <FuriganaParts parts={right.furigana?.length ? right.furigana : [{ text: right.jp }]} />
    if (!ok && taken) fix = taken.jp
  } else if (q.kind === 'gap' || q.kind === 'form') {
    const form = q.kind === 'gap' ? bare(right.pattern) : right.jp
    said = q.furigana.map((seg, i) => (seg.blank
      ? <b key={i} className="tour-recap__form">{form}</b>
      : <FuriganaParts key={i} parts={[seg]} />))
    if (!ok && taken) fix = q.kind === 'gap' ? bare(taken.pattern) : taken.jp
  } else {
    said = <FuriganaParts parts={q.furigana?.length ? q.furigana : [{ text: q.jp }]} />
    if (!ok && taken) fix = taken.text
  }
  return (
    <>
      <Mark kind={ok ? 'ok' : 'no'} />
      <span className="tour-recap__jp" lang="ja">{said}</span>
      <span className="tour-recap__kind">{t.tourQuizKinds[q.kind]}</span>
      {fix && <s className="tour-recap__fix" lang={q.kind === 'meaning' ? undefined : 'ja'}>{fix}</s>}
    </>
  )
}

/** The results (plan 194, redrawn in plan 195; one card since plan 206):
    the score as a dial over the point, each question again with how it
    went at the card's foot, and the point's sheet; the gate starts
    Choisir 1. */
export function Results({ tour, point, picks, onLesson, replay }) {
  const { t } = useLang()
  const quiz = tour.quiz ?? []
  const { right, total } = quizScore(tour, picks)
  const marks = quiz.map((q, i) => (picks?.[i] == null ? null : Boolean(q.choices[picks[i]]?.correct)))
  return (
    <>
      <h2 className="tour__q sr-only" tabIndex={-1}>{t.tourResults}</h2>
      <div className="tour-leaf tour-leaf--end">
        <header className="tour-leaf__mid tour-end">
          {total > 0 && <Tally marks={marks} right={right} total={total} />}
          <Pattern point={point} />
          {point.structure && <p className="tour-end__structure">{point.structure}</p>}
        </header>
        {total > 0 && (
          <ol className="tour-leaf__foot tour-recap">
            {quiz.map((q, i) => {
              const ok = marks[i]
              return (
                <li key={i} className={`tour-recap__row tour-recap__row--${ok ? 'ok' : 'no'}`}>
                  <Recap q={q} pick={picks?.[i]} />
                </li>
              )
            })}
          </ol>
        )}
      </div>
      {onLesson && !replay && (
        <button type="button" className="tour-sheet" onClick={() => { playClick(); onLesson() }} data-action="lesson">
          <span className="tour-sheet__pattern" lang="ja">{point.pattern}</span>
          <span className="tour-sheet__name">{t.tourSheet}</span>
          <span className="tour-sheet__go" aria-hidden="true">→</span>
        </button>
      )}
    </>
  )
}

// The keys on the desk (plan 187f), as the boarding's (hooks/useBoardKeys):
// Enter presses the gate, a digit the tile it numbers -- a guess, the
// twist's or the scene's choices -- on either keyboard row. Nothing on
// the panels names them (the owner's word). Not from a field, a
// composing input method, a dialog or a control the keyboard is on,
// which keeps its own Enter -- except one the pointer just pressed,
// where Enter would press it again.
function useTourKeys(ref, on) {
  useEffect(() => {
    if (!on) return undefined
    trackPresses()
    const onKey = e => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || composing(e) || dialogOpen()) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      const root = ref.current
      if (!root) return
      const digit = PICK_KEY_DIGIT[e.key]
      if (digit !== undefined) {
        const tile = root.querySelector(`.tour__body [data-guess="${digit - 1}"], .tour__body [data-choice="${digit - 1}"]`)
        if (!tile || tile.disabled) return
        e.preventDefault()
        tile.click()
        return
      }
      if (e.key !== 'Enter' || e.shiftKey) return
      const control = target?.closest('button, a[href], summary')
      if (control && !pressedByPointer(control)) return
      const gate = root.querySelector('.tour__foot .btn-depart')
      if (!gate || gate.disabled) return
      e.preventDefault()
      gate.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref, on])
}

// `replay` (plan 187e, the plate's two ghosts): the tour run again from
// the lesson, from its start or `startAt` a stop (the scene). A replay
// records nothing -- no event, no record, no card (plan 187, Q4) -- and
// its terminus goes back to the lesson rather than boarding a card.
// `desk` (plan 187f): the tour as the middle of the run's three panels.
// Its stops are the left panel's and its plate the right's
// (TourPanels.jsx), so the track is not drawn here; `onView` hands the
// run what both need to know of where the tour stands.
// `ask` (plan 204): the run's useAsk, for 問 -- a short question about
// the stop, once its question is answered (domain/ask's tourAsk). On a
// phone the stop carries the button to the asking's page (AskEntry); on
// the desk the panel stands under the stops at the left (TourRoute),
// which reads the thread from `onView`. A replay asks nothing.
export function GrammarTour({ point, onBoard, onLesson, replay = false, startAt = null, desk = false, onView, ask = null }) {
  const { t } = useLang()
  const tour = point.tour
  const stops = stopsOf(tour)
  const [at, setAt] = useState(() => Math.max(0, stops.indexOf(startAt)))
  const [pick, setPick] = useState(null)
  const [wrong, setWrong] = useState([])
  const [helped, setHelped] = useState(false)
  // Each twist and the scene's ask are checked once each.
  const twists = twistsOf(tour)
  const [twistPicks, setTwistPicks] = useState(() => twists.map(() => null))
  const [twistsDone, setTwistsDone] = useState(() => twists.map(() => false))
  const quiz = tour.quiz ?? []
  const [qi, setQi] = useState(0)
  const [quizPicks, setQuizPicks] = useState(() => quiz.map(() => null))
  const [quizDone, setQuizDone] = useState(() => quiz.map(() => false))
  const [phase, setPhase] = useState('watch')
  const [scenePick, setScenePick] = useState(null)
  const [sceneDone, setSceneDone] = useState(false)
  const bodyRef = useRef(null)
  const rootRef = useRef(null)
  useTourKeys(rootRef, desk)
  const stop = stops[at]
  const kind = stopKind(stop)
  const ti = twistIndex(stop)
  const twist = ti >= 0 ? twists[ti] : null
  const twistPick = ti >= 0 ? twistPicks[ti] : null
  const twistDone = ti >= 0 && twistsDone[ti]
  const setTwistPick = i => setTwistPicks(p => p.map((v, j) => (j === ti ? i : v)))
  const level = point.level
  const asked = tourAsk(point, {
    stop, twist, twistPick, twistDone, sceneDone, scenePick,
    qi, quizPick: quizPicks[qi], quizDone: quizDone[qi],
  })

  // A new stop opens at its top, its question in focus.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.scrollTop = 0
    body.querySelector('.tour__q')?.focus({ preventScroll: true })
  }, [at, phase, qi])

  // What the desk's two panels read (plan 187f): the stop in hand and
  // how each one went so far.
  const twistsRight = twists.map((tw, i) => (twistsDone[i] ? Boolean(tw.choices[twistPicks[i]]?.correct) : null))
  const twistsKey = twistsRight.join(',')
  const sceneRight = sceneDone ? Boolean(tour.scene?.ask.choices[scenePick]?.correct) : null
  const score = quizScore(tour, quizPicks.map((p, i) => (quizDone[i] ? p : null)))
  const answeredQuiz = quizDone.filter(Boolean).length
  useEffect(() => {
    onView?.({ at, misses: wrong.length, helped, twists: twistsRight, scene: sceneRight,
               quiz: quiz.length ? { right: score.right, answered: answeredQuiz, total: quiz.length } : null,
               ask: ask && !replay ? asked : null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reported on what it says, not on the callback's identity.
  }, [at, wrong.length, helped, twistsKey, sceneRight, score.right, answeredQuiz, asked.key, asked.open])

  // Nothing goes on talking once the tour has moved on or closed.
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => { stopSpeaking() }, [at])

  function go(outcome) {
    if (!replay) track('grammar_tour_step', { level, stop: kind, outcome })
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

  function checkScene() {
    setSceneDone(true)
    const reply = tour.scene.ask.choices[scenePick]
    // The learner's line, heard in their own voice once it is said.
    if (reply?.correct) speakLine(reply.jp, 'me')
  }

  function board() {
    if (!replay) track('grammar_tour_done', { level, tries: wrong.length, helped, authored: Boolean(twists.length || tour.scene) })
    playUi('click-screen-selection')
    onBoard?.({ tries: wrong.length, helped, quizRight: quiz.length ? score.right : null, quizTotal: quiz.length || null })
  }

  let gate
  if (stop === 'look') gate = <GateButton label={t.tourIdea} onClick={() => go('first')} data-action="continue" />
  else if (stop === 'guess' && helped) gate = <GateButton label={t.onbContinue} onClick={() => go('helped')} data-action="continue" />
  else if (stop === 'guess') gate = <GateButton label={t.tourCheck} onClick={check} disabled={pick == null} data-action="check" />
  else if (kind === 'twist' && !twistDone) gate = <GateButton label={t.tourCheck} onClick={() => setTwistsDone(d => d.map((v, j) => v || j === ti))} disabled={twistPick == null} data-action="check" />
  else if (kind === 'twist') gate = <GateButton label={t.onbContinue} onClick={() => go(twist.choices[twistPick]?.correct ? 'first' : 'retry')} data-action="continue" />
  else if (stop === 'scene' && phase === 'watch') gate = <GateButton label={t.tourYourTurn} onClick={() => { playUi('click-screen-selection'); setPhase('ask') }} data-action="your-turn" />
  else if (stop === 'scene' && !sceneDone) gate = <GateButton label={t.tourCheck} onClick={checkScene} disabled={scenePick == null} data-action="check" />
  else if (stop === 'scene') gate = <GateButton label={t.onbContinue} onClick={() => go(tour.scene.ask.choices[scenePick]?.correct ? 'first' : 'retry')} data-action="continue" />
  else if (stop === 'quiz' && !quizDone[qi]) gate = <GateButton label={t.tourCheck} onClick={() => setQuizDone(d => d.map((v, j) => v || j === qi))} disabled={quizPicks[qi] == null} data-action="check" />
  else if (stop === 'quiz' && qi < quiz.length - 1) gate = <GateButton label={t.onbContinue} onClick={() => { playUi('click-screen-selection'); setQi(i => i + 1) }} data-action="continue" />
  else if (stop === 'quiz') gate = <GateButton label={t.onbContinue} onClick={() => go(score.right === quiz.length ? 'first' : 'retry')} data-action="continue" />
  else if (stop === 'terminus') gate = <GateButton label={replay ? t.tourBackToLesson : t.tourStart} onClick={board} data-action="board" />
  else gate = <GateButton label={t.onbContinue} onClick={() => go('first')} data-action="continue" />

  return (
    <section ref={rootRef} className={`tour${desk ? ' tour--desk' : ''}`} data-stop={kind} data-twist={ti >= 0 ? ti : undefined} aria-label={t.tourAria(point.pattern)}>
      {!desk && <Track at={at} total={stops.length} />}
      <div className="tour__body" ref={bodyRef} key={`${stop}:${stop === 'scene' ? phase : stop === 'quiz' ? qi : ''}`}>
        {stop === 'look' && <Look tour={tour} point={point} />}
        {stop === 'guess' && (
          <Guess tour={tour} point={point} pick={pick} wrong={wrong} given={helped} onPick={setPick} />
        )}
        {stop === 'found' && <Found tour={tour} point={point} misses={wrong.length} helped={helped} />}
        {kind === 'twist' && <Twist twist={twist} n={ti} total={twists.length} pick={twistPick} done={twistDone} onPick={setTwistPick} />}
        {stop === 'scene' && <Scene scene={tour.scene} phase={phase} pick={scenePick} done={sceneDone} onPick={setScenePick} />}
        {stop === 'quiz' && (
          <QuizQuestion q={quiz[qi]} n={qi} total={quiz.length} pick={quizPicks[qi]} done={quizDone[qi]}
                        onPick={i => setQuizPicks(p => p.map((v, j) => (j === qi ? i : v)))} />
        )}
        {stop === 'terminus' && <Results tour={tour} point={point} picks={quizPicks} onLesson={onLesson} replay={replay} />}
        {ask && !replay && (
          <AskEntry ask={ask} askKey={asked.key} context={asked.context} open={asked.open} title={point.pattern} />
        )}
      </div>
      <div className="tour__foot">
        {gate}
      </div>
    </section>
  )
}
