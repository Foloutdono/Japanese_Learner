import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useStats } from '../../stores/stats'
import { deckItems } from '../../domain/lineProgress'
import { RouteStops } from './RouteStops'

/**
 * LevelSelector — the JLPT line as a route (plan 071 redraws it on
 * the canvas's .route rows; see RouteStops.jsx).
 *
 * N5 at the near end, N1 at the far one; each stop with its plain
 * name, and how much of it is learned — the same figures the route
 * map's train position is computed from (/api/stats' `items`, through
 * the shared store), so the station and the map cannot disagree.
 *
 * Two figures, not one. `learned` is the 21-day mastery count and the
 * number the row is read for; on its own it left every stop of every
 * line reading 0 / 665 for a learner's first fortnight, because that
 * is how long the threshold takes. `started` — cards met at all — is
 * the one that answers today's work, so it rides under the figure as
 * its caption and RouteStops drops it once the two agree.
 *
 * The learner's own level (user_profiles.jlpt_level via /api/profile)
 * is the stop marked "You are here", and the stops behind it are
 * drawn as passed. A landmark, never a lock: every stop stays a plain
 * button, because an explicit choice beats the stored level by design
 * (docs/adr/0005).
 *
 * Props:
 *   onSelect(level)
 *   source — 'kanji' | 'vocab' | 'grammar': whose figures to print
 *   levels — array of level strings (default: N5…N1)
 */

const DEFAULT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function LevelSelector({ onSelect, source, levels = DEFAULT_LEVELS }) {
  const { t } = useLang()
  const stats = useStats().data
  const here = useProfileSummary()?.jlptLevel ?? null
  const HINTS = { N5: t.levelHintN5, N4: t.levelHintN4, N3: t.levelHintN3, N2: t.levelHintN2, N1: t.levelHintN1 }

  const stops = levels.map(level => {
    // A missing `source` is a level list with no figures to print
    // (deckItems answers zeros, and a stop with no total prints none).
    const { learned, total, started } = deckItems(stats, source, level)
    return {
      key: level,
      code: level,
      name: HINTS[level] ?? level,
      hereLabel: t.levelCurrentMark,
      learned,
      total,
      started,
      startedLabel: t.startedNote(started),
    }
  })

  return <RouteStops stops={stops} here={here} onSelect={onSelect} />
}
