// ── Shared icon set ────────────────────────────────────────
// Drawn glyphs, not emoji — same convention DictionaryDetail.jsx's
// SpeakIcon/CloseIcon/SearchIcon and NavControls.jsx's volume/theme
// icons already established (24x24 viewBox, stroke=currentColor,
// round caps/joins) before this file existed. Centralized here so
// every screen that needs a trash can, a pencil, a chevron, etc.
// shares one definition instead of a fourth or fifth copy drifting
// out of sync. `size` defaults to 18 (a comfortable inline-with-text
// size); pass a different one where a caller needs bigger/smaller.
// All are `aria-hidden` — the accessible label always comes from the
// button/element wrapping the icon (aria-label, title, or adjacent text).

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

export function TrashIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <polyline points="4 7 20 7" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function PencilIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function ImportIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3v12" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function CheckboxIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <polyline points="7.5 12 10.5 15 16.5 9" />
    </svg>
  )
}

export function LightbulbIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.55 1 1.35 1 2.2V16h6v-.3c0-.85.4-1.65 1-2.2A6 6 0 0 0 12 3z" />
    </svg>
  )
}

export function XCircleIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
      <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
    </svg>
  )
}

export function CheckCircleIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  )
}

export function BoltIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeLinejoin="round">
      <polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BooksIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H9a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 0 9 19H4z" />
      <path d="M14 4.5A1.5 1.5 0 0 1 15.5 3H19a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 0-1.5-1.5h-5z" />
      <line x1="10.5" y1="7" x2="13.5" y2="7" />
    </svg>
  )
}

export function HourglassIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M7 3c0 4 4 6 5 8-1 2-5 4-5 8" />
      <path d="M17 3c0 4-4 6-5 8 1 2 5 4 5 8" />
    </svg>
  )
}

export function CardIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="4" width="14" height="18" rx="2" transform="rotate(-8 10 13)" />
      <circle cx="10" cy="13" r="2.5" />
    </svg>
  )
}

export function PageIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <polyline points="14 3 14 7 18 7" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  )
}

export function OpenBookIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 6c-1.5-1.3-3.6-2-6.5-2-.5 0-1 .04-1.5.1V17c.5-.06 1-.1 1.5-.1 2.9 0 5 .7 6.5 2 1.5-1.3 3.6-2 6.5-2 .5 0 1 .04 1.5.1V4.1c-.5-.06-1-.1-1.5-.1-2.9 0-5 .7-6.5 2z" />
      <line x1="12" y1="6" x2="12" y2="19" />
    </svg>
  )
}

export function InboxIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 12h4l1.5 3h5L16 12h4" />
      <path d="M5.5 5h13L20 12v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-6z" />
    </svg>
  )
}

export function ImageIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="M3 17l5.5-5.5a2 2 0 0 1 2.8 0L18 18" />
    </svg>
  )
}

export function SpeakerOffIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <polygon points="4 9 8 9 12 5 12 19 8 15 4 15" fill="currentColor" stroke="none" />
      <line x1="16" y1="9" x2="21" y2="14" />
      <line x1="21" y1="9" x2="16" y2="14" />
    </svg>
  )
}

export function EyeOffIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c5 0 9 3.5 10 7-.4 1.4-1.2 2.7-2.2 3.8" />
      <path d="M6.2 6.2C4.2 7.5 2.7 9.5 2 12c1 3.5 5 7 10 7 1.4 0 2.7-.25 3.9-.7" />
      <path d="M9.5 10a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export function MenuIcon({ size = 20, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function GearIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function CheckIcon({ size = 14, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.5}>
      <polyline points="4 12.5 9.5 18 20 6" />
    </svg>
  )
}

export function CrossIcon({ size = 14, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.5}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  )
}

export function WarningIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3.5l10 17.5H2z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="17.3" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function UndoIcon({ size = 18, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 10h8a6 6 0 1 1-5.7 8" />
      <polyline points="4 4 4 10 10 10" />
    </svg>
  )
}

// One flexible chevron/arrow for every left/right/up/down mark in the
// app — TopBar's back button, the peek handle, review/exam prev-next
// nav, and expand/collapse rows all used to render a different
// font-dependent text glyph each (← ▾ ‹ › ﹀ ︿); one real vector
// path renders identically everywhere instead.
export function ChevronIcon({ direction = 'left', size = 18, className }) {
  const points = {
    left:  '15 5 8 12 15 19',
    right: '9 5 16 12 9 19',
    up:    '5 15 12 8 19 15',
    down:  '5 9 12 16 19 9',
  }[direction]
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.5}>
      <polyline points={points} />
    </svg>
  )
}

export function PlayIcon({ size = 14, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeLinejoin="round">
      <polygon points="6 3.5 20 12 6 20.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StarIcon({ size = 16, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeLinejoin="round">
      <polygon points="12 2.5 15 9 22 10 17 15 18.2 21.8 12 18.5 5.8 21.8 7 15 2 10 9 9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FireIcon({ size = 16, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeLinejoin="round">
      <path
        d="M12 2c1 3-3 4-3 7.5A3 3 0 0 0 12 13a2.5 2.5 0 0 0 2.5-2.5c1.5 1 2.5 3 2.5 5A5 5 0 0 1 7 15.5C7 11 12 8.5 12 2z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
