export default function TopBar({ onBack, title }) {
  return (
    <div className="top-bar">
      <button className="btn-back" onClick={onBack}>← Menu</button>
      <span style={{ fontSize: 16, fontWeight: 'bold' }}>{title}</span>
    </div>
  )
}
export function KanjiTopBar({ onBack, title }) {
  <div className="top-bar">
    <button className="btn-back" onClick={() => setPhase(null)}>← Menu</button>
    <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>
      {`Kanji ${level} — Phase ${phase}`}
    </span>
    <button
      onClick={() => setDrawingEnabled(d => !d)}
      style={{
        background: drawingEnabled ? 'var(--warning)' : 'var(--bg-card)',
        color: drawingEnabled ? '#111' : 'var(--text-secondary)',
        fontSize: 12, padding: '6px 12px',
      }}
      title="Activer/désactiver la pratique d'écriture"
    >
      ✏️ {drawingEnabled ? 'Écriture ON' : 'Écriture OFF'}
    </button>
  </div>
}