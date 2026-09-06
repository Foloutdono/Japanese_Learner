import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { Seg } from '../chrome/Console'

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
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 */
export default function TierSelector({ domain, session, onSelect, color, tierSize: sizeProp, onTierSize }) {
  const { t } = useLang()
  // Controlled by the station when it carries the size in its URL;
  // local state otherwise.
  const [ownSize, setOwnSize] = useState(DEFAULT_TIER_SIZE)
  const tierSize = sizeProp ?? ownSize
  const setTierSize = size => { if (onTierSize) onTierSize(size); else setOwnSize(size) }
  const [tiers, setTiers] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset (clears the previous tier_size's list and error flag so the "loading" state shows immediately) that must happen synchronously with kicking off the fetch below; not a standalone id-keyed reset.
    setTiers(null)
    setFailed(false)
    apiFetch(`/api/frequency/${domain}/tiers?tier_size=${tierSize}`, session)
      .then(r => r.json())
      .then(data => { if (!cancelled) setTiers(data.tiers ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [domain, session, tierSize])

  const rowStyle = color ? { '--row-color': color } : undefined
  const unit = domain === 'vocab' ? t.wordNoun : (t.kanjiUnit ?? 'kanji')
  const visibleTiers = (tiers ?? []).filter(tr => tr.count > 0)

  return (
    <div className="tier-picker">
      {/* Tier size — the canvas's segmented control, full width. */}
      <div className="tier-picker__size">
        <span className="cap">{t.tierSizeLabel ?? 'Tier size'}</span>
        <Seg
          full
          label={t.tierSizeLabel ?? 'Tier size'}
          value={tierSize}
          onChange={size => { playUi('click-mode-selection'); setTierSize(size) }}
          options={TIER_SIZE_OPTIONS.map(size => ({ key: size, label: String(size) }))}
        />
      </div>

      {!tiers && !failed && (
        <Loading />
      )}
      {failed && (
        <Empty tone="error" message={t.loadError} />
      )}

      {tiers && (
        <div className="platform-grid">
          {visibleTiers.map((tr, i) => (
            <button
              key={tr.tier}
              type="button"
              onClick={() => {
                playUi('click-mode-selection')
                onSelect(tr.tier, `${tr.start_rank}–${tr.end_rank}`, tierSize)
              }}
              className="platform-card"
              style={rowStyle}
            >
              <span className="platform-card__lead">
                <span className="platform-card__no">{i + 1}</span>
              </span>
              <span className="platform-card__body">
                <span className="platform-card__title">{tr.start_rank}–{tr.end_rank}</span>
                <span className="platform-card__desc">{tr.count} {unit}</span>
              </span>
              <span className="platform-card__go" aria-hidden="true">▶</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}