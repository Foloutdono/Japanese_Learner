// ── 映像 — the landing page's footage, filmed (plan 283) ─────────
// node landing/footage/film.mjs [scene …] [--phone|--desk] [--look] [--build]
//
//   scene      aujourdhui kana vocabulaire kanji grammaire pratique
//              analyseur examen (all eight by default): config.mjs's CLIPS
//   --phone    the phone's clips only (1080×2340); --desk, the desk's (1440×900)
//   --look     film nothing: a screenshot at each of the scene's looks, in
//              out/looks/, and what can be pressed there, to write a scene
//   --build    build the app again (once built, it is kept in .build/)
//
// Writes out/<id>.mp4 and out/<id>.jpg (out/<id>-desk.* for the desk),
// which go up to the landing bucket by those names (../README.md,
// "Footage"). Each clip is filmed on the learner scripts/footage_learner.py
// keeps, put back as kept before every clip, on an API this script starts
// for it (DEV_USER_ID, on its own port) and the app built for it
// (mode `footage`: no Supabase project, no service worker), served here.
//
// It needs FOOTAGE_DATABASE_URL (a local database: the backend script
// says which), the backend's Python with its requirements (FOOTAGE_PYTHON,
// or backend/.venv, or python3), ffmpeg and Playwright's Chromium.
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, openSync, statSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLIPS } from '../config.mjs'
import { open } from './browser.mjs'
import { encode, roll, still } from './capture.mjs'
import { hand } from './hand.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONT = resolve(HERE, '../..')
const BACKEND = resolve(FRONT, '../backend')
const BUILD = join(HERE, '.build')
const OUT = join(HERE, 'out')
const USER = 'footage-learner'
const API_PORT = Number(process.env.FOOTAGE_API_PORT || 8131)
const WEB_PORT = Number(process.env.FOOTAGE_WEB_PORT || 5199)
const WEB = `http://127.0.0.1:${WEB_PORT}`
const MAX_BYTES = 3e6

const argv = process.argv.slice(2)
const flags = new Set(argv.filter(a => a.startsWith('--')))
const named = argv.filter(a => !a.startsWith('--'))
const scenes = named.length ? named : CLIPS.map(c => c.id)
const forms = flags.has('--phone') ? ['phone'] : flags.has('--desk') ? ['desk'] : ['phone', 'desk']
const looking = flags.has('--look')
const db = process.env.FOOTAGE_DATABASE_URL
if (!db) {
  console.error('FOOTAGE_DATABASE_URL is unset. See backend/scripts/footage_learner.py.')
  process.exit(1)
}
const python = process.env.FOOTAGE_PYTHON || (existsSync(join(BACKEND, '.venv/bin/python')) ? join(BACKEND, '.venv/bin/python') : 'python3')
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
mkdirSync(OUT, { recursive: true })

// ── The app, built for the footage ──
if (flags.has('--build') || !existsSync(join(BUILD, 'index.html'))) {
  log('building the app (mode footage)')
  const b = spawnSync('npx', ['vite', 'build', '--mode', 'footage', '--outDir', BUILD, '--emptyOutDir'], { cwd: FRONT, stdio: 'inherit' })
  if (b.status !== 0) process.exit(b.status ?? 1)
}

// ── Served as Vercel serves it: the files, the app for any other path,
// and /api, /kanjivg, /exam-audio handed to the API ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' }
const web = createServer((req, res) => {
  if (/^\/(api|kanjivg|exam-audio)(\/|$)/.test(req.url)) {
    const up = request({ host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers }, r => {
      res.writeHead(r.statusCode, r.headers)
      r.pipe(res)
    })
    up.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(up)
    return
  }
  let path = join(BUILD, decodeURIComponent(new URL(req.url, WEB).pathname))
  if (!path.startsWith(BUILD) || !existsSync(path) || statSync(path).isDirectory()) path = join(BUILD, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' })
  createReadStream(path).pipe(res)
})
await new Promise(r => web.listen(WEB_PORT, '127.0.0.1', r))

// ── The learner put back as kept, and an API on it ──
const env = { ...process.env, DATABASE_URL: db, DEV_USER_ID: USER, FOOTAGE_DATABASE_URL: db }
let api = null
async function freshApi() {
  if (api) { api.kill(); await new Promise(r => api.once('exit', r)) }
  const r = spawnSync(python, ['-m', 'scripts.footage_learner', '--restore', '--yes'], { cwd: BACKEND, env, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`the learner could not be restored:\n${r.stderr || r.stdout}`)
  // Its log goes to out/api.log: where a scene that stopped looks first.
  const apiLog = openSync(join(OUT, 'api.log'), 'a')
  api = spawn(python, ['-m', 'uvicorn', 'main:app', '--port', String(API_PORT), '--log-level', 'warning'], { cwd: BACKEND, env, stdio: ['ignore', apiLog, apiLog] })
  for (let i = 0; i < 120; i++) {
    const ok = await fetch(`http://127.0.0.1:${API_PORT}/api/profile`).then(r => r.ok, () => false)
    if (ok) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('the API did not start')
}

// ── Each clip ──
let failed = 0
for (const id of scenes) {
  const scene = (await import(`./scenes/${id}.mjs`)).default
  for (const form of forms) {
    const desk = form === 'desk'
    const name = desk ? `${scene.id}-desk` : scene.id
    await freshApi()
    const { browser, page, v } = await open({ desk, userId: USER })
    const h = hand(page, { desk, looking, shots: join(OUT, 'looks'), label: name })
    try {
      if (scene.prepare) scene.prepare(page, h)
      await page.goto(WEB + scene.start, { waitUntil: 'domcontentloaded' })
      if (desk) await page.mouse.move(v.width * 0.62, v.height * 0.55, { steps: 4 })
      await page.waitForTimeout(4000)
      const stop = looking ? null : await roll(page, v)
      await scene.run(page, h)
      if (stop) {
        const size = { width: v.width * v.scale, height: v.height * v.scale }
        const film = encode(await stop(), join(OUT, `${name}.mp4`), { ...size, crf: desk ? 22 : 23 })
        still(join(OUT, `${name}.mp4`), join(OUT, `${name}.jpg`), size)
        const over = film.bytes > MAX_BYTES ? '  -- over 3 MB: raise its crf' : ''
        log(`${name}: ${film.seconds.toFixed(1)} s, ${(film.bytes / 1e6).toFixed(2)} MB${over}`)
      } else {
        log(`${name}: looked`)
      }
    } catch (e) {
      failed += 1
      await page.screenshot({ path: join(OUT, `${name}-FAILED.png`) }).catch(() => {})
      log(`${name}: FAILED -- ${e.message.split('\n')[0]} (out/${name}-FAILED.png)`)
    }
    await browser.close()
  }
}
if (api) api.kill()
web.close()
process.exit(failed ? 1 : 0)
