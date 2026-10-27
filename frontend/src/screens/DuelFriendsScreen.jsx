import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { SearchIcon } from '../components/ui/Icons'
import { Loading } from '../components/ui/Loading'
import { FriendSheet } from '../components/pvp/FriendSheet'
import { PlayerSheet } from '../components/pvp/PlayerSheet'
import { stationFor } from '../config/stations'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { errorKey } from '../domain/duel'
import { refreshDuels } from '../stores/duels'

// ── 友 — the friends (plan 276, F1) ──────────────────────────────
// A page behind the hall: a learner is found by their exact handle,
// asked when the search is sent (thirty searches in ten minutes, and a
// handle half typed finds nobody anyway); the requests waiting with
// their two answers, the ones sent with the way to take them back; the
// friends, each with their Elo and the record between you, and the way
// to challenge them; the learners blocked, to unblock. A name opens the
// learner's card, where the report and the block live. Before a request
// is accepted a learner is their handle and nothing else.
const STATION = stationFor('/profile/duels')

export default function DuelFriendsScreen({ session }) {
  const { t, lang } = useLang()
  const [book, setBook] = useState(null)
  const [failed, setFailed] = useState(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState(null)
  const [error, setError] = useState(null)
  const [card, setCard] = useState(null)
  const [challenge, setChallenge] = useState(null)
  const busy = useRef(false)

  const reload = useCallback(() => apiJson('/api/pvp/friends', session)
    .then(b => { setBook(b); refreshDuels() })
    .catch(e => setFailed(errorKey(e))), [session])
  useEffect(() => { reload() }, [reload])

  function act(path, init, after) {
    if (busy.current) return
    busy.current = true
    playClick()
    setError(null)
    apiJson(path, session, init)
      .then(r => { after?.(r); return reload() })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  function search(e) {
    e.preventDefault()
    const name = query.trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name) || busy.current) {
      setFound(null)
      setError(name ? 'pvpErrNotFound' : null)
      return
    }
    busy.current = true
    playClick()
    setError(null)
    apiJson(`/api/pvp/search?username=${encodeURIComponent(name)}`, session)
      .then(setFound)
      .catch(err => { setFound(null); setError(errorKey(err)) })
      .finally(() => { busy.current = false })
  }

  const ask = name => act('/api/pvp/requests', { method: 'POST', body: JSON.stringify({ username: name }) },
    r => setFound(f => (f ? { ...f, relation: r.status === 'friends' ? 'friend' : 'sent' } : f)))
  const answer = (name, verb) => act(`/api/pvp/requests/${name}/${verb}`, { method: 'POST', body: '{}' })

  return (
    <main id="main-content" className="pvp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpFriendsTitle} color="var(--pass-ink)" aside={<Leave to="/profile/duels">{t.pvpTitle}</Leave>} />
      {!book ? (failed ? <p className="pvp-run__fail">{t[failed]}</p> : <Loading />) : (
        <>
          <form className="pvp-find" onSubmit={search} role="search" aria-label={t.pvpSearchCap}>
            <label className="pvp-find__cap" htmlFor="pvp-find">{t.pvpSearchCap}</label>
            <div className="field field--search pvp-find__well">
              <SearchIcon className="svg" />
              <input id="pvp-find" value={query} onChange={e => { setQuery(e.target.value); setFound(null) }} enterKeyHint="search"
                autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={20} />
              <button type="submit" className="btn-secondary pvp-find__go">{t.pvpFind}</button>
            </div>
            {found && (
              <div className="pvp-person">
                <span className="pf-line__roundel" aria-hidden="true">{found.username.slice(0, 1).toUpperCase()}</span>
                <span className="pvp-person__name">{found.username}</span>
                {found.relation === 'none' && <button type="button" className="btn-secondary pvp-person__act" onClick={() => ask(found.username)}>{t.pvpAsk}</button>}
                {found.relation === 'received' && <button type="button" className="btn-secondary pvp-person__act" onClick={() => answer(found.username, 'accept')}>{t.pvpAccept}</button>}
                {found.relation !== 'none' && found.relation !== 'received' && <span className="pvp-person__sub">{t.pvpRelation[found.relation]}</span>}
              </div>
            )}
            {error && <p className="pvp-sheet__help pvp-error" role="alert">{t[error]}</p>}
          </form>
          {book.requests.length > 0 && (
            <section className="pvp-group" aria-label={t.pvpRequestsN(book.requests.length)}>
              <span className="pvp-group__cap">{t.pvpRequestsN(book.requests.length)}</span>
              <div className="pvp-list">
                {book.requests.map(r => (
                  <div key={r.username} className="pvp-person">
                    <span className="pf-line__roundel" aria-hidden="true">{r.username.slice(0, 1).toUpperCase()}</span>
                    <button type="button" className="pvp-person__name bz-pick" onClick={() => setCard(r.username)}>{r.username}</button>
                    <button type="button" className="btn-secondary pvp-person__act" onClick={() => answer(r.username, 'refuse')}>{t.pvpRefuse}</button>
                    <button type="button" className="btn-secondary pvp-person__act" onClick={() => answer(r.username, 'accept')}>{t.pvpAccept}</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="pvp-group" aria-label={t.pvpFriendsN(book.friends.length)}>
            <span className="pvp-group__cap">{t.pvpFriendsN(book.friends.length)}</span>
            <div className="pvp-list">
              {book.friends.length === 0 && <p className="pvp-console__none pvp-list__none">{t.pvpNoFriends}</p>}
              {book.friends.map(f => (
                <div key={f.username} className="pvp-person">
                  <span className="pf-line__roundel" aria-hidden="true">{f.username.slice(0, 1).toUpperCase()}</span>
                  <span className="pvp-person__names">
                    <button type="button" className="pvp-person__name bz-pick" onClick={() => setCard(f.username)}>{f.username}</button>
                    <span className="pvp-person__sub">
                      {f.elo != null ? `${t.pvpElo} ${f.elo.toLocaleString(lang)}` : '—'} · {t.pvpYourDuels(f.wins, f.losses)}
                    </span>
                  </span>
                  <button type="button" className="btn-secondary pvp-person__act" onClick={() => { playClick(); setChallenge(f.username) }}>{t.pvpChallengeShort}</button>
                </div>
              ))}
            </div>
          </section>
          {book.sent.length > 0 && (
            <section className="pvp-group" aria-label={t.pvpSentN(book.sent.length)}>
              <span className="pvp-group__cap">{t.pvpSentN(book.sent.length)}</span>
              <div className="pvp-list">
                {book.sent.map(r => (
                  <div key={r.username} className="pvp-person">
                    <span className="pf-line__roundel" aria-hidden="true">{r.username.slice(0, 1).toUpperCase()}</span>
                    <span className="pvp-person__name">{r.username}</span>
                    <button type="button" className="btn-secondary pvp-person__act" onClick={() => act(`/api/pvp/requests/${r.username}`, { method: 'DELETE' })}>{t.pvpWithdraw}</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {book.blocked.length > 0 && (
            <section className="pvp-group" aria-label={t.pvpBlockedN(book.blocked.length)}>
              <span className="pvp-group__cap">{t.pvpBlockedN(book.blocked.length)}</span>
              <div className="pvp-list">
                {book.blocked.map(r => (
                  <div key={r.username} className="pvp-person">
                    <span className="pvp-person__name">{r.username}</span>
                    <button type="button" className="btn-secondary pvp-person__act" onClick={() => act(`/api/pvp/blocks/${r.username}`, { method: 'DELETE' })}>{t.pvpUnblock}</button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <PlayerSheet username={card} onClose={() => setCard(null)} onChanged={reload} session={session} />
      <FriendSheet key={challenge ?? ''} open={Boolean(challenge)} preset={challenge} onClose={() => setChallenge(null)} session={session} />
    </main>
  )
}
