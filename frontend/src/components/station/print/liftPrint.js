// ── The print's moving parts, lifted out of its SVG (plan 208) ─────
// A CSS animation on a shape inside an <svg> is not the compositor's to
// run: every frame the browser lays the drawing out again, re-records
// it and rasters it (a print is a thousand shapes) on the main thread,
// where the gate's own motion waits behind it. That was the print's
// stutter. An animation on an HTML box is the compositor's: the box is
// rastered once and moved on the GPU, off the main thread.
//
// So once a print has come, each layer is rebuilt as a stack of boxes,
// in the order it is drawn: what keeps still in runs of plain SVG, each
// placed on its own drawing so its layer is no larger than that; each
// moving group in a box of its own carrying the group's class, timing
// and pivot, so the same rules in index.css move the box instead. The
// stack is in the print's units (zoomed to the frame), so every length
// the motion is written in still holds.
//
// The picture is the same. A group's transform moves to a box with the
// same matrix, its opacity to a box with the same opacity. Its paint,
// clip, mask and filter go round each of its parts instead, which is the
// same picture while those parts do not overlap (a ripple now carries
// its clip with it: half a pixel, at most).

// Every part the print moves or fades: each class of its own is one of
// the print's animations (index.css, the print's section).
const moves = el => [...el.classList].some(c => c.startsWith('tpr-'))

// What a box carries, and so never repeats on the wrapper a group's
// parts share (its style too, when that is a moving part's timing).
const OWN = ['id', 'class', 'transform', 'opacity']

const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const attrs = (el, skip) => [...el.attributes]
  .filter(a => !skip.has(a.name))
  .map(a => ` ${a.name}="${esc(a.value)}"`).join('')

// A group's own transform, or null.
function matrixOf(el) {
  const list = el.transform?.baseVal
  return list?.numberOfItems ? list.consolidate().matrix : null
}
const six = m => `${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f}`

// Where a shape's drawing lies in its parent's units: its own box,
// through its own transform (unless that goes on its box, `bare`).
// Strokes and blurs reach past it, hence the margin; a run's SVG shows
// what overflows it anyway, the margin only keeps its layer whole.
function extentOf(el, bare = false) {
  let b
  try { b = el.getBBox() } catch { return null }
  if (!b.width && !b.height) return null
  const m = bare ? null : matrixOf(el)
  const xs = [], ys = []
  for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
    xs.push(m ? m.a * x + m.c * y + m.e : x)
    ys.push(m ? m.b * x + m.d * y + m.f : y)
  }
  const pad = el.closest('[filter]') || el.querySelector('[filter]') ? 24 : 6
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
}

// The point a moving part turns about, in its parent's units: what its
// rule says (the centre of its own drawing, a corner of the print, the
// place the print wrote on it), resolved where it is drawn.
function pivotOf(el) {
  const cs = getComputedStyle(el)
  let [x, y] = cs.transformOrigin.split(' ').map(parseFloat)
  if (cs.transformBox === 'fill-box') {
    const b = el.getBBox()
    x += b.x
    y += b.y
  }
  return `${x}px ${y}px`
}

// A run of still shapes: one SVG, placed on what it draws.
function still(nodes, wrap, html = nodes.map(n => n.outerHTML).join(''), bare = false) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of nodes) {
    const e = extentOf(n, bare)
    if (!e) continue
    x0 = Math.min(x0, e.x0); y0 = Math.min(y0, e.y0)
    x1 = Math.max(x1, e.x1); y1 = Math.max(y1, e.y1)
  }
  const body = wrap.map(w => w[0]).join('') + html + wrap.map(w => w[1]).reverse().join('')
  if (x0 === Infinity) {
    // Nothing to measure (definitions, a clip, an empty group): kept,
    // unplaced. Not at zero size, which would stop it rendering, and
    // its definitions with it.
    return `<svg class="tpr-lift__run" width="1" height="1" overflow="visible">${body}</svg>`
  }
  const w = x1 - x0, h = y1 - y0
  return `<svg class="tpr-lift__run" style="left:${x0}px;top:${y0}px" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}" overflow="visible">${body}</svg>`
}

const lifts = el => moves(el) || [...el.children].some(lifts)

function stack(children, wrap) {
  let out = '', run = []
  const flush = () => { if (run.length) out += still(run, wrap); run = [] }
  for (const ch of children) {
    if (!lifts(ch)) { run.push(ch); continue }
    flush()
    const moving = ch.classList.length > 0
    const opacity = ch.getAttribute('opacity')
    // Its own transform, as lengths, so the frame's zoom carries it as
    // it does every other length (a matrix's own numbers are not).
    const matrix = matrixOf(ch)
    const transform = matrix && `translate(${matrix.e}px, ${matrix.f}px) matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, 0, 0)`
    let inner
    if (ch.tagName.toLowerCase() === 'g') {
      // The group's paint, clip, mask and filter go round each of its
      // parts; its transform and opacity become boxes. Inside the
      // transform's box, what is shared from above is undone first
      // (each clip, mask and filter is drawn in its own group's units:
      // a reflection is the scene turned over, clipped to the bay)
      // and done again inside it.
      const skip = new Set(moving ? [...OWN, 'style'] : OWN)
      const above = matrix && wrap.length
        ? [[`<g transform="matrix(${six(matrix.inverse())})">`, '</g>'], ...wrap, [`<g transform="matrix(${six(matrix)})">`, '</g>']]
        : wrap
      inner = stack([...ch.children], [...above, [`<g${attrs(ch, skip)}>`, '</g>']])
    } else {
      const shape = ch.cloneNode(true)
      for (const a of OWN) shape.removeAttribute(a)
      shape.removeAttribute('style')
      inner = still([ch], wrap, shape.outerHTML, true)
    }
    if (moving) {
      // The moving part itself: its class, timing, pivot and transform on
      // the box, its opacity with them. One box, as SVG has it: the pivot
      // holds for its own transform too, and an animated opacity wins.
      const style = (ch.getAttribute('style') ?? '').replace(/transform-origin\s*:[^;]*;?/g, '').trim()
      const own = (style && !style.endsWith(';') ? ';' : '')
        + (opacity !== null ? `opacity:${esc(opacity)};` : '')
        + (transform ? `transform:${transform};` : '')
      inner = `<div class="tpr-lift ${esc(ch.getAttribute('class'))}" style="${esc(style)}${own}transform-origin:${pivotOf(ch)}">${inner}</div>`
    } else {
      if (transform) inner = `<div class="tpr-lift" style="transform:${transform}">${inner}</div>`
      if (opacity !== null) inner = `<div class="tpr-lift" style="opacity:${esc(opacity)}">${inner}</div>`
      // What the group sets for its parts to read (a flock's wing beat,
      // --beat and --ph): on a box too, which its lifted parts inherit.
      const vars = ch.getAttribute('style')
      if (vars) inner = `<div class="tpr-lift" style="${esc(vars)}">${inner}</div>`
    }
    out += inner
  }
  flush()
  return out
}

/**
 * A print's layer, mounted as drawn (`layer`, an <svg> in the page, so
 * its shapes can be measured), rebuilt as the stack of boxes above: its
 * markup, in the print's units, for a box the size of the print zoomed
 * to the frame. A layer with nothing moving comes back as one run.
 */
export function liftLayer(layer) {
  return stack([...layer.children], [])
}

/**
 * Each looping part of a lifted stack (`root`) handed from its CSS
 * animation to the same animation through the Web Animations API: the
 * same keyframes (as the browser resolved them, the print's own lengths
 * and timings in), the same timing, the same instant. The motion is
 * unchanged; what goes is the iteration event. A CSS animation fires
 * one each time it turns, and React listens for every one at its root
 * (it listens for every event there), so the browser wakes the main
 * thread to dispatch it: with the print's ~250 loops that was a wake on
 * nearly every frame, each re-sampling every animation's style, and the
 * gate stuttered (plan 207). A Web Animation fires no such event.
 * Returns the animations made, for the caller to cancel. Nothing moves
 * under reduced motion (the sheet stops every part), so nothing is made.
 *
 * `loops` hands over the looping parts alone and `keep` leaves the
 * boxes' own custom properties where they are: the day cleared's flock
 * and lanterns (plan 250), placed by theirs, whose ways in are single
 * turns that end on their own.
 */
export function handOver(root, { loops = false, keep = false } = {}) {
  const made = []
  if (!root?.getAnimations) return made
  for (const css of root.getAnimations({ subtree: true })) {
    if (typeof CSSAnimation === 'undefined' || !(css instanceof CSSAnimation)) continue
    if (loops && css.effect.getTiming().iterations !== Infinity) continue
    const el = css.effect.target
    const keyframes = css.effect.getKeyframes()
    for (const k of keyframes) delete k.computedOffset
    const { duration, delay, endDelay, iterations, iterationStart, direction, easing, fill } = css.effect.getTiming()
    const web = el.animate(keyframes, { duration, delay, endDelay, iterations, iterationStart, direction, easing, fill })
    if (css.startTime != null) web.startTime = css.startTime
    else web.currentTime = css.currentTime
    css.cancel()
    made.push(web)
  }
  // The print's own custom properties have been read into the keyframes
  // above. Left on the boxes, each would keep the stack in every
  // restyle a change of an inherited variable at the page's root makes
  // (a box with properties of its own cannot share its parent's), and
  // the page's root changes one as the run's stage opens (plan 207).
  if (made.length && !keep) {
    for (const el of root.querySelectorAll('[style*="--"]')) {
      for (const name of [...el.style].filter(n => n.startsWith('--'))) el.style.removeProperty(name)
    }
  }
  return made
}
