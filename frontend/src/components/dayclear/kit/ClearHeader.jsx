// ── 見出し — a day-cleared screen's head (plan 191) ──────────────────
// The canvas kit's §8 head: a Japanese caption over the screen's name,
// on the rest-day notice and the tickets' collection.

/** The screen's head: a Japanese caption (本日の運行 終了) over its name (Service terminé). */
export function ClearHeader({ cap, title, titleId, center = false, as: Title = 'h1', className = '', style }) {
  return (
    <header className={['clrk-hdr', center && 'clrk-hdr--center', className].filter(Boolean).join(' ')} style={style}>
      <p className="clrk-hdr__cap" lang="ja">{cap}</p>
      <Title id={titleId} className="clrk-hdr__title">{title}</Title>
    </header>
  )
}
