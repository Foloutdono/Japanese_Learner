import { useState } from 'react'
import { useLang } from '../LangContext'
import { useDesk } from '../hooks/useDesk'
import { Bar, Leave } from '../components/chrome/Bar'
import { Loading } from '../components/ui/Loading'
import { useProfileSummaryState } from '../stores/profileSummary'
import { InkFilters, Ticket, GateButton } from '../components/dayclear/kit'
import { dayMonth } from '../components/dayclear/aria'
import { useReducedMotion } from '../components/dayclear/useReducedMotion'
import { milestoneLadder, ticketName, ticketDate, ticketNumber, daysBefore } from '../domain/dayClear'
import { shareTicket } from '../lib/shareTicket'

// ── 記念切符 — Profile › Billets (plan 191) ───────────────────────────
// The canvas's Collection board: the tickets a streak has earned (3, 7
// and 14 days on paper, the month's and after in gold), the ones ahead
// dashed and locked (the next with how far it is), the record marked,
// the chosen ticket held up large with its run's dates, and "Partager ce
// billet". /profile/tickets, a hall behind the pass, under the chrome.
//
// PLACEHOLDER (foundation): the list and the chosen ticket, static. The
// tickets' screen agent ports the board and owns the `tickets` /
// `desk-tickets` regions of index.css and the `clrTickets` locale group.
//
// Props:
//   session   the learner's (for the share's profile figures, if needed)
//   profile   GET /api/profile's answer, for the workbench (default: the
//             shared profile summary): { tickets: [{ days, day }],
//             streak, streakLongest, restHeld, nextMilestone, … }
//   reduced   the rest state at once (default: prefers-reduced-motion)
export default function TicketsScreen({ profile: profileProp, reduced: reducedProp }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const reduced = useReducedMotion(reducedProp)
  const { summary } = useProfileSummaryState()
  const profile = profileProp ?? summary
  const tickets = profile?.tickets ?? []
  const longest = profile?.streakLongest ?? 0
  const record = tickets.reduce((best, k) => (k.days > (best?.days ?? 0) ? k : best), null)
  const [chosen, setChosen] = useState(null)
  const held = tickets.find(k => k.days === chosen) ?? record

  return (
    <main id="main-content" className={['tkb', desk && 'tkb--desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <InkFilters />
      <Bar title={t.tkbTitle} color="var(--stamp-ink)" aside={<Leave to="/profile">{t.profileTitle}</Leave>} />
      {!profile && <Loading />}
      {profile && held && (
        <section className="tkb__hero" aria-label={t.tkbChosenAria}>
          <Ticket
            days={held.days} date={ticketDate(held.day)} caption={t.clrTicketCaption(held.days)}
            material={held.days >= 30 ? 'gold' : 'paper'}
            label={t.tkbTicketAria(held.days, ticketNumber(held.days), rangeOf(held, t, lang), held === record)}
          />
          {held === record && <span className="tkb__pill">{t.tkbRecord}</span>}
          <span className="tkb__range">{rangeOf(held, t, lang)}</span>
        </section>
      )}
      {profile && (
        <ol className="tkb__book" aria-label={t.tkbBookAria(tickets.length, milestoneLadder(longest).length)}>
          {milestoneLadder(longest).map(days => {
            const earned = tickets.find(k => k.days === days)
            const next = !earned && days === profile.nextMilestone
            return (
              <li key={days}>
                {earned ? (
                  <button
                    type="button" className="tkb__cell" aria-current={held?.days === days ? 'true' : 'false'}
                    aria-label={t.tkbCellAria(days, earned === record)} onClick={() => setChosen(days)}
                  >
                    <span lang="ja">{ticketName(days)}</span> <span>{t.tkbDaysShort(days)}</span>
                  </button>
                ) : (
                  <div className="tkb__cell tkb__cell--locked" role="img" aria-label={t.tkbLockedAria(days, next ? days - (profile.streak ?? 0) : null)}>
                    <span lang="ja" aria-hidden="true">{ticketName(days)}</span> <span aria-hidden="true">{t.tkbDaysShort(days)}</span>
                    {next && <span className="tkb__pill" aria-hidden="true">{t.tkbIn(days - (profile.streak ?? 0))}</span>}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {held && (
        <GateButton
          compact label={t.tkbShareTicket}
          onClick={() => shareTicket({ days: held.days, day: held.day, from: daysBefore(held.day, held.days - 1), t, figures: profile?.shareFigures })}
        />
      )}
    </main>
  )
}

// "du 12 au 25 septembre": the run that earned the ticket, from its first
// day to the day it was earned.
function rangeOf(ticket, t, lang) {
  const from = daysBefore(ticket.day, ticket.days - 1)
  const sameMonth = from.slice(0, 7) === ticket.day.slice(0, 7)
  return t.tkbRange(dayMonth(from, lang, !sameMonth), dayMonth(ticket.day, lang))
}
