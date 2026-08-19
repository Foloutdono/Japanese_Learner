import { useEffect, useState } from 'react'
import { apiJson } from '../../lib/api'
import { useLang } from '../../LangContext'
import { BoltIcon } from '../ui/Icons'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
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

// The line colour each section already owns everywhere else it appears
// (see config/navLinks.js) — so a lane chip is recognisably "the kanji
// one" at a glance rather than a generic tag.
const LINE_COLOR = {
  kana:    'var(--line-kana)',
  vocab:   'var(--line-vocab)',
  kanji:   'var(--line-kanji)',
  grammar: 'var(--line-grammar)',
  personal: 'var(--line-decks)',
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
      <span className="next-service__head">
        {/* Japanese above/beside, plain language under — the same
            pairing the board masthead, every station plate and every
            section header already use. The strip was the one place
            naming itself only in kanji. */}
        <span className="next-service__name">
          <span className="next-service__jp" lang="ja">本日の運行</span>
          <span className="next-service__latin">{t.todayTitle}</span>
        </span>
        <span className="next-service__count">
          <BoltIcon size={13} /> {due}
        </span>
      </span>

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
    </button>
  )
}
