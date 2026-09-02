import { describe, it, expect } from 'vitest'
import {
  CHARTER_PATTERN,
  DEFAULT_PER_DAY,
  MAX_PACE,
  PACES,
  SERVICES,
  paceFor,
  serviceLabel,
} from './paces'

describe('the service ladder (plan 063)', () => {
  it('runs the five scheduled services in order', () => {
    expect(SERVICES.map(s => s.perDay)).toEqual([5, 10, 15, 20, 25])
    expect(SERVICES.map(s => s.jp)).toEqual(['各駅停車', '快速', '新快速', '特急', '臨時'])
  })

  it('draws a six-stop pattern that always calls at both ends', () => {
    for (const s of SERVICES) {
      expect(s.pattern).toHaveLength(6)
      expect(s.pattern[0]).toBe(1)
      expect(s.pattern[5]).toBe(1)
    }
    expect(CHARTER_PATTERN).toHaveLength(6)
  })

  it('caps honesty at the fastest scheduled service', () => {
    expect(MAX_PACE).toBe(25)
  })

  it('still recommends the 快速', () => {
    expect(SERVICES.find(s => s.recommended).perDay).toBe(10)
  })
})

describe('serviceLabel', () => {
  it('names a scheduled pace by its service', () => {
    expect(serviceLabel(10).jp).toBe('快速')
    expect(serviceLabel(20).jp).toBe('特急')
  })

  it('calls any off-ladder pace a 貸切, never a rounded lie', () => {
    const charter = serviceLabel(12)
    expect(charter.jp).toBe('貸切')
    expect(charter.perDay).toBe(12)
    expect(charter.pattern).toBe(CHARTER_PATTERN)
  })
})

describe('the legacy pace ladder', () => {
  it('keeps its three rows and helpers for Settings’ 種別 chips', () => {
    expect(PACES).toHaveLength(3)
    expect(DEFAULT_PER_DAY).toBe(10)
    expect(paceFor(10).jp).toBe('快速')
    expect(paceFor(12)).toBeNull()
  })
})
