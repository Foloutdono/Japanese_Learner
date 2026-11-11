import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import { Loading } from '../components/ui/Loading'
import { ChevronIcon } from '../components/ui/Icons'
import { PlayerSheet } from '../components/pvp/PlayerSheet'
import { FriendSheet } from '../components/pvp/FriendSheet'
import { stationFor } from '../config/stations'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { useDesk } from '../hooks/useDesk'
import { errorKey } from '../domain/duel'

// ── 対戦の番付 — the Elo board, apart from the 番付 (plan 279, L2) ──
// The 番付 ranks XP, which pays study; the Elo ranks sprints, and the
// owner kept them apart. Same drawing as the 番付's whole board (plan
// 262, the owner's A1), and since plan 315 its whole too: every place, a
// page of PAGE at a time, the next one as the foot of the list comes
// into view; the medal roundels, the name, the figure at the edge. On
// the phone the learner's row, off the list, rides the foot with its gap
// and the jump to it. Any name opens that learner's card (PlayerSheet):
// what the board says of them, the way to ask them as a friend or to
// challenge a friend, the report and the block. Everyone who has played
// a ranked duel, or your friends only; a learner off the 番付 is off this
// board too, and sees their own place.
const STATION = stationFor('/profile/duels')
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }
const SCOPES = ['all', 'friends']
const PAGE = 50
// Places shown above the learner's own when the page jumps to it.
const ABOVE_ME = 10

function Row({ e, lang, t, onPick, rowRef }) {
  const medal = MEDAL[e.rank]
  return (
    <div ref={rowRef} className={`leaderboard-row${e.me ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>{e.rank}</span>
      {e.me || !e.username
        ? <span className="leaderboard-row__name">{e.me ? t.pvpYou : e.username}</span>
        : (
          <button type="button" className="leaderboard-row__name bz-pick" aria-label={t.bzRowAria(e.username)}
            onClick={() => { playClick(); onPick(e.username) }}>
            {e.username}
          </button>
        )}
      <span className="leaderboard-row__xp">{e.elo.toLocaleString(lang)}{e.provisional && <span className="pvp-board__prov">?</span>}</span>
    </div>
  )
}

export default function DuelBoardScreen({ session }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const [scope, setScope] = useState('all')
  // Per scope, the rows held: a run of the board from `from`, and the
  // last answer about it (its size, the learner's place and gap).
  const [held, setHeld] = useState({})
  const [failed, setFailed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState(null)
  const [challenge, setChallenge] = useState(null)
  const busyRef = useRef({})
  // A board asked from its top (the first read, the jump) starts a turn
  // of its scope; a page of an older turn is dropped on arrival.
  const turn = useRef({ all: 0, friends: 0 })
  const meRef = useRef(null)
  const moreRef = useRef(null)
  const [meInView, setMeInView] = useState(false)
  const [scrollToMe, setScrollToMe] = useState(false)

  const load = useCallback((which, offset, limit, how) => {
    if (how !== 'replace' && busyRef.current[which]) return Promise.resolve()
    const mine = how === 'replace' ? ++turn.current[which] : turn.current[which]
    busyRef.current[which] = true
    setBusy(true)
    // around 0: the learner's own row and the one ahead come with every page.
    const p = new URLSearchParams({ scope: which, offset: String(offset), limit: String(limit), around: '0' })
    return apiJson(`/api/pvp/board?${p}`, session)
      .then(b => {
        if (turn.current[which] !== mine) return
        setHeld(h => {
          const was = h[which]
          if (how === 'replace' || !was) return { ...h, [which]: { from: offset, rows: b.entries, board: b } }
          if (how === 'before') return { ...h, [which]: { from: offset, rows: [...b.entries, ...was.rows], board: b } }
          return { ...h, [which]: { ...was, rows: [...was.rows, ...b.entries], board: b } }
        })
      })
      .catch(e => { if (turn.current[which] === mine) setFailed(errorKey(e)) })
      .finally(() => {
        if (turn.current[which] !== mine) return
        busyRef.current[which] = false
        setBusy(Object.values(busyRef.current).some(Boolean))
      })
  }, [session])

  // Both boards from their top: each tab names its size.
  useEffect(() => { SCOPES.forEach(s => load(s, 0, PAGE, 'replace')) }, [load])

  const list = held[scope] ?? null
  const board = list?.board ?? null
  const me = board?.me ?? null
  const from = list?.from ?? 0
  const to = from + (list?.rows.length ?? 0)
  const hasMore = board != null && to < board.of

  // The next page, when the foot of the list comes into view.
  useEffect(() => {
    const el = moreRef.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(seen => {
      if (seen.some(s => s.isIntersecting)) load(scope, to, PAGE, 'after')
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, to, scope, load])

  // Whether the learner's own row is on the screen: the foot carries it
  // when it is not.
  const meShown = me?.rank != null && me.rank > from && me.rank <= to
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
    load(scope, Math.max(0, me.rank - 1 - ABOVE_ME), PAGE, 'replace').then(() => setScrollToMe(true))
  }

  function earlier() {
    const offset = Math.max(0, from - PAGE)
    load(scope, offset, from - offset, 'before')
  }

  const showBar = !desk && me?.rank != null && !meVisible
  const gapLine = me?.gap ? t.pvpGapTo(me.gap.elo, me.gap.rank) : me && me.rank == null ? t.pvpNotRanked : null
  const provisional = (list?.rows ?? []).some(e => e.provisional)
  const counts = SCOPES.map(s => held[s]?.board?.of)
  return (
    <main id="main-content" className="pvp bzp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpEloBoard} color="var(--pass-ink)" aside={<Leave to="/profile/duels">{t.pvpTitle}</Leave>} />
      {!board ? (failed ? <p className="pvp-run__fail">{t[failed]}</p> : <Loading />) : (
        <>
          <section className="banzuke bzp__controls">
            <div className="bz__head">
              <Seg full className="bz__seg" label={t.pvpEloBoard} value={scope} onChange={setScope}
                options={[{ key: 'all', label: t.pvpAll(counts[0] ?? '…') }, { key: 'friends', label: t.pvpFriendsOnly(counts[1] ?? '…') }]} />
            </div>
          </section>
          <section className="banzuke bzp__list" aria-label={t.pvpEloBoard} aria-busy={busy}>
            {from > 0 && <button type="button" className="bzp__more" onClick={earlier} disabled={busy}>{t.bzEarlier}</button>}
            {list.rows.length === 0 && <p className="bzp__empty">{t.bzEmpty}</p>}
            {list.rows.map(e => (
              <Row key={e.rank} e={e} lang={lang} t={t} onPick={setPicked} rowRef={e.me ? meRef : undefined} />
            ))}
            {hasMore && (
              <button type="button" ref={moreRef} className="bzp__more" onClick={() => load(scope, to, PAGE, 'after')} disabled={busy}>
                {t.bzMore}
              </button>
            )}
          </section>

          {/* The phone's foot: the learner's row while it is off the
              list, the gap to the next place and the jump to it. */}
          {showBar && (
            <div className="bzp__me">
              <div className="leaderboard-row leaderboard-row--me bzp__me-row">
                <span className="leaderboard-row__rank">{me.rank}</span>
                <span className="leaderboard-row__name">{t.pvpYou}</span>
                {me.gap && (
                  <span className="bzp__me-gap">
                    <span className="sr-only">{t.pvpGapTo(me.gap.elo, me.gap.rank)}</span>
                    <span aria-hidden="true">+{me.gap.elo.toLocaleString(lang)} → {t.pvpOrdinal(me.gap.rank)}</span>
                  </span>
                )}
                <span className="leaderboard-row__xp">{me.elo.toLocaleString(lang)}</span>
              </div>
              <button type="button" className="bzp__jump" aria-label={t.bzJumpToMe} title={t.bzJumpToMe} onClick={jumpToMe} disabled={busy}>
                <ChevronIcon direction="down" size={16} />
              </button>
            </div>
          )}
          {!showBar && gapLine && <p className="bzp__line bz__gap-to">{gapLine}</p>}
          {provisional && <p className="bzp__line"><span className="pvp-board__prov" aria-hidden="true">?</span> {t.pvpProvisional}</p>}
        </>
      )}
      <PlayerSheet username={picked} onClose={() => setPicked(null)} session={session}
        onChallenge={name => { setPicked(null); setChallenge(name) }} />
      <FriendSheet key={challenge ?? ''} open={Boolean(challenge)} preset={challenge} onClose={() => setChallenge(null)} session={session} />
    </main>
  )
}
