import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../config/navLinks'
import { useProfileSummary } from '../stores/profileSummary'
import { levelTitle } from '../domain/levelTitle'
import { playAnnouncement, startAmbiance, stopAmbiance } from '../lib/audio'
import { FlameIcon, GearIcon, LightbulbIcon } from '../components/ui/Icons'

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

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  if (!summary) {
    return (
      <button type="button" onClick={() => navigate('/profile')} className="home-profile-badge home-profile-badge--fallback">
        <span className="home-profile-badge__fallback-glyph" aria-hidden="true">顔</span>
        <span>{t.profileTitle}</span>
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
        <span className="home-profile-badge__streak" title={t.streak}>
          <FlameIcon size={16} /> {summary.streak}
        </span>
      )}
    </button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t }     = useLang()
  // Same shared store HomeProfileBadge reads, so this is a second
  // subscriber rather than a second fetch. Only one number is wanted
  // here: how many darumas are sitting fulfilled and unclaimed, which
  // is the one thing on the home screen that expires — an unclaimed
  // daily is gone at midnight.
  const summary   = useProfileSummary()
  const darumaReady = summary?.daruma?.ready ?? 0

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
    // Mount/unmount only. Without the dependency array this
    // effect re-ran on every render, tearing the loop down and
    // starting it again from zero each time.
  }, [])

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
            title={t.settings}
            aria-label={t.settings}
          >
            <GearIcon size={17} />
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="container">
          <div className="home-grid">
            {cards.map(card => ((card.path === '/') ? null : (
              <button
                key={card.path}
                type="button"
                onClick={() => { playAnnouncement(card.path.slice(1)); navigate(card.path) }}
                className="home-card"
                style={{ '--row-color': card.color }}
              >
                <span className="home-card__glyph">{card.icon}</span>
                <span className="home-card__title">{card.title}</span>
                <span className="home-card__rule" aria-hidden="true" />
                <span className="home-card__desc">{card.desc}</span>
                {card.path === '/daruma' && darumaReady > 0 && (
                  <span className="home-card__badge" title={t.darumaReadyCount(darumaReady)}>
                    {darumaReady}
                  </span>
                )}
              </button>
            )))}
          </div>
        </div>
      </main>

      <footer className="home-footer"><LightbulbIcon size={14} /> {t.tip}</footer>
    </div>
  )
}