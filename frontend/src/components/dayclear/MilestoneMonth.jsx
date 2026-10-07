import { useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playMilestone } from '../../lib/audio'
import { EnterKey } from '../chrome/DeskKeys'
import { XpTotal, Ticket, QuietButton, GateButton } from './kit'
import { longDate } from './aria'
import Fireworks from './Fireworks'

// ── 一ヶ月 — the month, and every one after (plan 191) ─────────────────
// The canvas's Milestone-30 board, the showpiece (~10s): dusk deepening
// to night with faint stars; the month's スタンプ帳 (a 5×7 paper sheet,
// days 1–29 inked in a fast wave, the 30th empty and glowing) and the
// big 「三十」 stamp slammed onto it; the sheet sinks and the station's
// roof rises lit; 花火 (Fireworks); the gold-foil ticket flips in, its
// sheen looping, its notch punched by the clipper; +1 000 rolls like an
// odometer, then the total with its breakdown; "Garder le billet" (the
// gate) and "Partager" (quiet). Tier "month": streak 30, 50, 100, 200,
// 365 and every 100 after. On the desk the night and the fireworks span
// the whole content area, the composition centred at the phone's width.
//
// PLACEHOLDER (foundation): the rest state, static, on the plain ground.
// The milestones' screen agent ports the board here.
//
// Props: as MilestoneTicket's (result, run, model, desk, reduced,
// onFareBeat, onKeep, onShare).
export default function MilestoneMonth({ result, model, desk, reduced, onFareBeat, onKeep, onShare }) {
  const { t, lang } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playMilestone()
    onFareBeat?.()
  }, [onFareBeat])

  const { fare, ticket } = model
  const no = String(ticket?.days ?? 0).padStart(4, '0')
  return (
    <main id="main-content" className={['ms-month', desk && 'ms-month--desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <Fireworks play={false} />
      {ticket && (
        <div className="ms-month__tk">
          <Ticket
            material="gold" days={ticket.days} date={ticket.date} caption={t.clrTicketCaption(ticket.days)}
            label={ticket.days === 30 ? t.msTicketMonthAria(no, longDate(result.day, lang)) : t.clrTicketAria(ticket.days, no, longDate(result.day, lang))}
          />
        </div>
      )}
      <div className="ms-month__fare">
        <XpTotal value={fare.total} shine={!reduced} label={t.msTotalAria(fare.total, fare.run, fare.bonus, fare.jackpot)} />
        <p>
          <span><b>+{fare.run}</b> {t.clrFareRun}</span> · <span><b>+{fare.bonus}</b> {t.clrFarePrime}</span> · <span><b>+{fare.jackpot}</b> {t.clrFareTicket}</span>
        </p>
      </div>
      <div className="ms-month__actions">
        <QuietButton onClick={onShare}>{t.clrShare}</QuietButton>
        <GateButton compact arrive keys={desk} label={t.clrKeep} onClick={onKeep} />
      </div>
      <EnterKey onEnter={onKeep} />
    </main>
  )
}
