// ── 録画 — a practice feature, recorded in the app itself (plan 270) ────
// A feature's video shows the app as it runs, never a drawing of it. The
// app's own pages are served by Vite in this process and opened in a
// phone-sized browser (400 CSS px at 2.7: a shot 1080 px wide, the
// carousel's width), signed in as a learner who has boarded, whose /api
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
//   { type: SEL, text, shot: NAME, chunk: 3 }      typed a few keys at a time, a shot after each
//   { play: SEL, shot: NAME, seconds: 2.5 }        tapped, then a shot every so often while it plays
//   { wait: 800 }
// Every shot is 1080 × 2322 PNG; a box is in its pixels.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PHONE = { width: 400, height: 860, scale: 2.7 }

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
  const shots = []
  const shoot = async (name, i, extra = {}) => {
    const file = join(dir, `${String(shots.length).padStart(3, '0')}-${name}.png`)
    await page.screenshot({ path: file })
    const shot = { name, i, file, ...extra }
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
    } else if (st.click) {
      await page.locator(st.click).first().click({ timeout: 10000 })
      if (st.ready) await page.locator(st.ready).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(st.settle ?? 500)
    } else if (st.type) {
      const field = page.locator(st.type).first()
      await field.click()
      const chunk = st.chunk || 3
      const text = [...st.text]
      for (let n = 0; n < text.length; n += chunk) {
        await field.pressSequentially(text.slice(n, n + chunk).join(''))
        await shoot(st.shot, shots.filter(s => s.name === st.shot).length, { chars: Math.min(text.length, n + chunk), focus: await box(st.focus || st.type), tap: null })
      }
    } else if (st.play) {
      const t0 = Date.now()
      await page.locator(st.play).first().click({ timeout: 10000 })
      let i = 0
      while ((Date.now() - t0) / 1000 < (st.seconds || 2.5) + 0.3) {
        const at = (Date.now() - t0) / 1000
        await shoot(st.shot, i++, { at, focus: await box(st.focus), tap: null })
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
