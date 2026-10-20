import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GRACE_MS, releaseNotice } from './releaseNotice'

// 工事 (plan 264): what the request path's answers say about a release.
function answer(status, at) {
  return { status, headers: { get: name => (name === 'X-Release-At' && at != null ? String(at) : null) } }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T03:10:00Z'))
  releaseNotice.reset()
})
afterEach(() => {
  releaseNotice.reset()
  vi.useRealTimers()
})

const read = () => releaseNotice.current()

const in10 = Math.floor(new Date('2026-10-20T03:20:00Z').getTime() / 1000)

describe('the release notice', () => {
  it('is raised by an answer carrying the header, and falls due at its minute', () => {
    releaseNotice.seen(answer(200, in10))
    expect(read()).toEqual({ at: in10 * 1000, due: false })
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(read()).toEqual({ at: in10 * 1000, due: true })
  })

  it('stands through the restart: a 5xx or no header on a failure keeps it', () => {
    releaseNotice.seen(answer(200, in10))
    releaseNotice.seen(answer(502, null))
    expect(read()).not.toBeNull()
  })

  it('comes down on the new build\'s first answer, which carries none', () => {
    releaseNotice.seen(answer(200, in10))
    releaseNotice.seen(answer(200, null))
    expect(read()).toBeNull()
  })

  it('stops being shown a while after its minute, if nobody took it down', () => {
    releaseNotice.seen(answer(200, in10))
    vi.advanceTimersByTime(10 * 60 * 1000 + GRACE_MS + 1)
    expect(read()).toBeNull()
  })

  it('stays closed once read, until another release is announced', () => {
    releaseNotice.seen(answer(200, in10))
    releaseNotice.dismiss()
    releaseNotice.seen(answer(200, in10))
    expect(read()).toBeNull()
    releaseNotice.seen(answer(200, in10 + 300))
    expect(read()).toEqual({ at: (in10 + 300) * 1000, due: false })
  })
})
