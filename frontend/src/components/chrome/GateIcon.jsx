// ── 改札口の絵文字 — the five gates, drawn ─────────────────────
// The tab bar used to set a kanji where a pictogram goes — 学習 実践
// 本日 辞書 定期券 — with the plain word under it. The pair does not
// fit: five gates are 78px wide on a 390px phone and "DICTIONNAIRE"
// alone is 94, so the caption printed over its neighbour in French
// (English's "DICTIONARY", which the canvas was drawn on, just fits).
// The bar carries these instead, and the word only under the gate you
// are on, where there is room for it. Owner's call, this session.
//
// Drawn to the shared convention (components/ui/Icons.jsx): a 24×24
// viewBox, `currentColor` at stroke-width 2, round caps and joins, so
// the bar's two panel inks light them exactly as they lit the kanji.
// Their own file rather than the shared set: these five are one
// family — a book, a pen, the day, a search, the pass — and they are
// read as a row, so they are drawn as a row.
//
// The one that is not a stock glyph is the profile's: the app's own
// commuter pass (定期券), which is the object the profile screen is,
// down to the roundel printed on it.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

// 学習 — the book you learn from, open on the desk.
function LearnGlyph(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 7.5C10.5 6 8.4 5.2 4.5 5.2v12c3.9 0 6 .8 7.5 2.3" />
      <path d="M12 7.5c1.5-1.5 3.6-2.3 7.5-2.3v12c-3.9 0-6 .8-7.5 2.3" />
      <line x1="12" y1="7.5" x2="12" y2="19.5" />
    </svg>
  )
}

// 実践 — putting it to work: the pen, and the line it writes on.
function PracticeGlyph(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.8 3.9a2 2 0 0 1 2.8 2.8L9.9 16.4l-3.7.9.9-3.7z" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  )
}

// 本日 — the day itself: the calendar's leaf, today marked on it.
function TodayGlyph(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <line x1="3.5" y1="9.8" x2="20.5" y2="9.8" />
      <line x1="8" y1="3" x2="8" y2="6.5" />
      <line x1="16" y1="3" x2="16" y2="6.5" />
      <circle cx="12" cy="15" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// 辞書 — what the dictionary screen is: a search.
function DictionaryGlyph(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
    </svg>
  )
}

// 定期券 — the pass in your pocket, its holder's roundel on it.
function ProfileGlyph(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <circle cx="9" cy="12" r="2.4" />
      <line x1="14" y1="10.4" x2="18" y2="10.4" />
      <line x1="14" y1="13.6" x2="18" y2="13.6" />
    </svg>
  )
}

const GLYPHS = {
  learn: LearnGlyph,
  practice: PracticeGlyph,
  today: TodayGlyph,
  dictionary: DictionaryGlyph,
  profile: ProfileGlyph,
}

/** One gate's pictogram, by the tab id in config/tabs.js. */
export function GateIcon({ id, size = 21 }) {
  const Glyph = GLYPHS[id]
  return Glyph ? <Glyph width={size} height={size} /> : null
}
