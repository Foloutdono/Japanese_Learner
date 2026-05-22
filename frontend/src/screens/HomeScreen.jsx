import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'


export default function HomeScreen() {
  const { t } = useLang()

  const cards = [
    {
      icon: 'あ',
      title: t.kanaTitle,
      desc: t.kanaDesc,
      path: '/kana',
      color: '#e94560',
    },
    {
      icon: '語',
      title: t.vocabTitle,
      desc: t.vocabDesc,
      path: '/vocab',
      color: '#4cc9f0',
    },
    {
      icon: '漢',
      title: t.kanjiTitle,
      desc: t.kanjiDesc,
      path: '/kanji',
      color: '#533483',
    },
    {
      icon: '辞',
      title: t.dictionaryTitle,
      desc: t.dictionaryDesc,
      path: '/dictionary',
      color: '#e17055',
    },
    {
      icon: '📊',
      title: t.statsTitle,
      desc: t.statsDesc,
      path: '/stats',
      color: '#2d6a4f',
    },
    {
      icon: '📚',
      title: t.decksTitle,
      desc: t.decksDesc,
      path: '/decks',
      color: '#6c5ce7',
    },
  ]

  const { lang, switchLang } = useLang()
  const next = LANGUAGES.find(l => l.code !== lang) ?? LANGUAGES[0]

  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'var(--bg-panel)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--accent)', fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
          日本語
        </div>
        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>
          {t.learnJapanese}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
          {t.appDesc}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            fontSize: 12, marginTop: 12,
          }}
        >
          {t.signOut}
        </button>
        <button
          onClick={() => switchLang(next.code)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-primary)',
            fontSize: 14, padding: '6px 12px',
          }}
          title={next.label}
        >
          {next.flag} {next.label}
        </button>
      </header>

      {/* Cards */}
      <main style={{ flex: 1, padding: '40px 24px' }}>
        <div className="container">
          <div className="grid-4">
            {cards.map(card => (
              <div
                key={card.path}
                onClick={() => navigate(card.path)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s, transform 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-panel)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-card)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ fontSize: 64, color: card.color, fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {card.title}
                </div>
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

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '16px 24px' }}>
        {t.tip}
      </footer>

    </div>
  )
}