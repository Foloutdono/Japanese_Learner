import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'

export function TopBar({ onBack, title }) {
  const { lang, switchLang } = useLang()
  const next = LANGUAGES.find(l => l.code !== lang)

  const { t } = useLang()

  return (
    <div className="top-bar">
      <button className="btn-back" onClick={onBack}>{t.menu}</button>
      <span style={{ fontSize: 16, fontWeight: 'bold' }}>{title}</span>

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
    </div>
  )
}
export function KanjiTopBar({ onBack, onClick, title, drawingEnabled}) {
  const { lang, switchLang } = useLang()
  const next = LANGUAGES.find(l => l.code !== lang)

  const { t } = useLang()

  return (
    <div className="top-bar">
      <button className="btn-back" onClick={onBack}>{t.menu}</button>
      <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>
        {title}
      </span>
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
      <button
        onClick={onClick}
        style={{
          background: drawingEnabled ? 'var(--warning)' : 'var(--bg-card)',
          color: drawingEnabled ? '#111' : 'var(--text-secondary)',
          fontSize: 12, padding: '6px 12px',
        }}
        title={t.toggleWriting}
      >
        ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
      </button>
    </div>
  )
}