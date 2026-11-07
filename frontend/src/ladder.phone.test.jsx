import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import ladder from './testing/grammarLadder.json'
import './index.css'

// ── 梯子 on a phone, in the day's queue (plans 187e, 194) ────────
// A grammar card on the ladder comes in the exercise its step asks: the
// point's line over the plate, the plate inside a 390px screen, Choisir's
// platforms and Construire's ticket a thumb's targets, the write's field
// and Check beside each other, and the run's own bar rates the card under
// the ladder's key once it is answered.

const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 1, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
  speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
const postReview = vi.fn(async () => ({}))
vi.mock('./lib/reviews', () => ({ postReview: (...a) => postReview(...a), staleCards: vi.fn(async () => []), reviewsSettled: vi.fn(async () => {}) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')

const LANE = { id: 's~grammar~N5~grammar.ladder', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.ladder' }
const card = over => ({ ...over, source: 'grammar', lane: LANE, stage: 'learning', lesson: null })
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

async function mount(cards) {
  let batch = 0
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/today/cards')) {
      batch += 1
      return { cards: batch === 1 ? cards : [] }
    }
    if (url === '/api/composition/check') return { found: true, japanese: null }
    if (String(url).startsWith('/api/grammar/build/check')) return ladder.checks.right
    return {}
  })
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today/run']}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">gate</div>} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

function inside(el) {
  const box = el.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(window.innerWidth)
}

beforeEach(() => {
  document.documentElement.dataset.chrome = 'stage'
  apiJson.mockReset()
  postReview.mockClear()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => {
  localStorage.removeItem('lang')
  delete document.documentElement.dataset.chrome
})

describe('the ladder in the day’s queue, on a phone', () => {
  it('builds inside the screen, then rates under the ladder’s key', async () => {
    const screen = await mount([card(ladder.build)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.gl-ring').getAttribute('aria-label')).toBe('This point: Build, step 2 of 4')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.gl-ring, .gl-card, form.gl-entry')) inside(el)
    // The roundel stands in the stage word's place, and says the progress
    // the foot's band would.
    expect(root.querySelector('.stage-mark, .card-band')).toBeNull()
    // The entry under the card, the practice runs': a direct child of the
    // stage, docked over the thumb.
    const entry = root.querySelector('main.stage > form.stage__foot.gl-entry')
    expect(entry).toBeTruthy()
    expect(root.querySelector('.prompt-card').contains(entry)).toBe(false)
    for (const el of entry.querySelectorAll('.field, .btn-primary')) {
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    expect(entry.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1)
    // No rating before the answer: the entry stands where the bar comes up.
    expect(root.querySelector('.rating-bar')).toBeNull()

    await screen.getByLabelText('Your answer').fill(ladder.checks.typed.right)
    await settle(120)
    // What is typed shows in the card's hole.
    expect(root.querySelector('.gl-gap--typed').textContent).toBe(ladder.checks.typed.right)
    entry.querySelector('.btn-primary').click()
    await settle()
    expect(root.querySelector('.gl-back__head--ok')).toBeTruthy()
    expect(root.querySelector('form.gl-entry')).toBeNull()
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('false')
    root.querySelector('.rating-bar button').click()
    await settle()
    const sent = postReview.mock.calls.find(c => c[0] === '/api/today/review')
    expect(sent[2].mode).toBe('grammar.ladder')
    expect(sent[2].card_id).toBe(ladder.build.card_id)
  }, 20000)

  // すみません、わたしはさかな＿＿＿。 at 390px: the kana before the hole
  // came as one part, which the hole is held to, so the whole clause and
  // the hole stood on one line wider than the card, cut off at both
  // edges. The server now sends the word before the hole apart
  // (furigana.hold_word); a payload that holds more is wrapped inside the
  // card, never drawn past it.
  const KANA = { key: 'sc:1', tr: 'Sorry, I don’t like fish.' }
  const tail = [{ gap: 0, size: 6 }, { furigana: [{ text: '。' }] }]
  const kanaShapes = {
    'the word apart': [{ furigana: [{ text: 'すみません、わたしは' }, { text: 'さかな' }] }, ...tail],
    'one run, as it came before': [{ furigana: [{ text: 'すみません、わたしはさかな' }] }, ...tail],
  }
  for (const [shape, pieces] of Object.entries(kanaShapes)) {
    it(`keeps a sentence in kana inside the card, its hole held to its word (${shape})`, async () => {
      const screen = await mount([card({ ...ladder.build, build: { ...KANA, pieces } })])
      await settle()
      const root = screen.container
      const box = root.querySelector('.prompt-card').getBoundingClientRect()
      const sent = root.querySelector('.gl-sent')
      expect(sent.textContent).toBe('すみません、わたしはさかな。')
      expect(sent.scrollWidth).toBeLessThanOrEqual(sent.clientWidth)
      const range = document.createRange()
      range.selectNodeContents(sent)
      const glyphs = [...range.getClientRects(), root.querySelector('.gl-gap').getBoundingClientRect()]
      for (const r of glyphs) {
        expect(r.left).toBeGreaterThanOrEqual(box.left)
        expect(r.right).toBeLessThanOrEqual(box.right)
      }
      // The hole is held to what came before it in its part; cut apart,
      // that is the word alone, and the hole never opens a line.
      const hold = root.querySelector('.gl-hold')
      expect(hold.textContent).toBe(shape === 'the word apart' ? 'さかな' : 'すみません、わたしはさかな')
      if (shape === 'the word apart') {
        const word = document.createRange()
        word.selectNodeContents(hold.querySelector('span'))
        const [line] = word.getClientRects()
        const gap = root.querySelector('.gl-gap').getBoundingClientRect()
        // On one line: their feet closer than a glyph is tall.
        expect(Math.abs(gap.bottom - line.bottom)).toBeLessThan(parseFloat(getComputedStyle(sent).fontSize))
      }
    }, 20000)
  }

  it('chooses inside the screen, the exam’s tiles a thumb’s targets', async () => {
    const screen = await mount([card(ladder.choose)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.gl-ring').getAttribute('aria-label')).toBe('This point: Choose, step 2 of 3')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    const tiles = [...root.querySelectorAll('.gl-dock .gl-tile')]
    expect(tiles.length).toBeGreaterThanOrEqual(2)
    for (const el of [...tiles, root.querySelector('.gl-card'), root.querySelector('.gl-ring')]) inside(el)
    for (const el of tiles) expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // The dock does not sit over the card.
    const dock = root.querySelector('.gl-dock').getBoundingClientRect()
    expect(root.querySelector('.gl-card').getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.top + 1)
  }, 20000)

  it('chooses on a question of its own inside the screen, the forms as tiles with their ruby (plan 201)', async () => {
    const screen = await mount([card(ladder.authored)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.gl-ring').getAttribute('aria-label')).toBe('This point: Choose, step 1 of 3')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // The sentence, its hole and its translation, not the flashcard the
    // point used to fall back to.
    expect(root.querySelector('.gl-sent .gl-gap')).toBeTruthy()
    expect(root.querySelector('.gl-tr').textContent).toBe(ladder.authored.contrast.tr)
    expect(root.querySelector('.flashcard .grammar-rule')).toBeNull()
    const tiles = [...root.querySelectorAll('.gl-dock .gl-tile')]
    expect(tiles).toHaveLength(ladder.authored.contrast.choices.length)
    for (const el of [...tiles, root.querySelector('.gl-card'), root.querySelector('.gl-ring')]) inside(el)
    for (const el of tiles) expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // A form with kanji carries its ruby, as the sentence does.
    expect(tiles.every(el => el.querySelector('ruby rt'))).toBe(true)
    const dock = root.querySelector('.gl-dock').getBoundingClientRect()
    expect(root.querySelector('.gl-card').getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.top + 1)

    // Taking the right form turns the card to it and brings the bar up.
    const right = tiles.find(el => el.querySelector('.gl-tile__t').textContent.replace(/\s+/g, '') === '使つかえません')
    right.click()
    await settle()
    expect(root.querySelector('.gl-back__head--ok')).toBeTruthy()
    expect(root.querySelector('.gl-echo .gl-gap--filled ruby rt').textContent).toBe('つか')
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('false')
  }, 20000)

  it('writes inside the screen', async () => {
    const screen = await mount([card(ladder.write)])
    await settle()
    const root = screen.container
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.wrt-form .field, .wrt-form button, .wrt-word')) inside(el)
    expect(root.querySelector('.wrt-form button').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }, 20000)
})
