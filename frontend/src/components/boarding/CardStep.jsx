import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { CAP, SIGNUP_BONUS, refillMinutes, showsCap } from '../../domain/credits'
import { cardTier, sinceMonth } from '../../domain/passCard'
import { PassCard } from '../pass/PassCard'
import { PassBack } from '../pass/PassBack'
import { BoardQuestion, Continue } from './BoardFrame'
import { CheckMark, DeviceMark, MailMark } from './icons'
import { LINES } from '../../domain/boarding'
import { playClick } from '../../lib/audio'

// ── 定期券 — the card, filled in (plan 247) ──────────────────────
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
// the same answer, so it carries the way to tell us (plan 247): the
// feedback sheet, the failure joined. 'busy' is the office unable to
// answer just now, and 'network' the line the app never got down: both
// are worth the gate a second time, and say so.
const ISSUE_ERROR = { refused: 'brdPassRefused', busy: 'brdPassBusy', network: 'onbPassError' }

function IssueError({ error, onReport }) {
  const { t } = useLang()
  if (!error) return null
  return (
    <p className="brd__error" role="alert" data-error={error}>
      {t[ISSUE_ERROR[error] ?? 'onbPassError']}
      {error === 'refused' && onReport && (
        <>
          {' '}
          <button type="button" className="fb-link" onClick={() => { playClick(); onReport() }} aria-haspopup="dialog" data-action="report">
            {t.reportProblem}
          </button>
        </>
      )}
    </p>
  )
}

// The card's fields again, in words, under it (plan 247, as the canvas
// "C, start to finish" drew it): the destination with its date, the
// rhythm in minutes, the hour, the lines by name and the name. A row is
// a door to the same sheet as its field on the card -- a wider one,
// for a thumb, and a reading of the card for whoever skims its codes.
function CardRows({ contract, onOpen, onSign }) {
  const { t, lang } = useLang()
  const stop = contract.to.jp ? contract.to.name : contract.to.code
  const lines = LINES.filter(id => contract.lines.includes(id))
    .map((id, i) => (i === 0 ? t.brdLine[id] : t.brdLine[id].toLocaleLowerCase(lang)))
    .join(', ')
  const rows = [
    { id: 'goal', name: t.brdSheetGoal, value: t.brdRowGoal(stop, contract.valid), open: () => onOpen('destination') },
    { id: 'rhythm', name: t.brdSheetRhythm, value: t.brdRowRhythm(t.brdRhythmName[contract.minutes] ?? '', contract.minutes), open: () => onOpen('service') },
    { id: 'hour', name: t.brdSheetHour, value: contract.hour, open: () => onOpen('hour') },
    { id: 'lines', name: t.brdSheetLines, value: lines, open: () => onOpen('lines') },
    { id: 'name', name: t.brdSheetName, value: contract.name || t.brdNamePlaceholder, empty: !contract.name, open: onSign },
  ]
  return (
    <ul className="brd-rows" aria-label={t.brdRowsAria}>
      {rows.map(row => (
        <li key={row.id}>
          <button type="button" className="brd-row" data-row={row.id} aria-haspopup="dialog" onClick={() => { playClick(); row.open() }}>
            <span className="brd-row__txt">
              <span className="brd-row__name">{row.name}</span>
              <span className={`brd-row__val${row.empty ? ' brd-row__val--empty' : ''}`}>{row.value}</span>
            </span>
            <svg className="brd-row__chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="9 6 15 12 9 18" /></svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

// An account boarded with prints its address: the boarding only runs on
// an account with no journey on it, so an address here is a NEW pass
// for it -- and for the learner Google's chooser put on an account no
// pass carried, not the one they meant (docs/oauth.md, "Say whose pass
// it is"). `onSwitch` is the way to their own, beside the address.
function KeepLine({ kept, onKeep, onSwitch = null }) {
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
  // A link on its way: the address it went to, and the way back to the
  // sheet -- a mistyped address, or a mail that never came, is mended
  // there rather than nowhere (plan 247).
  if (kept.state === 'sent') {
    return (
      <p className="brd-keep-line" data-kept="sent" role="status">
        <MailMark />
        <span className="brd-keep-line__txt">{t.brdKeepSent(kept.email)}</span>
        <button type="button" className="brd-keep-line__go" onClick={() => { playClick(); onKeep() }} data-action="keep">{t.brdKeepChange}</button>
      </p>
    )
  }
  return (
    <p className="brd-keep-line brd-keep-line--kept" data-kept={kept.state}>
      <CheckMark />
      <span className="brd-keep-line__txt">
        {kept.email ? t.brdKeptEmail(kept.email) : kept.state === 'google' ? t.brdKeptGoogle : t.brdKeptAccount}
      </span>
      {kept.email && onSwitch && (
        <button type="button" className="brd-keep-line__go" onClick={() => { playClick(); onSwitch() }} data-action="switch-account">{t.brdKeptSwitch}</button>
      )}
    </p>
  )
}

export default function CardStep({ contract, kept, onOpen, onSign, onKeep, onEnter, onSwitch = null, onReport = null, busy = false, error = null, children = null }) {
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
          <CardRows contract={contract} onOpen={onOpen} onSign={onSign} />
          <KeepLine kept={kept} onKeep={onKeep} onSwitch={onSwitch} />
        </div>
      </div>
      <div className="brd__foot">
        <IssueError error={error} onReport={onReport} />
        <Continue keys label={t.brdIssue} onClick={onEnter} disabled={busy} data-action="issue" />
      </div>
      {children}
    </>
  )
}
