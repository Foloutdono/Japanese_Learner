import { createRequire } from 'module'
const REPO = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '')
const WORK = process.env.FILM_DIR || '/tmp/tsuji-film'
const require = createRequire(`${REPO}/frontend/package.json`)
export const { chromium } = require('playwright')
export const SFX_LOG = []
export const U_NEW = '33333333-3333-4333-8333-333333333333'
export const U_PRO = '22222222-2222-4222-8222-222222222222'
const far = Math.floor(Date.now() / 1000) + 3600 * 24 * 30
function session(uid, anon) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub: uid, exp: far, role: 'authenticated', aud: 'authenticated', is_anonymous: anon }) + '.sig'
  return { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600 * 24 * 30, expires_at: far,
    user: { id: uid, aud: 'authenticated', role: 'authenticated', email: anon ? '' : 'demo@tsuji.app', is_anonymous: anon,
      app_metadata: { provider: anon ? 'anonymous' : 'email' }, user_metadata: {}, identities: [], created_at: '2026-10-01T00:00:00Z' } }
}
export async function phone({ uid = U_PRO, signedIn = true, extraStorage = {}, w = 390, h = 780 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'] })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'en-US', colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
  const store = { lang: 'en', 'jp-theme': 'dark', 'jp-app-muted': '0', 'jp-trail-off': '1', ...extraStorage }
  if (signedIn) { store['sb-placeholder-auth-token'] = JSON.stringify(session(uid, false)); store['jp-onboarded'] = uid }
  await ctx.addInitScript(s => { if (location.origin.includes('localhost')) for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v) }, store)
  await ctx.route(/placeholder\.supabase\.co/, r => {
    const u = r.request().url()
    if (u.includes('/auth/v1/signup')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session(uid, true)) })
    if (u.includes('/auth/v1/user') && r.request().method() === 'PUT') {
      const body = JSON.parse(r.request().postData() || '{}')
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...session(uid, false).user, email: body.email || 'demo@tsuji.app', email_confirmed_at: '2026-10-13T00:00:00Z' }) })
    }
    if (u.includes('/auth/v1/user')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session(uid, !signedIn).user) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await ctx.addInitScript({ path: new URL('./touch.js', import.meta.url).pathname })
  // the app's sound calls, logged with wall-clock time (muted or not)
  await ctx.exposeBinding('__sfxPush', (_src, e) => { SFX_LOG.push(e) })
  await ctx.addInitScript(() => {
    window.__sfxLog = (kind, name, after) => { try { window.__sfxPush({ kind, name: String(name), after: after || 0, t: Date.now() / 1000 }) } catch {} }
    window.addEventListener('keydown', e => window.__sfxLog('key', e.key), true)
    window.addEventListener('touchstart', () => window.__sfxLog('touch', ''), true)
  })
  const inject = (file, pairs) => ctx.route(new RegExp('/src/lib/audio/' + file + '(\\?.*)?$'), async r => {
    const res = await r.fetch(); let body = await res.text()
    for (const [sig, add] of pairs) { if (!body.includes(sig)) console.log('INJECT MISS', file, sig); body = body.replace(sig, sig + add) }
    r.fulfill({ response: res, body })
  })
  await inject('voices.js', [['export function playVoice(eventKey, { after = 0 } = {}) {', "\n  window.__sfxLog?.('voice', eventKey, after);"]])
  await inject('playback.js', [['function play(path, category, soundName) {', "\n  window.__sfxLog?.('file', path);"],
    ['export function playKana(name) {', "\n  window.__sfxLog?.('kana', name);"],
    ['export function playAnnouncement(name) {', "\n  window.__sfxLog?.('announce', name);"]])
  await inject('ambiance.js', [['export function startAmbiance(track) {', "\n  window.__sfxLog?.('ambiance', track);"]])
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log('PAGEERR', e.message))
  return { browser, ctx, page }
}
