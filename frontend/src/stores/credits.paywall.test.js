import { describe, it, expect, vi, beforeEach } from 'vitest'

// The funnel is the whole reason the paywall ships before the store,
// so the pairing invariant is pinned here rather than left to the five
// call sites: every open produces exactly one `offer_view`, and
// exactly one of `offer_intent` / `offer_dismiss`. A double-counted
// intent would overstate the only number this feature exists to
// produce; a dismiss recorded after an intent would understate it.
const track = vi.fn()
vi.mock('../lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const { openPaywall, takePaywall, closePaywall, peekPaywall } = await import('./credits')

beforeEach(() => {
  track.mockClear()
  closePaywall()
  track.mockClear()
})

describe('the paywall funnel', () => {
  it('records one view, carrying the door it was opened from', () => {
    openPaywall('runout')
    expect(peekPaywall()).toEqual({ source: 'runout', taken: false })
    // The view starts the clock, so it carries no duration of its own.
    expect(track.mock.calls).toEqual([['offer_view', { where: 'runout' }]])
  })

  it("does not carry one open's deliberation into the next", async () => {
    openPaywall('balance')
    await new Promise(r => setTimeout(r, 40))
    closePaywall()
    const first = track.mock.calls.at(-1)[1].ms

    track.mockClear()
    openPaywall('profile')
    closePaywall()
    const second = track.mock.calls.at(-1)[1].ms

    expect(first).toBeGreaterThanOrEqual(25)
    expect(second).toBeLessThan(first)
  })

  it('records an intent once, however many times it is tapped', () => {
    openPaywall('balance')
    track.mockClear()
    takePaywall()
    takePaywall()
    takePaywall()
    expect(track.mock.calls).toHaveLength(1)
    const [name, props] = track.mock.calls[0]
    expect(name).toBe('offer_intent')
    expect(props.where).toBe('balance')
    // The deliberation time rides along; it is engaged ms, so it is a
    // non-negative integer and tiny in a test that decides instantly.
    expect(Number.isInteger(props.ms)).toBe(true)
    expect(props.ms).toBeGreaterThanOrEqual(0)
    expect(peekPaywall().taken).toBe(true)
  })

  it('records a dismissal when it is closed without an intent', () => {
    openPaywall('settings')
    track.mockClear()
    closePaywall()
    expect(track.mock.calls).toHaveLength(1)
    expect(track.mock.calls[0][0]).toBe('offer_dismiss')
    expect(track.mock.calls[0][1].where).toBe('settings')
    expect(track.mock.calls[0][1].ms).toBeGreaterThanOrEqual(0)
    expect(peekPaywall()).toBe(null)
  })

  it('does not count a close after an intent as a dismissal', () => {
    openPaywall('profile')
    takePaywall()
    track.mockClear()
    closePaywall()
    expect(track).not.toHaveBeenCalled()
    expect(peekPaywall()).toBe(null)
  })

  it('records nothing when a close finds nothing open', () => {
    closePaywall()
    expect(track).not.toHaveBeenCalled()
  })

  it('keeps each door separate across successive opens', () => {
    for (const source of ['onboarding', 'balance', 'profile', 'settings', 'runout']) {
      openPaywall(source)
      closePaywall()
    }
    expect(track.mock.calls.map(([name, props]) => `${name}:${props.where}`)).toEqual([
      'offer_view:onboarding', 'offer_dismiss:onboarding',
      'offer_view:balance', 'offer_dismiss:balance',
      'offer_view:profile', 'offer_dismiss:profile',
      'offer_view:settings', 'offer_dismiss:settings',
      'offer_view:runout', 'offer_dismiss:runout',
    ])
  })
})
