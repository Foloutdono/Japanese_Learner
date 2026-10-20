import { useEffect } from 'react'
import { noteStep } from '../lib/clientErrors'

// ── 故障 — which step was on screen ─────────────────────────────
// A flow that measures itself step by step (the boarding, the first
// ride) names its step here too, so an uncaught error on its route says
// which step threw (lib/clientErrors.js). Cleared when the flow leaves.
export function useErrorStep(step) {
  useEffect(() => {
    noteStep(step)
    return () => noteStep(null)
  }, [step])
}
