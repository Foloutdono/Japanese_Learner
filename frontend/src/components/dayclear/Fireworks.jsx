import { useEffect, useRef } from 'react'

// ── 花火 — the month's fireworks (plan 191) ──────────────────────────
// The canvas's Milestone-30 sky: on a <canvas> (devicePixelRatio-aware,
// 'lighter' compositing, trails by fading the last frame with
// 'destination-out' so the CSS night behind shows through), rising
// shells with wobbling sparkle trails, then 菊 chrysanthemum, 牡丹 peony,
// 柳 willow, 冠 crown and a closing 千輪 cluster with crackle strobes,
// each burst lighting the sky and the station roof's top edge -- driven
// from elapsed time with a fixed 1/60 step and a seeded die
// (kit/rng.js), so a replay is frame-identical. Palette: --gate-gold-lit,
// --gate-gold, --paper and one ring of --stamp-ink.
//
// PLACEHOLDER (foundation): an empty canvas sized to its box. The
// milestones' screen agent ports the board's simulation here.
//
// Props:
//   play      run the show (false: nothing drawn -- reduced motion, a skip)
//   seed      the die's seed (default the boards', 20261006)
//   onBurst(i, x, y)  each burst, for the sky's glow and the roof's rim
//   onDone()  the show is over
//   className  sized by the caller (absolute, over the night, under the text)
export default function Fireworks({ play = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const box = canvas.getBoundingClientRect()
    canvas.width = Math.round(box.width * dpr)
    canvas.height = Math.round(box.height * dpr)
  }, [play])
  return <canvas ref={ref} className={['ms-fireworks', className].filter(Boolean).join(' ')} aria-hidden="true" />
}
