import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { useStationClock } from './useStationClock'

// ── 発車標 — the departure board ───────────────────────────
// Every section of the app, as a service leaving this platform. The
// board keeps a real board's manners: the amber-on-black panel, the
// coloured station-numbering roundel, the row you're pointing at
// lighting up.
//
// It is deliberately a *board*, not a grid of cards: a board is a
// ranked list you scan top to bottom for the one you want, which is
// what a home screen is for, and it holds eleven destinations without
// becoming the wall of tiles this screen used to be.
//
// ── Why the station name is up here ──
// It used to hang on its own plate above the board, a 420px sign
// floating over a 1040px panel with a gap between them. Two objects
// of different widths, neither explaining the other, and the plate
// read as pasted on — which it was.
//
// A platform is one place, so this is one object. The station's
// identity is the board's masthead and the line stripe under it is
// the same stripe the plate carries; everything below is where the
// trains are. The selection screens keep the standalone plate, where
// it is the whole content of the header and has nothing to compete
// with.
//
// The 点字ブロック that used to close the bottom is gone. It was the
// literal answer — every platform in Japan has that yellow dotted
// strip along its edge — and it was the wrong one: a full-width band
// of the loudest colour in the palette, closing a panel that its own
// border and radius already closed, and turning muddy brown in light
// theme. Authenticity is not a defence for the busiest object on the
// screen sitting at the bottom of it.

export function DepartureBoard({ sections, station, name, onDepart }) {
  const { t } = useLang()
  const now = useStationClock()

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div className="board">
      <div className="board__masthead">
        <span className="board__station">
          {station.code && (
            <span className="board__roundel" aria-hidden="true">{station.code}</span>
          )}
          <span className="board__station-names">
            <span className="board__kana" lang="ja">{station.kana}</span>
            <span className="board__name" lang="ja">{name}</span>
            <span className="board__romaji">{station.latin}</span>
          </span>
        </span>

        <span className="board__now">
          <span className="board__label">
            <span lang="ja">発車標</span>
            <span className="board__label-sub">{t.departures}</span>
          </span>
          <span className="board-clock" aria-label={`${hh}:${mm}`}>
            {hh}<span className="board-clock__colon" aria-hidden="true">:</span>{mm}
          </span>
        </span>
      </div>

      <div className="board__stripe" aria-hidden="true" />

      <div className="board__rows">
        {sections.map((section, i) => (
          <BoardRow
            key={section.path}
            section={section}
            platform={i + 1}
            onDepart={() => onDepart(section)}
          />
        ))}
      </div>
    </div>
  )
}

function BoardRow({ section, platform, onDepart }) {
  const station = stationFor(section.path)
  // The descriptions are three short lines each (see navLinks.js); a
  // remarks column takes the first, which is always the one that says
  // what the service actually is.
  const remark = (section.desc ?? '').split('\n')[0]

  return (
    <button
      type="button"
      className="board-row"
      style={{ '--line-color': section.color }}
      onClick={onDepart}
    >
      <span className="board-row__platform">
        <span className="board-row__no">{platform}</span>
        <span className="board-row__no-unit" lang="ja">番線</span>
      </span>

      <span className="board-row__dest">
        <span className="board-row__roundel" aria-hidden="true">{station.code}</span>
        <span className="board-row__names">
          <span className="board-row__jp" lang="ja">
            {section.icon}<span className="board-row__bound" lang="ja">行</span>
          </span>
          <span className="board-row__latin">{section.title}</span>
        </span>
      </span>

      <span className="board-row__note">{remark}</span>

      <span className="board-row__go" aria-hidden="true">▶</span>
    </button>
  )
}
