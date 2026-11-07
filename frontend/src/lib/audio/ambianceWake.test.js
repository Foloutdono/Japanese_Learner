import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── The lake after the tab comes back ────────────────────────────────
// Hiding the tab fades the lake to zero and suspends the context. Coming
// back used to fade it in only once resume() resolved, and Safari can
// refuse a resume that no gesture asked for: the tap that later woke
// the context (context.js) found the lake still at zero, and it stayed
// silent for as long as the screen was open. Nor is the lake turned
// down for the mute: the master bus does that, and a lake turned down
// here as well stayed down once the sound came back on.

const ctx = vi.hoisted(() => ({
  decodeAudioData: (bytes, ok) => ok({ url: bytes.url }),
  suspend: null,
  resume: null,
}))
const mixer = vi.hoisted(() => ({
  playBuffer: vi.fn(() => ({ gain: { gain: {} }, level: 0.45 })),
  fadeOutAndStop: vi.fn(),
  ramp: vi.fn(),
}))
vi.mock('./context', () => ({ getAudioContext: () => ctx, whenUnlocked: vi.fn() }))
vi.mock('./mixer', () => mixer)
vi.mock('./settings', () => ({ isMuted: () => true }))
vi.mock('./speech', () => ({ stopSpeaking: vi.fn() }))
vi.mock('../../domain/printHour', () => ({ printHour: () => 'day' }))

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }

let audio
let page
beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  // A resume no gesture asked for, refused as Safari refuses it.
  ctx.suspend = vi.fn(() => Promise.resolve())
  ctx.resume = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
  globalThis.fetch = vi.fn(async url => ({ ok: true, arrayBuffer: async () => ({ url, slice() { return this } }) }))
  audio = await import('./ambiance')
})

afterEach(() => {
  audio.stopAmbiance()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function look(hidden) {
  page.hidden = hidden
  page.dispatchEvent(new Event('visibilitychange'))
}

describe('the lake', () => {
  it('fades back in when the tab returns, whether or not the resume is allowed', async () => {
    audio.startAmbiance()
    await flush()
    const lake = mixer.playBuffer.mock.results[0].value

    look(true)
    expect(mixer.ramp).toHaveBeenLastCalledWith(lake.gain.gain, 0, 0.25)
    vi.advanceTimersByTime(300)
    expect(ctx.suspend).toHaveBeenCalledOnce()

    look(false)
    expect(ctx.resume).toHaveBeenCalled()
    expect(mixer.ramp).toHaveBeenLastCalledWith(lake.gain.gain, lake.level, 1.2)
    await flush()
    expect(mixer.ramp).toHaveBeenLastCalledWith(lake.gain.gain, lake.level, 1.2)
  })

  it('starts at its level while muted: the master bus is what mutes it', async () => {
    audio.startAmbiance()
    await flush()
    expect(mixer.playBuffer).toHaveBeenCalledOnce()
    expect(mixer.ramp).not.toHaveBeenCalled()
  })
})
