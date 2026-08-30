import { useEffect, useState } from 'react'
import { apiJson } from '../../lib/api'
import { useLang } from '../../LangContext'
import { ChevronIcon } from '../ui/Icons'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
// The line colour each section already owns everywhere else it appears
// — so a lane chip is recognisably "the kanji one" at a glance rather
// than a generic tag. Shared with TodayScreen, which paints the same
// five lanes; it was a second identical copy here until plan 060.
import { LINE_COLOR } from '../../config/navLinks'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'

// ── 本日の運行 — the next service ────────────────────────────
// A real departure board's top row is the train leaving NOW; the rest
// of the board is where you could go later. This app's board listed
// twelve destinations of equal weight, so the one thing the learner
// actually owes attention to — the reviews the scheduler has already
// decided are due — had no place on the screen at all. It was
// reachable, but only by picking a section, then a level, then a mode,
// once per section.
//
// So this sits ABOVE the board rather than in it. Made a thirteenth row
// it would be another destination competing with the others, which is
// the exact framing that made the daily queue invisible in the first
// place.
//
// When nothing is due it does not disappear: an empty board is
// indistinguishable from a broken one, and "next review in 3 hours" is
// what makes a cleared queue read as a finished day.

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

export default function NextService({ session }) {
  const { t, lang } = useLang()
  const [today, setToday] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    apiJson('/api/today', session)
      .then(data => { if (live) setToday(data) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session])

  // Nothing at all while the first fetch is in flight, and nothing if it
  // failed: this is a HUD element on the concourse, and a broken one
  // shouting an error above the board would be worse than its absence.
  // The board below is fully usable either way.
  if (failed || !today) return null

  const due = today.total ?? 0
  const when = untilNext(today.next_due, lang)

  if (due === 0) {
    return (
      <div className="next-service next-service--clear">
        <span className="next-service__name">
          <span className="next-service__jp" lang="ja">本日の運行</span>
          <span className="next-service__latin">{t.todayTitle}</span>
        </span>
        <span className="next-service__clear">{t.todayNothingDueShort}</span>
        {when && <span className="next-service__when">{t.todayNextReview(when)}</span>}
        {today.pace && <PaceGauge pace={today.pace} t={t} />}
      </div>
    )
  }

  // At most three, largest first — the point is "here is what is
  // waiting", not a second stats screen. The rest is on /today.
  const lanes = [...(today.lanes ?? [])].sort((a, b) => b.due - a.due).slice(0, 3)

  // Same tap the board's own rows make (see HomeScreen's depart()):
  // the announcement, then the gate. /today has no clip in
  // public/sounds/announcements (it is not a board row -- see
  // navLinks.js), so playAnnouncement plays the jingle alone and
  // degrades exactly the way it is built to; the gate itself is
  // unaffected either way.
  function depart() {
    const section = sectionFor('/today', t)
    playAnnouncement('today')
    beginDeparture(section)
  }

  return (
    <button
      type="button"
      className="next-service"
      onClick={depart}
      aria-label={t.todayDue(due)}
    >
      {/* Home.dc.html lays this out as ONE line: the name, the figure,
          the lanes, and a chevron at the far end. It was a three-row
          stack with a gold bar down its left edge until the artboard
          round, where the maintainer called the stripe out of place and
          asked for something that reads as a shortcut. No __head wrapper
          now -- the row IS the layout. */}
      <span className="next-service__name">
        <span className="next-service__jp" lang="ja">本日の運行</span>
        <span className="next-service__latin">{t.todayTitle}</span>
      </span>
      <span className="next-service__count">{due}</span>

      <span className="next-service__lanes">
        {lanes.map(lane => (
          <span
            key={`${lane.kind}:${lane.deck ?? lane.deck_id}:${lane.mode}`}
            className="next-service__lane"
            style={{ '--lane-color': LINE_COLOR[lane.kind === 'personal' ? 'personal' : lane.source] }}
          >
            <span className="next-service__lane-where">
              {lane.kind === 'personal' ? lane.deck_name : (
                lane.source === 'kana' ? kanaSetLabel(t, lane.deck) : lane.deck
              )}
            </span>
            <span className="next-service__lane-mode">{modeLabel(t, lane.mode)}</span>
            <span className="next-service__lane-due">{lane.due}</span>
          </span>
        ))}
      </span>

      {/* The affordance the artboard ends the row with, and the thing
          that makes it read as a shortcut rather than a readout. */}
      <ChevronIcon direction="right" size={14} className="next-service__go" />
    </button>
  )
}

// ── 新規 — the day's new-item gauge ──────────────────────────
// The onboarding pace (user_profiles.daily_new_target), spent live:
// how many new items today's study has introduced against the target
// the learner chose at the ticket office. Renders nothing for an
// account with no stored pace (today.pace is null) — the strip looks
// exactly as it always has. The bar is progress toward the target;
// past it (the 臨時列車 ran) the count keeps counting while the bar
// stays full, because "12 / 10" is information and a bar over 100%
// is noise.
function PaceGauge({ pace, t }) {
  const pct = Math.min(100, Math.round((100 * pace.newToday) / Math.max(1, pace.target)))
  const met = pace.newToday >= pace.target
  return (
    <span className="next-service__pace" role="img" aria-label={t.paceGaugeAria(pace.newToday, pace.target)}>
      <span className="next-service__pace-name">
        <span className="next-service__pace-jp" lang="ja">新規</span>
        <span className="next-service__pace-latin">{t.paceGaugeLabel}</span>
      </span>
      <span className="next-service__pace-bar" aria-hidden="true">
        <span className="next-service__pace-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="next-service__pace-count" aria-hidden="true">
        {pace.newToday}<span className="next-service__pace-sep"> / </span>{pace.target}
      </span>
      {/* The day's target met — the same gold pill language the
          onboarding uses for "recommended", meaning "this is the
          good outcome" at a glance. Decorative; the aria-label above
          already carries the numbers. */}
      {met && <span className="onb-reco-badge next-service__pace-met" aria-hidden="true">済</span>}
    </span>
  )
}
