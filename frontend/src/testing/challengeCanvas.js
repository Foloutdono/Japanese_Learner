// ── The reading challenge's canvas, stubbed (plans 247, 309) ──
// A reading challenge (carousel/challenge.js) is drawn in a lane with no
// canvas: these are the stubs its tests draw it on, kept here so every
// file that draws one reads what it drew the same way.

/** Runs `fn` with a Path2D the drawing can make (the lane has none). */
export const withPath2D = fn => {
  const had = globalThis.Path2D
  globalThis.Path2D = class {}
  try { return fn() } finally { globalThis.Path2D = had }
}

/** A context recording every text drawn, where and how large (the
 *  stub's measure, a little wide), through any move or scale: its size
 *  is its height on screen. Anything else it is asked does nothing and
 *  gives nothing back: a radial gradient, a pattern or the frame's
 *  pixels come back empty, so a drawing with no print loaded (P null)
 *  must ask for none of them. */
export const drawn = () => {
  const at = []
  const state = { font: '10px sans-serif', textAlign: 'left', globalAlpha: 1, tx: 0, ty: 0, sx: 1, sy: 1 }
  const size = () => parseFloat(/([\d.]+)px/.exec(state.font)?.[1] || '10')
  const width = t => [...String(t)].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.56), 0) * size()
  const methods = {
    measureText: t => ({ width: width(t), actualBoundingBoxAscent: size() * 0.72, actualBoundingBoxDescent: size() * 0.12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width(t) }),
    fillText: (t, x, y) => {
      const w = width(t)
      const left = state.textAlign === 'center' ? x - w / 2 : state.textAlign === 'right' ? x - w : x
      const L = state.tx + state.sx * left
      at.push({ t: String(t), size: size() * state.sy, left: L, right: L + w * state.sx, y: state.ty + state.sy * y, alpha: state.globalAlpha })
    },
    translate: (x, y) => { state.tx += x * state.sx; state.ty += y * state.sy },
    scale: (a, b) => { state.sx *= a; state.sy *= b },
    createLinearGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    // What a save keeps: how faint, in what face, from where.
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop() || {}),
  }
  const stack = []
  const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
  return { ctx, at }
}
