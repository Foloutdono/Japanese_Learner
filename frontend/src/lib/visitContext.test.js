// ── 訪問の文脈 — classes, never values (plan 215) ──────────────────
import { describe, it, expect } from 'vitest'
import { osFamily, viewportClass } from './visitContext'
import { VALUES } from './track'

describe('the system family', () => {
  it('reduces a user agent to one of the enum', () => {
    const cases = {
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)': 'ios',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8)': 'android',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)': 'windows',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)': 'chromeos',
      'Mozilla/5.0 (X11; Linux x86_64)': 'linux',
      '': 'other',
    }
    for (const [ua, family] of Object.entries(cases)) {
      expect(osFamily(ua), ua).toBe(family)
      expect(VALUES.session_start.os).toContain(family)
    }
  })
})

describe('the viewport class', () => {
  it('is phone, tablet, desk or wide', () => {
    expect(viewportClass(390, false)).toBe('phone')
    expect(viewportClass(820, false)).toBe('tablet')
    expect(viewportClass(1280, true)).toBe('desk')
    expect(viewportClass(1920, true)).toBe('wide')
  })
})
