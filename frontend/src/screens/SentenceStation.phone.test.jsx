import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 実践's stations — the JLPT grades, at 390px ────────────────
// The three sentence sections asked "which grade?" with five rows of a
// code and a name and nothing else — 324px of the phone left under
// them — while every SRS station beside them printed how far into the
// grade the learner is. The figure they were missing is the level's
// VOCABULARY: a sentence at N4 is built from N4 words
// (backend/routes/reading.py, _pick_words_level), so the words held is
// exactly the readiness the grade is being picked for.

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
  startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('../stores/profileSummary', () => ({ useProfileSummary: () => ({ jlptLevel: 'N5' }) }))

const { default: SentenceStation } = await import('./SentenceStation')
const { seedStats } = await import('../stores/stats')

const settle = (ms = 620) => new Promise(r => setTimeout(r, ms))

// N5 is a grade under way — 260 words met, 120 of them held. N4 is the
// case the caption exists for: work done, nothing mastered yet, which
// is every learner's first fortnight on a level. N3 down to N1 are
// untouched, and print a figure and nothing else.
seedStats({
  items: {
    vocab: {
      N5: { learned: 120, started: 260, total: 800 },
      N4: { learned: 0, started: 40, total: 1500 },
      N3: { learned: 0, started: 0, total: 3700 },
      N2: { learned: 0, started: 0, total: 6000 },
      N1: { learned: 0, started: 0, total: 10000 },
    },
  },
})

describe('the sentence stations at phone width', () => {
  it('prints the grade and how much of its vocabulary the learner holds', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/reading/levels']}>
          <div className="phone">
            <div className="phone__content">
              <SentenceStation session={null} base="/practice/reading" />
            </div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()

    const stops = [...screen.container.querySelectorAll('.route-stop')]
    expect(stops).toHaveLength(5)
    expect(stops.map(s => s.querySelector('.route-stop__fig')?.textContent.replace(/\s/g, '')))
      .toEqual(['120/800', '0/1500', '0/3700', '0/6000', '0/10000'])

    // No second DRAWING of it: the stop drew the figure again as a rule
    // along the bottom of its card, and that rule is gone (owner's call
    // — it competed with the line's own rail).
    for (const stop of stops) expect(stop.querySelector('.route-stop__bar')).toBeNull()

    // A second NUMBER, though, under the figure and only where it says
    // something the figure cannot: mastery is a 21-day interval, so
    // without this N4 reads 0 / 1500 through a fortnight of real work.
    // The count, not the word around it — this lane's language is the
    // browser's, and the caption's copy is the string table's business.
    const notes = stops.map(s => s.querySelector('.route-stop__started')?.textContent ?? null)
    expect(notes.map(n => n?.match(/\d+/)?.[0] ?? null))
      .toEqual(['260', '40', null, null, null])

    // And it is a caption on the row's caption line, not a second
    // figure: under the NAME, ranged left with it, sharing that line
    // with the landmark rather than taking one of its own. Stacked
    // under the figure instead, it put a fourth staggered line in a
    // row that already alternates left and right, and it ran wider
    // than the figure it was supposed to be a note on.
    const box = sel => stops[0].querySelector(sel).getBoundingClientRect()
    const [name, here, note, fig] =
      ['.route-stop__jp', '.route-stop__here', '.route-stop__started', '.route-stop__fig'].map(box)
    expect(note.left).toBeGreaterThanOrEqual(name.left)
    expect(note.top).toBeGreaterThanOrEqual(name.bottom)
    expect(note.top).toBeCloseTo(here.top, 0)          // one line, not two
    expect(note.height).toBeLessThan(fig.height)
    // The row is three lines and the figure sits on the first of them,
    // level with the code — the right-hand column stays one line deep.
    expect(fig.bottom).toBeLessThanOrEqual(name.top)

    // And the learner's own grade is still the one marked.
    expect(screen.container.querySelector('.route-stop--current .route-stop__code').textContent).toBe('N5')
  })
})
