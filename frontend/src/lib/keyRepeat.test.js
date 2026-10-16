import { describe, it, expect } from 'vitest'
import { heldTooSoon, REPEAT_GAP_MS } from './keyRepeat'

// ── A held key, paced (plan 211) ────────────────────────────────
// A held arrow repeats thirty times a second; a walk steps on a fresh
// press always, and on a repeat once per REPEAT_GAP_MS.
describe('heldTooSoon', () => {
  it('steps on every fresh press, and on a repeat once per gap', () => {
    const last = { current: null }
    expect(heldTooSoon({ repeat: false }, last, 0)).toBe(false)
    expect(heldTooSoon({ repeat: false }, last, 10)).toBe(false)
    // Held: the repeats inside the gap are swallowed.
    expect(heldTooSoon({ repeat: true }, last, 40)).toBe(true)
    expect(heldTooSoon({ repeat: true }, last, 10 + REPEAT_GAP_MS - 1)).toBe(true)
    expect(heldTooSoon({ repeat: true }, last, 10 + REPEAT_GAP_MS)).toBe(false)
    expect(heldTooSoon({ repeat: true }, last, 20 + REPEAT_GAP_MS)).toBe(true)
  })
})
