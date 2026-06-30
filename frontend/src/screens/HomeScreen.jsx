import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'
import { LangSwitcher } from '../components/TopBar'

export default function HomeScreen() {
  const navigate        = useNavigate()
  const { t }           = useLang()

  const cards = [
    { icon: 'あ',   title: t.kanaTitle,       desc: t.kanaDesc,       path: '/kana',       color: '#EF476F' },
    { icon: '単語', title: t.vocabTitle,      desc: t.vocabDesc,      path: '/vocab',      color: '#118AB2' },
    { icon: '漢字', title: t.kanjiTitle,      desc: t.kanjiDesc,      path: '/kanji',      color: '#6D28D9' },
    { icon: '辞書', title: t.dictionaryTitle, desc: t.dictionaryDesc, path: '/dictionary', color: '#F59E0B' },
    { icon: '文法', title: t.grammarTitle,    desc: t.grammarDesc,    path: '/grammar',    color: '#10B981' },
    { icon: '読書', title: t.readingTitle,    desc: t.readingDesc,    path: '/reading',    color: '#EC4899' },
    { icon: '解析', title: t.phraseAnalyzerTitle, desc: t.phraseAnalyzerDesc, path: '/phrase-analyzer', color: '#F97316' },
    { icon: '統計', title: t.statsTitle,      desc: t.statsDesc,      path: '/stats',      color: '#14B8A6' },
    { icon: '教材', title: t.decksTitle,      desc: t.decksDesc,      path: '/decks',      color: '#3B82F6' },
    { icon: '理解', title: t.readingComprehensionTitle, desc: t.readingComprehensionDesc, path: '/reading-comprehension', color: '#8B5CF6' },
  ]
  
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <header style={{ background: 'var(--bg-panel)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--accent)', fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
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
                <div style={{ fontSize: 64, color: card.color, fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
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