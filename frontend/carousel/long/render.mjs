// ── 長編 — a long video, made (plan 233) ───────────────────────────
// node carousel/long/render.mjs --kind vocab|kanji|grammar|quiz [options]
//
//   --level N5        the level (N5 … N1)
//   --part 1          which part of the level's deck, a quiz's deal
//   --theme food      a theme's words (vocab), instead of a level's part
//   --point 〜てください  the grammar point (grammar)
//   --ids a,b,c       exact items: words as 写真::しゃしん, kanji as 写,
//                     quiz questions as sentence:N5.12, word:写真::しゃしん, kanji:写
//   --count 40        items in a part
//   --lang en|fr      the language on the screen
//   --out DIR         where the video goes (carousel/long/out/ by default)
//   --seconds 60      make only the first minute (to look at a draft)
//   --stills 12,40    draw those seconds as PNGs, and no video
//   --format short    the short: 9:16, under a minute (YouTube Shorts, Reels, TikTok)
//   --carousel RECIPE a carousel of the studio as a short video, voiced: the
//                     studio's "Copy the command" writes the recipe (short.js)
//
// Writes <name>.mp4, <name>.txt (the title, then the description with
// its chapters and the voice's credit) and <name>.jpg (a thumbnail).
// It needs the voice engine (VOICEVOX_URL, CLAUDE.md "Speech"), the
// backend's Python (numpy), ffmpeg, and Playwright's Chromium; the
// voices are kept in carousel/long/cache/, so making a video again, or
// one that shares lines with another, waits only for what is new.
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { SITE_ORIGIN } from '../../landing/config.mjs'
import { FPS, TALL, WIDE, cueKey, describe, fitShort, longPlan, timeline } from '../long.js'
import { fromRecipe, shortTimeline } from '../short.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONT = resolve(HERE, '../..')
const BACKEND = resolve(FRONT, '../backend')
const BANK = resolve(HERE, '../bank')

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]]] : a), []))
const recipe = args.carousel ? fromRecipe(String(args.carousel)) : null
const kind = args.kind || 'vocab'
const lang = recipe?.lang || args.lang || 'en'
const opts = {
  lang, level: args.level || 'N5', part: Number(args.part || 1), theme: args.theme || null, point: args.point || null,
  ids: args.ids ? String(args.ids).split(',') : null, count: args.count ? Number(args.count) : null,
  format: args.format === 'short' ? 'short' : 'long',
}
const OUT = resolve(args.out || join(HERE, 'out'))
const CACHE = join(HERE, 'cache')
const WORK = join(OUT, '.work')
for (const d of [OUT, CACHE, WORK, join(WORK, 'sfx')]) mkdirSync(d, { recursive: true })
const python = existsSync(join(BACKEND, '.venv/bin/python')) ? join(BACKEND, '.venv/bin/python') : 'python3'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ── A page to draw on: the frontend served as the studio is ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  const path = join(FRONT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!path.startsWith(FRONT) || !existsSync(path) || statSync(path).isDirectory()) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' })
  createReadStream(path).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const ROOT = `http://127.0.0.1:${server.address().port}`
const css = []
for (const [pkg, weights] of [['noto-sans-jp', [400, 500, 700, 900]], ['noto-serif-jp', [600, 700, 900]], ['space-grotesk', [500, 700]]]) {
  for (const w of weights) {
    const file = join(FRONT, `node_modules/@fontsource/${pkg}/${w}.css`)
    if (existsSync(file)) css.push(readFileSync(file, 'utf8').replace(/url\(\.\/files\//g, `url(${ROOT}/node_modules/@fontsource/${pkg}/files/`))
  }
}
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
const page = await browser.newPage()
page.on('pageerror', e => log('page:', e.message))
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: css.join('\n') }))
await page.goto(`${ROOT}/carousel/index.html`)
await page.addStyleTag({ content: css.join('\n') })
// ── Lines voiced and measured: how long each lasts ──
function voiceAll(cues) {
  writeFileSync(join(WORK, 'cues.json'), JSON.stringify(cues))
  const voiced = spawnSync(python, ['-m', 'scripts.long_video_audio', 'voice', join(WORK, 'cues.json'), '--cache', CACHE, '--out', join(WORK, 'durs.json')], { cwd: BACKEND, stdio: 'inherit' })
  if (voiced.status !== 0) log('some lines could not be voiced: they are timed by a guess and left unsaid')
  const { durs } = JSON.parse(readFileSync(join(WORK, 'durs.json'), 'utf8'))
  return c => durs[cueKey(c)]
}
const site = lang === 'en' ? `${SITE_ORIGIN}/en` : SITE_ORIGIN
const banks = {}
for (const f of readdirSync(BANK)) if (f.endsWith('.json')) banks[f] = JSON.parse(readFileSync(join(BANK, f), 'utf8'))
const fontsFor = async text => page.evaluate(async text => {
  const W = await import('/carousel/draw.js')
  await Promise.all(W.FONT_FACES.map(([fam, w]) => document.fonts.load(W.font(w, 40, fam), text)))
  await document.fonts.ready
}, text)
const canvasOf = size => page.evaluate(size => {
  const c = document.createElement('canvas')
  c.width = size.w
  c.height = size.h
  window.__ctx = c.getContext('2d')
  window.__canvas = c
}, size)

let tl, slug, SIZE, pageText, thumbAt
if (recipe) {
  // ── A carousel of the studio, standing, its line voiced ──
  const made = await page.evaluate(async st => {
    const S = await import('/carousel/short.js')
    const W = await import('/carousel/draw.js')
    const fetchJson = name => fetch(`/carousel/bank/${name}`).then(r => { if (!r.ok) throw new Error(name); return r.json() })
    const { pl, slides } = await S.carouselShort(st, fetchJson)
    const { sampleText } = await import('/carousel/sources.js')
    await Promise.all(W.FONT_FACES.map(([fam, w]) => document.fonts.load(W.font(w, 40, fam), sampleText(pl))))
    await document.fonts.ready
    const c = document.createElement('canvas')
    c.width = 1080
    c.height = 1920
    window.__ctx = c.getContext('2d')
    window.__canvas = c
    window.__short = S
    window.__slides = slides
    const counts = slides.map(sl => S.chars(sl, window.__ctx))
    return { counts, keys: slides.map(sl => sl.key), spoken: S.spokenLine(pl), page: null, id: pl.id }
  }, recipe)
  const slides = made.keys.map(key => ({ key }))
  const draft = shortTimeline(slides, made.counts, made.spoken)
  const dur = voiceAll(draft.cues)
  tl = shortTimeline(slides, made.counts, made.spoken, dur)
  SIZE = TALL
  slug = ['short', recipe.source, recipe.id, recipe.type, lang].join('-').replace(/[^\p{L}\p{N}-]+/gu, '')
  pageText = await page.evaluate(async ({ st, site, voiced }) => {
    const S = window.__short
    const fetchJson = name => fetch(`/carousel/bank/${name}`).then(r => r.json())
    const { pl } = await S.carouselShort(st, fetchJson)
    return S.shortPage(pl, st.type, st.picks, site, voiced)
  }, { st: recipe, site, voiced: tl.cues.length > 0 })
  await page.evaluate(tl => { window.__draw = t => window.__short.drawShortFrame(window.__ctx, window.__slides, tl, t) }, tl)
  thumbAt = 0.2
  log(`${pageText.title}: ${made.keys.length} slides, ${tl.seconds.toFixed(1)} s${made.spoken ? `, says ${made.spoken}` : ''}`)
} else {
  // ── A long video, or its short: the plan, its lines voiced, the timeline ──
  let plan = longPlan(kind, banks, opts)
  slug = [...(opts.format === 'short' ? ['short'] : []), kind, opts.theme || opts.level, kind === 'grammar' ? plan.point : opts.ids ? 'pick' : `part${opts.part}`, lang].join('-').replace(/[^\p{L}\p{N}-]+/gu, '')
  log(`${plan.title}: ${plan.items.length} items`)
  const dur = voiceAll(timeline(plan).cues)
  // A short holds under its minute on the lines as they are said.
  if (opts.format === 'short') plan = fitShort(plan, dur)
  tl = timeline(plan, dur)
  SIZE = opts.format === 'short' ? TALL : WIDE
  await fontsFor(JSON.stringify(plan).slice(0, 20000))
  await canvasOf(SIZE)
  await page.evaluate(async ({ plan, tl }) => {
    const L = await import('/carousel/long.js')
    window.__draw = t => L.drawLong(window.__ctx, plan, tl, t)
  }, { plan, tl })
  pageText = describe(plan, tl, site, banks['index.json']?.figures)
  thumbAt = opts.format === 'short' ? 3.4 : 4.5
  log(`${(tl.seconds / 60).toFixed(1)} min, ${tl.cues.length} lines, ${tl.sfx.length} sounds`)
}
const seconds = Math.min(tl.seconds, Number(args.seconds) || Infinity)

if (args.stills) {
  for (const t of String(args.stills).split(',').map(Number)) {
    const url = await page.evaluate(t => { window.__draw(t); return window.__canvas.toDataURL('image/png') }, t)
    writeFileSync(join(OUT, `${slug}-${t}.png`), Buffer.from(url.split(',')[1], 'base64'))
  }
  log(`wrote ${String(args.stills).split(',').length} still(s) to ${OUT}`)
  await browser.close()
  server.close()
  process.exit(0)
}

// ── The app's sounds, one WAV each ──
const keys = [...new Set(tl.sfx.map(s => s.key))]
for (const key of keys) {
  const b64 = await page.evaluate(async key => {
    const snd = await import('/carousel/sound.js')
    await snd.loadVoices('/')
    const mix = await snd.eventAudio(key)
    if (!mix) return null
    const bytes = new Uint8Array(snd.wav(mix))
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }, key)
  if (b64) writeFileSync(join(WORK, 'sfx', `${key}.wav`), Buffer.from(b64, 'base64'))
  else log(`no app sound named ${key}`)
}
writeFileSync(join(WORK, 'timeline.json'), JSON.stringify({ ...tl, seconds }))
const mixed = spawnSync(python, ['-m', 'scripts.long_video_audio', 'mix', join(WORK, 'timeline.json'), '--cache', CACHE, '--sfx', join(WORK, 'sfx'), '--out', join(WORK, 'mix.wav')], { cwd: BACKEND, stdio: 'inherit' })
if (mixed.status !== 0) throw new Error('the mix failed')

// ── YouTube's loudness, by one gain for the whole: a dynamic leveller would
// lift the bed of music back up to the voice between two lines ──
const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', join(WORK, 'mix.wav'), '-af', 'loudnorm=I=-16:TP=-1.5:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
const loud = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{')))
const gain = Math.min(-16 - Number(loud.input_i), -1.5 - Number(loud.input_tp))
log(`loudness ${loud.input_i} LUFS, peak ${loud.input_tp} dBTP: ${gain.toFixed(1)} dB`)

// ── The frames, each still drawn once, into ffmpeg ──
const mp4 = join(OUT, `${slug}.mp4`)
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', join(WORK, 'mix.wav'),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', mp4], { stdio: ['pipe', 'inherit', 'inherit'] })
const write = buf => new Promise(r => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)))
const frames = Math.round(seconds * FPS)
let last = null
let drawn = 0
const BATCH = 60
for (let f = 0; f < frames; f += BATCH) {
  const out = await page.evaluate(({ from, to, fps, prev }) => {
    const res = []
    let key = prev
    for (let i = from; i < to; i++) {
      const k = window.__draw(i / fps)
      if (k === key) { res.push(null); continue }
      key = k
      res.push(window.__canvas.toDataURL('image/jpeg', 0.93))
    }
    return { res, key }
  }, { from: f, to: Math.min(frames, f + BATCH), fps: FPS, prev: last?.key ?? null })
  for (const url of out.res) {
    if (url) { last = { buf: Buffer.from(url.split(',')[1], 'base64'), key: out.key }; drawn++ }
    await write(last.buf)
  }
  last.key = out.key
  if ((f / BATCH) % 50 === 0) log(`frame ${f}/${frames} (${drawn} drawn)`)
}
ff.stdin.end()
await new Promise((r, j) => ff.on('close', code => (code === 0 ? r() : j(new Error(`ffmpeg exited ${code}`)))))

// ── The thumbnail, the title and the description ──
const thumb = await page.evaluate(t => { window.__draw(t); return window.__canvas.toDataURL('image/jpeg', 0.92) }, thumbAt)
writeFileSync(join(OUT, `${slug}.jpg`), Buffer.from(thumb.split(',')[1], 'base64'))
const { title, description, tags } = pageText
writeFileSync(join(OUT, `${slug}.txt`), `TITLE\n${title}\n\nDESCRIPTION\n${description}\n\nTAGS\n${tags}\n`)
await browser.close()
server.close()
log(`wrote ${mp4} (${(seconds / 60).toFixed(1)} min, ${drawn} of ${frames} frames drawn)`)
