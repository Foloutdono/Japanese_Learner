// ── Where a column stands: its content box ──
// The desk's scrolling columns (the side, Settings' list, a split's list)
// keep a gutter inside their edge, so that nothing a row paints past its
// box is cut, and give it back as a negative margin (index.css, "what a
// scrolling column must not cut"). Their own box is therefore a little
// wider and taller than what they hold, and where a column STANDS -- its
// width, its top beside the page -- is its content box: the box less its
// border and padding.
export function contentBox(el) {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const inset = side => parseFloat(cs[`border${side}Width`]) + parseFloat(cs[`padding${side}`])
  const top = r.top + inset('Top')
  const left = r.left + inset('Left')
  const right = r.right - inset('Right')
  const bottom = r.bottom - inset('Bottom')
  return { top, left, right, bottom, width: right - left, height: bottom - top }
}
