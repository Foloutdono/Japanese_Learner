import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readVideoSound, saveVideoSound, clampVolume, DEFAULT_VIDEO_SOUND } from './videoVolume'

// The node lane has no localStorage, and this module is written to
// survive not having one (private mode, a storage policy) -- so the
// store is stubbed here rather than assumed, and one case takes it away
// again to pin the fallback.
function useStore(store) {
  vi.stubGlobal('window', { localStorage: store })
}

const memoryStore = () => {
  const data = new Map()
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    data,
  }
}

describe('videoVolume', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('reads the default when nothing is saved', () => {
    useStore(memoryStore())
    expect(readVideoSound()).toEqual(DEFAULT_VIDEO_SOUND)
  })

  it('round-trips a saved setting', () => {
    useStore(memoryStore())
    saveVideoSound({ volume: 35, muted: true })
    expect(readVideoSound()).toEqual({ volume: 35, muted: true })
  })

  // A hand-edited or half-written entry must never reach the player:
  // YT.setVolume(NaN) silences it with no way back through the UI, and
  // the learner's only clue is a dial that does nothing.
  it('repairs a broken entry rather than handing it to the player', () => {
    const store = memoryStore()
    useStore(store)
    for (const bad of ['null', '"loud"', '{"volume":"x"}', '{"volume":140}', '{"volume":-20}', 'not json']) {
      store.setItem('jp-video-sound', bad)
      const { volume, muted } = readVideoSound()
      expect(Number.isFinite(volume), bad).toBe(true)
      expect(volume >= 0 && volume <= 100, bad).toBe(true)
      expect(typeof muted, bad).toBe('boolean')
    }
  })

  it('reads muted only from a real true', () => {
    const store = memoryStore()
    useStore(store)
    store.setItem('jp-video-sound', '{"volume":50,"muted":"yes"}')
    expect(readVideoSound()).toEqual({ volume: 50, muted: false })
  })

  // Storage refuses in private mode and under some policies. The
  // setting still has to apply for the session -- a throw here would
  // take the whole transport bar down with it.
  it('survives a storage that throws', () => {
    useStore({
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    })
    expect(readVideoSound()).toEqual(DEFAULT_VIDEO_SOUND)
    expect(() => saveVideoSound({ volume: 10, muted: false })).not.toThrow()
  })

  it('clamps and rounds to the IFrame API unit', () => {
    expect(clampVolume(0)).toBe(0)
    expect(clampVolume(100)).toBe(100)
    expect(clampVolume(101)).toBe(100)
    expect(clampVolume(-1)).toBe(0)
    // The range input hands its value over as a string.
    expect(clampVolume('45')).toBe(45)
    expect(clampVolume(45.6)).toBe(46)
    expect(clampVolume('nope')).toBe(DEFAULT_VIDEO_SOUND.volume)
  })
})
