// ── The boarding's line icons (plan 075) ─────────────────────────
// Stroke icons at 24 on the canvas's own paths: the check every choice
// wears, the chevron on the back button, and the marks the card's line
// and sheets draw. Each is a component and nothing else (react-refresh's
// rule for a .jsx file). The six reasons' glyphs went with the question
// that asked why (plan 247).
const stroke = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

export function CheckMark({ className = 'svg' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <polyline points="4 12 10 18 20 6" />
    </svg>
  )
}

// 乗車 (plan 247): where the card lives, on the line under it -- this
// device alone, or a link on its way to an address.
export function DeviceMark() {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  )
}

export function MailMark() {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  )
}

// 辻 (plan 163): the kana's strip on the lines, a line no answer holds.
export function LockMark() {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function BackChevron() {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
