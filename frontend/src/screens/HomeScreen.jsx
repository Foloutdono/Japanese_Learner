import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const cards = [
  {
    icon: 'あ',
    title: 'Kana',
    desc: 'Hiragana & Katakana\nde base + combinaisons\nQCM puis écriture libre',
    path: '/kana',
    color: '#e94560',
  },
  {
    icon: '語',
    title: 'Vocabulaire JLPT',
    desc: 'N5 → N1\nKanji + Kana → Sens\nProgression par phases',
    path: '/vocab',
    color: '#4cc9f0',
  },
  {
    icon: '漢',
    title: 'Kanji',
    desc: 'Apprentissage des Kanji\nN5 → N1\nExercices d\'écriture',
    path: '/kanji',
    color: '#533483',
  },
  {
    icon: '📊',
    title: 'Statistiques',
    desc: 'Progression SRS\nCartes maîtrisées\nRévisions dues',
    path: '/stats',
    color: '#2d6a4f',
  },
]

export default function HomeScreen() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'var(--bg-panel)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--accent)', fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
          日本語
        </div>
        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>
          Apprendre le Japonais
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
          Répétition espacée (SM-2) · Hiragana · Katakana · Vocabulaire JLPT
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            fontSize: 12, marginTop: 12,
          }}
        >
          Déconnexion
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
                  Commencer →
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '16px 24px' }}>
        💡 Sessions courtes (15-20 min) mais régulières — le SRS planifie tout automatiquement.
      </footer>

    </div>
  )
}