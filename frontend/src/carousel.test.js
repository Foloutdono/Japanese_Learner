import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, RATING_INKS, drawFeedHud, formatOf, frame, layoutSentence } from '../carousel/draw.js'
import { LEVELS, SOURCES, TITLE_MAX, chunksOf, depsOf, itemsOf, lineRomaji, picked, plan, readingMisses, themePartOf, titleOf, unpack } from '../carousel/sources.js'
import { ENDING_IDS, TYPES, available, deck, endingSlide } from '../carousel/slides.js'
import { assemblyQ, kanjiQuizzes, overlaps, withoutGiveaways } from '../carousel/quizzes.js'
import { furiganaOf } from '../carousel/common.js'
import { howItWorks, particleLabel, senseOf, stacksIn } from '../carousel/explain.js'
import { STRINGS, weld, weldIf } from '../carousel/strings.js'
import { APP_INKS, DUEL_INKS, T1_INKS } from '../carousel/app.js'
import { CLIP, DUEL_BEATS, DUEL_RUN, LEVEL, PROMO, STORIES, STORY_FILES, arrivals, duelRun, kanjiNumber, promoDeck, promoItems, promoPlan, raceClock, spanOf } from '../carousel/promo.js'
import { ECHO, beats, echoDeck, echoItems, echoPlan, touches, voiceSpan } from '../carousel/echo.js'
import { SWIPE, chars, drawShortFrame, fromRecipe, recipeOf, shortPage, shortTimeline, slideSeconds, spokenLine } from '../carousel/short.js'
import { DESIGNS, FEATURES, WORDS as FUNNEL, funnelOf } from '../carousel/funnel.js'
import { KINDS, LONG_SITE, PART, SHORT, fitShort, answered, chapterText, cueKey, describe as describeVideo, dictionaryForms, drawLong, longCommand, longFiles, longItems, longListFiles, longPick, longPlan, shortGloss, timeline } from '../carousel/long.js'
import { SITE_ORIGIN } from '../landing/config.mjs'
import { LEVEL_CLOCK, VOICE_EVENTS } from './lib/audio/recipes.js'
import { VOICE_REV } from './lib/audio/speech.js'
import { kanjiNumber as appKanjiNumber } from './domain/dayClear.js'
import { LIMIT_MS, SPRINT_MS, multOf, points } from './domain/duel.js'
import DUEL_AUDIO from './lib/audio/duel.json'
import { arrivals as landingArrivals, readFacts, spanOf as landingSpan } from '../landing/content.mjs'
import EN from './locales/en/index.js'
import FR from './locales/fr/index.js'

// ── カルーセル — the carousel studio (plans 229, 229b, 229c) ──
// A static tool outside src/ (frontend/carousel/), so none of the app's
// guards see it. These are its own: the inks it adds to tokens.mjs stay
// the app's, the bank backend/scripts/carousel_bank.py writes still
// spells every sentence back, every item of every source draws as every
// type it can be, a question never deals its answer twice nor a wrong
// answer that could be right, the last slide's figures are the bank's
// own, and an explanation names the one sense its sentence uses, or none.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const bank = file => JSON.parse(read(`carousel/bank/${file}`))
const banks = Object.fromEntries(LEVELS.map(lv => [lv, bank(`${lv}.json`)]))
const FIGURES = bank('index.json').figures
const OPTS = { lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', kanji: '', handle: '@tsuji.app', slides: {}, figures: FIGURES }
const sentence = jp => LEVELS.flatMap(lv => banks[lv].sentences).find(s => s.jp === jp)
const glossEn = r => (r.en || [])[0] || ''
// The sources a carousel's last slide stands on: a promo story ends on
// its own gate, a word echo is one frame and its clip, a long video is a
// player of its own (plan 233).
const STATIONED = SOURCES.filter(s => s.id !== 'promo' && s.id !== 'echo' && s.id !== 'long')
const LAST = { promo: id => (id === 'pass' ? 'free' : 'board'), echo: () => 'echo' }

/** Every file a source reads: one per level, one per kana set, or one. */
function filesOf(src) {
  if (src.levels) return src.levels.map(set => ({ data: bank(src.file(set)), filter: set }))
  if (!src.file.length) return [{ data: bank(src.file()) }]
  return LEVELS.map(lv => ({ data: bank(src.file(lv)) }))
}

const sentencesById = Object.fromEntries(LEVELS.flatMap(lv => banks[lv].sentences).map(s => [s.id, s]))
const kanjiIndex = bank('kanji-index.json')
const kanjiByLevel = Object.fromEntries(LEVELS.map(lv => [lv, bank(`kanji-${lv}.json`).kanji]))
function depsFor(src, data, id) {
  if (src.id !== 'word') return {}
  const need = depsOf('word', data, id)
  const strokes = {}
  for (const c of need.chars) {
    const lv = kanjiIndex.kanji[c]?.lv
    if (lv && kanjiByLevel[lv][c]) strokes[c] = kanjiByLevel[lv][c]
  }
  return { index: kanjiIndex, sentences: sentencesById, strokes }
}

/** A 2D context that draws nothing and measures text roughly (a CJK
 *  character a square, anything else a little over half one): enough to
 *  run a slide's layout through, in a lane with no canvas. */
function stubContext() {
  const texts = []
  const state = { font: '10px sans-serif' }
  const sizeOf = () => parseFloat(/([\d.]+)px/.exec(state.font)?.[1] || '10')
  const widthOf = t => [...String(t)].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.56), 0) * sizeOf()
  const methods = {
    measureText: t => ({ width: widthOf(t), actualBoundingBoxAscent: sizeOf() * 0.72, actualBoundingBoxDescent: sizeOf() * 0.12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: widthOf(t) }),
    fillText: t => { texts.push(String(t)) },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }
  const ctx = new Proxy(state, {
    get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, texts }
}

describe('the carousel studio', () => {
  it('draws the verdict inks index.css declares', () => {
    const css = read('src/index.css')
    for (const [name, value] of Object.entries(RATING_INKS)) {
      expect(css, name).toMatch(new RegExp(`${name}:\\s*${value};`))
    }
  })

  it('has a bank for every level, each sentence spelled back by its words', () => {
    for (const lv of LEVELS) {
      const b = banks[lv]
      expect(b.level).toBe(lv)
      expect(b.sentences.length).toBeGreaterThan(100)
      for (const s of b.sentences) {
        expect(s.rows.map(r => r.t).join(''), s.id).toBe(s.jp)
        expect(b.points[s.p], `${s.id}: ${s.p}`).toBeTruthy()
      }
    }
  })

  it('spells a lesson’s sentences back and lights its point in each', () => {
    for (const lv of LEVELS) {
      for (const L of bank(`grammar-${lv}.json`).lessons) {
        for (const ex of L.ex) {
          const rows = unpack(ex.rows)
          expect(rows.every(r => r.t), L.p).toBe(true)
          expect(ex.en, L.p).toBeTruthy()
        }
      }
    }
  })

  // Every plan of every source, built once for the tests below.
  const every = []
  for (const src of SOURCES) {
    for (const { data, filter } of filesOf(src)) {
      // A promo story is picked by its set, the story (plan 231).
      const opts = src.id === 'promo' ? { ...OPTS, story: filter } : OPTS
      for (const { id } of itemsOf(src.id, data, 'en', filter)) every.push({ src, id, p: plan(src.id, data, id, opts, depsFor(src, data, id)) })
    }
  }

  it('draws every item of every source as every type it can be', { timeout: 120000 }, () => {
    // A long video is no deck of slides: its own test draws it (plan 233).
    for (const src of SOURCES.filter(x => !x.video)) expect(every.some(x => x.src === src), src.id).toBe(true)
    for (const { src, id, p } of every) {
      for (const type of TYPES.map(x => x.id).filter(x => available(x, p))) {
        const slides = deck(type, p, FORMATS.post, { ground: 'paper' })
        expect(slides.length, `${src.id} ${id} ${type}`).toBeGreaterThan({ promo: 1, echo: 0 }[src.id] ?? 2)
        // A promo story ends on its own gate, not on a station (plan 231).
        expect(slides.at(-1).key, `${src.id} ${id} ${type}`).toBe(LAST[src.id]?.(id) ?? 'outro')
        expect(new Set(slides.map(x => x.key)).size, `${src.id} ${id} ${type}`).toBe(slides.length)
      }
    }
  })

  it('ends on any of the endings, for every source, in both formats', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      for (const src of STATIONED) {
        const { p } = every.find(x => x.src === src)
        const type = TYPES.map(x => x.id).find(x => x !== 'plates' && available(x, p)) || 'plates'
        for (const fmt of Object.values(FORMATS)) {
          for (const ground of ['paper', 'sumi']) {
            for (const id of ENDING_IDS) {
              const { ctx, texts } = stubContext()
              endingSlide(id, type, p, fmt, { ground }).draw(ctx)
              expect(texts.length, `${src.id} ${id} ${fmt.id} ${ground}`).toBeGreaterThan(3)
            }
            // The mark closes on the metal to the website, a handle under it,
            // never the website a second time.
            for (const handle of ['', '@someone', 'https://tsuji.app/']) {
              const { ctx, texts } = stubContext()
              endingSlide('mark', type, { ...p, handle }, fmt, { ground }).draw(ctx)
              expect(texts, `${src.id} ${handle}`).toContain('Start on tsuji.app')
              expect(texts.includes('@someone'), `${src.id} ${handle}`).toBe(handle === '@someone')
              expect(texts.some(x => /https?:/.test(x)), `${src.id} ${handle}`).toBe(false)
            }
            // The deck's own last slide is the ending picked.
            const { ctx, texts } = stubContext()
            deck(type, p, fmt, { ground, ending: 'pass' }).at(-1).draw(ctx)
            expect(texts, `${src.id} ${type}`).toContain('定期券')
          }
        }
      }
    } finally {
      globalThis.Path2D = had
    }
  })

  it('draws every slide of every type it can be, without a throw', { timeout: 120000 }, () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      // A sample of every source, in turn in each language and format.
      // A passage's pages are cut by a real canvas's measure, which this
      // lane has not: they are drawn in the browser's checks instead.
      const seen = {}
      for (const [n, { src, id, p }] of every.entries()) {
        if ((seen[src.id] = (seen[src.id] || 0) + 1) % 90 !== 1) continue
        const lang = n % 2 ? 'fr' : 'en'
        const file = filesOf(src).find(x => itemsOf(src.id, x.data, 'en', x.filter).some(it => it.id === id)).data
        const q = lang === 'en' ? p : plan(src.id, file, id, { ...OPTS, lang, script: 'furigana' }, depsFor(src, file, id))
        {
          const fmt = n % 3 ? FORMATS.post : FORMATS.story
          {
            for (const type of TYPES.map(x => x.id).filter(x => available(x, q))) {
              for (const sl of deck(type, q, fmt, { ground: n % 2 ? 'paper' : 'sumi' }).filter(x => !x.key.startsWith('passage-'))) {
                const { ctx } = stubContext()
                expect(() => sl.draw(ctx), `${src.id} ${id} ${lang} ${fmt.id} ${type} ${sl.key}`).not.toThrow()
              }
            }
          }
        }
      }
    } finally {
      globalThis.Path2D = had
    }
  })

  it('draws at normal margins too, with no feed’s chrome over them (plan 234f)', { timeout: 120000 }, () => {
    // What a guide draws: TikTok's photo view, or nothing.
    const drawn = fmt => {
      const calls = []
      const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => calls.push(k)), set: (o, k, v) => { o[k] = v; return true } })
      drawFeedHud(ctx, fmt)
      return calls.filter(k => k === 'fillRect' || k === 'fill').length
    }
    for (const ratio of Object.keys(FORMATS)) {
      const normal = formatOf(ratio, 'normal')
      // TikTok's is the format as it was; the normal one keeps the ratio,
      // its id and its size, and only widens the box.
      expect(formatOf(ratio, 'tiktok')).toBe(FORMATS[ratio])
      expect([normal.id, normal.w, normal.h, normal.fit], ratio).toEqual([ratio, FORMATS[ratio].w, FORMATS[ratio].h, 'normal'])
      for (const side of ['t', 'r', 'b', 'l']) expect(normal.safe[side], `${ratio} ${side}`).toBeLessThanOrEqual(FORMATS[ratio].safe[side])
      expect(normal.safe.l, ratio).toBe(normal.safe.r)
      expect(drawn(normal), ratio).toBe(0)
    }
    expect(drawn(FORMATS.story)).toBeGreaterThan(0)
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      const seen = {}
      for (const [n, { src, id, p }] of every.entries()) {
        if ((seen[src.id] = (seen[src.id] || 0) + 1) % 90 !== 2) continue
        const fmt = formatOf(n % 2 ? 'post' : 'story', 'normal')
        for (const type of TYPES.map(x => x.id).filter(x => available(x, p))) {
          for (const design of [...DESIGNS, 'classic']) {
            for (const sl of deck(type, p, fmt, { ground: n % 3 ? 'paper' : 'sumi', design }).filter(x => !x.key.startsWith('passage-'))) {
              const { ctx } = stubContext()
              expect(() => sl.draw(ctx), `${src.id} ${id} ${fmt.id} ${type} ${design} ${sl.key}`).not.toThrow()
            }
          }
        }
        if (src.id === 'promo' || src.id === 'echo' || src.id === 'long') continue
        for (const ending of ENDING_IDS) {
          const { ctx, texts } = stubContext()
          endingSlide(ending, 'plates', p, fmt, { ground: 'paper' }).draw(ctx)
          expect(texts.length, `${src.id} ${id} ${ending} ${fmt.id}`).toBeGreaterThan(3)
        }
      }
    } finally {
      globalThis.Path2D = had
    }
  })

  it('asks a kanji its readings and its words, never which kanji means this (plan 229l)', () => {
    for (const lv of ['N5', 'N4']) {
      const data = bank(`kanji-${lv}.json`)
      for (const lang of ['en', 'fr']) {
        const t = STRINGS[lang]
        for (const c of Object.keys(data.kanji)) {
          const k = data.kanji[c]
          const own = (lang === 'fr' && k.fr?.length ? k.fr : k.en) || []
          const qs = kanjiQuizzes(c, data, lang, t)
          expect(qs.some(q => q.kind === 'kanjiReverse'), c).toBe(false)
          for (const q of qs.filter(x => x.kind === 'kanjiVocab')) {
            const right = q.choices[q.right].text
            const word = q.explain.head.split('\u3000')[0]
            // The right word is written with it, and says more than its meaning.
            expect(word.includes(c), `${c} ${word}`).toBe(true)
            expect(own.some(m => overlaps(m, right) || m.toLowerCase() === right.toLowerCase()), `${c} ${right}`).toBe(false)
          }
        }
      }
    }
  })

  it('asks a word its spelling in the 表記 type, not in its mock exam (plan 229l)', () => {
    let spelled = 0
    for (const { src, p } of every.filter(x => x.src.id === 'word')) {
      expect(p.quizzes.some(q => q.kind === 'orthography'), p.id).toBe(false)
      for (const q of p.spelling || []) {
        spelled += 1
        // The kana asked is the word's own reading, and the right answer its spelling.
        expect(q.explain.head, src.id).toBe(`${q.stem.specimen}\u3000${q.choices[q.right].text}`)
        expect(new Set(q.choices.map(x => x.text)).size).toBe(4)
      }
    }
    expect(spelled).toBeGreaterThan(0)
  })

  it('never shows an answer before its question is asked (plan 229l)', { timeout: 60000 }, () => {
    for (const { src, p } of every) {
      // Every question the plan has, as a mock exam would ask them all.
      const qs = withoutGiveaways(picked(p, p.quizzes.map(q => q.id), 3))
      qs.forEach((q, i) => {
        const shown = `${q.explain?.head || ''} ${q.explain?.sense || ''} ${q.stem?.text || ''} ${q.stem?.tr || ''}`
        for (const later of qs.slice(i + 1)) {
          const right = later.choices[later.right].text
          if ([...right].length < 2 || later.kind === 'orthography') continue
          expect(shown.includes(right), `${src.id} ${p.id}: ${q.label} shows ${right}, the answer to ${later.label}`).toBe(false)
        }
      })
    }
  })

  it('titles every carousel within the feed’s 90 characters (plan 229l)', { timeout: 60000 }, () => {
    for (const { src, p } of every) {
      for (const type of TYPES.map(x => x.id).filter(x => available(x, p))) {
        const title = titleOf(p, type, 3)
        expect([...title].length, `${src.id} ${p.id} ${type}`).toBeLessThanOrEqual(TITLE_MAX)
        expect(title, `${src.id} ${p.id} ${type}`).not.toMatch(/undefined|null|NaN/)
      }
    }
  })

  it('marks the source’s own station on the route map, and only it', () => {
    for (const src of STATIONED) {
      const { p } = every.find(x => x.src === src)
      const here = p.map.flatMap(L => L.stops).filter(st => st.here)
      expect(here, src.id).toHaveLength(1)
      expect(here[0].jp, src.id).toBe(p.station.jp)
      expect(p.map.map(L => L.key), src.id).toEqual(['learn', 'practice'])
    }
  })

  it('asks questions with four different answers, the right one once', { timeout: 60000 }, () => {
    for (const { src, id, p } of every) {
      const qs = [...p.quizzes, p.compare?.quiz, p.talk?.quiz].filter(Boolean)
      expect(new Set(p.quizzes.map(q => q.id)).size, `${src.id} ${id}`).toBe(p.quizzes.length)
      for (const q of qs) {
        const keys = q.choices.map(c => JSON.stringify(c.text ?? c.rows))
        expect(new Set(keys).size, `${src.id} ${id} ${q.kind}`).toBe(keys.length)
        expect(q.right, `${src.id} ${id} ${q.kind}`).toBeGreaterThanOrEqual(0)
        expect(q.right, `${src.id} ${id} ${q.kind}`).toBeLessThan(q.choices.length)
        expect(q.label, `${src.id} ${id} ${q.kind}`).toBeTruthy()
      }
    }
  })

  it('never deals a meaning that could be the right one too', () => {
    for (const { src, id, p } of every) {
      for (const q of p.quizzes.filter(x => ['meaning', 'pointMeaning', 'kanjiMeaning', 'grammar'].includes(x.kind))) {
        const right = q.choices[q.right].text
        for (const [i, c] of q.choices.entries()) if (i !== q.right) expect(overlaps(right, c.text), `${src.id} ${id}: ${right} / ${c.text}`).toBe(false)
      }
    }
    expect(overlaps('to study', 'studying')).toBe(true)
    expect(overlaps('school', 'station')).toBe(false)
  })

  it('spells a word wrong only in ways that are no word of the deck', () => {
    const deckForms = new Set(LEVELS.flatMap(lv => bank(`words-${lv}.json`).words.map(w => w.t)))
    for (const lv of LEVELS) {
      for (const w of bank(`words-${lv}.json`).words) {
        for (const wrong of w.hy || []) {
          expect(wrong, w.t).not.toBe(w.t)
          expect(deckForms.has(wrong), `${w.t}: ${wrong}`).toBe(false)
          expect([...wrong].length, `${w.t}: ${wrong}`).toBe([...w.t].length)
        }
      }
    }
  })

  it('asks for word order only where the grammar fixes it', () => {
    const t = STRINGS.en
    const q = assemblyQ(sentence('日本語を話すことができます。')?.rows || [], '〜ことができます', 'x', 'en', t)
    if (q) {
      expect(q.choices.map(c => c.text).sort()).toEqual(['が', 'こと', 'できます', '話す'].sort())
      expect(q.choices[q.right].text).toBe('が')
    }
    // A sentence's phrases can be said in more than one order: no question.
    expect(assemblyQ(sentence('駅で友だちに会います。').rows, 'で', 'x', 'en', t)).toBeNull()
    for (const { src, id, p } of every) {
      for (const a of p.quizzes.filter(x => x.kind === 'assembly')) {
        const pieces = a.choices.map(c => c.text)
        expect(new Set(pieces).size, `${src.id} ${id}`).toBe(4)
        expect(a.stem.rows.filter(r => r.k === 'blank')).toHaveLength(4)
        expect(a.stem.after.rows[a.stem.after.target].t, `${src.id} ${id}`).toBe(pieces[a.right])
      }
    }
  })

  it('builds a sentence from all of its pieces, in order', () => {
    for (const { src, id, p } of every) {
      if (!p.build) continue
      const b = p.build
      expect(b.steps.length, `${src.id} ${id}`).toBeLessThanOrEqual(6)
      expect(b.steps.at(-1).upto, `${src.id} ${id}`).toBe(b.rows.length)
      expect(chunksOf(b.rows).flat(), `${src.id} ${id}`).toEqual(b.rows.map((_, i) => i))
    }
  })

  it('quotes the figures the bank counts', () => {
    expect(FIGURES.sentences).toBe(LEVELS.reduce((n, lv) => n + banks[lv].sentences.length, 0))
    expect(FIGURES.words).toBe(LEVELS.reduce((n, lv) => n + bank(`words-${lv}.json`).words.length, 0))
    const kana = bank('kana.json').kana
    expect(FIGURES.hiragana).toBe(kana.filter(k => k.set === 'hiragana').length)
    expect(FIGURES.passages).toBe(bank('comprehension.json').passages.length)
    const p = every.find(x => x.src.id === 'sentence').p
    expect(p.figure).toContain(FIGURES.sentences.toLocaleString('en-US'))
    expect(p.station.code).toBe('DS')
  })

  it('never offers a reading as its own near-miss', () => {
    const b = banks.N5
    for (const s of b.sentences) {
      for (const row of s.rows.filter(r => r.fu)) {
        const reading = row.fu.map(([t, r]) => r || t).join('')
        expect(readingMisses(row, b.kanji), row.t).not.toContain(reading)
      }
    }
  })

  it('never deals a reading the word also takes (plan 229l)', () => {
    // 店 is みせ and てん: a one-kanji word keeps its other readings out.
    expect(readingMisses({ t: '店', fu: [['店', 'みせ']] }, kanjiIndex)).not.toContain('てん')
    // 行く is いく and ゆく in the deck.
    expect(readingMisses({ t: '行く', fu: [['行', 'ゆ'], ['く', '']] }, kanjiIndex, ['いく'])).not.toContain('いく')
  })

  // ── Plan 229m: a theme in pictures, lookalike kanji, a reply, a trap ──
  const plansOf = id => every.filter(x => x.src.id === id).map(x => x.p)

  it('draws a theme’s words with their pictures, and hides one impostor a round (plan 229m)', () => {
    const themes = bank('themes.json').themes
    const emoji = JSON.parse(read('carousel/content/emoji.json'))
    // Every picture names a word its theme has.
    for (const [key, spec] of Object.entries(emoji)) {
      const glosses = new Set(themes[key].words.flatMap(w => w.en))
      for (const g of Object.keys(spec.emoji)) expect(themes[key].words.some(w => w.e === spec.emoji[g]), `${key} ${g}`).toBe(true)
      expect(glosses.size, key).toBeGreaterThan(0)
    }
    const ps = plansOf('theme')
    // Every theme, each in posts of four to eight pictures, none shown twice (plan 229n).
    expect(new Set(ps.map(p => themePartOf(p.id).key)).size).toBe(Object.keys(themes).length)
    const shown = {}
    for (const p of ps) {
      const { key } = themePartOf(p.id)
      const pics = p.slides.filter(s => s.kind === 'picture')
      expect(pics.length, p.id).toBeGreaterThanOrEqual(4)
      expect(pics.length, p.id).toBeLessThanOrEqual(8)
      expect(pics.every(s => s.w.e), p.id).toBe(true)
      for (const s of pics) {
        expect(shown[`${key} ${s.w.t}`], `${p.id} ${s.w.t}`).toBeUndefined()
        shown[`${key} ${s.w.t}`] = p.id
      }
      // No two words of a theme share a picture.
      expect(new Set(themes[key].words.filter(w => w.e).map(w => w.e)).size, key).toBe(themes[key].words.filter(w => w.e).length)
      const own = new Set(themes[key].words.map(w => w.t))
      for (const r of p.impostor?.rounds || []) {
        expect(r.words, p.id).toHaveLength(6)
        expect(new Set(r.words.map(w => w.t)).size, p.id).toBe(6)
        r.words.forEach((w, i) => expect(own.has(w.t), `${p.id} ${w.t}`).toBe(i !== r.at))
      }
      // A question's label is printed on the exam's cover: never its answer.
      for (const q of p.quizzes) expect(q.label.includes(q.choices[q.right].text), `${p.id} ${q.label}`).toBe(false)
    }
  })

  it('asks which lookalike kanji means what, only where no other means it too (plan 229m)', () => {
    for (const p of plansOf('lookalike')) {
      expect(p.slides.filter(s => s.kind === 'lookchar').length, p.id).toBeGreaterThanOrEqual(2)
      for (const s of p.slides.filter(x => x.kind === 'lookchar')) expect(s.k.meaning, `${p.id} ${s.k.c}`).not.toMatch(/radical|\(no\./i)
      for (const q of p.quizzes) {
        const right = q.choices[q.right].text
        expect(q.label.includes(right), `${p.id} ${q.label}`).toBe(false)
        expect(q.explain.head.startsWith(right), p.id).toBe(true)
      }
    }
  })

  it('sets every line of a conversation with its furigana and its romaji, for a beginner (plan 229m)', () => {
    const ps = plansOf('dialogue')
    expect(ps.length).toBe(bank('dialogues.json').dialogues.length)
    for (const p of ps) {
      const turns = p.slides.filter(s => s.kind === 'turn' && !s.revealed).map(s => s.turn)
      expect(turns.length, p.id).toBeGreaterThanOrEqual(3)
      // Romaji under every word for a beginner (N5, N4); furigana at every level (plan 229n).
      expect(p.slides.filter(s => s.kind === 'turn').every(s => s.romaji === ['N5', 'N4'].includes(p.level)), p.id).toBe(true)
      for (const tu of turns) {
        expect(tu.choices.length, p.id).toBe(3)
        expect(new Set(tu.choices.map(c => JSON.stringify(c))).size, p.id).toBe(3)
        for (const rows of [tu.them.rows, ...tu.choices]) {
          for (const r of rows.filter(x => x.k !== 'punct')) {
            expect(r.ro, `${p.id} ${r.t}`).toBeTruthy()
            if (/[㐀-鿿]/.test(r.t)) expect(r.fu?.some(([, read]) => read), `${p.id} ${r.t}`).toBe(true)
          }
        }
        // お and ご ride the word they honour.
        expect(tu.them.rows.some(r => r.t === 'お' || r.t === 'ご'), p.id).toBe(false)
      }
    }
    // Where the analyser misreads, the bank sets it right (plan 229n).
    const rows = ps.flatMap(p => p.slides.filter(s => s.kind === 'turn').flatMap(s => [s.turn.them.rows, ...s.turn.choices]).flat())
    const read = t => rows.filter(r => r.t === t).map(r => r.fu.map(([, x]) => x).join(''))
    expect(new Set(read('船便'))).toEqual(new Set(['ふなびん']))
    expect(new Set(read('御社'))).toEqual(new Set(['おんしゃ']))
    expect(rows.some(r => r.t === '御')).toBe(false)
  })

  it('never prints a trap’s translation over its question (plan 229m)', () => {
    for (const p of plansOf('trap')) {
      for (const q of p.quizzes) {
        expect(q.stem.tr, p.id).toBe('')
        expect(q.choices, p.id).toHaveLength(3)
      }
      expect(p.slides.slice(0, 2).map(s => s.revealed), p.id).toEqual([false, true])
    }
  })

  it('reads a sentence in romaji word by word', () => {
    expect(lineRomaji(sentence('駅で友だちに会います。').rows)).toBe('Eki de tomodachi ni aimasu.')
    // A capital after a stop inside the line too.
    expect(lineRomaji(sentence('外は雨です。今日は出ません。').rows)).toMatch(/\. Kyou/)
    // A stray kana the tokenizer packed as punctuation is still read (あには).
    expect(lineRomaji(unpack([['あ'], ['に', 'p', 'ni'], ['は', 'p', 'wa'], ['けっこん', 'w', 'kekkon'], ['。']]))).toBe('A ni wa kekkon.')
  })

  it('welds French punctuation to the word before it', () => {
    expect(weld('Tu sais la lire ?')).toBe('Tu sais la lire\u00a0?')
    expect(weld('« Je reviendrai. »')).toBe('«\u00a0Je reviendrai.\u00a0»')
  })

  it('sets English quotes as English sets them', () => {
    expect(weldIf('en', 'Existence is not an action: « there is a shop » is 駅に店があります.')).toBe('Existence is not an action: “there is a shop” is 駅に店があります.')
    expect(weldIf('fr', '« là »')).toBe('«\u00a0là\u00a0»')
  })
})

describe('setting furigana as the app sets them', () => {
  const word = (t, fu, extra = {}) => ({ t, k: 'word', pos: 'noun', ro: '', fu, ...extra })
  const lay = (rows, o = {}) => layoutSentence(stubContext().ctx, rows, { max: FS.body, min: FS.body, maxW: 2000, script: 'furigana', ...o })

  it('sets one word’s readings as one ruby', () => {
    const L = lay([word('鉄道', [['鉄', 'てつ'], ['道', 'どう']])])
    expect(L.list[0].segs).toEqual([['鉄道', 'てつどう']])
    // Kana between two kanji keeps them apart: 日 よう 日.
    expect(lay([word('日よう日', [['日', 'にち'], ['よう', ''], ['日', 'び']])]).list[0].segs).toHaveLength(3)
  })

  it('leans a wide reading on kana either side, never on one side only', () => {
    const both = lay([word('お願い', [['お', ''], ['願', 'ねが'], ['い', '']])]).list[0].segX[1]
    expect(both.rw).toBeGreaterThan(both.bw)
    expect(both.w).toBeLessThan(both.rw)
    const one = lay([word('願い', [['願', 'ねが'], ['い', '']])]).list[0].segX[0]
    expect(one.w).toBe(one.rw)
  })

  it('never sets a reading under the caption rung', () => {
    const L = lay([word('駅', [['駅', 'えき']])], { max: FS.sm, min: FS.sm })
    expect(parseFloat(/([\d.]+)px/.exec(L.rf)[1])).toBeGreaterThanOrEqual(Math.round(FS.caption * 10) / 10)
  })

  it('cuts a word’s reading to its kanji, never over its kana', () => {
    expect(furiganaOf('降り出す', 'ふりだす')).toEqual([['降', 'ふ'], ['り', ''], ['出', 'だ'], ['す', '']])
    expect(furiganaOf('お茶', 'おちゃ')).toEqual([['お', ''], ['茶', 'ちゃ']])
    expect(furiganaOf('下降', 'かこう')).toEqual([['下降', 'かこう']])
    expect(furiganaOf('ボール箱', 'ボールばこ')).toEqual([['ボール', ''], ['箱', 'ばこ']])
    expect(furiganaOf('あの', 'あの')).toBeNull()
    // Every word a list can show: its pieces spell the word, their
    // readings the word's reading, and no kana is read over.
    const hira = str => str.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    for (const lv of LEVELS) {
      const words = [
        ...Object.values(kanjiByLevel[lv]).flatMap(k => k.words || []),
        ...bank(`words-${lv}.json`).words.flatMap(w => [w, ...(w.family || [])]),
      ]
      for (const w of words) {
        const fu = furiganaOf(w.t, w.r)
        if (!fu) continue
        expect(fu.map(([t]) => t).join(''), w.t).toBe(w.t)
        expect(hira(fu.map(([t, r]) => r || t).join('')), w.t).toBe(hira(w.r))
        for (const [t, r] of fu) if (r) expect(/[\u3400-\u9fff々〆ヶ]/.test(t), `${w.t}: ${t}`).toBe(true)
      }
    }
  })

  it('breaks a line between phrases, never before a particle', () => {
    const rows = [
      word('電車', [['電', 'でん'], ['車', 'しゃ']]), { t: 'が', k: 'particle', ro: 'ga' },
      word('来たら', [['来', 'き'], ['たら', '']], { pos: 'verb' }), { t: '、', k: 'punct' },
      word('すぐ', null, { pos: 'adverb' }), { t: 'に', k: 'particle', ro: 'ni' },
      word('すわろう', null, { pos: 'verb' }), { t: 'ね', k: 'particle', ro: 'ne' }, { t: '。', k: 'punct' },
    ]
    // Every phrase fits each of these widths, so none is broken.
    for (const maxW of [270, 320, 400, 520]) {
      const L = lay(rows, { maxW, maxLines: 9 })
      for (const line of L.lines.slice(1)) expect(line[0].row.k, `${maxW}`).toBe('word')
    }
  })
})

describe('explaining a point in its own sentence', () => {
  const how = (jp, p) => howItWorks(sentence(jp).rows, p, 'M', 'en', glossEn)

  it('says the one sense of で and に the sentence uses', () => {
    expect(how('駅で友だちに会います。', 'で').line).toMatch(/^で marks 駅 \(station\) as the place where/)
    expect(how('電車で学校へ行きます。', 'で').line).toMatch(/as the way you travel/)
    expect(how('七時に学校へ行きます。', 'に').line).toMatch(/^に pins .* to a point in time: 七時/)
    expect(how('机の上に本があります。', 'に').line).toMatch(/^に marks 机の上 as where someone or something is/)
    expect(how('昨日、友だちに会いました。', 'に').line).toMatch(/the person on the other end/)
  })

  it('keeps the general line where the sentence does not settle it', () => {
    // A passive's agent is no receiver; なる takes に for what it becomes.
    expect(senseOf('に', '父', { t: '父' }, { t: '怒られました', pos: 'verb', lemma: ['怒る', 'おこる'], g: ['受身形 〜られる'] })).toBeNull()
    expect(senseOf('に', '医者', { t: '医者' }, { t: 'なりたい', pos: 'verb', lemma: ['成る', 'なる'] })).toBeNull()
    // 決まる is not 来ます because both are spelled きま in kana.
    expect(senseOf('に', 'どこ', { t: 'どこ' }, { t: '決まった', pos: 'verb', lemma: ['決まる', 'きまる'] })).toBeNull()
    // 一年に及ぶ is a span, not a date.
    expect(senseOf('に', '一年', { t: '一年' }, { t: '及ぶ', pos: 'verb' })).toBeNull()
  })

  it('reads には by what it marks', () => {
    const [stack] = stacksIn(sentence('日本の田舎には、どんな習慣がありますか。').rows, 'en', glossEn)
    expect(stack.key).toBe('には')
    expect(stack.line).toMatch(/^に marks 日本の田舎 as where something is; は makes it the topic/)
  })

  it('reads a number and its counter as one word (plan 229l)', () => {
    const rows = sentence('駅で三十分待ちました。').rows
    const n = rows.find(r => r.t === '三十分')
    expect(n?.ro).toBe('sanjuppun')
    expect(n?.en).toEqual(['30 minutes'])
    expect(rows.some(r => r.t === '三十' || r.t === '分')).toBe(false)
  })

  it('names a particle in the breakdown by what it does there (plan 229l)', () => {
    const rows = sentence('駅で三十分待ちました。').rows
    expect(particleLabel(rows, rows.findIndex(r => r.t === 'で'), 'en')).toBe('place')
    expect(particleLabel(rows, rows.findIndex(r => r.t === 'で'), 'fr')).toBe('lieu')
    // から after a verb is “because”: no “from” label there.
    const why = LEVELS.flatMap(lv => banks[lv].sentences).map(s => s.rows)
      .flatMap(rs => rs.map((r, i) => [rs, i]).filter(([, i]) => rs[i].t === 'から' && rs[i - 1]?.pos === 'verb'))
    for (const [rs, i] of why) expect(particleLabel(rs, i, 'en')).toBeNull()
  })

  // A sentence's breakdown, as the gloss slide sets it (plan 234e).
  const broken = (jp, lang = 'en') => {
    const s = sentence(jp)
    return plan('sentence', banks[s.lv], s.id, { ...OPTS, lang }).funnel.breakdown
  }
  const glossOf = (jp, t, lang = 'en') => broken(jp, lang).find(x => x.t === t)?.main

  it('never glosses a word of the breakdown by its part of speech (plan 234e)', { timeout: 60000 }, () => {
    const names = new Set(['en', 'fr'].flatMap(lang => Object.values(STRINGS[lang].pos)))
    for (const lv of LEVELS) {
      for (const s of banks[lv].sentences) {
        for (const lang of ['en', 'fr']) {
          const items = plan('sentence', banks[lv], s.id, { ...OPTS, lang }).funnel.breakdown
          // A grammar word's (名前 is glossed « nom » in French: a word's own gloss may be one).
          for (const x of items.filter(y => y.line === 'grammar')) expect(names.has(x.main), `${s.id} ${lang} ${x.t}`).toBe(false)
        }
      }
    }
  })

  it('reads a pattern the tokenizer cut apart as one word, glossed once (plan 234e)', { timeout: 60000 }, () => {
    expect(broken('のどがいたいので、今日の講義は休みます。').map(x => x.t)).toContain('ので')
    expect(broken('学校の成績が優秀な人が、必ずしも仕事で成功するとは限らない。').map(x => x.t)).toContain('とは')
    for (const lv of LEVELS) {
      for (const s of banks[lv].sentences) {
        const items = plan('sentence', banks[lv], s.id, OPTS).funnel.breakdown
        // Never one pattern's line under two words side by side.
        items.forEach((x, i) => {
          const y = items[i + 1]
          if (y && x.line === 'grammar' && y.line === 'grammar' && x.main) expect(y.main, `${s.id} ${x.t}${y.t}`).not.toBe(x.main)
        })
        // Every row of the sentence is in exactly one word of it, in order.
        expect(items.map(x => x.t).join(''), s.id).toBe(s.rows.filter(r => r.k !== 'punct').map(r => r.t).join(''))
      }
    }
  })

  it('names a particle no point is written on by what the sentence settles, else leaves it bare (plan 234e)', () => {
    // まで after a verb is “until”, after に “even”.
    expect(glossOf('祖父は亡くなるまで、日記を書きつづけました。', 'まで')).toBe('until')
    expect(glossOf('給与が高いからといって、会社の人間関係にまで恵まれているとは限らない。', 'まで')).toBe('even · as far as')
    // と before a verb of saying quotes; after an adverb it makes one.
    expect(glossOf('息子は注射を怖がるから、病院には行きたくないと言う。', 'と')).toBe('that (quoting)')
    expect(glossOf('息子は注射を怖がるから、病院には行きたくないと言う。', 'と', 'fr')).toBe('que (citation)')
    expect(glossOf('発車のベルが鳴ると、乗客が次々と列車に乗りこむ。', 'と')).not.toBe('that (quoting)')
    // が before a comma after a clause is “but”; after a noun, the subject.
    // (Since plan 272 the point 〜が（逆接） is written on it, and says so.)
    expect(glossOf('都会に引っ越してだいぶ経つが、夜の騒音にはなかなか慣れない。', 'が')).toMatch(/^but/)
    expect(glossOf('この机は一人で持ち上げられないことはないが、腰を悪くしそうで心配だ。', 'が')).toMatch(/^but/)
    expect(glossOf('規模が小さいがゆえに、その企業は景気の変動に柔軟に対応できた。', 'が')).not.toBe('but')
    // ほど after これ, それ, あれ is “so”, after a number “about”.
    expect(glossOf('あれほど努力したのだから、彼女は試験に合格するに違いない。', 'ほど')).toBe('so (much)')
    expect(glossOf('医師の説明によると、手術の後は二週間ほど入院が必要らしい。', 'ほど')).toBe('about')
    // できるだけ is “as … as possible”, never “only”: one word since plan 272.
    expect(glossOf('会社の決まりにしたがって、休暇の予定をできるだけ早く上司に伝えた。', 'できるだけ')).toMatch(/as much as possible/)
    expect(glossOf('会社の決まりにしたがって、休暇の予定をできるだけ早く上司に伝えた。', 'だけ')).toBeUndefined()
    // A form of だ that makes an adverb of the word (真剣に), and one the tokenizer gave a particle: bare.
    expect(glossOf('経験が少ない人だって、真剣に練習を続ければ必ず上達する。', 'に')).toBe('makes an adverb')
    expect(glossOf('本当は二人の秘密に気付いていたが、私はわざと知らないふりをした。', 'に')).toBe('')
    // The copula で is never named a place: the tokenizer gave it to the
    // particle too often. Since plan 272 the breakdown reads 店で、 as the
    // particle it is, "where", and 大ざっぱで、 as 〜くて／〜で.
    expect(glossOf('この店で、この本がいちばん高いです。', 'で')).toBe('place')
    expect(glossOf('倹約を心掛ける几帳面な兄にひきかえ、弟は大ざっぱで、無駄遣いばかりしている。', 'で')).toMatch(/^joins/)
  })

  it('gives no stacked slide to a pair that is no two particles (plan 229l)', () => {
    const keys = jp => stacksIn(sentence(jp).rows, 'en', glossEn).map(x => x.key)
    expect(keys('判定に不服な監督は、今にも怒鳴らんばかりに審判に抗議した。')).not.toContain('にも')
    expect(keys('定期券を家に忘れたばかりに、往復とも切符を買わなければならなかった。')).not.toContain('とも')
    expect(keys('専門家とは言わないまでも、彼の考古学の知識はかなりのものだ。')).not.toContain('とは')
    expect(keys('住民への事前の説明なしに、会社は工場の建設に着工した。')).not.toContain('への')
  })

  it('names the right words around a stacked pair (plan 229l)', () => {
    const one = (jp, key) => stacksIn(sentence(jp).rows, 'en', glossEn).find(x => x.key === key)
    expect(one('地方への出張がてら、かつて赴任していた支店に立ち寄った。', 'への').next.t).toBe('出張')
    expect(one('何度飲んでも、この薬の苦さには慣れない。', 'には').host.t).toBe('薬の苦さ')
    expect(one('彼は誰にも相談せずに、会社をやめてしまった。', 'にも').line).toMatch(/nobody/)
    expect(one('今日はどこにも行きたくないです。', 'にも').line).toMatch(/nowhere/)
  })

  it('leaves a pattern’s own pieces unlabelled', () => {
    const h = how('のどがいたいので、今日の講義は休みます。', '〜ので')
    const lit = h.items.filter(x => x.lit)
    expect(lit.map(x => x.t).join('')).toBe('ので')
    expect(lit.every(x => x.label === '')).toBe(true)
  })

  // ── 宣伝, the promo stories (plan 231) ──────────────────────
  it('draws the pass in the band index.css prints it in', () => {
    const css = read('src/index.css')
    for (const [name, value] of Object.entries(APP_INKS)) expect(css, name).toMatch(new RegExp(`${name}:\\s*${value};`))
  })

  it('dates the print’s slip in the app’s own numerals', () => {
    for (let n = 1; n <= 31; n++) expect(kanjiNumber(n), String(n)).toBe(appKanjiNumber(n))
  })

  it('says the app’s own words on its own parts, in both languages', () => {
    for (const [lang, t] of [['en', EN], ['fr', FR]]) {
      const P = PROMO[lang]
      expect(P.ratings, lang).toEqual([t.wrongRated, t.wrongSeen, t.correctHesit, t.easy])
      expect(P.mastered, lang).toBe(t.mastered)
      expect(P.tap, lang).toBe(t.tapToReveal)
      expect(P.mode, lang).toBe(t.mode_vocab_flashcard_f2b)
      expect(P.depart, lang).toBe(t.depart)
      expect(P.unit, lang).toBe(t.dueUnit)
      expect(P.doneBy('08:14'), lang).toBe(t.gateEndsAt('08:14'))
    }
  })

  it('counts the way to N5 as the landing page counts it', () => {
    const facts = readFacts()
    expect(FIGURES.levels).toEqual(facts.levels)
    expect(FIGURES.kanaDeck).toBe(facts.kana)
    expect(FIGURES.examN5).toEqual({ questions: facts.exam.questions, minutes: facts.exam.minutes, pass: facts.exam.pass, max: facts.exam.max })
    for (const perDay of [5, 10, 20]) {
      expect(arrivals(FIGURES, perDay).map(a => spanOf(a.days)), String(perDay)).toEqual(landingArrivals(facts, perDay).map(a => landingSpan(a.days)))
    }
  })

  it('picks every story’s card, sentence and question from the bank', () => {
    for (const story of STORIES) {
      const data = bank(STORY_FILES[story])
      for (const lang of ['en', 'fr']) {
        const items = promoItems(story, data, lang)
        expect(items.length, `${story} ${lang}`).toBeGreaterThan(0)
        for (const { id } of items) {
          const pl = promoPlan(story, data, id, { ...OPTS, lang, story })
          expect([...pl.title].length, `${story} ${id}`).toBeLessThanOrEqual(TITLE_MAX)
          if (story === 'exam') {
            const { choices, right, word } = pl.promo
            expect(new Set(choices).size, id).toBe(4)
            expect(choices[right], id).toBeTruthy()
            expect(pl.promo.before + word + pl.promo.after, id).toBe(sentencesById[id].jp)
          }
          if (story === 'analyser') {
            expect(pl.promo.points.length, id).toBeGreaterThan(0)
            expect(pl.promo.points.every(pt => pt.gloss && pt.parts.length), id).toBe(true)
            expect(pl.promo.toks.map(x => x.t).join(''), id).toBe(sentencesById[id].jp)
          }
        }
      }
    }
  })

  it('promises nothing the app does not do today (plan 231)', () => {
    // No mode is priced and nothing is free "during early access": the
    // free pass, the kana line and the privacy are what a story may say.
    for (const lang of ['en', 'fr']) {
      const words = JSON.stringify(PROMO[lang], (k, v) => (typeof v === 'function' ? String(v) : v))
      expect(words, lang).not.toMatch(/early access|accès anticipé|unlimited|illimité|€|\$\d/i)
    }
  })

  it('draws every story’s cover and call to action as seven-second clips, each ending on its still (plan 231)', () => {
    expect(CLIP).toEqual({ seconds: 7, fps: 30 })
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      for (const story of STORIES) {
        const data = bank(STORY_FILES[story])
        const [{ id }] = promoItems(story, data, 'en')
        const pl = promoPlan(story, data, id, { ...OPTS, story })
        const frames = promoDeck(pl, FORMATS.story, { ground: 'sumi' })
        expect(frames.clip, story).toBeTruthy()
        expect(frames.clip.print, story).toBe(story === 'pitch')
        for (const t of [0, 1, 3.5, 4.3, 6.99]) {
          const { ctx } = stubContext()
          expect(() => frames.clip.draw(ctx, t), `${story} at ${t}s`).not.toThrow()
        }
        // The clip ends on what the still says, all in (the analyser's on
        // the sentence cut, which it shows being cut).
        const still = stubContext()
        frames[story === 'analyser' ? 1 : 0].draw(still.ctx)
        const end = stubContext()
        frames.clip.draw(end.ctx, 6.99)
        for (const w of still.texts.filter(x => /[A-Za-z]{4}/.test(x) && !/Tap to/i.test(x))) expect(end.texts, `${story}: ${w}`).toContain(w)
        // The call to action too, its gate waiting to the end.
        const { end: cta } = frames.clips
        expect(cta.print, story).toBe(false)
        for (const t of [0, 0.5, 2, 4, 6.4]) expect(() => cta.draw(stubContext().ctx, t), `${story} end at ${t}s`).not.toThrow()
        const last = stubContext()
        frames[frames.length - 1].draw(last.ctx)
        const ctaEnd = stubContext()
        cta.draw(ctaEnd.ctx, 6.99)
        for (const w of last.texts.filter(x => /[A-Za-z]{4}/.test(x))) expect(ctaEnd.texts, `${story} end: ${w}`).toContain(w)
      }
    } finally {
      globalThis.Path2D = had
    }
  })

  it('scores every clip with the app’s own sounds, on its own clock (plan 231)', () => {
    const { FILL_FROM, FILL_SPAN, FILL_CURVE, BURST_AT } = LEVEL_CLOCK
    expect(LEVEL).toEqual({ FILL_FROM, FILL_SPAN, FILL_CURVE, BURST_AT })
    const keys = new Set(VOICE_EVENTS.map(e => e.key))
    // The duels' story is scored with the duel's own sounds too (plan
    // 281b), those lib/audio/duel.js plays, from their shipped files.
    const duelSounds = new Set(DUEL_AUDIO.sounds)
    for (const story of STORIES) {
      const data = bank(STORY_FILES[story])
      const [{ id }] = promoItems(story, data, 'en')
      const { clips } = promoDeck(promoPlan(story, data, id, { ...OPTS, story }), FORMATS.story, { ground: 'sumi' })
      for (const [which, clip] of Object.entries(clips)) {
        expect(clip.sounds.length, `${story} ${which}`).toBeGreaterThan(0)
        for (const s of clip.sounds) {
          const name = s.duel ?? s.key
          if (s.duel) {
            expect(story, name).toBe('duel')
            expect(duelSounds.has(name), `${story} ${which}: ${name}`).toBe(true)
            expect(() => read(`public/sounds/duel/${DUEL_AUDIO.rev}/fx-${name}.mp3`), name).not.toThrow()
          } else expect(keys.has(name), `${story} ${which}: ${name}`).toBe(true)
          expect(s.at, `${story} ${which}: ${name}`).toBeGreaterThanOrEqual(0)
          expect(s.at, `${story} ${which}: ${name}`).toBeLessThan(clip.seconds)
        }
      }
    }
  })

  // ── 対戦, the duels' story (plan 281) ──────────────────────────────
  const duelBank = bank('duel.json')
  const constant = (file, name) => read(`../backend/${file}`).match(new RegExp(`^${name} = (.+)$`, 'm'))?.[1]
  const int = v => Number(String(v).replace(/_/g, ''))

  it('plays the opening of a paper the duels still deal, on the backend’s own figures (plan 281)', () => {
    // A paper made under another revision is a paper no duel deals any
    // more: run python -m scripts.carousel_bank again.
    expect(duelBank.paper).toBe(JSON.parse(constant('study/duel_paper.py', 'PAPER_REV')))
    expect(duelBank.level).toBe('N5')
    expect(duelBank.elo.start).toEqual(JSON.parse(constant('study/duel_elo.py', 'START')))
    expect(duelBank.elo.k).toBe(int(constant('study/duel_elo.py', 'K_SETTLED')))
    expect(duelBank.xp.cap).toBe(int(constant('study/duels.py', 'XP_CAP')))
    expect(duelBank.hold).toEqual({ right: int(constant('study/duels.py', 'RIGHT_HOLD_MS')), wrong: int(constant('study/duels.py', 'LOCK_MS')) })
    const xp = read('../backend/srs/xp.py')
    const paid = q => Number(xp.match(new RegExp(`^\\s+${q}: (\\d+),`, 'm'))[1])
    expect(duelBank.xp).toMatchObject({ right: paid(4), wrong: paid(1) })
    // Dealt where the learner's Elo stands (plan 286): in tenths of a
    // level above N5, each level's start a whole one, the two levels it
    // stands between asked in their share.
    const steps = int(constant('study/duel_paper.py', 'STEPS'))
    const levels = JSON.parse(constant('study/duel_paper.py', 'LEVELS').replace(/^\(/, '[').replace(/\)$/, ']'))
    const { start } = duelBank.elo
    expect(duelBank.mix).toBe(Math.round((DUEL_RUN.you.elo - start.N5) / ((start.N4 - start.N5) / steps)))
    const low = Math.floor(duelBank.mix / steps)
    const part = duelBank.mix % steps
    expect(duelBank.blend).toEqual(part
      ? [{ level: levels[low], share: (steps - part) / steps }, { level: levels[low + 1], share: part / steps }]
      : [{ level: levels[low], share: 1 }])
    expect(duelBank.level).toBe(levels[Math.floor((duelBank.mix + steps / 2) / steps)])
    for (const q of duelBank.items) {
      expect(['word', 'reading', 'writing'], `${q.n}`).toContain(q.kind)
      const choices = Array.isArray(q.choices) ? [q.choices] : [q.choices.en, q.choices.fr]
      for (const c of choices) {
        expect(c.length, `${q.n}`).toBe(4)
        expect(new Set(c).size, `${q.n}`).toBe(4)
        expect(c[q.answer], `${q.n}`).toBeTruthy()
      }
    }
  })

  it('scores the story’s runs as the server scores its paper’s, combo and rush included (plans 281, 281b)', () => {
    // The rules the bank's runs were scored by are the server's own.
    const duels = read('../backend/study/duels.py')
    const tiers = [...constant('study/duels.py', 'COMBO_TIERS').matchAll(/\((\d+), ([\d.]+)\)/g)].map(m => ({ at: Number(m[1]), mult: Number(m[2]) }))
    expect(tiers.length).toBeGreaterThan(0)
    expect(duelBank.rules).toEqual({ tiers, rushMs: int(constant('study/duels.py', 'RUSH_MS')) })
    // The sprint its revision is run at (study/duels.SPRINT_MS_BY_REV).
    expect(duelBank.sprint).toBe(int(duels.match(new RegExp(`"${duelBank.paper}": ([\\d_]+)`))[1]))
    expect(duelBank.sprint).toBe(SPRINT_MS)
    const top = int(duels.match(/^TOP, FLOOR = (\d+), (\d+)$/m)[1])
    const multAt = streak => tiers.reduce((m, x) => (streak >= x.at ? x.mult : m), 1)
    // Each answer, after the hold of the one before: what its speed is
    // worth (a wrong one nothing), what its streak multiplies it by, what
    // the rush pays once more, the total it leaves.
    for (const side of ['you', 'them']) {
      const run = duelBank[side]
      let served = 0
      let streak = 0
      let total = 0
      let best = 0
      run.forEach((a, i) => {
        const at = `${side} ${i}`
        expect(a.n, at).toBe(i)
        expect(a.t - a.ms, at).toBe(served)
        expect(a.t, at).toBeLessThanOrEqual(duelBank.sprint)
        expect(a.pts, at).toBe(a.right ? points(a.ms) : 0)
        streak = a.right ? streak + 1 : 0
        best = Math.max(best, streak)
        const mult = a.right ? multAt(streak) : 1
        expect(a.combo, at).toBe(Math.floor(a.pts * (mult - 1) + 0.5))
        expect(a.rush, at).toBe(a.t >= duelBank.sprint - duelBank.rules.rushMs ? a.pts : 0)
        expect(a.scored, at).toBe(a.pts + a.combo + a.rush)
        total += a.scored
        expect(a.total, at).toBe(total)
        expect(a.streak, at).toBe(streak)
        expect(a.mult, at).toBe(multAt(streak))
        served = a.t + (a.right ? duelBank.hold.right : duelBank.hold.wrong)
      })
      // The next question would come after the sprint: the run ran to its end.
      expect(served).toBeGreaterThan(duelBank.sprint - LIMIT_MS)
      const sum = k => run.reduce((t, a) => t + a[k], 0)
      expect(duelBank.lines[side], side).toMatchObject({
        speed: sum('pts'), combo: sum('combo'), rush: sum('rush'), best,
        flashes: run.filter(a => a.pts >= top).length, rights: run.filter(a => a.right).length, answered: run.length,
      })
    }
    // Both streaks pay (the learner's to its last tier), both runs reach
    // the rush, and the story has a streak broken to show.
    expect(Math.max(...duelBank.you.map(a => a.mult))).toBe(tiers.at(-1).mult)
    for (const side of ['you', 'them']) expect(duelBank.lines[side].rush, side).toBeGreaterThan(0)
    for (const lang of ['en', 'fr']) {
      const run = duelRun(duelBank, lang)
      run.answers.forEach((a, i) => {
        const q = run.items[a.n]
        expect(a.pick === q.answer, `${lang} ${i}`).toBe(a.right)
        expect(q.choices[a.pick], `${lang} ${i}`).toBeTruthy()
      })
      const last = run.answers.at(-1)
      expect(run.next).toBe(last.t + (last.right ? duelBank.hold.right : duelBank.hold.wrong))
      expect(run.broke.length).toBeGreaterThan(0)
      // The lead changes hands both ways, and the learner wins.
      expect(run.passes.some(x => x.me) && run.passes.some(x => !x.me)).toBe(true)
      expect(run.passes.at(-1).me).toBe(true)
      expect(run.final).toEqual({ mine: duelBank.you.at(-1).total, theirs: duelBank.them.at(-1).total })
      expect(run.final.mine).toBeGreaterThan(run.final.theirs)
      // The result: the XP the answers pay, the day's cap at most, the Elo
      // by the classic expectation at the settled K, the board climbed a place.
      const { you, them } = DUEL_RUN
      const L = duelBank.lines.you
      expect(run.xp.paid).toBe(Math.min(duelBank.xp.cap, L.rights * duelBank.xp.right + (L.answered - L.rights) * duelBank.xp.wrong))
      expect(run.xp.left).toBe(duelBank.xp.cap - run.xp.paid)
      expect(run.elo.delta).toBe(Math.round(duelBank.elo.k * (1 - 1 / (1 + 10 ** ((them.elo - you.elo) / 400)))))
      expect(run.elo.trend.at(-1)).toBe(run.elo.after)
      expect(run.elo.trend.length).toBe(20)
      expect(run.elo.start).toBe(duelBank.elo.start[you.level])
      const place = list => list.find(r => r.me).rank
      expect(place(run.board.after)).toBe(place(run.board.before) - 1)
    }
  })

  it('says the app’s own words on the duel’s parts, in both languages (plan 281)', () => {
    for (const [lang, t] of [['en', EN], ['fr', FR]]) {
      const D = PROMO[lang].duel
      expect(D.you, lang).toBe(t.pvpYou)
      expect(D.go, lang).toBe(t.pvpGo)
      expect(D.kinds, lang).toEqual(t.pvpKind)
      expect(D.duelLevel, lang).toBe(t.pvpDuelLevel)
      expect(D.questions, lang).toBe(t.pvpQuestions)
      expect(D.wordsKanji, lang).toBe(t.pvpWordsKanji)
      expect(D.sprint, lang).toBe(t.pvpSprintOf(SPRINT_MS))
      // The run's (plan 285): its head, its bands, the combo, a change of
      // hands, the notes; the result's lines, its verdict and its margin.
      expect(D.duelWith('Hana'), lang).toBe(t.pvpDuelWith('Hana'))
      expect(D.ready, lang).toBe(t.pvpReady)
      expect(D.goBand, lang).toBe(t.pvpGoBand)
      expect(D.arrival, lang).toBe(t.pvpArrival)
      expect(D.rushWord, lang).toBe(t.pvpRush)
      expect(D.comboCap, lang).toBe(t.pvpCombo)
      expect(D.comboLost(7), lang).toBe(t.pvpComboLost(7))
      expect(D.passMe, lang).toBe(t.pvpPassMe)
      expect(D.passThem('Hana'), lang).toBe(t.pvpPassThem('Hana'))
      expect(D.notes, lang).toEqual(t.pvpNote)
      expect(D.lines, lang).toEqual(t.pvpLines)
      expect(D.inARow(69, 45), lang).toBe(t.pvpInARow(69, 45))
      expect(D.verdict, lang).toEqual(t.pvpVerdict)
      for (const n of [1, 3577]) expect(D.aheadBy(n), lang).toBe(t.pvpAhead(n))
      expect(D.elo, lang).toBe(t.pvpElo)
      expect(D.xpLeft(51), lang).toBe(t.pvpXpLeft(51))
      expect(D.startAt('1 000'), lang).toBe(t.pvpStartAt('1 000'))
      expect(D.peak('1 224'), lang).toBe(t.pvpPeak('1 224'))
      for (const r of [1, 3]) expect(D.gapTo(27, r), lang).toBe(t.pvpGapTo(27, r))
    }
  })

  it('draws the duels’ parts in the inks index.css gives each theme (plan 281)', () => {
    const css = read('src/index.css')
    const escape = v => v.replace(/[()[\].]/g, '\\$&')
    for (const [theme, inks] of Object.entries(DUEL_INKS)) {
      for (const [name, value] of Object.entries(inks)) expect(css, `${theme} ${name}`).toMatch(new RegExp(`${name}:\\s*${escape(value)};`))
    }
    // T1's own paint (plan 285), part by part.
    const T1 = {
      panto: ['.pvp-t1__panto', 'stroke'], body: ['.pvp-t1__body', 'fill'], rule: ['.pvp-t1__body', 'stroke'],
      glass: ['.pvp-t1__cab', 'fill'], skirt: ['.pvp-t1__skirt', 'fill'], bogie: ['.pvp-t1__bogie', 'fill'], lamp: ['.pvp-t1__lamp', 'fill'],
      meGlass: ['.pvp-loco--me .pvp-t1__cab', 'fill'], meSkirt: ['.pvp-loco--me .pvp-t1__skirt', 'fill'],
    }
    expect(Object.keys(T1).sort()).toEqual(Object.keys(T1_INKS).sort())
    for (const [part, [rule, prop]] of Object.entries(T1)) {
      expect(css, part).toMatch(new RegExp(`(^|\\n)${escape(rule)}\\s*\\{[^}]*${prop}:\\s*${T1_INKS[part]};`))
    }
  })

  it('writes the mix the way the app’s ticket does (plan 286)', () => {
    const run = read('src/screens/DuelRun.jsx')
    const share = "m.share.toLocaleString(lang, { style: 'percent', maximumFractionDigits: 0 })"
    expect(run).toContain(share)
    expect(run).toContain("words.join(' · ')")
    expect(read('carousel/promo.js')).toContain(share)
  })

  it('lets the race’s screen reach below the safe box to just above the feed’s caption (plan 281c)', () => {
    // TikTok's caption starts at y 1710 (draw.js); the story's words keep
    // to the safe box, a picture of the app may reach the frame's foot.
    const tiktok = frame(FORMATS.story)
    expect(tiktok.foot).toBeGreaterThan(tiktok.bottom)
    expect(tiktok.foot).toBeLessThan(1710)
    const normal = frame(formatOf('story', 'normal'))
    expect(normal.foot).toBe(normal.bottom)
    expect(frame(FORMATS.post).foot).toBe(frame(FORMATS.post).bottom)
  })

  it('plays the duels’ story whole, beat after beat, ending at the gate (plan 281)', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      for (const lang of ['en', 'fr']) {
        const pl = promoPlan('duel', duelBank, 'duel', { ...OPTS, lang, story: 'duel' })
        const frames = promoDeck(pl, FORMATS.story, { ground: 'sumi' })
        expect(frames.map(f => f.key)).toEqual(DUEL_BEATS.map(([key]) => key))
        const { story } = frames.clips
        // The race: its opening and its end in real time, the middle run fast.
        const clock = raceClock(pl.promo)
        expect(clock.m(clock.s(pl.promo.answers[10].t))).toBeCloseTo(pl.promo.answers[10].t, 3)
        expect(clock.m(clock.end)).toBe(pl.promo.sprint)
        expect(story.seconds).toBeCloseTo(DUEL_BEATS.reduce((t, [, len]) => t + (len ?? clock.length), 0), 5)
        expect(story.fps).toBe(CLIP.fps)
        expect(story.print).toBe(false)
        for (let t = 0; t < story.seconds; t += 0.37) expect(() => story.draw(stubContext().ctx, t), `${lang} at ${t}s`).not.toThrow()
        // Every beat's words are said in the story, and it ends on the
        // call to action's.
        // A beat's headline lands word by word, its other lines whole.
        const said = new Set()
        for (let t = 0; t < story.seconds; t += 0.1) {
          const { ctx, texts } = stubContext()
          story.draw(ctx, t)
          texts.forEach(x => x.split(' ').forEach(w => said.add(w)))
        }
        const D = PROMO[lang].duel
        // The ticket says what the paper asks as the app's does (plan 286,
        // DuelRun's Mix): each level and its share, beside the bar.
        const ticket = stubContext()
        frames[0].draw(ticket.ctx)
        const pct = v => v.toLocaleString(lang, { style: 'percent', maximumFractionDigits: 0 })
        expect(ticket.texts).toContain(duelBank.blend.map(m => `${m.level} ${pct(m.share)}`).join(' · '))
        expect(ticket.texts.join(' ')).not.toMatch(/plus bas|lower of/)
        const top = multOf(Math.max(...duelBank.rules.tiers.map(x => x.mult)), lang)
        const lines = [D.combo(top), D.rush(duelBank.rules.rushMs / 1000)]
        for (const line of [...D.hook(SPRINT_MS / 1000), D.versus, D.same, D.fast(100), D.ahead, ...lines, D.winElo, D.eloIs, D.climb]) {
          for (const word of weldIf(lang, line).split(' ')) expect(said, `${lang}: ${word}`).toContain(word)
        }
        const last = stubContext()
        frames.at(-1).draw(last.ctx)
        const end = stubContext()
        story.draw(end.ctx, story.seconds - 0.01)
        for (const w of last.texts.filter(x => /[A-Za-z]{4}/.test(x))) expect(end.texts, `${lang} end: ${w}`).toContain(w)
      }
    } finally {
      globalThis.Path2D = had
    }
  })
})

describe('the word echo (plan 232)', () => {
  const themes = bank('themes.json')
  const voices = JSON.parse(readFileSync(new URL('../carousel/voices/index.json', import.meta.url), 'utf8'))

  it('has the app’s reader, livelier, for every pictured word, in the current voice', () => {
    expect(voices.rev).toBe(VOICE_REV)
    expect(voices.credit).toBe('VOICEVOX Nemo')
    // The reader, livelier: the take the owner picked (scripts/carousel_voices.py's ENERGY).
    expect(voices.energy).toEqual({ speed: 1.1, intonationScale: 1.45, pitchScale: 0.04, volumeScale: 1.15 })
    const items = echoItems(themes, 'en')
    expect(items.length).toBeGreaterThan(400)
    for (const { id } of items) {
      const r = id.split('::')[1]
      expect(voices.words[r], r).toBeTruthy()
      expect(() => readFileSync(new URL(`../carousel/voices/${voices.words[r]}`, import.meta.url)), r).not.toThrow()
    }
  })

  it('says the word with the same silence between every two sayings, inside ten seconds', () => {
    expect(ECHO.gap).toBe(0.3)
    for (const span of [{ on: 0.14, off: 0.48 }, { on: 0.14, off: 0.67 }, { on: 0.13, off: 1.2 }]) {
      const at = beats(span)
      const voiced = span.off - span.on
      expect(at[0]).toBe(ECHO.first)
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeCloseTo(voiced + ECHO.gap, 2)
      expect(at.at(-1) + voiced).toBeLessThanOrEqual(ECHO.seconds)
      // One more would not have ended inside the clip.
      expect(at.at(-1) + voiced + ECHO.gap + voiced).toBeGreaterThan(ECHO.seconds - 0.1)
    }
    // A short word is said more often than a long one.
    expect(beats({ on: 0.1, off: 0.4 }).length).toBeGreaterThan(beats({ on: 0.1, off: 1.0 }).length)
  })

  it('lays the readings anywhere but on the card’s word, its credit and the masthead, each read', { timeout: 60000 }, () => {
    const fmt = FORMATS.story
    for (const { id } of echoItems(themes, 'en').filter((_, i) => i % 9 === 0)) {
      const pl = echoPlan(themes, id, { lang: 'en' })
      const { spots, keep, clip } = echoDeck(pl, fmt, { ground: 'sumi' })
      expect(spots.length, id).toBe(clip.beats.length)
      for (const s of spots) {
        // Over the card's edges if it likes, never over what must stay read.
        for (const k of keep) expect(touches(s, { x: k.x + k.w / 2, y: k.y + k.h / 2, w: k.w, h: k.h, tilt: 0 }), id).toBe(false)
        // Whole on the screen, never cut.
        const bw = Math.abs(s.w * Math.cos(s.tilt)) + Math.abs(s.h * Math.sin(s.tilt))
        const bh = Math.abs(s.w * Math.sin(s.tilt)) + Math.abs(s.h * Math.cos(s.tilt))
        expect(s.x - bw / 2 >= 0 && s.x + bw / 2 <= fmt.w && s.y - bh / 2 >= 0 && s.y + bh / 2 <= fmt.h, id).toBe(true)
        expect(s.z, id).toBeGreaterThanOrEqual(40)
      }
      // No reading's middle under another's.
      for (let i = 0; i < spots.length; i++) for (let j = 0; j < i; j++) {
        const core = o => ({ ...o, w: o.w * 0.7, h: o.h * 0.7 })
        expect(touches(core(spots[i]), core(spots[j])), `${id} ${i} ${j}`).toBe(false)
      }
    }
  })

  it('lands its readings on a recording of its own, which plays whole under it', () => {
    const pl = echoPlan(themes, '人参::にんじん', { lang: 'en' })
    const beatsAt = [0.46, 1.04, 1.54, 2.11, 2.78]
    const { clip, spots } = echoDeck(pl, FORMATS.story, { ground: 'sumi', track: { src: 'sound.mp3', seconds: 15.384, beats: beatsAt } })
    expect(clip.seconds).toBe(15.384)
    expect(clip.beats).toEqual(beatsAt)
    expect(spots.length).toBe(beatsAt.length)
    expect(clip.sounds).toEqual([{ at: 0, src: 'sound.mp3' }])
  })

  it('finds where the voice starts and stops in its clip', () => {
    const rate = 1000
    const samples = new Float32Array(1000)
    for (let i = 150; i < 700; i++) samples[i] = 0.3 * Math.sin(i)
    const { on, off } = voiceSpan(samples, rate)
    expect(on).toBeCloseTo(0.15, 2)
    expect(off).toBeCloseTo(0.7, 2)
  })

  it('draws ten seconds that fill the screen with the reading, the voice credited', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
    for (const lang of ['en', 'fr']) {
      for (const id of ['人参::にんじん', '犬::いぬ', '自転車::じてんしゃ']) {
        const pl = echoPlan(themes, id, { lang })
        expect(pl.id, id).toBe(id)
        expect([...pl.title].length, id).toBeLessThanOrEqual(TITLE_MAX)
        expect(pl.caption.ask, id).toMatch(/VOICEVOX Nemo/)
        const voice = { src: 'x.mp3', on: 0.14, off: 0.14 + 0.11 * [...pl.echo.word.r].length }
        const frames = echoDeck(pl, FORMATS.story, { ground: 'sumi', voice })
        const { clip } = frames
        expect(clip.seconds).toBe(10)
        expect(clip.sounds.map(x => x.at), id).toEqual(clip.beats.map(a => Math.max(0, a - voice.on)))
        expect(clip.sounds.every(x => x.src === 'x.mp3'), id).toBe(true)
        // Before the first saying, the card alone; at the end, every saying on the screen.
        const first = stubContext()
        clip.draw(first.ctx, 0.3)
        expect(first.texts.filter(x => x === pl.echo.word.r).length, id).toBe(1)
        for (const t of [1, 4.5, 9.99]) expect(() => clip.draw(stubContext().ctx, t)).not.toThrow()
        const end = stubContext()
        clip.draw(end.ctx, 9.99)
        expect(end.texts.filter(x => x === pl.echo.word.r).length, id).toBe(clip.beats.length + 1)
        expect(end.texts.some(x => /VOICEVOX Nemo/.test(x)), id).toBe(true)
        const still = stubContext()
        frames[0].draw(still.ctx)
        expect(still.texts.sort(), id).toEqual(end.texts.sort())
      }
    }
    } finally {
      globalThis.Path2D = had
    }
  })
})

describe('the long videos (plan 233)', () => {
  const files = {}
  for (const lv of LEVELS) for (const f of [`${lv}.json`, `words-${lv}.json`, `kanji-${lv}.json`, `grammar-${lv}.json`]) files[f] = bank(f)
  files['themes.json'] = bank('themes.json')
  const withPath2D = fn => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try { fn() } finally { globalThis.Path2D = had }
  }
  // Every part of a video drawn: at each segment's start, its middle, each mark and its end.
  const drawsWhole = (pl, tl) => {
    for (const sg of tl.segs) {
      const marks = Object.values(sg.marks).flat().filter(x => typeof x === 'number')
      for (const u of [0, sg.dur / 2, ...marks, ...marks.map(m => m + 0.5), sg.dur - 0.01]) {
        expect(() => drawLong(stubContext().ctx, pl, tl, sg.start + Math.min(u, sg.dur - 0.01)), `${pl.title} ${sg.type} ${u}`).not.toThrow()
      }
    }
  }

  it('makes each kind, in both languages, and draws every part of it', () => withPath2D(() => {
    for (const lang of ['en', 'fr']) {
      for (const kind of KINDS) {
        const pl = longPlan(kind, files, { lang, level: 'N5', point: '〜てください' })
        const tl = timeline(pl)
        expect(pl.items.length, kind).toBeGreaterThan(kind === 'grammar' ? 10 : 20)
        expect(tl.segs[0].type).toBe('intro')
        expect(tl.segs.at(-1).type).toBe('outro')
        drawsWhole(pl, tl)
      }
    }
  }), 120000)

  it('lasts about ten minutes a part, its lines guessed', () => {
    for (const kind of ['vocab', 'kanji', 'quiz']) {
      for (const level of ['N5', 'N3']) {
        const tl = timeline(longPlan(kind, files, { level }))
        expect(tl.seconds / 60, `${kind} ${level}`).toBeGreaterThan(6)
        expect(tl.seconds / 60, `${kind} ${level}`).toBeLessThan(13)
      }
    }
  })

  it('never deals one item in two parts of a level', () => {
    for (const kind of ['vocab', 'kanji', 'quiz']) {
      const key = it => it.t ? `${it.t}::${it.r}` : it.c || it.q.from
      const one = longPlan(kind, files, { level: 'N5', part: 1 }).items.map(key)
      const two = longPlan(kind, files, { level: 'N5', part: 2 }).items.map(key)
      expect(two.length, kind).toBeGreaterThan(10)
      expect(one.filter(x => two.includes(x)), kind).toEqual([])
      expect(new Set(one).size, kind).toBe(one.length)
    }
    expect(longPlan('vocab', files, { level: 'N5', part: 1 }).items[0].t).toBe(bank('words-N5.json').words[0].t)
  })

  it('asks a quiz of four answers, one right, the word of a kanji at the level', () => {
    for (const level of LEVELS) {
      const pl = longPlan('quiz', files, { level })
      expect(pl.items.length, level).toBe(PART.quiz)
      const easy = Object.fromEntries(Object.entries(bank(`kanji-${level}.json`).kanji).map(([c, k]) => [c, new Set((k.words || []).filter(w => Number(String(w.lv).slice(1)) >= Number(level.slice(1))).map(w => w.t))]))
      for (const { q } of pl.items) {
        expect(q.choices.length).toBe(4)
        expect(q.right).toBeGreaterThanOrEqual(0)
        expect(q.right).toBeLessThan(4)
        if (q.from.startsWith('kanji:') && [...(q.stem.specimen || '')].length > 1) expect(easy[q.from.slice(6)].has(q.stem.specimen), q.stem.specimen).toBe(true)
        const said = answered(q)
        if (said) expect(said, q.id).not.toMatch(/[＿_]/)
      }
    }
  })

  it('explains a whole point: rule, examples cut word by word, its questions', () => withPath2D(() => {
    for (const level of LEVELS) {
      const lessons = bank(`grammar-${level}.json`).lessons
      for (const L of lessons.filter((_, i) => i % 9 === 0)) {
        const pl = longPlan('grammar', files, { level, point: L.p })
        const types = pl.items.map(x => x.type)
        expect(types[0], L.p).toBe('gtitle')
        expect(types.at(-1), L.p).toBe('grecap')
        expect(types.filter(x => x === 'gex').length, L.p).toBeGreaterThanOrEqual(Math.min(3, (L.ex || []).length))
        for (const it of pl.items.filter(x => x.type === 'q')) {
          expect(it.q.choices[it.q.right], L.p).toBeTruthy()
          // A twist's translation is held back until it is answered (CLAUDE.md, the quiz).
          if (it.twist) expect(it.q.ask, L.p).not.toContain(it.q.explain.sense)
        }
        drawsWhole(pl, timeline(pl))
      }
    }
  }), 120000)

  it('glosses a word of the breakdown from the deck, or leaves it bare', () => {
    expect(dictionaryForms('読んで')).toContain('読む')
    expect(dictionaryForms('書いて')[0]).toBe('書く')
    expect(dictionaryForms('行って')[0]).toBe('行く')
    expect(dictionaryForms('したい')).toContain('する')
    expect(dictionaryForms('ふったら')).toContain('ふる')
    expect(shortGloss('please (give me, please do)')).toBe('please')
    expect(shortGloss('to be, to have (used for inanimate objects)')).toBe('to be, to have')
    // (a later sense that needs its note is left out: no bare "to take")
    expect(shortGloss('to drink, to take (medicine)')).toBe('to drink')
    const chips = longPlan('grammar', files, { level: 'N5', point: '〜たいです' }).items.filter(x => x.type === 'gex').flatMap(x => x.chips)
    const of = t => chips.find(c => c.t === t)?.gloss
    expect(of('飲みたい')).toBe('to drink')
    expect(of('行きたい')).toBe('to go')
    expect(of('したい')).toMatch(/^to do/)
    // しゅうまつ, which the tokenizer cuts into two names, is one word
    // (plan 272), and no half of it a chip of its own.
    expect(chips.find(c => c.t === 'しゅうまつ')).toBeDefined()
    expect(of('しゅう')).toBeUndefined()
    expect(of('まつ')).toBeUndefined()
    // Every chip is said, a particle as it sounds: the topic は is "wa".
    const wa = longPlan('grammar', files, { level: 'N5', point: 'は' }).items.filter(x => x.type === 'gex').flatMap(x => x.chips)
    expect(wa.find(c => c.t === 'は').voice).toBe('わ')
    expect(wa.every(c => c.voice), 'a chip left unsaid').toBe(true)
  })

  it('times its chapters for YouTube and credits the voice', () => {
    for (const kind of KINDS) {
      const pl = longPlan(kind, files, { level: 'N5', point: 'は' })
      const tl = timeline(pl)
      const lines = chapterText(tl).split('\n')
      expect(lines[0], kind).toMatch(/^0:00 /)
      expect(lines.length, kind).toBeGreaterThanOrEqual(3)
      const at = lines.map(l => l.split(' ')[0].split(':').reduce((m, s) => m * 60 + Number(s), 0))
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], `${kind} ${lines[i]}`).toBeGreaterThanOrEqual(10)
      const { title, description, tags } = describeVideo(pl, tl, 'https://example.org', bank('index.json').figures)
      expect(title.length, kind).toBeLessThanOrEqual(100)
      expect(title, kind).toMatch(/N5/)
      expect(description, kind).toMatch(/VOICEVOX Nemo/)
      expect(description, kind).toContain(chapterText(tl))
      expect(description, kind).toContain('https://example.org')
      // The app's deck counted from the bank, never written by hand.
      expect(description, kind).toContain(bank('index.json').figures.kanji.toLocaleString('en-US'))
      // A lone syllable is the kana deck's recording: its voice is credited.
      expect(description.includes('波音リツ'), kind).toBe(tl.cues.some(c => /^[ぁ-んァ-ン][ゃゅょャュョ]?$/.test(c.text)))
      expect(tags.length, kind).toBeLessThanOrEqual(500)
      // The voice is measured line by line under the key long_video_audio.py files it by.
      expect(new Set(tl.cues.map(cueKey)).size).toBeGreaterThan(0)
    }
    expect(read('../backend/scripts/long_video_audio.py')).toContain(`return f"{cue['who']}|{'slow' if cue.get('slow') else ''}|{cue['text']}"`)
    expect(cueKey({ who: 'reader', slow: true, text: 'あ' })).toBe('reader|slow|あ')
    // A sentence for some words only: the description says how many.
    const vocab = longPlan('vocab', files, { level: 'N5' })
    const some = vocab.items.filter(x => x.ex).length
    expect(describeVideo(vocab, timeline(vocab), 'x').description).toContain(`for ${some} of them`)
    // A theme spans the levels: none is named.
    const theme = longPlan('vocab', files, { theme: Object.keys(bank('themes.json').themes)[0], lang: 'fr' })
    const page = describeVideo(theme, timeline(theme), 'x')
    expect(page.title).not.toMatch(/JLPT|N\d/)
    expect(page.tags).not.toMatch(/JLPT|N\d/)
  })

  it('offers every video a level can make in the studio, each made by its command', () => {
    expect(SOURCES.find(s => s.id === 'long')?.video).toBe(true)
    expect(LONG_SITE).toBe(SITE_ORIGIN)
    for (const level of LEVELS) {
      const listed = Object.fromEntries(longListFiles(level).map(f => [f, files[f]]))
      const items = longItems(listed, level, 'en')
      const kinds = new Set(items.map(x => x.kind))
      expect([...kinds].sort(), level).toEqual(['grammar', 'kanji', 'quiz', 'theme', 'vocab'])
      expect(new Set(items.map(x => x.id)).size, level).toBe(items.length)
      expect(items.filter(x => x.kind === 'grammar').length, level).toBe(bank(`grammar-${level}.json`).lessons.length)
      // Every listed video is drawn from the files it says it reads, the last part of each kind too.
      const sample = ['vocab', 'kanji', 'quiz', 'grammar', 'theme'].flatMap(k => { const of = items.filter(x => x.kind === k); return [of[0], of.at(-1)] })
      for (const it of sample) {
        const own = Object.fromEntries([...longListFiles(level), ...longFiles(it.id, level)].map(f => [f, files[f]]))
        const { kind, opts } = longPick(it.id, level, 'en')
        const pl = longPlan(kind, own, opts)
        expect(pl.items.length, `${level} ${it.id}`).toBeGreaterThan(0)
        const cmd = longCommand(it.id, level, 'en')
        expect(cmd, it.id).toMatch(new RegExp(`--kind ${kind}`))
        if (opts.part) expect(cmd, it.id).toContain(`--part ${opts.part}`)
      }
    }
    // A vocabulary part reads the sentences of its level and the easier ones only.
    expect(longFiles('vocab:1', 'N3')).toEqual(['words-N3.json', 'N5.json', 'N4.json', 'N3.json'])
    expect(longCommand('grammar:〜てください', 'N5', 'fr')).toBe("VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --kind grammar --level N5 --point '〜てください' --lang fr")
  })

  it('draws a still once: two frames that look the same share a key', () => withPath2D(() => {
    const pl = longPlan('vocab', files, { level: 'N5', count: 3 })
    const tl = timeline(pl)
    const sg = tl.segs[1]
    const key = u => drawLong(stubContext().ctx, pl, tl, sg.start + u)
    expect(key(1.1)).toBe(key(1.2))
    expect(key(1.2)).not.toBe(key(2.2))
    expect(key(sg.marks.meaning + 1)).not.toBe(key(1.2))
  }))
})

describe('the short formats (plan 233)', () => {
  const files = {}
  for (const lv of LEVELS) for (const f of [`${lv}.json`, `words-${lv}.json`, `kanji-${lv}.json`, `grammar-${lv}.json`]) files[f] = bank(f)
  files['themes.json'] = bank('themes.json')
  const withPath2D = fn => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try { fn() } finally { globalThis.Path2D = had }
  }

  it('cuts each long video to a standing minute, drawn whole', () => withPath2D(() => {
    for (const lang of ['en', 'fr']) {
      for (const kind of KINDS) {
        for (const level of ['N5', 'N2']) {
          const pl = fitShort(longPlan(kind, files, { lang, level, format: 'short', point: bank(`grammar-${level}.json`).lessons[1].p }))
          const tl = timeline(pl)
          expect(pl.format, kind).toBe('short')
          expect(tl.seconds, `${kind} ${level}`).toBeLessThanOrEqual(SHORT.seconds)
          expect(tl.seconds, `${kind} ${level}`).toBeGreaterThan(20)
          if (kind !== 'grammar') expect(pl.items.length, kind).toBeLessThanOrEqual(SHORT[kind])
          for (const sg of tl.segs) {
            for (const u of [0, sg.dur / 2, ...Object.values(sg.marks).flat().filter(x => typeof x === 'number'), sg.dur - 0.01]) {
              expect(() => drawLong(stubContext().ctx, pl, tl, sg.start + Math.min(u, sg.dur - 0.01)), `${kind} ${sg.type} ${u}`).not.toThrow()
            }
          }
          const page = describeVideo(pl, tl, 'https://example.org', bank('index.json').figures)
          expect(page.title.length, kind).toBeLessThanOrEqual(100)
          expect(page.title, kind).toMatch(/#shorts$/)
          expect(page.description, kind).toMatch(/VOICEVOX Nemo/)
          expect(page.description, kind).toMatch(/#Shorts/)
        }
      }
    }
    // A grammar short: its form, two examples said once, one question.
    const g = longPlan('grammar', files, { format: 'short', point: '〜てください' })
    expect(g.items.map(x => x.type)).toEqual(['gtitle', 'gex', 'gex', 'q'])
    expect(timeline(g).cues.filter(c => c.slow)).toEqual([])
  }), 120000)

  it('times a carousel as a short: each slide read, a question answered, its line said at the reveal', () => {
    expect(slideSeconds(0, 'cover').hold).toBe(2.4)
    expect(slideSeconds(400, 'point').hold).toBe(7)
    expect(slideSeconds(40, 'question-1').hold - slideSeconds(40, 'answer-1').hold).toBe(4)
    const slides = ['hook', 'question-1', 'answer-1', 'outro'].map(key => ({ key, draw: () => {} }))
    const tl = shortTimeline(slides, [30, 40, 40, 20], '駅で友だちに会います。')
    expect(tl.segs.map(x => x.key)).toEqual(['hook', 'question-1', 'answer-1', 'outro'])
    expect(tl.cues).toHaveLength(1)
    expect(tl.cues[0].at).toBeGreaterThan(tl.segs[2].start)
    expect(tl.cues[0].at).toBeLessThan(tl.segs[2].start + tl.segs[2].dur)
    expect(tl.sfx.filter(x => x.key === 'click')).toHaveLength(4)
    expect(tl.sfx.some(x => x.key === 'correct' && x.at > tl.segs[2].start)).toBe(true)
    expect(tl.seconds).toBeCloseTo(tl.segs.reduce((a, x) => a + x.dur, 0), 2)
    // Past a minute every hold tightens alike, a question still four seconds to answer.
    const exam = ['cover', 'question-1', 'answer-1', 'question-2', 'answer-2', 'question-3', 'answer-3', 'sheet', 'outro'].map(key => ({ key }))
    const long = shortTimeline(exam, [60, 120, 160, 120, 160, 120, 160, 200, 80], 'まいげつ')
    expect(long.seconds).toBeLessThanOrEqual(59.01)
    for (const sg of long.segs.filter(x => x.ask)) {
      const ticks = long.sfx.filter(x => x.key === 'click' && x.at >= sg.start && x.at < sg.start + sg.dur)
      expect(ticks).toHaveLength(4)
      expect(sg.start + sg.dur - ticks[0].at).toBeCloseTo(4, 2)
    }
    const reveal = long.segs.find(x => x.key === 'answer-3')
    expect(long.cues[0].at).toBeGreaterThan(reveal.start)
    expect(long.cues[0].at).toBeLessThan(reveal.start + reveal.dur)
    // A swipe is two slides at once; a held slide one, and the same key while still.
    const drawn = []
    const live = slides.map((sl, i) => ({ ...sl, draw: () => drawn.push(i) }))
    const { ctx } = stubContext()
    expect(drawShortFrame(ctx, live, tl, tl.segs[1].start + SWIPE / 2)).toMatch(/^1\|/)
    expect(drawn).toEqual([0, 1])
    expect(drawShortFrame(ctx, live, tl, tl.segs[1].start + 1)).toBe(drawShortFrame(ctx, live, tl, tl.segs[1].start + 2))
  })

  it('makes a short of every source’s carousel, its line and page its own', () => withPath2D(() => {
    for (const src of STATIONED) {
      const { data, filter } = filesOf(src)[0]
      const { id } = itemsOf(src.id, data, 'en', filter)[0]
      const pl = plan(src.id, data, id, OPTS, depsFor(src, data, id))
      const type = TYPES.map(x => x.id).find(x => available(x, pl))
      const slides = deck(type, pl, FORMATS.story, { ground: 'paper' })
      // Counted as each draws in the studio and the renderer (a browser's measure); here a fixed count.
      const counts = slides.map(() => 40)
      const line = spokenLine(pl)
      if (['sentence', 'word', 'kana', 'translation', 'lesson', 'theme'].includes(src.id)) expect(line, src.id).toMatch(/[ぁ-んァ-ン一-龯]/)
      if (line) expect(line, src.id).not.toMatch(/[（）a-z]/i)
      const tl = shortTimeline(slides, counts, line)
      expect(tl.segs).toHaveLength(slides.length)
      const page = shortPage(pl, type, null, 'https://example.org', !!line)
      expect(page.title.length, src.id).toBeLessThanOrEqual(100)
      expect(page.title, src.id).toMatch(/#shorts$/)
      expect(page.description.includes('VOICEVOX Nemo'), src.id).toBe(!!line)
    }
    // What a slide writes, each character once.
    expect(chars({ draw: ctx => { ctx.fillText('駅で', 0, 0); ctx.fillText('station', 0, 0) } }, { fillText() {} })).toBe(9)
    const st = { source: 'word', level: 'N5', id: '写真::しゃしん', type: 'plates', lang: 'fr', slides: { word: { strokes: false } } }
    expect(fromRecipe(recipeOf(st))).toEqual(st)
    expect(recipeOf(st)).toMatch(/^[\w-]+$/)
  }))
})

describe('the conversion carousels (plan 234)', () => {
  // The slides after the call to action: the detail and the suite.
  const SUITE = /^(more|question-|answer-)/
  const withPath2D = fn => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try { fn() } finally { globalThis.Path2D = had }
  }
  // The first item of every file of every source, in English; of each
  // source's first file, in French too.
  const some = []
  for (const src of STATIONED) {
    filesOf(src).forEach(({ data, filter }, n) => {
      const { id } = itemsOf(src.id, data, 'en', filter)[0]
      for (const lang of n ? ['en'] : ['en', 'fr']) some.push({ src, id, lang, p: plan(src.id, data, id, { ...OPTS, lang }, depsFor(src, data, id)) })
    })
  }
  const types = p => TYPES.map(x => x.id).filter(x => available(x, p))

  it('walks every type of every source: the hook, the answer, the app, then the detail and the key points', { timeout: 120000 }, () => withPath2D(() => {
    for (const { src, id, lang, p } of some) {
      for (const type of types(p)) {
        const where = `${src.id} ${id} ${lang} ${type}`
        expect(funnelOf(type, p), where).toBeTruthy()
        for (const design of DESIGNS) {
          const five = deck(type, p, FORMATS.post, { design, length: '5' }).map(x => x.key)
          expect(five.slice(0, 3), where).toEqual(['ask', 'answer', 'cta'])
          expect(five.slice(3).every(k => k === 'keys' || SUITE.test(k)), where).toBe(true)
          // The studio's length: to the call to action, then the key points, then the detail.
          expect(deck(type, p, FORMATS.post, { design, length: '3' }).map(x => x.key), where).toEqual(['ask', 'answer', 'cta'])
          expect(deck(type, p, FORMATS.post, { design, length: '4' }).map(x => x.key), where).toEqual(five.filter(k => !SUITE.test(k)))
        }
        for (const [design, fmt] of [['clarte', FORMATS.post], ['defi', FORMATS.story], ['fiche', FORMATS.post]]) {
          for (const sl of deck(type, p, fmt, { design })) expect(() => sl.draw(stubContext().ctx), `${where} ${design} ${sl.key}`).not.toThrow()
        }
      }
    }
  }))

  it('says a few key points, each one the bank already says', () => {
    for (const { src, id, lang, p } of some) {
      const keys = p.funnel.keys
      expect(keys.length, `${src.id} ${id}`).toBeGreaterThan(0)
      expect(keys.length, `${src.id} ${id}`).toBeLessThanOrEqual(3)
      expect(new Set(keys).size, `${src.id} ${id}`).toBe(keys.length)
      for (const k of keys) {
        expect(k, `${src.id} ${id}`).not.toMatch(/undefined|null|\[object|NaN/)
        // French punctuation is welded to its word (DESIGN.md).
        if (lang === 'fr') expect(k, `${src.id} ${id}`).not.toMatch(/ [:;!?]/)
      }
      // Each says what kind of point it is, a kind the slide can name (plan 234c).
      expect(p.funnel.notes.map(n => n.text), `${src.id} ${id}`).toEqual(keys)
      for (const n of p.funnel.notes) expect(FUNNEL[lang].kinds[n.kind], `${src.id} ${id} ${n.kind}`).toBeTruthy()
    }
    // A point that says again what one before it said gives way to it.
    const lesson = some.find(x => x.src.id === 'lesson' && x.lang === 'en')
    const prose = lesson.p.funnel.notes.filter(n => ['use', 'mean', 'careful', 'contrast'].includes(n.kind))
    expect(new Set(prose.map(n => n.kind)).size, 'lesson').toBe(prose.length)
  })

  it('promotes the feature an item comes from, drawn, never a figure', () => withPath2D(() => {
    for (const lang of ['en', 'fr']) {
      for (const f of FEATURES) {
        const F = FUNNEL[lang].features[f]
        expect(F.name && F.line && F.short, `${lang} ${f}`).toBeTruthy()
        // What a feature does, not how many: a level's name (N5) is the one figure.
        expect(F.line.replace(/N\d/g, ''), `${lang} ${f}`).not.toMatch(/\d/)
      }
    }
    const sentencePlan = some.find(x => x.src.id === 'sentence' && x.lang === 'en').p
    // A sentence shows the reading practice, its own run (plan 234b).
    expect(funnelOf('plates', sentencePlan).feature).toBe('reading')
    expect(funnelOf('exam', sentencePlan).feature).toBe('exam')
    expect(funnelOf('build', sentencePlan).feature).toBe('translation')
    const studied = {
      translation: 'translation', passage: 'comprehension', lesson: 'grammar', word: 'words', kanji: 'kanji', kana: 'kana',
      theme: 'words', lookalike: 'kanji', dialogue: 'grammar', trap: 'grammar',
    }
    for (const { src, p } of some) if (studied[src.id]) expect(funnelOf('plates', p).feature, src.id).toBe(studied[src.id])
    // Any feature can stand in any carousel's call to action, on either ground.
    for (const { p } of some.filter(x => x.lang === 'fr').slice(0, 4)) {
      for (const feature of FEATURES) {
        for (const design of DESIGNS) {
          const cta = deck('plates', p, FORMATS.story, { design, feature }).find(x => x.key === 'cta')
          const { ctx, texts } = stubContext()
          cta.draw(ctx)
          expect(texts.join(' '), feature).toContain(FUNNEL.fr.features[feature].name)
        }
      }
    }
  }))

  it('has a call to action for every practice mode, the questions after them and Today', () => {
    for (const f of ['reading', 'comprehension', 'translation', 'listen', 'composition', 'exam', 'ask', 'today', 'analyser']) expect(FEATURES, f).toContain(f)
    // The question asked after an exercise is answered by the bank's own line on its point.
    const { p } = some.find(x => x.src.id === 'sentence' && x.lang === 'en')
    const { ctx, texts } = stubContext()
    deck('plates', p, FORMATS.post, { design: 'clarte', feature: 'ask' }).find(x => x.key === 'cta').draw(ctx)
    const point = p.funnel.points[0]?.pattern
    if (point && p.funnel.keys.some(k => k.includes(point) && k.length <= 140)) {
      expect(texts.join(' '), point).toContain(FUNNEL.en.features.ask.ask(point))
    }
  })

  it('never asks a question and answers it on the same slide', () => withPath2D(() => {
    const asks = d => d && (d.kind === 'question' || d.kind === 'turn' || (d.kind === 'pictures' && d.odd != null))
    for (const { src, id, lang, p } of some) {
      for (const type of types(p)) {
        const F = funnelOf(type, p)
        const where = `${src.id} ${id} ${lang} ${type}`
        // A question after the call to action is left to the reader, never shown answered...
        if (asks(F.detail)) {
          expect(F.detail.yours, where).toBe(true)
          expect(!F.detail.revealed && !F.detail.reveal, where).toBe(true)
          // ... and answered on the slide after it (unless an earlier slide
          // had answered it, and another took its place).
          const slides = deck(type, p, FORMATS.post, { design: 'clarte', length: '5' })
          const keys = slides.map(x => x.key)
          const at = keys.indexOf('question-2')
          if (at >= 0) {
            expect(keys[at + 1], where).toBe('keys')
            const { ctx, texts } = stubContext()
            slides.at(-1).draw(ctx)
            // The kicker is set letter by letter: read it without its spaces.
            const flat = t => t.replace(/\s/g, '')
            expect(flat(texts.join('')), where).toContain(flat(FUNNEL[lang].yoursAnswer.toLocaleUpperCase()))
          }
        }
        // The answer slide shows the solution alone, never the question again.
        if (F.hook.kind === 'question' && F.solution.kind === 'question' && F.hook.q.ask) {
          const { ctx, texts } = stubContext()
          deck(type, p, FORMATS.post, { design: 'clarte', length: '3' })[1].draw(ctx)
          expect(texts.join(' '), where).not.toContain(F.hook.q.ask)
        }
        // A text is asked its question before the slide that answers it.
        if (F.hook.kind === 'passage' && F.solution.kind === 'question') expect(F.hook.q, where).toBe(F.solution.q)
      }
    }
  }))

  it('deals longer carousels on request, each question answered on the slide after it', { timeout: 120000 }, () => withPath2D(() => {
    for (const { src, id, lang, p } of some) {
      for (const type of types(p)) {
        const where = `${src.id} ${id} ${lang} ${type}`
        let before = 0
        // A sentence's breakdown is dealt whole, its later slides past the length (plan 234d).
        const pages = (funnelOf(type, p, { fmt: FORMATS.post }).lead || []).filter(d => d.kind === 'gloss').length
        for (const length of ['5', '6', '7', '8']) {
          const keys = deck(type, p, FORMATS.post, { design: 'clarte', length }).map(x => x.key)
          // Never more than asked, never fewer than a shorter one, the key points last.
          expect(keys.length, where).toBeLessThanOrEqual(+length + Math.max(0, pages - (+length - 4)))
          expect(keys.length, where).toBeGreaterThanOrEqual(before)
          before = keys.length
          expect(new Set(keys).size, where).toBe(keys.length)
          keys.forEach((k, i) => {
            // A question's answer is the next slide; the last question's, the key points.
            if (k.startsWith('question-')) expect([`answer-${k.slice(9)}`, 'keys'], where).toContain(keys[i + 1])
            if (k.startsWith('answer-')) expect(keys[i - 1], where).toBe(`question-${k.slice(7)}`)
          })
        }
      }
    }
  }))

  it('breaks a sentence down whole after the call to action, and asks nothing more', { timeout: 120000 }, () => withPath2D(() => {
    for (const { src, id, lang, p } of some.filter(x => x.src.id === 'sentence' || x.src.id === 'translation')) {
      const words = p.funnel.breakdown
      for (const type of types(p)) {
        const where = `${src.id} ${id} ${lang} ${type}`
        for (const fmt of [FORMATS.post, FORMATS.story]) {
          const pages = funnelOf(type, p, { fmt }).lead.filter(d => d.kind === 'gloss')
          // Every word once, in the sentence's order, over as many slides as it takes.
          expect(pages.flatMap(d => d.items.map(it => it.t)), where).toEqual(words.map(it => it.t))
          expect(pages.every((d, i) => d.page === i + 1 && d.pages === pages.length), where).toBe(true)
          // A slide never starts on a particle or an ending: it rides the word before it.
          for (const d of pages.slice(1)) expect(p.funnel.rows[d.items[0].i].k, where).toBe('word')
          const slides = deck(type, p, fmt, { design: 'clarte', length: '8' })
          const keys = slides.map(x => x.key)
          expect(keys.some(k => /^(question|answer)-/.test(k)), where).toBe(false)
          // The breakdown follows the call to action, every word read under it.
          const at = keys.indexOf('cta')
          pages.forEach((d, i) => {
            const { ctx, texts } = stubContext()
            slides[at + 1 + i].draw(ctx)
            for (const it of d.items.filter(x => x.ro)) expect(texts, `${where} ${it.t}`).toContain(it.ro)
          })
        }
      }
    }
  }))

  it('draws every word of the impostor as a picture, never an empty tile', () => {
    const data = bank('themes.json')
    for (const lang of ['en', 'fr']) {
      for (const { id } of itemsOf('theme', data, lang)) {
        const F = funnelOf('impostor', plan('theme', data, id, { ...OPTS, lang }))
        if (!F) continue
        for (const s of [F.hook, F.solution, F.detail].filter(Boolean)) expect(s.words.every(w => w.e), `${id} ${lang}`).toBe(true)
      }
    }
  })

  it('holds a hook as long as a question in a short', () => {
    expect(slideSeconds(40, 'ask').ask).toBe(true)
    expect(slideSeconds(40, 'answer').ask).toBe(false)
  })
})
