import { useLayoutEffect } from 'react'

// ── Which chrome is up ────────────────────────────────────────
// The two layouts (components/chrome/Shell.jsx) stamp themselves on
// <html> so the stylesheet can dock things against the right edge:
// under the shell the bottom edge is the tab bar, on a stage it is
// the screen's own foot. `--dock-bottom` in index.css reads this
// attribute, and every docked object (the rating bar, the notes, a
// page's last row) reads that token. One attribute, no prop drilling
// through screens that never asked, and plan 076's Android back
// handler reads the same answer.
export function useChrome(kind) {
  useLayoutEffect(() => {
    document.documentElement.dataset.chrome = kind
    return () => { delete document.documentElement.dataset.chrome }
  }, [kind])
}
