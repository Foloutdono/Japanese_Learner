import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The smart-furigana cases assert COMPUTED display, and components do
// not import the sheet themselves (main.jsx does) -- same explicit
// import every style-asserting browser test carries.
import '../index.css'

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
    // status 'mastered' + furigana parts feed the smart-furigana cases:
    // a mastered word is exactly the one whose ruby 'unknown' hides.
    tokens: [{
      surface: '猫が好き', pos: 'noun',
      furigana: [{ text: '猫', reading: 'ねこ' }, { text: 'が好き' }],
      vocab_match: { entry: {}, stats: { status: 'mastered' }, level: 'N5', raw_id: 'x' },
    }],
  },
  {
    text: '犬も好き', cue_start: 2, cue_end: 4, grammar: [],
    unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{
      surface: '犬も好き', pos: 'noun',
      furigana: [{ text: '犬', reading: 'いぬ' }, { text: 'も好き' }],
      vocab_match: { entry: {}, stats: { status: 'new' }, level: 'N5', raw_id: 'y' },
    }],
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
// The screen now opens on the selection screen, and the platform choice
// goes through the boarding store so TrainDoor can play over the commit.
// The door lives in App, not in this tree, so an unmocked board() would
// park the commit forever; committing synchronously is exactly what the
// door itself does under prefers-reduced-motion.
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { apiJson, apiUpload, apiFetch } = await import('../lib/api')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Renders AND boards through the selection screen: the workbench (rail,
// intakes) only mounts once a platform card is chosen. The first card
// is 文字; cases that need 動画 switch via the rail (goToPlatform).
async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(30)
  screen.container.querySelector('.platform-card').click()
  await settle(30)
  return screen
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

// The road between platforms runs back through the selection-screen
// gate now: the stub strip's Change control, then the platform card
// (cards render in registry order). Only the boarded platform's panel
// is in the DOM, so the switch has to settle before anything inside
// the new panel can be queried.
async function goToPlatform(screen, key) {
  screen.container.querySelector('.anl-stub__change').click()
  await settle(30)
  const idx = { text: 0, photo: 1, video: 2 }[key]
  screen.container.querySelectorAll('.platform-card')[idx].click()
  await settle(30)
}

// The two stage dials render as .anl-seg groups labelled by their own
// ids -- structural, so the queries survive both locales.
function segOptions(screen, labelId) {
  return screen.container
    .querySelector(`[aria-labelledby="${labelId}"]`)
    .querySelectorAll('.anl-seg__opt')
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
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
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

  // Only the boarded platform's panel is in the DOM, which is what
  // keeps focus from ever landing inside a hidden one. The rail's
  // tablist is gone; the id is the seam the registry test also pins.
  it('mounts only the boarded platform’s intake panel', async () => {
    const screen = await renderScreen()
    const panels = screen.container.querySelectorAll('[id^="anl-panel-"]')
    expect(panels.length).toBe(1)
    expect(panels[0].id).toBe('anl-panel-text')
    // And the stub states where you boarded -- the plate is a fact,
    // not a menu, so it is not a button.
    expect(screen.container.querySelector('.anl-stub__plate')).not.toBeNull()
  })

  // ── Boarding another platform is a NEW JOB ──
  // Switching modes clears the analyser: a Passage typed on 文字 has
  // no business waiting behind the 写真 bench. Re-boarding the SAME
  // platform (out to the gate, back in) keeps the finished analysis —
  // a round trip is not a switch. Owner-directed (2026-09-01),
  // superseding the merge-era rule that the Passage survived every
  // platform change.
  it('clears itself when switching modes, keeps work on a same-mode round trip', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    expect(screen.container.querySelector('.anl-results')).not.toBeNull()

    // Out to the gate and back onto the SAME platform: still there.
    await goToPlatform(screen, 'text')
    expect(screen.container.querySelector('.anl-results')).not.toBeNull()
    expect(screen.container.querySelector('textarea').value).not.toBe('')

    // A DIFFERENT platform: results gone, draft gone.
    await goToPlatform(screen, 'photo')
    expect(screen.container.querySelector('.anl-results')).toBeNull()
    expect(screen.container.querySelector('textarea').value).toBe('')

    // And coming back does not resurrect the old Passage.
    await goToPlatform(screen, 'text')
    expect(screen.container.querySelector('.anl-results')).toBeNull()
    expect(screen.container.querySelector('textarea').value).toBe('')
  })

  // ── Smart furigana ──
  // 'unknown' (the default) hides ruby ONLY over words the SRS has
  // mastered; 'all' restores everything; 'none' bares the line.
  // Asserted on computed style, not class names -- the wave-5 audit's
  // rule about assertions that outlive the fix they guard.
  it('shows readings only where they are still needed, by default', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const mastered = screen.container.querySelector('.rdg-breakdown-line .word-span--known rt')
    expect(mastered).not.toBeNull()
    expect(getComputedStyle(mastered).display).toBe('none')

    // 'All' restores the mastered word's ruby...
    segOptions(screen, 'anl-furigana-label')[0].click()
    await settle(60)
    expect(getComputedStyle(
      screen.container.querySelector('.rdg-breakdown-line .word-span--known rt'),
    ).display).not.toBe('none')

    // ...and 'none' hides every reading on the line.
    segOptions(screen, 'anl-furigana-label')[2].click()
    await settle(60)
    for (const rt of screen.container.querySelectorAll('.rdg-breakdown-line rt')) {
      expect(getComputedStyle(rt).display).toBe('none')
    }
  })

  it('switches the stage between the stepper and the token table', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    expect(screen.container.querySelector('.rdg-breakdown-card-row')).not.toBeNull()

    // The table replaces the CARD, not the stage: the sentence pane and
    // the dials stay put (mockup behaviour — see the mockup contract
    // suite for the table's own shape).
    segOptions(screen, 'anl-view-label')[1].click()
    await settle(60)
    expect(screen.container.querySelector('.anl-toktable')).not.toBeNull()
    expect(screen.container.querySelector('.rdg-breakdown-card-row')).toBeNull()
    expect(screen.container.querySelector('.anl-sentence')).not.toBeNull()

    segOptions(screen, 'anl-view-label')[0].click()
    await settle(60)
    expect(screen.container.querySelector('.rdg-breakdown-card-row')).not.toBeNull()
  })

  // ── The working rail ──
  it('filters the line and counts what it shows', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    expect(screen.container.querySelectorAll('.anl-stop').length).toBe(2)

    // Chips render [all, kept, i+1, has-new]; the fixture has one i+1.
    screen.container.querySelectorAll('.anl-chip')[2].click()
    await settle(60)
    expect(screen.container.querySelectorAll('.anl-stop').length).toBe(1)
    expect(screen.container.querySelector('.anl-railfoot__count').textContent)
      .toContain('1 / 2')

    screen.container.querySelectorAll('.anl-chip')[0].click()
    await settle(60)

    // Search narrows by the Sentence's own text.
    typeInto(screen.container.querySelector('.anl-railhead__search'), '犬')
    await settle(60)
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops.length).toBe(1)
    expect(stops[0].textContent).toContain('犬も好き')
  })

  it('keeps every i+1 sentence in one press, then says it is done', async () => {
    // Stateful mocks: keepSentence's `finally` refetches 運行履歴 and
    // rebuilds the kept set FROM it, so a static empty history would
    // clobber the very keeps this test performs -- the server has to
    // remember what was posted, exactly as the real one does.
    const keptRows = []
    apiJson.mockImplementation(async (url, _session, opts) => {
      if (url === '/api/phrase/keep') {
        const body = JSON.parse(opts.body)
        keptRows.push({
          id: keptRows.length + 1, phrase: body.sentence,
          source: body.source, created_at: new Date().toISOString(), kept: true,
        })
        return {}
      }
      return { sentences: SENTENCES, truncated: 0 }
    })
    apiFetch.mockImplementation(async url => ({
      ok: true, status: 200,
      json: async () => (url === '/api/phrase/history' ? keptRows : []),
    }))

    const screen = await renderScreen()
    await analyze(screen)
    expect(screen.container.querySelectorAll('.anl-keep--on').length).toBe(0)

    const bulk = screen.container.querySelector('.anl-railfoot .anl-ghost')
    expect(bulk.disabled).toBe(false)
    bulk.click()
    await settle(200)

    expect(screen.container.querySelectorAll('.anl-keep--on').length).toBe(1)
    expect(screen.container.querySelector('.anl-railfoot .anl-ghost').disabled).toBe(true)
  })

  it('draws every stop as a button with exactly one current', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops.length).toBe(2)
    expect(screen.container.querySelectorAll('button.anl-stop').length).toBe(2)
    expect(screen.container.querySelectorAll('.anl-stop[aria-current="true"]').length).toBe(1)
  })

  // Plan 032's fix, kept closed across the move to the gate: boarding
  // never lands on a folded intake -- a platform that appears to do
  // nothing is the defect. (The Passage no longer survives a switch to
  // a DIFFERENT platform — that is the mode-switch clear pinned above —
  // so what this case still owns is the intake being open on arrival.)
  it('reopens the intake when boarding another platform after a result', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    let panel = screen.container.querySelector('[id^="anl-panel-"]')
    expect(panel.hasAttribute('hidden')).toBe(true)

    await goToPlatform(screen, 'photo')

    panel = screen.container.querySelector('[id^="anl-panel-"]')
    expect(panel.id).toBe('anl-panel-photo')
    expect(panel.hasAttribute('hidden')).toBe(false)
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

    screen.container.querySelector('.anl-stub__clear').click()
    await settle(60)

    expect(screen.container.querySelector('.anl-results')).toBeNull()
    expect(screen.container.querySelector('textarea').value).toBe('')
    expect(screen.container.querySelector('[id^="anl-panel-"]').hasAttribute('hidden')).toBe(false)
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
