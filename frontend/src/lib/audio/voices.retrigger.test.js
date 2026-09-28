import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── One sound per moment ──────────────────────────────────
// The same event asked for twice inside a few milliseconds is one
// gesture heard twice (the deck's Export chip sounded its pick in its
// handler and again in the action it called), and plays as a flam. The
// graph is mocked down to the one node every voice opens -- voiceOut --
// so what is counted is voices started, not what they would sound like.

const mocks = vi.hoisted(() => ({ voiceOut: vi.fn(() => ({})) }))

vi.mock('./context', () => ({ getAudioContext: () => ({}), getBuffer: vi.fn() }))
vi.mock('./mixer', () => ({ busFor: () => ({}), playBuffer: vi.fn() }))
vi.mock('./synth', () => ({
  voiceOut: mocks.voiceOut,
  tones: vi.fn(), bar: vi.fn(), noiseTicks: vi.fn(), noiseSweep: vi.fn(), thump: vi.fn(),
}))

const { playVoice } = await import('./voices')

let now = 1000
beforeEach(() => {
  mocks.voiceOut.mockClear()
  now += 10_000   // each test starts well clear of the last one's sounds
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => vi.restoreAllMocks())

describe('playVoice', () => {
  it('drops the same event asked for again at once', () => {
    playVoice('click-mode-selection')
    now += 5
    playVoice('click-mode-selection')
    expect(mocks.voiceOut).toHaveBeenCalledTimes(1)
  })

  it('plays it again once the moment has passed', () => {
    playVoice('click')
    now += 60
    playVoice('click')
    expect(mocks.voiceOut).toHaveBeenCalledTimes(2)
  })

  it('leaves different events alone, however close', () => {
    // A rating is the answer, the fare and the card turning: three
    // things, meant to be heard as three.
    playVoice('correct')
    playVoice('fare-tick')
    playVoice('card-transition')
    expect(mocks.voiceOut).toHaveBeenCalledTimes(3)
  })
})
