import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { Console, ConsoleIndex } from '../chrome/Console'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { themeLabelFor } from '../../domain/themes'

/**
 * ThemeSelector
 * Third study-source axis alongside LevelSelector (JLPT) and
 * TierSelector (frequency) — same single-column, hairline-divided row
 * treatment, but the rows come from GET /api/themes instead of a
 * fixed N5…N1 list or a size-dependent /tiers fetch, so — like
 * TierSelector — they're fetched once on mount rather than passed in
 * as a prop.
 *
 * /api/themes returns [{key, count}, ...] with no display label
 * attached (themes are backend data — see theme_data.list_themes'
 * docstring — not UI copy), so labels are resolved here the same way
 * LevelSelector resolves LEVEL_HINTS: `key` "body_parts" maps to
 * `t.themeBodyParts`. A theme that hasn't had its translation string
 * added yet still renders — via _fallbackLabel — instead of a blank
 * row, which matters right after a new theme is added to
 * build_theme_db.py and before every language file has caught up.
 *
 * Unlike Level/Tier, the list here is long enough (dozens of themes)
 * that a flat scroll isn't quite enough on its own, so there's a
 * lightweight client-side filter above the list — filtering, not a
 * server request, since the whole list is already in hand after the
 * one fetch and themes don't have TierSelector's per-size refetch
 * problem to begin with.
 *
 * Props:
 *   session  — forwarded to apiFetch, same as every other
 *              data-fetching component in this app.
 *   onSelect(themeKey, label) — called with the theme's key (what
 *              /api/vocab/theme/{theme}/... expects) and its resolved
 *              display label, for the caller to hold onto as a header
 *              the same way TierSelector hands back a range label.
 *   color    — optional accent colour override, same convention as
 *              LevelSelector/TierSelector/ModeSelector.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 */
export default function ThemeSelector({ session, onSelect, color }) {
  const { t } = useLang()
  const [themes, setThemes] = useState(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/themes', session)
      .then(r => r.json())
      .then(data => { if (!cancelled) setThemes(data.themes ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [session])

  // Labels resolved once per themes fetch (not per render/per
  // keystroke) — the list itself never changes after mount, only
  // which rows are visible does.
  const labeled = useMemo(
    () => (themes ?? []).map(th => ({ ...th, label: themeLabelFor(t, th.key) })),
    [themes, t],
  )

  const visibleThemes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return labeled
    return labeled.filter(th => th.label.toLowerCase().includes(q))
  }, [labeled, query])

  const rowStyle = color ? { '--row-color': color } : undefined

  return (
    <div className="theme-picker">
      {themes && themes.length > 8 && (
        <Console>
          <ConsoleIndex
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder={t.filterThemes ?? 'Filter…'}
            aria-label={t.filterThemes ?? 'Filter themes'}
            clearLabel={t.cancel}
            count={`${visibleThemes.length} / ${labeled.length}`}
          />
        </Console>
      )}

      {!themes && !failed && (
        <Loading />
      )}
      {failed && (
        <Empty tone="error" message={t.loadError} />
      )}
      {themes && visibleThemes.length === 0 && (
        <Empty message={t.themeNoResults ?? 'No matches'} />
      )}

      {themes && visibleThemes.length > 0 && (
        <div className="platform-grid">
          {visibleThemes.map((th, i) => (
            <button
              key={th.key}
              type="button"
              onClick={() => { playUi('click-mode-selection'); onSelect(th.key, th.label) }}
              className="platform-card"
              style={rowStyle}
            >
              <span className="platform-card__lead">
                <span className="platform-card__no">{i + 1}</span>
              </span>
              <span className="platform-card__body">
                <span className="platform-card__title">{th.label}</span>
                <span className="platform-card__desc">{th.count} {t.wordNoun}</span>
              </span>
              <span className="platform-card__go" aria-hidden="true">▶</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}