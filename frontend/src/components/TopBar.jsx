export default function TopBar({ onBack, title }) {
  return (
    <div className="top-bar">
      <button className="btn-back" onClick={onBack}>← Menu</button>
      <span style={{ fontSize: 16, fontWeight: 'bold' }}>{title}</span>
    </div>
  )
}