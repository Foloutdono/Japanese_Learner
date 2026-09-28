import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { SIGNUP_BONUS } from '../../domain/credits'
import { Mark } from '../ui/Mark'

// ── 乗車券 — the ticket an account keeps (plan 161) ──────────────
// The owner's D09 on the desk: beside the account's form, what it would
// keep -- the learner's ticket, printed with the ride to scale from the
// plan's own figures (the departure, the kana when there are kana to
// read, the terminus and its date), the service and the hour it rides
// at, and valid until it arrives. The stub is the balance, the welcome
// named as given while the balance is the welcome itself (PassStep's
// PrintedBalance says the same); the stub's punch is the gate's.
//
//   name     the holder
//   now      the day the ticket is issued, and the ride leaves
//   figures  the plan's (domain/boarding planFigures)
//   goal     the terminus -- a JLPT stop or the novice's own, the kana
//   rhythm   minutes a day, which name the service
//   time     the departure, hh:mm, and `hour` the part of the day it is in
export function PaperTicket({ name, now, figures, goal, rhythm, time, hour }) {
  const { t, lang } = useLang()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const short = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const long = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  const toNovice = goal === 'novice'
  const total = Math.max(1, figures.days)
  const kanaDays = figures.kana > 0 && !toNovice ? Math.min(total, Math.ceil(figures.kana / Math.max(1, rhythm))) : 0
  // Where the kana stand on the route: their own day, kept a third of
  // the route from either end so the names under the three read apart
  // on a ticket a laptop prints narrower.
  const kanaAt = kanaDays > 0 ? Math.min(0.68, Math.max(0.32, kanaDays / total)) : null
  const kanaDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + kanaDays)
  return (
    <section className="desk-brd__tkt">
      <div className="desk-brd__tkt-stub">
        <span className="desk-brd__tkt-cap">{t.balanceLabel}</span>
        <b className="desk-brd__tkt-bal">{balance == null ? '∞' : balance.toLocaleString(lang)}</b>
        <span className="desk-brd__tkt-sub">{balance === SIGNUP_BONUS ? t.brdCreditsOffered : t.creditsUnit}</span>
        <span className="desk-brd__tkt-punch" aria-hidden="true" />
        <span className="desk-brd__tkt-cap">{t.brdPunched}</span>
      </div>
      <div className="desk-brd__tkt-main">
        <div className="desk-brd__tkt-head">
          <span className="desk-brd__tkt-kind">
            <b className="desk-brd__tkt-jp" lang="ja">乗車券</b>
            <span className="desk-brd__tkt-cap">{t.brdTicketKind}</span>
          </span>
          <Mark className="desk-brd__tkt-mark" />
        </div>
        <div className="desk-brd__tkt-who">
          <span className="desk-brd__tkt-name">{name}</span>
          <span className="desk-brd__tkt-issued">{t.brdIssued(long.format(now))}</span>
        </div>
        <ol className="desk-brd__tkt-route">
          <li className="desk-brd__tkt-stop desk-brd__tkt-stop--start" style={{ '--at': 0 }}>
            <span className="desk-brd__tkt-dot" aria-hidden="true" />
            <b className="desk-brd__tkt-at">{t.brdStop.time}</b>
            <span className="desk-brd__tkt-day">{short.format(now)}</span>
          </li>
          {kanaAt != null && (
            <li className="desk-brd__tkt-stop desk-brd__tkt-stop--kana" style={{ '--at': kanaAt }}>
              <span className="desk-brd__tkt-dot" lang="ja" aria-hidden="true">あ</span>
              <b className="desk-brd__tkt-at">{t.kanaTitle}</b>
              <span className="desk-brd__tkt-day">{short.format(kanaDate)}</span>
            </li>
          )}
          <li className="desk-brd__tkt-stop desk-brd__tkt-stop--end" style={{ '--at': 1 }}>
            <span className="desk-brd__tkt-dot" lang={toNovice ? 'ja' : undefined} aria-hidden="true">{toNovice ? 'あ' : goal}</span>
            <b className="desk-brd__tkt-at">{toNovice ? t.kanaTitle : `JLPT ${goal}`}</b>
            <span className="desk-brd__tkt-day">{long.format(figures.date)}</span>
          </li>
        </ol>
        <dl className="desk-brd__tkt-terms">
          <div className="desk-brd__tkt-term">
            <dt className="desk-brd__tkt-cap">{t.brdTermService}</dt>
            <dd>{t.brdServiceValue(t.brdRhythmName[rhythm] ?? '', rhythm)}</dd>
          </div>
          <div className="desk-brd__tkt-term">
            <dt className="desk-brd__tkt-cap">{t.brdTermRoute}</dt>
            <dd>{time ? `${t.destHour[hour] ?? ''} · ${time}` : t.destHour[hour]}</dd>
          </div>
          <div className="desk-brd__tkt-term desk-brd__tkt-term--valid">
            <dt className="desk-brd__tkt-cap">{t.brdTermValid}</dt>
            <dd>{long.format(figures.date)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
