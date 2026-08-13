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

  // The Daruma Hall left the grid for the profile, and with it went the
  // only notice that something is expiring — an unclaimed daily doll is
  // burned at midnight. So the count follows it here, onto the door it
  // now lives behind, rather than disappearing from the home screen.
  const ready = summary.daruma?.ready ?? 0

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

      {ready > 0 && (
        <span className="home-profile-badge__dot" title={t.darumaReadyCount(ready)}>
          {ready}
        </span>
      )}
    </button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t }     = useLang()

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
    // Mount/unmount only. Without the dependency array this
    // effect re-ran on every render, tearing the loop down and
    // starting it again from zero each time.
  }, [])

  // Only the sections that are about Japanese. The ones that are about
  // you — the Daruma Hall, the Storehouse, the statistics — are halls
  // on the profile screen now; see config/navLinks.js.
  const cards = getNavLinks(t).filter(card => card.path !== '/')

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
            {cards.map(card => (
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
              </button>
            ))}

            {/* An odd number of sections leaves the last row half empty,
                and an empty cell in a lattice grid isn't blank — it's a
                slab of the border colour the gaps are painted in, which
                reads as a rendering fault. Same watermark filler the
                dictionary and stats grids use for their ragged rows.
                Two fixed columns here (one on a phone, where nothing can
                be orphaned), so the parity is known without measuring. */}
            {cards.length % 2 === 1 && (
              <div className="home-card home-card--filler" aria-hidden="true">
                <span className="home-card__watermark" lang="ja">道</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="home-footer"><LightbulbIcon size={14} /> {t.tip}</footer>
    </div>
  )
}