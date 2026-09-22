import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import '../index.css'

// ── 翻訳 — the page at 390×844 ─────────────────────────────────
// Three rulings the phone is the only place to measure, all reported
// on 2026-09-22 off one session:
//
//   1. nothing the LEARNER wrote may leave the card — the answer
//      register printed a spaceless romaji run off the right of the
//      screen (.prose's `overflow-wrap: anywhere`);
//   2. the corrected sentence is readable — furigana over the kanji,
//      the romaji under the line, the fix picked out in it;
//   3. the sentence to translate sits in the MIDDLE of its card, the
//      way every other grown card on the stage holds its content.

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
  { phrase: '父は毎日、新聞を読みます。', romaji: 'chichi wa mainichi, shinbun o yomimasu', translation: 'My father reads the newspaper every day.', translation_lang: 'en' },
]

// The answer that started this: romaji, no spaces, nothing to break on.
const RUN_ON = 'mainichihawatashinoojisanganewspaperwoyomu'

// The review as routes/translation.py now serves it: the corrected
// sentence as furigana parts with what changed marked, and its romaji.
const REVIEW = {
  verdict: 'partial',
  summary: "The word for 'father' is wrong.",
  good: ['「を」 marks the object correctly'],
  fix: [{ issue: '「おじさん」 means uncle', fix: '「父」' }],
  grammar_used: null,
  better: '父は毎日、新聞を読みます。',
  better_parts: [
    { text: '父', reading: 'ちち', highlight: true },
    { text: 'は' },
    { text: '毎', reading: 'まい' },
    { text: '日', reading: 'にち' },
    { text: '、' },
    { text: '新', reading: 'しん' },
    { text: '聞', reading: 'ぶん' },
    { text: 'を' },
    { text: '読', reading: 'よ', highlight: true },
    { text: 'みます。' },
  ],
  better_romaji: 'chichi wa mainichi, shinbun o yomimasu.',
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/translation/batch')) return ok({ phrases: PHRASES })
    if (u === '/api/translation/analyze') return ok({ review: REVIEW, analysis: 'x' })
    if (u === '/api/phrase/analyze') return ok({ text: PHRASES[0].phrase, available: false, grammar: [], tokens: [] })
    return ok({})
  })
})

async function run() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/translation/level/N5']}>
        <Routes>
          {/* The real frame: it stamps data-chrome="stage" on <html>,
              which is what the docked foot below the card measures
              itself against. */}
          <Route element={<StageFrame />}>
            <Route path="/practice/translation/level/:level" element={<TranslationRun session={null} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(400)
  return screen.container
}

async function answered(root, text) {
  type(root.querySelector('input'), text)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(300)
  return root
}

/** Nothing anywhere is wider than the window. */
function pageIsNotWider() {
  const doc = document.documentElement
  expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth)
}

describe('the translation page at 390×844', () => {
  it('keeps a run-on answer inside the card', async () => {
    const root = await answered(await run(), RUN_ON)
    const card = root.querySelector('.prompt-card--footed')
    const answer = [...root.querySelectorAll('.prose__jp')][0]
    expect(answer.textContent).toBe(RUN_ON)

    // It wrapped rather than running out of the card, and the card
    // itself never grew past the screen.
    expect(answer.getBoundingClientRect().right)
      .toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5)
    expect(answer.scrollWidth).toBeLessThanOrEqual(answer.clientWidth + 1)
    expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
    pageIsNotWider()
  })

  it('draws the corrected sentence with its readings, its romaji and the fix picked out', async () => {
    const root = await answered(await run(), 'おじさんは毎日、新聞をよます。')
    const corrected = root.querySelector('.rvw__corrected')
    expect(corrected).toBeTruthy()
    // The whole sentence, spelled by the parts.
    expect(corrected.querySelector('.rvw__better').textContent).toContain('父')
    // Readings over the kanji...
    expect([...corrected.querySelectorAll('rt')].map(rt => rt.textContent))
      .toEqual(['ちち', 'まい', 'にち', 'しん', 'ぶん', 'よ'])
    // ... the romaji under the line ...
    expect(corrected.querySelector('.prose__romaji').textContent).toBe(REVIEW.better_romaji)
    // ... and only what the tutor changed is marked.
    expect([...corrected.querySelectorAll('.rvw__fixed')].map(m => m.textContent))
      .toEqual(['父ちち', '読よ'])
    // A mark is ink, never a fill (DESIGN.md, Colour).
    const bg = getComputedStyle(corrected.querySelector('.rvw__fixed')).backgroundColor
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(bg)
    pageIsNotWider()
  })

  it('sits the sentence to translate in the middle of its card', async () => {
    const root = await run()
    const card = root.querySelector('.prompt-card--footed')
    const prompt = root.querySelector('.prose__en--lead')
    const box = card.getBoundingClientRect()
    const line = prompt.getBoundingClientRect()

    // The card grew into the stage (the field and Submit are docked
    // under it), and the sentence is centred in what it grew to --
    // not pinned to the ceiling of an empty box.
    expect(box.height).toBeGreaterThan(line.height * 3)
    const above = line.top - box.top
    const below = box.bottom - line.bottom
    expect(Math.abs(above - below)).toBeLessThan(line.height)
  })
})
