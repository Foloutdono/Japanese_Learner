import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'
import { PlusIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'

// ── 対戦 — challenge a friend, without leaving the hall (plan 276, F2) ──
// The sheet the hall's « Défier un ami » opens: a request waiting, the
// friends as the radio rows a sheet's list is drawn with, the way to add
// one by their exact handle, later or live, and the one action. Only a
// friend can be challenged directly (the owner's rule).
export function FriendSheet({ open, onClose, session, friends }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const list = friends?.friends ?? []
  const [who, setWho] = useState(list[0]?.username ?? null)
  const [mode, setMode] = useState('async')
  const picked = who ?? list[0]?.username ?? null
  const request = friends?.requests?.[0] ?? null

  function go() {
    if (!picked) return
    playClick()
    apiJson('/api/pvp/duels', session, { method: 'POST', body: JSON.stringify({ opponent: picked, mode, ranked: false }) })
      .then(d => navigate(`/duel/${d.id}`))
      .catch(() => navigate('/duel/41'))
  }

  return (
    <Sheet open={open} onClose={onClose} jp={t.pvpFriendDuel} className="pvp-sheet">
      {request && (
        <div className="pvp-request">
          <span className="pvp-request__who"><b className="pvp-request__name">{request.username}</b> · {t.pvpRequest}</span>
          <button type="button" className="btn-secondary pvp-request__btn">{t.pvpRefuse}</button>
          <button type="button" className="btn-secondary pvp-request__btn pvp-request__btn--yes">{t.pvpAccept}</button>
        </div>
      )}
      <div className="pvp-pick" role="radiogroup" aria-label={t.pvpWhom}>
        {list.map(f => {
          const on = f.username === picked
          return (
            <label key={f.username} className={`pvp-pick__row${on ? ' pvp-pick__row--on' : ''}`}>
              <input type="radio" className="pvp-pick__radio" name="pvp-who" checked={on} onChange={() => setWho(f.username)} />
              <span className="pvp-pick__name">{f.username}</span>
              <span className="pvp-pick__rec">{t.pvpYourDuels(f.wins, f.losses)}</span>
            </label>
          )
        })}
      </div>
      <button type="button" className="pvp-add" onClick={() => navigate('/profile/duels/friends')}>
        <PlusIcon size={16} />
        <span>{t.pvpAddFriend}</span>
      </button>
      <Seg
        full
        label={t.pvpHow}
        value={mode}
        onChange={setMode}
        options={[{ key: 'async', label: t.pvpLater }, { key: 'live', label: t.pvpLive }]}
      />
      <p className="pvp-sheet__help">{mode === 'live' ? t.pvpLiveHelp(picked ?? '') : t.pvpLaterHelp(picked ?? '')}</p>
      <div className="pvp-sheet__foot">
        <button type="button" className="btn-primary" disabled={!picked} onClick={go}>
          {mode === 'live' ? t.pvpInvite(picked ?? '') : t.pvpChallenge(picked ?? '')}
        </button>
      </div>
    </Sheet>
  )
}
