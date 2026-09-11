import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 読解 — the passage band, measured on the smallest phone ──────
// The backend asks for one text length at every JLPT level, and the
// ceiling of that band is not a preference: it is what the reading
// card holds WITHOUT scrolling here, at 390×667, which is the smallest
// screen the app is drawn for. backend/routes/reading.py's
// COMPREHENSION_CHARS names this file as the thing that measures it.
//
// So this is the test that fails when the band is raised without the
// card being re-measured — the way a passage gets back off the screen.
// (What happens when a model overshoots the band anyway is the phone
// lane's business: the card scrolls inside itself rather than spilling.
// See ComprehensionRun.phone.test.jsx.)
//
// ONE DIRECTION ONLY, and deliberately. This asserts that the ceiling
// fits; it does not assert that a character more would not. Where the
// line actually breaks depends on the Japanese font the machine has,
// and CI has none — a headless Linux runner falls back to a narrower
// glyph and packs noticeably more per line than any real device does
// (a text of CEILING + 80 overflows on a developer machine and fits in
// CI, which is what retired the assertion that used to be here). The
// fit is therefore measured where the metrics are worst and asserted
// where they can only be better: a pass in CI is weaker evidence than
// a pass locally, and a FAILURE anywhere is real.

// The ceiling of COMPREHENSION_CHARS. Written here as a number because
// the two halves of the app do not share a language; the backend test
// test_the_text_is_the_same_length_at_every_level holds the other end
// of the pair.
const CEILING = 280

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
  playUi: () => {}, playClick: () => {}, startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))

const { default: ComprehensionRun } = await import('./ComprehensionRun')

// A real mix — kanji, kana and punctuation. The marks matter: 。and 、
// each take a full em, so a text measured without them measures short.
const UNIT = 'さくらさんは毎朝七時に起きます。今日も七時に起きて、顔や手を洗いました。それから朝ごはんを食べました。朝ごはんはご飯と味噌汁と魚でした。'
function passage(chars) {
  let out = ''
  while (out.length < chars) out += UNIT
  return out.slice(0, chars)
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
// Long enough for the stage's entrance to land: a card still sliding
// in measures a few pixels low.
const settle = (ms = 700) => new Promise(r => setTimeout(r, ms))

async function reading(text) {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ok({
    text,
    translation: 'The whole thing, in English.',
    breakdown: [{ jp: text, translation: 'The whole thing, in English.', note: '' }],
    read_seconds: 240,
    questions: [{ type: 'comprehension', question: 'When?', options: ['六時', '七時', '八時', '九時'], correct: 1 }],
  }))
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/comprehension/N1']}>
        <div className="phone phone--stage">
          <Routes>
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Routes>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen.container
}

describe('the comprehension band at 390×667', () => {
  it('shows the longest text the band allows without scrolling', async () => {
    const root = await reading(passage(CEILING))
    const card = root.querySelector('.prompt-card--passage')
    const body = card.querySelector('.prompt-card__body')

    // Read at a glance: no scroll inside the card, and the card whole
    // on the screen with the strip that names it.
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
    expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(card.querySelector('.prompt-card__foot').getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(window.innerHeight)

    // And the page under it never moved — the whole passage is on the
    // one screen, not the first screenful of it.
    const doc = document.documentElement
    expect(doc.scrollHeight).toBeLessThanOrEqual(doc.clientHeight + 1)
  })
})
