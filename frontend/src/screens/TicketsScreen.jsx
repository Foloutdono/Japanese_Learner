import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useDesk } from '../hooks/useDesk'
import { apiJson } from '../lib/api'
import { Loading } from '../components/ui/Loading'
import { EnterKey } from '../components/chrome/DeskKeys'
import { useProfileSummaryState } from '../stores/profileSummary'
import { Ticket, GateButton, ClearHeader, useBeats } from '../components/dayclear/kit'
import { dayMonth } from '../components/dayclear/aria'
import { useReducedMotion } from '../components/dayclear/useReducedMotion'
import { milestoneLadder, ticketName, ticketDate, ticketNumber, daysBefore, utcToday } from '../domain/dayClear'
import { renderTicketPng, shareTicket, shareFigures } from '../lib/shareTicket'

// ── 記念切符 — Profile › Billets (plan 191) ───────────────────────────
// The canvas's Collection board: the ticket held up large (the record,
// at first), its record pill and the run's dates under it; the book of
// tickets a streak pays -- 3, 7 and 14 days on paper, the month's and
// after in gold -- the earned ones as small 硬券 with their notch, the
// ones ahead dashed and waiting, the next tagged with how far it is;
// picking a kept ticket flips it into the hero; and the gate "Partager
// ce billet", which hands the share image (lib/shareTicket.js) to the
// system's share sheet or downloads it. /profile/tickets, a hall behind
// the pass, under the chrome. A learner with no ticket yet sees the
// first one dashed in the hero's place, named, with how far it is, and
// the gate to the day's run.
//
// The way in, on the board's clock: the ticket flips in, the line under
// it waits until it stands square, the book arrives a cell at a time,
// the gate last. A tap anywhere skips to the rest; reduced motion fades
// the screen in and moves nothing. The `tickets` and `desk-tickets`
// regions of index.css (.tkb-*), the `clrTickets` locale group.
//
// Props:
//   session   the learner's (the share's words figure, from /api/stats)
//   profile   GET /api/profile's answer, for the workbench (default: the
//             shared profile summary): { tickets: [{ days, day }],
//             streak, streakLongest, restHeld, nextMilestone,
//             totalReviews, jlptLevel, … }
//   stats     GET /api/stats' answer, for the workbench (default: fetched)
//   reduced   the rest state at once (default: prefers-reduced-motion)

// The board's clock: the book's cells from 260ms, 30ms apart (the eighth
// the last to wait), the gate at 520ms, at rest when it has landed.
const T_CELL = 260
const T_GATE = 520
const T_REST = 1200
const T_META = 360

const cls = (...names) => names.filter(Boolean).join(' ')

// "du 12 au 25 septembre": the run that earned the ticket, from its first
// day to the day it was earned.
function rangeOf(ticket, t, lang) {
  const from = daysBefore(ticket.day, ticket.days - 1)
  const sameMonth = from.slice(0, 7) === ticket.day.slice(0, 7)
  return t.tkbRange(dayMonth(from, lang, !sameMonth), dayMonth(ticket.day, lang))
}

export default function TicketsScreen({ session, profile: profileProp, stats: statsProp, reduced: reducedProp }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const reduced = useReducedMotion(reducedProp)
  const { summary } = useProfileSummaryState()
  const profile = profileProp ?? summary

  // The words figure for the share: the statistics' vocabulary line.
  const [stats, setStats] = useState(statsProp ?? null)
  useEffect(() => {
    if (statsProp || !session) return undefined
    let live = true
    apiJson('/api/stats', session).then(s => { if (live) setStats(s) }).catch(() => {})
    return () => { live = false }
  }, [session, statsProp])

  const tickets = profile?.tickets ?? []
  const streak = profile?.streak ?? 0
  const ladder = milestoneLadder(Math.max(profile?.streakLongest ?? 0, ...tickets.map(k => k.days)))
  // A milestone reached twice is one place in the book: its latest ticket.
  const kept = ladder.map(days => tickets.findLast(k => k.days === days)).filter(Boolean)
  const record = kept.at(-1) ?? null
  const next = profile?.nextMilestone ?? ladder.find(d => !kept.some(k => k.days === d)) ?? null
  const until = next != null ? Math.max(0, next - streak) : null

  // The ticket held up: the record on the way in, then the one picked.
  // `n` counts the picks, so each one replays the flip.
  const [pick, setPick] = useState({ days: null, n: 0 })
  const held = kept.find(k => k.days === pick.days) ?? record

  // The board's clock: what had arrived when a tap came stays put, the
  // rest fades in.
  const { skipped, skip, at } = useBeats([[T_REST, 1]], { final: 1, reduced })
  const t0 = useRef(0)
  const [skipT, setSkipT] = useState(0)
  useEffect(() => { t0.current = performance.now() }, [])
  const onSkip = () => {
    if (reduced || at(1)) return
    setSkipT(performance.now() - t0.current)
    skip()
  }
  const ent = (name, when) => (!skipped ? name : skipT < when ? 'clrk-fade' : null)
  const n = pick.n
  const alt = n % 2 ? 'b' : 'a'
  const heroAnim = reduced ? (n === 0 ? 'clrk-fade' : `tkb-f${alt}`) : n === 0 ? ent('tkb-flip-a', 0) : `tkb-flip-${alt}`
  const metaAnim = reduced ? (n === 0 ? 'clrk-fade' : `tkb-f${alt}`) : n === 0 ? ent('tkb-late-a', T_META) : `tkb-late-${alt}`
  const cellAnim = i => (reduced ? 'clrk-arrive' : ent('clrk-arrive', T_CELL + Math.min(i, 7) * 30))

  const choose = (days, e) => {
    e.stopPropagation()
    if (days === held?.days) return
    setPick(p => ({ days, n: p.n + 1 }))
  }

  // The image is drawn ahead of the tap, so the share sheet opens inside
  // the gesture that asked for it (a browser forgets the tap while a
  // canvas is drawn and fonts load).
  const figures = shareFigures(profile, stats)
  const input = held && { days: held.days, day: held.day, from: daysBefore(held.day, held.days - 1), stampDay: utcToday(), figures, t }
  const inputKey = held ? `${held.days}:${held.day}:${figures.reviews}:${figures.words}:${figures.level}:${lang}` : ''
  const [png, setPng] = useState(null)
  useEffect(() => {
    if (!input) return undefined
    let live = true
    renderTicketPng(input).then(blob => { if (live) setPng({ key: inputKey, blob }) }).catch(() => {})
    return () => { live = false }
    // Redrawn when what it prints changes (inputKey), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey])
  const [status, setStatus] = useState(null)
  const share = async () => {
    if (!input) return
    setStatus(null)
    const result = await shareTicket({ ...input, blob: png?.key === inputKey ? png.blob : undefined })
    setStatus(result)
  }

  const gateArrive = !reduced && !(skipped && skipT >= T_GATE)
  const back = desk
    ? <Link to="/profile" className="tkb-back" aria-label={t.tkbBack} onClick={e => e.stopPropagation()}><BackGlyph /></Link>
    : <button type="button" className="tkb-back" aria-label={t.tkbBack} onClick={e => { e.stopPropagation(); navigate('/profile') }}><BackGlyph /></button>

  return (
    <main
      id="main-content"
      className={cls('tkb', skipped && 'clrk--skip', reduced && 'clrk--reduced')}
      onClick={onSkip}
    >
      <div className={cls('tkb-head', reduced ? 'clrk-fade' : ent('clrk-fade', 0))}>
        <ClearHeader center cap="記念切符" title={t.tkbTitle} />
        {back}
      </div>

      {!profile && <Loading />}

      {profile && held && (
        <section className="tkb-hero" aria-label={t.tkbChosenAria}>
          <Ticket
            key={`${held.days}:${n}`}
            days={held.days}
            date={ticketDate(held.day)}
            caption={t.clrTicketCaption(held.days)}
            material={held.days >= 30 ? 'gold' : 'paper'}
            label={t.tkbTicketAria(held.days, ticketNumber(held.days), rangeOf(held, t, lang), held === record)}
            className={cls('tkb-ticket', heroAnim)}
          />
          <p key={`meta:${n}`} className={cls('tkb-meta', metaAnim)}>
            {held === record && <span className="tkb-pill">{t.tkbRecord}</span>}
            <span className="tkb-range">{rangeOf(held, t, lang)}</span>
          </p>
        </section>
      )}

      {profile && !held && next != null && (
        // No ticket yet: the first one dashed in the hero's place, named,
        // with how far it is -- and the one thing to do about it, below.
        <section className="tkb-hero" aria-label={t.tkbEmptyAria(next, until)}>
          <div className={cls('tkb-ghost', reduced ? 'clrk-fade' : ent('clrk-fade', 0))} aria-hidden="true">
            <span className="tkb-ghost__row">
              <span className="tkb-ghost__kind" lang="ja">記念乗車券</span>
              <span className="tkb-ghost__no">N° {ticketNumber(next)}</span>
            </span>
            <span className="tkb-ghost__big" lang="ja">{ticketName(next)}</span>
            <span className="tkb-ghost__sub">{t.clrTicketCaption(next)}</span>
          </div>
          <p className={cls('tkb-meta', reduced ? 'clrk-fade' : ent('tkb-late-a', T_META))}>
            <span className="tkb-pill">{until > 0 ? t.tkbIn(until) : t.tkbToday}</span>
            <span className="tkb-range">{t.tkbEmpty}</span>
          </p>
        </section>
      )}

      <span className="tkb-air" aria-hidden="true" />

      {profile && (
        <ol className="tkb-book" aria-label={t.tkbBookAria(kept.length, ladder.length)}>
          {ladder.map((days, i) => {
            const earned = kept.find(k => k.days === days)
            const isNext = days === next
            const tag = isNext && until != null && (
              <span className="tkb-pill tkb-tag" aria-hidden="true">{until > 0 ? t.tkbIn(until) : t.tkbToday}</span>
            )
            return (
              <li key={days} className={cls('tkb-cell', cellAnim(i))} style={{ '--d': `${T_CELL + Math.min(i, 7) * 30}ms` }}>
                {earned ? (
                  <button
                    type="button"
                    className={cls('tkb-pick', earned === held && 'tkb-pick--on')}
                    aria-current={earned === held ? 'true' : 'false'}
                    aria-label={t.tkbCellAria(days, earned === record)}
                    onClick={e => choose(days, e)}
                  >
                    <span className={cls('clrk-tk', days >= 30 ? 'clrk-tk--gold' : 'clrk-tk--paper', 'tkb-mini')} aria-hidden="true">
                      <span className="tkb-name" lang="ja">{ticketName(days)}</span>
                      <span className="tkb-days">{t.tkbDaysShort(days)}</span>
                    </span>
                  </button>
                ) : (
                  <div className={cls('tkb-slot', isNext && 'tkb-slot--next')} role="img" aria-label={t.tkbLockedAria(days, isNext ? until : null)}>
                    <span className="tkb-name" lang="ja" aria-hidden="true">{ticketName(days)}</span>
                    <span className="tkb-days" aria-hidden="true">{t.tkbDaysShort(days)}</span>
                  </div>
                )}
                {tag}
              </li>
            )
          })}
        </ol>
      )}

      <span className="tkb-air" aria-hidden="true" />

      {profile && (
        <div className={cls('tkb-foot', reduced && 'clrk-fade')}>
          {held ? (
            <GateButton compact arrive={gateArrive} arriveDelay={T_GATE} keys={desk} label={t.tkbShareTicket} onClick={share} />
          ) : (
            <GateButton compact arrive={gateArrive} arriveDelay={T_GATE} keys={desk} label={t.tkbEmptyGo} onClick={() => navigate('/today')} />
          )}
          {status === 'downloaded' && <p className="tkb-status" role="status">{t.tkbShareSaved}</p>}
          {status === 'failed' && <p className="tkb-status" role="status">{t.tkbShareFailed}</p>}
          <EnterKey onEnter={held ? share : () => navigate('/today')} />
        </div>
      )}
    </main>
  )
}

// The way back, bare: the board's chevron.
function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
