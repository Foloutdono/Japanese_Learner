import { describe, it, expect } from 'vitest'
import { GLYPHS, PLATES, PLATFORM_LINE, daySum, doneCount, rewardText } from './missions'
import { VALUES } from '../lib/track'
import fr from '../locales/fr/index.js'
import en from '../locales/en/index.js'
import es from '../locales/es/index.js'
import id from '../locales/id/index.js'
import { missionsFixture, bookFixture } from '../components/missions/fixtures'

const KINDS = VALUES.mission_done.kind
const DISCOVERIES = ['first_dictation', 'first_photo', 'first_conversation', 'first_exam', 'first_deck', 'first_friend', 'first_duel', 'arrival_date', 'first_import', 'first_video']
const ACHIEVEMENTS = ['kana_done', 'words_100', 'words_500', 'words_1000', 'grammar_n5', 'days_7', 'days_30', 'days_100', 'exam_passed', 'ranked_win']

describe('missions (plan 331): what the screens know', () => {
  it('hangs a plate for every achievement and inks a glyph for every discovery', () => {
    expect(Object.keys(PLATES).sort()).toEqual([...ACHIEVEMENTS].sort())
    expect(Object.keys(GLYPHS).sort()).toEqual([...DISCOVERIES].sort())
    expect(new Set(Object.values(PLATES).map(p => p.code)).size).toBe(ACHIEVEMENTS.length)
  })

  it('names only ids the trail knows', () => {
    for (const key of [...ACHIEVEMENTS, ...DISCOVERIES]) expect(KINDS, key).toContain(key)
    expect(VALUES.mission_claimed.kind).toEqual(KINDS)
  })

  it('reads a reward as credits for a free learner and XP for the pass', () => {
    expect(rewardText({ credits: 8, xp: 5 })).toBe('+8')
    expect(rewardText({ credits: 0, xp: 13 })).toBe('+13 XP')
  })

  it('sums the day the way the server pays it', () => {
    const free = missionsFixture().day
    expect(daySum(free)).toBe('+30')
    expect(daySum(missionsFixture({ plan: 'max' }).day)).toBe('+50 XP')
    expect(doneCount(free)).toBe(2)
    expect(doneCount(null)).toBe(0)
  })

  it('sends a practice coupon to a line that exists', () => {
    expect(Object.values(PLATFORM_LINE).sort()).toEqual(['exam', 'honyaku', 'kaiwa', 'kakitori', 'reading', 'rikai', 'sakubun'])
  })

  it('has a fixture the server could have sent', () => {
    const book = bookFixture()
    expect(book.achievements.map(a => a.key)).toEqual(ACHIEVEMENTS)
    expect(book.discoveries.map(d => d.key)).toEqual(DISCOVERIES)
  })
})

describe('missions (plan 331): every text in every language', () => {
  const day = ['duel', 'explain', 'analyze', 'comprehension', 'dictation', 'read', 'conversation', 'message', 'translation', 'composition', 'exam', 'in_out', 'ask', 'due', 'new', 'accuracy', 'write', 'all3']
  const week = ['days5', 'volume', 'new_mode', 'exam_section', 'duels5', 'write10']
  for (const [lang, table] of [['fr', fr], ['en', en], ['es', es], ['id', id]]) {
    it(`says every mission and every plate in ${lang}`, () => {
      for (const kind of [...day, ...week]) {
        const said = table.msnLabel[kind]({ of: 20, goal: 87, platform: 'reading' })
        expect(typeof said, `${lang} ${kind}`).toBe('string')
        expect(said.length).toBeGreaterThan(3)
      }
      for (const key of [...DISCOVERIES, ...ACHIEVEMENTS]) expect(table.msnMark[key], `${lang} ${key}`).toBeTruthy()
      for (const platform of ['reading', 'comprehension', 'translation', 'conversation']) {   // the retired `practice`'s four
        expect(table.msnLabel.practice({ platform })).not.toBe(table.msnLabel.practice({ platform: 'x' }))
      }
    })
  }
})
