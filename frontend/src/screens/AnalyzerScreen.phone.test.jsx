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
// stage head, where it acts on the Sentence the stage is showing.
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
// The door lives in App, not in this tree: an unmocked board() would
// park the platform commit forever.
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
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

    // What replaces it was already there: the stepper walks the stops.
    expect(screen.container.querySelector('.anl-stepper__count').textContent)
      .toContain('1 / 2')
  })

  it('puts 保存 on the head as a real toggle at a thumb-sized target', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const keep = screen.container.querySelector('.anl-head .anl-head__keep')
    expect(keep).not.toBeNull()
    expect(keep.tagName).toBe('BUTTON')
    // A toggle, not a link that looks like one: the state is on the
    // control, so a screen reader hears it change...
    expect(keep.getAttribute('aria-pressed')).toBe('false')
    // ...and the glyph carries no name of its own, so the whole
    // sentence is the accessible one -- the rail pin's arrangement.
    expect(keep.getAttribute('aria-label')).toBeTruthy()
    // The mark is drawn, not typed: a text "+" beside the head's
    // stroked × is a 9px speck next to a 14px icon.
    expect(keep.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(keep.textContent).toBe('')
    const box = keep.getBoundingClientRect()
    expect(box.height, `the keep is ${box.height}px tall`).toBeGreaterThanOrEqual(44)
    expect(box.width, `the keep is ${box.width}px wide`).toBeGreaterThanOrEqual(44)
  })

  it('keeps the stop the stage is on, and lets it go again', async () => {
    const rows = statefulKeeps()
    const screen = await renderScreen()
    await analyze(screen)

    const keep = () => screen.container.querySelector('.anl-head__keep')
    // Walk to the second stop first: what gets kept is where you are,
    // not where the Passage starts.
    screen.container.querySelectorAll('.anl-stepper__btn')[1].click()
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
    screen.container.querySelectorAll('.anl-stepper__btn')[0].click()
    await settle(60)
    expect(keep().getAttribute('aria-pressed')).toBe('false')
    screen.container.querySelectorAll('.anl-stepper__btn')[1].click()
    await settle(60)
    expect(keep().getAttribute('aria-pressed')).toBe('true')
  })

  it('fits the head on 390px without a sideways scroll', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const head = screen.container.querySelector('.anl-head')
    expect(head.scrollWidth, 'the head overflows its own row')
      .toBeLessThanOrEqual(head.clientWidth + 1)
    expect(document.documentElement.scrollWidth)
      .toBeLessThanOrEqual(window.innerWidth + 1)
  })

  // ── The stage takes the screen (2026-09-11) ──
  // DESIGN.md, "The study stage on a phone": below 768px the viewport
  // IS the stage and the card grows into whatever is left under it.
  // The analyser's result ended 206px short of the bottom of an 844px
  // handset before this, with its one action floating mid-screen.
  it('spends the whole screen, with the deck action on the card floor', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const stage = screen.container.querySelector('.anl-stage')
    const bottom = stage.getBoundingClientRect().bottom
    // Within the frame's own bottom inset (--dock-bottom): no pool of
    // dead page under the result.
    expect(window.innerHeight - bottom, `${Math.round(window.innerHeight - bottom)}px of dead screen under the stage`)
      .toBeLessThanOrEqual(48)

    // The card took the slack rather than the page keeping it...
    const card = screen.container.querySelector('.token-card')
    const cardBox = card.getBoundingClientRect()
    expect(cardBox.height).toBeGreaterThan(200)
    // ...and the one action rides its floor, the full width of it.
    const mine = screen.container.querySelector('.token-card__foot .btn-primary')
    const mineBox = mine.getBoundingClientRect()
    expect(mineBox.width).toBeGreaterThan(cardBox.width * 0.8)
    expect(cardBox.bottom - mineBox.bottom, 'the action floats above the card floor')
      .toBeLessThanOrEqual(24)
  })

  it('keeps the dials at chip size, on one row each, captions aligned', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // Chip height (36px), not `seg--full`'s 40px bar: stacked twice
    // and full width, the dials were the heaviest thing on the stage
    // after the card, and were reported as such.
    const rows = getComputedStyle(screen.container.querySelector('.anl-dials'))
      .gridTemplateRows.split(' ').map(parseFloat)
    expect(rows.length, 'the two dials are not two grid rows').toBe(2)
    for (const row of rows) {
      expect(row, `a dial row is ${row}px tall`).toBeLessThanOrEqual(40)
    }

    // Nothing wraps inside a segment — the wrap is what made a row
    // grow past its chip in the first place, and it is why the
    // furigana dial's middle option is one word.
    for (const opt of screen.container.querySelectorAll('.anl-dial .seg__opt')) {
      expect(opt.getBoundingClientRect().height, `"${opt.textContent}" wraps inside its segment`)
        .toBeLessThanOrEqual(38)
    }

    // Both captions share one column, so both controls start at the
    // same x — FURIGANA is 65px wide and VUE 24, and as two separate
    // rows their segments began in two different places.
    const [a, b] = screen.container.querySelectorAll('.anl-dial .seg')
    expect(a.getBoundingClientRect().left).toBe(b.getBoundingClientRect().left)
    expect(a.getBoundingClientRect().width).toBe(b.getBoundingClientRect().width)
  })

  it('gives the page-width controls the page', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const stageWidth = screen.container.querySelector('.anl-stage').clientWidth

    // Explain is a full-width control under its hint, not a button
    // pinned to the right of one.
    const explain = screen.container.querySelector('.anl-explain__btn')
    expect(explain.getBoundingClientRect().width).toBeGreaterThan(stageWidth * 0.9)

    // Four legend keys, two by two — no row of three and an orphan.
    const legend = screen.container.querySelector('.anl-legend')
    expect(getComputedStyle(legend).display).toBe('grid')
    expect(getComputedStyle(legend).gridTemplateColumns.split(' ').length).toBe(2)
  })
})
