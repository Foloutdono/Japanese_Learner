import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, RATING_INKS, layoutSentence } from '../carousel/draw.js'
import { LEVELS, SOURCES, TITLE_MAX, chunksOf, depsOf, itemsOf, lineRomaji, plan, readingMisses, titleOf, unpack } from '../carousel/sources.js'
import { ENDING_IDS, TYPES, available, deck, endingSlide } from '../carousel/slides.js'
import { assemblyQ, overlaps } from '../carousel/quizzes.js'
import { furiganaOf } from '../carousel/common.js'
import { howItWorks, particleLabel, senseOf, stacksIn } from '../carousel/explain.js'
import { STRINGS, weld, weldIf } from '../carousel/strings.js'

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

  it('titles every carousel within the feed’s 90 characters (plan 200l)', () => {
    for (const { src, p } of every) {
      for (const type of TYPES.map(x => x.id).filter(x => available(x, p))) {
        const title = titleOf(p, type, 3)
        expect([...title].length, `${src.id} ${p.id} ${type}`).toBeLessThanOrEqual(TITLE_MAX)
        expect(title, `${src.id} ${p.id} ${type}`).not.toMatch(/undefined|null|NaN/)
      }
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

  it('never deals a reading the word also takes (plan 200l)', () => {
    // 店 is みせ and てん: a one-kanji word keeps its other readings out.
    expect(readingMisses({ t: '店', fu: [['店', 'みせ']] }, kanjiIndex)).not.toContain('てん')
    // 行く is いく and ゆく in the deck.
    expect(readingMisses({ t: '行く', fu: [['行', 'ゆ'], ['く', '']] }, kanjiIndex, ['いく'])).not.toContain('いく')
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

  it('reads a number and its counter as one word (plan 200l)', () => {
    const rows = sentence('駅で三十分待ちました。').rows
    const n = rows.find(r => r.t === '三十分')
    expect(n?.ro).toBe('sanjuppun')
    expect(n?.en).toEqual(['30 minutes'])
    expect(rows.some(r => r.t === '三十' || r.t === '分')).toBe(false)
  })

  it('names a particle in the breakdown by what it does there (plan 200l)', () => {
    const rows = sentence('駅で三十分待ちました。').rows
    expect(particleLabel(rows, rows.findIndex(r => r.t === 'で'), 'en')).toBe('place')
    expect(particleLabel(rows, rows.findIndex(r => r.t === 'で'), 'fr')).toBe('lieu')
    // から after a verb is “because”: no “from” label there.
    const why = LEVELS.flatMap(lv => banks[lv].sentences).map(s => s.rows)
      .flatMap(rs => rs.map((r, i) => [rs, i]).filter(([, i]) => rs[i].t === 'から' && rs[i - 1]?.pos === 'verb'))
    for (const [rs, i] of why) expect(particleLabel(rs, i, 'en')).toBeNull()
  })

  it('gives no stacked slide to a pair that is no two particles (plan 200l)', () => {
    const keys = jp => stacksIn(sentence(jp).rows, 'en', glossEn).map(x => x.key)
    expect(keys('この棚は古くて、今にも壊れそうです。')).not.toContain('にも')
    expect(keys('定期券を家に忘れたばかりに、往復とも切符を買わなければならなかった。')).not.toContain('とも')
    expect(keys('専門家とは言わないまでも、彼の考古学の知識はかなりのものだ。')).not.toContain('とは')
    expect(keys('住民への事前の説明なしに、会社は工場の建設に着工した。')).not.toContain('への')
  })

  it('names the right words around a stacked pair (plan 200l)', () => {
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
})
