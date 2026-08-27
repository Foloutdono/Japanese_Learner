import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    // vocab_match is what makes a Token's card clickable (TokenCard's
    // surface-wrap only wires onWordClick when it is present) -- needed
    // to open WordDetail in the tests below that check its lifecycle.
    tokens: [{
      surface: '猫が好き', pos: 'noun',
      vocab_match: { entry: {}, stats: {}, level: 'N5', raw_id: 'x' },
    }],
  },
  {
    text: '犬も好き', cue_start: 2, cue_end: 4, grammar: [],
    unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{ surface: '犬も好き', pos: 'noun' }],
  },
]

vi.mock('../lib/api', () => ({
  apiJson: vi.fn(async () => ({ sentences: SENTENCES, truncated: 0 })),
  apiUpload: vi.fn(async () => ({ sessionId: 1, status: 'generating' })),
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
const { apiJson, apiUpload } = await import('../lib/api')

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

// Only the ACTIVE tabpanel is in the DOM (case above), so a platform
// switch needs to settle before anything inside the new panel can be
// queried.
async function goToPlatform(screen, key) {
  screen.container.querySelector(`#anl-tab-${key}`).click()
  await settle(30)
}

// Drives the 動画 platform's file input the way IntakeVideo actually
// reads it. `apiJson` is reset to a two-step generating -> ready
// sequence first, since the shared top-of-file mock resolves
// immediately with the text-analysis fixture and would short-circuit
// the poll into "ready" on the very first request.
async function startFromFile(screen) {
  apiJson.mockReset()
  apiJson
    .mockResolvedValueOnce({ status: 'generating' })
    .mockResolvedValue({
      status: 'ready', source: 'upload', sourceRef: 'x.srt',
      windowCapped: false, truncated: 0,
      sentences: [{
        text: '犬', cue_start: 0, cue_end: 2, grammar: [],
        unknown_count: 0, available: true,
        tokens: [{ surface: '犬', pos: 'noun' }],
      }],
    })
  await goToPlatform(screen, 'video')
  const input = screen.container.querySelector('input[type="file"]')
  const dt = new DataTransfer()
  const srt = ['1', '00:00:01,000 --> 00:00:04,000', '犬', ''].join('\n')
  dt.items.add(new File([srt], 'x.srt', { type: 'text/plain' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle(2000)
}

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockResolvedValue({ sentences: SENTENCES, truncated: 0 })
  apiUpload.mockReset()
  apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
})

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

  // Plan 032: before this fix, `setSource` never touched `intakeOpen`,
  // so the panel stayed `hidden` through every platform change once a
  // result was on screen -- a large, prominent tab click that appeared
  // to do nothing.
  it('reopens the intake when the platform changes after a result', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    let panel = screen.container.querySelector('[role="tabpanel"]')
    expect(panel.hasAttribute('hidden')).toBe(true)

    await goToPlatform(screen, 'photo')

    panel = screen.container.querySelector('[role="tabpanel"]')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('aria-labelledby')).toBe('anl-tab-photo')
  })

  // Plan 032: the Analyze button lives INSIDE the panel that folds
  // away on arrival, so hiding it used to blur the document to <body>
  // -- a keyboard user's next Tab restarted from the top of the page.
  it('moves focus into the result when a Passage arrives', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const results = screen.container.querySelector('.anl-results')
    expect(results).not.toBeNull()
    expect(document.activeElement === results || results.contains(document.activeElement))
      .toBe(true)
  })

  // Assert on the actual computed result (no ancestor is hidden), not
  // on a class name -- the wave-5 audit recorded four a11y assertions
  // that kept passing after the fix they guarded had been silently
  // voided, because they checked DOM shape rather than behaviour.
  it('never leaves focus inside a hidden element', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    let node = document.activeElement
    while (node && node !== document.body) {
      expect(node.hasAttribute('hidden')).toBe(false)
      node = node.parentElement
    }
  })

  // Plan 032: `useAnalyzerSession.reset()` existed with zero call
  // sites -- the only way back to an empty analyser was to navigate
  // away and return.
  it('clears the Passage', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    expect(screen.container.querySelector('.anl-results')).not.toBeNull()

    screen.container.querySelector('.anl-clear').click()
    await settle(60)

    expect(screen.container.querySelector('.anl-results')).toBeNull()
    expect(screen.container.querySelector('textarea').value).toBe('')
    expect(screen.container.querySelector('[role="tabpanel"]').hasAttribute('hidden')).toBe(false)
  })

  // Plan 032 (reviewer follow-up): a WordDetail sheet describes a Token
  // of whichever Passage was on screen when it was opened. Before this
  // fix only the text/photo ingest (analyzeDraft) closed it on a new
  // analysis; the two video ingests did not, which was the one
  // reachable path that could leave a dialog open when the arrival
  // effect moved focus to the result -- stealing focus out of a live
  // dialog and silently defeating useDialog's Tab-wrap trap.
  it('closes an open word detail when a new Passage arrives', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const tokenEl = screen.container.querySelector('.phrase-word-card__surface-wrap--clickable')
    expect(tokenEl).not.toBeNull()
    tokenEl.click()
    await settle(60)
    expect(screen.container.querySelector('[role="dialog"]')).not.toBeNull()

    await startFromFile(screen)

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement?.classList.contains('anl-results')).toBe(true)
  })
})
