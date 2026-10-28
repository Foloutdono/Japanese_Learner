import { Link } from 'react-router-dom'
import { Sheet } from '../chrome/Sheet'
import { UserIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { useCachedJson } from '../../lib/cachedJson'
import { DIVISIONS } from '../../domain/banzuke'

// ── 番付 — a row's card (plan 262) ────────────────────────────────
// What a name on the board opens: what the board already says about
// that learner (their level, their places this week and all time, their
// division) and the decks they published to the library, each a door to
// its page there -- never their streak or their JLPT level, which no
// other learner is shown (privacy.html). Read from GET /api/leaderboard/learner/
// {username}, which answers 404 for a learner who keeps off the board.
// The handle is the board's, never the name a learner's own card prints
// (CLAUDE.md, plan 247).
export function LearnerSheet({ username, session, onClose }) {
  const { t, lang } = useLang()
  // undefined while on its way, null when it failed (lib/cachedJson).
  const got = useCachedJson(`/api/leaderboard/learner/${encodeURIComponent(username)}`, session)
  const card = got ?? null
  const failed = got === null

  const division = card ? DIVISIONS[card.division.index] : null
  const figure = n => (n == null ? '—' : `#${n.toLocaleString(lang)}`)
  return (
    <Sheet open onClose={onClose} title={username} icon={UserIcon} label={t.bzCardAria(username)} className="bz-card" dismiss>
      {failed && <p className="hint" role="alert">{t.bzCardFailed}</p>}
      {!card && !failed && <p className="bz-card__wait" aria-busy="true">…</p>}
      {card && (
        <>
          <dl className="bz-card__figs">
            <div className="bz-card__fig">
              <dt>{t.bzCardLevel}</dt>
              <dd>{card.level}</dd>
            </div>
            <div className="bz-card__fig">
              <dt>{t.periodWeek}</dt>
              <dd>{figure(card.places.week)}<small>{card.weekXp.toLocaleString(lang)} XP</small></dd>
            </div>
            <div className="bz-card__fig">
              <dt>{t.periodAll}</dt>
              <dd>{figure(card.places.all)}<small>{card.xp.toLocaleString(lang)} XP</small></dd>
            </div>
          </dl>
          <p className="bz-card__division">
            <span className="bz-card__division-name">{division.latin}</span>
          </p>
          {card.decks.length > 0 && (
            <ul className="bz-card__decks" aria-label={t.bzCardDecks}>
              {card.decks.map(d => (
                <li key={d.id}>
                  <Link to={`/learn/decks/library/${d.id}`} className="bz-card__deck" onClick={onClose}>{d.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Sheet>
  )
}
