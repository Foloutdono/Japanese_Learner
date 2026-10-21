import { useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { RATINGS, TEXT_MAX, sendFeedback } from '../../lib/feedback'
import { refreshSummary } from '../../stores/profileSummary'
import { Sheet } from '../chrome/Sheet'
import { StarIcon } from '../ui/Icons'
import { Sent } from './FeedbackSheet'

// ── Early access: how the learner finds the app (plan 268) ─────────
// Once, over Today, when the learner has earned 400 XP: the app is young,
// so they are asked to rate it from one to five and, if they like, to say
// what they would change. The server decides who is asked (GET /api/profile's
// `feedbackOffer`, routes/feedback.offer_open) and is told the answer, a
// rating (kind `rating` of the one feedback route) or the sheet shut
// (POST /api/feedback/offer), so it is asked on one device only.
//
// It is a message like Nous écrire's: the words are the learner's, read by
// a person, and nothing but the rating and the words is sent -- no class of
// the device, so there is nothing to print under the box. A rating sent ends
// on the same 受付 stamp; shut any other way (the scrim, Escape, a push down,
// "Not now"), it counts as the second.
//
// Props:
//   session
//   onClose()  the sheet is gone; Today stops drawing it at once

export function RatingSheet({ session, onClose }) {
  const { t } = useLang()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)
  // A second press before the first one's render, as every send guards
  // (CLAUDE.md, plan 211); and whether the server already knows the sheet
  // was answered, so shutting it after a rating posts nothing.
  const inFlight = useRef(false)
  const answered = useRef(false)

  function leave() {
    if (!answered.current) {
      answered.current = true
      apiJson('/api/feedback/offer', session, { method: 'POST' })
        .then(() => refreshSummary())
        .catch(() => {})
    } else {
      refreshSummary()
    }
    onClose()
  }

  function submit(e) {
    e.preventDefault()
    if (rating === 0 || busy || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    sendFeedback(session, { kind: 'rating', rating, text })
      .then(res => {
        answered.current = true
        setSent(res?.at ? new Date(res.at) : new Date())
      })
      .catch(err => {
        inFlight.current = false
        setBusy(false)
        setError(err?.code === 'feedback_limit' ? 'limit' : 'send')
      })
  }

  return (
    <Sheet open onClose={leave} label={t.rateQ} className="tdy-sheet fb-sheet" dismiss>
      <span className="sheet__cap">{t.rateCap}</span>
      {sent ? (
        <Sent at={sent} reply={false} onClose={leave} />
      ) : (
        <form className="fb-form" onSubmit={submit}>
          <h2 className="sheet__jp fb-rate__q">{t.rateQ}</h2>
          <p className="fb-rate__lead">{t.rateLead}</p>
          <div className="fb-rate" role="group" aria-label={t.rateLabel}>
            {RATINGS.map(n => (
              <button
                key={n}
                type="button"
                className={n <= rating ? 'fb-rate__star fb-rate__star--on' : 'fb-rate__star'}
                aria-pressed={n === rating}
                aria-label={t.rateStar(n)}
                onClick={() => { playClick(); setRating(n) }}
              >
                <StarIcon size={28} filled={n <= rating} />
              </button>
            ))}
          </div>
          <textarea
            className="field fb-form__text"
            rows={4}
            maxLength={TEXT_MAX}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t.ratePlaceholder}
            aria-label={t.rateTextLabel}
          />
          {error && <p className="fb-form__error" role="alert">{error === 'limit' ? t.fbErrLimit : t.fbErrSend}</p>}
          <button type="submit" className="btn-primary fb-form__send" disabled={rating === 0 || busy}>{t.fbSend}</button>
          <button type="button" className="btn-secondary" data-action="rating-later" onClick={leave}>{t.rateLater}</button>
        </form>
      )}
    </Sheet>
  )
}
