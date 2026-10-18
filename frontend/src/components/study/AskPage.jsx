import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { useDialog } from '../../hooks/useDialog'
import { useAskPage } from '../../hooks/useAskPage'
import { StageHead } from '../chrome/StageHead'
import { AskPanel } from './AskPanel'

// ── 問 — the asking on a phone (plan 197) ──────────────────────────────
// The owner's pick D of four drawn on the real translation run, entered
// from a button in the graded card (the pick's "in the card"): the chat
// is a page of its own, over the run, with the run's head and its ‹
// Retour, the sentence pinned as a card, the thread, and the field on
// the foot. The desk keeps the asking in the lines panel
// (components/study/AskPanel.jsx), and a phone had none until now.
//
//   - The button is the card's own, beside "Voir la décomposition"
//     (.prose__breakdown), and does not exist before the grade: on the
//     desk the field is drawn sealed so that nothing moves when it opens,
//     and a phone has nothing to hold still. Comprehension's is in the
//     open question's detail on its results.
//   - The page is a dialog over the run, not a route (hooks/useAskPage):
//     the run stays mounted underneath, so the grade, the breakdown, the
//     threads and the scroll are where they were left. As every sheet is,
//     it takes the focus in and the Esc (hooks/useDialog, the Android
//     back button presses it), and aria-modal stands the run's own keys
//     down (lib/dialogOpen). The browser's Back closes it too.
//   - The thread is the sentence's and lives in the run's useAsk, so
//     closing the page and opening it again finds what was asked. The
//     server's limits are the desk's: five a sentence, forty a day.
//
//   ask      the run's useAsk
//   askKey   the thread (domain/ask's askTarget key)
//   context  what the question carries (askTarget's context)
//   open     whether it takes a question yet: the grade is in
//   title    the run's name, under the page's own
//   text     comprehension's wording: a text, not a sentence
export function AskEntry({ ask, askKey, context, open, title, text = false }) {
  const { t } = useLang()
  const desk = useDesk()
  const page = useAskPage()
  if (desk || !open) return null
  return (
    <>
      <button type="button" className="btn-secondary ask-launch" onClick={page.show} aria-haspopup="dialog">
        <span className="ask-launch__mark" lang="ja" aria-hidden="true">問</span>
        {t.askOpen}
      </button>
      {page.open && createPortal(
        <AskPage ask={ask} askKey={askKey} context={context} title={title} text={text} onClose={page.hide} />,
        document.body,
      )}
    </>
  )
}

// What the page says the question is about, in a line or two: the
// sentence and its translation, or, for a text, the question being
// asked (the first line of what comprehension passes as `review`) -- the
// passage itself is a screen long.
const ECHO_MAX = 140
const brief = s => (s.length > ECHO_MAX ? `${s.slice(0, ECHO_MAX).trimEnd()}…` : s)
function echoOf(context, text) {
  if (text) return { main: brief((context.review ?? '').split('\n')[0] || context.sentence), sub: '' }
  return { main: brief(context.sentence), sub: brief(context.translation ?? '') }
}

function AskPage({ ask, askKey, context, title, text, onClose }) {
  const { t } = useLang()
  // Where the focus lands, read once as the page opens: the field when
  // there is nothing yet to read, else the page's first control.
  const empty = ask.thread(askKey).length === 0
  const ref = useDialog(onClose, { focus: empty ? '.ask__field' : 'first' })
  const echo = echoOf(context, text)
  return (
    <div ref={ref} className="ask-layer" role="dialog" aria-modal="true" aria-label={t.askTitle}>
      <div className="phone phone--stage">
        <div className="screen">
          <div className="container stage ask-page">
            <StageHead onLeave={onClose} leaveLabel={t.back} where={t.askTitle} sub={title} pass={false} keys={false} />
            <section className="ask-echo">
              <p className="ask-echo__main" lang={text ? undefined : 'ja'}>{echo.main}</p>
              {echo.sub && <p className="ask-echo__sub">{echo.sub}</p>}
            </section>
            <div className="ask-page__body">
              <AskPanel key={askKey} page ask={ask} askKey={askKey} context={context} open text={text} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
