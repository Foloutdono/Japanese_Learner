import { describe, it, expect } from 'vitest'
import { stripInterCjkSpaces, collapseBlankLines, normalize, JAPANESE_SCRIPT_RE } from './ocr'

// Pure functions only -- no worker, no WASM, no network. `recognize`
// itself is deliberately NOT tested here: running real OCR on a real
// image is slow, flaky, and tests Tesseract rather than this file (see
// plan 018's test plan).
describe('stripInterCjkSpaces', () => {
  it('removes the space Tesseract inserts between Japanese characters', () => {
    expect(stripInterCjkSpaces('日本 語 を 勉強 する')).toBe('日本語を勉強する')
  })

  it('leaves a space adjacent to Latin text alone (only strips JP-JP)', () => {
    expect(stripInterCjkSpaces('日本語 Japan 語学')).toBe('日本語 Japan 語学')
  })

  it('is a no-op on text with no adjacent Japanese runs', () => {
    expect(stripInterCjkSpaces('hello world')).toBe('hello world')
  })
})

describe('collapseBlankLines', () => {
  it('collapses runs of blank lines to one', () => {
    expect(collapseBlankLines('一行目\n\n\n二行目')).toBe('一行目\n二行目')
  })

  it('trims leading and trailing whitespace', () => {
    expect(collapseBlankLines('\n\n  text  \n\n')).toBe('text')
  })
})

describe('normalize', () => {
  it('applies both space-stripping and blank-line collapsing together', () => {
    expect(normalize('日本 語\n\n\nを 勉強\n\n')).toBe('日本語\nを勉強')
  })
})

describe('JAPANESE_SCRIPT_RE', () => {
  it('matches hiragana, katakana, and kanji', () => {
    expect(JAPANESE_SCRIPT_RE.test('あ')).toBe(true)
    expect(JAPANESE_SCRIPT_RE.test('ア')).toBe(true)
    expect(JAPANESE_SCRIPT_RE.test('学')).toBe(true)
  })

  it('does not match Latin letters or digits', () => {
    expect(JAPANESE_SCRIPT_RE.test('a')).toBe(false)
    expect(JAPANESE_SCRIPT_RE.test('5')).toBe(false)
  })
})
