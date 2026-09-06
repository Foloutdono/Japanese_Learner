import { describe, it, expect, vi, afterEach } from 'vitest'

// The native shell's one build-time knob (lib/origin.js, ADR 0008). Its
// own file rather than a case in api.test.js: that suite's 401-recovery
// tests rely on module state carrying between tests, and this one has
// to reset the module graph to read a stubbed env.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the API origin', () => {
  it('is same-origin when the knob is unset', async () => {
    vi.stubEnv('VITE_API_ORIGIN', '')
    vi.resetModules()
    const { api, API_ORIGIN } = await import('./origin')
    expect(API_ORIGIN).toBe('')
    expect(api('/api/today')).toBe('/api/today')
    expect(api('/kanjivg/04e00.svg')).toBe('/kanjivg/04e00.svg')
  })

  it('prefixes every backend path with the origin in the native build', async () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://japanese-learner-seven.vercel.app')
    vi.resetModules()
    const { api } = await import('./origin')
    expect(api('/api/today')).toBe('https://japanese-learner-seven.vercel.app/api/today')
    expect(api('/kanjivg/04e00.svg')).toBe('https://japanese-learner-seven.vercel.app/kanjivg/04e00.svg')
    expect(api('/exam-audio/abc.mp3')).toBe('https://japanese-learner-seven.vercel.app/exam-audio/abc.mp3')
  })
})
