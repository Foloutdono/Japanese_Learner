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
// A shot also says how far the page is scrolled (`scrollY`, the window
// and the page's own scroller, never a card's inner one), so the video
// can turn a scroll between two shots into the camera going down the
// page, and place each shot where it stands on it (plan 273).
// Every shot is 1600 × 3440 PNG (feature.js SHOT); a box is in its pixels.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
export async function record(browser, { url, steps, mocks, lang, audio = null, dir, log = () => {} }) {
  mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({
    viewport: { width: PHONE.width, height: PHONE.height }, deviceScaleFactor: PHONE.scale,
    locale: lang === 'fr' ? 'fr-FR' : 'en-GB', colorScheme: 'light',
    // The boarding's cutscenes are not mounted under reduced motion: the
    // video cuts between the screens itself.
    reducedMotion: 'reduce', serviceWorkers: 'block',
  })
  const user = { id: '00000000-0000-0000-0000-000000000270', aud: 'authenticated', role: 'authenticated', email: 'promo@tsuji.app', is_anonymous: false, app_metadata: {}, user_metadata: {} }
  const session = { access_token: 'promo', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'promo', user }
  await ctx.addInitScript(([s, lang]) => {
    localStorage.setItem('sb-placeholder-auth-token', s)
    localStorage.setItem('lang', lang)
    // No sentence read aloud by the device: the video's voices are the app's engine's.
    localStorage.setItem('jp-app-speak-on-reveal', '0')
  }, [JSON.stringify(session), lang])
  await ctx.route(/placeholder\.supabase\.co/, r => r.fulfill({ json: user }))
  const missed = new Set()
  await ctx.route(/\/api\//, r => {
    const u = new URL(r.request().url())
    const key = `${r.request().method()} ${u.pathname}`
    if (!(key in mocks)) missed.add(key)
    // Never a 401 (the app would sign out), never a release header.
    return r.fulfill({ json: mocks[key] ?? {} })
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
    } else if (st.scroll) {
      await page.locator(st.scroll).first().evaluate((el, block) => el.scrollIntoView({ block, behavior: 'instant' }), st.block || 'start')
      await page.waitForTimeout(st.settle ?? 400)
    } else if (st.click) {
      const was = st.keep ? await box(st.click) : null
      const s0 = was ? (await scrolled()) * S : 0
      await page.locator(st.click).first().click({ timeout: 10000 })
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
