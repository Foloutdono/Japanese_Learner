import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { apiJson } from '../lib/api'
import { cachedJson, invalidateCachedJson } from '../lib/cachedJson'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import { Loading } from '../components/ui/Loading'
import { ChevronIcon } from '../components/ui/Icons'
import { Row } from '../components/profile/Banzuke'
import { LearnerSheet } from '../components/profile/LearnerSheet'
import { DIVISIONS } from '../domain/banzuke'
import { stationFor } from '../config/stations'
import { useProfileSummaryState } from '../stores/profileSummary'
import { playClick } from '../lib/audio'

// ── 番付 — the whole board (plan 262) ──────────────────────────────
// /profile/banzuke, the door at the foot of the profile's board: every
// place, a page of PAGE at a time, on one of three boards -- this week
// (the calendar week, its podium of the week before above it), the
// learner's division (段: its name and the ones either side to browse,
// how many go up and down on Monday, the lines where they do), and all
// time. The week and all time can be narrowed to the learner's own JLPT
// level. The learner's own row, when it is not on the screen, rides at
// the foot with the way to it; any name opens that learner's card; and
// the page ends on the switch that keeps the learner off the board.
//
// The places come from GET /api/leaderboard (routes/banzuke.py), one
// ranked list per board: a page is a slice of it, so a place is the same
// on every page. The rows are the profile's (Banzuke's Row).
const PAGE = 50
// Places shown above the learner's own when the page jumps to it.
const ABOVE_ME = 10
const STATION = stationFor('/profile/banzuke')
const EMPTY = { from: 0, rows: [] }

function query(view, offset, limit) {
  const p = new URLSearchParams({ period: view.period, limit: String(limit), offset: String(offset) })
  if (view.period !== 'division' && view.scope === 'level') p.set('scope', 'level')
  if (view.period === 'division' && view.division != null) p.set('division', String(view.division))
  return `/api/leaderboard?${p}`
}

// Days left until the board's week ends, the day of the end counted.
function daysLeft(end) {
  const ms = new Date(end).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000) - 1)
}

export default function BanzukeScreen({ session }) {
  const { t, lang } = useLang()
  const { summary } = useProfileSummaryState()
  const myLevel = summary?.jlptLevel ?? null

  const [view, setView] = useState({ period: 'week', scope: 'all', division: null })
  // The rows held, for the board they were read from: a run of it from
  // `from`, and what the last answer said about the board and the
  // learner. Another board's rows are never drawn under this one's tabs.
  const viewKey = JSON.stringify(view)
  const [held, setHeld] = useState({ key: null, from: 0, rows: [], board: null, failed: false })
  const mine = held.key === viewKey
  const list = mine ? held : EMPTY
  const board = mine ? held.board : null
  const failed = mine && held.failed
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState(null)
  const [hiding, setHiding] = useState(false)
  const busyRef = useRef(false)
  const meRef = useRef(null)
  const moreRef = useRef(null)
  const [meInView, setMeInView] = useState(false)
  const [scrollToMe, setScrollToMe] = useState(false)

  // Each answer's turn: a board asked from its top (a new tab, the jump)
  // starts one, and only the answers of the latest turn land -- a page
  // asked for a tab the learner has since left is dropped on arrival.
  const turn = useRef(0)

  const load = useCallback((offset, limit, how) => {
    // A board from its top always goes; another page waits its turn.
    if (how !== 'replace' && busyRef.current) return Promise.resolve()
    const mineTurn = how === 'replace' ? ++turn.current : turn.current
    busyRef.current = true
    setBusy(true)
    const key = JSON.stringify(view)
    const current = () => turn.current === mineTurn
    // Through lib/cachedJson (plan 211): a tab flicked back and forth
    // asks its page once, as the server keeps the board a minute.
    return cachedJson(query(view, offset, limit), session)
      .then(b => {
        if (!current()) return
        setHeld(h => {
          if (how === 'replace' || h.key !== key) return { key, from: offset, rows: b.entries, board: b, failed: false }
          if (how === 'before') return { ...h, from: offset, rows: [...b.entries, ...h.rows], board: b, failed: false }
          return { ...h, rows: [...h.rows, ...b.entries], board: b, failed: false }
        })
      })
      .catch(() => {
        if (!current()) return
        setHeld(h => (h.key === key ? { ...h, failed: true } : { key, from: 0, rows: [], board: null, failed: true }))
      })
      .finally(() => {
        if (!current()) return
        busyRef.current = false
        setBusy(false)
      })
  }, [view, session])

  // A new board from its top.
  useEffect(() => { load(0, PAGE, 'replace') }, [load])

  const total = board?.total ?? 0
  const to = list.from + list.rows.length
  const me = board?.me ?? null
  const hasMore = board != null && to < total

  // The next page, when the foot of the list comes into view.
  useEffect(() => {
    const el = moreRef.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(seen => {
      if (seen.some(s => s.isIntersecting)) load(to, PAGE, 'after')
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, to, load])

  // Whether the learner's own row is on the screen: the foot carries it
  // when it is not.
  const meShown = me?.rank != null && me.rank > list.from && me.rank <= to
  const watching = typeof IntersectionObserver !== 'undefined'
  useEffect(() => {
    const el = meRef.current
    if (!el || !watching) return undefined
    const io = new IntersectionObserver(seen => setMeInView(seen.some(s => s.isIntersecting)))
    io.observe(el)
    return () => { io.disconnect(); setMeInView(false) }
  }, [meShown, list, watching])
  const meVisible = meShown && (watching ? meInView : true)

  useEffect(() => {
    if (!scrollToMe || !meRef.current) return
    meRef.current.scrollIntoView?.({ block: 'center' })
    setScrollToMe(false)
  }, [scrollToMe, list])

  function jumpToMe() {
    playClick()
    if (meShown) { setScrollToMe(true); return }
    const offset = Math.max(0, me.rank - 1 - ABOVE_ME)
    load(offset, PAGE, 'replace').then(() => setScrollToMe(true))
  }

  function earlier() {
    const offset = Math.max(0, list.from - PAGE)
    load(offset, list.from - offset, 'before')
  }

  function setHidden(hidden) {
    if (hiding) return
    playClick()
    setHiding(true)
    apiJson('/api/profile/learning', session, { method: 'PATCH', body: JSON.stringify({ boardHidden: hidden }) })
      .then(() => { invalidateCachedJson('/api/leaderboard'); return load(0, PAGE, 'replace') })
      .catch(() => setHeld(h => ({ ...h, failed: true })))
      .finally(() => setHiding(false))
  }

  const periods = [
    { key: 'week', label: t.bzTabWeek },
    { key: 'division', label: t.periodDivision },
    { key: 'all', label: t.bzTabAll },
  ]
  const division = board?.division ?? null
  const isMe = e => me != null && e.username === me.username

  return (
    <main id="main-content" className="bzp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.ranking}
        color="var(--pass-ink)"
        aside={<Leave to="/profile">{t.profileTitle}</Leave>}
      />

      <div className="bzp__controls">
        <section className="banzuke bzp__tabs">
          <div className="bz__head">
            <Seg full className="bz__seg" label={t.ranking} value={view.period}
              onChange={period => setView(v => ({ ...v, period, division: null }))} options={periods} />
          </div>
        </section>
        {view.period !== 'division' && myLevel && (
          <Seg className="bzp__scope" label={t.bzScopeLabel} value={view.scope}
            onChange={scope => setView(v => ({ ...v, scope }))}
            options={[{ key: 'all', label: t.bzScopeAll }, { key: 'level', label: t.bzScopeLevel(myLevel) }]} />
        )}
      </div>

      {division && <DivisionHead division={division} board={board} t={t}
        onBrowse={index => setView(v => ({ ...v, division: index }))} />}

      {view.period === 'week' && board?.champions?.length > 0 && (
        <section className="bzp__podium" aria-label={t.bzChampions}>
          <span className="bzp__podium-cap">{t.bzChampions}</span>
          <ol className="bzp__podium-list">
            {board.champions.map(c => (
              <li key={c.rank} className="bzp__champ">
                <span className={`leaderboard-row__rank leaderboard-row__rank--${['gold', 'silver', 'bronze'][c.rank - 1]}`}>{c.rank}</span>
                <button type="button" className="leaderboard-row__name bz-pick" aria-label={t.bzRowAria(c.username)} onClick={() => setPicked(c.username)}>{c.username}</button>
                <span className="leaderboard-row__xp">{c.xp.toLocaleString(lang)} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.period === 'week' && board && <p className="bzp__ends">{t.bzEnds(daysLeft(board.week.end))}</p>}

      {!board && !failed && <Loading />}
      {failed && <p className="hint" role="alert">{t.bzLoadFailed}</p>}

      {board && (
        <section className="banzuke bzp__list" aria-label={t.ranking} aria-busy={busy}>
          {list.from > 0 && (
            <button type="button" className="bzp__more" onClick={earlier} disabled={busy}>{t.bzEarlier}</button>
          )}
          {list.rows.length === 0 && <p className="bzp__empty">{t.bzEmpty}</p>}
          {list.rows.map((e, i) => {
            const prev = list.rows[i - 1]
            return (
              // Fragments, not wrappers: the rows stay the board's own
              // children, so only the last drops its hairline.
              <Fragment key={e.rank}>
                {prev?.zone === 1 && e.zone !== 1 && <Zone dir="up" t={t} />}
                {e.zone === -1 && prev?.zone !== -1 && (prev || list.from === 0) && <Zone dir="down" t={t} />}
                <Row e={e} isMe={isMe(e)} lang={lang} t={t} onPick={setPicked} rowRef={isMe(e) ? meRef : undefined} />
              </Fragment>
            )
          })}
          {hasMore && (
            <button type="button" ref={moreRef} className="bzp__more" onClick={() => load(to, PAGE, 'after')} disabled={busy}>
              {t.bzMore}
            </button>
          )}
        </section>
      )}

      {me?.rank != null && !meVisible && (
        <div className="bzp__me">
          <Row e={me} isMe lang={lang} t={t} className="bzp__me-row" />
          <button type="button" className="bzp__jump" onClick={jumpToMe} disabled={busy}>
            <span>{t.bzJumpToMe}</span>
            <ChevronIcon direction="down" size={15} />
          </button>
        </div>
      )}
      {me?.gap && <p className="bz__gap-to bzp__gap">{t.bzGapTo(me.gap.xp.toLocaleString(lang), me.gap.username)}</p>}

      {board && (
        <section className="bzp__seen">
          <Seg className="bzp__seen-seg" label={t.bzVisible} value={board.hidden ? 'hidden' : 'shown'}
            onChange={key => setHidden(key === 'hidden')}
            options={[{ key: 'shown', label: t.bzShown }, { key: 'hidden', label: t.bzHidden }]} />
          <span className="bzp__seen-hint">{board.hidden ? t.bzHiddenHint : t.bzShownHint}</span>
        </section>
      )}

      {picked && <LearnerSheet username={picked} session={session} onClose={() => setPicked(null)} />}
    </main>
  )
}

// ── 段 — the division's head ──────────────────────────────────────
// Its name, the ones either side a press away, how many go up and down
// on Monday, and the step the learner's last Monday took.
function DivisionHead({ division, board, t, onBrowse }) {
  const d = DIVISIONS[division.index]
  const below = division.index > 0 ? division.index - 1 : null
  const above = division.index < division.count - 1 ? division.index + 1 : null
  const notes = [
    division.up > 0 && t.bzZoneUp(division.up),
    division.down > 0 && t.bzZoneDown(division.down),
    board?.week && t.bzEnds(daysLeft(board.week.end)),
  ].filter(Boolean)
  return (
    <section className="bzp__division">
      <div className="bzp__division-row">
        <button type="button" className="bzp__step" aria-label={t.bzDivisionBelow} disabled={below == null}
          onClick={() => { playClick(); onBrowse(below) }}>
          <ChevronIcon direction="left" size={18} />
        </button>
        <span className="bzp__division-name">
          <span className="bzp__division-jp" lang="ja">{d.jp}</span>
          <span className="bzp__division-latin">{d.latin}</span>
        </span>
        <button type="button" className="bzp__step" aria-label={t.bzDivisionAbove} disabled={above == null}
          onClick={() => { playClick(); onBrowse(above) }}>
          <ChevronIcon direction="right" size={18} />
        </button>
      </div>
      {notes.length > 0 && <p className="bzp__division-notes">{notes.join(' · ')}</p>}
      {division.index === division.mine && division.moved !== 0 && (
        <p className="bzp__division-moved">{division.moved > 0 ? t.bzMovedUp : t.bzMovedDown}</p>
      )}
    </section>
  )
}

// The line where Monday's move up or down starts.
function Zone({ dir, t }) {
  return (
    <div className={`bzp__zone bzp__zone--${dir}`} role="separator" aria-label={dir === 'up' ? t.bzZoneUpLine : t.bzZoneDownLine}>
      <span aria-hidden="true">{dir === 'up' ? '▲' : '▼'} {dir === 'up' ? t.bzZoneUpLine : t.bzZoneDownLine}</span>
    </div>
  )
}
