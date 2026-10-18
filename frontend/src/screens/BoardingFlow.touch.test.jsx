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
// 10px short of the button under them (the boarding asked more then:
// since plan 247 the questions it no longer asks are the card's
// sheets, held here too). Three things had to be true at
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
    return { ok: true, status: 200, json: async () => ({ balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false }) }
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
// The nudge is native-only, and this is the web: the hour's sheet adds
// to a calendar instead.
vi.mock('../lib/platform', () => ({
  isNative: () => false,
  canNudge: () => false,
  requestNudgePermission: async () => false,
  nudgePermission: async () => 'denied',
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
  // The next screen comes a frame after the tap (a transition, go()).
  await vi.waitFor(() => expect(q(screen, sel), sel).toBeTruthy(), { timeout: 2000 })
  const el = q(screen, sel)
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

// The card's step is the one that may scroll here (plan 247): its fields
// in words stand under it, and a 667 px handset has not the room for
// both. It scrolls by less than that list, so the card and its question
// never leave the top, and scrolled to its end the last row and the line
// of where the card lives stand clear of the docked gate.
async function cardInReach(screen) {
  const car = live(screen)
  const body = car.querySelector('.brd__body')
  const rows = car.querySelector('.brd-rows')
  expect(overflowOf(screen)).toBeLessThan(rows.getBoundingClientRect().height)
  body.scrollTop = body.scrollHeight
  await settle(100)
  const foot = car.querySelector('.brd__foot').getBoundingClientRect().top + 0.5
  expect(rows.getBoundingClientRect().bottom).toBeLessThanOrEqual(foot)
  expect(car.querySelector('.brd-keep-line').getBoundingClientRect().bottom).toBeLessThanOrEqual(foot)
  body.scrollTop = 0
  await settle(100)
}

describe('the boarding on a 390x667 handset', () => {
  it('asks every question, and answers, without scrolling but the card\'s list', async () => {
    const screen = await render(
      <LangProvider>
        <BoardingFlow session={{ access_token: 'tok' }} onComplete={vi.fn()} guest dryRun />
      </LangProvider>
    )
    const over = {}
    async function record() {
      await settle()
      over[stepOf(screen)] = overflowOf(screen)
    }
    // A sheet is its own scroll (index.css, `.sheet`): one that ran past
    // the handset would be read a row at a time over the card.
    async function recordSheet(open, kind) {
      await click(screen, open)
      await settle(500)
      const sheet = document.querySelector(`.brd-sheet--${kind}`)
      expect(sheet, kind).toBeTruthy()
      over[`sheet:${kind}`] = sheet.scrollHeight - sheet.clientHeight
      document.querySelector('.scrim').click()
      await settle(200)
      expect(document.querySelector('.brd-sheet'), `${kind} shut`).toBeNull()
    }

    await record()                                    // kana
    // Both scripts -> the level list rather than the reveal. The level
    // is the longest list in the boarding: the novice and all five
    // stops, six rows each carrying a code, a name and a line of
    // prose. It is the case that failed, and the goal's sheet is the
    // same rows, one fewer.
    await click(screen, '[data-kana="both"]')
    await record()                                    // level
    await click(screen, '[data-level="novice"]')
    await click(screen, '[data-action="continue"]')
    await record()                                    // card
    await cardInReach(screen)
    delete over.card
    await recordSheet('[data-door="destination"]', 'goal')
    await recordSheet('[data-door="service"]', 'rhythm')
    await recordSheet('[data-door="hour"]', 'hour')
    await recordSheet('[data-door="lines"]', 'lines')
    await recordSheet('[data-door="name"]', 'name')
    await recordSheet('[data-action="keep"]', 'account')

    expect(Object.keys(over)).toEqual(
      ['kana', 'level', 'sheet:goal', 'sheet:rhythm', 'sheet:hour', 'sheet:lines', 'sheet:name', 'sheet:account'])
    expect(Object.entries(over).filter(([, px]) => px > 0)).toEqual([])
  }, 90000)

  // The test in the boarding (plan 224): its longest kind of question,
  // a sentence with its gap, four words under it, the levels over it
  // and its two ways out over the gate -- on the small handset too.
  it('asks the test\'s longest question without scrolling', async () => {
    apiJsonWithTimeout.mockImplementation(async () => ({
      seed: 1, done: false, level: 'N3', perLevel: { N5: { correct: 3, total: 3, cleared: true }, N4: { correct: 4, total: 5, cleared: true } },
      question: {
        id: 'q', sectionId: 'N3', kind: 'context', type: 'mcq-text',
        promptJp: 'この地域では、毎年夏になると大勢の観光客が（　　）ので、道路がとても混雑する。',
        choices: ['押し寄せる', '打ち明ける', '立ち去る', '見落とす'].map((textJp, i) => ({ id: `c${i + 1}`, textJp })),
      },
    }))
    const screen = await render(
      <LangProvider>
        <BoardingFlow session={{ access_token: 'tok' }} onComplete={vi.fn()} dryRun />
      </LangProvider>
    )
    await settle()
    await click(screen, '[data-kana="both"]')
    await click(screen, '[data-action="level-test"]')
    await settle()
    expect(stepOf(screen)).toBe('test')
    expect(screen.container.querySelectorAll('.brd__car:not(.brd__car--out) .mcq-row')).toHaveLength(4)
    expect(overflowOf(screen)).toBe(0)
  }, 30000)

  // The other road out of the kana (plan 168): one script read, the two
  // words read out as lines, and the first stop under them.
  it('reads the reveal without scrolling', async () => {
    const screen = await render(
      <LangProvider>
        <BoardingFlow session={{ access_token: 'tok' }} onComplete={vi.fn()} dryRun />
      </LangProvider>
    )
    await settle()
    await click(screen, '[data-kana="hiragana"]')
    await settle()
    expect(stepOf(screen)).toBe('reveal')
    expect(overflowOf(screen)).toBe(0)
  }, 30000)

  // A session with an address boards a NEW pass for it (docs/oauth.md):
  // the card's line says the address and holds the way to another
  // account. The reader's card, in both tables, with an address as long
  // as a real one runs.
  it.each(['fr', 'en'])('names a pass its address, and the switch, in reach (%s)', async lang => {
    localStorage.setItem('lang', lang)
    try {
      const screen = await render(
        <LangProvider>
          <BoardingFlow
            session={{ access_token: 'tok', user: { email: 'marie-claire.dupont-moreau@gmail.com' } }}
            onComplete={vi.fn()}
            onSignIn={vi.fn()}
            dryRun
          />
        </LangProvider>
      )
      await settle()
      await click(screen, '[data-kana="both"]')
      await settle()
      await click(screen, '[data-level="N4"]')
      await click(screen, '[data-action="continue"]')
      await settle()
      expect(stepOf(screen)).toBe('card')
      expect(q(screen, '[data-action="switch-account"]')).toBeTruthy()
      await cardInReach(screen)
    } finally {
      localStorage.removeItem('lang')
    }
  }, 30000)

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
