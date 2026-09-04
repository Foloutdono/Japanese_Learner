import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { useStationClock } from './useStationClock'
import { TRACKED_LINES as TRACKED, lineStops, stopsTravelled } from '../../domain/lineProgress'

// ── 路線図 — the wall map ────────────────────────────────────
// The station's main panel, in the departure board's place and on the
// board's own sumi material. A board answers "what leaves next"; the
// map answers the question a learner actually stands in front of it
// with — "how far have I come, and where does each line go" — which a
// row of equal destinations never could.
//
// Three registers, by what the app really knows about each place:
//
//   路線  the four SRS sections, drawn as lines with stops (JLPT
//         levels; the kana sets) and the learner's own train on each.
//         The distance travelled is real arithmetic over /api/stats
//         (see domain/lineProgress); the due chips are /api/today's.
//   実践  the sentence-practice sections. They schedule words, not
//         levels, so they get no track — pretending a progress axis
//         the backend does not keep would be decoration.
//   施設  the halls you use rather than ride: chips, labelled in the
//         learner's own language because a tool's name is a label,
//         not a place name (the roundel still carries the code).
//
// The masthead stays the station's: the home screen's one <h1> is
// 日本語駅, exactly as the board's was — only the panel's label
// changed, 発車標 to 路線図.

// Which map register each home section renders in, by path. The
// tracked four come from domain/lineProgress (the profile's ride
// ledger reads the same list); a new section added to navLinks lands
// in `practice` by default (a row is never wrong, just unranked).
const FACILITIES = new Set(['/dictionary', '/decks', '/exam'])

function Track({ stops, travelled }) {
  // ONE scale for the stops and the train: a stop marks where its leg
  // BEGINS, so with n legs of work the rail is divided into n, the
  // last stop sits one leg short of the end, and the rail past it is
  // that last leg. `pos` and `x` are then the same function, which is
  // the whole point — the stops used to be spaced over n-1 while the
  // train ran over n, so the two only agreed at the ends. Finish three
  // of five levels and the train sat at 59% while the dot it had just
  // filled was at 72.5%: the marker lagged the stations it had passed,
  // by up to 13 points in the middle of the line.
  const x = i => 5 + (i / stops.length) * 90
  const pos = Math.min(95, x(travelled))

  return (
    <span className="wmap-track" aria-hidden="true">
      <span className="wmap-track__rail" />
      <span className="wmap-track__done" style={{ width: `${pos}%` }} />
      {stops.map((stop, i) => (
        <span key={stop.key}>
          {/* Filled when the TRAIN has passed it, not when the stop
              itself is half done — one rule, one story. The two used to
              disagree openly: a level 50% done filled its dot while the
              train was still short of it. */}
          <span
            className={`wmap-track__stop${travelled >= i + 1 ? ' wmap-track__stop--past' : ''}`}
            style={{ left: `${x(i)}%` }}
          />
          <span className="wmap-track__label" style={{ left: `${x(i)}%` }} lang={stop.key.startsWith('N') ? undefined : 'ja'}>
            {stop.label}
          </span>
        </span>
      ))}
      {/* 終点 — the end of the line, and the only mark that is not a
          level: the stops now sit one leg apart with the last leg's
          rail running past the final one, so without a terminus the
          track just frays. Kanji rather than a translated word, the
          same register as the app's other one-glyph marks (試/習/極),
          and the one label that is the same in both locales. */}
      <span
        className={`wmap-track__stop wmap-track__stop--end${travelled >= stops.length ? ' wmap-track__stop--past' : ''}`}
        style={{ left: `${x(stops.length)}%` }}
      />
      <span className="wmap-track__label wmap-track__label--end" style={{ left: `${x(stops.length)}%` }} lang="ja">完</span>
      <span className="wmap-track__train" style={{ left: `${pos}%` }} />
    </span>
  )
}

function DueChip({ due }) {
  if (!due) return null
  return (
    <span className="wmap-due">
      {due}<span className="wmap-due__unit" lang="ja">件</span>
    </span>
  )
}

export function WallMap({ sections, station, name, stats, bySource, onDepart }) {
  const { t } = useLang()
  const now = useStationClock()

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  const tracked = sections.filter(s => TRACKED[s.path])
  const practice = sections.filter(s => !TRACKED[s.path] && !FACILITIES.has(s.path))
  const facilities = sections.filter(s => FACILITIES.has(s.path))

  return (
    <div className="board">
      <div className="board__masthead">
        <span className="board__station">
          {station.code && (
            <span className="board__roundel" aria-hidden="true">{station.code}</span>
          )}
          <span className="board__station-names">
            <span className="board__kana" lang="ja">{station.kana}</span>
            {/* The home screen's own <h1> — the masthead is how the
                app names the screen you're standing on. */}
            <h1 className="board__name" lang="ja">{name}</h1>
            <span className="board__romaji">{station.latin}</span>
          </span>
        </span>

        <span className="board__now">
          <span className="board__label">
            <span lang="ja">路線図</span>
            <span className="board__label-sub">{t.routeMap}</span>
          </span>
          <span className="board-clock" aria-label={`${hh}:${mm}`}>
            {hh}<span className="board-clock__colon" aria-hidden="true">:</span>{mm}
          </span>
        </span>
      </div>

      <div className="board__stripe" aria-hidden="true" />

      <div className="wmap__lines">
        {tracked.map(section => {
          const code = stationFor(section.path).code
          const source = TRACKED[section.path]
          const stops = lineStops(stats, source)
          const due = bySource?.[source] ?? 0
          return (
            <button
              type="button"
              key={section.path}
              className="wmap-line"
              style={{ '--line-color': section.color }}
              onClick={() => onDepart(section)}
            >
              <span className="wmap-line__id">
                <span className="wmap-roundel" aria-hidden="true">{code}</span>
                <span className="wmap-line__names">
                  <span className="wmap-line__jp" lang="ja">{section.icon}<span className="wmap-line__sen" lang="ja">線</span></span>
                  <span className="wmap-line__latin">{section.title}</span>
                </span>
              </span>
              <Track stops={stops} travelled={stopsTravelled(stops)} />
              <span className="wmap-line__due"><DueChip due={due} /></span>
            </button>
          )
        })}
      </div>

      <div className="wmap__group">
        <div className="wmap__caption">
          <span className="wmap__caption-jp" lang="ja">実践</span>
          <span className="wmap__caption-latin">{t.mapPractice}</span>
        </div>
        {practice.map(section => {
          const code = stationFor(section.path).code
          const remark = (section.desc ?? '').split('\n')[0]
          return (
            <button
              type="button"
              key={section.path}
              className="wmap-row"
              style={{ '--line-color': section.color }}
              onClick={() => onDepart(section)}
            >
              <span className="wmap-roundel" aria-hidden="true">{code}</span>
              <span className="wmap-row__names">
                <span className="wmap-row__jp" lang="ja">{section.icon}<span className="wmap-line__sen" lang="ja">行</span></span>
                <span className="wmap-row__latin">{section.title}</span>
              </span>
              <span className="wmap-row__note">{remark}</span>
              <span className="wmap-row__go" aria-hidden="true">▶</span>
            </button>
          )
        })}
      </div>

      <div className="wmap__facilities">
        <div className="wmap__caption">
          <span className="wmap__caption-jp" lang="ja">施設</span>
          <span className="wmap__caption-latin">{t.mapFacilities}</span>
        </div>
        {facilities.map(section => {
          const code = stationFor(section.path).code
          // Personal decks are the one facility with a review queue of
          // its own, so its chip carries the waiting count.
          const due = section.path === '/decks' ? (bySource?.personal ?? 0) : 0
          return (
            <button
              type="button"
              key={section.path}
              className="fac-chip"
              style={{ '--line-color': section.color }}
              onClick={() => onDepart(section)}
            >
              <span className="wmap-roundel wmap-roundel--sm" aria-hidden="true">{code}</span>
              <span className="fac-chip__title">{section.title}</span>
              <DueChip due={due} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
