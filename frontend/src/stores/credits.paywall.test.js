import { describe, it, expect, vi, beforeEach } from 'vitest'

// The funnel is the whole reason the paywall ships before the store,
// so the pairing invariant is pinned here rather than left to the five
// call sites: every open produces exactly one `paywall_view`, and
// exactly one of `paywall_intent` / `paywall_dismiss`. A double-counted
// intent would overstate the only number this feature exists to
// produce; a dismiss recorded after an intent would understate it.
const logEvent = vi.fn()
vi.mock('../lib/analytics', () => ({ logEvent: (...a) => logEvent(...a) }))

const { openPaywall, takePaywall, closePaywall, peekPaywall } = await import('./credits')

beforeEach(() => {
  logEvent.mockClear()
  closePaywall()
  logEvent.mockClear()
})

describe('the paywall funnel', () => {
  it('records one view, carrying the door it was opened from', () => {
    openPaywall('runout')
    expect(peekPaywall()).toEqual({ source: 'runout', taken: false })
    // The view starts the clock, so it carries no duration of its own.
    expect(logEvent.mock.calls).toEqual([['paywall_view', { source: 'runout' }]])
  })

  it("does not carry one open's deliberation into the next", async () => {
    openPaywall('balance')
    await new Promise(r => setTimeout(r, 40))
    closePaywall()
    const first = logEvent.mock.calls.at(-1)[1].ms

    logEvent.mockClear()
    openPaywall('profile')
    closePaywall()
    const second = logEvent.mock.calls.at(-1)[1].ms

    expect(first).toBeGreaterThanOrEqual(25)
    expect(second).toBeLessThan(first)
  })

  it('records an intent once, however many times it is tapped', () => {
    openPaywall('balance')
    logEvent.mockClear()
    takePaywall()
    takePaywall()
    takePaywall()
    expect(logEvent.mock.calls).toHaveLength(1)
    const [name, props] = logEvent.mock.calls[0]
    expect(name).toBe('paywall_intent')
    expect(props.source).toBe('balance')
    // The deliberation time rides along; it is engaged ms, so it is a
    // non-negative integer and tiny in a test that decides instantly.
    expect(Number.isInteger(props.ms)).toBe(true)
    expect(props.ms).toBeGreaterThanOrEqual(0)
    expect(peekPaywall().taken).toBe(true)
  })

  it('records a dismissal when it is closed without an intent', () => {
    openPaywall('settings')
    logEvent.mockClear()
    closePaywall()
    expect(logEvent.mock.calls).toHaveLength(1)
    expect(logEvent.mock.calls[0][0]).toBe('paywall_dismiss')
    expect(logEvent.mock.calls[0][1].source).toBe('settings')
    expect(logEvent.mock.calls[0][1].ms).toBeGreaterThanOrEqual(0)
    expect(peekPaywall()).toBe(null)
  })

  it('does not count a close after an intent as a dismissal', () => {
    openPaywall('profile')
    takePaywall()
    logEvent.mockClear()
    closePaywall()
    expect(logEvent).not.toHaveBeenCalled()
    expect(peekPaywall()).toBe(null)
  })

  it('records nothing when a close finds nothing open', () => {
    closePaywall()
    expect(logEvent).not.toHaveBeenCalled()
  })

  it('keeps each door separate across successive opens', () => {
    for (const source of ['onboarding', 'balance', 'profile', 'settings', 'runout']) {
      openPaywall(source)
      closePaywall()
    }
    expect(logEvent.mock.calls.map(([name, props]) => `${name}:${props.source}`)).toEqual([
      'paywall_view:onboarding', 'paywall_dismiss:onboarding',
      'paywall_view:balance', 'paywall_dismiss:balance',
      'paywall_view:profile', 'paywall_dismiss:profile',
      'paywall_view:settings', 'paywall_dismiss:settings',
      'paywall_view:runout', 'paywall_dismiss:runout',
    ])
  })
})
