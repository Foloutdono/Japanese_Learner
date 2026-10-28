import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import { Loading } from '../components/ui/Loading'
import { stationFor } from '../config/stations'
import { apiJson } from '../lib/api'
import { errorKey } from '../domain/duel'

// ── 対戦の番付 — the Elo board, apart from the 番付 (plan 279, L2) ──
// The 番付 ranks XP, which pays study; the Elo ranks sprints, and the
// owner kept them apart. Same drawing as the 番付's whole board: the
// medal roundels, the name, the figure at the edge -- the top of the
// board, a dashed hairline, and the learner between their neighbours
// (the server's rows around their place), the gap to the next place
// under it. Everyone who has played a ranked duel, or your friends only;
// a learner off the 番付 is off this board too, and sees their own place.
const STATION = stationFor('/profile/duels')
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }
const TOP = 5

function Row({ e, lang, t }) {
  const medal = MEDAL[e.rank]
  return (
    <div className={`leaderboard-row${e.me ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>{e.rank}</span>
      <span className="leaderboard-row__name">{e.me ? t.pvpYou : e.username}</span>
      <span className="leaderboard-row__xp">{e.elo.toLocaleString(lang)}{e.provisional && <span className="pvp-board__prov">?</span>}</span>
    </div>
  )
}

export default function DuelBoardScreen({ session }) {
  const { t, lang } = useLang()
  const [scope, setScope] = useState('all')
  const [boards, setBoards] = useState({})
  const [failed, setFailed] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all(['all', 'friends'].map(s => apiJson(`/api/pvp/board?scope=${s}&limit=${TOP}&around=1`, session)))
      .then(([all, friends]) => { if (live) setBoards({ all, friends }) })
      .catch(e => { if (live) setFailed(errorKey(e)) })
    return () => { live = false }
  }, [session])

  const board = boards[scope]
  const me = board?.me ?? null
  const top = board?.entries ?? []
  const shown = new Set(top.map(e => e.rank))
  const near = (board?.near ?? []).filter(e => !shown.has(e.rank))
  // The hairline marks the ranks skipped between the top and the learner.
  const cut = near.length > 0 && near[0].rank > top.length + 1
  return (
    <main id="main-content" className="pvp bzp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpEloBoard} color="var(--pass-ink)" aside={<Leave to="/profile/duels">{t.pvpTitle}</Leave>} />
      {!board ? (failed ? <p className="pvp-run__fail">{t[failed]}</p> : <Loading />) : (
        <section className="banzuke" aria-label={t.pvpEloBoard}>
          <div className="bz__head">
            <Seg full className="bz__seg" label={t.pvpEloBoard} value={scope} onChange={setScope}
              options={[{ key: 'all', label: t.pvpAll(boards.all.of) }, { key: 'friends', label: t.pvpFriendsOnly(boards.friends.of) }]} />
          </div>
          {top.map(e => <Row key={e.rank} e={e} lang={lang} t={t} />)}
          {cut && <div className="bz__cut" aria-hidden="true" />}
          {near.map(e => <Row key={e.rank} e={e} lang={lang} t={t} />)}
          <div className="bz__foot">
            {me?.gap ? <p className="bz__gap-to">{t.pvpGapTo(me.gap.elo, me.gap.rank)}</p>
              : me?.rank == null ? <p className="bz__gap-to">{t.pvpNotRanked}</p> : <span className="bz__gap-to" />}
          </div>
        </section>
      )}
    </main>
  )
}
