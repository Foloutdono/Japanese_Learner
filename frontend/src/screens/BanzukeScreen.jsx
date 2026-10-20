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
import { useDesk } from '../hooks/useDesk'
import { playClick } from '../lib/audio'

// ── 番付 — the whole board (plan 262) ──────────────────────────────
// /profile/banzuke, the door at the foot of the profile's board: every
// place, a page of PAGE at a time, on one of three boards -- this week
// (the calendar week, the week before's podium opening its list), the
// learner's division (段) and all time. Drawn as A1, the owner's pick of
// the canvas "Tsuji — the 番付 redesign": one card heads the board (the
// tabs, then the level filter and the week's end, or the division's name
// between its neighbours); on a division the rows Monday moves up and
// down ride a rail of their state's colour under a head naming them, and
// the line under the list says what moving up (or staying) takes. On the
// phone the learner's row, off the list, rides the foot with its gap and
// the jump to it; on the desk a side column holds the learner's place
// and gap, the six divisions as a ladder to browse, and the switch that
// keeps the learner off the board. Any name opens that learner's card.
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


export default function BanzukeScreen({ session }) {
  const { t, lang } = useLang()
  const desk = useDesk()
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
  const ends = board?.week && view.period !== 'all' ? endsIn(board.week.end, t) : null
  const showBar = !desk && me?.rank != null && !meVisible

  return (
    <main id="main-content" className="bzp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.ranking}
        color="var(--pass-ink)"
        aside={<Leave to="/profile">{t.profileTitle}</Leave>}
      />

      {/* The board's head, one card: the tabs, then the filter and the
          week's end, or the division's name between its neighbours. */}
      <section className="banzuke bzp__controls">
        <div className="bz__head">
          <Seg full className="bz__seg" label={t.ranking} value={view.period}
            onChange={period => setView(v => ({ ...v, period, division: null }))} options={periods} />
        </div>
        {view.period !== 'division' && (myLevel || ends) && (
          <div className="bzp__sub">
            {myLevel && (
              <label className="bzp__scope">
                <span className="sr-only">{t.bzScopeLabel}</span>
                <select value={view.scope} onChange={e => setView(v => ({ ...v, scope: e.target.value }))}>
                  <option value="all">{t.bzScopeAll}</option>
                  <option value="level">{t.bzScopeLevel(myLevel)}</option>
                </select>
                <ChevronIcon direction="down" size={12} />
              </label>
            )}
            {ends && <span className="bzp__ends">{ends}</span>}
          </div>
        )}
        {division && (
          <DivisionHead division={division} ends={ends} t={t} arrows={!desk}
            onBrowse={index => setView(v => ({ ...v, division: index }))} />
        )}
      </section>

      {!board && !failed && <Loading />}
      {failed && <p className="hint" role="alert">{t.bzLoadFailed}</p>}

      {board && (
        <section className="banzuke bzp__list" aria-label={t.ranking} aria-busy={busy}>
          {view.period === 'week' && list.from === 0 && board.champions?.length > 0 && (
            <div className="bzp__podium">
              <span className="bzp__podium-cap">{t.bzPodiumCap}</span>
              <span className="bzp__podium-names">
                {board.champions.map(c => (
                  <span key={c.rank} className="bzp__champ">
                    <span className={`bzp__medal bzp__medal--${MEDALS[c.rank - 1]}`} aria-hidden="true">{CIRCLED[c.rank - 1]}</span>
                    <button type="button" className="bz-pick" aria-label={t.bzRowAria(c.username)} onClick={() => setPicked(c.username)}>{c.username}</button>
                  </span>
                ))}
              </span>
            </div>
          )}
          {list.from > 0 && (
            <button type="button" className="bzp__more" onClick={earlier} disabled={busy}>{t.bzEarlier}</button>
          )}
          {list.rows.length === 0 && <p className="bzp__empty">{t.bzEmpty}</p>}
          {list.rows.map((e, i) => {
            const prev = list.rows[i - 1]
            const zone = e.zone === 1 ? 'up' : e.zone === -1 ? 'down' : ''
            // A group's head over its first row: the top of the list for
            // those going up, the first going down below them.
            const head = (zone === 'up' && !prev && list.from === 0)
              || (zone === 'down' && prev && prev.zone !== -1)
              || (zone === 'down' && !prev && list.from === 0)
            return (
              // Fragments, not wrappers: the rows stay the board's own
              // children, so only the last drops its hairline.
              <Fragment key={e.rank}>
                {head && <GroupHead zone={zone} n={zone === 'up' ? division.upCount : division.downCount} t={t} />}
                <Row e={e} isMe={isMe(e)} lang={lang} t={t} onPick={setPicked}
                  className={zone ? `bzp__row--${zone}` : ''} rowRef={isMe(e) ? meRef : undefined} />
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

      {/* The phone's foot: the learner's row while it is off the list,
          the gap to the next place on it and the jump to it. */}
      {showBar && (
        <div className="bzp__me">
          <div className="leaderboard-row leaderboard-row--me bzp__me-row">
            <span className="leaderboard-row__rank">{me.rank}</span>
            <span className="leaderboard-row__name">{me.username}</span>
            {me.gap && <GapShort gap={me.gap} t={t} lang={lang} />}
            <span className="leaderboard-row__xp">{me.xp.toLocaleString(lang)} XP</span>
          </div>
          <button type="button" className="bzp__jump" aria-label={t.bzJumpToMe} title={t.bzJumpToMe} onClick={jumpToMe} disabled={busy}>
            <ChevronIcon direction="down" size={16} />
          </button>
        </div>
      )}
      {!desk && !division && !showBar && me?.gap && (
        <p className="bzp__line">{t.bzGapTo(me.gap.xp.toLocaleString(lang), me.gap.username)}</p>
      )}

      {/* The learner's card (F2, the owner's pick of the canvas's "le pied
          du classement"): their place and what it takes -- under a
          division's list on the phone, in the desk's side on every board. */}
      {board && me?.rank != null && (desk || division) && (
        <MineCard me={me} division={division} t={t} lang={lang} />
      )}
      {desk && division && (
        <Ladder division={division} t={t} lang={lang} onBrowse={index => setView(v => ({ ...v, division: index }))} />
      )}

      {/* Keeping off the board: a settings row and its switch. */}
      {board && (
        <section className="banzuke bzp__seen">
          <span className="bzp__seen-text">
            <span className="bzp__seen-label" id="bzp-seen-label">{t.bzAppear}</span>
            <span className="bzp__seen-hint">{board.hidden ? t.bzHiddenHint : t.bzShownHint}</span>
          </span>
          <button type="button" role="switch" className="bz-switch" aria-checked={!board.hidden}
            aria-labelledby="bzp-seen-label" disabled={hiding} onClick={() => setHidden(!board.hidden)}>
            <span className="bz-switch__knob" aria-hidden="true" />
          </button>
        </section>
      )}

      {picked && <LearnerSheet username={picked} session={session} onClose={() => setPicked(null)} />}
    </main>
  )
}

const MEDALS = ['gold', 'silver', 'bronze']
const CIRCLED = ['①', '②', '③']

// The week's end, to the hour.
function endsIn(end, t) {
  const ms = Math.max(0, new Date(end).getTime() - Date.now())
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  return t.bzEndsIn(d, h)
}

// The gap to the next place, short, for the pinned row: "+11 → L89",
// the sentence for a screen reader.
function GapShort({ gap, t, lang }) {
  return (
    <span className="bzp__me-gap">
      <span className="sr-only">{t.bzGapTo(gap.xp.toLocaleString(lang), gap.username)}</span>
      <span aria-hidden="true">+{gap.xp.toLocaleString(lang)} → {gap.username}</span>
    </span>
  )
}

// The learner's card: their place, in large figures, and what it takes
// -- on a division, the week's move (the XP to go up, the zone they stand
// in, or the XP to stay) over the gap to the next place; elsewhere the gap.
function MineCard({ me, division, t, lang }) {
  const gap = me.gap && t.bzGapTo(me.gap.xp.toLocaleString(lang), me.gap.username)
  const move = division && division.index === division.mine ? <ZoneLine division={division} t={t} lang={lang} /> : null
  return (
    <section className="banzuke bzp__mine">
      <span className="bzp__mine-rank">
        {me.rank.toLocaleString(lang)}<small className="bzp__mine-ord">{t.bzOrdinal(me.rank)}</small>
      </span>
      <span className="bzp__mine-lines">
        {move ?? (gap && <span className="bzp__mine-lead">{gap}</span>)}
        {move && gap && <span className="bzp__mine-sub">{gap}</span>}
      </span>
    </section>
  )
}

// What the week's move asks of the learner in this division, its XP in
// the selection's gold: the XP to go up, the zone they stand in, or the
// XP to stay.
function ZoneLine({ division, t, lang }) {
  const xp = n => <span className="bzp__mine-fig">+{n.toLocaleString(lang)} XP</span>
  if (division.zone === 1) {
    return <span className="bzp__mine-lead"><span className="bzp__mine-up" aria-hidden="true">▲ </span>{t.bzInUp}</span>
  }
  if (division.toStay != null) return <span className="bzp__mine-lead">{xp(division.toStay)} {t.bzToStayRest}</span>
  if (division.toUp != null) {
    return <span className="bzp__mine-lead"><span className="bzp__mine-up" aria-hidden="true">▲ </span>{xp(division.toUp)} {t.bzToUpRest}</span>
  }
  return null
}

// ── 段 — the division's name in the board's head ────────────────────
// The name between the ones either side a press away (on the phone; the
// desk browses by its ladder), the step the learner's last Monday took
// and the week's end.
function DivisionHead({ division, ends, t, arrows, onBrowse }) {
  const d = DIVISIONS[division.index]
  const below = division.index > 0 ? division.index - 1 : null
  const above = division.index < division.count - 1 ? division.index + 1 : null
  const notes = [
    division.index === division.mine && division.moved !== 0 && (division.moved > 0 ? t.bzMovedUp : t.bzMovedDown),
    ends,
  ].filter(Boolean)
  const step = (to, dir, label) => (
    <button type="button" className="bzp__step" aria-label={to == null ? label : `${label} : ${DIVISIONS[to].latin}`}
      disabled={to == null} onClick={() => { playClick(); onBrowse(to) }}>
      <ChevronIcon direction={dir} size={16} />
    </button>
  )
  return (
    <div className="bzp__division">
      {arrows && step(below, 'left', t.bzDivisionBelow)}
      <span className="bzp__division-name">
        <span className="bzp__division-title">
          <span className="bzp__division-jp" lang="ja">{d.jp}</span>
          <span className="bzp__division-latin">{d.latin}</span>
        </span>
        {notes.length > 0 && <span className="bzp__division-notes">{notes.join(' · ')}</span>}
      </span>
      {arrows && step(above, 'right', t.bzDivisionAbove)}
    </div>
  )
}

// The head of the rows Monday moves: its word and how many, on the
// group's rail.
function GroupHead({ zone, n, t }) {
  return (
    <div className={`bzp__group bzp__group--${zone}`}>
      <span><span aria-hidden="true">{zone === 'up' ? '▲' : '▼'} </span>{zone === 'up' ? t.bzUpHead : t.bzDownHead}</span>
      <span className="bzp__group-n">{n}</span>
    </div>
  )
}

// ── The desk's ladder of the six divisions ─────────────────────────
// Top to foot, each with its size this week: the one on screen lit as a
// choice, the learner's own marked by the pass's rail.
function Ladder({ division, t, lang, onBrowse }) {
  const rows = DIVISIONS.map((d, index) => ({ ...d, index, size: division.sizes?.[index] ?? 0 })).reverse()
  return (
    <nav className="banzuke bzp__ladder" aria-label={t.bzLadder}>
      {rows.map(d => (
        <button key={d.key} type="button"
          className={`bzp__rung${d.index === division.index ? ' bzp__rung--on' : ''}${d.index === division.mine ? ' bzp__rung--mine' : ''}`}
          aria-current={d.index === division.index ? 'true' : undefined}
          onClick={() => { if (d.index !== division.index) { playClick(); onBrowse(d.index) } }}>
          <span className="bzp__rung-jp" lang="ja">{d.jp}</span>
          <span className="bzp__rung-latin">{d.latin}</span>
          <span className="bzp__rung-n">{t.bzLearners(d.size.toLocaleString(lang))}</span>
        </button>
      ))}
    </nav>
  )
}
