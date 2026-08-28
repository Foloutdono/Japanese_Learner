import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { useProfileSummary } from '../../stores/profileSummary'
import { useReportPlatformCount } from './platformCount'

/**
 * LevelSelector — 路線図
 *
 * The JLPT levels are a line, and this draws them as one: the
 * stopping pattern diagram that hangs inside every train car in
 * Japan. A single coloured rail runs down the left with a station
 * marker at each stop, N5 at the near end and N1 at the far one, and
 * you tap the station you want to get off at.
 *
 * It is a route map rather than a list of five rows because that is
 * genuinely what these are — an ordered line you travel from one end
 * of, where the distance between the first stop and the last is the
 * whole point. A list says "pick one of five". A line says "this is
 * how far it goes".
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead
 * (and, on the rare path with no plate, carries its own heading).
 * A "Choose your JLPT level" caption on top of that was two things
 * saying the same thing, one of them in a diagram plain enough not to
 * need a caption at all.
 *
 * Props:
 *   onSelect(level)  — called when a station is chosen
 *   color            — the line's colour, as a hex string or CSS var().
 *     No caller passes it: <SelectionScreen> sets --line-color from
 *     the section's own colour in config/navLinks.js, and inheriting
 *     that is the whole point of one line having one colour. The six
 *     screens here used to hardcode it, and four of the six disagreed
 *     with the plate hanging directly above them — /vocab drew an
 *     amber rail under a blue 単語 plate. Kept as the escape hatch for
 *     a caller with no station of its own; CSS falls back to shu-iro.
 *   levels           — array of level strings (default: N5…N1)
 */

const DEFAULT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function LevelSelector({
  onSelect,
  color,
  levels = DEFAULT_LEVELS,
}) {
  const { t } = useLang()
  const LEVEL_HINTS = {
    N5: t.levelHintN5,
    N4: t.levelHintN4,
    N3: t.levelHintN3,
    N2: t.levelHintN2,
    N1: t.levelHintN1,
  }
  const lineStyle = color ? { '--line-color': color } : undefined
  useReportPlatformCount(levels.length)

  // 現在地 — the learner's own stored JLPT level, from onboarding
  // (user_profiles.jlpt_level via /api/profile). Read here rather
  // than passed in so all six screens that render this diagram get
  // the mark with zero caller changes. Null (no level stored yet, or
  // the summary's silent fetch failed) renders exactly as before.
  // The mark is a landmark, never a lock: every stop stays a plain
  // button, because an explicit choice beats the stored level by
  // design (docs/adr/0005).
  const currentLevel = useProfileSummary()?.jlptLevel ?? null

  return (
    <div className="route" style={lineStyle}>
      {levels.map((level, i) => (
        <button
          key={level}
          type="button"
          onClick={() => { playUi('click-mode-selection'); onSelect(level) }}
          className={[
            'route-stop',
            i === 0 ? 'route-stop--first' : '',
            i === levels.length - 1 ? 'route-stop--last' : '',
            level === currentLevel ? 'route-stop--current' : '',
          ].filter(Boolean).join(' ')}
        >
          {/* The rail, drawn per stop so the first and last ends can
              be capped — a line diagram that runs off the top of the
              first station reads as "there is more up there". */}
          <span className="route-stop__rail" aria-hidden="true" />
          <span className="route-stop__marker" aria-hidden="true" />

          {/* A card on the rail, so a level reads as the same object
              as every other choice in the app — but kept in one
              column, because these are a line and not a grid. The
              hint sits under the name rather than across from it: set
              across, it was a caption at one end of a 600px row and
              its level at the other.

              No sequence number: the line is the sequence. A list
              needs "01…05" to say these are ordered; a diagram that
              draws the order can't gain anything by numbering it. */}
          <span className="route-stop__body">
            <span className="route-stop__name">{level}</span>
            <span className="route-stop__hint">{LEVEL_HINTS[level]}</span>
            {level === currentLevel && (
              <span className="route-stop__here">{t.levelCurrentMark}</span>
            )}
          </span>

          <span className="route-stop__go" aria-hidden="true">▶</span>
        </button>
      ))}
    </div>
  )
}
