import { MARK_INK, MARK_ROAD } from './markPaths'

// ── 辻 — the mark (plan 158) ─────────────────────────────────
// The app's name as its icon draws it: 辻 in Noto Serif JP Black with
// one dot on 辶 -- five strokes, a form the font cannot set, so it is
// cut from the font's own outlines (scripts/build-mark.py) -- and 辶's
// sweep, the road, in the pass's metal. One drawing wherever the app
// names itself: the rail's masthead, the Welcome and the sign-in, the
// boot screen, a notification's icon. The mark on the home screen is
// the mark inside.
//
// It stands in the text glyph's box -- 1em square, its foot 0.12em
// under the baseline, where the em box's is -- so a rule that sized
// and placed the glyph by its font-size places the mark the same. The
// ink is currentColor, the caller's ink as the text's was; the road is
// --accent2. `label` names it for a screen reader (callers pass
// appTitle, inside their lang="ja"); without one it is decoration.
export function Mark({ label, className = '' }) {
  return (
    <svg
      className={`mark ${className}`.trim()}
      viewBox="0 0 1000 1000"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {/* The road first: the ink's zigzag lands on it at the joint. */}
      <path className="mark__road" d={MARK_ROAD} />
      <path className="mark__ink" d={MARK_INK} />
    </svg>
  )
}
