import { useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { Seg, Chip } from '../chrome/Console'
import { FlagIcon } from '../ui/Icons'
import {
  KINDS, CARD_REASONS, TEXT_MAX,
  feedbackContext, contextWords, failureOf, cardFace, reportable, sendFeedback,
} from '../../lib/feedback'

// ── Nous écrire (plan 222) ─────────────────────────────────────────
// The owner's pick A + B + C of the canvas "Tsuji — the feedback door,
// new directions": one sheet behind three doors -- Settings' row (A),
// the flag on an answered card (B) and the link under a failure (C).
// Settings and a failure open the form (what it is, the words, what is
// joined, the reply); the flag opens the card's own sheet (the card,
// what is wrong with it, a word more). Both end on the 受付 stamp.
//
// Nothing leaves the device unsaid: the classes joined to a message are
// printed under their box before sending, and unticking it sends none.
// The reply goes to the account's own address, read by the server
// (routes/feedback.py); the sheet only names it, and offers none to a
// guest, who has no address.

// The day a stamp prints, as a station's date stamp does: 16.10.26.
function stampDate(at) {
  const d = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date()
  const two = n => String(n).padStart(2, '0')
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${two(d.getFullYear() % 100)}`
}

function Sent({ at, reply, onClose }) {
  const { t } = useLang()
  return (
    <div className="fb-sent" role="status">
      <span className="fb-stamp" aria-hidden="true">
        <span className="fb-stamp__jp" lang="ja">受付</span>
        <span className="fb-stamp__date">{stampDate(at)}</span>
      </span>
      <p className="fb-sent__say">{t.fbSent}</p>
      <p className="fb-sent__sub">{reply ? t.fbSentReply : t.fbSentNote}</p>
      {onClose && (
        <button type="button" className="btn-secondary fb-sent__close" onClick={onClose}>{t.close}</button>
      )}
    </div>
  )
}

function errorLine(t, error) {
  if (!error) return null
  return <p className="fb-form__error" role="alert">{error === 'limit' ? t.fbErrLimit : t.fbErrSend}</p>
}

function refusal(e) {
  return e?.code === 'feedback_limit' ? 'limit' : 'send'
}

/** The form: what it is, the words, what is joined, the reply. Drawn in
 *  a sheet (FeedbackSheet) and, on the desk, as Settings' page. */
export function FeedbackForm({ session, failure = null, onClose = null }) {
  const { t } = useLang()
  const [kind, setKind] = useState(KINDS[0])
  const [text, setText] = useState('')
  const [join, setJoin] = useState(true)
  const [reply, setReply] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)
  // A second press before the first one's render: the state above has
  // not moved yet, so the guard is a ref (CLAUDE.md, plan 211).
  const inFlight = useRef(false)
  // Read once: what the box names is what is sent.
  const context = useMemo(() => feedbackContext(), [])
  const email = session?.user?.email || null

  if (sent) return <Sent at={sent.at} reply={sent.reply} onClose={onClose} />

  const words = [
    ...(failure ? [t.fbFailure(failure.status, failure.area)] : []),
    ...contextWords(context, t),
  ]
  const ready = text.trim().length > 0 && !busy

  function submit(e) {
    e.preventDefault()
    if (!ready || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    const asked = Boolean(email && reply)
    sendFeedback(session, {
      kind,
      text,
      reply: asked,
      ...(join ? { ...context, ...(failure ?? {}) } : {}),
    })
      .then(res => setSent({ at: res?.at ? new Date(res.at) : new Date(), reply: asked }))
      .catch(err => { inFlight.current = false; setError(refusal(err)); setBusy(false) })
  }

  return (
    <form className="fb-form" onSubmit={submit}>
      <Seg
        full
        label={t.fbKindLabel}
        value={kind}
        onChange={setKind}
        options={KINDS.map(k => ({ key: k, label: t.fbKind[k] }))}
      />
      <textarea
        className="field fb-form__text"
        rows={6}
        maxLength={TEXT_MAX}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t.fbPlaceholder[kind]}
        aria-label={t.fbTextLabel}
      />
      <span className="fb-form__count" aria-hidden="true">{text.length} / {TEXT_MAX}</span>
      <label className="fb-check">
        <input type="checkbox" className="fb-check__box" checked={join} onChange={e => setJoin(e.target.checked)} />
        <span className="fb-check__words">
          {failure ? t.fbJoinFailure : t.fbJoin}
          {words.length > 0 && <b className="fb-check__what">{words.join(' · ')}</b>}
        </span>
      </label>
      {email && (
        <label className="fb-check">
          <input type="checkbox" className="fb-check__box" checked={reply} onChange={e => setReply(e.target.checked)} />
          <span className="fb-check__words">
            {t.fbReply}
            <b className="fb-check__what">{email}</b>
          </span>
        </label>
      )}
      {errorLine(t, error)}
      <button type="submit" className="btn-primary fb-form__send" disabled={!ready}>{t.fbSend}</button>
    </form>
  )
}

/** The form in a sheet: Settings' door on a phone, a failure's link. */
export function FeedbackSheet({ open, onClose, session, failure = null }) {
  const { t } = useLang()
  return (
    <Sheet open={open} onClose={onClose} cap={t.settingsWrite} label={t.settingsWrite} className="fb-sheet" dismiss>
      <FeedbackForm session={session} failure={failure} onClose={onClose} />
    </Sheet>
  )
}

/** "Signaler ce problème" under a failure, beside its retry. */
export function ReportProblem({ session, error }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const failure = useMemo(() => failureOf(error?.path, error?.status), [error?.path, error?.status])
  return (
    <>
      <button type="button" className="fb-link" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t.reportProblem}
      </button>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} session={session} failure={failure} />
    </>
  )
}

function CardReport({ session, card, onClose }) {
  const { t } = useLang()
  const [reasons, setReasons] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)
  const inFlight = useRef(false)
  const face = cardFace(card)

  if (sent) return <Sent at={sent} reply={false} onClose={onClose} />

  const ready = (reasons.length > 0 || text.trim().length > 0) && !busy
  const toggle = r => setReasons(on => (on.includes(r) ? on.filter(x => x !== r) : [...on, r]))

  function submit(e) {
    e.preventDefault()
    if (!ready || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    // The card is what is joined, and the strip above says so: its id,
    // nothing about the device.
    sendFeedback(session, { kind: 'card', card_id: card.card_id, reasons, text })
      .then(res => setSent(res?.at ? new Date(res.at) : new Date()))
      .catch(err => { inFlight.current = false; setError(refusal(err)); setBusy(false) })
  }

  return (
    <form className="fb-form" onSubmit={submit}>
      <div className="fb-card">
        <span className="fb-card__face" lang="ja">{face.face}</span>
        <span className="fb-card__names">
          {face.reading && <span className="fb-card__reading" lang={card.kanji ? 'ja' : undefined}>{face.reading}</span>}
          {face.meaning && <span className="fb-card__gloss">{face.meaning}</span>}
        </span>
        {face.level && <span className="fb-card__level">{face.level}</span>}
      </div>
      <div className="fb-reasons" role="group" aria-label={t.cardReportReasons}>
        {CARD_REASONS.map(r => (
          <Chip key={r} on={reasons.includes(r)} onClick={() => toggle(r)}>{t.cardReason[r]}</Chip>
        ))}
      </div>
      <textarea
        className="field fb-form__text"
        rows={3}
        maxLength={TEXT_MAX}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t.cardReportNote}
        aria-label={t.cardReportNoteLabel}
      />
      {errorLine(t, error)}
      <button type="submit" className="btn-primary fb-form__send" disabled={!ready}>{t.fbSend}</button>
    </form>
  )
}

/** The flag on an answered card, in the run's head, and its sheet.
 *  Nothing for a card that is not the app's to correct (a personal
 *  card is reported with its deck). */
export function CardFlag({ card, session }) {
  const { t } = useLang()
  const [open, setOpen] = useState(null)
  if (!reportable(card)) return null
  return (
    <>
      <button
        type="button"
        className="fb-flag"
        aria-label={t.cardReport}
        title={t.cardReport}
        aria-haspopup="dialog"
        onClick={() => setOpen(card)}
      >
        <FlagIcon size={16} />
      </button>
      <Sheet open={open != null} onClose={() => setOpen(null)} cap={t.cardReport} label={t.cardReport} className="fb-sheet" dismiss>
        {open && <CardReport session={session} card={open} onClose={() => setOpen(null)} />}
      </Sheet>
    </>
  )
}
