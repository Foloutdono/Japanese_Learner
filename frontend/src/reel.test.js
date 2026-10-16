import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { normalize, requestOf, APPS, HOOKS, TRANSITIONS } from '../reel/script.mjs'
import { APPS as SCENES } from '../reel/director/apps/index.js'
import { wordsOf } from '../reel/director/captions.js'
import { routePattern } from './lib/routePattern'

// ── 映像 — the reel generator (plan 210) ──
// `npm run reel` films the real app for short videos, from a script
// (frontend/reel/README.md). It lives outside src/, so none of the
// app's guards see it; these are its own: every feature a script may
// name has a scene, every scene films a place the app routes (a route
// renamed in App.jsx fails here, not in a render), the sample scripts
// stay playable, and a script the director cannot play is refused with
// the beat and the field it got wrong.

const dir = new URL('../reel/reels/', import.meta.url)
const samples = readdirSync(dir).filter(f => f.endsWith('.json'))
const load = name => JSON.parse(readFileSync(new URL(name, dir), 'utf8'))

const play = beats => normalize({ beats })

describe('the reel', () => {
  it('has a scene for every feature a script may name, and no other', () => {
    expect(Object.keys(SCENES).sort()).toEqual(Object.keys(APPS).sort())
  })

  it('films every scene at a place the app routes', () => {
    const ctx = { script: { level: 'N4' } }
    for (const [feature, scene] of Object.entries(SCENES)) {
      const froms = APPS[feature].from ?? [undefined]
      for (const from of froms) {
        const path = scene.route({ feature, from }, ctx).split('?')[0]
        expect(routePattern(path), `${feature}${from ? ` from ${from}` : ''}: ${path}`).not.toBeNull()
      }
    }
  })

  describe('its sample scripts', () => {
    it('are there, the two openings the generator was asked for among them', () => {
      expect(samples).toEqual(expect.arrayContaining(['sign-photo.json', 'manga-reading.json']))
    })

    it.each(samples)('%s plays', name => {
      const script = normalize(load(name))
      expect(script.beats.at(-1).kind).toBe('end')
    })

    it('cover every feature between them', () => {
      const filmed = new Set(samples.flatMap(name => normalize(load(name)).beats
        .filter(b => b.kind === 'app').map(b => b.feature)))
      // today and review are the same scene; the tours film today.
      const missing = Object.keys(APPS).filter(f => !filmed.has(f) && f !== 'review')
      expect(missing).toEqual([])
    })
  })

  describe('a script', () => {
    it('fills what it leaves out', () => {
      const script = play([{ hook: 'sign', text: '駐輪禁止' }, { snap: true }, { app: 'analyzer', text: '駐輪禁止' }, { end: true }])
      expect(script).toMatchObject({ lang: 'en', width: 1080, height: 1920, fps: 30, level: 'N4' })
      expect(script.beats[0]).toMatchObject({ kind: 'hook', scene: 'sign', style: HOOKS.sign[0], caption: null })
      expect(script.beats[2]).toMatchObject({ kind: 'app', feature: 'analyzer', from: 'photo' })
    })

    it('reads a caption as a line or as { text, at, hold }', () => {
      const [a, b] = play([{ end: true, caption: 'a *gold* word' }, { end: true, caption: { text: 'x', at: 'bottom' } }]).beats
      expect(a.caption).toEqual({ text: 'a *gold* word' })
      expect(b.caption).toEqual({ text: 'x', at: 'bottom' })
      expect(wordsOf('so you *snap it* 📸')).toEqual([
        { text: 'so', gold: false, ja: false, emoji: false },
        { text: 'you', gold: false, ja: false, emoji: false },
        { text: 'snap it', gold: true, ja: false, emoji: false },
        { text: '📸', gold: false, ja: false, emoji: true },
      ])
    })

    it.each([
      [[{ hook: 'billboard', text: 'x' }], /beat 1: hook "billboard" is not one of/],
      [[{ hook: 'sign', style: 'manga', text: 'x' }], /beat 1: a sign hook's style is one of/],
      [[{ hook: 'sign' }], /beat 1: needs "text"/],
      [[{ hook: 'media', style: 'video' }], /beat 1: needs "file"/],
      [[{ hook: 'media', file: 'a.jpg', subject: [0.5, 0, 0.6, 0.2] }], /beat 1: subject is \[x, y, w, h\]/],
      [[{ end: true }, { app: 'karaoke' }], /beat 2: app "karaoke" is not one of/],
      [[{ app: 'reading' }], /beat 1: needs "text"/],
      [[{ app: 'analyzer', text: 'x', from: 'radio' }], /beat 1: an analyzer beat comes from one of/],
      [[{ snap: 'yes' }], /beat 1: a snap beat is written \{ "snap": true \}/],
      [[{ app: 'pass', end: true }], /beat 1: names app and end/],
      [[{ caption: 'x' }], /beat 1: names no kind/],
      [[{ end: true, caption: 3 }], /beat 1: caption is a string/],
      [[{ end: true, duration: 90 }], /beat 1: duration is seconds/],
    ])('refuses %j', (beats, message) => {
      expect(() => play(beats)).toThrow(message)
    })

    it.each([
      [{ lang: 'de' }, /lang is one of/],
      [{ width: 1920, height: 1080 }, /9:16/],
      [{ level: 'N6' }, /level is one of/],
      [{ plan: 'gold' }, /plan is one of/],
      [{ streak: -1 }, /streak is a whole number/],
      [{ clock: '7:5' }, /clock is "hh:mm"/],
    ])('refuses a learner or frame of %j', (fields, message) => {
      expect(() => normalize({ ...fields, beats: [{ end: true }] })).toThrow(message)
    })

    it('names every transition the director plays', () => {
      for (const kind of TRANSITIONS) expect(play([{ [kind]: true }]).beats[0].kind).toBe(kind)
    })
  })

  describe('what the backend is asked', () => {
    const script = normalize(load('practice-tour.json'))
    const req = requestOf(script)

    it('is every sentence the reel films, once, with what the script says of it', () => {
      const texts = req.sentences.map(s => s.text)
      expect(new Set(texts).size).toBe(texts.length)
      for (const beat of script.beats.filter(b => b.kind === 'app' && b.text)) {
        expect(req.sentences).toContainEqual(expect.objectContaining({ text: beat.text.trim(), translation: beat.translation ?? '' }))
      }
    })

    it('is the dictionary page a search opens on, the field as it is typed, and the search', () => {
      // The app searches as the kana compose: え, えき, then 駅 chosen.
      expect(req.searches.map(s => s.q)).toEqual(['', 'え', 'えき', '駅'])
      expect(new Set(req.searches.map(s => s.category))).toEqual(new Set(['kanji']))
    })

    it('is the comprehension exercise and the dictation clip to voice', () => {
      expect(req.comprehension).toEqual(['N4'])
      expect(req.voice).toEqual(['駅で友だちに会います。'])
    })

    it('is a hook\'s own text too (its words are where its lines break)', () => {
      const asked = requestOf(normalize(load('sign-photo.json'))).sentences.map(s => s.text)
      expect(asked).toContain(load('sign-photo.json').beats[0].text)
    })
  })
})
