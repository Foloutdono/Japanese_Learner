// ── 故障 — every step a flow can note is one the trail keeps ──
// An uncaught error carries the step of the boarding or the first ride
// on screen (hooks/useErrorStep.js), and a step outside
// VALUES.client_error.step is dropped by clean(), silently.
import { describe, it, expect } from 'vitest'
import { VALUES } from '../lib/track'
import { BOARDING_STEPS, CARD_STEPS, READING_STEPS, stepFor, introStep } from './flowSteps'
import { INTRO_STEPS } from './nyumon'

const listed = new Set(VALUES.client_error.step)

describe('the flows’ steps', () => {
  it('are every one a step client_error keeps', () => {
    const steps = [...BOARDING_STEPS, ...INTRO_STEPS.map(introStep), ...CARD_STEPS, ...READING_STEPS]
    expect(steps.filter(s => !listed.has(s))).toEqual([])
  })

  it("include every card step the ride's stepFor can name", () => {
    const named = new Set()
    for (const index of [0, 1, 2]) {
      for (const answered of [false, true]) {
        for (const lookFirst of [false, true]) named.add(stepFor(index, answered, lookFirst))
      }
    }
    expect([...named].filter(s => !CARD_STEPS.includes(s))).toEqual([])
  })
})
