import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Which kana clip is asked for (plan 121) ──────────────────────
// The kana set was regenerated under the same paths as the recordings
// it replaced, and the service worker keeps /sounds/ cache-first for a
// year: the revision on the URL is what makes a returning learner fetch
// the new set. And a card names its clip by `sound`, not by romaji,
// because ウォ's romaji is を's.

const mocks = vi.hoisted(() => ({
  getBuffer: vi.fn(() => Promise.resolve(null)),
  getAudioContext: vi.fn(() => ({})),
  playBuffer: vi.fn(),
}))

vi.mock('./context', async o => ({ ...(await o()), getBuffer: mocks.getBuffer, getAudioContext: mocks.getAudioContext }))
vi.mock('./mixer', async o => ({ ...(await o()), playBuffer: mocks.playBuffer }))

const { playKana, kanaSound, KANA_REV } = await import('./playback')

beforeEach(() => mocks.getBuffer.mockClear())

describe('playKana', () => {
  it('asks for the clip under the kana set\'s revision', () => {
    playKana('ka')
    expect(mocks.getBuffer).toHaveBeenCalledWith(`/sounds/kanas/ka.mp3?v=${KANA_REV}`)
  })

  it('asks for nothing without a name', () => {
    playKana('')
    playKana(undefined)
    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })
})

describe('kanaSound', () => {
  it('is the card\'s sound where it has one, its romaji otherwise', () => {
    expect(kanaSound({ kana: 'ウォ', romaji: 'wo', sound: 'wo_foreign' })).toBe('wo_foreign')
    expect(kanaSound({ kana: 'を', romaji: 'wo', sound: 'wo' })).toBe('wo')
    // A card from before the field existed.
    expect(kanaSound({ kana: 'か', romaji: 'ka' })).toBe('ka')
    expect(kanaSound(null)).toBe('')
  })
})
