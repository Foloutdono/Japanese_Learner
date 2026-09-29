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
// holds whole in its body now, down to this window.

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
const inCarAll = s => [...(live()?.querySelectorAll(s) ?? [])]
const stepOf = () => $('.brd')?.dataset.step
const box = el => el.getBoundingClientRect()
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1

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
      <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={vi.fn()} onExit={vi.fn()} />
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
describe('first contact on a short window', { timeout: 40000 }, () => {
  it('holds every question whole, from the name to the hour', async () => {
    await board()
    holdsWhole('name')
    await userEvent.keyboard('{Enter}')
    await settle()
    holdsWhole('why')
    await pick('[data-motive="trip"]')
    await next()
    holdsWhole('kana')
    await pick('[data-kana="both"]')
    await settle()
    holdsWhole('level')
    await pick('[data-level="N3"]')
    await next()
    holdsWhole('goal')
    await next()
    holdsWhole('lines')
    await next()
    holdsWhole('rhythm')
    await next()
    holdsWhole('time')
  })

  it('names every reason beside its ring, none on another\'s', async () => {
    await board()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('why')
    const ways = inCarAll('.desk-brd__way')
    expect(ways).toHaveLength(6)
    const rings = ways.map(w => box(w.querySelector('.desk-brd__ring')))
    const names = ways.map(w => box(w.querySelector('.desk-brd__way-name')))
    for (let i = 0; i < ways.length; i++) {
      for (let j = 0; j < ways.length; j++) {
        if (i === j) continue
        expect(meets(names[i], rings[j]), `${ways[i].dataset.motive} on ${ways[j].dataset.motive}'s ring`).toBe(false)
        expect(meets(names[i], names[j]), `${ways[i].dataset.motive} on ${ways[j].dataset.motive}'s name`).toBe(false)
      }
    }
    // The reason straight out to the right is named beside its ring.
    const trip = inCar('[data-motive="trip"]')
    expect(box(trip.querySelector('.desk-brd__way-name')).left).toBeGreaterThan(box(trip.querySelector('.desk-brd__ring')).right)
  })

  it('stands noon\'s name clear of the departure board', async () => {
    await board()
    await userEvent.keyboard('{Enter}')
    await settle()
    await pick('[data-motive="trip"]')
    await next()
    await pick('[data-kana="both"]')
    await settle()
    await pick('[data-level="N3"]')
    for (let i = 0; i < 4; i++) await next()
    expect(stepOf()).toBe('time')
    const board_ = box(inCar('.desk-brd__sky-board'))
    for (const stn of inCarAll('.desk-brd__hour-stn')) {
      expect(meets(box(stn), board_), stn.dataset.hour).toBe(false)
    }
  })

  it('reads the two words out whole for a learner who reads one script', async () => {
    await board()
    await userEvent.keyboard('{Enter}')
    await settle()
    await pick('[data-motive="trip"]')
    await next()
    await pick('[data-kana="hiragana"]')
    await settle()
    holdsWhole('reveal')
  })
})
