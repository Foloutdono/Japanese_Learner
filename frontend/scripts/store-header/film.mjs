// ── 動く看板 — the moving header (plan 308) ───────────────────────────
//
//   cd frontend && node scripts/store-header/film.mjs OUT [print] [--date YYYY-MM-DD] [--width 3840]
//
// Films today.py's page (the day's run on Today's print, the owner's
// pick E) for App Store Connect's header: OUT/today-<print>.mp4, 3840 x
// 1646 (21:9), LOOP seconds that loop without a seam, 30 fps, H.264 and
// AAC. Needs Python (the print's modules), Chromium and ffmpeg.
//
// - The frames are stills, one at a time: the page's render(t) sets the
//   print's own animations and the finish's keyframes to t, so a frame
//   never depends on how fast the machine shot the last one.
// - The seam: LOOP + SEAM seconds are filmed, and the loop is
//   [SEAM, LOOP + SEAM) with its last SEAM crossfaded into [0, SEAM), so
//   it ends on the frame it begins with (the print's motion has its own
//   periods; the dial's is the loop's).
// - The sound, for whoever unmutes it: the hour's lake (public/sounds/
//   ambiant, at its trim), the stamp at the seal's hit and the 終着 chord
//   at the recap, the app's own recipes (src/lib/audio/recipes.js, their
//   first voice, voices.js's default) at their own levels, rendered in
//   Chromium's OfflineAudioContext as scripts/measure-voices.mjs renders
//   them; lifted 6 dB as a whole, since a video plays alone. The seam
//   is the picture's.
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { voicesBundle } from '../voices-bundle.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(HERE, '../..')
const FPS = 30
const SEAM = 0.5
const RATE = 48000
const LIFT = 2 // +6 dB

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : fallback
}
const date = flag('--date', '2026-10-06')
const width = Number(flag('--width', '3840'))
const crf = flag('--crf', '17')
const [out, print = 'autumn-day'] = args
if (!out) {
  console.error('usage: node scripts/store-header/film.mjs OUT [print] [--date YYYY-MM-DD] [--width 3840]')
  process.exit(2)
}
const height = Math.round((width * 1646) / 3840 / 2) * 2
const hour = print.split('-')[1] === 'hanabi' ? 'night' : print.split('-')[1]
const file = (name) => path.join(out, name)

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8' })
  if (r.status) throw new Error(`${cmd} failed:\n${r.stderr}`)
  return r.stdout
}

run('python3', [path.join(HERE, 'today.py'), out, print, '--date', date])
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

// ── the frames ──
const page = await (await browser.newContext({ viewport: { width: 1184, height: 900 }, deviceScaleFactor: width / 1184 })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('file://' + file('today.html'))
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 })
const { LOOP, BEATS, WINDOW } = await page.evaluate(() => ({ LOOP: window.LOOP, BEATS: window.BEATS, WINDOW: window.WINDOW }))
const clip = { x: 0, y: WINDOW.top, width: WINDOW.width, height: WINDOW.height }
const frames = Math.round((LOOP + SEAM) * FPS)
const raw = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-vf', `scale=${width}:${height}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', file('.raw.mp4')],
{ stdio: ['pipe', 'inherit', 'inherit'] })
const started = Date.now()
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / FPS)
  const png = await page.screenshot({ clip, type: 'png' })
  if (!raw.stdin.write(png)) await new Promise((r) => raw.stdin.once('drain', r))
  if (i % FPS === 0) console.log(`frame ${i}/${frames}, ${Math.round((Date.now() - started) / 1000)} s`)
}
raw.stdin.end()
await new Promise((r) => raw.on('close', r))
if (errors.length) throw new Error(`the page failed: ${errors.join('; ')}`)

// ── the sound ──
const sound = await browser.newPage()
await sound.setContent('<!doctype html><html><body></body></html>')
await sound.addScriptTag({ content: await voicesBundle() })
const [wav, lake] = await sound.evaluate(async ([seconds, rate, cues]) => {
  const { VOICE_EVENTS, voiceOut, voiceLevel, trimFor } = globalThis.TsujiVoices
  const ctx = new OfflineAudioContext(2, Math.round(rate * seconds), rate)
  for (const [key, at] of cues) {
    const event = VOICE_EVENTS.find((e) => e.key === key)
    const variant = event.variants[0]
    ctx.suspend(at).then(() => { variant.play(ctx, voiceOut(ctx, ctx.destination, voiceLevel(event, variant))); ctx.resume() })
  }
  const buffer = await ctx.startRendering()
  const n = buffer.length, l = buffer.getChannelData(0), r = buffer.getChannelData(1)
  const bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer)
  const tag = (at, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(at + i, s.charCodeAt(i)) }
  tag(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); tag(8, 'WAVE'); tag(12, 'fmt '); dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 4, true)
  dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); tag(36, 'data'); dv.setUint32(40, n * 4, true)
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true)
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true)
  }
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return [btoa(s), trimFor('ambiance', 'lake')]
}, [LOOP + SEAM, RATE, [['card-stamp', BEATS.HIT], ['day-clear', BEATS.RECAP]]])
await browser.close()
writeFileSync(file('.sfx.wav'), Buffer.from(wav, 'base64'))
const { rev } = JSON.parse(readFileSync(path.join(FRONTEND, 'src/lib/audio/ambiance.json'), 'utf8'))
run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '30', '-t', String(LOOP + SEAM), '-i', path.join(FRONTEND, `public/sounds/ambiant/${rev}/${hour}.mp3`),
  '-i', file('.sfx.wav'), '-filter_complex',
  `[0:a]aresample=${RATE},aformat=channel_layouts=stereo,volume=${lake}[lake];[1:a]aformat=channel_layouts=stereo[fx];[lake][fx]amix=inputs=2:normalize=0:duration=first[m]`,
  '-map', '[m]', file('.mix.wav')])

// ── the loop: [SEAM, LOOP + SEAM) with its last SEAM crossfaded into [0, SEAM) ──
// (each of the two pieces read from the file again: an asplit into acrossfade stalls)
const end = LOOP + SEAM
run('ffmpeg', ['-loglevel', 'error', '-y', '-i', file('.raw.mp4'), '-i', file('.raw.mp4'), '-i', file('.mix.wav'), '-i', file('.mix.wav'),
  '-filter_complex',
  `[0:v]trim=start=${SEAM}:end=${end},setpts=PTS-STARTPTS[va];[1:v]trim=start=0:end=${SEAM},setpts=PTS-STARTPTS[vb];` +
  `[va][vb]xfade=transition=fade:duration=${SEAM}:offset=${LOOP - SEAM},format=yuv420p[v];` +
  `[2:a]atrim=start=${SEAM}:end=${end},asetpts=PTS-STARTPTS[aa];[3:a]atrim=start=0:end=${SEAM},asetpts=PTS-STARTPTS[ab];` +
  `[aa][ab]acrossfade=d=${SEAM}:c1=tri:c2=tri,volume=${LIFT}[a]`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-level', '5.1', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-c:a', 'aac', '-b:a', '256k', '-ar', String(RATE), '-ac', '2', '-movflags', '+faststart', '-t', String(LOOP),
  file(`today-${print}.mp4`)])
for (const name of ['.raw.mp4', '.sfx.wav', '.mix.wav', 'today.html']) rmSync(file(name), { force: true })
console.log(file(`today-${print}.mp4`), `${width} x ${height}, ${LOOP} s`)
