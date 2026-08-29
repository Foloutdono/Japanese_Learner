import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Same stylesheet-import trick as PromptCard.browser.test.jsx (plan 048):
// the rule this test pins only exists once the real sheet is loaded.
import '../index.css'

// Plan 051 — the screen's primary action, `.btn-primary`, had no rule
// anywhere in the stylesheet: the app's filled-action class was
// `.btn-primary-purple`, renamed to `.btn-deck-primary` in e9690b7, and
// TodayScreen reached for a name that had already gone. Nothing caught
// it, because nothing checks that a referenced class exists — so the
// "Start N cards" button (and its two siblings on the cleared-queue
// screens) fell through to the bare `button` rule and painted as the
// browser's own default control, in the platform's own face, on a
// screen that otherwise speaks entirely in --font-display.
//
// Written to fail against today's behaviour first, per plan convention
// (see PromptCard.browser.test.jsx / CardPrompt.browser.test.jsx, which
// do the same).

const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// LangContext fetches /api/translations/{kanji,vocab} on mount -- same
// offline stub as KanaScreen.pace.browser.test.jsx / RatingBar.browser.test.jsx.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('./TodayScreen')

const settle = (ms = 50) => new Promise(r => setTimeout(r, ms))

// Plan 052 — Chromium serialises a resolved `color-mix(in srgb, ...)`
// as `color(srgb 0.673569 0.241255 0.160784)`, at float precision, not
// as the `rgb(172, 62, 41)` an 8-bit hex would give. Both forms have to
// be read, and the float one must not be rounded before it is measured.
function rgbOf(str) {
  const nums = str.match(/[\d.]+/g).slice(0, 3).map(Number)
  return str.startsWith('color(') ? nums.map(n => n * 255) : nums
}

// WCAG 2.x relative luminance and contrast ratio.
function contrast(a, b) {
  const lum = c => {
    const [r, g, bl] = c.map(v => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('TodayScreen — the primary button (plan 051)', () => {
  it('renders .btn-primary as a real filled button, not the bare-button default', async () => {
    // The emptiest shape that reaches a `.btn-primary`: no lanes due at
    // all renders the "back to station" button on the cleared screen
    // (TodayScreen.jsx:426) without needing any lane/card fixtures.
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return { lanes: [], total: 0, next_due: null }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <TodayScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)

    const btn = screen.container.querySelector('.btn-primary')
    expect(btn, `no .btn-primary in DOM — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()

    const style = getComputedStyle(btn)
    // Not the bare `button` rule's fallthrough (no background set at
    // all -> transparent) and not a leftover default.
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(style.backgroundColor).not.toBe('transparent')
    // The app's own display face. Plan 056 made --font-display the
    // document default, so this no longer distinguishes the button's
    // own rule from what it inherits — it now only catches the face
    // being lost outright (a failed font load, or the default being
    // 'fixed' back to a platform stack).
    expect(style.fontFamily).toContain('Space Grotesk')
  })

  // Plan 052 — 051 fixed the missing rule but inked it with
  // --text-on-fill (#1c1811, a near-black documented for *light* fills)
  // where every primary swatch in Controls.dc.html uses --text-on-panel
  // (#f3ecdf). On the vermillion that measured 3.48:1 dark / 3.18:1
  // light, against a 4.5:1 floor for 15.2px/600 text. Nothing in the
  // suite checks colour, and no guard checks contrast, which is exactly
  // how the defect shipped. This pins the ink and the fill so it cannot
  // silently regress again.
  it('inks .btn-primary with the paper ink on a deepened pigment fill (plan 052)', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return { lanes: [], total: 0, next_due: null }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <TodayScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)

    const btn = screen.container.querySelector('.btn-primary')
    expect(btn).toBeTruthy()
    const style = getComputedStyle(btn)

    // --text-on-panel #f3ecdf, the mockup's ink at every primary swatch
    // -- NOT --text-on-fill #1c1811, which 051 used.
    expect(rgbOf(style.color)).toEqual([243, 236, 223])

    // The fill is the section pigment deepened 12% toward --bg-panel:
    // color-mix(in srgb, #c1442c 88%, #100e13) = #ac3e29. Asserting the
    // mix (rather than "not transparent") is what makes a silent return
    // to the raw pigment -- 4.33:1, below the floor -- fail here.
    const fill = rgbOf(style.backgroundColor)
    expect(fill[0]).toBeCloseTo(171.76, 0)
    expect(fill[1]).toBeCloseTo(61.52, 0)
    expect(fill[2]).toBeCloseTo(41.0, 0)

    // And the thing all of the above is *for*. Nothing else in the app
    // checks contrast -- no guard does either -- so the floor the whole
    // plan turns on is asserted here directly rather than implied by a
    // hex. 5.17:1 as written; 4.33:1 if the deepening is dropped,
    // 3.48:1 if the ink goes back to --text-on-fill.
    expect(contrast(fill, rgbOf(style.color))).toBeGreaterThanOrEqual(4.5)
  })
})

// Plan 051, step 7 — TodayScreen.jsx:156 used to catch a failed
// GET /api/today with `setSummary(null)`, the exact same null the
// screen starts in: a network blip and "still loading" were the same
// state, forever, with no error and no retry. `summaryError` now tells
// the two apart on the picker side, reusing SessionError/EmptyState
// (the queue side's own error surface) rather than a new component.
describe('TodayScreen — a rejected /api/today (plan 051)', () => {
  it('renders the error branch with a retry, not a permanent spinner', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') throw new Error('offline')
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <TodayScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)

    // The error surface, not the spinner it used to be stuck on.
    expect(screen.container.querySelector('.quiz-loading')).toBeNull()
    const empty = screen.container.querySelector('.empty-state')
    expect(empty, `no error branch in DOM — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()

    const retryBtn = empty.querySelector('.empty-state__action')
    expect(retryBtn).toBeTruthy()

    // A retry that succeeds moves the picker past the error branch --
    // proving `onRetry` actually re-fetches rather than just existing.
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return { lanes: [], total: 0, next_due: null }
      return {}
    })
    retryBtn.click()
    await settle(200)

    expect(screen.container.querySelector('.empty-state')).toBeNull()
    expect(screen.container.querySelector('.quiz-loading')).toBeNull()
    expect(screen.container.querySelector('.btn-primary')).toBeTruthy()
  })
})
