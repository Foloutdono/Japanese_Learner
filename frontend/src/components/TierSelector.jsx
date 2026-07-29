import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { playUi } from './sound'

// Mirrors frequency_data.DEFAULT_TIER_SIZE on the backend — used as
// the initial fetch before the user touches the size toggle, and as
// the fallback if a later /tiers fetch fails. Options are a fixed set
// (not free-form input) so every value stays a "clean" bucket size
// that reads naturally in a label like "1–500".
const DEFAULT_TIER_SIZE = 200
const TIER_SIZE_OPTIONS = [100, 200, 500, 1000]

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
 * The tier *size* (how many items per tier — "Top 200" vs "Top 500")
 * is user-adjustable via a small toggle above the list, re-fetching
 * /tiers with the chosen size. It's local state here, not a prop:
 * nothing outside this component needs it until a tier is actually
 * picked, at which point it's handed to the caller as the third
 * onSelect argument (see below) so downstream card/stats requests can
 * use the same size the displayed ranges were built from — the same
 * tier *number* means a different rank range at a different size.
 *
 * Props:
 *   domain   — "kanji" | "vocab", passed straight through to the API
 *              path and used to pick the unit word in each row's desc.
 *   session  — forwarded to apiFetch, same as every other data-fetching
 *              component in this app.
 *   onSelect(tier, label, tierSize) — called with the numeric tier, a
 *              display label ("1–200") the caller can hold onto for
 *              headers, and the tier_size the list was fetched at —
 *              the caller must thread this through to any later
 *              /api/frequency/.../card|cards|stats call for that tier,
 *              since the tier list itself isn't kept around after
 *              selection.
 *   color    — optional accent colour override, same convention as
 *              LevelSelector/ModeSelector.
 *   title    — header copy. Defaults to t.selectTier; pass title=""
 *              to hide it (e.g. when wrapped in <SelectionScreen>).
 */
export default function TierSelector({ domain, session, onSelect, color, title }) {
  const { t } = useLang()
  const [tierSize, setTierSize] = useState(DEFAULT_TIER_SIZE)
  const [tiers, setTiers] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTiers(null)
    setFailed(false)
    apiFetch(`/api/frequency/${domain}/tiers?tier_size=${tierSize}`, session)
      .then(r => r.json())
      .then(data => { if (!cancelled) setTiers(data.tiers ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [domain, session, tierSize])

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

      <div className="tier-size-toggle" role="group" aria-label={t.tierSizeLabel ?? 'Tier size'}>
        {TIER_SIZE_OPTIONS.map(size => (
          <button
            key={size}
            type="button"
            onClick={() => { if (size !== tierSize) { playUi('click-mode-selection'); setTierSize(size) } }}
            className={`tier-size-toggle__btn ${size === tierSize ? 'tier-size-toggle__btn--active' : ''}`}
            style={size === tierSize ? rowStyle : undefined}
            aria-pressed={size === tierSize}
          >
            {size}
          </button>
        ))}
      </div>

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
                onSelect(tr.tier, `${tr.start_rank}–${tr.end_rank}`, tierSize)
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