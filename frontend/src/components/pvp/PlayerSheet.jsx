import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { errorKey } from '../../domain/duel'
import { Sheet } from '../chrome/Sheet'
import { Loading } from '../ui/Loading'
import { UserIcon } from '../ui/Icons'

const REASONS = ['name', 'cheat', 'spam', 'other']

// ── 対戦 — a learner's card (plan 279) ─────────────────────────────
// What a name opens, as the 番付's row opens its learner (plan 262): a
// friend's Elo and the record of your duels; anyone else's username, and
// since plan 315 what the Elo board already prints of them while they are
// on it (the Elo, the place), nothing more. Then the way between you: ask
// them as a friend, accept their request, or challenge a friend (where
// the screen can open the challenge, `onChallenge`). Under it the
// gestures a person needs against another -- no longer friends, block,
// report -- and a report is a reason picked from four, never words: a
// person reads them.
export function PlayerSheet({ username, onClose, onChanged, onChallenge, session }) {
  const { t, lang } = useLang()
  const [card, setCard] = useState(null)
  const [reason, setReason] = useState(null)
  const [error, setError] = useState(null)
  const [said, setSaid] = useState(null)
  const busy = useRef(false)

  // Another name opened (the board's next row): nothing of the last
  // card stays on this one.
  const [shownFor, setShownFor] = useState(username)
  if (username !== shownFor) {
    setShownFor(username)
    setCard(null)
    setError(null)
    setSaid(null)
    setReason(null)
  }

  useEffect(() => {
    if (!username) return undefined
    let live = true
    apiJson(`/api/pvp/learner/${username}`, session)
      .then(c => { if (live) setCard(c) })
      .catch(e => { if (live) setError(errorKey(e)) })
    return () => { live = false }
  }, [username, session])

  function act(path, init, done, then) {
    if (busy.current) return
    busy.current = true
    playClick()
    setError(null)
    apiJson(path, session, init)
      .then(r => { setSaid(done); then?.(r); onChanged?.() })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  // A request asked of one who had asked you is an acceptance.
  const ask = () => act('/api/pvp/requests', { method: 'POST', body: JSON.stringify({ username }) }, null,
    r => { setSaid(r.status === 'friends' ? 'pvpNowFriends' : null); setCard(c => ({ ...c, relation: r.status === 'friends' ? 'friend' : 'sent' })) })
  const accept = () => act(`/api/pvp/requests/${username}/accept`, { method: 'POST', body: '{}' }, 'pvpNowFriends',
    () => setCard(c => ({ ...c, relation: 'friend' })))

  const friend = card?.relation === 'friend'
  const board = card?.board ?? null
  // A friend's Elo whether or not they keep off the board; anyone
  // else's only as the board prints it.
  const elo = board?.elo ?? (friend ? card?.elo : null)
  return (
    <Sheet open={Boolean(username)} onClose={onClose} title={username ?? ''} icon={UserIcon}
      label={username ? t.bzCardAria(username) : undefined} className="pvp-sheet pvp-card" dismiss>
      {!card && !error && <Loading />}
      {card && (
        <div className="pvp-card__facts">
          {elo != null && (
            <span className="pvp-card__fig">
              <b className="pvp-card__num">{elo.toLocaleString(lang)}{(board?.provisional ?? card.provisional) && <span className="pvp-board__prov" title={t.pvpProvisional}>?</span>}</b>
              <span className="pvp-curve__cap">{t.pvpElo}</span>
            </span>
          )}
          {board?.rank != null && (
            <span className="pvp-card__fig"><b className="pvp-card__num">{t.pvpOrdinal(board.rank)}</b><span className="pvp-curve__cap">{t.pvpOutOf(board.of.toLocaleString(lang))}</span></span>
          )}
          {friend && card.wins != null && (
            <span className="pvp-card__fig"><b className="pvp-card__num">{card.wins}–{card.losses}</b><span className="pvp-curve__cap">{t.pvpBetweenYou}</span></span>
          )}
          {!friend && !board && card.relation !== 'me' && <p className="pvp-sheet__help">{t.pvpCardStranger}</p>}
        </div>
      )}
      {card && card.relation !== 'me' && (
        <div className="pvp-card__way">
          {card.relation === 'none' && <button type="button" className="btn-primary" onClick={ask}>{t.pvpAsk}</button>}
          {card.relation === 'received' && <button type="button" className="btn-primary" onClick={accept}>{t.pvpAccept}</button>}
          {card.relation === 'sent' && <p className="pvp-sheet__help">{t.pvpRelation.sent}</p>}
          {friend && onChallenge && (
            <button type="button" className="btn-primary" onClick={() => { playClick(); onChallenge(username) }}>{t.pvpChallenge(username)}</button>
          )}
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
