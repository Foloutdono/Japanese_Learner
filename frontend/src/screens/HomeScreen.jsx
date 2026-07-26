import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { useProfileSummary } from '../components/userProfileSummary'
import { levelTitle } from '../levelTitle'

// ── Header profile badge ──────────────────────────────────
// Replaces the old sign-out/theme/lang button row: a single glance at
// where the user stands (level ring, name, rank, streak — the same
// language BurgerMenu's own profile row already uses elsewhere in the
// app) that doubles as the redirect into the full Profile screen.
// Falls back to a plain "Profil" pill until the summary loads (or if
// there's no session yet), same fallback BurgerProfileRow uses.
function HomeProfileBadge() {
  const navigate = useNavigate()
  const { t }     = useLang()
  const summary   = useProfileSummary()

  if (!summary) {
    return (
      <button type="button" onClick={() => navigate('/profile')} className="home-profile-badge home-profile-badge--fallback">
        <span className="home-profile-badge__fallback-glyph" aria-hidden="true">顔</span>
        <span>{t.profileTitle ?? 'Profil'}</span>
      </button>
    )
  }

  const [, jpTitle, title] = levelTitle(summary.level)
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const r = 20
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <button type="button" onClick={() => navigate('/profile')} className="home-profile-badge">
      <span className="home-profile-badge__ring-wrap">
        <svg className="home-profile-badge__ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="home-profile-badge__ring-track" cx="24" cy="24" r={r} />
          <circle
            className="home-profile-badge__ring-fill"
            cx="24" cy="24" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <span className="home-profile-badge__avatar">{summary.username.charAt(0).toUpperCase()}</span>
      </span>

      <span className="home-profile-badge__info">
        <span className="home-profile-badge__name">{summary.username}</span>
        <span className="home-profile-badge__rank" lang="ja">{jpTitle} · {title}</span>
      </span>

      {summary.streak > 0 && (
        <span className="home-profile-badge__streak" title={t.streak ?? 'Série'}>
          <span aria-hidden="true">🔥</span> {summary.streak}
        </span>
      )}
    </button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t }     = useLang()

  const cards = getNavLinks(t)

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="home-header__glyph">{t.appTitle}</div>
        <div className="home-header__title">{t.learnJapanese}</div>
        <div className="home-header__desc">{t.appDesc}</div>
        <div className="home-header__actions">
          <HomeProfileBadge />
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="btn-nav btn-nav--icon home-settings-btn"
            title={t.settings ?? 'Paramètres'}
            aria-label={t.settings ?? 'Paramètres'}
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="container">
          <div className="home-grid">
            {cards.map(card => ((card.path === '/' || card.path === '/profile') ? null : (
              <button
                key={card.path}
                type="button"
                onClick={() => navigate(card.path)}
                className="home-card"
                style={{ '--row-color': card.color }}
              >
                <span className="home-card__glyph">{card.icon}</span>
                <span className="home-card__title">{card.title}</span>
                <span className="home-card__rule" aria-hidden="true" />
                <span className="home-card__desc">{card.desc}</span>
              </button>
            )))}
          </div>
        </div>
      </main>

      <footer className="home-footer">{t.tip}</footer>
    </div>
  )
}