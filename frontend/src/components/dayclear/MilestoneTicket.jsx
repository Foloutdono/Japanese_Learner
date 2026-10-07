import { useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playMilestone } from '../../lib/audio'
import { EnterKey } from '../chrome/DeskKeys'
import { ClearHeader, WeekStamps, XpTotal, Ticket, Slot, GateButton } from './kit'
import { longDate, weekParts } from './aria'

// ── 記念乗車券 — a streak's ticket: 3, 7 and 14 days (plan 191) ───────
// The canvas's Milestone-7 board: it begins where the day's stamp ends.
// The seventh slot pressed, the stamps light in a wave along a line with
// a gold ring (the full week), the streak rolls; the ticket machine
// feeds the paper 硬券 out in three jerks, the clipper bites its notch
// (a true cutout) and the chip falls; +250 rises off the ticket into
// the fare (run, prime, billet) counted to its total; at 7 and 14 a
// 運休 stub slides out ("+1 jour de repos"); the gate "Garder le billet".
// On the desk the composition stands centred at the phone board's width
// in the content area beside the rail.
//
// PLACEHOLDER (foundation): the rest state, static. The screen agent
// ports the board and owns the `milestones` / `desk-milestones` regions
// of index.css and the `clrMilestones` locale group.
//
// Props:
//   result, run, model   as ClearPhone's (model.ticket = { days, date };
//                        model.rest.earned says whether a rest day came)
//   desk       drawn in the desk's content area
//   reduced    the rest state at once
//   onFareBeat()  the fare has landed (a level-up then plays)
//   onKeep()   "Garder le billet": back to the gate
//   onShare()  share this ticket (lib/shareTicket)
export default function MilestoneTicket({ result, model, desk, reduced, onFareBeat, onKeep }) {
  const { t, lang } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playMilestone()
    onFareBeat?.()
  }, [onFareBeat])

  const { fare, ticket } = model
  const full = model.week.every(d => d.state === 'studied')
  return (
    <main id="main-content" className={['ms-ticket', desk && 'ms-ticket--desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <ClearHeader center cap="本日の運行 終了" title={t.clrTitle} />
      <WeekStamps week={model.week} gold={full} label={t.clrWeekAria(weekParts(model.week, t, lang))} />
      <p className="ms-ticket__streak">{t.clrStreakDays(model.streak)}</p>
      <div className="ms-ticket__fare">
        <XpTotal value={fare.total} shine={!reduced} />
        <p>
          <span><b>+{fare.run}</b> {t.clrFareRun}</span> · <span><b>+{fare.bonus}</b> {t.clrFarePrime}</span> · <span><b>+{fare.jackpot}</b> {t.clrFareTicket}</span>
        </p>
      </div>
      {ticket && (
        <div className="ms-ticket__tk">
          <Ticket
            days={ticket.days} date={ticket.date} caption={t.clrTicketCaption(ticket.days)}
            label={t.clrTicketAria(ticket.days, String(ticket.days).padStart(4, '0'), longDate(result.day, lang))}
          />
        </div>
      )}
      {model.rest.earned && (
        <div className="ms-ticket__rest">
          <Slot state="rest" aria-hidden="true" />
          <p><b>+1</b> {t.msRestEarned}<br />{t.msRestNote}</p>
        </div>
      )}
      <GateButton compact arrive keys={desk} label={t.clrKeep} onClick={onKeep} className="ms-ticket__gate" />
      <EnterKey onEnter={onKeep} />
    </main>
  )
}
