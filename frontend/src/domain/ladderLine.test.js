import { describe, it, expect } from 'vitest'
import { moveOf, outcomesOf } from './ladderLine'
import { ratingButtons } from './ratingScales'
import cards from '../testing/grammarLadder.json'
import fr from '../locales/fr'

// ── 梯子 — what each rating does to the point (plan 198) ─────────────
// The card panel's walk groups the verdicts by outcome: two verdicts
// that move the point the same way and bring it back after the same wait
// are one row. The fixtures are the cards the backend serves for
// 〜てください at Choisir 2, Construire 2 and mastered, their forecasts
// carrying where each rating leaves the point (srs.preview_reviews_bulk).

const pos = (group, at, of, relapse = false) => ({ group, at, of, relapse })

const verdictsOf = scale => ratingButtons(scale, fr).map((b, i) => ({ ...b, digit: i + 1 })).reverse()
const rowsOf = (card, scale = 'simple') => outcomesOf(card, verdictsOf(scale), fr)
// A forecast as the server served it before the landings.
const withoutLandings = p => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'step' && k !== 'passed'))
const summary = rows => rows.map(r => [
  r.move, r.passed, `${r.figure.value} ${r.figure.unit}`, r.verdicts.map(v => `${v.digit}:${v.label}`),
])

describe('where a rating moves the point', () => {
  it('stays on the step a miss asks again and a mastered point keeps', () => {
    expect(moveOf(pos('choose', 2, 3), pos('choose', 2, 3))).toBe('stay')
    expect(moveOf(pos('mastered', 1, 1), pos('mastered', 1, 1))).toBe('stay')
    expect(moveOf(pos('choose', 1, 1, true), pos('choose', 1, 1, true))).toBe('stay')
  })

  it('goes on to the next stop on a pass, up to mastered and through a relapse', () => {
    expect(moveOf(pos('choose', 2, 3), pos('choose', 3, 3))).toBe('next')
    expect(moveOf(pos('choose', 3, 3), pos('build', 1, 4))).toBe('next')
    expect(moveOf(pos('build', 4, 4), pos('mastered', 1, 1))).toBe('next')
    expect(moveOf(pos('choose', 1, 1, true), pos('build', 1, 1, true))).toBe('next')
    expect(moveOf(pos('build', 1, 1, true), pos('mastered', 1, 1))).toBe('next')
  })

  it('goes back only from mastered, to the relapse', () => {
    expect(moveOf(pos('mastered', 1, 1), pos('choose', 1, 1, true))).toBe('back')
  })
})

describe('what each verdict does, grouped by outcome', () => {
  it('is two outcomes on Choisir: a miss asks it again, a pass climbs', () => {
    expect(summary(rowsOf(cards.choose))).toEqual([
      ['stay', false, '10 min', ['4:Raté', '3:Presque']],
      ['next', true, '1 h', ['2:Correct', '1:Facile']],
    ])
  })

  it('is two on Construire, with the wait the next step has', () => {
    expect(summary(rowsOf(cards.build))).toEqual([
      ['stay', false, '10 min', ['4:Raté', '3:Presque']],
      ['next', true, '4 jours', ['2:Correct', '1:Facile']],
    ])
  })

  it('sends a miss once mastered back to the relapse, and keeps it on a pass', () => {
    expect(summary(rowsOf(cards.mastered))).toEqual([
      ['back', false, '10 min', ['4:Raté', '3:Presque']],
      ['stay', true, '5 sem.', ['2:Correct', '1:Facile']],
    ])
  })

  it('keeps the learner\'s own scale: the six buttons, the two', () => {
    expect(rowsOf(cards.mastered, 'full').map(r => r.verdicts.map(v => v.digit))).toEqual([[6, 5, 4], [3], [2, 1]])
    expect(summary(rowsOf(cards.choose, 'binary'))).toEqual([
      ['stay', false, '10 min', ['2:Raté']],
      ['next', true, '1 h', ['1:Correct']],
    ])
  })

  it('reads worst to best, and merges only neighbours that do the same', () => {
    const rows = rowsOf(cards.choose, 'full')
    expect(rows.map(r => r.verdicts.map(v => v.q))).toEqual([[0, 1, 2], [3, 4, 5]])
    expect(rows.map(r => r.due)).toEqual([600, 3600])
  })

  it('says nothing where the card cannot: off the ladder, without a forecast, or served before the landings', () => {
    const verdicts = verdictsOf('simple')
    expect(outcomesOf(null, verdicts, fr)).toBeNull()
    expect(outcomesOf({ review_preview: cards.choose.review_preview }, verdicts, fr)).toBeNull()
    expect(outcomesOf({ step: cards.choose.step }, verdicts, fr)).toBeNull()
    const old = Object.fromEntries(Object.entries(cards.choose.review_preview).map(([q, p]) => [q, withoutLandings(p)]))
    expect(outcomesOf({ ...cards.choose, review_preview: old }, verdicts, fr)).toBeNull()
  })
})
