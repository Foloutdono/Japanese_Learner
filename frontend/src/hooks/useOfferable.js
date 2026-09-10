import { useCredits } from '../stores/credits'
import { offerable } from '../domain/paywall'

// Whether the pass may be offered to this learner right now — the one
// answer to "is there anything to sell here?", so the five doors
// (domain/paywall.js's SOURCES) cannot disagree about it. Lives in its
// own file rather than beside OfferButton because a module that
// exports both a component and a hook breaks Fast Refresh.
export function useOfferable() {
  return offerable(useCredits())
}
