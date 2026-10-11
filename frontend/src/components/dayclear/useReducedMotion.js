import { useMediaQuery } from '../../hooks/useMediaQuery'

// The ceremony's reduced state (plan 191): the system's setting, or the
// workbench's ?reduced=1 handed down as `override`. The app has no motion
// setting of its own; the day it does, it is read here.
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(override) {
  const system = useMediaQuery(REDUCED_QUERY)
  return override ?? system
}
