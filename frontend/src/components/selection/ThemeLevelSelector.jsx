import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { THEME_LEVELS, THEME_LEVEL_JP, themeLevelLabel } from '../../domain/themes'
import { RouteStops } from './RouteStops'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'

/**
 * ThemeLevelSelector — a theme's four bands as a route.
 *
 * A theme's words are sorted commonest-first and cut into 基本 · 中級 ·
 * 上級 · 達人 (see backend/content/theme_data.py). That is an ordered
 * line you travel from one end of, which is exactly what RouteStops
 * draws for the JLPT levels and the kana sets — so it is the same
 * component here, not a fifth thing that looks like it.
 *
 * A sibling of LevelSelector rather than a mode of it: LevelSelector is
 * bound to /api/stats' items[source][level] and to the learner's stored
 * JLPT level, and a theme band has neither.
 *
 * Two deliberate divergences from LevelSelector, both for the same
 * reason — printing a figure nobody can act on is worse than printing
 * none:
 *   - no `learned`/`total`. Theme progress is per-MODE, and the mode is
 *     not chosen until the next screen; /api/stats does not carry themes
 *     at all. RouteStops prints `learned ?? 0`, so passing them would
 *     stamp "0 / 24" on every band forever. The word count goes in the
 *     hint instead, where it is a real answer to "how big is this".
 *   - `here` stays null. There is no stored "your band", so nothing is
 *     marked "You are here" and no band is drawn as passed.
 *
 * Props:
 *   session, theme, onSelect(levelKey)
 */
export default function ThemeLevelSelector({ session, theme, onSelect }) {
  const { t } = useLang()
  const [counts, setCounts] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/themes', session)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const row = (data.themes ?? []).find(th => th.key === theme)
        if (!row) { setFailed(true); return }
        setCounts(Object.fromEntries((row.levels ?? []).map(l => [l.level, l.count])))
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [session, theme])

  if (failed) return <Empty tone="error" message={t.loadError} />
  if (!counts) return <Loading />

  const stops = THEME_LEVELS.map(key => ({
    key,
    code: THEME_LEVEL_JP[key],
    codeLang: 'ja',
    name: themeLevelLabel(t, key),
    hint: `${counts[key] ?? 0} ${t.wordNoun}`,
  }))

  return <RouteStops stops={stops} onSelect={onSelect} />
}
