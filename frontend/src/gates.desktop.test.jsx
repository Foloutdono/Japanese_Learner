import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the gates laid out for the width (plan 113) ────────────
// At the desk's tightest (1100, the rail taking 256 of it) the two
// plated gates hang their plates two by two — Learn's odd fifth across
// the row, Practice's six in three rows of two since 作文 (plan 125) —
// and Today sets the strip beside the fare gate. The phone's own
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

// Two across: every pair shares a top and a height, and each half is
// half. An odd last plate takes the row (`spans`); an even count ends
// on a full pair.
function lattice(plates, { count, spans }) {
  const boxes = [...plates.children].map(p => p.getBoundingClientRect())
  const whole = plates.getBoundingClientRect()
  expect(boxes).toHaveLength(count)
  for (let i = 0; i + 1 < count; i += 2) {
    expect(Math.round(boxes[i].top)).toBe(Math.round(boxes[i + 1].top))
    expect(boxes[i + 1].left).toBeGreaterThan(boxes[i].right)
    expect(Math.abs(boxes[i].width - boxes[i + 1].width)).toBeLessThanOrEqual(1)
    expect(boxes[i].width).toBeLessThan(whole.width / 2)
    expect(Math.abs(boxes[i].height - boxes[i + 1].height)).toBeLessThanOrEqual(1)
    if (i > 0) expect(boxes[i].top).toBeGreaterThan(boxes[i - 2].bottom)
  }
  const last = boxes[count - 1]
  if (spans) {
    expect(last.top).toBeGreaterThan(boxes[count - 2].bottom)
    expect(Math.abs(last.width - whole.width)).toBeLessThanOrEqual(1)
  } else {
    expect(last.width).toBeLessThan(whole.width / 2)
  }
}

describe('the plated gates on the desk', () => {
  it('hangs Practice\'s six platforms in three rows of two, the exam last beside 作文', async () => {
    await framed('/practice', <PracticeScreen />)
    await settle()
    const plates = document.querySelector('.practice > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    // Six divide by two, so the odd-last rule has nothing to span: the
    // exam keeps its place at the end of the gate and shares the third
    // row with the platform added before it (plan 125).
    lattice(plates, { count: 6, spans: false })
    expect(plates.lastElementChild.querySelector('.plate__head').textContent).toMatch(/examen|exam/i)
    expect(plates.children[4].querySelector('.plate__head').textContent).toMatch(/rédaction|composition/i)
    for (const title of document.querySelectorAll('.plate__title')) {
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    }
  })

  it('hangs Learn\'s lines two by two, the deck shelf across the row', async () => {
    await framed('/learn', <LearnScreen />)
    await settle()
    const plates = document.querySelector('.learn > .plates')
    expect(getComputedStyle(plates).display).toBe('grid')
    lattice(plates, { count: 5, spans: true })
    expect(plates.lastElementChild.classList.contains('plate--shelf')).toBe(true)
  })
})

// Today's layout on the desk is today.desktop.test.jsx (plan 114), on the
// real screen.
