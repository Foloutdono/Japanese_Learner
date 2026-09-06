// ── Frequency tiers — a tier's range, from its number and size ───
// The backend's tier list carries start_rank/end_rank per tier
// (routes/frequency.py); a run reached by its path has only the tier
// number and the size it was built at, and prints the same range from
// them. The last tier of an uneven total may end short of this figure
// on the backend's list — a header, not a count.
export function tierLabelFor(tier, size) {
  const start = (tier - 1) * size + 1
  return `${start}–${tier * size}`
}
