// ── 菱 — the pantograph, to the painting's measurements (plan 225) ──
// The painted gate draws its pantograph so it can move: the arms fold
// onto the roof and rise to the wire, each part turning about its own
// joint, every pose solved here from the head's height. A transform
// per part, so it runs in every browser (no CSS `d`, no `cx`), set on
// the parts each frame of a raise or a fold (PracticeGate.jsx).
//
// Measured on the owner's painting (px): the base's hinge B (317, 664),
// the knee (178.25, 524.3), the upper arm into the bar's underside at
// (266, 410), the bar's top at 398.3; the strut leaves the base at
// (297.75, 661) and enters the lower arm at (274.5, 630). In the scene's
// units u = x / 2.3128, v = (y + 58) / 2.3128 (the sky let in above,
// scripts/practice-gate/cut.py). Raised, the bar's top sits on the
// contact wire's underside; folded, the horns' tips stand just over the
// base.

const S = 2.3128
const U = x => x / S
const V = y => (y + 58) / S
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

const B = [U(317), V(664)]
const K0 = [U(178.25), V(524.3)]
const H0 = [U(266), V(410)]
const L1 = dist(B, K0)
const L2 = dist(K0, H0)
const HX = H0[0]
// The head's hinge sits this far under the bar's top.
const DROP = H0[1] - V(398.3)
export const RAISED = 194.5
export const FOLDED = 299.0
const R0 = [U(297.75), V(661)]

// The strut's head in the lower arm's own frame (x along the arm from B,
// y to its upper right), set a little inside the arm's edge.
const R1L = (() => {
  const th = Math.atan2(K0[1] - B[1], K0[0] - B[0])
  const p = [U(274.5) - B[0], V(630) - B[1]]
  return [p[0] * Math.cos(th) + p[1] * Math.sin(th) + 1.0, -p[0] * Math.sin(th) + p[1] * Math.cos(th) + 0.7]
})()

/** The knee for the head's hinge at (HX, hy): the two circles' left meeting. */
function knee(hy) {
  const dx = HX - B[0]
  const dy = hy - B[1]
  const d = Math.hypot(dx, dy)
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a))
  const mx = B[0] + a * dx / d
  const my = B[1] + a * dy / d
  const k1 = [mx + h * dy / d, my - h * dx / d]
  const k2 = [mx - h * dy / d, my + h * dx / d]
  return k1[0] < k2[0] ? k1 : k2
}

const deg = r => r * 180 / Math.PI

function solve(top) {
  const hy = top + DROP
  const k = knee(hy)
  const th = Math.atan2(k[1] - B[1], k[0] - B[0])
  const ph = Math.atan2(hy - k[1], HX - k[0])
  const c = Math.cos(th)
  const s = Math.sin(th)
  const r1 = [B[0] + R1L[0] * c - R1L[1] * s, B[1] + R1L[0] * s + R1L[1] * c]
  return { th: deg(th), k, ph: deg(ph), dy: top - RAISED, ps: deg(Math.atan2(r1[1] - R0[1], r1[0] - R0[0])), ln: dist(R0, r1) }
}

// The strut is drawn at its raised length and scaled along itself.
const STRUT = solve(RAISED).ln
const f2 = n => n.toFixed(2)

/** Each part's transform with the bar's top at `top` (FOLDED … RAISED). */
export function pose(top) {
  const p = solve(top)
  return {
    lower: `translate(${f2(B[0])}px, ${f2(B[1])}px) rotate(${f2(p.th)}deg)`,
    upper: `translate(${f2(p.k[0])}px, ${f2(p.k[1])}px) rotate(${f2(p.ph)}deg)`,
    knee: `translate(${f2(p.k[0])}px, ${f2(p.k[1])}px)`,
    head: `translateY(${f2(p.dy)}px)`,
    strut: `translate(${f2(R0[0])}px, ${f2(R0[1])}px) rotate(${f2(p.ps)}deg) scaleX(${(p.ln / STRUT).toFixed(4)})`,
  }
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = t => 1 - (1 - t) ** 3

/** Up: the air pushes it, slowing as it comes; it touches at 78% of the
    way, the wire gives it back a little twice, and it settles on it.
    `t` is 0…1 of RAISE_MS; returns the bar's top. */
export function rising(t) {
  let s
  if (t <= 0.78) s = easeInOut(t / 0.78) * 0.8 + easeOut(t / 0.78) * 0.2
  else if (t <= 0.9) s = 1 - 0.022 * Math.sin(Math.PI * (t - 0.78) / 0.12)
  else s = 1 - 0.006 * Math.sin(Math.PI * (t - 0.9) / 0.1)
  return FOLDED + (RAISED - FOLDED) * s
}

/** Down: it lets go of the wire and folds, eased at both ends. */
export function folding(t) {
  return RAISED + (FOLDED - RAISED) * easeInOut(t)
}

export const RAISE_MS = 950
export const FOLD_MS = 800
// It touches the wire here, 78% of the way up: the spark.
export const TOUCH_MS = 740
