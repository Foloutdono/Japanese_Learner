// ── 楽屋 — the stage, before the app arrives (plan 210) ──────────────
// Everything here runs before the app's first module (stage/main.jsx
// imports this file first), because each of these is read by the app
// as it loads and never asked again:
//
//  - the address: the stage is served at /__reel/stage/<route>, and the
//    router must see <route>;
//  - the learner's own settings on this device: the theme, the
//    language, the sound left on (lib/audio/settings.js's keys);
//  - a session, written where supabase-js keeps its own, so the auth
//    listener delivers a signed-in learner without asking the network;
//  - the backend (stage/backend.js), installed over window.fetch;
//  - the sound recorder (stage/audio.js), installed over AudioContext,
//    so the app's own voices are written into the reel's soundtrack.
//
// The director (reel/director.html) hosts the stage in an iframe and
// hands it its part through `window.__reelHost.stage`; opened on its own
// (to look at a fixture), the stage plays the defaults.

import { installBackend, unhandled, served } from './backend'
import { installFixtures } from './fixtures'
import { installAudio, audioClock } from './audio'
import { installMedia } from './media'

const PREFIX = '/__reel/stage'

const host = (() => {
  try { return window.parent !== window ? window.parent.__reelHost ?? null : null } catch { return null }
})()

// The live object, not a copy: the director moves `current` from beat
// to beat, and the backend reads it on every request.
export const part = host?.stage ?? { lang: 'fr', theme: 'dark', learner: 'Mika', level: 'N4' }
for (const [k, v] of Object.entries({ lang: 'fr', theme: 'dark', learner: 'Mika', level: 'N4', plan: 'pro' })) {
  if (part[k] == null) part[k] = v
}

if (window.location.pathname.startsWith(PREFIX)) {
  const path = window.location.pathname.slice(PREFIX.length) || '/'
  window.history.replaceState(null, '', path + window.location.search + window.location.hash)
}

// ── This device's settings ─────────────────────────────────────────
const USER_ID = '7e1c0d2a-5b9f-4c4e-9a51-7e7e1e5a2010'

function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function seedStorage() {
  const ls = window.localStorage
  ls.setItem('jp-theme', part.theme)
  document.documentElement.setAttribute('data-theme', part.theme)
  ls.setItem('lang', part.lang)
  ls.setItem('jp-app-muted', '0')
  // The station's ambiance under a film is a bed, not a voice.
  ls.setItem('jp-app-volumes', JSON.stringify({ ambiance: part.ambiance ?? 0.35 }))
  // The deck a word goes to in one press (useMineAction).
  ls.setItem('jp-mine-target:vocab', '7')
  ls.setItem('jl.readingPace', part.pace ?? 'standard')
  ls.setItem('jl.ratingScale', 'simple')
  ls.removeItem('jp-guided')
  // supabase-js keeps its session under sb-<project>-auth-token
  // (SupabaseClient's defaultStorageKey) and, finding one that has not
  // expired, signs in from it without a round trip.
  const project = new URL(import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co').hostname.split('.')[0]
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400
  const claims = { sub: USER_ID, exp, aud: 'authenticated', role: 'authenticated', is_anonymous: false }
  ls.setItem(`sb-${project}-auth-token`, JSON.stringify({
    access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.reel`,
    token_type: 'bearer',
    expires_in: 10 * 365 * 86400,
    expires_at: exp,
    refresh_token: 'reel',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'reel@tsuji.invalid',
      is_anonymous: false,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-08-01T08:00:00Z',
    },
  }))
}

try { seedStorage() } catch { /* a stage without storage plays signed out */ }

if (host?.clock) audioClock.use(host.clock)
installAudio()
installMedia()
installBackend()
installFixtures(part)

// ── What the director reaches for ─────────────────────────────────
window.__reelStage = {
  part,
  unhandled,
  served,
  audio: audioClock,
  /** Go to an app path, as a link inside the app would. */
  navigate(path) {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  },
  /**
   * Hand the analyzer's photo input a picture, as a pick from the
   * camera roll would: the same change event on the same input.
   */
  async pickPhoto(url, name = 'IMG_2048.jpg') {
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' })
    const inputs = document.querySelectorAll('.analysis-image-input__file')
    const input = inputs[1] ?? inputs[0]
    if (!input) throw new Error('stage: no photo input to hand the picture to')
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  },
  /** The first element matching `selector` that is drawn, or null. */
  find(selector) {
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
    return null
  },
}
