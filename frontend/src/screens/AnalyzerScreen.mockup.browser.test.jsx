import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// Every case here asserts COMPUTED style — the whole point is pinning
// what ships, not what the JSX intends.
import '../index.css'

// ── The mockup contract (2026-09-01) ──
// The "Analyzer redesign · final" artifact is the specification for
// this screen, taken literally at the maintainer's direction: the
// sentence pane is a sentence (no badges, no speaker, no grammar
// chips inside it), SRS status is a 2px underline on exactly the
// words still being learned, the token table is a real table, kanji
// chips hold a glyph and its grade and nothing else, the history
// panel is padded like every other panel, and nothing in the stage
// is an unexplained oval. Each case below names the mockup rule it
// pins, so a regression fails with the rule in the message.

const SENTENCES = [
  {
    text: '次の電車は三番線から発車します。',
    cue_start: null, cue_end: null, grammar: [
      { raw_id: 'g1', pattern: '〜から', level: 'N5', start: 0, end: 2 },
    ],
    unknown_count: 1, available: true, level: 'N2', off_deck_count: 0,
    explanation: 'から marks the origin — the train departs FROM platform three.',
    tokens: [
      // mastered → no underline, ruby hidden in 'unknown' mode. The
      // entry carries the dictionary gloss the card shows under the
      // word before any deep tier is bought.
      { surface: '電車', reading: 'でんしゃ', pos: 'noun',
        furigana: [{ text: '電車', reading: 'でんしゃ' }],
        vocab_match: { entry: { meaning: 'electric train' }, stats: { status: 'mastered' }, level: 'N5', raw_id: 'v1' } },
      // particle, no vocab_match → no underline ever
      { surface: 'は', reading: 'は', pos: 'particle',
        furigana: [{ text: 'は' }] },
      // learning → the learning underline
      { surface: '三番線', reading: 'さんばんせん', pos: 'noun',
        furigana: [{ text: '三番線', reading: 'さんばんせん' }],
        vocab_match: { entry: {}, stats: { status: 'learning' }, level: 'N4', raw_id: 'v2' } },
      // not yet started → the "new to you" underline, kanji chips on the card
      { surface: '発車', reading: 'はっしゃ', pos: 'noun',
        furigana: [{ text: '発車', reading: 'はっしゃ' }],
        vocab_match: { entry: {}, stats: { status: 'not_started' }, level: 'N3', raw_id: 'v3' },
        kanji_matches: [
          { kanji: '発', level: 'N3', raw_id: 'k1', entry: { meaning: 'depart' }, stats: { status: 'not_started' } },
          { kanji: '車', level: 'N5', raw_id: 'k2', entry: { meaning: 'vehicle' }, stats: { status: 'mastered' } },
        ] },
    ],
  },
  {
    text: '犬も好き。', cue_start: null, cue_end: null, grammar: [],
    unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
    tokens: [{ surface: '犬', reading: 'いぬ', pos: 'noun',
      furigana: [{ text: '犬', reading: 'いぬ' }],
      vocab_match: { entry: {}, stats: { status: 'mastered' }, level: 'N5', raw_id: 'v9' } }],
  },
]

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({
    decks: [], mineApp: vi.fn().mockResolvedValue(1), mineCloze: vi.fn(),
    targetFor: () => ({ id: 7 }), decksFor: () => [], ensureDeck: vi.fn(),
  }),
}))
vi.mock('../components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { apiJson, apiUpload, apiFetch } = await import('../lib/api')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function renderGate() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(30)
  return screen
}

async function renderScreen() {
  const screen = await renderGate()
  screen.container.querySelector('.platform-card').click()
  await settle(30)
  return screen
}

function typeInto(el, text) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function analyze(screen) {
  typeInto(screen.container.querySelector('textarea'), '次の電車は三番線から発車します。犬も好き。')
  screen.container.querySelector('.anl-action').click()
  await settle(150)
}

function tokenButtons(screen) {
  return [...screen.container.querySelectorAll('.anl-sentence__tk')]
}

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockResolvedValue({ sentences: SENTENCES, truncated: 0 })
  apiUpload.mockReset()
  apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
})

describe('the sentence pane (mockup: a sentence, not a readout)', () => {
  it('holds the Japanese line and nothing else — no badge row, no speaker, no grammar chips, no explanation', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const pane = screen.container.querySelector('.anl-sentence')
    expect(pane).not.toBeNull()
    expect(pane.querySelector('.analysis-level-badge')).toBeNull()
    expect(pane.querySelector('.anl-speak')).toBeNull()
    expect(pane.querySelector('.analysis-grammar-chips')).toBeNull()
    expect(pane.querySelector('.rdg-breakdown-explanation')).toBeNull()
  })

  it('underlines exactly the words still being learned, 2px, in the state colour', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const [mastered, particle, learning, fresh] = tokenButtons(screen)

    // Resolve the palette the same way the page does, so the assertion
    // holds in both themes.
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const resolve = v => {
      probe.style.color = v
      return getComputedStyle(probe).color
    }
    const kaiseki = resolve('var(--line-kaiseki)')
    const grey = resolve('var(--text-secondary)')

    // The two words with work left to do carry the rule…
    const learningStyle = getComputedStyle(learning)
    const freshStyle = getComputedStyle(fresh)
    expect(learningStyle.borderBottomWidth).toBe('2px')
    expect(freshStyle.borderBottomWidth).toBe('2px')
    // …a word never met runs in the line's own grape, full strength
    // (the mockup's tk--new)…
    expect(freshStyle.borderBottomColor).toBe(kaiseki)
    // …a word being learned in the translucent ember (tk--learning),
    // and NEITHER in the grey that made the line read as a diagnostic.
    expect(learningStyle.borderBottomColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(learningStyle.borderBottomColor).not.toBe(freshStyle.borderBottomColor)
    expect(learningStyle.borderBottomColor).not.toBe(grey)
    expect(freshStyle.borderBottomColor).not.toBe(grey)

    // A mastered word and a bare particle carry none.
    expect(getComputedStyle(mastered).borderBottomColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(particle).borderBottomColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('lets the ruby breathe — the mockup line height, not a cramped one', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const line = screen.container.querySelector('.anl-sentence__jp')
    const cs = getComputedStyle(line)
    // Mockup .sent__jp: line-height 2.3. Anything under ~2.2 stacks the
    // ruby into the line above it.
    expect(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toBeGreaterThanOrEqual(2.2)
  })

  it('reads as running text: words flow inline and the rule hugs the word', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const line = screen.container.querySelector('.anl-sentence__jp')
    // The mockup's sentence is a PARAGRAPH — not a flex row that spaces
    // every token apart and stretches each one to the full line box.
    expect(getComputedStyle(line).display).toBe('block')

    // Each token's box hugs its glyphs (plus ruby), so the 2px rule and
    // the focus tint sit right under/around the word instead of floating
    // at the bottom of a 2.3-line-height box.
    const fs = parseFloat(getComputedStyle(line).fontSize)
    const focused = screen.container.querySelector('.anl-sentence__tk--focus')
    expect(focused.getBoundingClientRect().height, 'token box must hug its text').toBeLessThan(fs * 2)
  })

  it('marks the focused token with a tint, not a weight change', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const focused = screen.container.querySelector('.anl-sentence__tk--focus')
    expect(focused).not.toBeNull()
    // Bolding the focused token reflows the whole line on every step.
    expect(getComputedStyle(focused).fontWeight).toBe(getComputedStyle(tokenButtons(screen)[1]).fontWeight)
    expect(getComputedStyle(focused).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})

describe('the explanation (mockup: explain__body above the explain row)', () => {
  it('renders inside the explain panel, not inside the sentence pane', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const body = screen.container.querySelector('.anl-explain__body')
    expect(body).not.toBeNull()
    expect(body.closest('.anl-explainbox')).not.toBeNull()
    expect(body.closest('.anl-sentence')).toBeNull()
    // The mockup's rule: a 3px line of the station's pigment on its left.
    expect(getComputedStyle(body).borderLeftWidth).toBe('3px')
  })
})

describe('the token card (mockup: clean chips, no ovals)', () => {
  it('keeps each kanji chip to its glyph and grade — no badge, no button stuffed inside', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // Step to 発車 (4th token), the one with kanji.
    tokenButtons(screen)[3].click()
    await settle(60)

    const chips = [...screen.container.querySelectorAll('.anl-stagebd .phrase-kanji-chip')]
    expect(chips.length).toBe(2)
    for (const chip of chips) {
      expect(chip.querySelector('.status-pill')).toBeNull()
      expect(chip.querySelector('.analysis-mine-btn')).toBeNull()
      // The chip sits on the surface, framed — not a sumi box.
      const cs = getComputedStyle(chip)
      expect(cs.borderStyle).toBe('solid')
      // …and its content stays inside it.
      expect(chip.scrollWidth).toBeLessThanOrEqual(chip.clientWidth + 1)
    }
    // The mockup chip pairs the glyph with its MEANING (番 number),
    // not with a grade the detail sheet already carries.
    expect(chips[0].textContent).toContain('depart')
    expect(chips[1].textContent).toContain('vehicle')
    // The row of chips stays inside the card.
    const row = screen.container.querySelector('.anl-stagebd .phrase-word-card__kanji-row')
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1)
  })

  it('lays pos, state and the one deck action on a single row — no OPTIONS, no dotted rule', async () => {
    // Desktop width — the mockup's reference drawing. (On a phone the
    // row is allowed to wrap; that is flex-wrap doing its job.)
    await page.viewport(1280, 900)
    const screen = await renderScreen()
    await analyze(screen)
    tokenButtons(screen)[3].click()
    await settle(60)

    // The mockup card offers ONE action: Add to deck. The cloze
    // disclosure lives with the full controls in WordDetail, not here.
    expect(screen.container.querySelector('.anl-stagebd .anl-mine__options')).toBeNull()
    const row = screen.container.querySelector('.anl-stagebd .anl-tokrow')
    expect(row).not.toBeNull()
    const pos = row.querySelector('.phrase-word-card__pos')
    const badge = row.querySelector('.status-pill')
    const mine = row.querySelector('.analysis-mine-btn')
    expect(pos).not.toBeNull()
    expect(badge).not.toBeNull()
    expect(mine).not.toBeNull()
    // One ROW: the three share a horizontal band instead of stacking.
    const centers = [pos, badge, mine].map(el => {
      const r = el.getBoundingClientRect()
      return r.top + r.height / 2
    })
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(12)

    // And the surface carries no dotted underline — that is the list
    // layout's affordance, not the mockup card's.
    const surface = screen.container.querySelector('.anl-stagebd .phrase-word-card__surface')
    expect(getComputedStyle(surface).textDecorationLine).toBe('none')
  })

  it('draws no pill-shaped control anywhere on the stage', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // Every control on the stage is a plate or a card corner (≤ 8px)
    // except the two the mockup itself rounds fully: the segmented
    // dials and the stepper dots.
    const allowed = ['anl-seg__opt', 'anl-stagebd__dot']
    for (const btn of screen.container.querySelectorAll('.anl-stage button')) {
      if (allowed.some(c => btn.classList.contains(c))) continue
      const r = getComputedStyle(btn).borderTopLeftRadius
      const px = parseFloat(r)
      expect(px, `${btn.className} has radius ${r}`).toBeLessThanOrEqual(8)
    }
  })
})

describe('the token table (mockup: a real table, not the list layout)', () => {
  it('switches the stage to a Word/Reading/Meaning/State grid and back', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const viewOpts = screen.container
      .querySelector('[aria-labelledby="anl-view-label"]')
      .querySelectorAll('.anl-seg__opt')
    viewOpts[1].click()
    await settle(60)

    const table = screen.container.querySelector('.anl-toktable')
    expect(table).not.toBeNull()
    // The old list layout must NOT be what renders here.
    expect(screen.container.querySelector('.phrase-words-list')).toBeNull()
    expect(screen.container.querySelector('.status-legend')).toBeNull()

    // One row per token, plus the head.
    expect(table.querySelectorAll('.anl-trow').length).toBe(SENTENCES[0].tokens.length + 1)
    // Reading and state land in their columns.
    expect(table.textContent).toContain('でんしゃ')
    expect(table.querySelectorAll('.anl-trow .status-pill').length).toBe(3)

    // The sentence pane stays above the table — the table replaces the
    // card, not the stage.
    expect(screen.container.querySelector('.anl-sentence')).not.toBeNull()

    // A surface click focuses that token and returns to the stepper.
    table.querySelectorAll('.anl-trow__surface')[2].click()
    await settle(60)
    expect(screen.container.querySelector('.anl-toktable')).toBeNull()
    expect(screen.container.querySelector('.rdg-breakdown-card-row')).not.toBeNull()
    // toContain, not toBe: the stage surface carries its reading as
    // ruby, so textContent is base + rt.
    expect(screen.container.querySelector('.phrase-word-card__surface').textContent).toContain('三番線')
  })
})

describe('the stage rhythm and dials', () => {
  it('breathes: pane, dials and card are separated by the stage gap', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    // The pane, the dials row and the card row are children of the
    // stage breakdown — a real gap between them, not touching bands.
    const bd = screen.container.querySelector('.anl-stagebd')
    expect(parseFloat(getComputedStyle(bd).rowGap)).toBeGreaterThanOrEqual(14)
  })

  it('labels the dials the mockup way — words, not tracked micro-caps', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const label = screen.container.querySelector('.anl-stagectl__label')
    const cs = getComputedStyle(label)
    expect(cs.textTransform).toBe('none')
    // fs-caption (0.72rem ≈ 11.5px), not the 0.62rem micro-caption.
    expect(parseFloat(cs.fontSize)).toBeGreaterThanOrEqual(11)
  })
})

describe('the token card content', () => {
  it('shows the dictionary translation under the word before any deep tier', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    // Focused token is 電車 after stepping once (index 0 = 電車 in this
    // fixture) — its card must carry the entry gloss.
    const meaning = screen.container.querySelector('.anl-stagebd .phrase-word-card__meaning')
    expect(meaning.textContent).toBe('electric train')
  })

  it('rules the reading over its kanji — real ruby, not a spaced line above the word', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const surface = screen.container.querySelector('.anl-stagebd .phrase-word-card__surface')
    // The reading rides the word as ruby, per-kanji, exactly like the
    // sentence pane above it…
    const rt = surface.querySelector('rt')
    expect(rt).not.toBeNull()
    expect(rt.textContent).toBe('でんしゃ')
    expect(getComputedStyle(rt).display).not.toBe('none')
    // …and the old detached reading line is gone from the stage card.
    expect(screen.container.querySelector('.anl-stagebd .phrase-word-card__reading')).toBeNull()
  })

  it('makes the whole kanji chip the control, not just the glyph', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    tokenButtons(screen)[3].click()
    await settle(60)
    const chips = [...screen.container.querySelectorAll('.anl-stagebd .phrase-kanji-chip')]
    expect(chips.length).toBe(2)
    for (const chip of chips) {
      expect(chip.tagName).toBe('BUTTON')
    }
  })
})

describe('the route line (mockup: always the vertical line)', () => {
  it('never lies down as a horizontal strip — any width, the vertical route map', async () => {
    // Explicitly NARROW: the strip was exactly the narrow-viewport
    // rendering, so this is the width where its absence means something.
    await page.viewport(500, 900)
    const screen = await renderScreen()
    await analyze(screen)

    // The mockup has exactly one drawing of the Passage: the vertical
    // line with a stop per Sentence and the pin beside it. The
    // stopping-pattern band is retired.
    expect(screen.container.querySelector('.anl-line--strip')).toBeNull()
    const line = screen.container.querySelector('.anl-line')
    expect(line).not.toBeNull()
    expect(getComputedStyle(line).flexDirection).toBe('column')
    // The pin rides every row, never hidden by an orientation.
    expect(screen.container.querySelectorAll('.anl-keep').length).toBe(2)
  })

  it('shows about three stops on a phone and scrolls the rest inside the line', async () => {
    await page.viewport(500, 900)
    // A long Passage: eight stops, so the cap has something to cap.
    apiJson.mockResolvedValue({
      truncated: 0,
      sentences: Array.from({ length: 8 }, (_, i) => ({
        text: `文${i}です。`, cue_start: null, cue_end: null, grammar: [],
        unknown_count: 0, available: true, level: 'N5', off_deck_count: 0,
        tokens: [{ surface: `文${i}`, pos: 'noun', furigana: [{ text: `文${i}` }] }],
      })),
    })
    const screen = await renderScreen()
    await analyze(screen)

    const line = screen.container.querySelector('.anl-line')
    expect(screen.container.querySelectorAll('.anl-stop').length).toBe(8)
    // The line's viewport holds ~3 rows; the rest scroll within it
    // instead of burying the stage under 47 rows of rail.
    expect(line.clientHeight, `line is ${line.clientHeight}px tall`).toBeLessThanOrEqual(240)
    expect(line.scrollHeight).toBeGreaterThan(line.clientHeight)
    expect(getComputedStyle(line).overflowY).toBe('auto')
  })
})

describe('the history (mockup: a section head over a framed row list)', () => {
  it('draws the head outside the panel and pads every row', async () => {
    // A row to measure: the history fetch must return one passage
    // (apiFetch, raw Response shape — see useAnalyzerSession.fetchHistory).
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (typeof path === 'string' && path.includes('/phrase/history')
        ? [{ id: 1, phrase: '駅前の掲示板。', kept: true, source: 'typed', created_at: '2026-09-01T00:00:00Z' }]
        : []),
    }))
    const screen = await renderGate()
    await settle(120)

    // The mockup's shape: the History head is a sibling ABOVE the framed
    // list, never inside it.
    const hist = screen.container.querySelector('.anl-concourse .anl-hist')
    expect(hist).not.toBeNull()
    expect(hist.querySelector('.anl-history__head')).toBeNull()
    expect(screen.container.querySelector('.anl-concourse .anl-history__head')).not.toBeNull()

    const cs = getComputedStyle(hist)
    expect(cs.borderTopStyle).toBe('solid')
    expect(parseFloat(cs.borderTopLeftRadius)).toBeGreaterThan(0)

    // The row carries the mockup's padding (sp-4 sp-5): nothing sits
    // flush against the frame.
    const row = hist.querySelector('.anl-history__open')
    expect(row).not.toBeNull()
    const rs = getComputedStyle(row)
    expect(parseFloat(rs.paddingLeft), `row padding-left is ${rs.paddingLeft}`).toBeGreaterThanOrEqual(16)
    expect(parseFloat(rs.paddingTop), `row padding-top is ${rs.paddingTop}`).toBeGreaterThanOrEqual(12)

    // The 保存 stamp holds its two glyphs on one line inside its own
    // frame — it was an 18×18 box with the kanji spilling out of it.
    const stamp = hist.querySelector('.anl-history__kept')
    expect(stamp).not.toBeNull()
    expect(stamp.scrollWidth).toBeLessThanOrEqual(stamp.clientWidth + 1)
    expect(stamp.scrollHeight).toBeLessThanOrEqual(stamp.clientHeight + 1)
  })
})
