import { describe, it, expect } from 'vitest'
import { navigation, workbox } from '../pwa.workbox.js'

// The service worker's policy (pwa.workbox.js). Most of it is caching
// taste and can change freely; two rules cannot, because between them
// they are why a learner can open the app at all after a deployment.
//
// On 2026-09-09 one could not. A worker was answering navigations out of
// its precache (`navigateFallback`, the plugin's default), so the
// document it served was a snapshot of an older deployment -- and
// index.html is the one precache entry not named by its own content, so
// it alone can outlive the bundle it names. The live deployment had
// retired that hash, the module script 404d, and nothing under src/ ran:
// a black page. It could not be escaped either, because the only thing
// that promoted a waiting worker was updateSW(true) in src/main.jsx --
// inside the bundle that would not load.
//
// Hence: the document comes from the network, and the worker hands over
// without the bundle's help.

const ORIGIN = 'https://japanese-learner-seven.vercel.app'

// The shape workbox passes a route matcher.
const req = (path, { sameOrigin = true, mode = 'navigate' } = {}) => ({
  url: new URL(path, ORIGIN),
  request: { mode },
  sameOrigin,
})

const matches = (path, opts) => Boolean(navigation.urlPattern(req(path, opts)))

describe('the service worker policy', () => {
  describe('the document', () => {
    it('is never answered from the precache', () => {
      // Not merely absent: the plugin defaults it to 'index.html', and
      // the NavigationRoute that makes is registered BEFORE runtimeCaching,
      // so leaving the default on would make the rule below unreachable.
      expect(workbox.navigateFallback).toBeUndefined()
      expect(workbox.navigateFallbackDenylist).toBeUndefined()
    })

    it('is the first rule, before anything path-shaped can claim it', () => {
      expect(workbox.runtimeCaching[0]).toBe(navigation)
    })

    it('goes to the network, with the precached shell only as the fallback', () => {
      expect(navigation.handler).toBe('NetworkOnly')
      expect(navigation.options.precacheFallback).toEqual({ fallbackURL: 'index.html' })
    })

    it('catches the app routes, so a deep link boots on the live build', () => {
      for (const path of ['/', '/today', '/learn/kana', '/decks/42', '/exam/7']) {
        expect(matches(path), path).toBe(true)
      }
    })

    it('leaves the paths that are not app routes alone', () => {
      // Two are proxied to the backend by vercel.json, one is a static
      // page: a navigation to any of them is the browser fetching that
      // thing, and answering it with the app shell would be a lie.
      for (const path of ['/api/today', '/kanjivg/04e00.svg', '/exam-audio/7.mp3', '/privacy']) {
        expect(matches(path), path).toBe(false)
      }
    })

    it('claims navigations only, and only same-origin ones', () => {
      // The bundle and the styles are precached entries; this rule must
      // not put a round trip in front of them.
      expect(matches('/assets/index-CvmBpqF-.js', { mode: 'no-cors' })).toBe(false)
      expect(matches('/', { mode: 'cors' })).toBe(false)
      expect(matches('/', { sameOrigin: false })).toBe(false)
    })
  })

  describe('the handover', () => {
    it('does not wait to be let in by the bundle it serves', () => {
      expect(workbox.skipWaiting).toBe(true)
      expect(workbox.clientsClaim).toBe(true)
    })
  })

  it('keeps learner state off the worker, last so the rules above win', () => {
    const last = workbox.runtimeCaching.at(-1)
    expect(last.handler).toBe('NetworkOnly')
    expect(last.urlPattern(req('/api/decks', { mode: 'cors' }))).toBe(true)
    expect(last.options).toBeUndefined()
  })
})
