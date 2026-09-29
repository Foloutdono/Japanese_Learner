import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { SIGNUP_BONUS } from '../../domain/credits'
import { Mark } from '../ui/Mark'

// ── 乗車券 — the ticket an account keeps (plan 163) ──────────────
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

// ── 乗車券 on a phone (plan 168) ─────────────────────────────────
// The owner's A-Compte: the same ticket at a phone's width, the route
// across its top -- 辻, the departure; the kana when there are kana to
// read; the terminus -- each with its day under it, the service and the
// hour at its foot, and the stub the welcome's credits, punched. The
// same props as PaperTicket.
//
// On the ticket's own map (its body, 284px on the canvas): the route
// from the departure's ring to the terminus's, the kana's kept a third
// of the way from either end so the three days under it read apart.
const TK_X0 = 26
const TK_X1 = 236
const TK_W = 284

export function RideTicket({ now, figures, goal, rhythm, time }) {
  const { t, lang } = useLang()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const short = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const long = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  const toNovice = goal === 'novice'
  const total = Math.max(1, figures.days)
  const kanaDays = figures.kana > 0 && !toNovice ? Math.min(total, Math.ceil(figures.kana / Math.max(1, rhythm))) : 0
  const kanaAt = kanaDays > 0 ? Math.min(0.63, Math.max(0.37, kanaDays / total)) : null
  const kanaDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + kanaDays)
  const x = at => TK_X0 + at * (TK_X1 - TK_X0)
  const stops = [
    { key: 'start', at: 0, glyph: '辻', ja: true, day: short.format(now) },
    ...(kanaAt != null ? [{ key: 'kana', at: kanaAt, glyph: 'あ', ja: true, day: short.format(kanaDate) }] : []),
    { key: 'end', at: 1, glyph: toNovice ? 'あ' : goal, ja: toNovice, day: long.format(figures.date) },
  ]
  return (
    <section className="brd-tk" aria-label={t.brdTicketKind}>
      <div className="brd-tk__body">
        <p className="brd-tk__top">
          <span className="brd-tk__kind">{t.brdTicketKind}</span>
          <span className="brd-tk__date">{t.brdIssued(short.format(now))}</span>
        </p>
        <div className="brd-tk__map">
          <svg className="brd-tk__lines" viewBox={`0 0 ${TK_W} 64`} preserveAspectRatio="none" aria-hidden="true">
            <path className="brd-tk__ride" d={`M${TK_X0} 22H${TK_X1}`} />
          </svg>
          {stops.map(stop => (
            <span
              key={stop.key}
              className={`brd-tk__stop brd-tk__stop--${stop.key}`}
              // A plain number, placed by the sheet: the stop's centre.
              style={{ '--x': x(stop.at) }}
            >
              <span className="brd-tk__ring" lang={stop.ja ? 'ja' : undefined}>{stop.glyph}</span>
              <span className="brd-tk__day">{stop.day}</span>
            </span>
          ))}
        </div>
        <dl className="brd-tk__terms">
          <div className="brd-tk__term">
            <dt>{t.brdTermService}</dt>
            <dd>{t.brdServiceValue(t.brdRhythmName[rhythm] ?? '', rhythm)}</dd>
          </div>
          <div className="brd-tk__term">
            <dt>{t.brdDeparture}</dt>
            <dd>{time}</dd>
          </div>
        </dl>
      </div>
      <div className="brd-tk__stub">
        <b className="brd-tk__credits">{balance == null ? '∞' : balance.toLocaleString(lang)}</b>
        <span className="brd-tk__unit">{balance === SIGNUP_BONUS ? t.brdCreditsOffered : t.creditsUnit}</span>
        <span className="brd-tk__punch" aria-hidden="true">{t.brdPunched}</span>
      </div>
    </section>
  )
}
