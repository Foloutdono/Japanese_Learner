import { Fragment, useState } from 'react'
import { Seg } from '../chrome/Console'

// ── The ranking (canvas ProfileInserts, plan 074) ─────────────
// One list of rows: the rank in a roundel (gold, silver and bronze for
// the first three), the name, the XP. Two boards ride in: the last
// seven days and lifetime (通算), on the segmented control in the head;
// the week is the one you can actually move tonight, so it is the one
// the board opens on. The toggle only renders when the week board
// loaded, and the component falls back to the lifetime board alone
// otherwise.
//
// `entries` is the top N; `me` is the current user's own row, which
// the backend includes separately whenever they are not already inside
// that top N (see profile.py's get_leaderboard). Then they close the
// list after an elision row, exactly as before.
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }

function Row({ e, isMe }) {
  const medal = MEDAL[e.rank]
  return (
    <div className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>
        {e.rank ?? '—'}
      </span>
      <span className="leaderboard-row__name">{e.username}</span>
      <span className="leaderboard-row__xp">{e.xp.toLocaleString()} XP</span>
    </div>
  )
}

// `both` is the desk's (plan 115): the profile's record column has room
// for the two boards at once, so neither hides behind a toggle — the
// week beside lifetime where the column is wide enough for two, one
// over the other where it is not (index.css, .desk-banzuke).
export function Banzuke({ all, week, t, both = false }) {
  const [scope, setScope] = useState(week ? 'week' : 'all')

  if (both && week && all) {
    return (
      <div className="desk-banzuke" data-guide="profile.board">
        {[['week', week, t.periodWeek], ['all', all, t.periodAll]].map(([key, b, period]) => (
          <Board key={key} board={b}>
            <span className="bz__mark"><span className="bz__jp">{t.ranking}</span></span>
            <span className="desk-bz__period">{period}</span>
          </Board>
        ))}
      </div>
    )
  }

  const board = scope === 'week' && week ? week : all
  if (!board) return null
  return (
    <Board board={board} guide="profile.board">
      <span className="bz__mark"><span className="bz__jp">{t.ranking}</span></span>
      {week && (
        <Seg
          className="bz__seg"
          label={t.ranking}
          value={scope}
          onChange={setScope}
          options={[
            { key: 'week', label: t.periodWeek },
            { key: 'all', label: t.periodAll },
          ]}
        />
      )}
    </Board>
  )
}

// One board: its head (the caller's), then the rows.
function Board({ board, guide, children }) {
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
          <Row e={r} isMe={me != null && r.username === me.username} />
        </Fragment>
      ))}
    </section>
  )
}
