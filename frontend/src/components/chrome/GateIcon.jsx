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

// The desk's four places (plan 269, config/tabs.js' DESK_PLACE_IDS),
// drawn in the gates' own stroke so the rail's column reads as one set.

// 解析 — the analyser: a passage's lines, and the loupe read over its
// last (the owner's pick E of five shot in the rail). The dictionary's
// lens looks up one word; this one stands on a text.
function AnalyzerGlyph(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7h18" />
      <path d="M3 12h7" />
      <path d="M3 17h5" />
      <circle cx="16" cy="15" r="3.5" />
      <path d="M18.6 17.6l2.4 2.4" />
      <path d="M14.5 15h3" />
    </svg>
  )
}

// 書庫 — the library: two spines upright, and one leaning on them.
function LibraryGlyph(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="4.5" height="15" rx="1" />
      <rect x="10" y="4.5" width="4.5" height="15" rx="1" />
      <path d="M16.4 6.3l2.5-.6 2.3 12.9-2.5.6z" />
    </svg>
  )
}

// 統計 — the statistics: three bars on their ground.
function StatsGlyph(props) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="7" y1="16.5" x2="7" y2="12" />
      <line x1="12" y1="16.5" x2="12" y2="6" />
      <line x1="17" y1="16.5" x2="17" y2="9.5" />
    </svg>
  )
}

// 設定 — the settings: three sliders, each at its own value. The knobs
// are rings (no fill), so the track shows through them on any ground.
function SettingsGlyph(props) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="7" x2="6.8" y2="7" />
      <line x1="11.2" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2.2" />
      <line x1="4" y1="12" x2="13.3" y2="12" />
      <line x1="17.7" y1="12" x2="20" y2="12" />
      <circle cx="15.5" cy="12" r="2.2" />
      <line x1="4" y1="17" x2="5.3" y2="17" />
      <line x1="9.7" y1="17" x2="20" y2="17" />
      <circle cx="7.5" cy="17" r="2.2" />
    </svg>
  )
}

// 対戦 — the duels, the desk's sixth gate (plan 276): the two ways of the
// duel's ticket (⇄), the sign it already prints between the two players
// (the owner's pick A of three shot in the rail).
function DuelsGlyph(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h15" />
      <path d="M15.5 4.5L19 8l-3.5 3.5" />
      <path d="M20 16H5" />
      <path d="M8.5 12.5L5 16l3.5 3.5" />
    </svg>
  )
}

const GLYPHS = {
  learn: LearnGlyph,
  practice: PracticeGlyph,
  today: TodayGlyph,
  dictionary: DictionaryGlyph,
  profile: ProfileGlyph,
  analyzer: AnalyzerGlyph,
  library: LibraryGlyph,
  stats: StatsGlyph,
  settings: SettingsGlyph,
  duels: DuelsGlyph,
}

/** One gate's (or one desk place's) pictogram, by its id in config/tabs.js. */
export function GateIcon({ id, size = 21 }) {
  const Glyph = GLYPHS[id]
  return Glyph ? <Glyph width={size} height={size} /> : null
}
