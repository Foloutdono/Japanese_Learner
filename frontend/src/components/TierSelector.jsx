import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { playUi } from './sound'

/**
 * TierSelector
 * Frequency-tier counterpart to LevelSelector — same single-column,
 * hairline-divided row treatment, but the rows come from
 * GET /api/frequency/{domain}/tiers instead of a fixed N5…N1 list, so
 * they're fetched once on mount rather than passed in as a prop.
 *
 * Tiers with count === 0 are dropped (can happen for the last tier of
 * an uneven total, or — in principle — an emptied-out tier after a
 * lot of overrides move things around).
 *
 * Props:
 *   domain   — "kanji" | "vocab", passed straight through to the API
 *              path and used to pick the unit word in each row's desc.
 *   session  — forwarded to apiFetch, same as every other data-fetching
 *              component in this app.
 *   onSelect(tier, label) — called with the numeric tier and a display
 *              label ("1–200") the caller can hold onto for headers,
 *              since the tier list isn't kept around after selection.
 *   color    — optional accent colour override, same convention as
 *              LevelSelector/ModeSelector.
 *   title    — header copy. Defaults to t.selectTier; pass title=""
 *              to hide it (e.g. when wrapped in <SelectionScreen>).
 */
export default function TierSelector({ domain, session, onSelect, color, title }) {
  const { t } = useLang()
  const [tiers, setTiers] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTiers(null)
    setFailed(false)
    apiFetch(`/api/frequency/${domain}/tiers`, session)
      .then(r => r.json())
      .then(data => { if (!cancelled) setTiers(data.tiers ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [domain, session])

  const resolvedTitle = title === '' ? '' : (title ?? t.selectTier)
  const rowStyle = color ? { '--row-color': color } : undefined
  const unit = domain === 'vocab' ? t.wordNoun : (t.kanjiUnit ?? 'kanji')
  const visibleTiers = (tiers ?? []).filter(tr => tr.count > 0)

  return (
    <div className="level-selector">
      {resolvedTitle && (
        <div className="selector-header">
          <div className="selector-header__title">{resolvedTitle}</div>
        </div>
      )}

      {!tiers && !failed && (
        <div className="selector-header__subtitle">{t.loading}</div>
      )}
      {failed && (
        <div className="selector-header__subtitle">{t.loadError}</div>
      )}

      {tiers && (
        <div className="choice-list">
          {visibleTiers.map((tr, i) => (
            <button
              key={tr.tier}
              type="button"
              onClick={() => {
                playUi('click-mode-selection')
                onSelect(tr.tier, `${tr.start_rank}–${tr.end_rank}`)
              }}
              className="choice-row"
              style={rowStyle}
            >
              <span className="choice-row__accent" aria-hidden="true" />
              <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
              <span className="choice-row__main">
                <span className="choice-row__title">{tr.start_rank}–{tr.end_rank}</span>
                <span className="choice-row__desc">{tr.count} {unit}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
