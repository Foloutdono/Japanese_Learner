import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { LangSwitcher } from '../components/TopBar'
import { getNavLinks } from '../navLinks'

export default function HomeScreen() {
  const navigate        = useNavigate()
  const { t }           = useLang()

  const cards = getNavLinks(t)
  
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <header style={{ background: 'var(--bg-panel)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--accent)', fontFamily: 'Yu Gothic, system-ui, -apple-system, "Segoe UI", sans-serif', lineHeight: 1 }}>
          {t.appTitle}
        </div>
        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{t.learnJapanese}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{t.appDesc}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: 12 }}
          >
            {t.signOut}
          </button>
          <LangSwitcher />
        </div>
      </header>

      <main style={{ flex: 1, padding: '40px 24px' }}>
        <div className="container">
          <div className="grid-4">
            {cards.map(card => (
              <div
                key={card.path}
                onClick={() => navigate(card.path)}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius)',
                  padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'background 0.2s, transform 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)';  e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ fontSize: 64, color: card.color, fontFamily: 'Yu Gothic, system-ui, -apple-system, "Segoe UI", sans-serif', lineHeight: 1 }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>{card.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6, flex: 1 }}>
                  {card.desc}
                </div>
                <button style={{ background: card.color, color: '#fff', width: '100%', marginTop: 8 }}>
                  {t.start}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '16px 24px' }}>
        {t.tip}
      </footer>
    </div>
  )
}