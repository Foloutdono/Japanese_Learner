import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// Structure and keyboard, in a real DOM. The browser lane exists for
// exactly this -- see vite.config.js: "focus management, heading
// structure, computed styles under a media feature".
//
// What this file deliberately does NOT do is assert a LAYOUT. The lane
// runs one viewport, so reading getBoundingClientRect at a simulated
// width would be a test that passes for the wrong reason. The
// two-column/strip split is verified by hand at real widths; see
// plans/030's test plan.

const SENTENCES = [
  {
    text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
    unknown_count: 1, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{ surface: '猫が好き', pos: 'noun' }],
  },
  {
    text: '犬も好き', cue_start: 2, cue_end: 4, grammar: [],
    unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{ surface: '犬も好き', pos: 'noun' }],
  },
]

vi.mock('../lib/api', () => ({
  apiJson: vi.fn(async () => ({ sentences: SENTENCES, truncated: 0 })),
  apiUpload: vi.fn(),
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  ApiError: class ApiError extends Error {},
}))
// Spread the real module: other names (buildCloze, ...) are pulled out
// of it elsewhere in this import graph, and a bare factory breaks them.
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('../components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function renderScreen() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
}

function typeInto(el, text) {
  const proto = Object.getPrototypeOf(el)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function analyze(screen) {
  typeInto(screen.container.querySelector('textarea'), '猫が好き。犬も好き。')
  screen.container.querySelector('.anl-action').click()
  await settle(150)
}

describe('AnalyzerScreen structure', () => {
  // Plan 003 paid for this. The station plate IS how the app names the
  // screen you are on, so it owns the only <h1>; everything else on the
  // screen is an <h2> from SectionHeader. This is the assertion that
  // catches somebody adding a screen title above the plate.
  it('has exactly one h1, from the station plate', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    expect(screen.container.querySelectorAll('h1').length).toBe(1)
    expect(screen.container.querySelectorAll('main').length).toBe(1)
  })

  // Only the active panel is in the DOM, which is what keeps focus from
  // ever landing inside a hidden one.
  it('renders only the active tab panel, labelled by the selected tab', async () => {
    const screen = await renderScreen()
    const panels = screen.container.querySelectorAll('[role="tabpanel"]')
    expect(panels.length).toBe(1)

    const selected = screen.container.querySelector('[role="tab"][aria-selected="true"]')
    expect(panels[0].getAttribute('aria-labelledby')).toBe(selected.id)
  })

  it('moves selection and focus with the arrow keys', async () => {
    const screen = await renderScreen()
    const first = screen.container.querySelector('#anl-tab-text')
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await settle(60)

    const selected = screen.container.querySelector('[role="tab"][aria-selected="true"]')
    expect(selected.id).toBe('anl-tab-photo')
    // Focus follows selection, or the next arrow press comes from the
    // wrong place and the rail walks backwards.
    expect(document.activeElement.id).toBe('anl-tab-photo')

    // Home returns to the first platform.
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await settle(60)
    expect(screen.container.querySelector('[role="tab"][aria-selected="true"]').id)
      .toBe('anl-tab-text')
  })

  it('draws every stop as a button with exactly one current', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops.length).toBe(2)
    expect(screen.container.querySelectorAll('button.anl-stop').length).toBe(2)
    expect(screen.container.querySelectorAll('.anl-stop[aria-current="true"]').length).toBe(1)
  })
})
