// The carousel studio's tunables (plan 248, frontend/carousel/tune.js).
import { describe, expect, it } from 'vitest'
import { TUNABLES, changed, parseTune, tuneFlag, tuned, tunablesFor } from '../carousel/tune.js'

describe('the studio’s tunables (plan 248)', () => {
  it('declares each value once, its default inside its range and on its step', () => {
    const keys = TUNABLES.map(t => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of TUNABLES) {
      expect(t.min, t.key).toBeLessThan(t.max)
      expect(t.def >= t.min && t.def <= t.max, t.key).toBe(true)
      expect(Math.abs((t.def - t.min) / t.step - Math.round((t.def - t.min) / t.step)), t.key).toBeLessThan(1e-6)
      expect(t.label && t.group && t.sources.length, t.key).toBeTruthy()
    }
  })

  it('falls back to the default and holds a value to its range and step', () => {
    for (const t of TUNABLES) {
      expect(tuned(undefined, t.key)).toBe(t.def)
      expect(tuned({ [t.key]: 'oops' }, t.key)).toBe(t.def)
      expect(tuned({ [t.key]: t.max * 10 + 10 }, t.key)).toBe(t.max)
      expect(tuned({ [t.key]: t.min - 100 }, t.key)).toBe(t.min)
    }
    expect(() => tuned({}, 'no.such.key')).toThrow()
  })

  it('writes only what differs into the command, and reads it back', () => {
    for (const source of new Set(TUNABLES.flatMap(t => t.sources))) {
      const ts = tunablesFor(source)
      expect(tuneFlag({}, source)).toBe('')
      const tune = Object.fromEntries(ts.map(t => [t.key, t.def === t.max ? t.min : t.max]))
      const flag = tuneFlag(tune, source)
      expect(flag.startsWith(' --tune ')).toBe(true)
      expect(parseTune(flag.slice(' --tune '.length))).toEqual(changed(tune))
    }
    expect(parseTune('nope=3,,=,x')).toEqual({})
  })
})
