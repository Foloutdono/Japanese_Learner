import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import { LONG_SCENE } from './ConversationRun.fixtures'
import '../index.css'

// ── 会話 — the talk on a laptop's short window, 1280×600 (plan 221) ──
// The phone's complaint, on the desk's three panels: the middle column
// is the window's height, and the card grew in it (the panels' flex:
// 1 0 auto) until the replies stood under the window's floor. Bounded
// like the phone's (index.css, .stage--talk), the talk scrolls in its
// card and the replies, the verdict and Next stay in the window.
// (ConversationRun.phone.test.jsx is the phone's half.)

const apiFetch = vi.fn()
const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {},
  speakLine: vi.fn(() => Promise.resolve(false)), speakSentence: vi.fn(),
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))

const { default: ConversationRun } = await import('./ConversationRun')

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
async function landed() {
  await settle()
  await Promise.all(document.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime) && a.effect.getComputedTiming().endTime <= 2000)
    .map(a => a.finished.catch(() => {})))
  await settle(700)
}
const tile = jp => [...document.querySelectorAll('.kaiwa-reply')].find(t => t.textContent.includes(jp))
const primary = () => document.querySelector('.stage__foot .btn-primary')
const talkBox = () => document.querySelector('.kaiwa-card > .prompt-card__body')
function inWindow(el) {
  const box = el.getBoundingClientRect()
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5)
}
function inTalk(el) {
  const room = talkBox().getBoundingClientRect()
  const box = el.getBoundingClientRect()
  expect(box.top).toBeGreaterThanOrEqual(room.top - 0.5)
  expect(box.top).toBeLessThan(room.bottom)
  if (box.height <= room.height) expect(box.bottom).toBeLessThanOrEqual(room.bottom + 0.5)
}

beforeEach(() => {
  apiFetch.mockReset()
  apiJson.mockReset()
  apiJson.mockImplementation(async url => (
    String(url).startsWith('/api/conversation/scenario/') ? JSON.parse(JSON.stringify(LONG_SCENE)) : {}
  ))
  apiFetch.mockImplementation(async () => ok({ correct: true, quality: 4, xp_earned: 7, leveled_up: false, new_level: 2 }))
})

describe('a whole scene on a short window (plan 221)', () => {
  it('keeps the replies, then the reply sent and Next, in the window at the scene\'s last turn', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={[`/practice/conversation/${LONG_SCENE.id}/choose`]}>
          <Routes>
            <Route element={<StageFrame />}>
              <Route path="/practice/conversation/:scenario/:mode" element={<ConversationRun session={null} />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    primary().click()
    await landed()
    // The three panels stand: the talk is the middle column's.
    expect(document.querySelector('.desk-run--panels > .stage--talk')).not.toBeNull()
    for (const turn of LONG_SCENE.turns.slice(0, -1)) {
      tile(turn.me.jp).click()
      await settle()
      primary().click()
      await landed()
    }
    expect(talkBox().scrollHeight).toBeGreaterThan(talkBox().clientHeight)
    const tiles = document.querySelectorAll('.kaiwa-reply')
    expect(tiles).toHaveLength(3)
    tiles.forEach(inWindow)
    inTalk(document.querySelector('.kaiwa-talk > .tour-line:last-child'))

    tile(LONG_SCENE.turns.at(-1).choices.find(c => !c.right).jp).click()
    await landed()
    inTalk(document.querySelector('.kaiwa-talk > .kaiwa-line--taken'))
    inTalk(document.querySelector('.kaiwa-talk > .kaiwa-line--right'))
    inWindow(primary())
    screen.unmount()
  })
})
