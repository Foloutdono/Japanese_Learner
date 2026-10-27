import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'
import { PlusIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'
import { errorKey } from '../../domain/duel'
import { refreshDuels } from '../../stores/duels'

// ── 対戦 — challenge a friend, without leaving the hall (plan 276, F2) ──
// The sheet the hall's « Défier un ami » opens: a request waiting, the
// friends as the radio rows a sheet's list is drawn with, the way to add
// one by their exact handle, later or live, and the one action. Only a
// friend can be challenged directly (the owner's rule). The friends are
// read when it opens, so a friend accepted a moment ago is in it.
export function FriendSheet({ open, onClose, session, preset = null }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [who, setWho] = useState(null)
  const [mode, setMode] = useState('async')
  const [error, setError] = useState(null)
  const busy = useRef(false)

  useEffect(() => {
    if (!open) return undefined
    let live = true
    apiJson('/api/pvp/friends', session)
      .then(b => { if (live) setBook(b) })
      .catch(e => { if (live) setError(errorKey(e)) })
    return () => { live = false }
  }, [open, session])

  const list = book?.friends ?? []
  // A friend the sheet was opened for (the friends' page) is picked first.
  const picked = who ?? (list.some(f => f.username === preset) ? preset : list[0]?.username) ?? null
  const request = book?.requests?.[0] ?? null

  function answer(verb) {
    if (busy.current) return
    busy.current = true
    playClick()
    apiJson(`/api/pvp/requests/${request.username}/${verb}`, session, { method: 'POST', body: '{}' })
      .then(() => apiJson('/api/pvp/friends', session).then(setBook))
      .then(() => refreshDuels())
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  function go() {
    if (!picked || busy.current) return
    busy.current = true
    playClick()
    setError(null)
    apiJson('/api/pvp/duels', session, { method: 'POST', body: JSON.stringify({ opponent: picked, mode, ranked: false }) })
      .then(d => { refreshDuels(); navigate(`/duel/${d.id}`) })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  return (
    <Sheet open={open} onClose={onClose} jp={t.pvpFriendDuel} className="pvp-sheet">
      {request && (
        <div className="pvp-request">
          <span className="pvp-request__who"><b className="pvp-request__name">{request.username}</b> · {t.pvpRequest}</span>
          <button type="button" className="btn-secondary pvp-request__btn" onClick={() => answer('refuse')}>{t.pvpRefuse}</button>
          <button type="button" className="btn-secondary pvp-request__btn" onClick={() => answer('accept')}>{t.pvpAccept}</button>
        </div>
      )}
      {list.length > 0 && (
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
      )}
      <button type="button" className="pvp-add" onClick={() => navigate('/profile/duels/friends')}>
        <PlusIcon size={16} />
        <span>{t.pvpAddFriend}</span>
      </button>
      {list.length > 0 && (
        <>
          <Seg
            full
            label={t.pvpHow}
            value={mode}
            onChange={setMode}
            options={[{ key: 'async', label: t.pvpLater }, { key: 'live', label: t.pvpLive }]}
          />
          <p className="pvp-sheet__help">{mode === 'live' ? t.pvpLiveHelp(picked ?? '') : t.pvpLaterHelp(picked ?? '')}</p>
        </>
      )}
      {error && <p className="pvp-sheet__help pvp-error" role="alert">{t[error]}</p>}
      {list.length > 0 && (
        <div className="pvp-sheet__foot">
          <button type="button" className="btn-primary" disabled={!picked} onClick={go}>
            {mode === 'live' ? t.pvpInvite(picked ?? '') : t.pvpChallenge(picked ?? '')}
          </button>
        </div>
      )}
    </Sheet>
  )
}
