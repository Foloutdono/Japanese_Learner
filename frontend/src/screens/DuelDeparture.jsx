import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { SPRINT_MS, errorKey } from '../domain/duel'
import { refreshDuels, useDuels } from '../stores/duels'

// ── 対戦 — the departure (plan 279, D2) ──
// Where the hall's « Sprint classé » leads: its platform alone (a
// stranger near your Elo or a real player's recording, two credits, the
// Elo moves), for the hall already chose it; a friend's duel opens its
// sheet from the hall (plan 288). « Partir · 2 crédits » makes the duel
// and starts the run at once (the price was read here). No test is asked
// first: a first ranked sprint starts the Elo from the learner's level
// (plan 282).
const COLOR = 'var(--pass-ink)'

export default function DuelDeparture({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { data } = useDuels()
  const [error, setError] = useState(null)
  const busy = useRef(false)
  const price = data?.prices?.ranked ?? 2

  function go() {
    if (busy.current) return
    playClick()
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
        <StageHead onLeave={() => navigate('/profile/duels')} leaveLabel={t.pvpTitle} where={t.pvpSprintOf(SPRINT_MS)} pass={false} keys={false} />
        <span className="pvp-air" aria-hidden="true" />
        <div className="pvp-quais pvp-quais--one">
          <div className="pvp-quai pvp-quai--on">
            <span className="pvp-quai__no"><b className="pvp-quai__fig">1</b><span className="pvp-quai__jp" lang="ja">番線</span></span>
            <span className="pvp-quai__title">{t.pvpRanked}</span>
            {t.pvpPlatformRanked.map(l => <span key={l} className="pvp-quai__line">{l}</span>)}
            <span className="pvp-quai__price">{price ? t.pvpCredits(price) : t.pvpIncluded}</span>
          </div>
        </div>
        <p className="pvp-run__help pvp-run__help--center">{t.pvpRankedFoot}</p>
        {error && <p className="pvp-run__help pvp-run__help--center pvp-error" role="alert">{t[error]}</p>}
        <span className="pvp-air" aria-hidden="true" />
        <div className="exam-cover__foot">
          <button type="button" className="btn-primary exam-cover__go" onClick={go}>{price ? t.pvpGoPaid(price) : t.pvpGo}</button>
        </div>
      </main>
      <LevelBar />
    </div>
  )
}
