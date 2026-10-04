// ── 定期券 — the learner's card, by its plan (plan 173) ──────────
// One card in three materials, the owner's picks of the canvas "Tsuji —
// the three offers" (its pages "The free card" and "The cards in the
// app"): Free 白, plain white plastic with the vocab line's band; Pro 墨,
// soft-touch charcoal; Max 梨地, satin platinum. Which one a learner
// carries is their plan's.
//
// The server knows two plans today (core/credits.py): `free`, and
// `pass`, the paid one, unlimited, with Max's deck and card figures
// (domain/paywall.js). So `pass` is drawn as Max; `pro` and `max` are
// read as themselves the day the store splits the paid plan in two.
export const CARD_TIERS = Object.freeze(['free', 'pro', 'max'])

/** The card a learner carries, from the credits summary's plan. */
export function cardTier(credits) {
  const plan = credits?.plan
  if (plan === 'pro') return 'pro'
  if (plan === 'max' || plan === 'pass' || credits?.unlimited) return 'max'
  return 'free'
}

/**
 * The climb to the next level, as the card measures it: XP into the
 * level, the level's span, and the share climbed (0..1) -- the share is
 * what fills the struck 辻's road on the face.
 */
export function xpClimb(summary) {
  if (!summary) return { into: 0, span: 1, share: 0 }
  const span = Math.max(1, (summary.xpForNext ?? 0) - (summary.xpPrevLevel ?? 0))
  const into = Math.min(span, Math.max(0, (summary.xp ?? 0) - (summary.xpPrevLevel ?? 0)))
  return { into, span, share: into / span }
}

/**
 * The journey's drift in words, for the back's meter: days ahead or
 * days late, or nothing when the journey is on time or has no figure.
 */
export function driftWords(t, panel) {
  if (!panel?.days) return null
  return panel.status === 'ahead' ? t.cardDriftAhead(panel.days) : t.cardDriftLate(panel.days)
}

/**
 * The month the card was issued, in the learner's language: the
 * boarding's date (/api/profile's onboardedAt). An account that never
 * boarded prints nothing rather than a guess.
 */
export function sinceMonth(iso, lang) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(d)
}
