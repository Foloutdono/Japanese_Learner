import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES as TRACKED, lineMarks, lineStops, stopsTravelled } from '../../domain/lineProgress'

// ── 路線図 — the wall map ────────────────────────────────────
// The Learn gate's panel, on the board's own sumi material: the four
// SRS sections drawn as lines with stops (JLPT levels; the kana sets)
// and the learner's own train on each, and under them the shelf of
// decks as one row. The distance travelled is real arithmetic over
// /api/stats (domain/lineProgress); the due chips are /api/today's.
//
// The masthead the panel used to carry (the station's name, the
// clock) retired with the chrome (plan 071): the bar above the panel
// names the place now, and the practice and facility registers live
// behind their own gates.
//
// What a station on these lines MEANS is domain/lineProgress' rule and
// the pass's too: the leg behind it, finished. The line opens at 初,
// the novice's stop, because a learner who has begun N5 has left that
// stop and not yet reached N5's.

function Track({ stops, travelled }) {
  // ONE scale for the stations and the train, and a station stands at
  // the END of the leg it names: with n legs of work the rail is
  // divided into n, the novice's stop holds the origin and each level
  // holds the point at which it is finished, so the last station is
  // the end of the line rather than a mark one leg short of it.
  // `pos` and `x` are the same function of stops travelled — which is
  // what lets the train park dead on a platform the moment that
  // level's last card is learned, and never before.
  const marks = lineMarks(stops)
  const terminus = marks.length - 1
  const x = i => 5 + (i / stops.length) * 90
  const pos = Math.min(95, x(travelled))

  return (
    <span className="wmap-track" aria-hidden="true">
      <span className="wmap-track__rail" />
      <span className="wmap-track__done" style={{ width: `${pos}%` }} />
      {marks.map((mark, i) => (
        <span key={mark.key}>
          {/* One rule, one story: a station fills when the train has
              reached it, which — the station being the leg's
              completion — is the same sentence as "this level is
              done". The novice's stop at i = 0 is always filled: you
              are standing on it before you have done anything. */}
          <span
            className={`wmap-track__stop${i === terminus ? ' wmap-track__stop--end' : ''}${travelled >= i ? ' wmap-track__stop--past' : ''}`}
            style={{ left: `${x(i)}%` }}
          />
          <span className="wmap-track__label" style={{ left: `${x(i)}%` }} lang={mark.jp ? 'ja' : undefined}>
            {mark.label}
          </span>
        </span>
      ))}
      <span className="wmap-track__train" style={{ left: `${pos}%` }} />
    </span>
  )
}

function DueChip({ due, t }) {
  if (!due) return null
  return (
    <span className="wmap-due">
      {due}<span className="wmap-due__unit">{t.dueUnit}</span>
    </span>
  )
}

/**
 * `sections` — the tracked lines (config/tabs.js entries whose path is
 * in domain/lineProgress' TRACKED_LINES; anything else is ignored).
 * `decks` — the shelf's row: { section, count, cards, due }, or null
 * for no row. `stats` may be null or garbage — a failed fetch must
 * still draw the map, just with nobody on it yet.
 */
export function WallMap({ sections, stats, bySource, onDepart, decks = null }) {
  const { t } = useLang()
  const tracked = sections.filter(s => TRACKED[s.path])

  return (
    <div className="board">
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
                  <span className="wmap-line__jp">{section.title}</span>
                </span>
              </span>
              <span className="wmap-line__due"><DueChip due={due} t={t} /></span>
              <Track stops={stops} travelled={stopsTravelled(stops)} />
            </button>
          )
        })}
      </div>

      {decks && (
        <div className="wmap__group">
          <button
            type="button"
            className="wmap-row"
            style={{ '--line-color': decks.section.color }}
            onClick={() => onDepart(decks.section)}
          >
            <span className="wmap-roundel" aria-hidden="true">{stationFor(decks.section.path).code}</span>
            <span className="wmap-row__names">
              <span className="wmap-row__jp">{decks.section.title}</span>
              {decks.count > 0 && (
                <span className="wmap-row__latin">{t.decksRowMeta(decks.count, decks.cards)}</span>
              )}
            </span>
            <span className="wmap-row__note"><DueChip due={decks.due} t={t} /></span>
            <span className="wmap-row__go" aria-hidden="true">▶</span>
          </button>
        </div>
      )}
    </div>
  )
}
