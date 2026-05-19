import { useNavigate } from 'react-router-dom'

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
      <div style={{ background: 'var(--bg-panel)', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, color: 'var(--accent)', fontFamily: 'Yu Gothic, sans-serif' }}>
          日本語
        </div>
        <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>
          Apprendre le Japonais
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          Répétition espacée (SM-2) · Hiragana · Katakana · Vocabulaire JLPT
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 24,
        padding: 40,
        flex: 1,
      }}>
        {cards.map(card => (
          <div
            key={card.path}
            onClick={() => navigate(card.path)}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: '32px 28px',
              width: 220,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-panel)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
          >
            <div style={{ fontSize: 48, color: card.color, fontFamily: 'Yu Gothic, sans-serif' }}>
              {card.icon}
            </div>
            <div style={{ fontSize: 16, fontWeight: 'bold', margin: '8px 0' }}>
              {card.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-line', marginBottom: 16 }}>
              {card.desc}
            </div>
            <button style={{ background: card.color, color: '#fff', width: '100%' }}>
              Commencer →
            </button>
          </div>
        ))}
      </div>

      {/* Footer tip */}
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '0 0 24px' }}>
        💡 Sessions courtes (15-20 min) mais régulières — le SRS planifie tout automatiquement.
      </div>

    </div>
  )
}