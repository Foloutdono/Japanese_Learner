// ── 駅名標 — the station plate ─────────────────────────────
// The sign hanging over every platform in Japan, and probably the
// single most recognisable piece of information design the country
// has produced. It heads every selection screen, naming the station
// you have just arrived at from the departure board on the home
// platform. That repetition is the point — the app stops being a set
// of screens and becomes a line you are travelling along.
//
//     ┌──────────────────────────────────┐
//     │        かんじ            のりば   │
//     │  KJ    漢 字                      │
//     │        KANJI              08:14   │
//     │ ════════════════════════════════  │
//     └──────────────────────────────────┘
//
// The structure is the departure board's masthead, element for
// element, because it is the same masthead: the line code in its
// roundel, then the three registers a 駅名標 always carries — the
// reading above, the name, the plain-language name below — and the
// panel's own label and clock down the right. It used to stack the
// roundel inline with the kana and run everything hard left, which
// meant the one object the app repeats on twelve screens was drawn
// two different ways depending on which screen you were standing on.
//
// `latin` is deliberately not a transliteration of the Japanese name
// (romaji "KAISEKI" for 解析 tells a non-reader nothing) — callers
// pass the section's own plain-language title, the exact same string
// the departure board already prints under that section's kanji, so
// the plate and the board never describe one destination two ways.
//
// `aside` is the right-hand half. Without a counterweight the plate
// was a 90px object anchored to the left edge of a 1040px panel with
// the rest of the width simply unused. See SelectionScreen for what
// goes in it.
//
// The `__name` line is rendered as an `<h1>`: the plate *is* how this
// app names the screen you are currently on, so it is the screen's
// own heading, not decoration. The kana reading and the romaji beside
// it are alternate renderings of that same name, not separate
// headings, so they stay plain spans.
export function StationSign({ station, name, latin, color, aside, size = 'lg' }) {
  return (
    <div className={`station-sign station-sign--${size}`} style={{ '--line-color': color }}>
      <div className="station-sign__head">
        <div className="station-sign__names">
          {station.code && (
            <span className="station-sign__roundel" aria-hidden="true">{station.code}</span>
          )}
          <span className="station-sign__stack">
            <span className="station-sign__kana" lang="ja">{station.kana}</span>
            <h1 className="station-sign__name" lang="ja">{name}</h1>
            {latin && <span className="station-sign__romaji">{latin}</span>}
          </span>
        </div>

        {aside && <div className="station-sign__aside">{aside}</div>}
      </div>

      <div className="station-sign__stripe" aria-hidden="true" />
    </div>
  )
}
