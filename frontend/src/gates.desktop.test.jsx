import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the gates laid out for the width (plan 113) ────────────
// At the desk's tightest (1100, the rail taking 256 of it) the two
// plated gates hang their plates two by two, the odd fifth across the
// row, and Today sets the strip beside the fare gate. The phone's own
// column (layout.phone.test, PracticeScreen.phone.test) does not move.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
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
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N4' }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./screens/PracticeScreen')
const { default: LearnScreen } = await import('./screens/LearnScreen')

const settle = (ms = 620) => new Promise(r => setTimeout(r, ms))

// The shell's frame without the shell: the content column beside a
// rail's width of nothing, which is what the desk leaves a screen.
function framed(path, screen) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <div className="phone phone--desk">
          <div className="phone__content">{screen}</div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}

function twoByTwo(plates) {
  const boxes = [...plates.children].map(p => p.getBoundingClientRect())
  const whole = plates.getBoundingClientRect()
  expect(boxes).toHaveLength(5)
  // Two across, twice: the pairs share a top, and each half is half.
  expect(Math.round(boxes[0].top)).toBe(Math.round(boxes[1].top))
  expect(Math.round(boxes[2].top)).toBe(Math.round(boxes[3].top))
  expect(boxes[1].left).toBeGreaterThan(boxes[0].right)
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThanOrEqual(1)
  expect(boxes[0].width).toBeLessThan(whole.width / 2)
  // Plates in a row share a height.
  expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThanOrEqual(1)
  // The fifth takes the row.
  expect(boxes[4].top).toBeGreaterThan(boxes[2].bottom)
  expect(Math.abs(boxes[4].width - whole.width)).toBeLessThanOrEqual(1)
}

describe('the plated gates on the desk', () => {
  it('hangs Practice\'s platforms two by two, the exam across the row', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    const plates = document.querySelector('.practice > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    twoByTwo(plates)
    // The one across the row is the mock exam, last on the gate.
    expect(plates.lastElementChild.querySelector('.plate__head').textContent).toMatch(/examen|exam/i)
    for (const title of document.querySelectorAll('.plate__title')) {
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
  })

  it('hangs Learn\'s lines two by two, the deck shelf across the row', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const plates = document.querySelector('.learn > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    twoByTwo(plates)
    expect(plates.lastElementChild.classList.contains('plate--shelf')).toBe(true)
  })
})

// Today's layout on the desk is today.desktop.test.jsx (plan 114), on the
// real screen.
