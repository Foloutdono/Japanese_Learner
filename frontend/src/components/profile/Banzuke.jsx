import { Fragment, useState } from 'react'

// ── 番付 — the ranking board ──────────────────────────────────
// A real 番付 lists its wrestlers on two sides, 東 and 西, and that is
// what lets the board use the profile's full width honestly: the top
// half of the list on the east side, the rest on the west, instead of
// six short rows stretched across 1000px with nothing on their right.
//
// Two boards ride in: lifetime XP (通算) and the last seven days
// (今週). The week is the one you can actually move tonight, so the
// toggle exists; it only renders when the week board loaded, and the
// component falls back to the lifetime board alone otherwise.
//
// `entries` is the top N; `me` is the current user's own row, which
// the backend includes separately whenever they are not already inside
// that top N (see profile.py's get_leaderboard). Then they go last on
// the west side, after the ⋯ elision, exactly as before.
const RANK_GLYPH = { 1: '一', 2: '二', 3: '三' }

function Row({ e, isMe, t }) {
  const medal = e.rank <= 3
  return (
    <div className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}`}>
      <span
        className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${e.rank}` : ' leaderboard-row__rank--n'}`}
        lang={medal ? 'ja' : undefined}
      >
        {RANK_GLYPH[e.rank] ?? e.rank ?? '—'}
      </span>
      <span className="leaderboard-row__name">{e.username}</span>
      <span className="leaderboard-row__level">{t.level} {e.level}</span>
      <span className="leaderboard-row__xp">{e.xp.toLocaleString()} XP</span>
    </div>
  )
}

function Side({ jp, latin, rows, meName, t }) {
  return (
    <div className="bz__side">
      <div className="bz__side-head">
        <span className="bz__side-jp" lang="ja">{jp}</span>
        <span className="pf-cap">{latin}</span>
      </div>
      {/* Fragments, not wrappers: the rows must stay direct children of
          the side so .leaderboard-row:last-child drops only the last
          hairline, not every one. */}
      {rows.map(r => (
        <Fragment key={r.rank ?? r.username}>
          {r.elided && (
            <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
          )}
          <Row e={r} isMe={meName != null && r.username === meName} t={t} />
        </Fragment>
      ))}
    </div>
  )
}

export function Banzuke({ all, week, t }) {
  const [scope, setScope] = useState('all')
  const board = scope === 'week' && week ? week : all
  if (!board) return null

  const { entries, me } = board
  const meInList = me && entries.some(e => e.username === me.username)
  const rows = meInList || !me ? [...entries] : [...entries, { ...me, elided: true }]

  const half = Math.ceil(entries.length / 2)
  const east = rows.slice(0, half)
  const west = rows.slice(half)

  // The person directly above you, and by how much — the one line on
  // the board you can act on.
  const chase = me && entries.find(e => e.rank === me.rank - 1)
  const gap = chase ? chase.xp - me.xp : 0

  return (
    <section className="banzuke">
      <div className="bz__head">
        <span className="bz__mark">
          <span className="bz__jp" lang="ja">番付</span>
          <span className="pf-cap">{t.ranking}</span>
        </span>
        {week && (
          <span className="seg" role="group" aria-label={t.ranking}>
            <button
              type="button"
              className={`seg__opt${scope === 'week' ? ' seg__opt--on' : ''}`}
              aria-pressed={scope === 'week'}
              onClick={() => setScope('week')}
            >
              <span className="seg__opt-jp" lang="ja">今週</span>
              <span className="pf-cap">{t.periodWeek}</span>
            </button>
            <button
              type="button"
              className={`seg__opt${scope === 'all' ? ' seg__opt--on' : ''}`}
              aria-pressed={scope === 'all'}
              onClick={() => setScope('all')}
            >
              <span className="seg__opt-jp" lang="ja">通算</span>
              <span className="pf-cap">{t.periodAll}</span>
            </button>
          </span>
        )}
      </div>

      <div className="bz__sides">
        <Side jp="東" latin={t.east} rows={east} meName={me?.username} t={t} />
        <Side jp="西" latin={t.west} rows={west} meName={me?.username} t={t} />
      </div>

      {chase && gap > 0 && (
        <p className="banzuke__chase">
          {t.chaseNext(gap.toLocaleString(), chase.username)}
        </p>
      )}
    </section>
  )
}
