import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { MuteButton, LangSwitcher } from './NavControls'

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
export function BurgerMenu({ links = [] }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useLang()

  const close = () => setOpen(false)

  const go = (path) => {
    navigate(path)
    close()
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t.menu ?? 'Menu'}
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
          fontSize: 18,
          padding: '6px 10px',
          lineHeight: 1,
        }}
      >
        ☰
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 280,
              maxWidth: '85vw',
              height: '100%',
              background: 'var(--bg-panel)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '2px 0 12px rgba(0,0,0,0.3)',
              animation: 'burgerSlideIn 0.18s ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 'bold' }}>{t.menu ?? 'Menu'}</span>
              <button
                onClick={close}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-primary)',
                  fontSize: 16,
                  padding: '4px 10px',
                }}
              >
                ✕
              </button>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {links.map(link => (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    padding: '12px 16px',
                    borderRadius: 0,
                    justifyContent: 'flex-start',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 20, fontFamily: 'Yu Gothic, system-ui, sans-serif' }}>
                    {link.icon}
                  </span>
                  <span>{link.title}</span>
                </button>
              ))}
            </nav>

            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 16,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                flexWrap: 'wrap',
              }}
            >
              <MuteButton />
              <LangSwitcher />
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                }}
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes burgerSlideIn {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}