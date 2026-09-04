import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { TrainDoor } from '../components/station/TrainDoor'

// ── A rated card must always be followed by another one ─────────
// Reported from production: a kana card sat revealed with no rating
// bar and no way forward. The screen holds the next card behind a set
// of gates (the XP toast, the stage stamp) and advances only once the
// set is empty — but that set lives in a ref on the SCREEN, which
// survives leaving a mode for the picker and coming back, and nothing
// ever clears it. Leave while a stamp is mid-flight and its gate is
// still in the set for the next session, where no stamp is playing to
// take it out again: every review from then on hangs, the bar hides
// itself the instant you rate, and the only way out is a reload.

const apiJson = vi.fn()
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanaScreen } = await import('./KanaScreen')

const card = (id, kana, romaji, preview) => ({
  card_id: id, kana, romaji,
  mode: 'kana.flashcard.f2b', direction: 'f2b', stage: 'learning',
  hints: {}, review_preview: preview,
})

// Rating 4 promotes this one — that is what opens the stamp gate.
const PROMOTES = { 4: { xp_earned: 3, stage_up: 'mastered' } }
const QUIET = { 4: { xp_earned: 3 } }

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

function clickText(screen, text) {
  const btn = [...screen.container.querySelectorAll('button')].find(b => b.textContent.includes(text))
  expect(btn, `${text} — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()
  btn.click()
}

/** Past the TrainDoor, which any pointerdown skips. */
async function through() {
  await settle(700)
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await settle(300)
}

async function enterSet(screen) {
  clickText(screen, 'Hiragana (de base)')
  await through()
}

async function enterMode(screen) {
  clickText(screen, 'Kana → romaji')
  await through()
}

/** Reveal the flashcard and rate it "Correct". */
async function answer(screen, which) {
  screen.container.querySelector('.flashcard').click()
  await settle(80)
  const bar = screen.container.querySelector('.rating-bar:not(.rating-bar--idle)')
  expect(bar, `the rating bar must be open on a revealed card (${which} review)`).toBeTruthy()
  clickText(screen, 'Correct')
  await settle(400)
}

beforeEach(() => {
  apiJson.mockReset()
  apiFetch.mockClear()
  localStorage.clear()
})

describe('KanaScreen — a rated card is always followed by another', () => {
  it('advances again after a mode is left with a stamp still in flight', async () => {
    let batch = 0
    apiJson.mockImplementation(async url => {
      if (String(url).startsWith('/api/kana/cards')) {
        batch += 1
        return batch === 1
          ? { cards: [card('kana_no', 'の', 'no', PROMOTES), card('kana_ha', 'は', 'ha', QUIET)] }
          : { cards: [card(`kana_${batch}a`, 'ま', 'ma', QUIET)] }
      }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <KanaScreen session={{ access_token: 'tok' }} />
          <TrainDoor />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    await enterSet(screen)
    await enterMode(screen)
    expect(screen.container.textContent).toContain('の')

    // Rate the promoting card, then walk out while its stamp is still
    // playing — the back arrow is live throughout.
    await answer(screen, 'first')
    const back = screen.container.querySelector('.btn-back')
    expect(back, 'the back arrow is live throughout the stamp').toBeTruthy()
    back.click()
    await settle(200)

    // Back into the same mode (the back arrow lands on the mode
    // picker), and answer a card that promotes nothing — so no stamp
    // plays that could take the stale gate out again.
    await enterMode(screen)
    await settle(200)
    const before = screen.container.querySelector('.flashcard')?.textContent
    await answer(screen, 'second')

    const after = screen.container.querySelector('.flashcard')?.textContent
    expect(after, 'the card never changed — the queue is stuck behind a gate from the last session')
      .not.toBe(before)
  }, 40000)
})
