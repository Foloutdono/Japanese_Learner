// ── 駅名標 — the station plate ─────────────────────────────
// The sign hanging over every platform in Japan, and probably the
// single most recognisable piece of information design the country
// has produced. Four things, always in the same order:
//
//     ┌──────────────────────────┐
//     │  KJ 03      かんじ        │   the reading, above
//     │            漢 字          │   the name
//     │            KANJI          │   and romaji, below
//     │ ← にほんご                │   where you came from
//     │ ═══════════════════════   │   the line's own colour
//     └──────────────────────────┘
//
// It's used twice: once on the home platform, where it says you are
// standing in 日本語駅, and again at the top of every selection
// screen, where it says which station you have just arrived at. That
// repetition is the point — the app stops being a set of screens and
// becomes a line you are travelling along.
export function StationSign({ station, name, color, prev, size = 'lg' }) {
  return (
    <div className={`station-sign station-sign--${size}`} style={{ '--line-color': color }}>
      <div className="station-sign__top">
        {station.code && (
          <span className="station-sign__roundel" aria-hidden="true">{station.code}</span>
        )}
        <span className="station-sign__kana" lang="ja">{station.kana}</span>
      </div>

      <div className="station-sign__name" lang="ja">{name}</div>
      <div className="station-sign__romaji">{station.romaji}</div>

      <div className="station-sign__neighbours">
        {prev ? (
          <span className="station-sign__prev" lang="ja">
            <span className="station-sign__arrow" aria-hidden="true">←</span>{prev}
          </span>
        ) : <span />}
      </div>

      <div className="station-sign__stripe" aria-hidden="true" />
    </div>
  )
}
