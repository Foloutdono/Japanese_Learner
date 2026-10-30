import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Seg } from '../chrome/Console'
import { ChevronIcon } from '../ui/Icons'
import { apiJson } from '../../lib/api'
import { besidePages, boardRows, bothRows, moveOf } from '../../domain/banzuke'
import { LearnerSheet } from './LearnerSheet'

// ── The ranking (canvas ProfileInserts, plan 074) ─────────────
// One list of rows: the rank in a roundel (gold, silver and bronze for
// the first three), the name, the XP. Two boards ride in: this week and
// lifetime (通算). The head is the board's period tabs and nothing above
// them: the tabs name the board. The week is the one you can actually
// move tonight, so it is the one the board opens on. Only the week
// board's tabs render both periods; without it the head keeps the
// lifetime tab alone, so the board still says what it is.
//
// Since plan 262 the board is a window on the whole one: its top three,
// a dashed hairline, and the learner between their two neighbours, so the board
// says who is within reach rather than who is out of it
// (domain/banzuke.boardRows). A row says how far it moved since the day
// began, a name opens that learner's card (LearnerSheet), the learner's
// own gap to the next place is printed under the board, and the board's
// foot is the door to the whole of it (/profile/banzuke).
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }

export function Move({ e, t }) {
  const dir = moveOf(e)
  if (!dir) return null
  const n = Math.abs(e.move)
  return (
    <span className={`bz-move bz-move--${dir}`} aria-label={dir === 'up' ? t.bzMoveUp(n) : t.bzMoveDown(n)}>
      <span aria-hidden="true">{dir === 'up' ? '▲' : '▼'}{n}</span>
    </span>
  )
}

// The name, a way to the learner's card when the board can open one.
export function Name({ e, t, onPick }) {
  if (!onPick) return <span className="leaderboard-row__name">{e.username}</span>
  return (
    <button type="button" className="leaderboard-row__name bz-pick" aria-label={t.bzRowAria(e.username)} onClick={() => onPick(e.username)}>
      {e.username}
    </button>
  )
}

export function Row({ e, isMe, lang, t, onPick, className = '', rowRef }) {
  const medal = MEDAL[e.rank]
  return (
    <div ref={rowRef} className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}${className ? ` ${className}` : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>
        <span className="bz-num">{e.rank ?? '—'}</span>
      </span>
      <Name e={e} t={t} onPick={onPick} />
      <Move e={e} t={t} />
      <span className="leaderboard-row__xp">{e.xp.toLocaleString(lang)} XP</span>
    </div>
  )
}

// The learner's own gap to the next place, at the board's foot: short,
// "+19 XP → CalmTsuki880", so it holds one line beside the door, and the
// sentence for a screen reader (plan 262's A1).
function GapTo({ me, t, lang }) {
  if (!me?.gap) return <span className="bz__gap-to" />
  const xp = me.gap.xp.toLocaleString(lang)
  return (
    <p className="bz__gap-to">
      <span className="sr-only">{t.bzGapTo(xp, me.gap.username)}</span>
      <span aria-hidden="true"><b className="bz__gap-xp">+{xp} XP</b> → {me.gap.username}</span>
    </p>
  )
}

// The board's foot: the door to the whole of it.
function WholeDoor({ t }) {
  return (
    <Link to="/profile/banzuke" className="bz__whole">
      <span>{t.bzWhole}</span>
      <ChevronIcon direction="right" size={15} />
    </Link>
  )
}

// `both` is the desk's (plan 115): the profile's record column has room
// for the two boards at once, so neither hides behind a toggle. Since
// plan 248 (the owner's pick A of the canvas "Tsuji — the profile on the
// desk") they are one board, the ranks down its middle: this week to
// their left, all time to their right, each name beside its rank and
// its XP at the board's edge. Side by side, the two boards were two
// heights whenever the learner's own row closed one and not the other,
// and stacked they ran the page past a laptop's window.
export function Banzuke({ all, week, t, lang, both = false, session = null }) {
  const [scope, setScope] = useState(week ? 'week' : 'all')
  const [picked, setPicked] = useState(null)
  const onPick = session ? setPicked : undefined
  const sheet = picked && <LearnerSheet username={picked} session={session} onClose={() => setPicked(null)} />
  const [besideWeek, besideAll] = useBeside(both && session ? week : null, both && session ? all : null, session)

  if (both && week && all) {
    return (
      <>
        <BothBoard week={besideWeek ?? week} all={besideAll ?? all} t={t} lang={lang} onPick={onPick} />
        {sheet}
      </>
    )
  }

  const board = scope === 'week' && week ? week : all
  if (!board) return null
  const options = week
    ? [
        { key: 'week', label: t.periodWeek },
        { key: 'all', label: t.periodAll },
      ]
    : [{ key: 'all', label: t.periodAll }]
  return (
    <>
      <Board board={board} guide="profile.board" lang={lang} t={t} onPick={onPick}>
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
      {sheet}
    </>
  )
}

// Each period's rows at the ranks only the other one shows, so the
// desk's board has no blank where a period has a learner: the lifetime's
// 7th to 9th beside a week whose learner is 8th. Read once both boards
// are in, a page per run of ranks (domain/banzuke.besidePages); a page
// that fails leaves its ranks blank, as they were.
function useBeside(week, all, session) {
  const [got, setGot] = useState(null)
  useEffect(() => {
    if (!week || !all) return
    let live = true
    const periods = ['week', 'all']
    const pages = besidePages(week, all)
    Promise.all(pages.map((runs, side) => Promise.all(runs.map(({ offset, limit }) => (
      apiJson(`/api/leaderboard?period=${periods[side]}&offset=${offset}&limit=${limit}`, session)
        .then(b => b.entries ?? [])
        .catch(() => [])
    ))).then(got => got.flat())))
      .then(([w, a]) => {
        if (!live || (!w.length && !a.length)) return
        setGot({ week, all, boards: [w.length ? { ...week, beside: w } : null, a.length ? { ...all, beside: a } : null] })
      })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, all])
  // Only the pages read for the boards on screen: new boards wait for theirs.
  return got && got.week === week && got.all === all ? got.boards : [null, null]
}

// ── 東西 — both periods on one board (plan 248) ──────────────────
// A table, so a screen reader reads each row as a rank with its two
// names under their period's heading; the ranks are the rows' headers.
// The ranks either side shows (domain/banzuke.bothRows), a ⋯ wherever
// two are not next to each other; the rows share the board's height,
// the head, the ⋯ and the foot keep their own (--bz-rows).
function BothBoard({ week, all, t, lang, onPick }) {
  const { lines, sides } = bothRows(week, all)
  const mes = [week.me ?? null, all.me ?? null]
  const style = {
    '--bz-rows': ['auto', ...lines.map(l => (l.gap ? 'auto' : 'minmax(min-content, 1fr)')), 'auto'].join(' '),
  }
  return (
    <section
      className="banzuke desk-bz"
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
      {lines.map((line, i) => {
        if (line.gap) return <div key={`gap${i}`} className="desk-bz__gap" aria-hidden="true" />
        const { rank } = line
        const medal = MEDAL[rank]
        return (
          <div key={rank} className="desk-bz__row" role="row">
            <SideCell e={sides[0].get(rank)} me={mes[0]} lang={lang} t={t} onPick={onPick} west />
            <span className="desk-bz__rank" role="rowheader">
              <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}><span className="bz-num">{rank}</span></span>
            </span>
            <SideCell e={sides[1].get(rank)} me={mes[1]} lang={lang} t={t} onPick={onPick} />
          </div>
        )
      })}
      <div className="desk-bz__foot">
        <GapTo me={week.me} t={t} lang={lang} />
        <WholeDoor t={t} />
      </div>
    </section>
  )
}

// One period's place in a row: the name beside the rank and the XP at
// the board's edge, so the week's side reads from its edge in. Empty
// where that period has no one at the rank.
function SideCell({ e, me, lang, t, onPick, west = false }) {
  const isMe = e != null && me != null && e.username === me.username
  return (
    <span className={`desk-bz__cell${west ? ' desk-bz__cell--west' : ''}${isMe ? ' desk-bz__cell--me' : ''}`} role="cell">
      {e && <Name e={e} t={t} onPick={onPick} />}
      {e && <Move e={e} t={t} />}
      {e && <span className="leaderboard-row__xp">{e.xp.toLocaleString(lang)} XP</span>}
    </span>
  )
}

// One board: its head (the caller's), then the rows, the gap to the
// next place and the door to the whole board.
function Board({ board, guide, lang, t, onPick, children }) {
  const { me } = board
  return (
    <section className="banzuke" data-guide={guide}>
      <div className="bz__head">{children}</div>
      {boardRows(board).map((r, i) => (r.gap
        ? <div key={`gap${i}`} className="bz__cut" aria-hidden="true" />
        : <Row key={r.e.rank} e={r.e} isMe={me != null && r.e.username === me.username} lang={lang} t={t} onPick={onPick} />
      ))}
      <div className="bz__foot">
        <GapTo me={me} t={t} lang={lang} />
        <WholeDoor t={t} />
      </div>
    </section>
  )
}
