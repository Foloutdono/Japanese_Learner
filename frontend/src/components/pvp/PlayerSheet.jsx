import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { errorKey } from '../../domain/duel'
import { Sheet } from '../chrome/Sheet'
import { Loading } from '../ui/Loading'

const REASONS = ['name', 'cheat', 'spam', 'other']

// ── 対戦 — a learner's card (plan 276) ─────────────────────────────
// What a name opens, as the 番付's row opens its learner (plan 262): a
// friend's Elo and the record of your duels; anyone else's username
// alone, the owner's rule. Under it the gestures a person needs against
// another -- no longer friends, block, report -- and a report is a reason
// picked from four, never words: a person reads them.
export function PlayerSheet({ username, onClose, onChanged, session }) {
  const { t, lang } = useLang()
  const [card, setCard] = useState(null)
  const [reason, setReason] = useState(null)
  const [error, setError] = useState(null)
  const [said, setSaid] = useState(null)
  const busy = useRef(false)

  useEffect(() => {
    if (!username) return undefined
    let live = true
    apiJson(`/api/pvp/learner/${username}`, session)
      .then(c => { if (live) setCard(c) })
      .catch(e => { if (live) setError(errorKey(e)) })
    return () => { live = false }
  }, [username, session])

  function act(path, init, done) {
    if (busy.current) return
    busy.current = true
    playClick()
    setError(null)
    apiJson(path, session, init)
      .then(() => { setSaid(done); onChanged?.() })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  const friend = card?.relation === 'friend'
  return (
    <Sheet open={Boolean(username)} onClose={onClose} jp={username ?? ''} className="pvp-sheet pvp-card">
      {!card && !error && <Loading />}
      {card && (
        <div className="pvp-card__facts">
          {friend && card.elo != null && (
            <span className="pvp-card__fig"><b className="pvp-card__num">{card.elo.toLocaleString(lang)}</b><span className="pvp-curve__cap">{t.pvpElo}</span></span>
          )}
          {friend && (
            <span className="pvp-card__fig"><b className="pvp-card__num">{card.wins}–{card.losses}</b><span className="pvp-curve__cap">{t.pvpBetweenYou}</span></span>
          )}
          {!friend && <p className="pvp-sheet__help">{t.pvpCardStranger}</p>}
        </div>
      )}
      {said && <p className="pvp-sheet__help" role="status">{t[said]}</p>}
      {error && <p className="pvp-sheet__help pvp-error" role="alert">{t[error]}</p>}
      {card && card.relation !== 'me' && (
        <>
          <fieldset className="pvp-pick pvp-card__report">
            <legend className="pvp-group__cap pvp-card__legend">{t.pvpReport}</legend>
            {REASONS.map(r => (
              <label key={r} className={`pvp-pick__row${reason === r ? ' pvp-pick__row--on' : ''}`}>
                <input type="radio" className="pvp-pick__radio" name="pvp-reason" checked={reason === r} onChange={() => setReason(r)} />
                <span className="pvp-pick__name pvp-card__reason">{t.pvpReasons[r]}</span>
              </label>
            ))}
          </fieldset>
          <div className="pvp-sheet__foot pvp-card__foot">
            <button type="button" className="btn-secondary" disabled={!reason}
              onClick={() => act('/api/pvp/reports', { method: 'POST', body: JSON.stringify({ username, reason }) }, 'pvpReported')}>
              {t.pvpReportSend}
            </button>
            {friend && (
              <button type="button" className="pvp-quiet" onClick={() => act(`/api/pvp/friends/${username}`, { method: 'DELETE' }, 'pvpRemoved')}>
                {t.pvpRemoveFriend}
              </button>
            )}
            <button type="button" className="pvp-quiet" onClick={() => act('/api/pvp/blocks', { method: 'POST', body: JSON.stringify({ username }) }, 'pvpBlocked')}>
              {t.pvpBlock}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
