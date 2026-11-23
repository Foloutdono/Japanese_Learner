import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import '../index.css'

// ── 翻訳 — the weighed review on the desk (plan 330, pick C) ───────
// On the desk the asking stands in the lines panel (RunLines), not on a
// page of its own: a review's Détail puts its question there, and the
// answer is the first 問 / 答 of that panel's thread, in parts. No phone
// page rises, and the card keeps the review it asked from.

const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {},
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TranslationRun } = await import('./TranslationRun')

const PHRASES = [
  { phrase: 'きのうは水だけ飲みました。', romaji: 'kinou wa mizu dake nomimashita', translation: 'Hier, je n’ai bu que de l’eau.', translation_lang: 'fr' },
]
const KANA = 'きのうみずだけをのんでした'
const WEIGHED = {
  verdict: 'partial',
  summary: 'Compris, mais la forme du verbe est fausse.',
  good: [],
  fix: [
    { given: 'のんでした', fix: 'のみました', issue: '«でした» ne suit pas un verbe.', severity: 'error' },
    { given: 'だけを', fix: 'だけ', issue: '«を» est facultatif après 「だけ」.', severity: 'natural' },
  ],
  grammar_used: true,
  better: 'きのうみずだけのみました。',
  better_parts: [{ text: 'きのうみずだけのみました' }],
}
const DETAIL = {
  what: 'Tu as mis «でした» après 飲んで.',
  rule: [{ label: 'Verbe', text: '飲む → 飲みます → 飲みました' }],
  examples: [{ jp: 'コーヒーを飲みました。', tr: 'J’ai bu du café.' }],
  memo: 'Verbe → ます, ました.',
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
    if (u === '/api/translation/analyze') return ok({ review: WEIGHED, analysis: 'x', answer_kana: KANA })
    if (u === '/api/phrase/analyze') return ok({ text: PHRASES[0].phrase, available: false, grammar: [], tokens: [] })
    if (u === '/api/ask') return ok({ answer: DETAIL.what, detail: DETAIL, off_topic: false, left: 39 })
    return ok({})
  })
})

async function answeredOnTheDesk() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/translation/level/N5']}>
        <Routes>
          <Route element={<StageFrame />}>
            <Route path="/practice/translation/level/:level" element={<TranslationRun session={null} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(400)
  const root = screen.container
  // The answer's field, not the asking's: on the desk the lines panel,
  // and its field, come first in the document.
  const input = root.querySelector('input.field--page')
  setValue.call(input, 'kinou mizudakewonondeshita')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await settle(20)
  input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(400)
  return root
}

describe('the weighed review on the desk', () => {
  it('answers a Détail in the lines panel\'s thread, in parts, and raises no page', async () => {
    const root = await answeredOnTheDesk()
    expect(root.querySelectorAll('.pcard-well .pcard-pin')).toHaveLength(2)
    root.querySelector('.rvw-big .rvw-btn').click()
    await settle(300)
    const thread = document.querySelector('.desk-ask__thread')
    expect(thread.querySelector('.desk-ask__q').textContent).toContain('のんでした')
    expect(thread.querySelector('.desk-ask__a .ask-detail__what').textContent).toBe(DETAIL.what)
    expect(thread.querySelector('.ask-detail__examples b').textContent).toBe('コーヒーを飲みました。')
    expect(document.querySelector('.ask-layer')).toBeNull()
    // The review it asked from is still on the card, its button spent.
    expect(root.querySelector('.rvw-big .rvw-btn').disabled).toBe(true)
    expect(root.querySelectorAll('.rvw-soft .rvw-btn:not(:disabled)')).toHaveLength(1)
  })
})
