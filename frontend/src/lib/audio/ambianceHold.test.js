import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 夜 — a print turned to another hour is heard at it (plan 250b) ────
// The month's finish brings the night down on Today's print whatever
// the clock says; the lake under it is the night's while the print
// holds it, crossed over to and back from, and the clock's half-minute
// read does not take the hour back from the hold.

const clock = vi.hoisted(() => ({ hour: 'day' }))
const mixer = vi.hoisted(() => ({
  playBuffer: vi.fn((buffer, bus, name, opts) => ({ buffer, opts, gain: { gain: {} }, level: 1 })),
  fadeOutAndStop: vi.fn(),
  ramp: vi.fn(),
}))
vi.mock('./context', () => ({
  getAudioContext: () => ({ decodeAudioData: (bytes, ok) => ok({ url: bytes.url }) }),
  whenUnlocked: vi.fn(),
}))
vi.mock('./mixer', () => mixer)
vi.mock('./settings', () => ({ isMuted: () => false }))
vi.mock('./speech', () => ({ stopSpeaking: vi.fn() }))
vi.mock('../../domain/printHour', () => ({ printHour: () => clock.hour }))

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
const played = () => mixer.playBuffer.mock.calls.map(([buffer]) => buffer.url.match(/(\w+)\.mp3$/)[1])

let audio
beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  clock.hour = 'day'
  globalThis.fetch = vi.fn(async url => ({ ok: true, arrayBuffer: async () => ({ url, slice() { return this } }) }))
  audio = await import('./ambiance')
})

afterEach(() => {
  audio.stopAmbiance()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('a print\'s hour held over the clock\'s', () => {
  it('crosses over to the held hour and back to the clock\'s when let go', async () => {
    audio.startAmbiance()
    await flush()
    expect(played()).toEqual(['day'])
    const day = mixer.playBuffer.mock.results[0].value

    const release = audio.holdAmbianceHour('night')
    await flush()
    expect(played()).toEqual(['day', 'night'])
    const night = mixer.playBuffer.mock.results[1].value
    // A crossover: the night comes in as long as the day goes out.
    expect(night.opts.fadeIn).toBe(1.6)
    expect(mixer.fadeOutAndStop).toHaveBeenCalledWith(day, 1.6)

    // The clock reads the day again on its half minute; the hold stands.
    vi.advanceTimersByTime(30_000)
    await flush()
    expect(played()).toEqual(['day', 'night'])

    release()
    await flush()
    expect(played()).toEqual(['day', 'night', 'day'])
    expect(mixer.fadeOutAndStop).toHaveBeenCalledWith(night, 1.6)
  })

  it('starts at the held hour when the hold came first', async () => {
    audio.holdAmbianceHour('night')
    audio.startAmbiance()
    await flush()
    expect(played()).toEqual(['night'])
  })

  it('plays nothing for a hold while no screen asks for the lake', async () => {
    const release = audio.holdAmbianceHour('night')
    release()
    await flush()
    expect(mixer.playBuffer).not.toHaveBeenCalled()
  })

  it('lets a stale release go by', async () => {
    audio.startAmbiance()
    await flush()
    const first = audio.holdAmbianceHour('night')
    await flush()
    audio.holdAmbianceHour('dusk')
    await flush()
    first()
    await flush()
    expect(played()).toEqual(['day', 'night', 'dusk'])
  })
})
