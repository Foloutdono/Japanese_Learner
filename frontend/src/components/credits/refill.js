// ── 補充 — the moment's clock (plan 278) ─────────────────────
// How long the card is out on arrival, from the drop to its way back
// into its pocket, when the claim is taken (RefillMoment.jsx).
// index.css's --refill-ms says the same, and places every beat as a
// share of it: the drop to 15%, the count from 500ms for 800ms (22% to
// 57%, RefillCard.jsx), the way back from 83%. A test holds the two
// equal.
export const REFILL_MS = 2300
