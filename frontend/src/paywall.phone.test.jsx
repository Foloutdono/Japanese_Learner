import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the offer on a phone ─────────────────────────────────
// 390×844. The offer is a screen of its own here: it takes the glass,
// its body scrolls and its foot stays, so the answer is never carried
// off a short screen by the list above it. Pro's offer -- the head,
// the perks, the two billings and "See all offers" -- reads whole
// without a scroll at this height; Max, once asked for, is what
// scrolls.

vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('./lib/track', () => ({ track: () => {}, EVENTS: {} }))

const credits = await import('./stores/credits')
const { PaywallScreen } = await import('./components/credits/PaywallScreen')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const rect = sel => $(sel).getBoundingClientRect()

// What a fixed box is laid out in: the window less the scrollbar gutter
// the root keeps stable (the claim sheet's test measures the same way).
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

beforeEach(() => credits.closePaywall())

describe('the offer on a phone', () => {
  it('takes the whole screen, with its answer docked in view', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()
    // Measured at rest: the screen rises 10px as it arrives.
    await Promise.all($('.pw').getAnimations().map(a => a.finished))

    const pw = rect('.pw')
    const glass = viewport()
    expect(pw.top).toBe(glass.top)
    expect(pw.left).toBe(glass.left)
    expect(pw.width).toBe(glass.width)
    expect(pw.height).toBe(glass.height)

    const cta = rect('.pw__cta')
    expect(cta.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(cta.height).toBeGreaterThanOrEqual(44)
    // Nothing runs off the side.
    const body = $('.pw__body')
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
  })

  it('reads Pro whole without a scroll, and scrolls only once Max is laid out', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()

    const body = $('.pw__body')
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
    // The picked row is a thumb's target.
    expect(rect('.pw-plan[aria-checked="true"]').height).toBeGreaterThanOrEqual(44)

    $('[data-action="paywall-all"]').click()
    await settle()
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    // The foot stays where it was while the list grows under it.
    expect(rect('.pw__cta').bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('stacks the billings as rows, the way the canvas drew them', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()

    const [yearly, monthly] = [...document.querySelectorAll('.pw-plan')].map(r => r.getBoundingClientRect())
    expect(monthly.top).toBeGreaterThanOrEqual(yearly.bottom)
    expect(monthly.left).toBe(yearly.left)
  })
})
