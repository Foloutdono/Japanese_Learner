import { createContext, useContext, useEffect } from 'react'

// ── How many platforms ─────────────────────────────────────
// The station plate wants to say how many choices are below it —
// のりば 4 — and the shell that draws the plate has no idea, because
// all it holds is `children`. This is the smallest honest way across.
//
// Not a DOM count: ThemeSelector and TierSelector fill in after a
// fetch, and TierSelector's list changes again every time the size
// toggle moves, so anything measured once on mount would be wrong for
// most of the screen's life. An effect keyed on the list's length is
// right by construction.
//
// In its own module rather than beside <SelectionScreen> because a
// file that exports both a component and a hook breaks fast refresh
// for everything that imports it (react-refresh/only-export-components).
export const PlatformCountContext = createContext(null)

/**
 * Report how many options this list is showing, for the plate above
 * it. Safe to call from a component rendered outside a
 * SelectionScreen — the context is null there and this does nothing.
 */
export function useReportPlatformCount(count) {
  const report = useContext(PlatformCountContext)
  useEffect(() => {
    if (!report) return
    report(count)
    // Deliberately no cleanup resetting to 0: these lists swap places
    // within one mounted SelectionScreen (source → level → mode), and
    // zeroing on the way out makes the count flicker to nothing in
    // between.
  }, [report, count])
}
