import { useState } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'
import { Loading } from '../ui/Loading'
import { useCredits } from '../../stores/credits'
import { fareFor, runFit, DAILY_REFILL } from '../../domain/credits'

// ── 改札 — the fare gate ─────────────────────────────────────
// What NextService's strip grew into when the wall map replaced the
// departure board: the day's reviews as a card of their own, first
// thing in the hall, with the screen's one filled action on it. The
// strip's framing survives — this is the train leaving NOW, above
// everywhere you could go later — it just stopped being a single
// line squeezed over a board that no longer exists.
//
// Two manners carry over from the strip it replaces: nothing is
// rendered after the fetch failed (a broken gate shouting an error
// above the map would be worse than its absence — the hall's notice
// line owns up instead), and a cleared queue does not blank the card
// — "next review in 3 hours" is what makes an empty gate read as a
// finished day rather than a broken one. The wait itself is drawn
// (plan 067): the card's name over the three dots until /api/today
// answers, so the phone's first screen never opens on a hole where
// the gate will be.
//
// The fare (plan 069): the gate prices the run against the balance
// before departure — Fare · n credits · Balance — and when the balance
// is short says how many ride today and how many wait for tomorrow's
// refill. The gate only CLOSES (the button disabled at zero) under
// enforcement; in shadow mode the line is information and the train
// leaves. A pass prints no balance and no notice.

/** "00:00" — the next refill, on the learner's clock. */
function refillClock(iso, lang) {
  if (!iso) return '00:00'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '00:00'
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
}

function Fare({ due, credits, t, lang }) {
  if (!credits) return null
  const balance = credits.unlimited ? null : credits.balance
  const fare = fareFor(due)
  const { rides, waits } = runFit(due, balance)
  return (
    <>
      <div className="gate-card__fare">
        <span>{t.fareLabel}</span>
        <b>{fare}</b>
        <span>{t.creditsUnit}</span>
        <span className="gate-card__fare-sep" aria-hidden="true" />
        <span>{t.balanceLabel}</span>
        <b className="fare-gold">{balance == null ? '∞' : balance}</b>
      </div>
      {balance != null && waits > 0 && (
        <div className="gate-card__short" role="status">
          <span className="gate-card__short-mark" aria-hidden="true">!</span>
          <span>
            {balance === 0
              ? t.gateNoCredits(credits.dailyRefill ?? DAILY_REFILL, refillClock(credits.refillAt, lang))
              : t.gateShort(rides, due, waits)}
          </span>
        </div>
      )}
    </>
  )
}

/** "in 3 hours" / "tomorrow", in the UI's language. */
function untilNext(iso, lang) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  const mins = Math.round(ms / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (mins < 60) return rtf.format(Math.max(1, mins), 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export default function GateCard({ today, failed }) {
  const { t, lang } = useLang()
  // The 内訳 disclosure is a phone affordance: CSS collapses the lane
  // rows under 560px and shows the toggle instead, so the phone's
  // first screen is card, count, button, map. Desktop never sees it.
  const [open, setOpen] = useState(false)
  const credits = useCredits()

  if (failed) return null
  if (!today) {
    return (
      <div className="gate-card gate-card--waiting" aria-busy="true">
        <div className="gate-card__head">
          <span className="gate-card__name">
            <span className="gate-card__jp" lang="ja">改札</span>
            <span className="gate-card__latin">{t.todayTitle}</span>
          </span>
        </div>
        <Loading tight />
      </div>
    )
  }

  const due = today.total ?? 0
  const when = untilNext(today.next_due, lang)
  // Closed only under enforcement, and only at zero: the gate never
  // blocks in shadow mode (plan 069).
  const closed = Boolean(credits?.enforced && !credits.unlimited && credits.balance === 0)

  // At most three, largest first — the point is "here is what is
  // waiting", not a second stats screen. The rest is on /today.
  const lanes = [...(today.lanes ?? [])].sort((a, b) => b.due - a.due).slice(0, 3)

  // Same tap the board rows used to make: the announcement, then the
  // gate. /today has no clip in public/sounds/announcements, so
  // playAnnouncement plays the jingle alone and degrades exactly the
  // way it is built to.
  function depart() {
    playAnnouncement('today')
    beginDeparture(sectionFor('/today', t))
  }

  if (due === 0) {
    return (
      <div className="gate-card gate-card--clear">
        <div className="gate-card__head">
          <span className="gate-card__name">
            <span className="gate-card__jp" lang="ja">改札</span>
            <span className="gate-card__latin">{t.todayTitle}</span>
          </span>
        </div>
        <span className="gate-card__clear">{t.todayNothingDueShort}</span>
        {when && <span className="gate-card__when">{t.todayNextReview(when)}</span>}
      </div>
    )
  }

  return (
    <div className="gate-card">
      <div className="gate-card__head">
        <span className="gate-card__name">
          <span className="gate-card__jp" lang="ja">改札</span>
          <span className="gate-card__latin">{t.todayTitle}</span>
        </span>
        <span className="gate-card__figure">
          <span className="gate-card__count">{due}</span>
          <span className="gate-card__unit" lang="ja">件</span>
        </span>
      </div>

      <button
        type="button"
        className="gate-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="gate-card__toggle-jp" lang="ja">内訳</span>
        <span className="gate-card__toggle-latin">{t.breakdown}</span>
        <span className="gate-card__chev" aria-hidden="true">▾</span>
      </button>

      <div className={`gate-card__lanes${open ? ' gate-card__lanes--open' : ''}`}>
        {lanes.map(lane => (
          <span
            key={`${lane.kind}:${lane.deck ?? lane.deck_id}:${lane.mode}`}
            className="gate-lane"
            style={{ '--lane-color': LINE_COLOR[lane.kind === 'personal' ? 'personal' : lane.source] }}
          >
            <span className="gate-lane__rail" aria-hidden="true" />
            <span className="gate-lane__where">
              {lane.kind === 'personal' ? lane.deck_name : (
                lane.source === 'kana' ? kanaSetLabel(t, lane.deck) : lane.deck
              )}
            </span>
            <span className="gate-lane__mode">{modeLabel(t, lane.mode)}</span>
            <span className="gate-lane__due">{lane.due}</span>
          </span>
        ))}
      </div>

      <Fare due={due} credits={credits} t={t} lang={lang} />

      <button type="button" className="btn-depart" onClick={depart} aria-label={t.todayDue(due)} disabled={closed}>
        <span className="btn-depart__jp" lang="ja">出発する</span>
        <span className="btn-depart__latin">{t.depart}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
    </div>
  )
}
