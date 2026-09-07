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

export function BackChevron() {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}

const MOTIVE_PATHS = {
  studies: (
    <>
      <path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />
    </>
  ),
  fun: <path d="M12 3l2.3 5.7L20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3z" />,
  trip: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V4h6v3" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </>
  ),
  live: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  friends: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M15.5 15.6a5 5 0 0 1 6 4.4" />
    </>
  ),
  other: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
}

export function MotiveIcon({ motive }) {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      {MOTIVE_PATHS[motive] ?? MOTIVE_PATHS.other}
    </svg>
  )
}
