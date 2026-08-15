import { useEffect, useState } from 'react'

// ── パタパタ — the split-flap display ──────────────────────
// The board at a Japanese station turning over. It is the one piece of
// motion this whole app has been implying since the home screen became
// a 発車標 and never actually performed, and it is what a number
// changing should look like here — not a badge popping.
//
// The real mechanism, not a cross-fade dressed up as one. Four layers:
//
//   the top half of the NEW value, sitting there uncovered
//   the bottom half of the OLD value, likewise
//   a leaf carrying the OLD top, hinged at its bottom edge, falling
//   a leaf carrying the NEW bottom, hinged at its top edge, following
//
// The first leaf falls 0° → -90° and the second continues 90° → 0°, so
// the card appears to pass through the horizontal seam. That seam is
// what sells it: without a hard line across the middle the eye reads a
// rotation rather than a flap.
function Flap({ from, to, delay = 0 }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (from === to) return
    const id = setTimeout(() => setFlipped(true), delay)
    return () => clearTimeout(id)
  }, [from, to, delay])

  return (
    <span className={`flap${flipped ? ' flap--turned' : ''}`} aria-hidden="true">
      {/* Every layer holds a full-height glyph that its own half
          clips — top halves pin it to the top, bottom halves to the
          bottom, so the two reassemble into one character across the
          seam. The glyph must be a real element: offsetting a bare
          text node is not something CSS can do. */}
      <span className="flap__half flap__half--top"><span className="flap__glyph">{to}</span></span>
      <span className="flap__half flap__half--bottom"><span className="flap__glyph">{from}</span></span>
      <span className="flap__leaf flap__leaf--falling"><span className="flap__glyph">{from}</span></span>
      <span className="flap__leaf flap__leaf--rising"><span className="flap__glyph">{to}</span></span>
      <span className="flap__seam" />
    </span>
  )
}

/**
 * A run of flaps showing `to`, each turning over from the matching
 * character of `from`.
 *
 * Digits are padded to the same width so the columns do not jump when
 * 9 becomes 10 — a real board has a fixed number of drums and gains a
 * leading zero rather than growing a new one mid-turn.
 *
 * `stagger` is the delay added per column, left to right. A board
 * whose drums all land on the same frame reads as a screen; the ripple
 * is most of what makes it read as machinery.
 */
export function SplitFlap({ from, to, stagger = 70, label }) {
  const width = Math.max(String(from).length, String(to).length)
  const a = String(from).padStart(width, '0')
  const b = String(to).padStart(width, '0')

  return (
    <span className="split-flap" role="img" aria-label={label ?? String(to)}>
      {[...b].map((ch, i) => (
        <Flap key={i} from={a[i]} to={ch} delay={i * stagger} />
      ))}
    </span>
  )
}
