// ── 動く看板 — the moving header (plan 308) ───────────────────────────
//
//   cd frontend && node scripts/store-header/film.mjs OUT [print] [--page today|queue] [--lang en|fr|es]
//                                                     [--date YYYY-MM-DD] [--width 3840] [--crf 17]
//
// Films one of the header's pages for App Store Connect: today.py's (the day's
// run, the owner's pick E: OUT/today-<print>.mp4) or queue.py's (the day's
// queue card by card with its captions, the owner's pick I of round 7:
// OUT/queue-<print>-<lang>.mp4, one per localization since its captions are
// words). 3840 x 1646 (21:9), LOOP seconds that loop without a seam, 30 fps,
// H.264 and AAC. Needs Python (the print's modules), Chromium and ffmpeg.
//
// - The frames are stills, one at a time: the page's render(t) sets the
//   print's own animations and its own keyframes to t, so a frame never
//   depends on how fast the machine shot the last one. They are filmed in
//   parts of a few seconds, each kept on disk once whole (OUT/.parts-*), so
//   a run cut short goes on from the last whole part.
// - The seam: LOOP + SEAM seconds are filmed, and the loop is
//   [SEAM, LOOP + SEAM) with its last SEAM crossfaded into [0, SEAM), so
//   it ends on the frame it begins with (the print's motion has its own
//   periods; the page's is the loop's).
// - The sound, for whoever unmutes it: the hour's lake (public/sounds/
//   ambiant, at its trim) and the page's cues (window.SOUNDS, or today.py's
//   stamp and 終着 chord at its BEATS), the app's own recipes (src/lib/audio/
//   recipes.js, their first voice, voices.js's default) at their own levels,
//   rendered in Chromium's OfflineAudioContext as scripts/measure-voices.mjs
//   renders them; lifted 6 dB as a whole, since a video plays alone. The
//   seam is the picture's.
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { voicesBundle } from '../voices-bundle.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(HERE, '../..')
const FPS = 30
const SEAM = 0.5
const PART = 3                      // seconds a part
const RATE = 48000
const LIFT = 2 // +6 dB
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : fallback
}
const date = flag('--date', '2026-10-06')
const width = Number(flag('--width', '3840'))
const crf = flag('--crf', '17')
const which = flag('--page', 'today')
const lang = flag('--lang', 'en')
const [out, print = 'autumn-day'] = args
if (!out || !['today', 'queue'].includes(which) || !['en', 'fr', 'es'].includes(lang)) {
  console.error('usage: node scripts/store-header/film.mjs OUT [print] [--page today|queue] [--lang en|fr|es] [--date YYYY-MM-DD] [--width 3840]')
  process.exit(2)
}
const height = Math.round((width * 1646) / 3840 / 2) * 2
const hour = print.split('-')[1] === 'hanabi' ? 'night' : print.split('-')[1]
const name = which === 'today' ? `today-${print}` : `queue-${print}-${lang}`
const file = (n) => path.join(out, n)
const parts = file(`.parts-${name}-${width}`)

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8' })
  if (r.status) throw new Error(`${cmd} failed:\n${r.stderr}`)
  return r.stdout
}

run('python3', [path.join(HERE, `${which}.py`), out, print, '--date', date])
const url = 'file://' + file(`${which}.html`) + (which === 'queue' ? `?lang=${lang}&view=film&live=0` : '')
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

// ── the frames, part by part ──
const page = await (await browser.newContext({ viewport: { width: 1184, height: 900 }, deviceScaleFactor: width / 1184 })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(url)
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 })
const { LOOP, WINDOW, SOUNDS } = await page.evaluate(() => ({
  LOOP: window.LOOP, WINDOW: window.WINDOW,
  SOUNDS: window.SOUNDS ?? [['card-stamp', window.BEATS.HIT], ['day-clear', window.BEATS.RECAP]],
}))
// The clip on whole device pixels, `height` rows of them: one starting on a fractional pixel comes out
// two rows short, and stretched back it reads as non-square pixels, which App Store Connect refuses as a
// file of the wrong size.
const dpr = width / 1184
const clip = { x: 0, y: Math.floor(WINDOW.top * dpr) / dpr, width: WINDOW.width, height: height / dpr }
const frames = Math.round((LOOP + SEAM) * FPS)
const per = PART * FPS
mkdirSync(parts, { recursive: true })
const started = Date.now()
for (let p = 0; p * per < frames; p++) {
  const part = path.join(parts, `${String(p).padStart(3, '0')}.mp4`)
  if (existsSync(part)) continue
  const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${width}:${height}:flags=lanczos:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p`,
    ...BT709, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-f', 'mp4', part + '.tmp'],
  { stdio: ['pipe', 'inherit', 'inherit'] })
  for (let i = p * per; i < Math.min(frames, (p + 1) * per); i++) {
    await page.evaluate((t) => window.render(t), i / FPS)
    const jpg = await page.screenshot({ clip, type: 'jpeg', quality: 95 })
    if (!enc.stdin.write(jpg)) await new Promise((r) => enc.stdin.once('drain', r))
  }
  enc.stdin.end()
  await new Promise((r) => enc.on('close', r))
  renameSync(part + '.tmp', part)
  console.log(`${name}: part ${p + 1}/${Math.ceil(frames / per)}, ${Math.round((Date.now() - started) / 1000)} s`)
}
if (errors.length) throw new Error(`the page failed: ${errors.join('; ')}`)
const list = readdirSync(parts).filter((f) => f.endsWith('.mp4')).sort().map((f) => `file '${path.join(parts, f)}'`).join('\n')
writeFileSync(path.join(parts, 'list.txt'), list + '\n')
run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(parts, 'list.txt'), '-c', 'copy', file(`.${name}.raw.mp4`)])

// ── the sound ──
const sound = await browser.newPage()
await sound.setContent('<!doctype html><html><body></body></html>')
await sound.addScriptTag({ content: await voicesBundle() })
const [wav, lake] = await sound.evaluate(async ([seconds, rate, cues]) => {
  const { VOICE_EVENTS, voiceOut, voiceLevel, trimFor } = globalThis.TsujiVoices
  const ctx = new OfflineAudioContext(2, Math.round(rate * seconds), rate)
  for (const [key, at] of [...cues].sort((a, b) => a[1] - b[1])) {
    const event = VOICE_EVENTS.find((e) => e.key === key)
    if (!event) throw new Error(`no sound ${key}`)
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
}, [LOOP + SEAM, RATE, SOUNDS])
await browser.close()
writeFileSync(file(`.${name}.sfx.wav`), Buffer.from(wav, 'base64'))
const { rev } = JSON.parse(readFileSync(path.join(FRONTEND, 'src/lib/audio/ambiance.json'), 'utf8'))
run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '30', '-t', String(LOOP + SEAM), '-i', path.join(FRONTEND, `public/sounds/ambiant/${rev}/${hour}.mp3`),
  '-i', file(`.${name}.sfx.wav`), '-filter_complex',
  `[0:a]aresample=${RATE},aformat=channel_layouts=stereo,volume=${lake}[lake];[1:a]aformat=channel_layouts=stereo[fx];[lake][fx]amix=inputs=2:normalize=0:duration=first[m]`,
  '-map', '[m]', file(`.${name}.mix.wav`)])

// ── the loop: [SEAM, LOOP + SEAM) with its last SEAM crossfaded into [0, SEAM) ──
// (each of the two pieces read from the file again: an asplit into acrossfade stalls)
const end = LOOP + SEAM
const raw = file(`.${name}.raw.mp4`), mix = file(`.${name}.mix.wav`)
run('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-i', raw, '-i', mix, '-i', mix,
  '-filter_complex',
  `[0:v]trim=start=${SEAM}:end=${end},setpts=PTS-STARTPTS[va];[1:v]trim=start=0:end=${SEAM},setpts=PTS-STARTPTS[vb];` +
  `[va][vb]xfade=transition=fade:duration=${SEAM}:offset=${LOOP - SEAM},format=yuv420p,setsar=1[v];` +
  `[2:a]atrim=start=${SEAM}:end=${end},asetpts=PTS-STARTPTS[aa];[3:a]atrim=start=0:end=${SEAM},asetpts=PTS-STARTPTS[ab];` +
  `[aa][ab]acrossfade=d=${SEAM}:c1=tri:c2=tri,volume=${LIFT}[a]`,
  '-map', '[v]', '-map', '[a]', ...BT709, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-level', '5.1', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-c:a', 'aac', '-b:a', '256k', '-ar', String(RATE), '-ac', '2', '-movflags', '+faststart', '-t', String(LOOP),
  file(`${name}.mp4`)])
// what App Store Connect reads: the size, in square pixels
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,sample_aspect_ratio', '-of', 'json', file(`${name}.mp4`)])).streams[0]
if (probe.width !== width || probe.height !== height || !['1:1', undefined, 'N/A', '0:1'].includes(probe.sample_aspect_ratio)) {
  throw new Error(`the film is ${probe.width} x ${probe.height} at ${probe.sample_aspect_ratio}, not ${width} x ${height} in square pixels`)
}
for (const n of [raw, mix, file(`.${name}.sfx.wav`), file(`${which}.html`)]) rmSync(n, { force: true })
rmSync(parts, { recursive: true, force: true })
console.log(file(`${name}.mp4`), `${width} x ${height}, ${LOOP} s`)
