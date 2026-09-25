import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { refillClock } from '../../domain/credits'
import { MAX_QUESTION, MAX_TURNS } from '../../domain/ask'
import { Dots } from '../ui/Loading'
import { ChevronIcon } from '../ui/Icons'

// ── 机 — 問, the asking (plan 131) ────────────────────────────────────
// One short question about the exercise, answered in a few sentences:
// the desk-only chat the owner asked for, "limited to small questions
// and only precise answers". It stands in the lower half of a practice
// run's lines panel (components/study/RunLines.jsx), the place plan 129
// kept for it, and opens when the breakdown does -- once the answer is
// graded, or comprehension's results are in -- because before that
// "what does this mean?" is a request for the answer key. Sealed until
// then: the field is drawn, disabled, over the line that says when it
// opens, so nothing moves when it does.
//
// A thread per sentence (hooks/useAsk): the questions in the learner's
// voice under 問, the answers under 答, the newest in view. At most
// MAX_TURNS questions a sentence, and the day's ceiling from the server
// (a 429 names when it comes back); a question off the exercise is
// declined in the learner's language. Enter asks: the field owns its
// Enter, so the run's Enter (next sentence) waits for the field to be
// left. Nothing is kept past the run.
//
// Keyed on the thread by its caller, so the draft belongs to the
// sentence it was typed about.
//
//   ask      the run's useAsk
//   askKey   the thread (the sentence's line key)
//   context  what the question carries (domain/ask's askTarget)
//   open     whether it takes a question yet
//   text     comprehension's wording: a text, not a sentence
export function AskPanel({ ask, askKey, context, open, text = false }) {
  const { t, lang } = useLang()
  const [draft, setDraft] = useState('')
  const fieldRef = useRef(null)
  const threadRef = useRef(null)
  const thread = ask.thread(askKey)
  const full = thread.length >= MAX_TURNS
  const disabled = !open || Boolean(ask.spent) || full
  const last = thread.at(-1)

  // The newest exchange in view as the thread grows or an answer lands.
  useEffect(() => {
    const list = threadRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [thread.length, last?.state])

  function submit(e) {
    e.preventDefault()
    if (disabled || ask.pending) return
    if (ask.ask(askKey, context, draft)) {
      setDraft('')
      fieldRef.current?.focus()
    }
  }

  const note = ask.spent
    ? t.askSpent(ask.spent.at ? refillClock(ask.spent.at, lang) : null)
    : full
      ? t.askFull
      : ask.left != null && ask.left <= 5
        ? t.askLeft(ask.left)
        : null

  return (
    <section className={`desk-ask${open ? '' : ' desk-ask--sealed'}`} aria-label={t.askTitle}>
      {thread.length > 0 ? (
        <ol ref={threadRef} className="desk-ask__thread" aria-live="polite">
          {thread.map(x => (
            <li key={x.id} className="desk-ask__turn">
              <p className="desk-ask__q">
                <span className="desk-ask__mark" lang="ja" aria-hidden="true">問</span>
                <span className="desk-ask__text">{x.question}</span>
              </p>
              <p className={`desk-ask__a${x.state === 'done' ? '' : ' desk-ask__a--note'}`}>
                <span className="desk-ask__mark" lang="ja" aria-hidden="true">答</span>
                {x.state === 'pending' ? (
                  <span className="desk-ask__text">
                    <Dots />
                    <span className="sr-only">{t.askThinking}</span>
                  </span>
                ) : (
                  <span className="desk-ask__text">{x.state === 'done' ? x.answer : ask.message(x)}</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="desk-ask__hint">{open ? t.askHint : text ? t.askSealedText : t.askSealed}</p>
      )}
      <form className="desk-ask__form" onSubmit={submit}>
        <input
          ref={fieldRef}
          className="field desk-ask__field"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={MAX_QUESTION}
          disabled={disabled}
          placeholder={open && !disabled ? t.askPlaceholder : ''}
          aria-label={t.askTitle}
          autoComplete="off"
          enterKeyHint="send"
          // Its keys are its own: the rating bar reads digits from any
          // field but this one (a reopened line's thread can be open while
          // the sentence on the stage waits for its grade).
          data-own-keys=""
        />
        {/* An arrow rather than the word: a laptop's column is 300px and
            the field's placeholder needs it. Named for a screen reader
            and on hover; Enter asks from the field anyway. */}
        <button
          type="submit"
          className="btn-secondary desk-ask__send"
          disabled={disabled || ask.pending || !draft.trim()}
          aria-label={t.askSend}
          title={t.askSend}
        >
          <ChevronIcon direction="right" size={16} />
        </button>
      </form>
      {note && <p className="desk-ask__note" role="status">{note}</p>}
    </section>
  )
}
