// ── 駅名標 — the station plate ─────────────────────────────
// The sign hanging over every platform in Japan, and probably the
// single most recognisable piece of information design the country
// has produced. Three things, always in the same order:
//
//     ┌──────────────────────────┐
//     │  KJ 03      かんじ        │   the reading, above
//     │            漢 字          │   the name
//     │            KANJI          │   and its plain-language name below
//     │ ═══════════════════════   │   the line's own colour
//     └──────────────────────────┘
//
// It's used twice: once on the home platform, where it says you are
// standing in 日本語駅, and again at the top of every selection
// screen, where it says which station you have just arrived at. That
// repetition is the point — the app stops being a set of screens and
// becomes a line you are travelling along.
//
// `latin` is deliberately not a transliteration of the Japanese name
// (romaji "KAISEKI" for 解析 tells a non-reader nothing) — callers
// pass the section's own plain-language title, the exact same string
// the departure board already prints under that section's kanji, so
// the plate and the board never describe one destination two ways.
export function StationSign({ station, name, latin, color, size = 'lg' }) {
  return (
    <div className={`station-sign station-sign--${size}`} style={{ '--line-color': color }}>
      <div className="station-sign__top">
        {station.code && (
          <span className="station-sign__roundel" aria-hidden="true">{station.code}</span>
        )}
        <span className="station-sign__kana" lang="ja">{station.kana}</span>
      </div>

      <div className="station-sign__name" lang="ja">{name}</div>
      {latin && <div className="station-sign__romaji">{latin}</div>}

      <div className="station-sign__stripe" aria-hidden="true" />
    </div>
  )
}
