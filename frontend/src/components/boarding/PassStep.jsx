import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { useCredits } from '../../stores/credits'
import { CAP, SIGNUP_BONUS, showsCap, refillMinutes } from '../../domain/credits'
import { cardTier, sinceMonth } from '../../domain/passCard'
import { BoardQuestion, Continue } from './BoardFrame'
import { SOURCES } from '../../domain/paywall'
import { OfferButton } from '../credits/OfferButton'
import { PassCard } from '../pass/PassCard'
import { PassBack } from '../pass/PassBack'
import { dateFormat, hourLabel, paceLabel, stopParts } from '../settings/contract'
import { playClick } from '../../lib/audio'
import { useCountUp, useWelcomeCoin, stillPreferred } from './countUp'

// ── The card, issued (plan 075; the card, plan 172) ─────────────────
// The last arrival screen: the learner's card slides up, face up -- the
// holder at level one, the road of its struck 辻 empty -- and once it has
// landed it turns over by itself, to show what it holds: the contract
// just chosen printed on its back, and the balance, a new account's
// SIGNUP_BONUS (the welcome core/credits.py grants on first read)
// counted up with the coin, named as given while it is the welcome
// itself. It is above the cap, so it prints without one (showsCap). A
// touch turns it, as the profile's does. "Enter the station" posts the
// whole contract; the gate then opens (App.jsx's TicketGate finale).
//
// The offer sits above that button as a quiet line, never as the
// primary action: the last thing a learner does before their first
// lesson must be starting it. It is shown here because this is the
// screen where the balance is explained, which is the only place the
// pass means anything yet.

// Long enough for the card to have risen and settled (.brd-issue).
const TURN_AFTER_MS = 1500

// The back as the boarding prints it, from the answers rather than an
// account that does not exist yet: the contract the gate will post.
function issuedBack(t, lang, name, contract, credits, shown) {
  const cap = credits?.cap ?? CAP
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const gift = balance === SIGNUP_BONUS
  return {
    from: stopParts(t, contract?.jlpt ?? null),
    to: stopParts(t, contract?.goal ?? null),
    valid: contract?.goal && contract?.date ? dateFormat(lang).format(contract.date) : null,
    service: paceLabel(t, contract?.perDay ?? null),
    hour: hourLabel(t, contract?.departure ?? null),
    lines: contract?.lines ?? ['vocab', 'kanji', 'grammar'],
    level: 1,
    into: 0,
    span: 100,
    share: 0,
    balance,
    unlimited: balance == null,
    cap,
    counted: balance == null ? null : shown.toLocaleString(lang),
    unit: balance == null ? '' : gift ? t.brdCreditsOffered : `${showsCap(balance, cap) ? `/ ${cap} ` : ''}${t.creditsUnit}`,
    // The rhythm rather than an hour: a welcome over the cap has no
    // next credit to name yet, and the rhythm is what it will be (plan
    // 141).
    note: balance == null ? t.cardNoCredit : t.balanceRefillRate(refillMinutes(credits)),
    status: { status: 'onTime', word: t.hudStatus.onTime, drift: null },
    name,
    since: sinceMonth(new Date().toISOString(), lang),
  }
}

function IssuedCard({ name, contract }) {
  const { t, lang } = useLang()
  const credits = useCredits()
  const tier = cardTier(credits)
  const [side, setSide] = useState('face')
  const turned = side === 'back'
  useEffect(() => {
    const id = setTimeout(() => setSide('back'), TURN_AFTER_MS)
    return () => clearTimeout(id)
  }, [])
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const shown = useCountUp(balance, turned && balance != null && !stillPreferred())
  useWelcomeCoin(turned && balance != null)
  const turn = () => { playClick(); setSide(s => (s === 'face' ? 'back' : 'face')) }
  return (
    <PassCard
      tier={tier}
      name={name}
      level={1}
      share={0}
      side={side}
      onTurn={turn}
      label={t.passLabel}
      back={<PassBack tier={tier} data={issuedBack(t, lang, name, contract, credits, shown ?? 0)} onTurn={turn} />}
    />
  )
}

// Why "Enter the station" did not go through, over the button that
// posts the contract: here, and on the desk wherever that button went
// once this screen folded away (the plan, the account; plan 140).
// 'refused' is the office answering and turning the contract down -- a
// wrong thing to blame on the connection, and the one case where trying
// again unchanged earns the same answer. 'network' is the line the app
// never got down.
export function PassError({ error }) {
  const { t } = useLang()
  if (!error) return null
  return (
    <p className="brd__error" role="alert" data-error={error}>
      {error === 'refused' ? t.brdPassRefused : t.onbPassError}
    </p>
  )
}

// On a phone (plan 168, the owner's A-La carte) the pass stands in the
// room under its question, and a road in the pass's metal runs from it
// down to the gate's reader: the card is what is tapped on the way in.
// The offer, when there is one, is a quiet line over the gate, as every
// quiet way in the boarding is, drawn as they are. The desk never shows
// this screen (plan 140: the pass is issued on the plan).
export default function PassStep({ name, contract, onEnter, busy = false, error = null }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdEnjoy}>
          <Emphasized text={t.brdPassQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage brd-issue-stn">
          <div className="brd-issue">
            <IssuedCard name={name} contract={contract} />
            <span className="brd-issue__shine" aria-hidden="true" />
          </div>
          <span className="brd-issue__road" aria-hidden="true" />
        </div>
      </div>
      <div className="brd__foot brd__foot--road">
        <OfferButton source={SOURCES.ONBOARDING} className="brd__link" />
        <PassError error={error} />
        <Continue keys label={t.brdEnter} onClick={onEnter} disabled={busy} data-action="enter" />
      </div>
    </>
  )
}
