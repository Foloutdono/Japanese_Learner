import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { LangSwitcher } from '../components/TopBar'
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
          <div className="choice-list">
            {cards.map((card, i) => (
              <button
                key={card.path}
                type="button"
                onClick={() => navigate(card.path)}
                className="choice-row"
                style={{ '--row-color': card.color }}
              >
                <span className="choice-row__accent" aria-hidden="true" />
                <span className="choice-row__index choice-row__index--glyph">{card.icon}</span>
                <span className="choice-row__main">
                  <span className="choice-row__title">{card.title}</span>
                  <span className="choice-row__desc choice-row__desc--multiline">{card.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="home-footer">{t.tip}</footer>
    </div>
  )
}