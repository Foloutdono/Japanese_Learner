import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useProfileSummary } from './userProfileSummary'
import { levelTitle } from '../levelTitle'

// ── Burger menu button + slide-in drawer ──────────────────
// Drop this anywhere (e.g. in TopBar) to get a full nav drawer
// with the same links as HomeScreen, plus sound/lang/sign-out.
//
// Usage:
//   <BurgerMenu links={[
//     { icon: 'あ', title: t.kanaTitle, path: '/kana' },
//     { icon: '単語', title: t.vocabTitle, path: '/vocab' },
//     ...
//   ]} />
// Ring + name + rank + streak — a compact preview of the Profile
// screen itself rather than a plain nav link, so opening the drawer
// already tells you where you stand. Falls back to a plain "Profil"
// link until the summary loads (or if there's no session), same as
// TopBar's profile ring/level bar.
function BurgerProfileRow({ go, active, t }) {
  const summary = useProfileSummary()

  if (!summary) {
    return (
      <button onClick={() => go('/profile')} className={`burger-drawer__link ${active ? 'burger-drawer__link--active' : ''}`}>
        <span className="burger-drawer__link-icon">侍</span>
        <span>{t.profileTitle ?? 'Profil'}</span>
      </button>
    )
  }

  const [, jpTitle, title] = levelTitle(summary.level)
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const r = 15
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <button
      onClick={() => go('/profile')}
      className={`burger-profile-row${active ? ' burger-profile-row--active' : ''}`}
    >
      <span className="burger-profile-row__ring-wrap">
        <svg className="burger-profile-row__ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="burger-profile-row__ring-track" cx="18" cy="18" r={r} />
          <circle
            className="burger-profile-row__ring-fill"
            cx="18" cy="18" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <span className="burger-profile-row__avatar">{summary.username.charAt(0).toUpperCase()}</span>
      </span>

      <span className="burger-profile-row__info">
        <span className="burger-profile-row__name">{summary.username}</span>
        <span className="burger-profile-row__rank" lang="ja">{jpTitle} · {title}</span>
      </span>

      <span className="burger-profile-row__streak" title={t.streak ?? 'Série'}>
        <span aria-hidden="true">🔥</span> {summary.streak}
      </span>
    </button>
  )
}

export function BurgerMenu({ links = [], currentPath = null, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useLang()

  const setOpenAndNotify = (next) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const close = () => setOpenAndNotify(false)

  const go = (path) => {
    navigate(path)
    close()
  }

  return (
    <>
      <button
        onClick={() => setOpenAndNotify(!open)}
        aria-label={t.menu ?? 'Menu'}
        className="burger-toggle"
      >
        ☰
      </button>

      {open && createPortal(
        <div className="burger-overlay" onClick={close}>
          <div className="burger-drawer" onClick={e => e.stopPropagation()}>
            <div className="burger-drawer__header">
              <span className="burger-drawer__title">{t.menu ?? 'Menu'}</span>
              <button className="burger-drawer__close" onClick={close}>✕</button>
            </div>

            <nav className="burger-drawer__nav">
              {links.map(link => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className={`burger-drawer__link ${currentPath === link.path ? 'burger-drawer__link--active' : ''}`}
                >
                  <span className="burger-drawer__link-icon">{link.icon}</span>
                  <span>{link.title}</span>
                </button>
              ))}
            </nav>

            {/* Pinned above the footer rather than inside the scrollable
                nav list, so it stays reachable regardless of how many
                nav links there are. */}
            <div className="burger-drawer__profile-row">
              <BurgerProfileRow go={go} active={currentPath === '/profile'} t={t} />
            </div>

            {/* Sound/theme/lang/sign-out now live on the Settings screen —
                one entry point here instead of four separate controls
                crowding the footer. */}
            <div className="burger-drawer__footer">
              <button
                onClick={() => go('/settings')}
                className="btn-ghost burger-drawer__settings-btn"
              >
                <span aria-hidden="true">⚙</span> {t.settings ?? 'Paramètres'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}