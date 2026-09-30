import { describe, it, expect, vi, beforeEach } from 'vitest'

// The funnel is the whole reason the paywall ships before the store,
// so the pairing invariant is pinned here rather than left to the five
// call sites: every open produces exactly one `offer_view`, and
// exactly one of `offer_intent` / `offer_dismiss`. A double-counted
// intent would overstate the only number this feature exists to
// produce; a dismiss recorded after an intent would understate it.
const track = vi.fn()
vi.mock('../lib/track', () => ({ track: (...a) => track(...a), EVENTS: {} }))

const { openPaywall, takePaywall, closePaywall, peekPaywall, showAllOffers } = await import('./credits')

beforeEach(() => {
  track.mockClear()
  closePaywall()
  track.mockClear()
})

describe('the paywall funnel', () => {
  it('records one view, carrying the door it was opened from', () => {
    openPaywall('runout')
    expect(peekPaywall()).toEqual({ source: 'runout', taken: false, all: false })
    // The view starts the clock, so it carries no duration of its own.
    expect(track.mock.calls).toEqual([['offer_view', { where: 'runout' }]])
  })

  it("does not carry one open's deliberation into the next", async () => {
    openPaywall('balance')
    await new Promise(r => setTimeout(r, 40))
    closePaywall()
    const first = track.mock.calls.at(-1)[1].ms

    track.mockClear()
    openPaywall('ride')
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

  it('carries the pick on the intent, and whether every offer was seen', () => {
    openPaywall('balance')
    track.mockClear()
    takePaywall({ plan: 'pro', billing: 'yearly' })
    const [name, props] = track.mock.calls[0]
    expect(name).toBe('offer_intent')
    expect(props).toMatchObject({ where: 'balance', plan: 'pro', billing: 'yearly', all: false })
  })

  it('records "See all offers" on the answer, not as an event of its own', () => {
    openPaywall('settings')
    track.mockClear()
    showAllOffers()
    showAllOffers()
    // One view and one answer an open: the expansion rides on the answer.
    expect(track).not.toHaveBeenCalled()
    expect(peekPaywall().all).toBe(true)
    takePaywall({ plan: 'max', billing: 'monthly' })
    expect(track.mock.calls[0][1]).toMatchObject({ plan: 'max', billing: 'monthly', all: true })

    openPaywall('runout')
    showAllOffers()
    track.mockClear()
    closePaywall()
    expect(track.mock.calls[0][0]).toBe('offer_dismiss')
    expect(track.mock.calls[0][1].all).toBe(true)
  })

  it('opens each time on the lead offer, whatever the last open showed', () => {
    openPaywall('balance')
    showAllOffers()
    closePaywall()
    openPaywall('balance')
    expect(peekPaywall().all).toBe(false)
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
    openPaywall('ride')
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
    for (const source of ['onboarding', 'balance', 'settings', 'runout', 'ride']) {
      openPaywall(source)
      closePaywall()
    }
    expect(track.mock.calls.map(([name, props]) => `${name}:${props.where}`)).toEqual([
      'offer_view:onboarding', 'offer_dismiss:onboarding',
      'offer_view:balance', 'offer_dismiss:balance',
      'offer_view:settings', 'offer_dismiss:settings',
      'offer_view:runout', 'offer_dismiss:runout',
      'offer_view:ride', 'offer_dismiss:ride',
    ])
  })
})
