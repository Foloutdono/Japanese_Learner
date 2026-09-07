// ── Frequency tiers ───────────────────────────────────────────
// Mirrors frequency_data.DEFAULT_TIER_SIZE on the backend — the size a
// tier list is fetched at before the learner touches the size toggle.
// Options are a fixed set (not free-form input) so every value stays a
// "clean" bucket size that reads naturally in a label like "1–500".
export const DEFAULT_TIER_SIZE = 200
export const TIER_SIZE_OPTIONS = [100, 200, 500, 1000]

// ── A tier's range, from its number and size ─────────────────
// The backend's tier list carries start_rank/end_rank per tier
// (routes/frequency.py); a run reached by its path has only the tier
// number and the size it was built at, and prints the same range from
// them. The last tier of an uneven total may end short of this figure
// on the backend's list — a header, not a count.
export function tierLabelFor(tier, size) {
  const start = (tier - 1) * size + 1
  return `${start}–${tier * size}`
}
