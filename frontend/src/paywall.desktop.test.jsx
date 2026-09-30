import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 定期券 — the offer on the desk ────────────────────────────────
// 1100×800. One of the dialogs the desk keeps (docs/design/desk/
// README.md, "Dialogs on the desk"): in the window's middle at the
// desk dialogs' width, over a scrim, the width spent rather than
// stretched -- a plan's two billings side by side and the answer on
// one row with its quiet way -- so Pro's offer reads whole without a
// scroll in a laptop's window.

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
const px = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))

beforeEach(() => credits.closePaywall())

describe('the offer on the desk', () => {
  it('stands in the window\'s middle at the dialogs\' width, over a scrim', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()

    const pw = rect('.pw')
    expect(pw.width).toBe(px('--card-w'))
    const room = viewport()
    expect(Math.abs((pw.left - room.left) - (room.right - pw.right))).toBeLessThanOrEqual(1)
    expect(pw.top).toBeGreaterThan(0)
    expect(pw.bottom).toBeLessThan(window.innerHeight)
    expect(getComputedStyle($('.pw-scrim')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('reads Pro whole without a scroll, its billings side by side', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()

    const body = $('.pw__body')
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
    const [yearly, monthly] = [...document.querySelectorAll('.pw-plan')].map(r => r.getBoundingClientRect())
    // Within the 1px lift of the focused row.
    expect(Math.abs(monthly.top - yearly.top)).toBeLessThanOrEqual(1)
    expect(monthly.left).toBeGreaterThan(yearly.right)
  })

  it('sets the answer on one row with its quiet way, the answer last', async () => {
    await render(<LangProvider><PaywallScreen /></LangProvider>)
    credits.openPaywall('balance')
    await settle()

    const later = rect('.pw__later')
    const cta = rect('.pw__cta')
    expect(Math.abs((later.top + later.bottom) / 2 - (cta.top + cta.bottom) / 2)).toBeLessThanOrEqual(1)
    expect(cta.left).toBeGreaterThan(later.right)
  })
})
