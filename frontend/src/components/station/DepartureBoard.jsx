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

export function DepartureBoard({ sections, onDepart }) {
  const { t } = useLang()
  const now = useStationClock()

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div className="board">
      <div className="board__head">
        <span className="board__label" lang="ja">発車標</span>
        <span className="board__label-sub">{t.departures}</span>
        <span className="board-clock__label" lang="ja" aria-hidden="true">現在時刻</span>
        <span className="board-clock" aria-label={`${hh}:${mm}`}>
          {hh}<span className="board-clock__colon" aria-hidden="true">:</span>{mm}
        </span>
      </div>

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

      {/* 点字ブロック — the tactile paving that runs the length of
          every platform in Japan, and the line you are told to stand
          behind. Here it closes the board off the way it closes the
          platform: everything above is where the trains are. */}
      <div className="tactile" aria-hidden="true" />
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
