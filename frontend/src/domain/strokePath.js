// ── 初見 — a KanjiVG stroke as points (plan 213) ─────────────────
// The trace is judged against the stroke itself (domain/trace.js), so
// the stroke is walked here from its start to its end. Without the DOM:
// a path's getPointAtLength wants the path laid out in a document, and
// KanjiVG's paths are a small language -- every one of its 6,702 files
// draws with M, C and S alone (absolute or relative), which is all this
// reads. A line (L, H, V) and a close (Z) are read too, as a stroke
// never needs more and a path that holds one is not cut short.

import { sampleCount } from './trace'

const TOKEN = /[MmLlHhVvCcSsZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g
const COMMAND = /^[MmLlHhVvCcSsZz]$/

/** The path as cubic segments, [p0, p1, p2, p3] each. */
export function parseStroke(d) {
  const tokens = String(d ?? '').match(TOKEN) ?? []
  const segments = []
  let cmd = null
  let at = [0, 0]
  let start = [0, 0]
  let lastCtrl = null
  let i = 0
  const num = () => Number(tokens[i++])
  const line = to => {
    segments.push([at, at, to, to])
    at = to
    lastCtrl = null
  }
  while (i < tokens.length) {
    if (COMMAND.test(tokens[i])) cmd = tokens[i++]
    else if (cmd == null) break
    const rel = cmd === cmd.toLowerCase()
    const off = p => (rel ? [at[0] + p[0], at[1] + p[1]] : p)
    switch (cmd.toUpperCase()) {
      case 'M': {
        at = off([num(), num()])
        start = at
        lastCtrl = null
        // Pairs after a move are lines (the path grammar's own rule).
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L': line(off([num(), num()])); break
      case 'H': { const x = num(); line([rel ? at[0] + x : x, at[1]]); break }
      case 'V': { const y = num(); line([at[0], rel ? at[1] + y : y]); break }
      case 'C': {
        const p1 = off([num(), num()])
        const p2 = off([num(), num()])
        const p3 = off([num(), num()])
        segments.push([at, p1, p2, p3])
        lastCtrl = p2
        at = p3
        break
      }
      case 'S': {
        const p1 = lastCtrl ? [2 * at[0] - lastCtrl[0], 2 * at[1] - lastCtrl[1]] : at
        const p2 = off([num(), num()])
        const p3 = off([num(), num()])
        segments.push([at, p1, p2, p3])
        lastCtrl = p2
        at = p3
        break
      }
      default: line(start); cmd = null   // Z: back to where the path began
    }
  }
  return segments.filter(s => s.every(p => p.every(Number.isFinite)))
}

function cubicAt([p0, p1, p2, p3], t) {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const e = t * t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
  ]
}

// Each segment cut fine enough that its chords are its curve, at
// KanjiVG's scale (a stroke is at most ~100 units long).
const STEPS = 24

/**
 * The stroke walked from its start to its end at even steps along it:
 * `count` points, or one every two units or so (domain/trace's
 * sampleCount). An empty list for a path that draws nothing.
 */
export function sampleStroke(d, count) {
  const segments = parseStroke(d)
  if (!segments.length) return []
  const fine = [segments[0][0]]
  for (const seg of segments) {
    for (let s = 1; s <= STEPS; s++) fine.push(cubicAt(seg, s / STEPS))
  }
  const run = [0]
  for (let k = 1; k < fine.length; k++) {
    run.push(run[k - 1] + Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1]))
  }
  const length = run[run.length - 1]
  const n = count ?? sampleCount(length)
  if (!length) return [fine[0]]
  const out = []
  let k = 1
  for (let j = 0; j <= n; j++) {
    const want = (length * j) / n
    while (k < run.length - 1 && run[k] < want) k++
    const span = run[k] - run[k - 1] || 1
    const t = Math.min(1, Math.max(0, (want - run[k - 1]) / span))
    out.push([
      fine[k - 1][0] + (fine[k][0] - fine[k - 1][0]) * t,
      fine[k - 1][1] + (fine[k][1] - fine[k - 1][1]) * t,
    ])
  }
  return out
}
