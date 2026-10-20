import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { FORMATS, FS, RATING_INKS, drawFeedHud, formatOf, layoutSentence, palette, reading } from '../carousel/draw.js'
import { LEVELS, SOURCES, TITLE_MAX, chunksOf, depsOf, itemsOf, lineRomaji, picked, plan, readingMisses, themePartOf, titleOf, unpack } from '../carousel/sources.js'
import { ENDING_IDS, TYPES, available, deck, endingSlide } from '../carousel/slides.js'
import { assemblyQ, kanjiQuizzes, overlaps, withoutGiveaways } from '../carousel/quizzes.js'
import { furiganaOf } from '../carousel/common.js'
import { howItWorks, particleLabel, senseOf, stacksIn } from '../carousel/explain.js'
import { STRINGS, weld, weldIf } from '../carousel/strings.js'
import { APP_INKS } from '../carousel/app.js'
import { CLIP, LEVEL, PROMO, STORIES, STORY_FILES, arrivals, kanjiNumber, promoDeck, promoItems, promoPlan, spanOf } from '../carousel/promo.js'
import { ECHO, beats, echoDeck, echoItems, echoPlan, touches, voiceSpan } from '../carousel/echo.js'
import { LIMIT, SWIPE, chars, drawShortFrame, fromRecipe, recipeOf, shortPage, shortTimeline, slideSeconds, spokenLine } from '../carousel/short.js'
import { TUNABLES, tuned } from '../carousel/tune.js'
import { DESIGNS, FEATURES, WORDS as FUNNEL, funnelOf, readInks, readable, unstopped } from '../carousel/funnel.js'
import { KINDS, LONG_SITE, PART, REPLY_SHORT, SHORT, TALL, fitShort, answered, chapterText, cueKey, describe as describeVideo, dictionaryForms, drawLong, longCommand, longFiles, longItems, longListFiles, longPick, longPlan, shortGloss, stillAt, timeline } from '../carousel/long.js'
import { SITE_ORIGIN } from '../landing/config.mjs'
import { CH as CHALLENGE, CPM, SCROLL, TRACK, TRACKS, STYLES as CHALLENGE_STYLES, challengeCommand, challengeCues, challengeItems, challengePage, challengePlan, challengeQuestions, challengeTimeline, cueKey as challengeKey, drawChallenge, moraeOf, wordTimes } from '../carousel/challenge.js'
import { CAPTION_MAX, FEEDS, HASHTAGS, pageFile } from '../carousel/feeds.js'
import { COUNT as WORDS_COUNT, LIMIT as WORDS_LIMIT, STYLES as WORDS_STYLES, drawWords, loadPictures, shortSense, wordsCommand, wordsFiles, wordsItems, wordsPage, wordsPlan, wordsTimeline } from '../carousel/words.js'
import { LEVEL_CLOCK, VOICE_EVENTS } from './lib/audio/recipes.js'
import { VOICE_REV } from './lib/audio/speech.js'
import { kanjiNumber as appKanjiNumber } from './domain/dayClear.js'
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
const STATIONED = SOURCES.filter(s => s.id !== 'promo' && s.id !== 'echo' && !s.video)

/** A 9:16 video's three posts (plan 251): YouTube's page as it is, and a
 *  caption each for Reels and TikTok that opens on the hook, links to
 *  nothing of ours ("in bio"), keeps every credit, carries five hashtags
 *  at most and never #shorts, and fits Instagram's 2,200 characters. */
function expectFeeds(page, site, label) {
  expect(Object.keys(page.feeds), label).toEqual(FEEDS)
  expect(page.feeds.shorts, label).toEqual({ title: page.title, description: page.description, tags: page.tags })
  const credits = page.description.split('\n').filter(l => /VOICEVOX|MacLeod|Music|Musique/.test(l))
  for (const f of ['reels', 'tiktok']) {
    const c = page.feeds[f].caption
    const at = `${label} ${f}`
    expect(c.split('\n')[0], at).toBe(page.title.replace(/\s*#shorts$/i, ''))
    expect([...c].length, at).toBeLessThanOrEqual(CAPTION_MAX)
    expect(c, at).not.toContain(new URL(site).host)
    expect(c, at).toMatch(/(Link in|Lien en) bio\./)
    const tags = c.match(/#[^\s#]+/g) || []
    expect(tags.length, at).toBeGreaterThanOrEqual(3)
    expect(tags.length, at).toBeLessThanOrEqual(HASHTAGS)
    expect(tags.map(t => t.toLowerCase()), at).not.toContain('#shorts')
    for (const line of credits) for (const part of line.split(/(?<=\.) /)) expect(c, at).toContain(part.replace(/^▸.*$/, '').trim())
  }
  expect(page.feeds.reels.caption, label).not.toBe(page.feeds.tiktok.caption)
}
const LAST = { promo: id => (id === 'pass' ? 'free' : 'board'), echo: () => 'keep' }

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

  // Every plan of every source, built once for the tests below (a video,
  // long or a reading challenge, is drawn by tests of its own).
  const every = []
  for (const src of SOURCES.filter(x => !x.video)) {
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
        // A promo story ends on its own gate, not on a station (plan 231);
        // Read it on the app's call to action, in any look (plan 253).
        expect(slides.at(-1).key, `${src.id} ${id} ${type}`).toBe(type === 'read' ? 'cta' : LAST[src.id]?.(id) ?? 'outro')
        expect(new Set(slides.map(x => x.key)).size, `${src.id} ${id} ${type}`).toBe(slides.length)
      }
    }
  })

  it('ends on any of the endings, for every source, in both formats', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      // Read it's own sentences are read and nothing else (plan 254).
      for (const src of STATIONED.filter(x => x.id !== 'short')) {
        const { p } = every.find(x => x.src === src)
        // Read it ends on the app's call to action, never an ending (plan 253).
        const type = TYPES.map(x => x.id).find(x => x !== 'plates' && x !== 'read' && available(x, p)) || 'plates'
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
        const fmt = formatOf(n % 2 ? 'post' : 'story', Math.floor(n / 2) % 2 ? 'instagram' : 'normal')
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
    // 何とか is one word, never 何 と 叶った (plan 248).
    expect(new Set(read('何とか'))).toEqual(new Set(['なん']))
    expect(rows.some(r => r.t === 'かなった')).toBe(false)
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
    expect(glossOf('都会に引っ越してだいぶ経つが、夜の騒音にはなかなか慣れない。', 'が')).toBe('but')
    expect(glossOf('この机は一人で持ち上げられないことはないが、腰を悪くしそうで心配だ。', 'が')).toBe('but')
    expect(glossOf('規模が小さいがゆえに、その企業は景気の変動に柔軟に対応できた。', 'が')).not.toBe('but')
    // ほど after これ, それ, あれ is “so”, after a number “about”.
    expect(glossOf('あれほど努力したのだから、彼女は試験に合格するに違いない。', 'ほど')).toBe('so (much)')
    expect(glossOf('医師の説明によると、手術の後は二週間ほど入院が必要らしい。', 'ほど')).toBe('about')
    // できるだけ is “as … as possible”, never “only”.
    expect(glossOf('会社の決まりにしたがって、休暇の予定をできるだけ早く上司に伝えた。', 'だけ')).toBe('as … as possible')
    // A form of だ that makes an adverb of the word (急に), and one the tokenizer gave a particle: bare.
    expect(glossOf('急に寒くなると、体の具合が悪くなります。', 'に')).toBe('makes an adverb')
    expect(glossOf('本当は二人の秘密に気付いていたが、私はわざと知らないふりをした。', 'に')).toBe('')
    // The copula で is the particle too often (この店で): always bare.
    expect(glossOf('この店で、この本がいちばん高いです。', 'で')).toBe('')
  })

  it('gives no stacked slide to a pair that is no two particles (plan 229l)', () => {
    const keys = jp => stacksIn(sentence(jp).rows, 'en', glossEn).map(x => x.key)
    expect(keys('この棚は古くて、今にも壊れそうです。')).not.toContain('にも')
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
      expect(P.ratings, lang).toEqual([t.wrongRated, t.wrongSeen, t.difficult, t.correctHesit])
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
    for (const story of STORIES) {
      const data = bank(STORY_FILES[story])
      const [{ id }] = promoItems(story, data, 'en')
      const { clips } = promoDeck(promoPlan(story, data, id, { ...OPTS, story }), FORMATS.story, { ground: 'sumi' })
      for (const [which, clip] of Object.entries(clips)) {
        expect(clip.sounds.length, `${story} ${which}`).toBeGreaterThan(0)
        for (const s of clip.sounds) {
          expect(keys.has(s.key), `${story} ${which}: ${s.key}`).toBe(true)
          expect(s.at, `${story} ${which}: ${s.key}`).toBeGreaterThanOrEqual(0)
          expect(s.at, `${story} ${which}: ${s.key}`).toBeLessThan(CLIP.seconds)
        }
      }
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

  it('lands its readings on a recording of its own, which plays whole under it, then keeps the word', () => {
    const pl = echoPlan(themes, '人参::にんじん', { lang: 'en' })
    const beatsAt = [0.46, 1.04, 1.54, 2.11, 2.78]
    const { clip, spots } = echoDeck(pl, FORMATS.story, { ground: 'sumi', track: { src: 'sound.mp3', seconds: 15.384, beats: beatsAt } })
    expect(clip.keepAt).toBe(15.384)
    expect(clip.seconds).toBeCloseTo(15.384 + ECHO.keep, 3)
    expect(clip.beats).toEqual(beatsAt)
    expect(spots.length).toBe(beatsAt.length)
    expect(clip.sounds.filter(x => x.src)).toEqual([{ at: 0, src: 'sound.mp3' }])
    expect(clip.sounds.filter(x => x.key).every(x => x.at > 15.384)).toBe(true)
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
        // Ten seconds of sayings, then the word kept once the last has been said.
        const voiced = voice.off - voice.on
        expect(clip.keepAt, id).toBeCloseTo(clip.beats.at(-1) + voiced + ECHO.after, 3)
        expect(clip.keepAt, id).toBeLessThanOrEqual(ECHO.seconds + ECHO.after)
        expect(clip.seconds, id).toBeCloseTo(clip.keepAt + ECHO.keep, 3)
        const said = clip.sounds.filter(x => x.src)
        expect(said.map(x => x.at), id).toEqual(clip.beats.map(a => Math.max(0, a - voice.on)))
        expect(said.every(x => x.src === 'x.mp3'), id).toBe(true)
        // The ending's own sounds are the app's, after the last saying.
        expect(clip.sounds.filter(x => x.key).map(x => x.key), id).toEqual(['board-flap', 'platform-chime'])
        // Before the first saying, the card alone; at the end, every saying on the screen.
        const first = stubContext()
        clip.draw(first.ctx, 0.3)
        expect(first.texts.filter(x => x === pl.echo.word.r).length, id).toBe(1)
        for (const t of [1, 4.5, clip.keepAt - 0.01, clip.keepAt + 0.3, clip.seconds - 0.01]) expect(() => clip.draw(stubContext().ctx, t)).not.toThrow()
        const end = stubContext()
        clip.draw(end.ctx, clip.keepAt - 0.01)
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

  it('ends on the word kept: the ask, the review that brings it back, the theme and the way to the app (plan 246)', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      for (const lang of ['en', 'fr']) {
        for (const { id } of echoItems(themes, lang).filter((_, i) => i % 23 === 0)) {
          const pl = echoPlan(themes, id, { lang })
          const theme = Object.values(themes.themes).find(th => th.words.some(w => `${w.t}::${w.r}` === id))
          expect(pl.echo.keepLine, id).toContain(` ${theme.words.length - 1} `)
          const frames = echoDeck(pl, FORMATS.story, { ground: 'paper', voice: { src: 'x.mp3', on: 0.14, off: 0.6 } })
          expect(frames.map(f => f.key), id).toEqual(['echo', 'keep'])
          const kept = stubContext()
          frames[1].draw(kept.ctx)
          // The ask and its line whole, the site's address in its bar.
          expect(kept.texts.join(' '), id).toContain(pl.echo.keep)
          expect(kept.texts.join(' ').replace(/\s+/g, ' '), id).toContain(pl.echo.keepLine)
          expect(kept.texts, id).toContain('tsuji.app')
          // The clip's last frame is the ending, as it stands still.
          const last = stubContext()
          frames.clip.draw(last.ctx, frames.clip.seconds - 0.01)
          expect(last.texts.sort(), id).toEqual(kept.texts.sort())
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
  files['conversation.json'] = bank('conversation.json')
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
        // A reply video: two scenes and six questions (plan 249).
        expect(pl.items.length, kind).toBeGreaterThan(kind === 'grammar' ? 10 : kind === 'reply' ? 7 : 20)
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
    const chips = longPlan('grammar', files, { level: 'N5', point: '〜たいです' }).items.filter(x => x.type === 'gex').flatMap(x => x.chips)
    const of = t => chips.find(c => c.t === t)?.gloss
    expect(of('飲みたい')).toBe('to drink')
    expect(of('行きたい')).toBe('to go')
    expect(of('したい')).toMatch(/^to do/)
    // しゅうまつ cut in two by the tokenizer: neither half is a word of its own.
    expect(of('しゅう')).toBe('')
    expect(of('まつ')).toBe('')
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
      expect([...kinds].sort(), level).toEqual(['grammar', 'kanji', 'quiz', 'reply', 'theme', 'vocab'])
      expect(new Set(items.map(x => x.id)).size, level).toBe(items.length)
      expect(items.filter(x => x.kind === 'grammar').length, level).toBe(bank(`grammar-${level}.json`).lessons.length)
      // Every listed video is drawn from the files it says it reads, the last part of each kind too.
      const sample = ['vocab', 'kanji', 'quiz', 'grammar', 'theme', 'reply'].flatMap(k => { const of = items.filter(x => x.kind === k); return [of[0], of.at(-1)] })
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
  files['conversation.json'] = bank('conversation.json')
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
          // A reply short is one scene whole, past the minute, under Shorts' three (plan 249b).
          expect(tl.seconds, `${kind} ${level}`).toBeLessThanOrEqual(kind === 'reply' ? REPLY_SHORT : SHORT.seconds)
          expect(tl.seconds, `${kind} ${level}`).toBeGreaterThan(20)
          if (kind !== 'grammar' && kind !== 'reply') expect(pl.items.length, kind).toBeLessThanOrEqual(SHORT[kind])
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
          expectFeeds(page, 'https://example.org', `${kind} ${level} ${lang}`)
        }
      }
    }
    // A grammar short: its form, two examples said once, one question.
    const g = longPlan('grammar', files, { format: 'short', point: '〜てください' })
    expect(g.items.map(x => x.type)).toEqual(['gtitle', 'gex', 'gex', 'q'])
    expect(timeline(g).cues.filter(c => c.slow)).toEqual([])
  }), 120000)

  it('keeps a 9:16 slide and a short inside Instagram’s feed crop, clear of its header, caption and buttons (plan 239)', () => withPath2D(() => {
    const ig = formatOf('story', 'instagram')
    expect([ig.id, ig.w, ig.h, ig.fit]).toEqual(['story', 1080, 1920, 'instagram'])
    // The feed shows the middle 4:5, 285 cut at the top and the foot, its header over the crop's top 110.
    const crop = (1920 - 1350) / 2
    expect(ig.safe.t).toBeGreaterThanOrEqual(crop + 110)
    // Full screen, a reel's caption stands from ~1450 and its buttons down the right.
    expect(ig.h - ig.safe.b).toBeLessThanOrEqual(1450)
    expect(ig.safe.r).toBeGreaterThanOrEqual(140)
    expect(ig.safe.l).toBe(ig.safe.r)
    // A 4:5 post is shown whole: Instagram's are the normal margins.
    expect(formatOf('post', 'instagram').safe).toEqual(formatOf('post', 'normal').safe)
    // The guide draws Instagram's feed over a 9:16 slide, never over a post.
    const drawn = fmt => {
      const calls = []
      const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => calls.push(k)), set: (o, k, v) => { o[k] = v; return true } })
      drawFeedHud(ctx, fmt)
      return calls.filter(k => k === 'fillRect' || k === 'fill').length
    }
    expect(drawn(ig)).toBeGreaterThan(0)
    expect(drawn(formatOf('post', 'instagram'))).toBe(0)
    // A long video's short: TikTok's moved whole into Instagram's box, and said so on its command.
    const { kind, opts } = longPick('vocab:1', 'N5', 'en', 'short')
    const pl = fitShort(longPlan(kind, files, { ...opts, fit: 'instagram' }))
    expect(pl.fit).toBe('instagram')
    expect(fitShort(longPlan(kind, files, opts)).fit).toBe('tiktok')
    const tl = timeline(pl)
    const scales = []
    const { ctx: base } = stubContext()
    const ctx = new Proxy(base, { get: (o, k) => (k === 'scale' ? (x, y) => scales.push([x, y]) : o[k]), set: (o, k, v) => { o[k] = v; return true } })
    drawLong(ctx, pl, tl, tl.segs[1].start + 1)
    const box = s => [1080 - s.l - s.r, 1920 - s.t - s.b]
    const [tw, th] = box({ t: 250, r: 144, b: 430, l: 144 })
    const [iw, ih] = box(ig.safe)
    expect(scales[0][0]).toBeCloseTo(Math.min(iw / tw, ih / th), 5)
    expect(longCommand('vocab:1', 'N5', 'en', 'short', 'instagram')).toContain('--format short --fit instagram')
    expect(longCommand('vocab:1', 'N5', 'en', 'short')).not.toContain('--fit')
    expect(longCommand('vocab:1', 'N5', 'en', 'long', 'instagram')).not.toContain('--fit')
  }))

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
      if (['sentence', 'short', 'word', 'kana', 'translation', 'lesson', 'theme'].includes(src.id)) expect(line, src.id).toMatch(/[ぁ-んァ-ン一-龯]/)
      if (line) expect(line, src.id).not.toMatch(/[（）a-z]/i)
      const tl = shortTimeline(slides, counts, line)
      expect(tl.segs).toHaveLength(slides.length)
      const page = shortPage(pl, type, null, 'https://example.org', !!line)
      expect(page.title.length, src.id).toBeLessThanOrEqual(100)
      expect(page.title, src.id).toMatch(/#shorts$/)
      expect(page.description.includes('VOICEVOX Nemo'), src.id).toBe(!!line)
      expectFeeds(page, 'https://example.org', src.id)
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
  // Read it's own sentences have tests of their own (plan 254).
  for (const src of STATIONED.filter(x => x.id !== 'short')) {
    filesOf(src).forEach(({ data, filter }, n) => {
      const { id } = itemsOf(src.id, data, 'en', filter)[0]
      for (const lang of n ? ['en'] : ['en', 'fr']) some.push({ src, id, lang, p: plan(src.id, data, id, { ...OPTS, lang }, depsFor(src, data, id)) })
    })
  }
  // Read it deals its own four slides in its own order (plan 253): its test is its own.
  const types = p => TYPES.map(x => x.id).filter(x => x !== 'read' && available(x, p))

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
      theme: 'words', lookalike: 'kanji', dialogue: 'conversation', trap: 'grammar',
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

  it('sets a turn’s line as large as the 9:16 frame lets it, down to the page dots (plan 240)', () => withPath2D(() => {
    // TikTok's photo view: its caption's panel from y ~1660, the page dots at ~1600.
    expect(FORMATS.story.h - FORMATS.story.safe.b).toBe(1590)
    const dialogue = some.find(x => x.src.id === 'dialogue' && x.lang === 'en')
    const { p } = dialogue
    // The size each text is set at, read off the font as it is drawn.
    const sizes = ctx0 => {
      const at = []
      const ctx = new Proxy(ctx0, { get: (o, k) => (k === 'fillText' ? (t, ...a) => { at.push([String(t), parseFloat(/([\d.]+)px/.exec(o.font)?.[1] || '0')]); return o.fillText(t, ...a) } : o[k]), set: (o, k, v) => { o[k] = v; return true } })
      return { ctx, at }
    }
    for (const design of DESIGNS) {
      const slides = deck('plates', p, FORMATS.story, { design })
      for (const key of ['ask', 'answer']) {
        const sl = slides.find(x => x.key === key)
        const { ctx, at } = sizes(stubContext().ctx)
        sl.draw(ctx)
        const turn = p.funnel.turns.find(tu => tu.them.rows.every(r => r.k === 'punct' || at.some(([t]) => t === r.t)))
        expect(turn, `${design} ${key}`).toBeTruthy()
        // Their line, at the title's size at least: it was set at the body's before.
        const line = turn.them.rows.filter(r => r.k !== 'punct').map(r => Math.max(...at.filter(([t]) => t === r.t).map(([, z]) => z)))
        expect(Math.min(...line), `${design} ${key}`).toBeGreaterThanOrEqual(FS.title - 0.5)
      }
    }
  }))

  it('sends the Fiche hook on to the answer and the call to action on to the site’s address (plan 245)', () => withPath2D(() => {
    for (const { src, id, lang, p } of some) {
      const where = `${src.id} ${id} ${lang}`
      const slides = deck('plates', p, FORMATS.story, { design: 'fiche' })
      const hook = stubContext()
      slides[0].draw(hook.ctx)
      // Its foot says where the answer is (the stub measures wider than the font: it may be cut).
      const foot = hook.texts.at(-1)
      expect(foot.length, where).toBeGreaterThan(8)
      expect(FUNNEL[lang].yoursFoot.startsWith(foot.replace(/…$/, '')), `${where}: ${foot}`).toBe(true)
      // The address, set alone in its bar: no "Go to" before it.
      const cta = stubContext()
      slides.find(x => x.key === 'cta').draw(cta.ctx)
      expect(cta.texts, where).toContain('tsuji.app')
      expect(cta.texts.join(' '), where).not.toMatch(/Go to|Va sur/)
    }
  }))

  it('draws a conversation’s call to action as its run: one of its exchanges, every reply whole (plan 235)', () => withPath2D(() => {
    const joined = rows => rows.map(r => r.t).join('')
    const dialogues = some.filter(x => x.src.id === 'dialogue')
    expect(dialogues.length).toBeGreaterThan(0)
    for (const { p, lang } of dialogues) {
      expect(funnelOf('plates', p).feature, lang).toBe('conversation')
      const exchanges = p.funnel.turns.map(tu => [joined(tu.them.rows), ...tu.choices.map(joined)])
      for (const fmt of [FORMATS.post, FORMATS.story]) {
        const { ctx, texts } = stubContext()
        deck('plates', p, fmt, { design: 'clarte' }).find(x => x.key === 'cta').draw(ctx)
        // Their line (whole, or cut between its sentences) and the three replies, uncut.
        const drawn = exchanges.find(ex => ex.slice(1).every(jp => texts.includes(jp)))
        expect(drawn, `${lang} ${fmt.id}`).toBeTruthy()
        expect(drawn[0].split(/(?<=[。？！])/).every(s => texts.some(t => t.includes(s))), drawn[0]).toBe(true)
        expect(texts, lang).toContain(FUNNEL[lang].features.conversation.name)
      }
    }
    // Another carousel promoting it borrows a conversation's opening.
    const { p } = some.find(x => x.src.id === 'sentence' && x.lang === 'en')
    const { ctx, texts } = stubContext()
    deck('plates', p, FORMATS.post, { design: 'fiche', feature: 'conversation' }).find(x => x.key === 'cta').draw(ctx)
    expect(texts).toContain('二人です。')
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


describe('the reading challenges (plan 247)', () => {
  const data = bank('comprehension.json')
  const withPath2D = fn => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try { return fn() } finally { globalThis.Path2D = had }
  }
  // Every text drawn, where and how large (the stub's measure, a little wide),
  // through any move or scale: its size is its height on screen.
  const drawn = () => {
    const at = []
    const state = { font: '10px sans-serif', textAlign: 'left', globalAlpha: 1, tx: 0, ty: 0, sx: 1, sy: 1 }
    const size = () => parseFloat(/([\d.]+)px/.exec(state.font)?.[1] || '10')
    const width = t => [...String(t)].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.56), 0) * size()
    const methods = {
      measureText: t => ({ width: width(t), actualBoundingBoxAscent: size() * 0.72, actualBoundingBoxDescent: size() * 0.12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width(t) }),
      fillText: (t, x, y) => {
        const w = width(t)
        const left = state.textAlign === 'center' ? x - w / 2 : state.textAlign === 'right' ? x - w : x
        const L = state.tx + state.sx * left
        at.push({ t: String(t), size: size() * state.sy, left: L, right: L + w * state.sx, y: state.ty + state.sy * y, alpha: state.globalAlpha })
      },
      translate: (x, y) => { state.tx += x * state.sx; state.ty += y * state.sy },
      scale: (a, b) => { state.sx *= a; state.sy *= b },
      createLinearGradient: () => ({ addColorStop() {} }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      // What a save keeps: how faint, in what face, from where.
      save: () => stack.push({ ...state }),
      restore: () => Object.assign(state, stack.pop() || {}),
    }
    const stack = []
    const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
    return { ctx, at }
  }
  const jp = t => /[\u3040-\u30ff\u3400-\u9fff]/.test(t)
  const each = data.passages

  it('lays the studio’s track under it, credited, unless another or none is asked for', () => {
    const { file } = TRACKS[TRACK]
    expect(() => read(`carousel/${file}`)).not.toThrow()
    for (const style of CHALLENGE_STYLES) {
      const pl = challengePlan(data, 'n5-01', { style })
      const tl = challengeTimeline(pl)
      expect(pl.music, style).toBe(TRACK)
      expect(tl.bed, style).toEqual({ src: `carousel/${file}`, gain: 1, fade: 2.5 })
      expect(tl.loudness, style).toBe(-16)
      expect(challengeCommand(pl), style).not.toMatch(/--music/)
      // Its licence's credit (CC BY 4.0) in the description of every video it plays under.
      for (const lang of ['en', 'fr']) {
        const page = challengePage({ ...pl, lang }, tl, 'x').description
        expect(page, `${style} ${lang}`).toContain('Kevin MacLeod (incompetech.com)')
        expect(page, `${style} ${lang}`).toContain('http://creativecommons.org/licenses/by/4.0/')
      }
      const none = challengePlan(data, 'n5-01', { style, music: null })
      expect(challengeTimeline(none).bed, style).toBeNull()
      expect(challengeCommand(none), style).toMatch(/ --music none$/)
      expect(challengePage(none, challengeTimeline(none), 'x').description, style).not.toMatch(/MacLeod/)
      const jazz = challengePlan(data, 'n5-01', { style, music: 'music/late train.mp3' })
      expect(challengeTimeline(jazz).bed, style).toMatchObject({ src: 'music/late train.mp3' })
      expect(challengeTimeline(jazz).loudness, style).toBe(-16)
      expect(challengeCommand(jazz), style).toMatch(/ --music "music\/late train\.mp3"$/)
      expect(challengePage(jazz, challengeTimeline(jazz), 'x').description, style).not.toMatch(/MacLeod/)
    }
    expect(challengePlan(data, 'n5-01').style).toBe('scroll')
    expect(Object.keys(CPM).sort()).toEqual([...LEVELS].sort())
    expect(SOURCES.find(s => s.id === 'challenge')).toMatchObject({ video: true, byLevel: true })
    expect(challengeItems(data).length).toBe(data.passages.length)
  })

  it('reads every text, and one of its questions after', () => {
    for (const P of data.passages) {
      for (const lang of ['en', 'fr']) {
        const pl = challengePlan(data, P.id, { lang })
        // A question about what the text says, its answer among its four choices.
        const Q = P.questions.find(q => q.type === 'comprehension')
        if (Q) expect(pl.q.ask, P.id).toBe(Q.question[lang])
        expect(pl.q.choices.length, P.id).toBe(4)
        expect(pl.q.right >= 0 && pl.q.right < 4, P.id).toBe(true)
      }
    }
  })

  it('scrolls the whole text up past the reading line at the pace its level reads', () => {
    for (const P of data.passages) {
      const pl = challengePlan(data, P.id, { style: 'scroll' })
      const tl = challengeTimeline(pl)
      const chars = pl.sents.flat().filter(r => r.k !== 'punct').reduce((n, r) => n + [...r.t].length, 0)
      expect(pl.chars, P.id).toBe(chars)
      const seg = tl.segs.find(s => s.key === 'reading')
      expect(seg.dur, P.id).toBeCloseTo(CHALLENGE.into + chars / (CPM[P.lv] / 60) + CHALLENGE.out, 2)
      expect(tl.lines, P.id).toEqual([])
      // The hook, the reading, the question, its answer, the app: end to end.
      expect(tl.segs.map(s => s.key)).toEqual(['hook', 'reading', 'question', 'answer', 'cta'])
      tl.segs.forEach((s, i) => { if (i) expect(s.start, P.id).toBeCloseTo(tl.segs[i - 1].start + tl.segs[i - 1].dur, 2) })
      expect(tl.seconds, P.id).toBeCloseTo(tl.segs.at(-1).start + tl.segs.at(-1).dur, 2)
      expect(tl.cues, P.id).toEqual([])
      expect(tl.sfx.map(x => x.key), P.id).toEqual(['board-flap', ...Array(CHALLENGE.count).fill('click'), 'correct', 'platform-chime'])
    }
  })

  it('moves the text up at one speed and one size, as credits go', () => withPath2D(() => {
    const pl = challengePlan(data, 'n4-01')
    const tl = challengeTimeline(pl)
    const seg = tl.segs.find(s => s.key === 'reading')
    const first = pl.sents[0][0].t
    const where = t => {
      const { ctx, at } = drawn()
      drawChallenge(ctx, pl, tl, t, null)
      return at
    }
    // The first sentence's first word, drawn top down.
    const word = t => where(t).find(x => x.t === first)
    // The text comes in with its first line at the reading line, the rest under it.
    const opens = word(seg.start + CHALLENGE.into)
    expect(opens.y).toBeGreaterThan(SCROLL.read)
    expect(opens.y).toBeLessThan(SCROLL.read + SCROLL.z * 2.5)
    const rises = [0.1, 0.2, 0.3].map(f => word(seg.start + CHALLENGE.into + 12 * f))
    for (let i = 1; i < rises.length; i++) {
      expect(rises[i].y).toBeLessThan(rises[i - 1].y)
      expect(rises[i].size).toBe(rises[0].size)
    }
    expect(rises[0].y - rises[1].y).toBeCloseTo(rises[1].y - rises[2].y, 3)
    // Every sentence read on the way: the counter climbs to the last.
    const n = pl.sents.length
    const count = t => where(t).find(x => / \/ \d+$/.test(x.t))?.t
    expect(count(seg.start + 0.1)).toMatch(new RegExp(` 1 / ${n}$`))
    expect(count(seg.start + seg.dur - 0.05)).toMatch(new RegExp(` ${n} / ${n}$`))
    // The last line past the reading line, and still on screen, as the question comes.
    const end = where(seg.start + seg.dur - 0.05).filter(x => jp(x.t) && x.alpha > 0.5)
    expect(end.length).toBeGreaterThan(0)
    expect(Math.max(...end.map(x => x.y))).toBeLessThan(SCROLL.read)
  }))

  it('lights each word read along as the voice reaches it, on the engine’s own syllables', () => {
    const pl = challengePlan(data, 'n5-01', { style: 'along' })
    const cues = challengeCues(pl)
    expect(cues.length).toBe(pl.sents.length)
    expect(cues.every(c => c.who === 'reader' && c.slow && c.marks)).toBe(true)
    expect(cues[0].text).toBe('わたしは大学の学生です。')
    expect(moraeOf({ t: '学生', fu: [['学', 'がく'], ['生', 'せい']] })).toBe(4)
    expect(moraeOf({ t: 'じゅぎょう' })).toBe(3)
    expect(moraeOf({ t: '。', k: 'punct' })).toBe(0)
    // わたし は 大学 の 学生 です 。: 3 1 4 1 4 2 syllables, voiced at the engine's times.
    const rows = pl.sents[0]
    const marks = Array.from({ length: 15 }, (_, i) => ({ t: 0.1 + i * 0.12, k: 'ア' }))
    const at = wordTimes(rows, 10, 2.0, marks)
    expect(at.slice(0, 6).map(x => +(x - 10).toFixed(2))).toEqual([0.1, 0.46, 0.58, 1.06, 1.18, 1.66])
    // The engine's syllables not the text's: in proportion, in order, inside the line.
    const guessed = wordTimes(rows, 10, 2.0, marks.slice(0, 9))
    for (let i = 1; i < guessed.length; i++) expect(guessed[i]).toBeGreaterThanOrEqual(guessed[i - 1])
    expect(guessed[0] >= 10 && guessed.at(-1) <= 12).toBe(true)
    // Timed on the voice when it has been made: each sentence as long as it is said.
    const voiced = c => ({ dur: 1 + [...c.text].length * 0.1, marks: null })
    const tl = challengeTimeline(pl, voiced)
    tl.lines.forEach((l, i) => {
      expect(l.dur).toBeCloseTo(voiced(cues[i]).dur, 3)
      expect(tl.cues[i].at).toBeCloseTo(l.voice, 3)
      expect(challengeKey(tl.cues[i])).toBe(`reader|slow|${cues[i].text}`)
      if (i) expect(l.at).toBeCloseTo(tl.lines[i - 1].voice + tl.lines[i - 1].dur + CHALLENGE.gap, 2)
    })
  })

  it('asks the question chosen, its answers dealt across A to D, the right one kept (plan 260)', () => {
    const at = [0, 0, 0, 0]
    for (const P of each) {
      const qs = challengeQuestions(data, P.id)
      expect(qs.map(q => q.n), P.id).toEqual(P.questions.map((_, i) => i + 1))
      // Unless chosen, the first about what the text says, never one about its grammar.
      const first = qs.find(q => q.first)
      expect(P.questions[first.n - 1].type, P.id).toBe('comprehension')
      expect(challengePlan(data, P.id, {}).q.n, P.id).toBe(first.n)
      for (const bad of [0, P.questions.length + 1, 'x']) expect(challengePlan(data, P.id, { question: bad }).q.n, `${P.id} ${bad}`).toBe(first.n)
      for (const q of qs) {
        const Q = P.questions[q.n - 1]
        const en = challengePlan(data, P.id, { question: q.n })
        const fr = challengePlan(data, P.id, { question: q.n, lang: 'fr' })
        // The same four, the right one still right, in the same place in both languages.
        expect([...en.q.choices].sort(), `${P.id} ${q.n}`).toEqual([...Q.options.en].sort())
        expect(en.q.choices[en.q.right], `${P.id} ${q.n}`).toBe(Q.options.en[Q.correct])
        expect(fr.q.choices[fr.q.right], `${P.id} ${q.n}`).toBe(Q.options.fr[Q.correct])
        expect(fr.q.right, `${P.id} ${q.n}`).toBe(en.q.right)
        at[en.q.right] += 1
      }
    }
    // The right answer stands at A, B, C and D alike, where the bank writes it first most often.
    const n = at.reduce((a, b) => a + b, 0)
    for (const k of at) expect(k / n).toBeGreaterThan(0.2)
    for (const k of at) expect(k / n).toBeLessThan(0.3)
    // The command names the question only where it is not the default.
    expect(challengeCommand(challengePlan(data, 'n5-03', { question: 7 }))).toContain(' --question 7')
    expect(challengeCommand(challengePlan(data, 'n5-03', {}))).not.toContain('--question')
  })

  it('stands every question and its answers above the safe foot, the countdown too (plan 262)', () => withPath2D(() => {
    const foot = FORMATS.story.h - FORMATS.story.safe.b
    for (const P of each) {
      for (const n of P.questions.map((_, i) => i + 1)) {
        for (const lang of ['en', 'fr']) {
          const pl = challengePlan(data, P.id, { question: n, lang })
          const tl = challengeTimeline(pl)
          const ask = tl.segs.find(s => s.key === 'question')
          const answer = tl.segs.find(s => s.key === 'answer')
          for (const t of [ask.start + ask.dur - 0.5, answer.start + answer.dur - 0.05]) {
            const { ctx, at } = drawn()
            drawChallenge(ctx, pl, tl, t, null)
            for (const x of at.filter(x => x.alpha > 0.01)) {
              const where = `${P.id} q${n} ${lang} ${t.toFixed(1)} ${x.t}`
              expect(x.y + x.size * 0.25, where).toBeLessThanOrEqual(foot + 1)
              // Cut, unless the text itself trails off ("If it's a bike shop you need, …").
              expect(x.t.endsWith('…') && ![pl.q.ask, ...pl.q.choices].some(o => o.endsWith(x.t)), where).toBe(false)
            }
          }
        }
      }
    }
  }), 240000)

  it('sets what a viewer reads large, inside the frame, whole', () => withPath2D(() => {
    const fr = { x: FORMATS.story.safe.l, right: FORMATS.story.w - FORMATS.story.safe.r }
    for (const P of each) {
      for (const style of CHALLENGE_STYLES) {
        for (const lang of ['en', 'fr']) {
          const pl = challengePlan(data, P.id, { style, lang })
          const tl = challengeTimeline(pl)
          const where = `${P.id} ${style} ${lang}`
          const seg = tl.segs.find(s => s.key === 'reading')
          const reading = style === 'scroll' ? [0.25, 0.5, 0.75].map(f => seg.start + seg.dur * f) : tl.lines.slice(0, 3).map(l => l.voice + 0.5)
          const moments = [1.6, ...reading, ...tl.segs.slice(3).map(s => s.start + s.dur - 0.05)]
          for (const t of moments) {
            const { ctx, at } = drawn()
            drawChallenge(ctx, pl, tl, t, null)
            for (const x of at.filter(x => x.alpha > 0.99)) {
              expect(x.left, `${where} ${t} ${x.t}`).toBeGreaterThanOrEqual(fr.x - 2)
              expect(x.right, `${where} ${t} ${x.t}`).toBeLessThanOrEqual(fr.right + 2)
              expect(x.t.endsWith('…'), `${where} ${t} ${x.t}`).toBe(false)
            }
          }
          // The sentence being read, at the title's size at least, its readings over it.
          const { ctx, at } = drawn()
          drawChallenge(ctx, pl, tl, style === 'scroll' ? seg.start + seg.dur * 0.5 : tl.lines[1].voice + 0.2, null)
          const words = at.filter(x => jp(x.t) && x.alpha > 0.99)
          const body = Math.max(...words.map(x => x.size))
          expect(body, where).toBeGreaterThanOrEqual(FS.title)
          if (pl.ruby) expect(words.some(x => x.size < body * 0.6), where).toBe(true)
        }
      }
    }
  }), 240000)

  it('ends on the way to the app, and writes the video’s page', () => withPath2D(() => {
    for (const lang of ['en', 'fr']) {
      const pl = challengePlan(data, 'n4-01', { lang, style: 'along' })
      const tl = challengeTimeline(pl)
      const { ctx, at } = drawn()
      drawChallenge(ctx, pl, tl, tl.seconds - 0.05, null)
      expect(at.map(x => x.t)).toContain('tsuji.app')
      const page = challengePage(pl, tl, 'https://tsuji.app')
      expect(page.title.length).toBeLessThanOrEqual(100)
      expect(page.description).toContain('https://tsuji.app')
      expect(page.description).toMatch(/VOICEVOX Nemo/)
      expect(challengeCommand(pl)).toMatch(/^VOICEVOX_URL=.* --challenge n4-01 --style along/)
      expect(challengeCommand({ ...pl, style: 'scroll' })).not.toMatch(/VOICEVOX/)
      expect(challengePage({ ...pl, style: 'scroll' }, tl, 'x').description).not.toMatch(/VOICEVOX/)
    }
    expect(challengePage(challengePlan(data, 'n4-01', { lang: 'fr' }), challengeTimeline(challengePlan(data, 'n4-01', { lang: 'fr' })), 'x').title).toMatch(/^Tu arrives/)
  }))

  // Last of the block: the strip it leaves behind is the stub's.
  it('draws the scroll’s text once and lays it between pixels, at sixty frames, so it glides', () => withPath2D(() => {
    const had = globalThis.OffscreenCanvas
    const made = []
    globalThis.OffscreenCanvas = class {
      constructor(w, h) {
        Object.assign(this, { width: w, height: h, d: drawn(), laid: [] })
        this.d.ctx.drawImage = (img, x, y) => this.laid.push({ img, y })
        made.push(this)
      }
      getContext() { return this.d.ctx }
    }
    try {
      const pl = challengePlan(data, 'n3-02', { lang: 'fr' })
      const tl = challengeTimeline(pl)
      expect(tl.fps).toBe(60)
      expect(challengeTimeline(challengePlan(data, 'n3-02', { style: 'along' })).fps).toBe(30)
      const seg = tl.segs.find(s => s.key === 'reading')
      const frameAt = t => {
        const { ctx, at } = drawn()
        const laid = []
        ctx.drawImage = img => laid.push(img)
        drawChallenge(ctx, pl, tl, t, null)
        return { at, laid }
      }
      const t1 = seg.start + CHALLENGE.into + 10.004
      const one = frameAt(t1)
      const strip = made.find(c => c.height !== FORMATS.story.h)
      const layer = made.find(c => c.height === FORMATS.story.h)
      const written = strip.d.at.length
      expect(written).toBeGreaterThan(0)
      // The frame shows the layer; no line of the text is written on the frame itself.
      expect(one.laid).toContain(layer)
      expect(one.at.some(x => jp(x.t) && x.t !== pl.title)).toBe(false)
      frameAt(t1 + 1 / 60)
      // Written once, laid twice: a sixtieth of a second apart, less than a pixel, between pixels.
      expect(strip.d.at.length).toBe(written)
      const [a, b] = layer.laid.filter(x => x.img === strip).map(x => x.y)
      expect(a - b).toBeGreaterThan(0.2)
      expect(a - b).toBeLessThan(1.2)
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(false)
    } finally {
      globalThis.OffscreenCanvas = had
    }
  }))
})

describe('the hand-written content, held to its rules (plan 248)', () => {
  const LANGS = ['en', 'fr']
  const both = (o, where) => LANGS.forEach(l => expect(String(o?.[l] || '').trim(), `${where} ${l}`).not.toBe(''))

  it('writes every conversation in both languages, three replies a turn, and lets no length answer', () => {
    const dialogues = JSON.parse(read('carousel/content/dialogues.json'))
    expect(new Set(dialogues.map(d => d.id)).size).toBe(dialogues.length)
    const tells = {}
    for (const d of dialogues) {
      expect(LEVELS, d.id).toContain(d.lv)
      both(d.place, `${d.id} place`)
      both(d.them, `${d.id} them`)
      expect(d.turns.length, d.id).toBeGreaterThanOrEqual(3)
      d.turns.forEach((t, i) => {
        const at = `${d.id} ${i + 1}`
        both(t.them, `${at} line`)
        both(t.reply, `${at} reply`)
        both(t.why, `${at} why`)
        expect(t.choices, at).toHaveLength(3)
        expect(new Set(t.choices).size, at).toBe(3)
        expect([0, 1, 2], at).toContain(t.right)
        // How often the longest reply, or the shortest, is the right one, ties shared.
        const sizes = t.choices.map(c => [...c].length)
        const n = (tells[d.lv] ||= { turns: 0, longest: 0, shortest: 0 })
        n.turns++
        const max = Math.max(...sizes)
        const min = Math.min(...sizes)
        if (sizes[t.right] === max) n.longest += 1 / sizes.filter(x => x === max).length
        if (sizes[t.right] === min) n.shortest += 1 / sizes.filter(x => x === min).length
      })
    }
    // The bound the app's own conversations keep (study/conversation.py, LENGTH_TELL).
    for (const [lv, n] of Object.entries(tells)) {
      for (const k of ['longest', 'shortest']) {
        expect(n[k] / n.turns, `${lv} ${k}`).toBeGreaterThanOrEqual(0.25)
        expect(n[k] / n.turns, `${lv} ${k}`).toBeLessThanOrEqual(0.42)
      }
    }
  })

  it('tells each lookalike apart in both languages, every kanji one the deck teaches', () => {
    const sets = JSON.parse(read('carousel/content/lookalikes.json'))
    const index = bank('kanji-index.json')
    const known = new Set(Object.keys(index.kanji || index))
    expect(new Set(sets.map(s => s.id)).size).toBe(sets.length)
    for (const s of sets) {
      expect(s.chars.length, s.id).toBeGreaterThanOrEqual(2)
      expect(new Set(s.chars.map(c => c.c)).size, s.id).toBe(s.chars.length)
      for (const c of s.chars) {
        both(c, `${s.id} ${c.c}`)
        expect(known.has(c.c), `${s.id} ${c.c}`).toBe(true)
        if (c.m) for (const l of LANGS) expect(c.m[l]?.length, `${s.id} ${c.c} m.${l}`).toBeGreaterThan(0)
      }
    }
    // An example word is no harder than its set: every kanji it writes is at or below the set's level.
    const rank = lv => LEVELS.indexOf(lv)
    const levelOf = ch => index.kanji?.[ch]?.lv ?? index[ch]?.lv
    for (const s of bank('lookalikes.json').sets) {
      for (const c of s.chars.filter(x => x.word)) {
        for (const ch of [...c.word.t].filter(x => /[㐀-鿿]/.test(x) && x !== '々')) {
          expect(rank(levelOf(ch)), `${s.id} ${c.word.t}`).toBeLessThanOrEqual(rank(s.lv))
        }
      }
    }
  })
})

describe('tuned from the studio (plan 248)', () => {
  const def = key => TUNABLES.find(t => t.key === key).def

  it('defaults to what each video did before it was tunable', () => {
    for (const k of ['hook', 'into', 'out', 'gap', 'ask', 'count', 'answer', 'cta']) expect(def(`challenge.${k}`), k).toBe(CHALLENGE[k])
    expect([def('echo.seconds'), def('echo.gap'), def('echo.keep')]).toEqual([ECHO.seconds, ECHO.gap, ECHO.keep])
    expect(def('short.limit')).toBe(LIMIT)
  })

  it('times a short by its pace, its time to answer and its limit, a voiced line still said whole', () => {
    expect(slideSeconds(40, 'point', { 'short.pace': 1.5 }).hold).toBeCloseTo(slideSeconds(40, 'point').hold * 1.5, 2)
    const slides = ['hook', 'question-1', 'answer-1', 'outro'].map(key => ({ key }))
    const six = shortTimeline(slides, [30, 40, 40, 20], null, null, { 'short.answer': 6 })
    const ask = six.segs[1]
    const ticks = six.sfx.filter(x => x.key === 'click')
    expect(ticks).toHaveLength(6)
    expect(ask.start + ask.dur - ticks[0].at).toBeCloseTo(6, 2)
    const exam = ['cover', 'question-1', 'answer-1', 'question-2', 'answer-2', 'question-3', 'answer-3', 'sheet', 'outro'].map(key => ({ key }))
    const counts = [60, 120, 160, 120, 160, 120, 160, 200, 80]
    const free = shortTimeline(exam, counts, null, null, { 'short.limit': 90 })
    expect(free.seconds).toBeGreaterThan(LIMIT)
    expect(shortTimeline(exam, counts).seconds).toBeLessThanOrEqual(LIMIT + 0.01)
    // A line eight seconds long keeps its slide long enough to be heard to its end.
    const said = shortTimeline(exam, counts, 'まいげつ', () => 8, { 'short.limit': 30 })
    const reveal = said.segs.find(x => x.key === 'answer-3')
    expect(reveal.start + reveal.dur).toBeGreaterThanOrEqual(said.cues[0].at + 8 + 0.5)
  })

  it('says a word as often as its tuned clip and silence allow, and keeps it as long', () => {
    const span = { on: 0.14, off: 0.6 }
    const voiced = span.off - span.on
    const wide = beats(span, { 'echo.gap': 0.6 })
    for (let i = 1; i < wide.length; i++) expect(wide[i] - wide[i - 1]).toBeCloseTo(voiced + 0.6, 2)
    expect(beats(span, { 'echo.seconds': 16 }).length).toBeGreaterThan(beats(span).length)
    const themes = bank('themes.json')
    const pl = echoPlan(themes, echoItems(themes, 'en')[0].id, { lang: 'en' })
    const { clip } = echoDeck(pl, FORMATS.story, { ground: 'sumi', tune: { 'echo.keep': 6 } })
    expect(clip.seconds).toBeCloseTo(clip.keepAt + 6, 3)
  })

  it('reads a challenge at its tuned pace and writes the tune into its command', () => {
    const data = bank('comprehension.json')
    const id = data.passages[0].id
    const base = challengePlan(data, id, { lang: 'en' })
    const slow = challengePlan(data, id, { lang: 'en', tune: { 'challenge.pace': 0.5, 'challenge.hook': 5 } })
    expect(slow.cpm).toBe(Math.round(base.cpm * 0.5))
    expect(challengeTimeline(slow).seconds).toBeGreaterThan(challengeTimeline(base).seconds + 1.8)
    expect(challengeCommand(slow)).toContain('--tune challenge.pace=0.5,challenge.hook=5')
    expect(challengeCommand(base)).not.toContain('--tune')
    expect(tuned(slow.tune, 'challenge.pace')).toBe(0.5)
  })

  it('stretches a long video’s pauses and its quiz countdown', () => {
    const files = {}
    for (const f of ['N5.json', 'words-N5.json', 'kanji-N5.json', 'grammar-N5.json', 'themes.json']) files[f] = bank(f)
    const base = timeline(longPlan('vocab', files, { level: 'N5', part: 1 }))
    const slow = timeline(longPlan('vocab', files, { level: 'N5', part: 1, tune: { 'long.pause': 1.5 } }))
    expect(slow.seconds).toBeGreaterThan(base.seconds * 1.1)
    const quiz = timeline(longPlan('quiz', files, { level: 'N5', tune: { 'long.count': 8 } }))
    const quiz5 = timeline(longPlan('quiz', files, { level: 'N5' }))
    expect(quiz.seconds).toBeGreaterThan(quiz5.seconds)
  })
})

describe('the reply videos (plan 249)', () => {
  // The 会話 station's own scenes, six turns each (plan 250).
  const scenes = bank('conversation.json').scenes
  const files = { 'conversation.json': bank('conversation.json') }
  const parts = (lv, format = 'long') => longItems(files, lv, 'en', format).filter(x => x.kind === 'reply')
  const planFor = (lv, id, format = 'long', lang = 'en') => { const { kind, opts } = longPick(id, lv, lang, format); return longPlan(kind, files, opts) }
  // Every text drawn, where: its baseline and its size.
  const placed = () => {
    const at = []
    const state = { font: '10px sans-serif' }
    const size = () => parseFloat(/([\d.]+)px/.exec(state.font)?.[1] || '10')
    const widthOf = t => [...String(t)].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.56), 0) * size()
    let dy = 0
    const stack = []
    const methods = {
      measureText: t => ({ width: widthOf(t), actualBoundingBoxAscent: size() * 0.72, actualBoundingBoxDescent: size() * 0.12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: widthOf(t) }),
      fillText: (t, x, y) => at.push({ t: String(t), y: y + dy, z: size() }),
      save: () => stack.push(dy), restore: () => { dy = stack.pop() ?? 0 }, translate: (x, y) => { dy += y },
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }
    const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
    return { ctx, at }
  }

  it('deals every conversation of a level once, six questions a video at least', () => {
    for (const lv of LEVELS) {
      const seen = []
      for (const it of parts(lv)) {
        const pl = planFor(lv, it.id)
        expect(pl.items.filter(x => x.type === 'reply').length, it.id).toBeGreaterThanOrEqual(6)
        seen.push(...pl.items.filter(x => x.type === 'scene').map(x => x.id))
      }
      expect(seen.sort(), lv).toEqual(scenes.filter(d => d.lv === lv).map(d => d.id).sort())
    }
    expect(longFiles('reply:1', 'N5')).toEqual(['conversation.json'])
    expect(longListFiles('N5')).toContain('conversation.json')
    expect(longCommand('reply:2', 'N3', 'fr', 'short')).toContain('--kind reply --level N3 --part 2 --lang fr --format short')
  })

  it('makes a short of each scene, six questions a short (plans 249b, 250)', () => {
    for (const lv of LEVELS) {
      const talks = scenes.filter(d => d.lv === lv)
      const shorts = parts(lv, 'short')
      expect(shorts.map(x => x.sub), lv).toEqual(talks.map(d => `${d.place.jp} · ${d.place.en}`))
      shorts.forEach((it, i) => {
        const pl = planFor(lv, it.id, 'short')
        expect(pl.items.filter(x => x.type === 'scene').map(x => x.id), it.id).toEqual([talks[i].id])
        // The scene asked whole: its four to seven turns (the first 31 six each, plan 250).
        expect(pl.items.filter(x => x.type === 'reply'), it.id).toHaveLength(talks[i].turns.length)
        expect(talks[i].turns.length, it.id).toBeGreaterThanOrEqual(4)
        expect(talks[i].turns.length, it.id).toBeLessThanOrEqual(7)
        expect(pl.title, it.id).toBe(`${talks[i].place.en} · JLPT ${lv}`)
      })
    }
    // A short opens on its scene: no title card before the question, its still taken there.
    const pl = planFor('N5', 'reply:1', 'short')
    const tl = timeline(pl)
    expect(tl.segs[0].type).toBe('scene')
    expect(stillAt(pl, tl)).toBeLessThan(tl.segs[0].dur)
    expect(tl.segs.at(-1).type).toBe('outro')
  })

  it('says their line, then yours once the timer is out, a tick a second', () => {
    const pl = longPlan('reply', files, { level: 'N5', part: 1, tune: { 'reply.count': 6 } })
    const tl = timeline(pl)
    expect(tl.of).toBe(pl.items.filter(x => x.type === 'scene').reduce((n, d) => n + scenes.find(x => x.id === d.id).turns.length, 0))
    for (const sg of tl.segs.filter(x => x.type === 'reply')) {
      const it = sg.data
      const inSeg = x => x.at >= sg.start && x.at < sg.start + sg.dur
      const said = tl.cues.filter(inSeg)
      expect(said.map(c => c.who)).toEqual(['them', 'me'])
      expect(said[0].text).toBe(it.them.rows.map(r => r.t).join(''))
      expect(said[1].text).toBe(it.choices[it.right].map(r => r.t).join(''))
      expect(tl.sfx.filter(x => x.key === 'click' && inSeg(x))).toHaveLength(6)
      expect(sg.marks.reveal - sg.marks.show).toBeCloseTo(6, 6)
      expect(tl.sfx.some(x => x.key === 'correct' && Math.abs(x.at - (sg.start + sg.marks.reveal)) < 0.01)).toBe(true)
      expect(said[1].at).toBeGreaterThan(sg.start + sg.marks.reveal)
    }
    // The right reply is dealt in the carousel's order, never always in one place.
    expect(new Set(pl.items.filter(x => x.type === 'reply').map(x => x.right)).size).toBeGreaterThan(1)
    // It ends asking the viewer's own score.
    expect(tl.segs.at(-2).type).toBe('score')
    expect(tl.chapters.map(c => c.title)).toContain(pl.items[0].place.tr)
  })

  it('stands every question inside the frame, in both formats, nothing cut', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try {
      // Under the band (plan 249b): the band's own words stand above `head`.
      const box = { long: { top: 160, bottom: 1010, head: 140, foot: 1075 }, short: { top: 346, bottom: 1490, head: 325, foot: 1600 } }
      for (const lv of LEVELS) {
        for (const format of ['long', 'short']) {
          for (const it of parts(lv, format)) {
            for (const lang of ['en', 'fr']) {
              const pl = planFor(lv, it.id, format, lang)
              const tl = timeline(pl)
              const b = box[format]
              for (const sg of tl.segs.filter(x => x.type === 'reply')) {
                for (const u of [sg.marks.show + 1, sg.marks.reveal + 0.8, sg.dur - 0.05]) {
                  const { ctx, at } = placed()
                  drawLong(ctx, pl, tl, sg.start + u)
                  for (const x of at.filter(x => x.y > b.head && x.y < b.foot)) {
                    const where = `${lv} ${it.id} ${format} ${lang} ${sg.data.id}#${sg.data.k} ${u.toFixed(1)} ${x.t}`
                    expect(x.y - x.z * 0.85, where).toBeGreaterThanOrEqual(b.top - 1)
                    expect(x.y + x.z * 0.25, where).toBeLessThanOrEqual(b.bottom + 1)
                    // Cut, unless the text itself trails off ("At night, it's a bit loud…").
                    expect(x.t.endsWith('…') && ![sg.data.them.tr, sg.data.reply, sg.data.why].some(o => o.endsWith(x.t)), where).toBe(false)
                  }
                }
              }
              // The scene's card and the score, whole and inside too (plan 249b).
              for (const sg of tl.segs.filter(x => x.type === 'scene' || x.type === 'score' || x.type === 'intro')) {
                const { ctx, at } = placed()
                drawLong(ctx, pl, tl, sg.start + sg.dur - 0.05)
                for (const x of at.filter(x => x.y > b.head && x.y < b.foot)) {
                  const where = `${lv} ${it.id} ${format} ${lang} ${sg.type} ${x.t}`
                  expect(x.y - x.z * 0.85, where).toBeGreaterThanOrEqual(b.top - 1)
                  expect(x.y + x.z * 0.25, where).toBeLessThanOrEqual(b.bottom + 1)
                  expect(x.t.endsWith('…'), where).toBe(false)
                }
              }
            }
          }
        }
      }
    } finally { globalThis.Path2D = had }
  }, 120000)

  it('credits no music where the video is asked for none', () => {
    for (const format of ['long', 'short']) {
      const { kind, opts } = longPick('reply:1', 'N5', 'en', format)
      const withBed = longPlan(kind, files, opts)
      const without = longPlan(kind, files, { ...opts, music: false })
      expect(describeVideo(withBed, timeline(withBed), LONG_SITE).description, format).toContain('Music: made for Tsuji.')
      expect(describeVideo(without, timeline(without), LONG_SITE).description, format).not.toContain('Music')
    }
  })

  it('holds a short under three minutes, its scene whole', () => {
    for (const lv of LEVELS) {
      for (const it of parts(lv, 'short')) {
        const pl0 = planFor(lv, it.id, 'short')
        const pl = fitShort(pl0)
        expect(pl.items, it.id).toEqual(pl0.items)
        expect(timeline(pl).seconds, it.id).toBeLessThanOrEqual(REPLY_SHORT)
        // Fitted by its timer alone, never under four seconds to answer.
        expect(pl.tune?.['reply.count'] ?? 7, it.id).toBeGreaterThanOrEqual(4)
      }
    }
  })
})

describe('a post for each feed (plan 251)', () => {
  const data = bank('comprehension.json')
  it('writes a reading challenge’s three posts, with its track or none, read or read along', () => {
    for (const style of CHALLENGE_STYLES) {
      for (const lang of ['en', 'fr']) {
        for (const music of [undefined, null]) {
          const pl = challengePlan(data, 'n5-02', { style, lang, music })
          const page = challengePage(pl, challengeTimeline(pl), 'https://tsuji.app')
          expectFeeds(page, 'https://tsuji.app', `${style} ${lang} ${music}`)
          expect(page.feeds.tiktok.caption.includes('MacLeod'), `${style} ${lang} ${music}`).toBe(music === undefined)
        }
      }
    }
  })

  it('names a reply short’s scene under its hook', () => {
    const files = { 'conversation.json': bank('conversation.json'), 'index.json': bank('index.json') }
    const pl = longPlan('reply', files, { level: 'N5', part: 1, format: 'short' })
    const page = describeVideo(pl, timeline(pl), LONG_SITE, FIGURES)
    const scene = pl.items[0]
    expect(page.feeds.tiktok.caption.split('\n\n')[1]).toBe(`${scene.place.jp} · ${scene.place.tr}`)
  })

  it('keeps a 16:9 video’s page YouTube’s alone, and writes a 9:16 one’s three in its text file', () => {
    const files = { 'conversation.json': bank('conversation.json') }
    const wide = longPlan('reply', files, { level: 'N5', part: 1 })
    const page = describeVideo(wide, timeline(wide), LONG_SITE, FIGURES)
    expect(page.feeds).toBeUndefined()
    expect(pageFile(page)).toBe(`TITLE\n${page.title}\n\nDESCRIPTION\n${page.description}\n\nTAGS\n${page.tags}\n`)
    const pl = challengePlan(data, 'n5-02', {})
    const text = pageFile(challengePage(pl, challengeTimeline(pl), LONG_SITE))
    expect(text.match(/^(YOUTUBE SHORTS|INSTAGRAM REELS|TIKTOK)$/gm)).toEqual(['YOUTUBE SHORTS', 'INSTAGRAM REELS', 'TIKTOK'])
    expect(text.match(/^CAPTION$/gm)).toHaveLength(2)
    expect(text.match(/^TITLE$/gm)).toHaveLength(1)
  })
})

describe('the vocabulary shorts (plan 252)', () => {
  const banksFor = lv => Object.fromEntries(wordsFiles(lv).map(n => [n, bank(n)]))
  const B = Object.fromEntries(LEVELS.map(lv => [lv, banksFor(lv)]))
  const deckIds = lv => wordsItems(B[lv], lv).filter(x => !x.id.startsWith('theme:')).map(x => x.id)
  const themeIds = () => wordsItems(B.N5, 'N5').filter(x => x.id.startsWith('theme:')).map(x => x.id)
  // Every N5 short, and a spread of the others: each tenth part, every theme.
  const sample = () => [...LEVELS.flatMap(lv => deckIds(lv).filter((_, i) => lv === 'N5' || i % 10 === 0).map(id => [lv, id])), ...themeIds().map(id => ['N5', id])]

  it('deals a level’s deck nine words a short, every word once, and each theme the same', () => {
    for (const lv of LEVELS) {
      const words = bank(`words-${lv}.json`).words.filter(w => w.en?.[0])
      const seen = deckIds(lv).flatMap(id => wordsPlan(B[lv], id).items.map(x => `${x.t}::${x.r}`))
      expect(seen.length, lv).toBe(words.length)
      expect(new Set(seen).size, lv).toBe(new Set(words.map(w => `${w.t}::${w.r}`)).size)
    }
    for (const id of themeIds()) expect(wordsPlan(B.N5, id).items.length, id).toBeLessThanOrEqual(WORDS_COUNT)
    expect(new Set(wordsItems(B.N5, 'N5').map(x => x.id)).size).toBe(wordsItems(B.N5, 'N5').length)
  })

  it('asks each word’s meaning among three that cannot be right too, and lets no length answer', () => {
    let longest = 0
    let asked = 0
    const at = [0, 0, 0, 0]
    for (const [lv, id] of sample()) {
      for (const lang of ['en', 'fr']) {
        const pl = wordsPlan(B[lv], id, { style: 'quiz', lang })
        const card = wordsPlan(B[lv], id, { style: 'card', lang })
        // No word is dropped for want of wrong meanings.
        expect(pl.items.length, `${id} ${lang}`).toBe(card.items.length)
        for (const it of pl.items) {
          const where = `${id} ${lang} ${it.t}`
          expect(it.choices, where).toHaveLength(4)
          expect(new Set(it.choices.map(c => c.toLowerCase())).size, where).toBe(4)
          const right = it.choices[it.right]
          expect(right, where).toBe(weldIf(lang, shortSense(it.gloss)))
          const w = [...bank(`words-${lv}.json`).words, ...Object.values(bank('themes.json').themes).flatMap(th => th.words)].find(x => x.t === it.t && x.r === it.r)
          const senses = [...(w[lang] || []), ...(w.en || [])]
          for (const c of it.choices.filter((_, k) => k !== it.right)) {
            expect(senses.some(s => overlaps(s, c)), `${where}: ${c}`).toBe(false)
            expect(c.endsWith('…') && c.length < 4, `${where}: ${c}`).toBe(false)
          }
          asked += 1
          at[it.right] += 1
          if (it.choices.every((c, k) => k === it.right || c.length < right.length)) longest += 1
        }
      }
    }
    // The longest is the right one about as often as a blind pick would be (plan 217's LENGTH_TELL).
    expect(longest / asked).toBeLessThan(0.35)
    for (const n of at) expect(n / asked).toBeGreaterThan(0.18)
  }, 120000)

  it('stays under Shorts’ three minutes, every reading and sentence said', () => {
    for (const [lv, id] of sample()) {
      for (const style of WORDS_STYLES) {
        const pl = wordsPlan(B[lv], id, { style })
        const tl = wordsTimeline(pl)
        expect(tl.seconds, `${id} ${style}`).toBeLessThanOrEqual(WORDS_LIMIT)
        const said = tl.cues.map(c => c.text)
        for (const it of pl.items) {
          expect(said, `${id} ${it.t}`).toContain(it.r)
          if (it.ex) expect(said, `${id} ${it.t}`).toContain(it.ex.jp)
        }
        expect(tl.segs.at(-1).type).toBe('cta')
        expect(tl.segs.some(s => s.type === 'score'), style).toBe(style === 'quiz')
      }
    }
  }, 120000)

  it('stands every frame inside the feed’s safe area, nothing cut', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try {
      for (const [lv, id] of sample()) {
        for (const style of WORDS_STYLES) {
          for (const lang of ['en', 'fr']) {
            const pl = wordsPlan(B[lv], id, { style, lang })
            const tl = wordsTimeline(pl)
            const own = new Set(pl.items.flatMap(it => [it.gloss, ...(it.choices || []), it.ex?.tr].filter(Boolean)))
            for (const sg of tl.segs.filter(x => x.type !== 'cta')) {
              const m = sg.marks
              for (const u of [0.05, (m.reveal ?? 1) - 0.1, (m.reveal ?? 1) + 1, (m.ex ?? m.reveal ?? 1) + 0.6, sg.dur - 0.05]) {
                const { ctx, texts } = placedTexts()
                drawWords(ctx, pl, tl, sg.start + Math.min(u, sg.dur - 0.01))
                for (const x of texts) {
                  const where = `${id} ${style} ${lang} ${sg.type}#${sg.i ?? ''} ${u.toFixed(1)} ${x.t}`
                  expect(x.y - x.z * 0.85, where).toBeGreaterThanOrEqual(TALL.safe.t - 1)
                  expect(x.y + x.z * 0.25, where).toBeLessThanOrEqual(TALL.h - TALL.safe.b + 1)
                  expect(x.t.endsWith('…') && ![...own].some(o => o.endsWith(x.t)), where).toBe(false)
                }
              }
            }
          }
        }
      }
    } finally { globalThis.Path2D = had }
  }, 240000)

  it('writes its page for three feeds, crediting music only where it plays, and its command', () => {
    const pl = wordsPlan(B.N5, 'N5:2', { style: 'quiz' })
    const tl = wordsTimeline(pl)
    const page = wordsPage(pl, tl, 'https://tsuji.app/en', FIGURES)
    expect(Object.keys(page.feeds)).toEqual(FEEDS)
    expect(page.title).toMatch(/^JLPT N5 word quiz: .* 9 .*#shorts$/)
    expect(page.description).toContain('Music: made for Tsuji.')
    expect(page.feeds.tiktok.caption).not.toContain('tsuji.app')
    expect(wordsCommand(pl)).toBe('VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --words N5:2 --style quiz --lang en')
    const quiet = wordsPlan(B.N5, 'theme:animals:1', { style: 'card', music: false, lang: 'fr', fit: 'instagram' })
    const qp = wordsPage(quiet, wordsTimeline(quiet), 'https://tsuji.app', FIGURES)
    expect(qp.description).not.toMatch(/Musique/)
    expect(qp.title).toMatch(/^9 mots de japonais : Animaux #shorts$/)
    expect(qp.description).not.toMatch(/JLPT/)
    expect(wordsCommand(quiet)).toBe('VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --words theme:animals:1 --style card --lang fr --fit instagram --music none')
    // A long video's own short no longer lists words or themes: they are the word shorts'.
    expect(longItems({ ...B.N5, 'kanji-N5.json': bank('kanji-N5.json'), 'grammar-N5.json': bank('grammar-N5.json') }, 'N5', 'en', 'short').some(x => x.kind === 'vocab' || x.kind === 'theme')).toBe(false)
  })

  it('turns a word over onto its picture, every picture a word’s, inside the frame (plan 257)', async () => {
    const pics = bank('pictures.json').pictures
    const known = new Set([...LEVELS.flatMap(lv => bank(`words-${lv}.json`).words), ...Object.values(bank('themes.json').themes).flatMap(th => th.words)].map(w => `${w.t}::${w.r}`))
    expect(Object.keys(pics).length).toBeGreaterThan(0)
    for (const [key, src] of Object.entries(pics)) {
      expect(known.has(key), key).toBe(true)
      expect(existsSync(new URL(`../carousel/${src}`, import.meta.url)), src).toBe(true)
    }
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    try {
      for (const lang of ['en', 'fr']) {
        const pl = wordsPlan(B.N5, 'N5:2', { style: 'card', lang })
        expect(pl.items.every(it => it.pic === pics[`${it.t}::${it.r}`]), lang).toBe(true)
        // Loaded as a page loads them; a wide one and a square one.
        expect(await loadPictures(pl, '/carousel/', async src => ({ width: src.includes('doa') ? 820 : 405, height: 374 }))).toBe(pl.items.length)
        const tl = wordsTimeline(pl)
        for (const sg of tl.segs.filter(x => x.type === 'word')) {
          const it = pl.items[sg.i]
          const m = sg.marks
          for (const u of [m.reveal - 0.1, m.reveal + 0.1, m.reveal + 1, (m.ex ?? m.reveal + 1) + 0.6, sg.dur - 0.05]) {
            const { ctx, texts } = placedTexts()
            drawWords(ctx, pl, tl, sg.start + u)
            const where = `${lang} ${it.t} ${u.toFixed(1)}`
            for (const x of texts) {
              expect(x.y - x.z * 0.85, `${where} ${x.t}`).toBeGreaterThanOrEqual(TALL.safe.t - 1)
              expect(x.y + x.z * 0.25, `${where} ${x.t}`).toBeLessThanOrEqual(TALL.h - TALL.safe.b + 1)
            }
            const said = texts.map(x => x.t)
            // Asked, the front; turned over, the back: the word with its romaji beside it, and its sentence once said.
            if (u < m.reveal) expect(said, where).not.toContain(it.ro)
            if (u > m.reveal + 0.5) {
              expect(said, where).toContain(it.t)
              expect(said, where).toContain(it.ro)
              if (it.r !== it.t) expect(said, where).toContain(it.r)
            }
            if (it.ex && u > m.ex + 0.5) expect(said.join(''), where).toContain(it.ex.tr.split(' ')[0])
          }
        }
      }
    } finally { globalThis.Path2D = had }
  })
})

describe('Read it (plan 253)', () => {
  const firstSense = str => (String(str || '').split(/[;,]\s*/)[0] || '').replace(/\s*[([（][^)\]）]*[)\]）]/g, '').trim()
  // Every N5 sentence, and every fifth of the others.
  const sentences = LEVELS.flatMap(lv => banks[lv].sentences.filter((_, i) => lv === 'N5' || i % 5 === 0).map(s => [lv, s.id]))

  it('asks a short sentence of the reading bank alone, its words, the answer and a bonus, then the app', { timeout: 240000 }, () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    let drawn = 0
    try {
      for (const [lv, id] of sentences) {
        for (const lang of ['en', 'fr']) {
          const p = plan('sentence', banks[lv], id, { ...OPTS, lang })
          const words = p.funnel.breakdown
          expect(available('read', p), `${id}`).toBe(readable(p))
          expect(readable(p), `${id}`).toBe(words.length > 0 && words.length <= 7 && !!p.funnel.translation)
          if (!readable(p)) continue
          // The bonus is the sentence said the other way where the app reads
          // its ending both ways (plan 254), else the catalogue's line on the
          // point, never the breakdown's own.
          const bonus = funnelOf('read', p).solution.bonus
          const s = banks[lv].sentences.find(x => x.id === id)
          if (s.v) expect(bonus, id).toEqual({ kind: 'version', ...s.v, rows: unstopped(s.v.rows) })
          else if (bonus) expect(['careful', 'mean'], id).toContain(bonus.kind)
          for (const design of [...DESIGNS, 'classic']) {
            for (const fmt of [FORMATS.post, FORMATS.story]) {
              const slides = deck('read', p, fmt, { design, length: '8', ending: 'pass' })
              const where = `${id} ${lang} ${design} ${fmt.id}`
              expect(slides.map(x => x.key), where).toEqual(['ask', 'words', 'answer', 'cta'])
              const own = [p.funnel.translation, bonus?.text, ...words.flatMap(w => [w.main, w.sub, w.pos])].filter(Boolean)
              slides.forEach((sl, k) => {
                const { ctx, texts } = placedTexts()
                sl.draw(ctx)
                const all = texts.map(x => x.t)
                if (sl.key === 'words') {
                  for (const w of words) {
                    if (w.ro) expect(all, `${where} ${w.t}`).toContain(w.ro)
                    if (firstSense(w.main)) expect(all.join(' '), `${where} ${w.t}`).toContain(firstSense(w.main).split(' ')[0])
                  }
                }
                if (sl.key === 'answer') expect(all.join(' '), where).toContain(p.funnel.translation.split(' ')[0])
                if (sl.key === 'answer' && bonus?.kind === 'version') expect(all.join(' '), where).toContain(lineRomaji(bonus.rows).split(' ')[0])
                if (k === 3) return
                for (const x of texts) {
                  const at = `${where} ${sl.key} ${x.t}`
                  expect(x.y - x.z * 0.85, at).toBeGreaterThanOrEqual(fmt.safe.t - 1)
                  expect(x.y + x.z * 0.25, at).toBeLessThanOrEqual(fmt.h - fmt.safe.b + 1)
                  expect(x.t.endsWith('…') && !own.some(o => o.includes(x.t)), at).toBe(false)
                }
              })
              drawn += 1
            }
          }
        }
      }
    } finally { globalThis.Path2D = had }
    expect(drawn).toBeGreaterThan(500)
    // Only a sentence of the reading bank is read so.
    const data = bank('words-N5.json')
    const wp = plan('word', data, itemsOf('word', data, 'en')[0].id, OPTS, depsFor(SOURCES.find(x => x.id === 'word'), data, itemsOf('word', data, 'en')[0].id))
    expect(available('read', wp)).toBe(false)
  })
})

describe('Read it’s own short sentences (plan 254)', () => {
  const content = JSON.parse(read('carousel/content/short.json'))
  const data = bank('short.json')
  const both = (o, at) => { expect(o?.en, at).toBeTruthy(); expect(o?.fr, at).toBeTruthy() }

  it('writes every sentence in both languages: its role, its situation, its literal reading', () => {
    expect(new Set(content.map(x => x.id)).size).toBe(content.length)
    expect(data.sentences.map(s => s.id)).toEqual(content.map(x => x.id))
    for (const x of content) {
      both(x, x.id)
      expect(x.e, x.id).toBeTruthy()
      for (const lang of ['en', 'fr']) expect(x.role[lang], x.id).toHaveLength(2)
      both(x.when, `${x.id} when`)
      if (x.lit) both(x.lit, `${x.id} lit`)
      // A literal reading is a reading, never the translation again.
      if (x.lit) expect(x.lit.en, x.id).not.toBe(x.en)
    }
  })

  it('reads each as a noun, a particle and a word, said politely, and nothing but Read it', { timeout: 240000 }, () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class { constructor(d) { this.d = d } }
    let drawn = 0
    try {
      for (const s of data.sentences) {
        const words = s.rows.filter(r => r.k !== 'punct')
        expect(words.map(r => r.k), s.id).toEqual(['word', 'particle', 'word'])
        expect(s.v.to, s.id).toBe('polite')
        for (const lang of ['en', 'fr']) {
          // Set in kana unless the studio asks for the furigana.
          const p = plan('short', data, s.id, { ...OPTS, lang })
          expect(p.script, s.id).toBe('kana')
          expect(plan('short', data, s.id, { ...OPTS, lang, script: 'furigana' }).script).toBe('furigana')
          expect(TYPES.filter(ty => available(ty.id, p)).map(ty => ty.id), s.id).toEqual(['read'])
          expect(titleOf(p, 'read').length, s.id).toBeLessThanOrEqual(TITLE_MAX)
          const spec = funnelOf('read', p)
          expect(spec.solution.bonus.kind, s.id).toBe('version')
          for (const design of DESIGNS) {
            for (const fmt of [FORMATS.post, FORMATS.story]) {
              const where = `${s.id} ${lang} ${design} ${fmt.id}`
              const slides = deck('read', p, fmt, { design, length: '5', ending: 'pass' })
              expect(slides.map(x => x.key), where).toEqual(['ask', 'words', 'answer', 'cta'])
              const own = [p.funnel.translation, p.funnel.lit, ...p.funnel.breakdown.flatMap(w => [w.main, w.sub, w.pos])].filter(Boolean)
              slides.slice(0, 3).forEach(sl => {
                const { ctx, texts } = placedTexts()
                sl.draw(ctx)
                const all = texts.map(x => x.t).join(' ')
                if (sl.key === 'ask') for (const w of words) expect(all, `${where} ${w.t}`).toContain(reading(w))
                // A line to read at a glance, never closed by a full stop (plan 255).
                expect(all, `${where} ${sl.key}`).not.toContain('。')
                if (sl.key === 'words') {
                  for (const w of p.funnel.breakdown) expect(all, `${where} ${w.t}`).toContain(w.main.split(' ')[0])
                  // French sets a narrow space before its colon.
                  if (p.funnel.lit) expect(all.replace(/[\u00a0\u202f]/g, ' '), where).toContain(FUNNEL[lang].literally)
                }
                if (sl.key === 'answer') {
                  expect(all, where).toContain(p.funnel.translation.split(' ')[0])
                  // The bonus: the polite sentence, its romaji, and its situation.
                  expect(all, where).toContain(lineRomaji(s.v.rows).split(' ')[0])
                  // Its kind is set tracked, a letter at a time.
                  expect(all.replace(/\s+/g, ''), where).toContain(FUNNEL[lang].version.polite.toLocaleUpperCase().replace(/\s+/g, ''))
                  expect(all.replace(/\s+/g, ' '), where).toContain(s.v.when[lang].split(' ')[0])
                }
                for (const x of texts) {
                  const at = `${where} ${sl.key} ${x.t}`
                  expect(x.y - x.z * 0.85, at).toBeGreaterThanOrEqual(fmt.safe.t - 1)
                  expect(x.y + x.z * 0.25, at).toBeLessThanOrEqual(fmt.h - fmt.safe.b + 1)
                  expect(x.t.endsWith('…') && !own.some(o => o.includes(x.t)), at).toBe(false)
                }
              })
              drawn += 1
            }
          }
        }
      }
    } finally { globalThis.Path2D = had }
    expect(drawn).toBe(data.sentences.length * 2 * DESIGNS.length * 2)
  })

  it('gives each word an ink of its own, the app’s, on every row it spans (plan 256)', () => {
    const sentences = [
      ...data.sentences.map(s => plan('short', data, s.id, OPTS)),
      ...LEVELS.flatMap(lv => banks[lv].sentences.map(s => plan('sentence', banks[lv], s.id, OPTS))).filter(readable),
    ]
    expect(sentences.length).toBeGreaterThan(100)
    for (const ground of ['paper', 'sumi']) {
      const p = palette(ground)
      const tokens = new Set([p.stamp, p.goldMid, p.goldLit, ...Object.values(p.line)])
      for (const pl of sentences) {
        const items = pl.funnel.breakdown
        const inks = readInks(p, items)
        const at = `${pl.source} ${pl.id} ${ground}`
        // Every word of the sentence wears one, no two words the same.
        pl.funnel.rows.forEach((r, i) => expect(inks.has(i), `${at} ${r.t}`).toBe(r.k !== 'punct'))
        const worn = items.map(it => inks.get(it.i))
        expect(new Set(worn).size, at).toBe(items.length)
        for (const it of items) for (let i = it.i; i <= it.j; i++) expect(inks.get(i), at).toBe(inks.get(it.i))
        for (const ink of worn) expect(tokens.has(ink), `${at} ${ink}`).toBe(true)
      }
    }
  })

  it('says what changed in the line the reader reads, in kana where the post is', () => {
    const W = FUNNEL.en
    expect(W.versionRule('polite', '', 'です')).toBe('Just add です to sound polite')
    expect(W.versionRule('polite', 'のむ', 'のみます')).toBe('のむ becomes のみます to sound polite')
    expect(W.versionRule('plain', 'です', '')).toBe('Among friends, just drop です')
    expect(FUNNEL.fr.versionRule('plain', '飲みます', '飲む')).toBe('飲みます devient 飲む entre amis')
  })
})

/** Every text drawn, where: its baseline, moved by translate and scale, and its size. */
function placedTexts() {
  const texts = []
  const state = { font: '10px sans-serif' }
  const size = () => parseFloat(/([\d.]+)px/.exec(state.font)?.[1] || '10')
  const widthOf = t => [...String(t)].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.56), 0) * size()
  let m = { dy: 0, k: 1 }
  const stack = []
  const methods = {
    measureText: t => ({ width: widthOf(t), actualBoundingBoxAscent: size() * 0.72, actualBoundingBoxDescent: size() * 0.12, actualBoundingBoxLeft: 0, actualBoundingBoxRight: widthOf(t) }),
    fillText: (t, x, y) => { if (String(t).trim()) texts.push({ t: String(t), y: m.dy + y * m.k, z: size() * m.k }) },
    save: () => stack.push({ ...m }), restore: () => { m = stack.pop() ?? { dy: 0, k: 1 } },
    translate: (x, y) => { m.dy += y * m.k }, scale: (a, b) => { m.k *= b },
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }
  const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
  return { ctx, texts }
}
