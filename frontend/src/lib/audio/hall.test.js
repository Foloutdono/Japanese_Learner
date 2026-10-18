import { describe, it, expect } from 'vitest'
import { voiceOut, warmHall } from './synth'

// ── The hall, made ahead a slice at a time (plan 210) ──────────────
// Made in one go, the hall's impulse and its convolvers took ~100ms of
// a phone's main thread in the first idle gap after the tap that
// unlocks audio: the first departure of a session, in the middle of the
// ticket gate. It is made in slices now, as much as each idle period
// has room for, and a convolver (one piece, ~35ms on a phone) only in
// an idle period that long. Neither may change the sound: the impulse
// made in slices is the impulse made at once, sample for sample.

function fakeCtx() {
  const convolvers = []
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1 } })
  return {
    sampleRate: 8000,
    convolvers,
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length))
      return { numberOfChannels: channels, length, getChannelData: c => data[c] }
    },
    createConvolver() {
      const c = { ...node(), normalize: true, buffer: null }
      convolvers.push(c)
      return c
    },
    createGain: node,
  }
}

const bus = () => ({ connect() {}, disconnect() {} })
// An idle period with room for `slices` slices of the impulse and no
// more, in the gap between two frames (never a convolver's 40ms).
const gap = slices => ({ didTimeout: false, timeRemaining: () => (slices-- > 0 ? 10 : 2) })
const long = () => ({ didTimeout: false, timeRemaining: () => 49 })
const channels = buf => [0, 1].map(c => Array.from(buf.getChannelData(c)))

// The hall a voice makes on the spot, all at once.
function madeAtOnce() {
  const ctx = fakeCtx()
  voiceOut(ctx, bus(), { space: 0.2 })
  return channels(ctx.convolvers[0].buffer)
}

describe('the hall, made ahead', () => {
  it('makes in slices the same impulse a voice makes at once', () => {
    const ctx = fakeCtx()
    const dests = [bus()]
    let calls = 0
    while (!warmHall(ctx, dests, calls % 3 === 2 ? long() : gap(1))) calls += 1
    expect(calls).toBeGreaterThan(1)
    expect(channels(ctx.convolvers[0].buffer)).toEqual(madeAtOnce())
  })

  it('makes no convolver in the gap between two frames', () => {
    const ctx = fakeCtx()
    const dests = [bus(), bus()]
    for (let i = 0; i < 200; i++) warmHall(ctx, dests, gap(4))
    expect(ctx.convolvers).toHaveLength(0)
    // A long idle period makes one, and the next the other.
    expect(warmHall(ctx, dests, long())).toBe(false)
    expect(ctx.convolvers).toHaveLength(1)
    expect(warmHall(ctx, dests, long())).toBe(true)
    expect(ctx.convolvers).toHaveLength(2)
  })

  it('makes a piece regardless once it has waited long enough', () => {
    const ctx = fakeCtx()
    const dests = [bus(), bus()]
    expect(warmHall(ctx, dests, gap(0), true)).toBe(false)
    expect(ctx.convolvers).toHaveLength(1)
    expect(warmHall(ctx, dests, { didTimeout: true, timeRemaining: () => 0 })).toBe(true)
    expect(ctx.convolvers).toHaveLength(2)
  })

  it('lets a voice that needs the hall half-made finish it, unchanged', () => {
    const ctx = fakeCtx()
    warmHall(ctx, [bus()], gap(2))
    expect(ctx.convolvers).toHaveLength(0)
    voiceOut(ctx, bus(), { space: 0.2 })
    expect(channels(ctx.convolvers[0].buffer)).toEqual(madeAtOnce())
  })
})
