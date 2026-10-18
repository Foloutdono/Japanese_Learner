import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The subject is layout, so the sheet has to be on the page.
import '../index.css'

// ── The analyser on a phone (390×844) ─────────────────────
// The working rail is a DESKTOP instrument since 2026-09-11. Below the
// 1100px split it used to stack above the stage — a ~170px window over
// a Passage the stepper already walks, under a search field, four
// filter chips and a bulk pin — and it is not built there at all any
// more. 保存, the one act only the rail could perform, moved onto the
// result's head, where it acts on the Sentence being shown; since plan
// 134 the result is the owner's drawing (the subtitles, the numbered
// grammar, Explain), and the subtitles' two quieter lines walk the stops.
//
// This lane is the only honest place to pin that. The browser lane
// runs at chromium's default width, and a CDP viewport change does not
// fire matchMedia's `change` (useMediaQuery.browser.test.jsx), so a
// page that STARTS at 390px is the only setup that proves what a
// handset gets.

const SENTENCES = [
  {
    text: '猫が好き', cue_start: null, cue_end: null, grammar: [],
    unknown_count: 1, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{
      surface: '猫が好き', pos: 'noun',
      furigana: [{ text: '猫', reading: 'ねこ' }, { text: 'が好き' }],
      vocab_match: { entry: {}, stats: { status: 'new' }, level: 'N5', raw_id: 'x' },
    }],
  },
  {
    text: '犬も好き', cue_start: null, cue_end: null, grammar: [],
    unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{
      surface: '犬も好き', pos: 'noun',
      furigana: [{ text: '犬', reading: 'いぬ' }, { text: 'も好き' }],
      vocab_match: { entry: {}, stats: { status: 'mastered' }, level: 'N5', raw_id: 'y' },
    }],
  },
]

vi.mock('../lib/api', () => ({
  apiJson: vi.fn(async () => ({ sentences: SENTENCES, truncated: 0 })),
  apiUpload: vi.fn(async () => ({ sessionId: 1, status: 'generating' })),
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  ApiError: class ApiError extends Error {},
}))
// Spread the real module: other names are pulled out of it elsewhere
// in this import graph, and a bare factory breaks them.
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('../components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { useStaged } = await import('../stores/stage')

// What the Shell reads to leave its two bars out (plan 219): printed
// beside the screen so a test can see the claim come and go.
function StageProbe() {
  return <span data-testid="staged" data-on={String(useStaged())} />
}
const { apiJson, apiFetch } = await import('../lib/api')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Inside the frame, not bare: `.phone` is the 100dvh column and
// `.phone__content > main` is the flex child that gives the screen its
// height (index.css). Mounting Shell itself would drag the HUD's data
// in for nothing -- the two divs ARE what the CSS under test reads.
async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <div className="phone">
          <div className="phone__content">
            <AnalyzerScreen session={{}} />
          </div>
        </div>
        <StageProbe />
      </MemoryRouter>
    </LangProvider>
  )
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
  // The result's head, not a fixed wait: on a loaded CI runner 150 ms
  // was sometimes short of the first render of the passage.
  await vi.waitFor(() => {
    if (!screen.container.querySelector('.anl-m__head')) throw new Error('no result yet')
  }, { timeout: 5000 })
  await settle(150)
}

/** A server that remembers what was kept — keepSentence's `finally`
 *  rebuilds the kept set from 運行履歴, so a history that forgets
 *  would clobber the very keep under test. */
function statefulKeeps() {
  const rows = []
  apiJson.mockImplementation(async (url, _session, opts) => {
    if (url === '/api/phrase/keep') {
      const body = JSON.parse(opts.body)
      rows.push({
        id: rows.length + 1, phrase: body.sentence,
        source: body.source, created_at: new Date().toISOString(), kept: true,
      })
      return {}
    }
    return { sentences: SENTENCES, truncated: 0 }
  })
  apiFetch.mockImplementation(async (url, _session, opts) => {
    if (opts?.method === 'DELETE') {
      const id = Number(String(url).split('/').pop())
      const at = rows.findIndex(r => r.id === id)
      if (at >= 0) rows.splice(at, 1)
      return { ok: true, status: 200, json: async () => ({}) }
    }
    return {
      ok: true, status: 200,
      json: async () => (url === '/api/phrase/history' ? rows : []),
    }
  })
  return rows
}

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockResolvedValue({ sentences: SENTENCES, truncated: 0 })
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
})

describe('the analyser result on a phone', () => {
  it('builds no working rail — not hidden, absent', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // The result is on the page...
    expect(screen.container.querySelector('.anl-results')).not.toBeNull()
    // ...and none of the rail is, down to the tab stops it would add.
    for (const sel of [
      '.anl-railcol', '.anl-railhead', '.anl-railhead__search',
      '.anl-chip', '.anl-railfoot', '.anl-line', '.anl-stop', '.anl-keep',
    ]) {
      expect(screen.container.querySelector(sel), `${sel} is still built`).toBeNull()
    }

    // What replaces it: the subtitles' next line walks the stops (plan 134),
    // under the sentence since plan 219.
    expect(screen.container.querySelector('.anl-m__subs > .anl-m__line--next').textContent)
      .toBe('犬も好き')
  })

  it('puts 保存 in the dock as a real toggle at a thumb-sized target', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // Plan 219: keep acts on the line, so it is one of the dock's tools.
    const keep = screen.container.querySelector('.anl-m__dock .anl-head__keep')
    expect(keep).not.toBeNull()
    expect(keep.tagName).toBe('BUTTON')
    // A toggle, not a link that looks like one: the state is on the
    // control, so a screen reader hears it change...
    expect(keep.getAttribute('aria-pressed')).toBe('false')
    // ...and the glyph carries no name of its own, so the whole
    // sentence is the accessible one -- the rail pin's arrangement.
    expect(keep.getAttribute('aria-label')).toBeTruthy()
    // The mark is drawn, not typed: a text "+" beside the head's
    // stroked × is a 9px speck next to a 14px icon. The word under it
    // is the tool's caption, hidden from the accessible name.
    expect(keep.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(keep.querySelector('span[aria-hidden="true"]').textContent).toBe('Garder')
    const box = keep.getBoundingClientRect()
    // Measured to within a hair of 44, not to 44 exactly. The keep is
    // the one thumb target here DECLARED at 44px square (index.css,
    // .anl-head__keep) rather than reaching 44 through its padding, so
    // it alone sits on the boundary where the runner's own
    // rasterisation decides the assertion: CI has measured
    // 43.999996185302734px on a commit that touched nothing on this
    // screen, and the same run passed elsewhere. A touch target is a
    // physical thing and four millionths of a pixel is not a
    // regression; anything that actually shrank this control misses by
    // a whole pixel or more, which this still catches.
    const HAIR = 0.01
    expect(box.height, `the keep is ${box.height}px tall`).toBeGreaterThanOrEqual(44 - HAIR)
    expect(box.width, `the keep is ${box.width}px wide`).toBeGreaterThanOrEqual(44 - HAIR)
  })

  it('keeps the stop the stage is on, and lets it go again', async () => {
    const rows = statefulKeeps()
    const screen = await renderScreen()
    await analyze(screen)

    const keep = () => screen.container.querySelector('.anl-head__keep')
    // The subtitles' two quieter lines: the previous above, the next
    // below (plan 219). Walk to the second stop first: what gets kept is
    // where you are, not where the Passage starts.
    const next = () => screen.container.querySelector('.anl-m__subs > .anl-m__line--next')
    const prev = () => screen.container.querySelector('.anl-m__subs > .anl-m__line--prev')
    next().click()
    await settle(60)

    keep().click()
    await settle(200)
    expect(keep().getAttribute('aria-pressed')).toBe('true')
    expect(keep().querySelector('svg polyline'), 'the pressed mark is the check').not.toBeNull()
    expect(rows.map(r => r.phrase)).toEqual(['犬も好き'])

    keep().click()
    await settle(200)
    expect(keep().getAttribute('aria-pressed')).toBe('false')
    expect(rows).toEqual([])

    // Stepping back to a kept stop finds the control already pressed:
    // the head reads the same set the history does.
    keep().click()
    await settle(200)
    prev().click()
    await settle(60)
    expect(keep().getAttribute('aria-pressed')).toBe('false')
    next().click()
    await settle(60)
    expect(keep().getAttribute('aria-pressed')).toBe('true')
  })

  it('fits the head on 390px without a sideways scroll', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const head = screen.container.querySelector('.anl-m__head')
    expect(head.scrollWidth, 'the head overflows its own row')
      .toBeLessThanOrEqual(head.clientWidth + 1)
    expect(document.documentElement.scrollWidth)
      .toBeLessThanOrEqual(window.innerWidth + 1)
  })

  // ── The drawing on a phone (plan 219, the owner's pick D) ──
  // The subtitles stand at the column's width, the dock at the screen's
  // edges, and nothing is wider than the handset.
  it('gives the subtitles the page\'s width and the dock the screen\'s, and no colour legend', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const width = screen.container.querySelector('.anl-m').clientWidth
    expect(screen.container.querySelector('.anl-m__subs').getBoundingClientRect().width)
      .toBeGreaterThan(width * 0.9)
    expect(screen.container.querySelector('.anl-m__dock').getBoundingClientRect().width)
      .toBeGreaterThanOrEqual(width)
    expect(screen.container.querySelector('.anl-legend, .anl-dials, .anl-stage')).toBeNull()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
  })

  it('stands the line\'s tools in the dock on the screen\'s foot, each a thumb target', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const dock = screen.container.querySelector('.anl-m__dock')
    expect(Math.round(dock.getBoundingClientRect().bottom)).toBeLessThanOrEqual(window.innerHeight)
    const tools = [...dock.querySelectorAll('.anl-m__tool')]
    // The fixture's sentences carry no grammar: words, Explain and keep.
    expect(tools).toHaveLength(3)
    for (const tool of tools) {
      expect(tool.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // A typed Passage has no clock: the transport is the stops alone.
    expect(dock.querySelectorAll('.anl-pbar--stage button')).toHaveLength(2)
  })

  it('opens the line\'s words in a sheet, and a word from there in the dictionary\'s', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const words = [...screen.container.querySelectorAll('.anl-m__tool')].find(b => b.textContent.includes('Mots'))
    words.click()
    // W2 (plan 220): a card per word, the sheet naming how many.
    await vi.waitFor(() => expect(document.querySelector('.anl-m__sheet .anl-tile')).not.toBeNull())
    expect(document.querySelector('.anl-m__sheet .sheet__cap').textContent).toBe('1 mot · 1 nouveau')
    document.querySelector('.anl-m__sheet .anl-tile').click()
    await vi.waitFor(() => expect(document.querySelector('.anl-m__sheet')).toBeNull())
  })

  // Plan 220: the explanation is a bottom sheet as tall as it holds. A
  // call that failed says so with a full-width way to try again, where it
  // was two lines of red on a card the screen's full height.
  it('says when an explanation failed, and offers to try again at full width', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    apiJson.mockImplementation(async (url, _s, opts) => {
      if (opts?.body && JSON.parse(opts.body).deep) throw Object.assign(new Error('down'), { status: 503 })
      return { sentences: SENTENCES, truncated: 0 }
    })
    ;[...screen.container.querySelectorAll('.anl-m__tool')].find(b => b.textContent.includes('Expliquer')).click()
    await vi.waitFor(() => expect(document.querySelector('.anl-explainsheet__fail')).not.toBeNull())
    const sheet = document.querySelector('.sheet.anl-explainsheet')
    expect(sheet.querySelector('.anl-explainsheet__failtitle').textContent).toBe('Pas d’explication pour l’instant')
    const retry = sheet.querySelector('.anl-explainsheet__retry')
    expect(retry.getBoundingClientRect().width).toBeGreaterThan(sheet.clientWidth * 0.8)
    expect(retry.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // As tall as it holds, not the screen's height.
    expect(sheet.getBoundingClientRect().height).toBeLessThan(window.innerHeight * 0.7)
    // No explanation, nothing to ask about yet.
    expect(sheet.querySelector('.ask')).toBeNull()
  })

  it('takes the stage while the result is up, and gives it back on the way out', async () => {
    const screen = await renderScreen()
    const staged = () => document.querySelector('[data-testid="staged"]').dataset.on
    expect(staged()).toBe('false')
    await analyze(screen)
    expect(staged()).toBe('true')
    screen.container.querySelector('.anl-m__head .stage__leave').click()
    await vi.waitFor(() => expect(staged()).toBe('false'))
  })
})
