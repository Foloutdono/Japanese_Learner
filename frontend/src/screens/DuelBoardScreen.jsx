import { useState } from 'react'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import { Loading } from '../components/ui/Loading'
import { stationFor } from '../config/stations'
import { useCachedJson } from '../lib/cachedJson'

// ── 対戦の番付 — the Elo board, apart from the 番付 (plan 276, L2) ──
// The 番付 ranks XP, which pays study; the Elo ranks sprints, and the
// owner kept them apart. Same drawing as the 番付's whole board: the
// medal roundels, the name, the figure at the edge -- the top of the
// board, a dashed hairline, and the learner between their neighbours,
// the gap to the next place under it. Everyone, or your friends only.
// A learner off the 番付 is off this board too.
const STATION = stationFor('/profile/duels')
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' }

function Row({ e, me, lang }) {
  const medal = MEDAL[e.rank]
  return (
    <div className={`leaderboard-row${me ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${medal ? ` leaderboard-row__rank--${medal}` : ''}`}>{e.rank}</span>
      <span className="leaderboard-row__name">{e.username}</span>
      <span className="leaderboard-row__xp">{e.elo.toLocaleString(lang)}</span>
    </div>
  )
}

export default function DuelBoardScreen({ session }) {
  const { t, lang } = useLang()
  const [scope, setScope] = useState('all')
  const board = useCachedJson(`/api/pvp/board?scope=${scope}`, session)
  const top = board?.entries?.slice(0, 5) ?? []
  const me = board?.me ?? null
  const around = me ? board.entries.filter(e => Math.abs(e.rank - me.rank) <= 1 && e.rank > 5) : []
  return (
    <main id="main-content" className="pvp bzp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpEloBoard} color="var(--pass-ink)" aside={<Leave to="/profile/duels">{t.pvpTitle}</Leave>} />
      {!board ? <Loading /> : (
        <section className="banzuke" aria-label={t.pvpEloBoard}>
          <div className="bz__head">
            <Seg full className="bz__seg" label={t.pvpEloBoard} value={scope} onChange={setScope}
              options={[{ key: 'all', label: t.pvpAll(34) }, { key: 'friends', label: t.pvpFriendsOnly(4) }]} />
          </div>
          {top.map(e => <Row key={e.rank} e={e} me={e.username === me?.username} lang={lang} />)}
          {around.length > 0 && <div className="bz__cut" aria-hidden="true" />}
          {around.map(e => <Row key={e.rank} e={e} me={e.username === me?.username} lang={lang} />)}
          <div className="bz__foot">
            {me?.gap ? <p className="bz__gap-to">{t.pvpGapTo(me.gap.elo, me.gap.rank)}</p> : <span className="bz__gap-to" />}
          </div>
        </section>
      )}
    </main>
  )
}
