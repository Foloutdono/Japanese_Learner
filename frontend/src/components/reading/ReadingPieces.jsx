import { CardTransition } from '../study/CardTransition'
import PromptCard from '../study/PromptCard'
import { SpeakButton } from '../analysis/SpeakButton'
import { EyeOffIcon } from '../ui/Icons'

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

/** The clock: a hairline that empties, and the seconds — or, once the
 *  sentence is covered, the instruction to write from memory. */
export function ReadingTimer({ timeLeft, total, covered, t }) {
  return (
    <div className="timer">
      <div className="timer__bar" aria-hidden="true">
        <span className="timer__fill" style={{ width: `${total > 0 ? (timeLeft / total) * 100 : 0}%` }} />
      </div>
      <span className="timer__label" role="timer">
        {covered ? t.writeWhatYouSaw : `${timeLeft.toFixed(1)}s`}
      </span>
    </div>
  )
}

/** The sentence on its card, covered when the clock runs out so
 *  recall keeps mattering for anyone still writing. */
export function ReadingPrompt({ cardKey, foot, phrase, covered, guide }) {
  return (
    <CardTransition cardKey={cardKey} guide={guide}>
      <PromptCard foot={foot}>
        <span className={`sentence${covered ? ' sentence--covered' : ''}`} lang="ja">
          {covered ? <EyeOffIcon size={34} /> : phrase}
        </span>
      </PromptCard>
    </CardTransition>
  )
}

/** The field and Submit, docked in the foot. Nothing may rewrite what
 *  is typed here: romaji is not a word in any language the keyboard
 *  knows, so a phone's own helpers treat every answer as a typo to be
 *  repaired — autocapitalise puts a capital on it, autocorrect
 *  substitutes the nearest real word — and this stage is self-graded:
 *  a silently rewritten answer is a wrong verdict on the learner's own
 *  recall, not a cosmetic annoyance. */
export function AnswerForm({ answer, setAnswer, onSubmit, t, guide }) {
  return (
    <form className="stage__foot" data-guide={guide} onSubmit={e => { e.preventDefault(); onSubmit() }}>
      <input
        autoFocus
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
      <button type="submit" className="btn-primary" disabled={!answer.trim()}>
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
 *  number arrives in it.
 *
 *  The sentence carries the analyser's play button, so the learner
 *  can hear what they just read. Here and not on the prompt: the
 *  answer is the romaji, and hearing the sentence while it is still up
 *  would read the answer out. The device's own voice (docs/adr/0006),
 *  so where there is none the button is not drawn at all. */
export function ReadingRegisters({ phrase, romaji, translation, translationLang, answer, accuracy, correct, t }) {
  return (
    <>
      <span className="prose__said">
        <span className="prose__jp" lang="ja">{phrase}</span>
        <SpeakButton text={phrase} label={t.hearSentence} t={t} />
      </span>
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
