import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { Mix } from '../components/pvp/parts'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { CHOICES, SPRINT_MS, errorKey, questionWords } from '../domain/duel'
import { refreshDuels, useDuels } from '../stores/duels'

// ── 対戦 — the departure (plan 279, D2) ──
// Where the hall's « Sprint classé » leads, and only there: a friend's
// duel opens its sheet from the hall. Since plan 288 (the owner's A of
// the canvas « La page de départ ») it is the duel's ticket before it is
// bought, the one its cover prints after: you and your Elo against a
// stranger of the Elo the server looks in, the level the paper stands
// at, its questions, its length and what the Elo moves by, all read off
// the hall (`ranked`). « Partir · 2 crédits » makes the duel and starts
// the run at once (the price was read here). No test is asked first: a
// first ranked sprint starts the Elo from the learner's level (plan 282).
const COLOR = 'var(--pass-ink)'

export default function DuelDeparture({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { data } = useDuels()
  const [error, setError] = useState(null)
  const busy = useRef(false)
  const price = data?.prices?.ranked ?? 2
  const elo = data?.rating?.elo
  const ranked = data?.ranked
  const fig = n => n.toLocaleString(lang)

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
        <article className="clrk-tk clrk-tk--paper pvp-ticket" aria-label={t.pvpRanked}>
          <div className="clrk-tk__row">
            <span className="clrk-tk__kind" lang="ja">対戦券</span>
            <span className="clrk-tk__no">{price ? t.pvpCredits(price) : t.pvpIncluded}</span>
          </div>
          <div className="clrk-tk__rule" />
          <div className="pvp-ticket__who">
            <span className="pvp-ticket__side"><b className="pvp-ticket__name">{t.pvpYou}</b><small className="pvp-ticket__level">{elo != null ? t.pvpEloOf(fig(elo)) : ''}</small></span>
            <span className="pvp-ticket__vs" aria-hidden="true">⇄</span>
            <span className="pvp-ticket__side pvp-ticket__side--them"><b className="pvp-ticket__name">?</b><small className="pvp-ticket__level">{ranked ? t.pvpEloRange(fig(ranked.low), fig(ranked.high)) : ''}</small></span>
          </div>
          <dl className="pvp-ticket__facts">
            {ranked && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpDuelLevel}</dt><dd className="pvp-ticket__dd"><Mix mix={ranked.mix} lang={lang} t={t} /></dd></div>}
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpQuestions}</dt><dd className="pvp-ticket__dd">{questionWords(t, ranked?.mix)} · {t.pvpChoicesN(CHOICES)}</dd></div>
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpLength}</dt><dd className="pvp-ticket__dd">{t.pvpMinutes(SPRINT_MS / 60_000)}</dd></div>
            {ranked && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpStake}</dt><dd className="pvp-ticket__dd">{t.pvpStakeElo(ranked.stake)}</dd></div>}
          </dl>
          <div className="clrk-tk__row clrk-tk__foot"><span lang="ja">辻駅 発行</span><span>{t.pvpRanked}</span></div>
        </article>
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
