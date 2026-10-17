import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The shipped face (main.jsx), so a platform's name is measured in the
// font it is drawn in: since plan 174 the names are the display face,
// and the runner's fallback for it (DejaVu Sans) sets « Entraînement à
// la lecture » 45px wider than Space Grotesk does.
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the Practice gate on a laptop (plan 243) ──────────────────
// The `wide` lane: a laptop's 1440×900. The board stands at Today's
// column's width (36% of the frame), and the chosen train's card has
// the room the owner's picture gives it: the line saying what the run
// asks over the well, and in the well the full face -- comprehension's
// text over its question and four choices, each on one line -- on every
// train at every grade, with nothing cut and no scroll. At the desk's
// tightest (screens/PracticeScreen.desktop.test.jsx) the line goes and
// the well draws its compact face.

const { default: CARDS } = await import('./testing/practiceCards.json')
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const line = path.match(/^\/api\/station\/(\w+)\/samples/)?.[1]
    return { ok: true, status: 200, json: async () => (line ? { stops: CARDS[line] } : {}) }
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
}))
const learner = vi.hoisted(() => ({ grade: 'N5' }))
vi.mock('./stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N5' }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: learner.grade }, failed: false }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const settle = async (ms = 400) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
}
const box = el => el.getBoundingClientRect()
const $ = sel => document.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const gate = () => render(
  <LangProvider>
    <MemoryRouter initialEntries={['/practice']}>
      <div className="phone phone--desk">
        <div className="phone__content"><PracticeScreen /></div>
      </div>
    </MemoryRouter>
  </LangProvider>
)
async function choose(train, level) {
  $$('.pdesk-dep')[train].click()
  $$('.pdesk-levels [role="radio"]')[LEVELS.indexOf(level)].click()
  await settle(150)
}

describe('the Practice gate on a laptop (plan 243)', () => {
  it('draws the line over the card\'s well and the full face in it, on every train at every grade', async () => {
    await gate()
    await settle()
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    const frame = box($('.pdesk'))
    expect(Math.abs(box($('.pdesk__board')).width - 0.36 * frame.width)).toBeLessThanOrEqual(1)
    for (const level of LEVELS) {
      for (let i = 0; i < 7; i++) {
        await choose(i, level)
        const what = `${level} ${$('.pdesk-card').getAttribute('aria-label')}`
        const how = $('.pdesk-card__how')
        expect(how.hidden, what).toBe(false)
        expect(box(how).height, what).toBeGreaterThan(0)
        const well = $('.pdesk-card .prc-spec')
        expect(well.classList.contains('prc-spec--compact'), what).toBe(false)
        expect(box(well).top, what).toBeGreaterThan(box(how).bottom)
        expect(well.scrollHeight, what).toBeLessThanOrEqual(well.clientHeight + 1)
        expect(well.scrollWidth, what).toBeLessThanOrEqual(well.clientWidth + 1)
        // Every French name whole, the card's and the trains'.
        for (const title of $$('.pdesk-dep__title, .pdesk-card__title')) {
          expect(title.scrollWidth, title.textContent).toBeLessThanOrEqual(title.clientWidth)
        }
      }
      await choose(1, level)
      const comprehension = $('.pdesk-card .prc-spec')
      const card = CARDS.comprehension[level].card
      expect(comprehension.querySelector('.prc-spec__title').textContent).toBe(card.title)
      // The text keeps a line under its title, above the question.
      const text = comprehension.querySelector('.prc-spec__text')
      expect(box(text).height, level).toBeGreaterThan(box(comprehension.querySelector('.prc-spec__title')).height)
      expect(box(comprehension.querySelector('.prc-spec__q')).top).toBeGreaterThanOrEqual(box(text).bottom)
      expect(comprehension.querySelector('.prc-spec__q').textContent).toBe(card.question)
      const choices = $$('.prc-spec__opt', comprehension)
      expect(choices.map(c => c.querySelector('.prc-spec__label').textContent)).toEqual(card.options)
      // Each on one line, however long the sentence.
      const heights = choices.map(c => Math.round(box(c).height))
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    }
  })
})
