// ── `npm run ad`: the 30-second practice ad, rendered ────────────
// Builds the ad's page (practice30/page.mjs), steps it frame by frame
// in Chromium -- each frame a seek to n / fps, so the timing is exact
// whatever the machine's speed -- and pipes the frames to ffmpeg. The
// sound is rendered in the same page by score.js in an
// OfflineAudioContext, on the app's own recipes (src/lib/audio), as
// two stems: the music and the effects. Two files come out of it:
//
//   ads/out/tsuji-practice-30s.mp4       music and effects
//   ads/out/tsuji-practice-30s-sfx.mp4   effects only, to lay a track
//                                         from the platform's library
//
//   node ads/render.mjs                     both videos
//   node ads/render.mjs --still 1.4,6.9     those moments as PNGs, in ads/out/stills/
//   node ads/render.mjs --sheet             one still a second, as a contact sheet
//   node ads/render.mjs --audio             the two stems and their mix only, as WAVs
//   node ads/render.mjs --fps 60            a smoother cut (default 30)
//   node ads/render.mjs --jobs 4            pages capturing at once (default 3)
//
// Needs ffmpeg on the PATH. Chromium comes from Playwright; where its
// own download is missing, point CHROMIUM_PATH at a Chromium binary.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { voicesBundle } from '../scripts/voices-bundle.mjs'
import { adPage } from './practice30/page.mjs'

const W = 432, H = 768, SCALE = 2.5   // 1080 × 1920
const SECONDS = 30
const NAME = 'tsuji-practice-30s'

const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i < 0 ? null : (args[i + 1] ?? '') }
const fps = Number(flag('--fps') ?? 30)
const out = fileURLToPath(new URL('./out/', import.meta.url))
mkdirSync(out, { recursive: true })

function run(cmd, argv, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', d => { err += d })
    child.on('close', code => (code ? reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`)) : resolve()))
    if (input) input(child.stdin)
  })
}

async function openAd(browser) {
  const html = join(out, 'ad.html')
  writeFileSync(html, adPage())
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })
  page.on('pageerror', e => { throw e })
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' })
  // Every glyph the ad will ever show, typed text included, loaded
  // before the first frame: a font that arrives mid-render would change
  // a frame's look from one run to the next.
  await page.evaluate(async () => {
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)).join('')
    const text = document.body.textContent + range(0x3041, 0x3096) + range(0x30a1, 0x30fa) + '0123456789:,/→·…’“”✓日本行駅前友会。、'
    const faces = ['500 16px "Noto Sans JP"', '700 16px "Noto Sans JP"', '900 16px "Noto Serif JP"', '500 16px "Space Grotesk"', '700 16px "Space Grotesk"']
    await Promise.all(faces.map(f => document.fonts.load(f, text)))
    await document.fonts.ready
  })
  return page
}

const shot = (page, t) => page.evaluate(t => window.seek(t), t).then(() => page.screenshot({ type: 'png' }))

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await openAd(browser)

const stills = flag('--still')
if (stills !== null || args.includes('--sheet')) {
  const dir = join(out, 'stills')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const times = stills ? stills.split(',').map(Number) : Array.from({ length: SECONDS }, (_, i) => i + 0.5)
  for (const t of times) writeFileSync(join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), await shot(page, t))
  if (!stills) {
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', join(dir, '*.png'),
      '-vf', 'scale=270:480,tile=10x3:padding=6:color=black', join(out, 'sheet.png')])
    console.log('wrote ads/out/sheet.png')
  }
  console.log(`wrote ${times.length} stills to ads/out/stills/`)
  await browser.close()
  process.exit(0)
}

// ── The sound: two stems, rendered offline in the page ────────
await page.addScriptTag({ content: await voicesBundle() })
await page.addScriptTag({ path: fileURLToPath(new URL('./practice30/score.js', import.meta.url)) })
const stems = await page.evaluate(async () => window.renderScore())
for (const [name, b64] of Object.entries(stems)) writeFileSync(join(out, `${name}.wav`), Buffer.from(b64, 'base64'))
console.log('rendered the music and effects stems')
if (args.includes('--audio')) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, 'music.wav'), '-i', join(out, 'sfx.wav'),
    '-filter_complex', '[0:a][1:a]amix=inputs=2:weights=1 0.8:normalize=0,loudnorm=I=-14:TP=-2.0:LRA=9,aresample=48000', join(out, 'mix.wav')])
  console.log('wrote ads/out/music.wav, sfx.wav and mix.wav')
  await browser.close()
  process.exit(0)
}

// ── The picture ───────────────────────────────────────────────
// Several pages capture at once, each taking every jobs-th frame; the
// frames still reach ffmpeg in order, a few ahead at most.
const silent = join(out, `${NAME}-picture.mp4`)
const frames = SECONDS * fps
const jobs = Math.max(1, Number(flag('--jobs') ?? 3))
const pages = [page, ...await Promise.all(Array.from({ length: jobs - 1 }, () => openAd(browser)))]
const chains = pages.map(() => Promise.resolve())
const shots = []
const schedule = n => {
  if (n >= frames || shots[n]) return
  const k = n % jobs
  shots[n] = chains[k] = chains[k].then(() => shot(pages[k], n / fps))
}
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), silent],
async stdin => {
  for (let n = 0; n < frames; n++) {
    for (let a = n; a < n + jobs * 2; a++) schedule(a)
    const png = await shots[n]
    shots[n] = null
    if (!stdin.write(png)) await new Promise(r => stdin.once('drain', r))
    if (n % fps === 0) process.stdout.write(`\rframe ${n}/${frames}`)
  }
  stdin.end()
})
process.stdout.write(`\rframe ${frames}/${frames}\n`)
await browser.close()

// ── The two cuts: the picture with each mix, at the platforms'
// loudness (-14 LUFS integrated) under a -2 dBTP ceiling, since the AAC
// encode overshoots a -1 one ─────────────────────────────────
const master = 'loudnorm=I=-14:TP=-2.0:LRA=9,aresample=48000'
async function mux(file, filter, inputs) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...inputs.flatMap(i => ['-i', i]),
    '-filter_complex', `${filter}${master}[a]`, '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(SECONDS), '-movflags', '+faststart', join(out, file)])
  console.log(`wrote ads/out/${file}`)
}
await mux(`${NAME}.mp4`, '[1:a][2:a]amix=inputs=2:weights=1 0.8:normalize=0,', [join(out, 'music.wav'), join(out, 'sfx.wav')])
await mux(`${NAME}-sfx.mp4`, '[1:a]', [join(out, 'sfx.wav')])
rmSync(silent)
