import { describe, it, expect, vi } from 'vitest'
import { createPlayhead } from './playhead'

// A playhead on a hand-held clock (ms) and a player reading set by hand.
function rig() {
  const clock = { ms: 0, reading: null }
  const head = createPlayhead({ read: () => clock.reading, now: () => clock.ms })
  // A frame's worth of wall time, then where the subtitle is drawn.
  const frame = (ms = 16) => {
    clock.ms += ms
    return head.at()
  }
  return { clock, head, frame }
}

describe('the playhead', () => {
  it('stands on the reading while paused', () => {
    const { head, frame } = rig()
    head.poll(12.5)
    expect(frame(500)).toBe(12.5)
  })

  it('carries the reading forward at the playing speed between readings', () => {
    const { clock, head, frame } = rig()
    head.poll(10)
    head.setPlaying(true)
    clock.reading = 10
    expect(frame(0)).toBe(10)
    expect(frame(100)).toBeCloseTo(10.1, 5)
    head.setRate(0.5)
    expect(frame(100)).toBeCloseTo(10.15, 3)
  })

  it('never goes back over a word when a reading comes in behind, and runs slow to meet it', () => {
    const { clock, head, frame } = rig()
    head.setPlaying(true)
    clock.reading = 10
    frame(0)
    for (let i = 0; i < 10; i += 1) frame(16)
    const before = frame(16)
    // The next reading says the video is 0.12s behind where it was drawn.
    clock.reading = before - 0.12
    const steps = []
    for (let i = 0; i < 40; i += 1) steps.push(frame(16))
    // Every frame moves forward, none by a full frame's worth at first...
    steps.reduce((prev, s) => { expect(s).toBeGreaterThanOrEqual(prev); return s }, before)
    expect(steps[0] - before).toBeLessThan(0.016)
    // ...and the drawn clock has met the video's within a few tenths.
    const video = clock.reading + (40 * 16) / 1000
    expect(Math.abs(steps.at(-1) - video)).toBeLessThan(0.01)
  })

  it('closes a reading ahead by running fast, not by jumping', () => {
    const { clock, head, frame } = rig()
    head.setPlaying(true)
    clock.reading = 10
    frame(0)
    const before = frame(16)
    clock.reading = before + 0.15
    const next = frame(16)
    expect(next - before).toBeGreaterThan(0.016)
    expect(next - before).toBeLessThan(0.05)
  })

  it('takes a seek at once', () => {
    const { clock, head, frame } = rig()
    head.setPlaying(true)
    clock.reading = 10
    frame(0)
    frame(16)
    clock.reading = 42
    expect(frame(16)).toBe(42)
    clock.reading = 5
    expect(frame(16)).toBe(5)
  })

  it('draws the poll when the player cannot be read directly', () => {
    const { head, frame } = rig()
    head.setPlaying(true)
    head.poll(20)
    expect(frame(0)).toBe(20)
    expect(frame(100)).toBeCloseTo(20.1, 5)
  })

  it('stops carrying a player that stops reporting', () => {
    const { clock, head, frame } = rig()
    head.setPlaying(true)
    clock.reading = 10
    frame(0)
    const far = frame(5000)
    expect(far).toBeLessThanOrEqual(11)
  })

  // A seek into video the player has not loaded is answered only once
  // it has the video there -- seconds later on a poor connection -- and
  // until then the IFrame reads where the video was, up to a second past
  // it while it played. The clock stands where the screen sent it.
  it('stands on a seek the screen asked for, until the player has gone there', () => {
    const { clock, head, frame } = rig()
    head.poll(10)
    clock.reading = 10
    head.seek(42)
    expect(frame(0)).toBe(42)
    expect(head.polled()).toBe(42)
    head.poll(10)
    clock.reading = 10.6
    expect(frame(250)).toBe(42)
    expect(head.polled()).toBe(42)
    clock.reading = 42
    expect(frame(250)).toBe(42)
    // There now: a reading back where it was is the learner's own seek.
    clock.reading = 10
    expect(frame(16)).toBe(10)
  })

  it('believes a reading that is neither where the video was nor where it was sent', () => {
    const { clock, head, frame } = rig()
    clock.reading = 10
    frame(0)
    head.seek(42)
    clock.reading = 100
    expect(frame(16)).toBe(100)
  })

  it('stands on the last of two seeks, whichever of the two the player reads first', () => {
    const { clock, head, frame } = rig()
    clock.reading = 10
    frame(0)
    head.seek(42)
    head.seek(80)
    clock.reading = 42
    expect(frame(16)).toBe(80)
    clock.reading = 10
    expect(frame(16)).toBe(80)
    clock.reading = 80
    expect(frame(16)).toBe(80)
  })

  it('leaves a short seek to the player, already there', () => {
    const { clock, head, frame } = rig()
    clock.reading = 10
    frame(0)
    head.seek(11)
    expect(frame(16)).toBe(10)
    clock.reading = 11
    expect(frame(16)).toBe(11)
  })

  it('carries a seek on from where it was sent once the player plays there', () => {
    const { clock, head, frame } = rig()
    head.setPlaying(true)
    clock.reading = 10
    frame(0)
    head.seek(42)
    // Still reading its last report, carried a second past where it was.
    clock.reading = 10.9
    expect(frame(16)).toBeGreaterThanOrEqual(42)
    expect(frame(16)).toBeLessThan(42.1)
    clock.reading = 42.05
    expect(frame(100)).toBeCloseTo(42.1, 1)
  })

  it('forgets a seek on a reset', () => {
    const { head, frame } = rig()
    head.poll(10)
    head.seek(42)
    head.reset()
    head.poll(10)
    expect(frame(16)).toBe(10)
  })

  it('tells its subscribers of each poll and of a reset', () => {
    const { head } = rig()
    const heard = vi.fn()
    const off = head.subscribe(heard)
    head.poll(3)
    expect(head.polled()).toBe(3)
    head.reset()
    expect(head.polled()).toBe(0)
    expect(heard).toHaveBeenCalledTimes(2)
    off()
    head.poll(4)
    expect(heard).toHaveBeenCalledTimes(2)
  })
})
