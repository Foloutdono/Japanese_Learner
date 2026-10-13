import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { RATING_INKS } from '../carousel/draw.js'
import { LEVELS, SOURCES, depsOf, itemsOf, lineRomaji, plan, readingMisses, unpack } from '../carousel/sources.js'
import { howItWorks, senseOf, stacksIn } from '../carousel/explain.js'
import { weld } from '../carousel/strings.js'

// ── カルーセル — the carousel studio (plans 200, 200b) ──
// A static tool outside src/ (frontend/carousel/), so none of the app's
// guards see it. These are its own: the inks it adds to tokens.mjs stay
// the app's, the bank backend/scripts/carousel_bank.py writes still
// spells every sentence back, every item of every source draws, a quiz
// never deals its answer twice, and an explanation names the one sense
// its sentence uses, or none.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const bank = file => JSON.parse(read(`carousel/bank/${file}`))
const banks = Object.fromEntries(LEVELS.map(lv => [lv, bank(`${lv}.json`)]))
const OPTS = { lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', kanji: '', handle: '@tsuji.app', slides: {} }
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

  it('draws every item of every source, with four different answers where it asks', { timeout: 120000 }, () => {
    for (const src of SOURCES) {
      for (const { data, filter } of filesOf(src)) {
        const items = itemsOf(src.id, data, 'en', filter)
        expect(items.length, src.id).toBeGreaterThan(0)
        for (const { id } of items) {
          const p = plan(src.id, data, id, OPTS, depsFor(src, data, id))
          expect(p.slides.length, `${src.id} ${id}`).toBeGreaterThan(1)
          const quizzes = [p.quiz, ...p.slides.filter(s => s.kind === 'quiz').map(s => s.quiz)].filter(Boolean)
          for (const q of quizzes) {
            const keys = q.choices.map(c => JSON.stringify(c.text ?? c.rows))
            expect(new Set(keys).size, `${src.id} ${id}`).toBe(keys.length)
            expect(q.right, `${src.id} ${id}`).toBeGreaterThanOrEqual(0)
            expect(q.right, `${src.id} ${id}`).toBeLessThan(q.choices.length)
          }
        }
      }
    }
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
