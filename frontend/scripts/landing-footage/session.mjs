// The demo learner's browser: a Supabase session the page believes in
// (the backend, run with DEV_USER_ID, checks no token), the English
// interface and the dark theme. Used by every clip's script.
import { chromium } from 'playwright'

const REF = new URL(process.env.VITE_SUPABASE_URL || 'https://llisnbgrckwxmmxspolo.supabase.co').hostname.split('.')[0]
export const APP = process.env.APP_URL || 'http://127.0.0.1:5173'

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 365
  const jwt = `${b64({ alg: 'none' })}.${b64({ sub: 'demo', role: 'authenticated', aud: 'authenticated', exp })}.x`
  return {
    access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 86400 * 365, expires_at: exp,
    user: { id: 'demo', aud: 'authenticated', role: 'authenticated', email: 'haru@example.com', app_metadata: {}, user_metadata: {} },
  }
}

// `phone`: 360×780 at 3x = the 1080×2340 the footage is specified at.
// `desk`: 1440×900 at 1x.
//
// The screencast hands back CSS pixels whatever the emulated scale, so the
// phone gets its 3x from the browser itself (--force-device-scale-factor)
// and only its size is emulated: then the frames are 1080×2340 real pixels.
export const DEVICES = {
  phone: { width: 360, height: 780, scale: 3, touch: true },
  desk: { width: 1440, height: 900, scale: 1, touch: false },
}

export async function open(device = 'phone', { sound = false } = {}) {
  const d = DEVICES[device]
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-features=OverlayScrollbar', '--hide-scrollbars', `--force-device-scale-factor=${d.scale}`, `--window-size=${d.width},${d.height}`],
  })
  const ctx = await browser.newContext({ viewport: null, hasTouch: d.touch, locale: 'en-GB', colorScheme: 'dark', reducedMotion: 'no-preference' })
  const session = JSON.stringify(fakeSession())
  await ctx.addInitScript(([k, s, muted]) => {
    try {
      localStorage.setItem(k, s)
      localStorage.setItem('lang', 'en')
      if (!muted) localStorage.setItem('jp-app-muted', '1')
    } catch {}
  }, [`sb-${REF}-auth-token`, session, sound])
  // A phone's scrollbars are overlays that take no room; the desktop engine's
  // take 15px from every scrolling panel, so the footage gets none.
  {
    await ctx.addInitScript(() => {
      const css = '* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }'
      const put = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s) }
      if (document.documentElement) put(); else document.addEventListener('DOMContentLoaded', put)
    })
  }
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.scale, mobile: d.touch })
  await cdp.send('Emulation.setScrollbarsHidden', { hidden: true })
  return { browser, ctx, page, cdp, ...d }
}
