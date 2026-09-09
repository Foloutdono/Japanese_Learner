import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
// The real cascade, fonts and all: the only question this file asks is
// whether the boarding's content fits, and Space Grotesk and Noto Serif
// JP are not the metrics of whatever the runner would fall back to.
// main.jsx pulls the same eight faces.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-serif-jp/600.css'
import '@fontsource/noto-serif-jp/700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'
import '../index.css'

// ── 短い車内 — the boarding on a short phone, under a thumb ──────
// Reported from an Android install (2026-09-09): a pale rail down the
// right of the welcome, of "why" and of "level", the choices ending
// 10px short of the button under them. Three things had to be true at
// once for that, and this file holds two of them down:
//
//   1. the app styled `::-webkit-scrollbar` and `scrollbar-width` for
//      every pointer, which is how a page opts out of a phone's fading
//      overlay bar and gets a permanent, 10px-wide classic one instead
//      (index.css, "Themed scrollbar");
//   2. the level's six rows were 30px taller than a 667px screen;
//   3. the screens that DID fit still reported 4px of scrollable
//      overflow, left behind by entrance animations holding a finished
//      `transform` (index.css, "What a landed animation leaves
//      behind").
//
// This is the first lane that is actually a handset: `hasTouch` puts
// chromium on `pointer: coarse` / `hover: none`, where the other three
// all report a mouse (vite.config.js). It walks the real flow rather
// than standing the steps in a frame of its own — the frame belongs to
// BoardingFlow, and a copy of it here would go on passing after the
// real one changed.

const apiJson = vi.fn(async () => ({}))
const apiJsonWithTimeout = vi.fn(async () => ({}))
const apiFetch = vi.fn(async (path, _session, opts) => {
  if (path === '/api/credits') {
    return { ok: true, status: 200, json: async () => ({ balance: 30, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false }) }
  }
  if (path === '/api/profile' && opts?.method === 'PATCH') {
    return { ok: true, status: 200, json: async () => JSON.parse(opts.body) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: vi.fn(),
    },
  },
}))
// The nudge is native-only, and this is the web: seven stops, no eighth.
vi.mock('../lib/platform', () => ({
  isNative: () => false,
  canNudge: () => false,
  requestNudgePermission: async () => false,
}))
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playPlatformChime: vi.fn(),
  playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./BoardingFlow')
const { default: Welcome } = await import('../components/boarding/Welcome')

// The pull is 260ms and a car that arrived by it holds its stagger back
// to 380ms, the last row landing at 580 + 360. Everything on a boarding
// screen starts 6px low, and a transform counts toward scrollable
// overflow, so a screen measured mid-stagger measures taller than it
// will ever be drawn. A settle past the last frame is the only honest
// moment to read one.
const settle = (ms = 1200) => new Promise(r => setTimeout(r, ms))
const stepOf = screen => screen.container.querySelector('.brd')?.dataset.step
const live = screen => screen.container.querySelector('.brd__car:not(.brd__car--out)')
const q = (screen, sel) => live(screen)?.querySelector(sel) ?? screen.container.querySelector(sel)

async function click(screen, sel) {
  const el = q(screen, sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}

// What would be off the bottom, read off `.brd__body` — the one box in
// the frame that scrolls, and the box the rail was drawn on.
function overflowOf(screen) {
  const body = screen.container.querySelector('.brd__body')
  expect(body, '.brd__body').toBeTruthy()
  return body.scrollHeight - body.clientHeight
}

describe('the boarding on a 390x667 handset', () => {
  it('asks every question, and answers, without scrolling', async () => {
    const screen = await render(
      <LangProvider>
        <BoardingFlow
          session={{ access_token: 'tok' }}
          initialProfile={{ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 }}
          onComplete={vi.fn()}
          dryRun
        />
      </LangProvider>
    )
    const over = {}
    async function record() {
      await settle()
      over[stepOf(screen)] = overflowOf(screen)
    }

    await record()                                    // name
    await click(screen, '[data-action="continue"]')
    await record()                                    // why
    await click(screen, '[data-motive="trip"]')
    await click(screen, '[data-action="continue"]')
    await record()                                    // kana
    // Both scripts -> the level list rather than the reveal. The level
    // is the longest list in the boarding: the novice and all five
    // stops, six rows each carrying a code, a name and a line of
    // prose. It is the case that failed, and the goal behind it is the
    // same rows, one fewer.
    await click(screen, '[data-kana="both"]')
    await record()                                    // level
    await click(screen, '[data-level="novice"]')
    await click(screen, '[data-action="continue"]')
    await record()                                    // goal
    await click(screen, '[data-goal="N5"]')
    await click(screen, '[data-action="continue"]')
    await record()                                    // rhythm
    await click(screen, '[data-action="continue"]')
    await record()                                    // time
    await click(screen, '[data-action="continue"]')

    // The building screen is a wait with a visible end; any tap cuts to
    // the plan, and the arrival signboard over it goes the same way.
    expect(stepOf(screen)).toBe('building')
    await settle(200)
    q(screen, '.brd__body--center').click()
    await settle(200)
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await record()                                    // plan
    await click(screen, '[data-action="continue"]')
    await record()                                    // pass

    expect(Object.keys(over)).toEqual(
      ['name', 'why', 'kana', 'level', 'goal', 'rhythm', 'time', 'plan', 'pass'])
    expect(Object.entries(over).filter(([, px]) => px > 0)).toEqual([])
  }, 90000)

  it('opens on a welcome that fits', async () => {
    // Step zero, mounted by App rather than by the flow.
    const screen = await render(<LangProvider><Welcome onBoard={vi.fn()} onSignIn={vi.fn()} /></LangProvider>)
    await settle()
    expect(overflowOf(screen)).toBe(0)
  }, 30000)

  it('leaves the scrollbar to the browser', async () => {
    // The other half of the report. With no author rule in the way a
    // phone draws its own overlay bar: nothing at rest, nothing taken
    // out of the content's width. `auto` is that default — `thin` would
    // be the app asking for the classic one back.
    expect(matchMedia('(pointer: coarse)').matches, 'the lane is a handset').toBe(true)
    for (const el of [document.documentElement, document.body]) {
      expect(getComputedStyle(el).getPropertyValue('scrollbar-width')).toBe('auto')
    }
  })
})
