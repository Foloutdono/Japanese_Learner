// The loudness meter for the sound palette (src/lib/audio/recipes.js).
//
// Renders every voice of every event in Chromium's OfflineAudioContext,
// through the same voiceOut node and level trim the app plays it
// through, and reports for each:
//
//   peak    the highest sample at the bus
//   loud    the loudest 42ms window of RMS at the bus -- the measure
//           the levels in settings.js are set by, since the ear
//           integrates over about that long and peak lies about
//           short sounds
//   phone   the same window through a model of a phone's speaker, a
//           fourth-order roll-off under 400Hz, and how many dB the
//           speaker costs the voice (loss); a sound built on 150Hz is
//           loud at the bus and nearly silent in a hand
//   vs      the voice's loudness against its event's default, in dB --
//           a voice picked from the palette inherits its event's trim,
//           so it is only as loud as the default if it is written at,
//           or given the `level` that puts it at, the default's
//           loudness. By the window, or by peak for an event that says
//           `meter: 'peak'` (a noise burst a few ms long, which the
//           window under-reads)
//   level   the `level` that would put it level with the default
//   len     how long until it falls under -60dB
//
// Dev-time only, no network:
//
//   node scripts/measure-voices.mjs            the table
//   node scripts/measure-voices.mjs --json     the figures, as JSON
//   node scripts/measure-voices.mjs click door-chime   some events only
import { chromium } from 'playwright'
import { voicesBundle } from './voices-bundle.mjs'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const only = args.filter(a => !a.startsWith('--'))

// Runs in the page. Kept as a plain function so it can be handed over
// whole; it reads only globalThis.TsujiVoices.
async function measureAll(only) {
  const { VOICE_EVENTS, voiceOut, voiceLevel } = globalThis.TsujiVoices
  const RATE = 48000
  const SECONDS = 4
  const WINDOW = Math.round(RATE * 0.042)
  const HOP = Math.round(RATE * 0.001)

  async function render(event, variant, phone) {
    const ctx = new OfflineAudioContext(2, RATE * SECONDS, RATE)
    let dest = ctx.destination
    if (phone) {
      // Two second-order sections: -6dB at 400Hz and 24dB an octave
      // under it. A model, not a measurement of any one phone.
      for (let i = 0; i < 2; i++) {
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 400
        // A Web Audio highpass takes its Q in dB, not as a ratio: a
        // Butterworth section's 0.707 is -3.01dB here. Written as 0.707
        // each section peaks +1.1dB just over 400Hz, and the pair made
        // a sound on G5 read louder on the phone than at the bus.
        hp.Q.value = 20 * Math.log10(Math.SQRT1_2)
        hp.connect(dest)
        dest = hp
      }
    }
    const out = voiceOut(ctx, dest, voiceLevel(event, variant))
    variant.play(ctx, out)
    return ctx.startRendering()
  }

  function figures(buffer) {
    const l = buffer.getChannelData(0)
    const r = buffer.getChannelData(1)
    const n = l.length
    const sq = new Float64Array(n + 1)
    let peak = 0
    let last = 0
    for (let i = 0; i < n; i++) {
      const a = Math.max(Math.abs(l[i]), Math.abs(r[i]))
      if (a > peak) peak = a
      if (a > 0.001) last = i
      sq[i + 1] = sq[i] + (l[i] * l[i] + r[i] * r[i]) / 2
    }
    let loud = 0
    for (let i = 0; i + WINDOW <= n; i += HOP) {
      const rms = Math.sqrt((sq[i + WINDOW] - sq[i]) / WINDOW)
      if (rms > loud) loud = rms
    }
    return { peak, loud, len: last / RATE }
  }

  const db = (a, b) => (a > 0 && b > 0 ? 20 * Math.log10(a / b) : null)
  const rows = []
  for (const event of VOICE_EVENTS) {
    if (only.length && !only.includes(event.key)) continue
    const metric = event.meter === 'peak' ? 'peak' : 'loud'
    let base = null
    for (const variant of event.variants) {
      const bus = figures(await render(event, variant, false))
      const phone = figures(await render(event, variant, true))
      // An event whose first voice is silence names its own target.
      if (base === null) base = bus[metric] || event.loudness || 0
      const vs = db(bus[metric], base)
      rows.push({
        event: event.key, variant: variant.key, space: variant.space ?? 0, metric,
        peak: bus.peak, loud: bus.loud, phone: phone.loud,
        loss: db(bus.loud, phone.loud), vs, len: bus.len,
        level: vs === null ? null : Math.round((variant.level ?? 1) * 10 ** (-vs / 20) * 100) / 100,
      })
    }
  }
  return rows
}

// The Chromium the environment ships, where the pinned one is absent
// (CHROMIUM_PATH overrides; unset, Playwright finds its own).
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
let rows
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><title>meter</title>')
  await page.addScriptTag({ content: await voicesBundle() })
  rows = await page.evaluate(measureAll, only)
} finally {
  await browser.close()
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  const f = (n, d = 3) => (n === null ? '   -  ' : n.toFixed(d))
  const s = n => (n === null ? '   -' : (n >= 0 ? '+' : '') + n.toFixed(1))
  let current = null
  for (const r of rows) {
    if (r.event !== current) {
      current = r.event
      console.log(`\n${r.event}${r.metric === 'peak' ? '  (levelled by peak)' : ''}`)
      console.log('  voice                 peak   loud   phone  loss    vs    len  level')
    }
    const name = (r.variant + (r.space ? ' (hall)' : '')).padEnd(20)
    console.log(`  ${name}  ${f(r.peak)}  ${f(r.loud)}  ${f(r.phone)}  ${s(r.loss).padStart(5)}  ${s(r.vs).padStart(5)}  ${f(r.len, 2)}s  ${f(r.level, 2)}`)
  }
}
