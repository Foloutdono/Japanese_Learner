import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { FriendSheet } from '../components/pvp/FriendSheet'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { errorKey } from '../domain/duel'
import { refreshDuels, useDuels } from '../stores/duels'

// ── 対戦 — the departure: two platforms side by side (plan 279, D2) ──
// Where the hall's « Sprint classé » leads: platform 1 the ranked sprint
// (a stranger near your Elo or a real player's recording, two credits,
// the Elo moves), platform 2 a friend (free, unranked). The choice lights
// its platform and changes the one button: « Partir · 2 crédits » makes
// the duel and starts the run at once (the price was read here), « Choisir
// un ami » opens the friend's sheet. No test is asked first: a first
// ranked sprint starts the Elo from the learner's level (plan 282).
const COLOR = 'var(--pass-ink)'

export default function DuelDeparture({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = useDuels()
  const [at, setAt] = useState(location.state?.platform === 'friend' ? 1 : 0)
  const [sheet, setSheet] = useState(false)
  const [error, setError] = useState(null)
  const busy = useRef(false)
  const price = data?.prices?.ranked ?? 2

  const quais = [
    { no: 1, title: t.pvpRanked, lines: t.pvpPlatformRanked, price: price ? t.pvpCredits(price) : t.pvpIncluded, foot: t.pvpRankedFoot, go: price ? t.pvpGoPaid(price) : t.pvpGo },
    { no: 2, title: t.pvpFriendDuel, lines: t.pvpPlatformFriend, price: t.pvpFree, foot: t.pvpFriendFoot, go: t.pvpChooseFriend },
  ]

  function go() {
    if (busy.current) return
    playClick()
    if (at === 1) { setSheet(true); return }
    busy.current = true
    setError(null)
    apiJson('/api/pvp/duels', session, { method: 'POST', body: JSON.stringify({ ranked: true }) })
      .then(d => { refreshDuels(); navigate(`/duel/${d.id}`, { replace: true, state: { start: true } }) })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={() => navigate('/profile/duels')} leaveLabel={t.pvpTitle} where={t.pvpSprint60} pass={false} keys={false} />
        <span className="pvp-air" aria-hidden="true" />
        <div className="pvp-quais" role="radiogroup" aria-label={t.pvpTitle}>
          {quais.map((q, i) => (
            <button key={q.no} type="button" role="radio" aria-checked={i === at} className={`pvp-quai${i === at ? ' pvp-quai--on' : ''}`} onClick={() => { playClick(); setAt(i); setError(null) }}>
              <span className="pvp-quai__no"><b className="pvp-quai__fig">{q.no}</b><span className="pvp-quai__jp" lang="ja">番線</span></span>
              <span className="pvp-quai__title">{q.title}</span>
              {q.lines.map(l => <span key={l} className="pvp-quai__line">{l}</span>)}
              <span className="pvp-quai__price">{q.price}</span>
            </button>
          ))}
        </div>
        <p className="pvp-run__help pvp-run__help--center">{quais[at].foot}</p>
        {error && <p className="pvp-run__help pvp-run__help--center pvp-error" role="alert">{t[error]}</p>}
        <span className="pvp-air" aria-hidden="true" />
        <div className="exam-cover__foot">
          <button type="button" className="btn-primary exam-cover__go" onClick={go}>{quais[at].go}</button>
        </div>
      </main>
      <LevelBar />
      <FriendSheet open={sheet} onClose={() => setSheet(false)} session={session} />
    </div>
  )
}
