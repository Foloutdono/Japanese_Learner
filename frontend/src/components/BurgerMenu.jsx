import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { MuteButton, LangSwitcher, ThemeToggle } from './NavControls'

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

            <div className="burger-drawer__footer">
              <MuteButton />
              <ThemeToggle />
              <LangSwitcher />
              <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>
                {t.signOut}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}