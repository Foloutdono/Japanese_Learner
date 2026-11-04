import { useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { RATINGS, TEXT_MAX, sendFeedback } from '../../lib/feedback'
import { openStore } from '../../lib/platform'
import { refreshSummary } from '../../stores/profileSummary'
import { Sheet } from '../chrome/Sheet'
import { ArrowIcon, StarIcon } from '../ui/Icons'
import { Sent } from './FeedbackSheet'

// ── Early access: how the learner finds the app (plan 269) ─────────
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
// Google Play (plan 307, the owner's pick A of the canvas "Note sur
// Google Play"): in the Android shell the sheet asks for a rating on the
// store first -- the question, the gold door to the app's page on Google
// Play (lib/platform.openStore), "Not now", and under them a link to the
// stars and the words above, for a learner who would rather write to us.
// It is asked while the profile says `storeOffer`, a question of its own
// (routes/feedback.py), so a learner who answered the sheet on the web is
// asked it too; whichever way it is left -- the store opened, the form
// sent, shut -- the server is told once (POST /api/feedback/store-offer),
// which answers both questions. Nobody is sent to the store, or kept from
// it, by their stars.
//
// Props:
//   session
//   onClose()  the sheet is gone; Today stops drawing it at once
//   store      the Android shell's sheet: the store first

export function RatingSheet({ session, onClose, store = false }) {
  const { t } = useLang()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)
  const [writing, setWriting] = useState(!store)
  // A second press before the first one's render, as every send guards
  // (CLAUDE.md, plan 211); and whether the server already knows the sheet
  // was answered, so shutting it after a rating posts nothing. A rating
  // answers the web's question alone: the store's is answered on the way
  // out, whichever it is.
  const inFlight = useRef(false)
  const answered = useRef(false)

  function leave() {
    if (!answered.current) {
      answered.current = true
      const path = store ? '/api/feedback/store-offer' : '/api/feedback/offer'
      apiJson(path, session, { method: 'POST' })
        .then(() => refreshSummary())
        .catch(() => {})
    } else {
      refreshSummary()
    }
    onClose()
  }

  // The server is told before the app goes to the background: the store
  // opens over it, and the shell may pause the page before a later call.
  function toStore() {
    playClick()
    leave()
    openStore()
  }

  function submit(e) {
    e.preventDefault()
    if (rating === 0 || busy || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    sendFeedback(session, { kind: 'rating', rating, text })
      .then(res => {
        if (!store) answered.current = true
        setSent(res?.at ? new Date(res.at) : new Date())
      })
      .catch(err => {
        inFlight.current = false
        setBusy(false)
        setError(err?.code === 'feedback_limit' ? 'limit' : 'send')
      })
  }

  let body
  if (sent) {
    body = <Sent at={sent} reply={false} onClose={leave} />
  } else if (!writing) {
    body = (
      <div className="fb-form">
        <h2 className="sheet__jp fb-rate__q">{t.storeQ}</h2>
        <p className="fb-rate__lead">{t.storeLead}</p>
        <button type="button" className="btn-primary fb-form__send" data-action="rating-store" onClick={toStore}>
          {t.storeGo}
          <ArrowIcon direction="right" size={16} />
        </button>
        <button type="button" className="btn-secondary" data-action="rating-later" onClick={leave}>{t.rateLater}</button>
        <button type="button" className="fb-link fb-store__write" data-action="rating-write" onClick={() => { playClick(); setWriting(true) }}>{t.storeWrite}</button>
      </div>
    )
  } else {
    body = (
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
    )
  }

  return (
    <Sheet open onClose={leave} label={writing ? t.rateQ : t.storeQ} className="tdy-sheet fb-sheet" dismiss>
      <span className="sheet__cap">{t.rateCap}</span>
      {body}
    </Sheet>
  )
}
