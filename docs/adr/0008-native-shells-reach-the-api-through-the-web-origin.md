# 0008 — Native shells reach the API through the web origin

- **Status**: accepted
- **Date**: 2026-09-06

## Context

The app is same-origin by decision, not by accident. On 2026-09-01 the
deployed frontend was found pointing the browser straight at
`onrender.com` through a `VITE_API_URL` variable: some mobile carriers
cannot reach that zone at all, and every CORS preflight died in transit on
4G. The fix retired the variable — `lib/api.js` became `api = path => path`
and the Vercel `vercel.json` rewrites (`/api`, `/kanjivg`, `/exam-audio` →
Render) carry every backend call — and the incident's second lesson was
recorded beside it: a leftover copy of the variable in the Vercel dashboard
had silently out-prioritised the tracked, emptied `.env.production`. A knob
that exists can be set by mistake.

Wave 14 puts the same app inside a Capacitor shell for the App Store and
Google Play. A WebView's own origin is `capacitor://localhost` on iOS and
`https://localhost` on Android, and it serves nothing but the bundle. There
`fetch('/api/…')` resolves against the bundle and fails; the shell needs an
absolute origin. So a knob has to come back, and the question is how to
have it without re-arming the outage.

## Decision

1. **The native build calls the Vercel origin, never Render.** The carrier
   fix was "the phone never talks to `onrender.com`"; the rewrite proxy stays
   in the path. `frontend/.env.native` (tracked) sets
   `VITE_API_ORIGIN=https://japanese-learner-seven.vercel.app`, and
   `lib/api.js` prefixes every backend path with it.
2. **The knob exists only in a `native` Vite mode.** `npm run build:native`
   is `vite build --mode native --outDir dist-native`; Vite loads
   `.env.native` for that mode and `.env.production` for the web build, so
   the two cannot cross.
3. **Any other build that carries the variable does not build.**
   `vite.config.js` reads `loadEnv(mode, …)` — which merges
   `process.env.VITE_*` over the files, exactly the path a dashboard variable
   takes — and throws when `mode !== 'native'` and `VITE_API_ORIGIN` is set,
   naming the dashboard in the message. A leftover can no longer rebake a
   direct URL into the web app; it stops the deploy instead.
4. **The WebView origins are hardcoded in CORS.** `backend/main.py` lists
   `capacitor://localhost` and `https://localhost` beside the Vercel origin
   rather than through the `CORS_ORIGINS` environment variable: they are
   what the shipped app *is*, not a per-machine allowance, and a dashboard
   variable is the invisible state item 3 exists to avoid. Neither origin is
   reachable by a page an attacker controls in any useful way, and auth is a
   bearer header (never a cookie; `allow_credentials` stays off), so the
   list widens nothing.
5. **Bundled assets never pass through the knob.** `/sounds` and `/sprites`
   ship inside the shell; resolving them against the web origin would fetch
   them over the network instead.

## Consequences

- The web build's behaviour is unchanged and now guarded: the guard is a
  build failure, which is the only kind of failure a dashboard leftover
  cannot hide.
- Whether Vercel forwards the `Origin` header through an external rewrite
  is verified live, not assumed (plan 066's `curl` preflight). If it does
  not, the shell's fallback is Capacitor's `CapacitorHttp` plugin (native
  requests, no CORS), and this record gets an amendment — the decision that
  the phone never calls Render directly stands either way.
- The three sites that bypassed `api()` with origin-relative fetches
  (`lib/translationCache.js`, `DrawingCanvas.jsx`, `DictionaryDetail.jsx`)
  now go through it, so there is one seam. A future backend path must use
  it too; `StrokeOrderAnimation.jsx` documents that its `src` arrives
  resolved.
- The two Supabase values are duplicated between `.env.production` and
  `.env.native`; `src/env.native.test.js` keeps them equal and keeps
  `VITE_API_ORIGIN` out of `.env.production`.
