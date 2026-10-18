import { Fragment, useState } from 'react'
import { Seg } from '../chrome/Console'

// ── The ranking (canvas ProfileInserts, plan 074) ─────────────
// One list of rows: the rank in a roundel (gold, silver and bronze for
// the first three), the name, the XP. Two boards ride in: the last
// seven days and lifetime (通算). The head is the board's period tabs
// and nothing above them: the tabs name the board. The week is the one
// you can actually move tonight, so it is the one the board opens on.
// Only the week board's tabs render both periods; without it the head
// keeps the lifetime tab alone, so the board still says what it is.
//
// `entries` is the top N; `me` is the current user's own row, which
// the backend includes separately whenever they are not already inside
// that top N (see profile.py's get_leaderboard). Then they close the
// list after an elision row, exactly as before.
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }

function Row({ e, isMe, lang }) {
  const medal = MEDAL[e.rank]
  return (
    <div className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>
        {e.rank ?? '—'}
      </span>
      <span className="leaderboard-row__name">{e.username}</span>
      <span className="leaderboard-row__xp">{e.xp.toLocaleString(lang)} XP</span>
    </div>
  )
}

// `both` is the desk's (plan 115): the profile's record column has room
// for the two boards at once, so neither hides behind a toggle. Since
// plan 247 (the owner's pick A of the canvas "Tsuji — the profile on the
// desk") they are one board, the ranks down its middle: this week to
// their left, all time to their right, each name beside its rank and
// its XP at the board's edge. Side by side, the two boards were two
// heights whenever the learner's own row closed one and not the other,
// and stacked they ran the page past a laptop's window.
export function Banzuke({ all, week, t, lang, both = false }) {
  const [scope, setScope] = useState(week ? 'week' : 'all')

  if (both && week && all) return <BothBoard week={week} all={all} t={t} lang={lang} />

  const board = scope === 'week' && week ? week : all
  if (!board) return null
  const options = week
    ? [
        { key: 'week', label: t.periodWeek },
        { key: 'all', label: t.periodAll },
      ]
    : [{ key: 'all', label: t.periodAll }]
  return (
    <Board board={board} guide="profile.board" lang={lang}>
      {/* The label is the board's accessible name; the tabs show it. */}
      <Seg
        full
        className="bz__seg"
        label={t.ranking}
        value={scope}
        onChange={setScope}
        options={options}
      />
    </Board>
  )
}

// ── 東西 — both periods on one board (plan 247) ──────────────────
// A table, so a screen reader reads each row as a rank with its two
// names under their period's heading; the ranks are the rows' headers.
// The rows a period's top N and the learner's own row hold, by rank:
// the top ranks first, then the learner's own wherever the top N left it
// out, after the board's elision.
function sideOf(board) {
  const rows = new Map(board.entries.map(e => [e.rank, e]))
  const me = board.me ?? null
  const out = me && !board.entries.some(e => e.username === me.username) ? me : null
  if (out) rows.set(out.rank, out)
  return { rows, me, out }
}

function BothBoard({ week, all, t, lang }) {
  const sides = [sideOf(week), sideOf(all)]
  const top = [...new Set([...week.entries, ...all.entries].map(e => e.rank))].sort((a, b) => a - b)
  const out = [...new Set(sides.map(s => s.out?.rank).filter(r => r != null && !top.includes(r)))]
    .sort((a, b) => a - b)
  // The rows that share the board's height, either side of the elision.
  const style = { '--bz-top': top.length, '--bz-out': out.length }
  const row = rank => {
    const medal = MEDAL[rank]
    return (
      <div key={rank} className="desk-bz__row" role="row">
        <SideCell e={sides[0].rows.get(rank)} me={sides[0].me} lang={lang} west />
        <span className="desk-bz__rank" role="rowheader">
          <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>{rank}</span>
        </span>
        <SideCell e={sides[1].rows.get(rank)} me={sides[1].me} lang={lang} />
      </div>
    )
  }
  return (
    <section
      className={`banzuke desk-bz${out.length ? ' desk-bz--out' : ''}`}
      role="table"
      aria-label={t.ranking}
      data-guide="profile.board"
      style={style}
    >
      <div className="desk-bz__head" role="row">
        <span className="desk-bz__period" role="columnheader">{t.periodWeek}</span>
        <span className="desk-bz__period" role="columnheader"><span className="sr-only">{t.rankColumn}</span></span>
        <span className="desk-bz__period" role="columnheader">{t.periodAll}</span>
      </div>
      {top.map(row)}
      {out.length > 0 && <div className="desk-bz__gap" aria-hidden="true">⋯</div>}
      {out.map(row)}
    </section>
  )
}

// One period's place in a row: the name beside the rank and the XP at
// the board's edge, so the week's side reads from its edge in. Empty
// where that period has no one at the rank.
function SideCell({ e, me, lang, west = false }) {
  const isMe = e != null && me != null && e.username === me.username
  return (
    <span className={`desk-bz__cell${west ? ' desk-bz__cell--west' : ''}${isMe ? ' desk-bz__cell--me' : ''}`} role="cell">
      {e && <span className="leaderboard-row__name">{e.username}</span>}
      {e && <span className="leaderboard-row__xp">{e.xp.toLocaleString(lang)} XP</span>}
    </span>
  )
}

// One board: its head (the caller's), then the rows.
function Board({ board, guide, lang, children }) {
  const { entries, me } = board
  const meInList = me && entries.some(e => e.username === me.username)
  const rows = meInList || !me ? [...entries] : [...entries, { ...me, elided: true }]

  return (
    <section className="banzuke" data-guide={guide}>
      <div className="bz__head">{children}</div>
      {/* Fragments, not wrappers: the rows stay direct children of the
          board so .leaderboard-row:last-child drops only the last
          hairline, not every one. */}
      {rows.map(r => (
        <Fragment key={r.rank ?? r.username}>
          {r.elided && (
            <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
          )}
          <Row e={r} isMe={me != null && r.username === me.username} lang={lang} />
        </Fragment>
      ))}
    </section>
  )
}
