import { describe, it, expect } from 'vitest'
import { CHOICE_KEY_INDEX, LETTER_KEY_INDEX, PICK_KEY_DIGIT } from './choiceKeys'

// Plan 122: the boarding's picks on the desk, by the digit each names.
describe('the boarding\'s pick keys', () => {
  it('reads 0-6 off the number row, on QWERTY and on both AZERTY rows', () => {
    for (const d of ['0', '1', '2', '3', '4', '5', '6']) expect(PICK_KEY_DIGIT[d]).toBe(d)
    expect(['à', '&', 'é', '"', "'", '(', '-'].map(k => PICK_KEY_DIGIT[k])).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(PICK_KEY_DIGIT['§']).toBe('6')
    expect(PICK_KEY_DIGIT['7']).toBeUndefined()
    expect(PICK_KEY_DIGIT.a).toBeUndefined()
  })

  it('leaves the runs\' choice keys as they were', () => {
    expect(CHOICE_KEY_INDEX).toEqual({ '1': 0, '2': 1, '3': 2, '4': 3, '&': 0, 'é': 1, '"': 2, "'": 3 })
    expect(LETTER_KEY_INDEX).toEqual({ a: 0, b: 1, c: 2, d: 3 })
  })
})
