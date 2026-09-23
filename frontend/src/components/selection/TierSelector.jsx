import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { Seg } from '../chrome/Console'
import { SplitRow } from './SplitRow'

// The default size and the size options live with the tier maths in
// domain/tiers.js (the practice pickers read them too, plan 072).
import { DEFAULT_TIER_SIZE, TIER_SIZE_OPTIONS } from '../../domain/tiers'

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
 *   selected — the tier whose platforms stand beside the list, in the
 *              desk's station split (plan 115): marked as the page,
 *              like RouteStops' own, and kept in view when the list
 *              is longer than the column. Only the desk passes it.
 *   linkTo(tier) — the tier's URL in that split (plan 117): the rows
 *              are then links (SplitRow) at the list's current size, and
 *              `onSelect` is not called. Only the desk passes it.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 */
export default function TierSelector({ domain, session, onSelect, color, tierSize: sizeProp, onTierSize, selected = null, linkTo = null }) {
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

  // The open tier in view: tier 30 of a 43-stop list sits below the
  // column's fold, and a list that opens scrolled away from the page
  // beside it reads as two unrelated screens.
  const openRow = useRef(null)
  useEffect(() => {
    openRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [tiers, selected])

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
          {visibleTiers.map(tr => {
            const open = selected != null && tr.tier === selected
            return (
              <SplitRow
                key={tr.tier}
                ref={open ? openRow : undefined}
                to={linkTo?.(tr.tier)}
                onClick={() => {
                  playUi('click-mode-selection')
                  if (!linkTo) onSelect(tr.tier, `${tr.start_rank}–${tr.end_rank}`, tierSize)
                }}
                className={open ? 'platform-card desk-stop--open' : 'platform-card'}
                aria-current={open ? 'page' : undefined}
                style={rowStyle}
              >
                <span className="platform-card__lead">
                  {/* The tier's own number, which is what its URL and
                      its run's head call it — not its place in the list,
                      which an emptied tier upstream would shift. */}
                  <span className="platform-card__no">{tr.tier}</span>
                </span>
                <span className="platform-card__body">
                  <span className="platform-card__title">{tr.start_rank}–{tr.end_rank}</span>
                  <span className="platform-card__desc">{tr.count} {unit}</span>
                </span>
                <span className="platform-card__go" aria-hidden="true">▶</span>
              </SplitRow>
            )
          })}
        </div>
      )}
    </div>
  )
}