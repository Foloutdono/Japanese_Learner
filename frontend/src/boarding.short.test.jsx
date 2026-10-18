import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — first contact on a laptop's short window (plan 169) ───────
// Plan 163 drew each question's answers between the question and the
// floor, and at 1280×600 -- a 720p panel less the browser's chrome --
// most of them were cut at their foot behind the body's scrim: the
// kana's answers lost their line, the level's line its lowest names,
// the lines' cards their figures. On a 1366×768 laptop the reason
// straight out to the right named itself under its ring, on the ring
// below, and noon's name stood on the departure board. Every question
// holds whole in its body now, down to this window -- and since plan
// 247, the card that took the place of the questions it no longer asks,
// and each of the sheets its doors open.

const apiJson = vi.hoisted(() => vi.fn())
const apiJsonWithTimeout = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/platform', async o => ({
  ...(await o()),
  isNative: () => false,
  canNudge: () => false,
  requestNudgePermission: async () => false,
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playPlatformChime: vi.fn(), playClick: vi.fn(), playUi: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

// Past the pull and the answers' entrance, however long a busy machine
// takes to run them: a body measured mid-pull holds both cars. Only the
// cars' own animations are waited for, and never past a second --
// the gate button's idle nudge starts again on its own.
const settle = async (ms = 700) => {
  await new Promise(r => setTimeout(r, ms))
  const moving = document.getAnimations()
    .filter(a => a.effect?.target?.closest?.('.brd__cars') && a.effect.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {}))
  await Promise.race([Promise.all(moving), new Promise(r => setTimeout(r, 1000))])
}
const $ = s => document.querySelector(s)
const live = () => $('.brd__car:not(.brd__car--out)')
const inCar = s => live()?.querySelector(s)
const stepOf = () => $('.brd')?.dataset.step
const box = el => el.getBoundingClientRect()

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async path => (path === '/api/onboarding/volumes' ? VOLUMES : {}))
  apiJsonWithTimeout.mockReset()
  apiJsonWithTimeout.mockImplementation(async () => ({ jlptLevel: 'N5', dailyNewTarget: 10, onboardedAt: 'x' }))
  sessionStorage.clear()
})

async function board() {
  await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} onComplete={vi.fn()} onExit={vi.fn()} guest />
    </LangProvider>
  )
  await settle(300)
}
async function pick(sel) { inCar(sel).click(); await settle(80) }
async function next() { inCar('[data-action="continue"]').click(); await settle() }
/** The question's answers stand whole in its body: nothing under the scrim. */
function holdsWhole(step) {
  expect(stepOf()).toBe(step)
  const body = inCar('.brd__body')
  expect(body.scrollHeight, step).toBeLessThanOrEqual(body.clientHeight + 2)
  // And the floor is on the window.
  expect(box(inCar('.brd__foot')).bottom, step).toBeLessThanOrEqual(window.innerHeight)
}

// Each question pulls in and draws its answers; the long walks need
// longer than Vitest's default to ride.
/** A sheet over the card stands whole on the window, nothing to scroll. */
async function sheetHoldsWhole(open, kind) {
  inCar(open).click()
  await settle(400)
  const sheet = $(`.brd-sheet--${kind}`)
  expect(sheet, kind).toBeTruthy()
  expect(sheet.scrollHeight, kind).toBeLessThanOrEqual(sheet.clientHeight + 2)
  expect(box(sheet).top, kind).toBeGreaterThanOrEqual(0)
  expect(box(sheet).bottom, kind).toBeLessThanOrEqual(window.innerHeight)
  await userEvent.keyboard('{Escape}')
  await settle(200)
  expect($('.brd-sheet'), `${kind} shut`).toBeNull()
}

// Each question pulls in and draws its answers; the long walks need
// longer than Vitest's default to ride.
describe('first contact on a short window', { timeout: 40000 }, () => {
  it('holds every question whole, from the kana to the card and its sheets', async () => {
    await board()
    holdsWhole('kana')
    await pick('[data-kana="both"]')
    await settle()
    holdsWhole('level')
    await pick('[data-level="N3"]')
    await next()
    holdsWhole('card')
    await sheetHoldsWhole('[data-door="destination"]', 'goal')
    await sheetHoldsWhole('[data-door="service"]', 'rhythm')
    await sheetHoldsWhole('[data-door="hour"]', 'hour')
    await sheetHoldsWhole('[data-door="lines"]', 'lines')
    await sheetHoldsWhole('[data-door="name"]', 'name')
    await sheetHoldsWhole('[data-action="keep"]', 'account')
  })

  it('reads the two words out whole for a learner who reads one script', async () => {
    await board()
    await pick('[data-kana="hiragana"]')
    await settle()
    holdsWhole('reveal')
  })
})
