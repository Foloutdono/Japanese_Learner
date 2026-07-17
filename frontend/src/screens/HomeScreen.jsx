import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang, LangSwitcher } from '../LangContext'
import { getNavLinks } from '../navLinks'

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
          <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>
            {t.signOut}
          </button>
          <LangSwitcher />
        </div>
      </header>

      <main className="home-main">
        <div className="container">
          <div className="home-grid">
            {cards.map(card => (card.path === '/' ? null : (
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