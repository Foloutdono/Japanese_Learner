import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { RATING_INKS, lineRomaji, model, readingMisses, weld } from '../carousel/slides.js'

// ── カルーセル — the carousel studio (plan 200) ──
// A static tool outside src/ (frontend/carousel/), so none of the app's
// guards see it. These are its own: the inks it adds to tokens.mjs stay
// the app's, the bank backend/scripts/carousel_bank.py writes still
// spells every sentence back, and a quiz never deals its answer twice.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const banks = Object.fromEntries(LEVELS.map(lv => [lv, JSON.parse(read(`carousel/bank/${lv}.json`))]))
const OPTS = { lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', slides: {} }

describe('the carousel studio', () => {
  it('draws the verdict inks index.css declares', () => {
    const css = read('src/index.css')
    for (const [name, value] of Object.entries(RATING_INKS)) {
      expect(css, name).toMatch(new RegExp(`${name}:\\s*${value};`))
    }
  })

  it('has a bank for every level, each sentence spelled back by its words', () => {
    for (const lv of LEVELS) {
      const bank = banks[lv]
      expect(bank.level).toBe(lv)
      expect(bank.sentences.length).toBeGreaterThan(100)
      for (const s of bank.sentences) {
        expect(s.rows.map(r => r.t).join(''), s.id).toBe(s.jp)
        expect(bank.points[s.p], `${s.id}: ${s.p}`).toBeTruthy()
      }
    }
  })

  it('deals four different answers, the right one once', () => {
    for (const lv of LEVELS) {
      const bank = banks[lv]
      for (const s of bank.sentences) {
        const { quiz } = model(bank, s, OPTS)
        expect(new Set(quiz.choices).size, s.id).toBe(quiz.choices.length)
        expect(quiz.choices[quiz.right], s.id).toBe(quiz.answer)
        expect(quiz.choices.filter(c => c === quiz.answer), s.id).toHaveLength(1)
      }
    }
  })

  it('never offers a reading as its own near-miss', () => {
    const bank = banks.N5
    for (const s of bank.sentences) {
      for (const row of s.rows.filter(r => r.fu)) {
        const reading = row.fu.map(([t, r]) => r || t).join('')
        expect(readingMisses(row, bank.kanji), row.t).not.toContain(reading)
      }
    }
  })

  it('reads a sentence in romaji word by word', () => {
    const s = banks.N5.sentences.find(x => x.jp === '駅で友だちに会います。')
    expect(lineRomaji(s.rows)).toBe('Eki de tomodachi ni aimasu.')
  })

  it('welds French punctuation to the word before it', () => {
    expect(weld('Tu sais la lire ?')).toBe('Tu sais la lire ?')
    expect(weld('« Je reviendrai. »')).toBe('« Je reviendrai. »')
  })
})
