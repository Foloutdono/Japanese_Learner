import { useEffect, useLayoutEffect, useRef } from 'react'
import { CardTransition } from '../study/CardTransition'
import PromptCard from '../study/PromptCard'
import { EyeOffIcon, PlayIcon } from '../ui/Icons'
import { runKey } from '../../lib/keyGuards'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { READING_PACE_IDS } from '../../domain/readingPace'
import { useReadingPace, setReadingPace } from '../../stores/readingPace'

// ── 読書 — the reading stage's pieces (plan 099) ─────────────────
// The reading run (screens/ReadingRun.jsx) and the reading ride
// (screens/RideReading.jsx) draw the same stage: the clock over the
// sentence, the sentence that hides when the clock runs out, the
// field and Submit docked in the foot, and the registers the answer is
// read against. Extracted here rather than copied, per DESIGN.md's
// "never hand-copy a component's markup": every near-copy in this app
// has drifted from its original within two features. The session
// logic -- batches, history, the result post, the breakdown -- stays
// with the run; these are the drawing.

/** A clock's drawing: the hairline, `fill` of it left, over its label.
 *  `running` says whether the label is a countdown (role="timer");
 *  `aside` is a control standing at the clock's end, beside the
 *  hairline and the label both -- the reading pace's chip (PaceChip).
 *  Comprehension draws its window with it too. */
export function Clock({ fill, label, low = false, running = true, aside = null }) {
  return (
    <div className={`timer${aside ? ' timer--aside' : ''}`}>
      <div className="timer__bar" aria-hidden="true">
        <span className={`timer__fill${low ? ' timer__fill--low' : ''}`} style={{ width: `${fill * 100}%` }} />
      </div>
      <span className="timer__label" role={running ? 'timer' : undefined}>{label}</span>
      {aside}
    </div>
  )
}

/** The clock: a hairline that empties, and the seconds — or, once the
 *  sentence is covered, the instruction to write from memory. At the
 *  untimed reading pace (domain/readingPace.js) there is no clock: the
 *  hairline stays full and says so, in the clock's place, so the card
 *  under it stands where it always does. A sentence the clock already
 *  covered stays covered when the pace is changed to untimed. */
export function ReadingTimer({ timeLeft, total, covered, t, untimed = false, aside = null }) {
  if (covered) return <Clock fill={0} label={t.writeWhatYouSaw} aside={aside} />
  if (untimed) return <Clock fill={1} label={t.readingUntimed} running={false} aside={aside} />
  return <Clock fill={total > 0 ? timeLeft / total : 0} label={`${timeLeft.toFixed(1)}s`} aside={aside} />
}

/** The reading pace, on the clock (the owner's pick B of four drawn
 *  options): the pace's factor in a chip at the clock's end, each press
 *  the next pace, standard → relaxed → slow → untimed and round again.
 *  The time beside it answers at once, so the press is read off the
 *  clock rather than off a list. The same choice as Settings › Reading
 *  pace, saved to the profile; a pace changed with a text up rescales
 *  what is left of it. */
export function PaceChip({ session }) {
  const { t } = useLang()
  const desk = useDesk()
  const pace = useReadingPace()
  const next = READING_PACE_IDS[(READING_PACE_IDS.indexOf(pace) + 1) % READING_PACE_IDS.length]
  const label = t.readingPaceChip(t.readingPaceOption[pace])
  return (
    // A chip in the on look, not the Chip component: that one is a
    // filter, pressed or not (aria-pressed), and this is a dial.
    <button
      type="button"
      className="chip chip--on pace-chip"
      data-pace={pace}
      aria-label={label}
      title={desk ? label : undefined}
      onClick={() => setReadingPace(next, session).catch(() => {})}
    >
      {t.readingPaceShort[pace]}
    </button>
  )
}

/** The sentence on its card, covered when the clock runs out so
 *  recall keeps mattering for anyone still writing.
 *
 *  With `onPlay`, the sentence is not on the card yet: the card holds
 *  the play button instead, and the run shows the sentence and starts
 *  its clock when it is pressed, so the learner decides when the
 *  reading begins. */
export function ReadingPrompt({ cardKey, foot, phrase, covered, guide, onPlay, playLabel, keyHint = false }) {
  return (
    <CardTransition cardKey={cardKey} guide={guide}>
      <PromptCard foot={foot}>
        {onPlay ? <PlayButton onPlay={onPlay} label={playLabel} keyHint={keyHint} /> : (
          <span className={`sentence${covered ? ' sentence--covered' : ''}`} lang="ja">
            {covered ? <EyeOffIcon size={34} /> : phrase}
          </span>
        )}
      </PromptCard>
    </CardTransition>
  )
}

/** The play button: 書取's ring (.clip-player__play) in its frame
 *  (.clip-player, which centres it in the card), playing the line there
 *  and showing the sentence here. It takes the focus when the sentence
 *  arrives, so Enter presses it; on the desk (`keyHint`) Space does
 *  too, from anywhere but a field or another control, as Space plays
 *  dictation's clip. */
function PlayButton({ onPlay, label, keyHint }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!keyHint) return undefined
    const onKey = e => {
      if (e.key !== ' ' || !runKey(e)) return
      // A focused button's Space is its own, and presses it on keyup.
      if (/^(BUTTON|A)$/.test(e.target?.tagName ?? '')) return
      e.preventDefault()
      ref.current?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyHint])
  return (
    <div className="clip-player">
      <button
        ref={ref}
        type="button"
        className="clip-player__play"
        onClick={onPlay}
        aria-label={label}
        aria-keyshortcuts={keyHint ? 'Space' : undefined}
        autoFocus
      >
        <PlayIcon size={26} />
      </button>
    </div>
  )
}

/** The field and Submit, docked in the foot. Nothing may rewrite what
 *  is typed here: romaji is not a word in any language the keyboard
 *  knows, so a phone's own helpers treat every answer as a typo to be
 *  repaired — autocapitalise puts a capital on it, autocorrect
 *  substitutes the nearest real word — and this stage is self-graded:
 *  a silently rewritten answer is a wrong verdict on the learner's own
 *  recall, not a cosmetic annoyance. */
export function AnswerForm({ answer, setAnswer, onSubmit, t, guide, disabled = false }) {
  // The field takes the focus when it opens: on arrival, or -- shut
  // while the run's play button still holds the sentence back -- the
  // moment the button is pressed. A layout effect, so the focus lands
  // inside the press, which is what lets a phone raise its keyboard.
  const field = useRef(null)
  useLayoutEffect(() => {
    if (!disabled) field.current?.focus()
  }, [disabled])
  return (
    <form className="stage__foot" data-guide={guide} onSubmit={e => { e.preventDefault(); onSubmit() }}>
      <input
        ref={field}
        disabled={disabled}
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder={t.romajiPlaceholder}
        aria-label={t.writeWhatYouSaw}
        className="field field--page"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
      />
      <button type="submit" className="btn-primary" disabled={disabled || !answer.trim()}>
        {t.submit}
      </button>
    </form>
  )
}

/** The registers the answer is read against: the sentence, its
 *  romaji, the translation (English only, and labelled so — see
 *  reading.py's translation_lang note), then the learner's own answer
 *  with the measurement on its label, and the verdict line.
 *
 *  The measurement rides on the answer's own label, as it does in
 *  書取: a hint for the learner grading below, not the grade. Absent
 *  until it lands, and absent for good if it never does — the label is
 *  the same label either way rather than a row that jumps when a
 *  number arrives in it. */
export function ReadingRegisters({ phrase, romaji, translation, translationLang, answer, accuracy, correct, t }) {
  return (
    <>
      <span className="prose__jp" lang="ja">{phrase}</span>
      <span className="prose__romaji">{romaji}</span>
      {translation && (
        <>
          <span className="prose__label">{translationLang === 'en' ? t.translationEnglish : t.translation}</span>
          <span className="prose__en">{translation}</span>
        </>
      )}
      <span className="prose__rule" />
      <span className="prose__label prose__label--measured">
        {t.yourAnswer}
        {accuracy !== null && accuracy !== undefined && (
          <span className="prose__measure">{t.answerMatched(accuracy)}</span>
        )}
      </span>
      <span className="prose__en">{answer}</span>
      <span
        className={`prose__verdict${correct === null ? '' : correct ? ' prose__verdict--ok' : ' prose__verdict--x'}`}
      >
        {correct === null ? t.didYouGetIt : correct ? t.correct : t.incorrect}
      </span>
    </>
  )
}
