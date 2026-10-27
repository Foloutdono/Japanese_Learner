import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { SearchIcon } from '../components/ui/Icons'
import { Loading } from '../components/ui/Loading'
import { stationFor } from '../config/stations'
import { useCachedJson } from '../lib/cachedJson'
import { playClick } from '../lib/audio'

// ── 友 — the friends (plan 276, F1) ──────────────────────────────
// A page behind the hall: a learner is found by their exact handle (a
// friend's name before they accept is their handle and nothing else,
// the owner's rule), the requests waiting with their two answers, and
// the friends, each with their Elo and the record between you, and the
// way to challenge them. A name opens the learner's card, where the
// report and the block live.
const STATION = stationFor('/profile/duels')

export default function DuelFriendsScreen({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const data = useCachedJson('/api/pvp/friends', session)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const found = useCachedJson(query.trim().length >= 3 ? `/api/pvp/search?username=${encodeURIComponent(query.trim())}` : null, session)

  return (
    <main id="main-content" className="pvp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpFriendsTitle} color="var(--pass-ink)" aside={<Leave to="/profile/duels">{t.pvpTitle}</Leave>} />
      {data === undefined ? <Loading /> : (
        <>
          <section className="pvp-find" aria-label={t.pvpSearchCap}>
            <label className="pvp-find__cap" htmlFor="pvp-find">{t.pvpSearchCap}</label>
            <div className="field field--search pvp-find__well">
              <SearchIcon className="svg" />
              <input id="pvp-find" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            </div>
            {found && (
              <div className="pvp-person">
                <span className="pf-line__roundel" aria-hidden="true">{found.username.slice(0, 1).toUpperCase()}</span>
                <span className="pvp-person__name">{found.username}</span>
                <button type="button" className="btn-secondary pvp-person__act" onClick={playClick}>{t.pvpAsk}</button>
              </div>
            )}
          </section>
          {data?.requests?.length > 0 && (
            <section className="pvp-group" aria-label={t.pvpRequestsN(data.requests.length)}>
              <span className="pvp-group__cap">{t.pvpRequestsN(data.requests.length)}</span>
              <div className="pvp-list">
                {data.requests.map(r => (
                  <div key={r.username} className="pvp-person">
                    <span className="pf-line__roundel" aria-hidden="true">{r.username.slice(0, 1).toUpperCase()}</span>
                    <span className="pvp-person__name">{r.username}</span>
                    <button type="button" className="btn-secondary pvp-person__act" onClick={playClick}>{t.pvpRefuse}</button>
                    <button type="button" className="btn-secondary pvp-person__act pvp-person__act--yes" onClick={playClick}>{t.pvpAccept}</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="pvp-group" aria-label={t.pvpFriendsN(data?.friends?.length ?? 0)}>
            <span className="pvp-group__cap">{t.pvpFriendsN(data?.friends?.length ?? 0)}</span>
            <div className="pvp-list">
              {(data?.friends ?? []).map(f => (
                <div key={f.username} className="pvp-person">
                  <span className="pf-line__roundel" aria-hidden="true">{f.username.slice(0, 1).toUpperCase()}</span>
                  <span className="pvp-person__names">
                    <button type="button" className="pvp-person__name bz-pick">{f.username}</button>
                    <span className="pvp-person__sub">
                      {f.elo != null ? `${t.pvpElo} ${f.elo.toLocaleString(lang)}` : '—'} · {t.pvpYourDuels(f.wins, f.losses)}
                    </span>
                  </span>
                  <button type="button" className="btn-secondary pvp-person__act" onClick={() => { playClick(); navigate('/profile/duels?friends=F2') }}>{t.pvpChallenge('').trim()}</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
