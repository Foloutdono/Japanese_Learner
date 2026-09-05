import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── The gates, on their own ─────────────────────────────────────
// This is the one implementation now, so it is worth testing as one.
// Two of the guarantees below existed on two screens out of six before
// the extraction — the safety net and the level-up exemption from it —
// and the third existed nowhere.

const applyXpGain = vi.fn()
vi.mock('../stores/profileSummary', () => ({ applyXpGain: (...a) => applyXpGain(...a) }))

const { useReviewGates } = await import('./useReviewGates')

const settle = ms => new Promise(r => setTimeout(r, ms))

// A probe rather than a screen: the point is the machinery, and a
// screen would drag its own fetches and renderers in with it.
let api
function Probe({ advance, sessionKey }) {
  api = useReviewGates({ advance, sessionKey })
  return <div data-locked={String(api.locked)} data-stamp={api.stamp ? api.stamp.to : ''} />
}

const XP = { xp_earned: 3 }

beforeEach(() => {
  applyXpGain.mockReset()
  applyXpGain.mockReturnValue({ leveledUp: false, newLevel: 2 })
})

describe('useReviewGates', () => {
  it('advances at once when the review opens no gate', async () => {
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    expect(api.review(XP, { cardKey: 'c1', quality: 4 })).toBe(true)
    expect(advance, 'a fare tick plays over the next card, it does not hold it').toHaveBeenCalledTimes(1)
  })

  it('holds the queue on a gate the screen opened, until it is released', async () => {
    const advance = vi.fn()
    const screen = await render(<Probe advance={advance} sessionKey="a" />)
    api.review(XP, { cardKey: 'c1', quality: 2, hold: ['training'] })
    await settle(30)
    expect(advance).not.toHaveBeenCalled()
    expect(screen.container.querySelector('[data-locked="true"]')).toBeTruthy()

    api.release('training')
    await settle(30)
    expect(advance).toHaveBeenCalledTimes(1)
    expect(screen.container.querySelector('[data-locked="false"]')).toBeTruthy()
  })

  it('holds for a stamp and lets go when the stamp reports done', async () => {
    const advance = vi.fn()
    const screen = await render(<Probe advance={advance} sessionKey="a" />)
    api.review({ ...XP, stage_up: 'mastered' }, { cardKey: 'c1', quality: 5 })
    await settle(30)
    expect(advance).not.toHaveBeenCalled()
    expect(screen.container.querySelector('[data-stamp="mastered"]')).toBeTruthy()

    api.stampDone()
    await settle(30)
    expect(advance).toHaveBeenCalledTimes(1)
  })

  it('forces a gate that never closes, rather than freezing the card', async () => {
    // The safety net. It existed on two screens out of six; on the
    // other four a gate that never closed left an answered card with no
    // rating bar and nothing to tap, forever.
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    api.review({ ...XP, stage_up: 'mastered' }, { cardKey: 'c1', quality: 5 })
    await settle(1000)
    expect(advance, 'not before its time').not.toHaveBeenCalled()
    await settle(3600)
    expect(advance, 'a stuck gate must cost a skipped animation, not the session').toHaveBeenCalledTimes(1)
  }, 20000)

  it('never forces a rank re-issue closed, because that one waits to be claimed', async () => {
    // The exemption: XpToast's rank board waits indefinitely for the
    // player to tap it, so an open gate there is the design and not a
    // fault. Forcing it would snatch the moment away mid-claim. Level
    // 6 is the first rank crossing (見習い → 浪人, see domain/levelTitle).
    applyXpGain.mockReturnValue({ leveledUp: true, newLevel: 6 })
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    api.review(XP, { cardKey: 'c1', quality: 5 })
    await settle(4600)
    expect(advance).not.toHaveBeenCalled()

    api.toastDone()
    await settle(30)
    expect(advance).toHaveBeenCalledTimes(1)
  }, 20000)

  it('lets a plain level-up play over the next card', async () => {
    // Level 4 → 5 stays inside 見習い: the board turns over on the
    // in-car display while the next card is already in hand. Holding
    // the queue for it was 2.9s of dead time per level.
    applyXpGain.mockReturnValue({ leveledUp: true, newLevel: 5 })
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    api.review(XP, { cardKey: 'c1', quality: 5 })
    await settle(30)
    expect(advance).toHaveBeenCalledTimes(1)
  })

  it('refuses a second review while one is in flight', async () => {
    // Synchronously, inside one tick: `locked` is a render away, so a
    // double tap would otherwise post the same card twice.
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    expect(api.review(XP, { cardKey: 'c1', quality: 2, hold: ['training'] })).toBe(true)
    expect(api.review(XP, { cardKey: 'c1', quality: 2, hold: ['training'] })).toBe(false)
    expect(applyXpGain, 'the second tap must not bank the XP again').toHaveBeenCalledTimes(1)
  })

  it('lets go of everything when the session changes', async () => {
    // The production bug: leave a mode while a stamp is playing and its
    // gate came back with you, with no stamp left to close it — so the
    // next session never advanced and never unlocked.
    const advance = vi.fn()
    const screen = await render(<Probe advance={advance} sessionKey="a" />)
    api.review({ ...XP, stage_up: 'mastered' }, { cardKey: 'c1', quality: 5 })
    await settle(30)
    expect(screen.container.querySelector('[data-locked="true"]')).toBeTruthy()

    await screen.rerender(<Probe advance={advance} sessionKey="b" />)
    await settle(30)
    expect(screen.container.querySelector('[data-locked="false"]'), 'the lock must lift').toBeTruthy()
    expect(screen.container.querySelector('[data-stamp=""]'), 'the stamp must be dropped').toBeTruthy()

    // And the new session's first review goes through cleanly.
    expect(api.review(XP, { cardKey: 'c2', quality: 4 })).toBe(true)
    expect(advance).toHaveBeenCalledTimes(1)
  })

  it('still advances when the XP payload is junk', async () => {
    // A throw here would leave no toast to close the gate it opened.
    applyXpGain.mockImplementation(() => { throw new Error('bad xp') })
    const advance = vi.fn()
    await render(<Probe advance={advance} sessionKey="a" />)
    api.review({ xp_earned: undefined }, { cardKey: 'c1', quality: 4 })
    await settle(30)
    expect(advance).toHaveBeenCalledTimes(1)
  })
})
