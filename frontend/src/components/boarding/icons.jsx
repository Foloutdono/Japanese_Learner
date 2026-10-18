// ── The boarding's line icons (plan 075) ─────────────────────────
// Stroke icons at 24 on the canvas's own paths: the check every choice
// wears, the chevron on the back button, and one glyph per motive.
// Each is a component and nothing else (react-refresh's rule for a
// .jsx file); the motive list itself is domain/boarding.js's.
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

// ── 辻 — the six reasons as pictograms (plan 163) ────────────────
// Solid glyphs at 48, for the desk's six roads (WhyStep's WhyRoads),
// where each stands alone in a ring at its road's end: the line icons
// above are drawn for a row's 20px beside a label, and thin to a
// hairline at twice that. The suitcase, the house and the speech
// bubble are cut by their own holes (evenodd): the handle and the
// straps, the door, the three dots.
const MOTIVE_GLYPHS = {
  studies: (
    <>
      <path d="M6 11.5c6-1.8 12-1.4 16.5 1.6V40c-4.6-2.6-10.6-3-16.5-1.4Z" />
      <path d="M42 11.5c-6-1.8-12-1.4-16.5 1.6V40c4.6-2.6 10.6-3 16.5-1.4Z" />
    </>
  ),
  fun: (
    <>
      <path d="M20 6l3.6 11.4L35 21l-11.4 3.6L20 36l-3.6-11.4L5 21l11.4-3.6Z" />
      <path d="M37 28l1.9 5.1L44 35l-5.1 1.9L37 42l-1.9-5.1L30 35l5.1-1.9Z" />
    </>
  ),
  trip: <path fillRule="evenodd" d="M18 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4h7a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V17a4 4 0 0 1 4-4h7ZM21.5 9.5V13h5V9.5ZM15 17v20h3V17ZM30 17v20h3V17Z" />,
  live: <path fillRule="evenodd" d="M24 5L43 20.5L40.5 23.6L38 21.6V41H10V21.6L7.5 23.6L5 20.5ZM20 41V29H28V41Z" />,
  friends: (
    <>
      <circle cx="16" cy="16" r="6.5" />
      <path d="M3 38a13 13 0 0 1 26 0Z" />
      <circle cx="39" cy="22" r="5" />
      <path d="M30 38a9 9 0 0 1 18 0Z" />
    </>
  ),
  other: <path fillRule="evenodd" d="M10 9h28a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H22l-9 7v-7h-3a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5ZM14 22.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0ZM21.5 22.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0ZM29 22.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0Z" />,
}

export function MotiveGlyph({ motive }) {
  return (
    <svg className="desk-brd__pic" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
      {MOTIVE_GLYPHS[motive] ?? MOTIVE_GLYPHS.other}
    </svg>
  )
}
