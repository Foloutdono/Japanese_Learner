import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, RATING_INKS } from '../carousel/draw.js'
import { LEVELS, SOURCES, chunksOf, depsOf, itemsOf, lineRomaji, plan, readingMisses, unpack } from '../carousel/sources.js'
import { ENDING_IDS, TYPES, available, deck, endingSlide } from '../carousel/slides.js'
import { assemblyQ, overlaps } from '../carousel/quizzes.js'
import { howItWorks, senseOf, stacksIn } from '../carousel/explain.js'
import { STRINGS, weld } from '../carousel/strings.js'

// ── カルーセル — the carousel studio (plans 200, 200b, 200c) ──
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
      for (const { id } of itemsOf(src.id, data, 'en', filter)) every.push({ src, id, p: plan(src.id, data, id, OPTS, depsFor(src, data, id)) })
    }
  }

  it('draws every item of every source as every type it can be', { timeout: 120000 }, () => {
    for (const src of SOURCES) expect(every.some(x => x.src === src), src.id).toBe(true)
    for (const { src, id, p } of every) {
      for (const type of TYPES.map(x => x.id).filter(x => available(x, p))) {
        const slides = deck(type, p, FORMATS.post, { ground: 'paper' })
        expect(slides.length, `${src.id} ${id} ${type}`).toBeGreaterThan(2)
        expect(slides.at(-1).key, `${src.id} ${id} ${type}`).toBe('outro')
        expect(new Set(slides.map(x => x.key)).size, `${src.id} ${id} ${type}`).toBe(slides.length)
      }
    }
  })

  it('ends on any of the endings, for every source, in both formats', () => {
    const had = globalThis.Path2D
    globalThis.Path2D = class {}
    try {
      for (const src of SOURCES) {
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

  it('marks the source’s own station on the route map, and only it', () => {
    for (const src of SOURCES) {
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

  it('reads a sentence in romaji word by word', () => {
    expect(lineRomaji(sentence('駅で友だちに会います。').rows)).toBe('Eki de tomodachi ni aimasu.')
  })

  it('welds French punctuation to the word before it', () => {
    expect(weld('Tu sais la lire ?')).toBe('Tu sais la lire\u00a0?')
    expect(weld('« Je reviendrai. »')).toBe('«\u00a0Je reviendrai.\u00a0»')
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

  it('leaves a pattern’s own pieces unlabelled', () => {
    const h = how('のどがいたいので、今日の講義は休みます。', '〜ので')
    const lit = h.items.filter(x => x.lit)
    expect(lit.map(x => x.t).join('')).toBe('ので')
    expect(lit.every(x => x.label === '')).toBe(true)
  })
})
