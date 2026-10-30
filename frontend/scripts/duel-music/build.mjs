// ── 対戦の曲 — build the duel's music and sounds (plan 285) ───────────
//
//   cd frontend && node scripts/duel-music/build.mjs      # needs ffmpeg
//
// Plays score.js (the owner's pick of the canvas "C1, le son retenu") in
// Chromium's OfflineAudioContext and writes what src/lib/audio/duel.js
// plays:
//
//   public/sounds/duel/<REV>/<layer>.mp3   base, chords, arp, melody: a
//        sixteen-bar cycle each, with PAD seconds of itself either side
//        (the player loops between PAD and PAD + the cycle, so a
//        decoder's priming only moves the phase, as the ambiance's do)
//   public/sounds/duel/<REV>/rush.mp3      bars 71-80, every layer on
//   public/sounds/duel/<REV>/final.mp3     the last chord, at 0:00
//   public/sounds/duel/<REV>/result.mp3    the result's loop, padded the same way
//   public/sounds/duel/<REV>/fx-<name>.mp3 each sound of the race and the result
//   src/lib/audio/duel.json                the revision, the bar, the files
//
// Levels: the mix the canvas played (the music at half the sounds'
// gain, each sound at its own level in score.js, the canvas's EQ on
// each), scaled as one so that a right answer sits where the app's own
// `correct` does: 0.042, the loudest 42ms window of RMS (settings.js).
// The music is then held under MUSIC_PEAK with every layer on.
//
// Bump REV whenever the output changes: the service worker keeps
// /sounds/ cache-first for a year. The old revision's folder is deleted
// here; commit the deletion with it. Deterministic on the same Chromium
// and ffmpeg.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REV = 'duel1'
const PAD = 1
const RATE = 48000
const TARGET = 0.042
const MUSIC_PEAK = 0.5
const MUSIC_EQ = 'bass=g=-5:f=110:w=0.7,equalizer=f=1800:t=q:w=1:g=3,treble=g=3:f=3500:w=0.7'
const FX_EQ = 'bass=g=-4:f=120:w=0.7,equalizer=f=2200:t=q:w=1:g=3,volume=1.1dB'
// How long each sound is rendered; its silence after is trimmed.
const FX_SECONDS = { win: 2.6, arrival: 2.2, tier3: 1.6, rush: 1.6, loss: 1.8 }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(HERE, '../..')
const ROOT = path.join(FRONTEND, 'public', 'sounds', 'duel')
const OUT = path.join(ROOT, REV)
const MANIFEST = path.join(FRONTEND, 'src', 'lib', 'audio', 'duel.json')

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', e => { throw e })
await page.setContent('<!doctype html><title>duel music</title>')
await page.addScriptTag({ content: readFileSync(path.join(HERE, 'score.js'), 'utf8') })
const S = await page.evaluate(() => {
  const { BPM, BEAT, BAR, RATE, CYCLE, RUSH_FROM, BARS, LAYERS, SOUNDS } = globalThis.DuelScore
  return { BPM, BEAT, BAR, RATE, CYCLE, RUSH_FROM, BARS, LAYERS, SOUNDS }
})
if (S.RATE !== RATE) throw new Error(`score renders at ${S.RATE}`)

/** A part rendered in the page: [call, ...args] -> interleaved float32. */
async function render(call, ...args) {
  const b64 = await page.evaluate(async ([call, args]) => {
    const [L, R] = await globalThis.DuelScore[call](...args)
    const out = new Float32Array(L.length * 2)
    for (let i = 0; i < L.length; i++) { out[2 * i] = L[i]; out[2 * i + 1] = R[i] }
    const bytes = new Uint8Array(out.buffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(bin)
  }, [call, args])
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

function ffmpeg(args, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(r.stderr.toString())
  return r.stdout
}

/** Through an EQ, as float32 again. */
function eq(x, chain) {
  const out = ffmpeg(['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-af', chain, '-f', 'f32le', '-'], Buffer.from(x.buffer, x.byteOffset, x.byteLength))
  return new Float32Array(out.buffer, out.byteOffset, out.length / 4)
}

/** The loudest 42ms window of RMS, on the louder channel (scripts/measure-voices.mjs). */
function loud(x) {
  const n = x.length / 2
  const W = Math.round(RATE * 0.042)
  let acc = 0
  let best = 0
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(x[2 * i]), Math.abs(x[2 * i + 1]))
    acc += a * a
    if (i >= W) {
      const b = Math.max(Math.abs(x[2 * (i - W)]), Math.abs(x[2 * (i - W) + 1]))
      acc -= b * b
    }
    if (i >= W - 1) best = Math.max(best, Math.sqrt(Math.max(0, acc) / W))
  }
  return best
}

const peak = x => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

/** A sound's silence after it, cut at -70 dB of its peak. */
function trimmed(x) {
  const floor = peak(x) * 10 ** (-70 / 20)
  let end = x.length / 2
  while (end > 1 && Math.abs(x[2 * (end - 1)]) < floor && Math.abs(x[2 * (end - 1) + 1]) < floor) end -= 1
  return x.slice(0, 2 * Math.min(x.length / 2, end + Math.round(RATE * 0.02)))
}

/** Where its first sound is, in seconds (the player reads a decoder's priming off it). */
function onset(x) {
  const floor = peak(x) * 0.05
  for (let i = 0; i < x.length / 2; i++) if (Math.max(Math.abs(x[2 * i]), Math.abs(x[2 * i + 1])) > floor) return i / RATE
  return 0
}

function encode(x, gain, file, bitrate) {
  ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-af', `volume=${gain.toFixed(6)}`,
    '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', file],
  Buffer.from(x.buffer, x.byteOffset, x.byteLength))
}

const t0 = Date.now()
const parts = {}
for (const layer of S.LAYERS) {
  parts[layer] = eq(await render('cycle', layer, PAD), MUSIC_EQ)
  console.log(layer, ((Date.now() - t0) / 1000).toFixed(0) + 's')
}
// The rush starts after a quarter second of silence, which the player
// skips: an encoder's priming lands in it.
const LEAD = 0.25
const lead = x => { const z = new Float32Array(Math.round(LEAD * RATE) * 2); const o = new Float32Array(z.length + x.length); o.set(z); o.set(x, z.length); return o }
parts.rush = eq(lead(await render('rush', 3)), MUSIC_EQ)
parts.final = eq(lead(await render('last', 3.2)), MUSIC_EQ)
parts.result = eq(await render('result', PAD), MUSIC_EQ)
console.log('rush, final, result', ((Date.now() - t0) / 1000).toFixed(0) + 's')
const sounds = {}
for (const name of S.SOUNDS) sounds[name] = trimmed(eq(lead(await render('sound', name, FX_SECONDS[name] ?? 1.2)), FX_EQ))
console.log('sounds', ((Date.now() - t0) / 1000).toFixed(0) + 's')
await browser.close()

// One scale for all of it, from a right answer.
const gain = TARGET / loud(sounds.right)
// The four layers summed, the loudest the music gets outside the rush.
const all = new Float32Array(parts.base.length)
for (const layer of S.LAYERS) parts[layer].forEach((v, i) => { all[i] += v })
const musicPeak = Math.max(peak(all), peak(parts.rush), peak(parts.final)) * gain
const musicGain = gain * Math.min(1, MUSIC_PEAK / musicPeak)

rmSync(ROOT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const [name, x] of Object.entries(parts)) encode(x, musicGain, path.join(OUT, `${name}.mp3`), '96k')
for (const [name, x] of Object.entries(sounds)) encode(x, gain, path.join(OUT, `fx-${name}.mp3`), '128k')

const manifest = {
  rev: REV,
  bpm: S.BPM,
  bar: S.BAR,
  bars: S.BARS,
  rushFrom: S.RUSH_FROM,
  cycle: S.CYCLE * S.BAR,
  resultLoop: 2 * S.BAR,
  pad: PAD,
  lead: LEAD,
  layers: S.LAYERS,
  sounds: S.SOUNDS,
  // Where the last chord's first sound is in its file: a decoder that
  // keeps an encoder's priming is read off it.
  onset: Number(onset(parts.final).toFixed(4)),
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

console.log(`gain ${gain.toFixed(3)}, music ${musicGain.toFixed(3)} (peak with every layer ${(peak(all) * musicGain).toFixed(3)}), right ${(loud(sounds.right) * gain).toFixed(4)}`)
for (const [name, x] of Object.entries(sounds)) console.log(`  ${name.padEnd(8)} loud ${(loud(x) * gain).toFixed(4)}  peak ${(peak(x) * gain).toFixed(3)}  ${(x.length / 2 / RATE).toFixed(2)}s`)
console.log(readdirSync(OUT).length, 'files', `${((Date.now() - t0) / 1000).toFixed(0)}s`)
