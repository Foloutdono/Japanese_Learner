#!/usr/bin/env node
// ── 撮影所 — npm run reel (plan 210) ───────────────────────────────────
// Turns a reel's script into a vertical film: the hook, the app played
// for real, the end card, with the app's own sounds.
//
//   npm run reel -- reel/reels/sign-photo.json                 → reel/out/sign-photo.mp4
//   npm run reel -- reel/reels/sign-photo.json --out ~/a.mp4
//   npm run reel -- reel/reels/sign-photo.json --preview       → plays in your browser
//   npm run reel -- reel/reels/sign-photo.json --still 6.5     → one frame, as PNG
//   npm run reel -- reel/reels/sign-photo.json --frames dir --every 15
//
// The steps: the script is checked (script.mjs); the app's backend code
// answers for its sentences, words and searches
// (backend/scripts/reel_fixtures.py, cached by content); a snap's photo
// is drawn; the director is filmed a frame at a time (capture.mjs) into
// ffmpeg; and the sound it recorded is laid under the picture, with the
// script's music if it names some.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, basename, extname, relative, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { normalize, requestOf, ScriptError } from './script.mjs'
import { startReelServer, REEL, REPO } from './server.mjs'
import { launchShell, steppedPage, dispatchInputs } from './capture.mjs'

const BOARD_W = 432
const BOARD_H = 768

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { args._.push(a); continue }
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) args[key] = true
    else { args[key] = next; i++ }
  }
  return args
}

async function loadScript(file) {
  if (/\.(mjs|js)$/.test(file)) return (await import(pathToFileURL(file).href)).default
  return JSON.parse(readFileSync(file, 'utf8'))
}

function fixtures(request, cacheDir) {
  // Keyed on the builder too: a change to what it answers is a new bundle.
  const builder = readFileSync(join(REPO, 'backend', 'scripts', 'reel_fixtures.py'))
  const hash = createHash('sha256').update(JSON.stringify(request)).update(builder).digest('hex').slice(0, 16)
  const out = join(cacheDir, `bundle-${hash}.json`)
  if (existsSync(out)) return JSON.parse(readFileSync(out, 'utf8'))
  const reqFile = join(cacheDir, `request-${hash}.json`)
  writeFileSync(reqFile, JSON.stringify(request))
  const python = process.env.REEL_PYTHON ?? 'python3'
  process.stdout.write('· asking the app’s backend code about the script’s sentences… ')
  const r = spawnSync(python, ['-m', 'scripts.reel_fixtures', reqFile, '--out', out], {
    cwd: join(REPO, 'backend'), encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  if (r.status !== 0) {
    console.error(`\n${r.stderr || r.error?.message}`)
    throw new Error(
      `backend/scripts/reel_fixtures.py failed. It needs the backend's Python packages ` +
      `(pip install -r backend/requirements.txt), no database. Set REEL_PYTHON to pick the interpreter.`)
  }
  console.log('done')
  return JSON.parse(readFileSync(out, 'utf8'))
}

/** Epoch seconds of `hh:mm` today in `timeZone`. */
function wallClock(hhmm, timeZone) {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map(p => [p.type, p.value]))
  let guess = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, m)
  for (let i = 0; i < 3; i++) {
    const seen = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(guess)).map(p => [p.type, p.value]))
    guess -= ((+seen.hour - h) * 60 + (+seen.minute - m)) * 60000
  }
  return guess / 1000
}

function ffmpeg(args, opts = {}) {
  const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'], ...opts })
  const done = new Promise((ok, ko) => proc.on('close', code => (code === 0 ? ok() : ko(new Error(`ffmpeg exited ${code}`)))))
  return { proc, done }
}

const VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i

/**
 * A video hook's footage, as the film plays it: its frames at the
 * film's rate and size (cover-cropped to 9:16), and its sound, cut once
 * by ffmpeg into the cache. The hook shows the frame of each film frame
 * from pictures already loaded, so nothing is decoded on the clock.
 */
function footage(src, beat, { cacheDir, width, height, fps }) {
  const start = Number(beat.start ?? 0)
  // The world keeps moving under the transition that follows the hook.
  const span = Math.min(40, (beat.duration ?? 34) + 6)
  const { size, mtimeMs } = statSync(src)
  const key = createHash('sha256').update(JSON.stringify([src, size, mtimeMs, start, span, width, height, fps])).digest('hex').slice(0, 12)
  const dir = `clip-${key}`
  const out = join(cacheDir, dir)
  if (!existsSync(join(out, 'clip.json'))) {
    mkdirSync(out, { recursive: true })
    const cut = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', src, '-t', String(span)]
    const v = spawnSync('ffmpeg', [...cut, '-vf', `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
      '-q:v', '3', join(out, '%05d.jpg')], { encoding: 'utf8' })
    if (v.status !== 0) throw new Error(`ffmpeg could not read ${beat.file}:\n${v.stderr || v.error?.message}`)
    // A clip without sound simply has none (ffmpeg refuses an empty output).
    const a = spawnSync('ffmpeg', [...cut, '-vn', '-ac', '2', '-ar', '48000', join(out, 'sound.wav')], { encoding: 'utf8' })
    const count = readdirSync(out).filter(f => f.endsWith('.jpg')).length
    if (!count) throw new Error(`${beat.file} has no frames from ${start}s`)
    writeFileSync(join(out, 'clip.json'), JSON.stringify({ count, sound: a.status === 0 && existsSync(join(out, 'sound.wav')) }))
  }
  const { count, sound } = JSON.parse(readFileSync(join(out, 'clip.json'), 'utf8'))
  return { dir, count, fps, seconds: count / fps, sound: sound ? `${dir}/sound.wav` : null }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = args._[0]
  if (!file) {
    console.log('usage: npm run reel -- <script.json> [--out file.mp4] [--preview] [--still seconds] [--frames dir --every n]')
    process.exit(1)
  }
  const scriptPath = resolve(file)
  const scriptDir = dirname(scriptPath)
  const name = basename(scriptPath, extname(scriptPath))
  let script
  try {
    script = normalize(await loadScript(scriptPath))
  } catch (err) {
    if (err instanceof ScriptError) { console.error(`✗ ${file}: ${err.message}`); process.exit(2) }
    throw err
  }
  if (args.fps) script.fps = Number(args.fps)
  // A smaller film, for a quick look: --width 540 is a quarter of the pixels.
  if (args.width) {
    script.width = Number(args.width)
    script.height = Math.round(script.width * 16 / 9)
  }
  const cacheDir = join(REEL, '.cache', name)
  mkdirSync(cacheDir, { recursive: true })

  const bundle = fixtures(requestOf(script), cacheDir)

  // The script's own media, beside it; served from the cache as copies,
  // and a video as its frames and its sound.
  const assets = { base: '', photos: {} }
  for (const [i, beat] of script.beats.entries()) {
    if (beat.kind !== 'hook' || !beat.file) continue
    const src = resolve(scriptDir, beat.file)
    if (!existsSync(src)) { console.error(`✗ ${file}: no such file ${beat.file}`); process.exit(2) }
    if (beat.style === 'video') {
      if (!VIDEO.test(src)) { console.error(`✗ ${file}: beat ${i + 1}: a video hook's file is a video (mp4, mov, webm…)`); process.exit(2) }
      process.stdout.write(`· cutting ${beat.file} into frames… `)
      beat.clip = footage(src, beat, { cacheDir, width: script.width, height: script.height, fps: script.fps })
      beat.duration ??= Math.min(beat.clip.seconds, 12)
      console.log(`${beat.clip.count} frames${beat.clip.sound ? ', with its sound' : ''}`)
      continue
    }
    const copy = `media-${beat.file.replace(/[^\w.-]/g, '_')}`
    copyFileSync(src, join(cacheDir, copy))
    beat.file = copy
  }
  // Which photo each snap hands to the app beat after it.
  const snaps = []
  script.beats.forEach((beat, i) => {
    if (beat.kind !== 'snap') return
    const hookIndex = script.beats.slice(0, i).map(b => b.kind).lastIndexOf('hook')
    const appIndex = script.beats.findIndex((b, j) => j > i && b.kind === 'app')
    if (hookIndex < 0 || appIndex < 0) return
    const hook = script.beats[hookIndex]
    if (hook.scene === 'media' && hook.style === 'photo') assets.photos[appIndex] = hook.file
    else snaps.push({ hookIndex, appIndex, file: `photo-${appIndex}.jpg` })
  })
  // The longest the film may run: a ceiling, not a length (the film ends
  // when its last beat does), and the sound's length is set from it.
  script.maxSeconds = Number(args.max ?? script.max ?? 150)
  writeFileSync(join(cacheDir, 'reel.json'), JSON.stringify({ script, bundle, assets }))

  const { server, origin } = await startReelServer({ roots: [cacheDir], hmr: Boolean(args.preview) })
  const directorUrl = q => `${origin}/__reel/director?reel=reel.json${q ? `&${q}` : ''}`

  if (args.preview) {
    for (const s of snaps) assets.photos[s.appIndex] = null
    console.log(`▶ preview: ${directorUrl()}\n  (open it in a desktop browser at 432×768, Ctrl-C to stop)`)
    return
  }

  const scale = script.width / BOARD_W
  const browser = await launchShell({ scale })
  const fps = script.fps
  const timezoneId = script.timezone ?? 'Asia/Tokyo'
  const initialVirtualTime = wallClock(script.clock ?? '12:30', timezoneId)
  const locale = script.lang === 'fr' ? 'fr-FR' : 'en-US'
  try {
    // ── The stills the snaps take ──
    for (const s of snaps) {
      const ctx = await browser.newContext({ viewport: { width: BOARD_W, height: BOARD_W * 4 / 3 }, deviceScaleFactor: scale, locale, timezoneId })
      const sp = await steppedPage(ctx, { fps, initialVirtualTime })
      await sp.page.goto(directorUrl(`photo=${s.hookIndex}`), { waitUntil: 'commit' })
      await sp.pump(() => sp.page.evaluate(() => window.__reel?.photoReady === true), { label: 'photo', max: 3000 })
      await sp.advance()
      writeFileSync(join(cacheDir, s.file), await sp.draw({ format: 'jpeg', quality: 92 }))
      assets.photos[s.appIndex] = s.file
      await ctx.close()
    }
    writeFileSync(join(cacheDir, 'reel.json'), JSON.stringify({ script, bundle, assets }))

    // ── The film ──
    const ctx = await browser.newContext({
      viewport: { width: BOARD_W, height: BOARD_H }, deviceScaleFactor: scale,
      hasTouch: true, isMobile: true, locale, timezoneId,
    })
    await ctx.addInitScript(() => { window.__REEL_RENDER__ = true })
    const sp = await steppedPage(ctx, { fps, initialVirtualTime })
    const { page, cdp } = sp
    const logs = []
    page.on('console', m => { if (m.type() === 'error') logs.push(m.text()) })
    page.on('pageerror', e => logs.push(e.message))
    await page.goto(directorUrl(), { waitUntil: 'commit' })
    process.stdout.write('· loading the app on the stage… ')
    await sp.pump(() => page.evaluate(() => Boolean(window.__reel?.ready || window.__reel?.error)), { label: 'director', max: 9000 })
    const boot = await page.evaluate(() => window.__reel.error)
    if (boot) throw new Error(`the director failed to start:\n${boot}`)
    console.log('ready')

    const outFile = resolve(args.out ?? join(REEL, 'out', `${name}.mp4`))
    mkdirSync(dirname(outFile), { recursive: true })
    const silent = join(cacheDir, 'picture.mp4')
    const still = args.still != null ? Number(args.still) : null
    const framesDir = args.frames ? resolve(args.frames) : null
    const every = Number(args.every ?? 15)
    if (framesDir) mkdirSync(framesDir, { recursive: true })
    const encoder = still == null
      ? ffmpeg(['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
        '-movflags', '+faststart', '-r', String(fps), silent])
      : null

    await page.evaluate(() => window.__reel.start())
    const max = Math.ceil((script.maxSeconds + 2) * fps)
    const began = Date.now()
    let frame = 0
    let t = 0
    for (; frame < max; frame++) {
      await sp.advance()
      const tick = await page.evaluate(() => window.__reel.tick())
      if (tick.error) throw new Error(`the reel stopped at ${tick.t.toFixed(2)}s:\n${tick.error}`)
      const pressed = dispatchInputs(cdp, tick.inputs)
      const jpeg = await sp.draw({ format: 'jpeg', quality: 94 })
      await pressed
      t = tick.t
      if (still != null && t >= still) {
        const png = join(REEL, 'out', `${name}-${still}s.png`)
        mkdirSync(dirname(png), { recursive: true })
        writeFileSync(png, await sp.draw({ format: 'png' }))
        console.log(`\n✓ ${relative(process.cwd(), png)}`)
        return
      }
      if (framesDir && frame % every === 0) writeFileSync(join(framesDir, `f${String(frame).padStart(5, '0')}-${t.toFixed(2)}s.jpg`), jpeg)
      if (encoder && !encoder.proc.stdin.write(jpeg)) await new Promise(r => encoder.proc.stdin.once('drain', r))
      if (frame % fps === 0) process.stdout.write(`\r· filming ${t.toFixed(1)}s (${((Date.now() - began) / 1000).toFixed(0)}s elapsed)   `)
      if (tick.done) break
    }
    console.log(`\r· filmed ${t.toFixed(1)}s in ${((Date.now() - began) / 1000).toFixed(0)}s, ${frame + 1} frames      `)
    if (!encoder) return
    encoder.proc.stdin.end()

    // What the app asked for and the stage could not answer (each one a
    // 404 the film showed): a new screen's requests, named, not guessed.
    const asked = await page.evaluate(() => [...new Set(document.querySelector('iframe')?.contentWindow?.__reelStage?.unhandled ?? [])])
    if (asked.length) {
      console.log(`  (the stage answered ${asked.length} request${asked.length > 1 ? 's' : ''} 404, unknown to it: ${asked.slice(0, 6).join(', ')}${asked.length > 6 ? ', …' : ''})`)
    }
    // The sound renders while the page's clock keeps running.
    await page.evaluate(() => window.__reel.mix())
    await sp.pump(() => page.evaluate(() => Boolean(window.__reel.sound || window.__reel.error)), { label: 'soundtrack', max: 3000 })
    const mixed = await page.evaluate(() => window.__reel.error ? { error: window.__reel.error } : window.__reel.sound)
    if (mixed.error) throw new Error(`the soundtrack failed:\n${mixed.error}`)
    const { wav, duration, clips = [] } = mixed
    const sound = join(cacheDir, 'sound.wav')
    writeFileSync(sound, Buffer.from(wav, 'base64'))
    await encoder.done

    // The film's own sound, a video hook's sound where its footage
    // played (faded out as the app takes over), and the music under all.
    const inputs = ['-i', silent, '-i', sound]
    const filters = []
    const mix = ['[1:a]']
    clips.forEach((c, j) => {
      inputs.push('-i', join(cacheDir, c.file))
      const lasts = Math.max(0.1, (c.until ?? duration) - c.at)
      const at = Math.round(c.at * 1000)
      filters.push(`[${2 + j}:a]atrim=0:${(lasts + 0.6).toFixed(3)},afade=t=out:st=${lasts.toFixed(3)}:d=0.6,volume=${c.volume ?? 1},adelay=${at}|${at}[c${j}]`)
      mix.push(`[c${j}]`)
    })
    const music = script.music ? resolve(scriptDir, script.music.file ?? script.music) : null
    if (music) {
      inputs.push('-i', music)
      filters.push(`[${2 + clips.length}:a]volume=${script.music.volume ?? 0.22},afade=t=out:st=${Math.max(0, duration - 1.2)}:d=1.2[m]`)
      mix.push('[m]')
    }
    const audio = mix.length > 1
      ? ['-filter_complex', [...filters, `${mix.join('')}amix=inputs=${mix.length}:duration=first:normalize=0[a]`].join(';'), '-map', '0:v', '-map', '[a]']
      : ['-map', '0:v', '-map', '1:a']
    await ffmpeg(['-y', ...inputs, ...audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', outFile]).done
    if (logs.length) console.log(`  (the page logged ${logs.length} error${logs.length > 1 ? 's' : ''}; first: ${logs[0].slice(0, 200)})`)
    console.log(`✓ ${relative(process.cwd(), outFile)} — ${duration.toFixed(1)}s, ${script.width}×${script.height}, ${fps} fps`)
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch(err => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
