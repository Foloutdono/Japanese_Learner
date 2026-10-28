// ── The browser the footage is filmed in (plan 283) ─────────────
// A Chromium at the phone's or the desk's size, signed in as the API's
// DEV_USER_ID without Supabase: a session of the right shape in the key
// supabase-js reads, which the footage build (mode `footage`, no
// VITE_SUPABASE_URL) names after its placeholder project. The token is
// never checked: the API takes every request as DEV_USER_ID. The
// placeholder project itself is never reached.
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

// The README's two formats: the phone 1080×2340 (360×780 at 3x), the
// desk 1440×900.
export const PHONE = { width: 360, height: 780, scale: 3 }
export const DESK = { width: 1440, height: 900, scale: 1 }

// Every clip opens at the same hour of the same night: Today's print
// and its moon are the hour's (plan 205), and a gate filmed at noon
// would not match one filmed at ten. The page's clock starts here when
// it loads and runs on from there; Tokyo puts it at 22:30.
export const CLOCK = { at: '2026-10-28T13:30:00Z', zone: 'Asia/Tokyo' }

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')

function session(userId) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 30 * 24 * 3600
  const user = {
    id: userId, aud: 'authenticated', role: 'authenticated', email: 'footage@tsuji.app',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    is_anonymous: false, created_at: '2026-09-27T10:00:00Z',
  }
  const claims = { sub: userId, aud: 'authenticated', role: 'authenticated', exp, iat: now, email: user.email, is_anonymous: false }
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.footage`
  return { access_token: token, refresh_token: 'footage', token_type: 'bearer', expires_in: exp - now, expires_at: exp, user }
}

export async function open({ desk = false, userId, clock = CLOCK }) {
  const v = desk ? DESK : PHONE
  const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.scale,
    isMobile: !desk,
    hasTouch: !desk,
    colorScheme: 'dark',
    locale: 'fr-FR',
    timezoneId: clock.zone,
  })
  await context.addInitScript(([s]) => {
    try {
      if (!sessionStorage.getItem('footage')) {
        localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s))
        localStorage.setItem('lang', 'fr')
        localStorage.setItem('jp-theme', 'dark')
        sessionStorage.setItem('footage', '1')
      }
    } catch { /* no storage: the page boards signed out, and the scene fails loudly */ }
  }, [session(userId)])
  await context.addInitScript(at => {
    const Real = Date
    const off = Real.parse(at) - Real.now()
    function Clock(...a) {
      if (!new.target) return new Real(Real.now() + off).toString()
      return new Real(...(a.length ? a : [Real.now() + off]))
    }
    Clock.prototype = Real.prototype
    Clock.now = () => Real.now() + off
    Clock.parse = Real.parse
    Clock.UTC = Real.UTC
    globalThis.Date = Clock
  }, clock.at)
  // What the viewer follows, drawn into the page so the screencast has
  // it: the pointer on the desk, a touch's ring on the phone. Neither
  // takes a pointer event.
  await context.addInitScript(kind => {
    const mount = () => {
      if (!document.body || document.getElementById('footage-hand')) return
      const el = document.createElement('div')
      el.id = 'footage-hand'
      el.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;will-change:transform;opacity:0;transition:opacity .25s'
      document.body.appendChild(el)
      if (kind === 'pointer') {
        el.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 1.5v19.5l5.2-4.9 3.4 7.6 3.3-1.5-3.3-7.4h7.1z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
        el.style.transformOrigin = '2px 2px'
        let x = 0, y = 0
        const place = (s = 1) => { el.style.transform = `translate(${x - 2}px,${y - 2}px) scale(${s})` }
        addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; el.style.opacity = '1'; place() }, true)
        addEventListener('mousedown', () => place(0.85), true)
        addEventListener('mouseup', () => place(1), true)
        return
      }
      addEventListener('pointerdown', e => {
        const ring = document.createElement('div')
        ring.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.32);border:1.5px solid rgba(255,255,255,.55);pointer-events:none;z-index:2147483647;transform:scale(.6);transition:transform .45s ease-out,opacity .45s ease-out`
        document.body.appendChild(ring)
        requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.transform = 'scale(1.25)'; ring.style.opacity = '0' }))
        setTimeout(() => ring.remove(), 600)
      }, true)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
    else mount()
  }, desk ? 'pointer' : 'touch')
  await context.route(/placeholder\.supabase\.co/, r => r.abort())
  const page = await context.newPage()
  return { browser, page, v }
}
