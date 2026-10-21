import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_DISPLAY, readDisplay, saveDisplay } from './displayPrefs'

// ── 表示 — the Affichage sheet's settings, kept by this browser (plan 263) ──
const store = new Map()
globalThis.window = globalThis.window ?? {}
window.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}

beforeEach(() => store.clear())

describe('the stage\'s three helps', () => {
  it('opens on readings where needed, no rōmaji, the translation', () => {
    expect(readDisplay()).toEqual({ furigana: 'unknown', romaji: false, translation: true })
  })

  it('reads back what was saved', () => {
    saveDisplay({ furigana: 'all', romaji: true, translation: false })
    expect(readDisplay()).toEqual({ furigana: 'all', romaji: true, translation: false })
  })

  it('takes the default for a value it does not know, and for a broken entry', () => {
    store.set('tsuji.anlDisplay', JSON.stringify({ furigana: 'some', romaji: 'yes', translation: false }))
    expect(readDisplay()).toEqual({ ...DEFAULT_DISPLAY, translation: false })
    store.set('tsuji.anlDisplay', '{not json')
    expect(readDisplay()).toEqual(DEFAULT_DISPLAY)
  })

  it('opens on the defaults where storage is refused', () => {
    const real = window.localStorage
    window.localStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
    try {
      expect(readDisplay()).toEqual(DEFAULT_DISPLAY)
      expect(() => saveDisplay({ furigana: 'all', romaji: true, translation: true })).not.toThrow()
    } finally {
      window.localStorage = real
    }
  })
})
