import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { CommuterPass } from '../profile/CommuterPass'
import { useCredits } from '../../stores/credits'
import { DAILY_REFILL, CAP, SIGNUP_BONUS, showsCap } from '../../domain/credits'
import { BoardAir, Continue } from './BoardFrame'

// ── The pass, issued (plan 075) ──────────────────────────────────
// The last arrival screen: the printed commuter pass slides up and the
// 発行 seal lands on it. The pass is the profile's own object
// (components/profile/CommuterPass.jsx) with the holder at level one
// and the balance on its foot -- a new account's SIGNUP_BONUS, the
// welcome core/credits.py grants on first read. It is above the cap, so
// the line prints the figure without one (domain/credits' showsCap).
// "Enter the station" posts the whole contract; the gate then opens
// (App.jsx's TicketGate finale).

function PrintedHolder({ name }) {
  const r = 42
  const circumference = 2 * Math.PI * r
  return (
    <div className="pass__holder">
      <div className="pass__avatar-wrap">
        <svg className="pass__ring" viewBox="0 0 96 96" aria-hidden="true">
          <circle className="pass__ring-track" cx="48" cy="48" r={r} />
          <circle className="pass__ring-fill" cx="48" cy="48" r={r} strokeDasharray={circumference} strokeDashoffset={circumference} />
        </svg>
        <div className="pass__avatar">{name.charAt(0).toUpperCase()}</div>
      </div>
      <span className="profile-card__name">{name}</span>
    </div>
  )
}

// The balance line as the boarding prints it: the store's answer when
// it has one, and the welcome -- what a fresh account holds -- until
// then. Same classes as components/credits/BalanceLine.jsx, so
// the profile and the boarding print the same line.
function PrintedBalance() {
  const { t } = useLang()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const refill = credits?.dailyRefill ?? DAILY_REFILL
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  return (
    <div className="jour-line balance-line">
      <span className="jour-line__status"><b className="balance-line__word">{t.balanceLabel}</b></span>
      <span className="jour-line__validity">
        <b>{balance == null ? '∞' : balance}</b>
        {balance != null && (
          <span className="jour-cap">
            {showsCap(balance, cap) ? `/ ${cap} ` : ''}{t.creditsUnit}
          </span>
        )}
      </span>
      {balance != null && <span className="jour-cap balance-line__refill">{t.balanceRefillLine(refill, '00:00')}</span>}
    </div>
  )
}

export default function PassStep({ name, profile, onEnter, busy = false, error = false }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body brd__body--arrival">
        <div className="brd-offer">
          <h1 className="brd__q" tabIndex={-1}>
            <Emphasized text={t.brdPassQ(name)} strongClassName="brd__q-em" />
          </h1>
          <p className="brd__hint">{t.brdEnjoy}</p>
        </div>
        <BoardAir />
        <div className="brd__stage">
          <div className="brd-issue">
            <CommuterPass profile={{ ...profile, username: name }} t={t} footer={<PrintedBalance />} headingTag="span">
              <PrintedHolder name={name} />
            </CommuterPass>
            <span className="brd-issue__seal" lang="ja" role="img" aria-label={t.brdIssued}>発行</span>
          </div>
        </div>
      </div>
      <div className="brd__foot">
        {error && <p className="brd__error" role="alert">{t.onbPassError}</p>}
        <Continue label={t.brdEnter} onClick={onEnter} disabled={busy} data-action="enter" />
      </div>
    </>
  )
}
