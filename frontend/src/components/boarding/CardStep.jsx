import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { CAP, SIGNUP_BONUS, refillMinutes, showsCap } from '../../domain/credits'
import { cardTier, sinceMonth } from '../../domain/passCard'
import { PassCard } from '../pass/PassCard'
import { PassBack } from '../pass/PassBack'
import { BoardQuestion, Continue } from './BoardFrame'
import { CheckMark, DeviceMark, MailMark } from './icons'
import { playClick } from '../../lib/audio'

// ── 定期券 — the card, filled in (plan 246) ──────────────────────
// The owner's pick C of the boarding's canvas: the boarding asks only
// what it cannot guess -- the kana, and a reader's level -- then hands
// the learner their card already filled in with what most keep (the
// next stop, 10 min a day, 07:30, all three lines), printed on the
// card's own back (components/pass/PassBack.jsx), the one the profile
// and Settings print. Every field of the print is a door to its sheet
// (CardSheets.jsx): the destination, the service, the hour, the lines
// and the signature; the origin goes back to the question that set it.
// What the card cannot print, where it is kept, is the one line under
// it. The gate issues the card: the contract is posted once, and the
// 改札 opens (App.jsx's TicketGate) -- the plan and the pass were two
// screens, two ceremonies and a second « Entrer en gare »; the card is
// both.
//
// An arrival screen: no head, no ‹ (the origin is the way back, and a
// phone's own Back still is). `contract` is the print as the boarding
// holds it ({ from, to, valid, service, hour, lines, name }); `kept`
// where the card lives ({ state: 'device' | 'sent' | 'google' |
// 'account', email }).

function issuedBack(t, lang, contract, credits) {
  const cap = credits?.cap ?? CAP
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const gift = balance === SIGNUP_BONUS
  return {
    ...contract,
    level: 1,
    into: 0,
    span: 100,
    share: 0,
    balance,
    unlimited: balance == null,
    cap,
    counted: balance == null ? null : balance.toLocaleString(lang),
    unit: balance == null ? '' : gift ? t.brdCreditsOffered : `${showsCap(balance, cap) ? `/ ${cap} ` : ''}${t.creditsUnit}`,
    // The rhythm rather than an hour: a welcome over the cap has no next
    // credit to name yet, and the rhythm is what it will be (plan 141).
    note: balance == null ? t.cardNoCredit : t.balanceRefillRate(refillMinutes(credits)),
    status: { status: 'onTime', word: t.hudStatus.onTime, drift: null },
    since: sinceMonth(new Date().toISOString(), lang),
  }
}

// Why the gate did not go through, over it. 'refused' is the office
// answering and turning the contract down -- a wrong thing to blame on
// the connection, and the one case where trying again unchanged earns
// the same answer. 'network' is the line the app never got down.
function IssueError({ error }) {
  const { t } = useLang()
  if (!error) return null
  return (
    <p className="brd__error" role="alert" data-error={error}>
      {error === 'refused' ? t.brdPassRefused : t.onbPassError}
    </p>
  )
}

function KeepLine({ kept, onKeep }) {
  const { t } = useLang()
  if (kept.state === 'device') {
    return (
      <p className="brd-keep-line" data-kept="device">
        <DeviceMark />
        <span className="brd-keep-line__txt">{t.brdKeepDevice}</span>
        <button type="button" className="brd-keep-line__go" onClick={() => { playClick(); onKeep() }} data-action="keep">{t.brdKeepGo}</button>
      </p>
    )
  }
  if (kept.state === 'sent') {
    return (
      <p className="brd-keep-line" data-kept="sent" role="status">
        <MailMark />
        <span className="brd-keep-line__txt">{t.brdKeepSent(kept.email)}</span>
      </p>
    )
  }
  return (
    <p className="brd-keep-line brd-keep-line--kept" data-kept={kept.state}>
      <CheckMark />
      <span className="brd-keep-line__txt">
        {kept.state === 'google' ? t.brdKeptGoogle : kept.email ? t.brdKeptEmail(kept.email) : t.brdKeptAccount}
      </span>
    </p>
  )
}

export default function CardStep({ contract, kept, onOpen, onSign, onKeep, onEnter, busy = false, error = null, children = null }) {
  const { t, lang } = useLang()
  const credits = useCredits()
  const tier = cardTier(credits)
  const back = issuedBack(t, lang, contract, credits)
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdCardHint}>{t.brdCardQ}</BoardQuestion>
        <div className="brd__stage brd-card">
          <div className="brd-card__card">
            <PassCard
              tier={tier}
              name={back.name}
              level={1}
              share={0}
              side="back"
              label={t.passLabel}
              back={<PassBack tier={tier} data={back} doors={{ open: onOpen, onSign }} />}
            />
          </div>
          <KeepLine kept={kept} onKeep={onKeep} />
        </div>
      </div>
      <div className="brd__foot">
        <IssueError error={error} />
        <Continue keys label={t.brdIssue} onClick={onEnter} disabled={busy} data-action="issue" />
      </div>
      {children}
    </>
  )
}
