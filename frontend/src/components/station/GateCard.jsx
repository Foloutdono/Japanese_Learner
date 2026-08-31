import { useState } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/navLinks'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'

// ── 改札 — the fare gate ─────────────────────────────────────
// What NextService's strip grew into when the wall map replaced the
// departure board: the day's reviews as a card of their own, first
// thing in the hall, with the screen's one filled action on it. The
// strip's framing survives — this is the train leaving NOW, above
// everywhere you could go later — it just stopped being a single
// line squeezed over a board that no longer exists.
//
// The same two manners carry over from the strip it replaces:
// nothing is rendered while the first fetch is in flight or after it
// failed (a broken gate shouting an error above the map would be
// worse than its absence), and a cleared queue does not blank the
// card — "next review in 3 hours" is what makes an empty gate read
// as a finished day rather than a broken one.

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

  if (failed || !today) return null

  const due = today.total ?? 0
  const when = untilNext(today.next_due, lang)

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

      <button type="button" className="btn-depart" onClick={depart} aria-label={t.todayDue(due)}>
        <span className="btn-depart__jp" lang="ja">出発する</span>
        <span className="btn-depart__latin">{t.depart}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
    </div>
  )
}
