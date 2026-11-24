// ── 録画 — a practice feature, recorded in the app itself (plan 270) ────
// A feature's video shows the app as it runs, never a drawing of it. The
// app's own pages are served by Vite in this process and opened in a
// phone-sized browser (400 CSS px at 4: a shot 1600 px wide, so the
// video's camera can come in on a part of it and still draw it sharp,
// plan 273), signed in as a learner who has boarded, whose /api
// is answered from bank/promo.json: the backend's own answers for the
// banks' own content (carousel_bank.promo). Each step of the feature's
// script (feature.js, FEATURES[id].steps) is done as a learner does it,
// and a shot is taken where the video needs one, with where the part it
// shows and the part a finger taps stand in it, read off the page.
//
// A step is one of:
//   { go: '/practice/dictation/N5', ready: SEL }   open a page, wait for SEL
//   { shot: NAME, focus: SEL, tap: SEL }           a shot, and where SEL stands (all it matches; SEL or [SEL])
//   { click: SEL, ready: SEL }                     a tap, then wait for SEL
//                                                  (`keep`: SEL kept where it stood, as it opens in place)
//   { type: SEL, text, shot: NAME, chunk: 3 }      typed a few keys at a time, a shot after each
//   { play: SEL, shot: NAME, seconds: 2.5 }        tapped, then a shot every so often while it plays
//                                                  (`fast`: as JPEGs; `step`: its animations held and
//                                                  stepped 1/fps at a time, a shot each, for a moving text)
//   { scroll: SEL, block: 'start' }                the page scrolled until SEL stands at its top
//                                                  ('center', 'end'), as a learner scrolls to it
//   { wait: 800 }
//   { file: SEL, make: SPEC, shot: NAME }          a file handed to the input SEL, as a learner
//                                                  picks one (plan 331): SPEC says what it is,
//                                                  made here (makeFile: an Anki deck, a sound,
//                                                  a photo of a page)
//   { trace: SEL, strokes: [d], shot: NAME }       each stroke drawn on SEL by a finger, in
//                                                  KanjiVG's 109-unit box, a shot every few
//                                                  points (plan 331: a kana traced)
// A shot also says how far the page is scrolled (`scrollY`, the window
// and the page's own scroller, never a card's inner one), so the video
// can turn a scroll between two shots into the camera going down the
// page, and place each shot where it stands on it (plan 273).
// Every shot is 1600 × 3440 PNG (feature.js SHOT); a box is in its pixels.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// The owner's pictures (carousel/content/pictures/), where a scene's video stands in YouTube's place.
const PICTURES = join(FRONT, 'carousel/content/pictures')

export const PHONE = { width: 400, height: 860, scale: 4 }

/** A WAV of `seconds` of silence: a clip's length where no voice is given. */
function silence(seconds) {
  const rate = 8000
  const n = Math.max(1, Math.round(seconds * rate))
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  return buf
}

/** The app, served from `front` by Vite in this process, or `app` if one is already running. */
export async function appServer(front, app = null) {
  if (app) return { url: app.replace(/\/$/, ''), close: async () => {} }
  const { createServer } = await import('vite')
  const server = await createServer({ root: front, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() }
}

/** Runs `steps` in the app; returns the shots, each { name, i, file, at, focus, tap }. */
export async function record(browser, { url, steps, mocks, lang, audio = null, dir, log = () => {}, user: own = null, youtube = null }) {
  mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({
    viewport: { width: PHONE.width, height: PHONE.height }, deviceScaleFactor: PHONE.scale,
    locale: lang === 'fr' ? 'fr-FR' : 'en-GB', colorScheme: 'light',
    // The boarding's cutscenes are not mounted under reduced motion: the
    // video cuts between the screens itself.
    reducedMotion: 'reduce', serviceWorkers: 'block',
  })
  // A scene may say more of the account (plan 331: its sign-in, so the page offers none to link).
  const user = { id: '00000000-0000-0000-0000-000000000270', aud: 'authenticated', role: 'authenticated', email: 'promo@tsuji.app', is_anonymous: false, app_metadata: {}, user_metadata: {}, ...(own || {}) }
  const session = { access_token: 'promo', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'promo', user }
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('sb-placeholder-auth-token', s)
    localStorage.setItem('lang', lang)
    // No sentence read aloud by the device: the video's voices are the app's engine's.
    localStorage.setItem('jp-app-speak-on-reveal', '0')
  }, [JSON.stringify(session), lang])
  await ctx.route(/placeholder\.supabase\.co/, r => r.fulfill({ json: user }))
  // A video whose pictures play in YouTube's place (plan 331): its stills
  // the first of them, and the player a stand-in (youTubeStandIn).
  if (youtube) {
    const still = readFileSync(join(PICTURES, youtube.frames[0].picture))
    await ctx.route(/i\.ytimg\.com/, r => r.fulfill({ status: 200, contentType: 'image/webp', body: still }))
    await ctx.addInitScript(youTubeStandIn, { frames: youtube.frames, base: '/carousel/content/pictures/', title: youtube.title || '' })
  }
  const missed = new Set()
  // A key may name query parameters too ("GET /api/dictionary?category=vocab",
  // plan 274): it answers a request carrying them all, before the path's own.
  const keyed = Object.keys(mocks).filter(k => k.includes('?')).map(k => {
    const [path, query] = k.split('?')
    return { k, path, params: [...new URLSearchParams(query)] }
  })
  await ctx.route(/\/api\//, r => {
    const u = new URL(r.request().url())
    const key = `${r.request().method()} ${u.pathname}`
    const hit = keyed.find(m => m.path === key && m.params.every(([n, v]) => u.searchParams.get(n) === v))
    if (!hit && !(key in mocks)) missed.add(key)
    const answer = (hit ? mocks[hit.k] : mocks[key]) ?? {}
    // A route that answers a file (plan 331: the progress's CSV), as it sends it.
    if (answer.$file) return r.fulfill({ status: 200, contentType: answer.$file.contentType, body: answer.$file.body, headers: { 'content-disposition': 'attachment' } })
    // Never a 401 (the app would sign out), never a release header.
    return r.fulfill({ json: answer })
  })
  const clip = audio ? readFileSync(audio) : silence(2.5)
  await ctx.route(/\/exam-audio\//, r => r.fulfill({ status: 200, contentType: audio?.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav', body: clip }))
  const page = await ctx.newPage()
  page.on('pageerror', e => log('app:', e.message))
  // A first visit, so Vite has bundled what the app imports before a step counts.
  await page.goto(`${url}/practice`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1500)
  const S = PHONE.scale
  // Where SEL stands: every element it matches (or each of a list matches), as one box.
  const box = async sel => {
    if (!sel) return null
    const locs = (await Promise.all([].concat(sel).map(one => page.locator(one).all()))).flat()
    const bs = (await Promise.all(locs.map(l => l.boundingBox().catch(() => null)))).filter(b => b && b.width && b.height)
    if (!bs.length) return null
    const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y))
    const r = Math.max(...bs.map(b => b.x + b.width)), d = Math.max(...bs.map(b => b.y + b.height))
    return { x: x * S, y: y * S, w: (r - x) * S, h: (d - y) * S }
  }
  // How far the page is scrolled: the window, and the scroller the stage stands in.
  const scrolled = () => page.evaluate(() => {
    let y = window.scrollY
    for (let el = document.querySelector('.stage, main')?.parentElement; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el)
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { y += el.scrollTop; break }
    }
    return y
  }).catch(() => 0)
  const shots = []
  // What the page's layout moved above a kept tap (plan 273): added to
  // every later shot's scroll, so what stayed under the finger keeps its
  // place on the page and the camera does not travel for a collapse.
  let drift = 0
  // A clip shot as it plays is a JPEG, quick enough to keep up with it; any other shot a PNG.
  const shoot = async (name, i, extra = {}, fast = false) => {
    const file = join(dir, `${String(shots.length).padStart(3, '0')}-${name}.${fast ? 'jpg' : 'png'}`)
    await page.screenshot(fast ? { path: file, type: 'jpeg', quality: 92 } : { path: file })
    const shot = { name, i, file, scrollY: Math.round((await scrolled()) * S + drift), ...extra }
    shots.push(shot)
    return shot
  }
  for (const st of steps) {
    if (st.go) {
      await page.goto(url + st.go, { waitUntil: 'networkidle' }).catch(() => {})
      if (st.ready) await page.locator(st.ready).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(st.settle ?? 600)
    } else if (st.wait) {
      await page.waitForTimeout(st.wait)
    } else if (st.file) {
      // A file picked (plan 331): handed to the input as the system's picker hands it.
      await page.locator(st.file).first().setInputFiles(await makeFile(browser, st.make, url))
      if (st.ready) await page.locator(st.ready).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(st.settle ?? 600)
      if (st.shot) await shoot(st.shot, 0, { focus: await box(st.focus), tap: await box(st.tap) })
    } else if (st.trace) {
      // Each stroke drawn by a finger from its start to its end (plan 331),
      // sampled as the tour's own test samples it (domain/strokePath), a
      // shot every few points so the ink is seen to run; `at` is the
      // stroke's own pace, a stroke a second.
      const pen = page.locator(st.trace).first()
      const b = await pen.boundingBox()
      let at = 0
      let i = 0
      for (const d of st.strokes) {
        const points = await page.evaluate(async d => (await import('/src/domain/strokePath.js')).sampleStroke(d, 24), d)
        const xy = ([x, y]) => [b.x + (x / 109) * b.width, b.y + (y / 109) * b.height]
        await page.mouse.move(...xy(points[0]))
        await page.mouse.down()
        for (let k = 1; k < points.length; k++) {
          await page.mouse.move(...xy(points[k]), { steps: 2 })
          if (k % 4 === 0 || k === points.length - 1) await shoot(st.shot, i++, { at: +(at + k / points.length).toFixed(3), focus: await box(st.focus || st.trace), tap: null }, true)
        }
        await page.mouse.up()
        at += 1.15
        await page.waitForTimeout(st.settle ?? 250)
      }
      await page.mouse.move(PHONE.width - 1, PHONE.height / 2)
    } else if (st.scroll) {
      await page.locator(st.scroll).first().evaluate((el, block) => el.scrollIntoView({ block, behavior: 'instant' }), st.block || 'start')
      await page.waitForTimeout(st.settle ?? 400)
    } else if (st.click) {
      const was = st.keep ? await box(st.click) : null
      const s0 = was ? (await scrolled()) * S : 0
      await page.locator(st.click).first().click({ timeout: 10000 })
      // The finger lifts: no hover left on what the tap opened (a tag's tooltip, plan 274).
      await page.mouse.move(PHONE.width - 1, PHONE.height / 2)
      if (st.ready) await page.locator(st.ready).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(st.settle ?? 500)
      // `keep`: what was tapped stays where it stood (plan 273), the page
      // scrolled by what opening it moved, as a phone's scroll anchoring
      // keeps an accordion's head under the finger.
      const now = was && await box(st.click)
      if (now && Math.abs(now.y - was.y) > 2) {
        await page.mouse.move(PHONE.width / 2, PHONE.height / 2)
        await page.mouse.wheel(0, (now.y - was.y) / S)
        await page.waitForTimeout(500)
      }
      if (was) drift += was.y + s0 - ((await box(st.click)).y + (await scrolled()) * S)
    } else if (st.type) {
      const field = page.locator(st.type).first()
      await field.click()
      const chunk = st.chunk || 3
      const text = [...st.text]
      for (let n = 0; n < text.length; n += chunk) {
        await field.pressSequentially(text.slice(n, n + chunk).join(''))
        await shoot(st.shot, shots.filter(s => s.name === st.shot).length, { chars: Math.min(text.length, n + chunk), focus: await box(st.focus || st.type), tap: null })
      }
    } else if (st.play && st.step) {
      // An animation filmed frame by frame (plan 273): the page's
      // animations held once it is tapped, then stepped 1/fps at a time
      // (after `skip` seconds of it, a roll's still lead), a shot at each,
      // so a moving text glides in the video at the shot's full size,
      // however long a shot takes to take. What reads an animation's
      // clock (the roll's lit line) reads the time it is stepped to.
      await page.locator(st.play).first().click({ timeout: 10000 })
      await page.waitForTimeout(st.settle ?? 150)
      const fps = st.fps || 30
      const n = Math.round((st.seconds || 2.5) * fps)
      await page.evaluate(() => { window.__held = document.getAnimations().map(a => { a.pause(); return [a, a.currentTime ?? 0] }) })
      for (let i = 0; i <= n; i++) {
        const ms = ((st.skip || 0) + i / fps) * 1000
        await page.evaluate(ms => new Promise(done => {
          for (const [a, t0] of window.__held) a.currentTime = t0 + ms
          requestAnimationFrame(() => requestAnimationFrame(done))
        }), ms)
        await shoot(st.shot, i, { at: i / fps, focus: await box(st.focus), tap: null }, true)
      }
      // They run on from where they were brought.
      await page.evaluate(() => { for (const [a] of window.__held || []) a.play(); window.__held = null })
    } else if (st.play) {
      const t0 = Date.now()
      await page.locator(st.play).first().click({ timeout: 10000 })
      let i = 0
      while ((Date.now() - t0) / 1000 < (st.seconds || 2.5) + 0.3) {
        const at = (Date.now() - t0) / 1000
        await shoot(st.shot, i++, { at, focus: await box(st.focus), tap: null }, st.fast)
        await page.waitForTimeout(st.every ? st.every * 1000 : 150)
      }
    } else if (st.shot) {
      const shot = await shoot(st.shot, 0, { focus: await box(st.focus), tap: await box(st.tap) })
      if (st.tap && !shot.tap) log(`record: nothing to tap at ${st.tap} (${st.shot})`)
    }
  }
  if (missed.size) log(`record: answered {} for ${[...missed].join(', ')}`)
  await ctx.close()
  writeFileSync(join(dir, 'shots.json'), JSON.stringify(shots, null, 1))
  return shots
}

// ── What a learner hands the page (plan 331) ──────────────────────
/** A file as the system's picker gives it: { name, mimeType, buffer }.
 *  `make.kind` says what: an Anki deck (`apkg`: its models, decks and
 *  notes, scheduled as a review card's are), a sound (`wav`: `seconds`
 *  of it) or a photo of a page (`note`: its lines, set on paper on a
 *  desk, as a phone photographs one). */
export async function makeFile(browser, make, url) {
  if (make.kind === 'wav') return { name: make.name, mimeType: 'audio/wav', buffer: tone(make.seconds) }
  if (make.kind === 'apkg') return { name: make.name, mimeType: 'application/zip', buffer: await apkg(make) }
  if (make.kind === 'note') return { name: make.name, mimeType: 'image/jpeg', buffer: await notePhoto(browser, make, url) }
  throw new Error(`record: no file of kind ${make.kind}`)
}

/** `seconds` of a quiet sound that decodes anywhere (16-bit PCM): the
 *  file a song stands in, so the page's player has a clock to run on.
 *  A low hum, not silence, so no browser takes it for an empty file. */
function tone(seconds) {
  const rate = 16000
  const n = Math.round(seconds * rate)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(300 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2)
  return buf
}

/** An Anki collection as Anki exports it, with its scheduling: a zip
 *  holding collection.anki21, the tables lib/anki reads (col, notes,
 *  cards), each note a review card (type 2) due `due` days from today
 *  at its `interval`, ease 250%. */
async function apkg({ models, decks, notes }) {
  const { default: initSqlJs } = await import('sql.js')
  const { zipSync } = await import('fflate')
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE col (id integer primary key, crt integer, models text, decks text)')
  db.run('CREATE TABLE notes (id integer primary key, mid integer, flds text)')
  db.run('CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, type integer, queue integer, due integer, odue integer, ivl integer, factor integer, data text)')
  // The collection began ten days ago: a review card's due is its day counted from then.
  const DAYS = 10
  const crt = Math.floor(Date.now() / 1000) - DAYS * 86400
  const mids = models.map((_, i) => 1000 + i)
  const json = {}
  models.forEach((m, i) => { json[mids[i]] = { id: mids[i], name: m.name, flds: m.fields.map((name, ord) => ({ name, ord })) } })
  const dj = {}
  decks.forEach((name, i) => { dj[i + 1] = { id: i + 1, name } })
  db.run('INSERT INTO col VALUES (1, ?, ?, ?)', [crt, JSON.stringify(json), JSON.stringify(dj)])
  notes.forEach((n, i) => {
    db.run('INSERT INTO notes VALUES (?, ?, ?)', [i + 1, mids[n.model], n.fields.join('\x1f')])
    db.run("INSERT INTO cards VALUES (?, ?, ?, 0, 2, 2, ?, 0, ?, 2500, '')", [i + 1, i + 1, n.deck + 1, DAYS + n.due, n.interval])
  })
  const bytes = zipSync({ 'collection.anki21': db.export() })
  db.close()
  return Buffer.from(bytes)
}

/** A photo of a handwritten page: the lines on squared paper, a little
 *  askew on a wooden desk, in the app's own serif (served by Vite). */
async function notePhoto(browser, { lines }, url) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(`${url}/carousel/index.html`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  await page.setContent(`<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${url}/node_modules/@fontsource/noto-serif-jp/600.css">
<style>
  body { margin: 0; width: 1200px; height: 900px; overflow: hidden;
    background: radial-gradient(ellipse at 30% 20%, #b78a5e, #7a5233 70%, #5d3d24); }
  .paper { position: absolute; left: 170px; top: 170px; width: 860px; height: 560px; transform: rotate(-3.5deg);
    background-color: #f7f3e8; box-shadow: 0 22px 40px rgba(30, 16, 6, 0.45), 0 2px 4px rgba(30, 16, 6, 0.3);
    background-image: linear-gradient(rgba(70, 110, 160, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(70, 110, 160, 0.16) 1px, transparent 1px);
    background-size: 36px 36px; padding: 120px 80px; box-sizing: border-box; }
  p { margin: 0 0 54px; font: 600 50px/1.2 "Noto Serif JP", serif; color: #232a3a; letter-spacing: 0.04em; }
  .light { position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255, 248, 230, 0.18), transparent 45%, rgba(0, 0, 0, 0.12)); }
</style>
<div class="paper">${lines.map(l => `<p lang="ja">${esc(l)}</p>`).join('')}</div><div class="light"></div>`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const buf = await page.screenshot({ type: 'jpeg', quality: 88 })
  await page.close()
  return buf
}

/** YouTube's IFrame player, stood in for (plan 331): a scene's pictures,
 *  each from its moment, on the clock the page plays, pauses and seeks.
 *  lib/youtubePlayer.js takes a window.YT that is there already; this is
 *  run in the page before the app, so the app finds it. */
function youTubeStandIn({ frames, base, title }) {
  class Player {
    constructor(el, opts) {
      this.opts = opts
      this.t = 0
      this.from = null
      this.rate = 1
      const host = typeof el === 'string' ? document.getElementById(el) : el
      this.img = document.createElement('img')
      this.img.alt = ''
      this.img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000'
      host.appendChild(this.img)
      this.show()
      this.timer = setInterval(() => this.show(), 100)
      setTimeout(() => opts?.events?.onReady?.({ target: this }), 0)
    }
    now() { return this.from == null ? this.t : this.t + ((performance.now() - this.from) / 1000) * this.rate }
    show() {
      const t = this.now()
      let f = frames[0]
      for (const x of frames) if (x.start <= t) f = x
      const src = base + f.picture
      if (!this.img.src.endsWith(src)) this.img.src = src
    }
    state(s) { this.s = s; this.opts?.events?.onStateChange?.({ target: this, data: s }) }
    playVideo() { if (this.from == null) { this.from = performance.now(); this.state(1) } }
    pauseVideo() { if (this.from != null) { this.t = this.now(); this.from = null; this.state(2) } }
    seekTo(s) { this.t = s; if (this.from != null) this.from = performance.now(); this.show() }
    getCurrentTime() { return this.now() }
    getPlayerState() { return this.s ?? 5 }
    getDuration() { return frames.at(-1).start + 4 }
    getVolume() { return 100 }
    isMuted() { return false }
    setVolume() {}
    mute() {}
    unMute() {}
    setPlaybackRate(r) { this.t = this.now(); if (this.from != null) this.from = performance.now(); this.rate = r }
    getVideoData() { return { title, author: 'Tsuji' } }
    destroy() { clearInterval(this.timer); this.img.remove() }
  }
  window.YT = { Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } }
}
