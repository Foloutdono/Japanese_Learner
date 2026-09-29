import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { StarIcon } from '../ui/Icons'
import { askRating, closeRating, readyToAsk, sendRating, useRatingOpen } from '../../stores/rating'
import { isNative, nativePlatform, openStore } from '../../lib/platform'
import { dialogOpen } from '../../lib/dialogOpen'
import { storePages, storeReview, STORE_NAMES } from '../../config/stores'

// ── 評価 — the app asks what the learner thinks of it (plan 167) ──
// Five stars and "not now". A five goes on to the store the learner
// installed the app from, to say it there (config/stores.js); a web
// learner is offered the listings instead, having no one store. Anything
// under five stays with us: the sheet asks what would have made it five,
// and the answer reaches routes/rating.py rather than a public page.
//
// Every way out answers something, so the server can keep its promise
// never to ask twice: closed before a star, it is "not now" (a snooze);
// closed after one, the stars stand without a comment -- what was typed
// and not sent is never sent.
//
// Mounted in the Shell (components/chrome/Shell.jsx), so it can only open
// in the chrome, never in a run; stores/rating.js decides when a visit
// has earned it, and the server whether this learner is asked at all.

/** Back in the chrome, this long before the question: the screen the
 *  learner came back to is drawn and read first. */
const SETTLE_MS = 1500

function useRatingMoment() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!readyToAsk()) return undefined
    const id = setTimeout(() => {
      // Another sheet, the guide or the refill's claim has the learner:
      // the next screen they open asks instead.
      if (document.visibilityState === 'hidden' || dialogOpen()) return
      askRating()
    }, SETTLE_MS)
    return () => clearTimeout(id)
  }, [pathname])
}

export function RatingSheet() {
  useRatingMoment()
  const open = useRatingOpen()
  if (!open) return null
  return <RatingBody />
}

function Stars({ value, onPick }) {
  const { t } = useLang()
  return (
    <div className="rate-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`rate-stars__star${n <= value ? ' rate-stars__star--lit' : ''}`}
          aria-label={t.rateStars(n)}
          aria-pressed={n === value}
          onClick={() => onPick(n)}
        >
          <StarIcon size={32} filled={false} />
        </button>
      ))}
    </div>
  )
}

function RatingBody() {
  const { t, lang } = useLang()
  // ask → why (under five) → thanks; ask → store (a five on the web)
  const [step, setStep] = useState('ask')
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const sent = useRef(false)

  function send(body) {
    if (sent.current) return
    sent.current = true
    sendRating({ ...body, lang }).catch(() => {})
  }

  function close() {
    if (step === 'ask') send({ stars: null })
    else if (step === 'why') send({ stars })
    closeRating()
  }

  function pick(n) {
    setStars(n)
    if (n < 5) {
      setStep('why')
      return
    }
    send({ stars: 5 })
    if (isNative()) {
      const url = storeReview(nativePlatform())
      if (url) {
        openStore(url)
        closeRating()
        return
      }
      setStep('thanks')
      return
    }
    setStep(storePages().length ? 'store' : 'thanks')
  }

  function submit(e) {
    e.preventDefault()
    send({ stars, comment })
    setStep('thanks')
  }

  if (step === 'thanks') {
    return (
      <Sheet open className="rate-sheet" onClose={close} jp={t.rateThanks} initialFocus=".btn-depart">
        {stars < 5 && <p className="rate-sheet__note">{t.rateThanksNote}</p>}
        <button type="button" className="btn-depart" onClick={close}>
          <span className="btn-depart__jp">{t.close}</span>
        </button>
      </Sheet>
    )
  }

  if (step === 'store') {
    const pages = storePages()
    return (
      <Sheet open className="rate-sheet" onClose={close} jp={t.rateThanks} dismiss>
        <p className="rate-sheet__note">{t.rateStoreAsk}</p>
        {pages.map(({ store, url }) => (
          <button
            key={store}
            type="button"
            className={pages.length === 1 ? 'btn-depart' : 'btn-secondary'}
            onClick={() => { openStore(url); close() }}
          >
            {pages.length === 1
              ? <span className="btn-depart__jp">{STORE_NAMES[store]}</span>
              : STORE_NAMES[store]}
          </button>
        ))}
      </Sheet>
    )
  }

  return (
    <Sheet open className="rate-sheet" onClose={close} jp={t.rateTitle} dismiss={step === 'why'}>
      <Stars value={stars} onPick={pick} />
      {step === 'ask' ? (
        <button type="button" className="btn-secondary" onClick={close}>{t.rateNotNow}</button>
      ) : (
        <form className="rate-sheet__why" onSubmit={submit}>
          <label className="rate-sheet__note" htmlFor="rate-comment">{t.rateWhy}</label>
          <textarea
            id="rate-comment"
            className="field field--multi"
            value={comment}
            maxLength={2000}
            placeholder={t.rateWhyPlaceholder}
            onChange={e => setComment(e.target.value)}
            // The star that opened this step asked the question; the
            // field is where it is answered.
            autoFocus
          />
          <button type="submit" className="btn-depart">
            <span className="btn-depart__jp">{t.rateSend}</span>
          </button>
        </form>
      )}
    </Sheet>
  )
}
