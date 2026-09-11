import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { SOURCES, DEFAULT_SOURCE } from '../components/analysis/sources'
// Every case here asserts COMPUTED style — the whole point is pinning
// what ships, not what the JSX intends.
import '../index.css'

// ── The canvas contract (plan 073) ──
// The "Japanese Learner Mobile" canvas's AnalyzerResult artboard is
// the specification for the result stage, taken literally: the
// sentence is a line of tokens whose SRS state is a 2px rule under
// each word in the state's own ink (never an ink change on the word),
// the focused token is a tint, the reading rides a word with kanji as
// a small line above it and the furigana dial governs it, the card
// under the line carries the gloss, the kanji squares and ONE deck
// action, the table is a real table, and the history is a section
// head over a framed row list. Each case below names the rule it
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
      // mastered → the mastered rule, ruby hidden in 'unknown' mode. The
      // entry carries the dictionary gloss the card shows under the
      // word before any deep tier is bought.
      { surface: '電車', reading: 'でんしゃ', pos: 'noun',
        furigana: [{ text: '電車', reading: 'でんしゃ' }],
        vocab_match: { entry: { meaning: 'electric train' }, stats: { status: 'mastered' }, level: 'N5', raw_id: 'v1' } },
      // particle, no vocab_match → no rule ever, and no reading (no kanji)
      { surface: 'は', reading: 'は', pos: 'particle',
        furigana: [{ text: 'は' }] },
      // learning → the learning rule
      { surface: '三番線', reading: 'さんばんせん', pos: 'noun',
        furigana: [{ text: '三番線', reading: 'さんばんせん' }],
        vocab_match: { entry: {}, stats: { status: 'learning' }, level: 'N4', raw_id: 'v2' } },
      // not yet started → the "new to you" rule, kanji squares on the card
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

// The screen opens on the text intake at its own route (plan 073): the
// three intakes are one segmented control over the page, text first.
async function renderScreen(entry = '/dictionary/analyzer') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(30)
  return screen
}

/** Which of the three platforms is lit on the intake's own control. */
function platform(screen) {
  const opts = [...screen.container.querySelectorAll('.anl-sources .seg__opt')]
  return SOURCES[opts.findIndex(o => o.classList.contains('seg__opt--on'))]?.key
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

function tokens(screen) {
  return [...screen.container.querySelectorAll('.tok-line .tok')]
}

// The two stage dials are segmented controls in the dials block:
// furigana first, then the view.
function segOptions(screen, which) {
  const idx = { furigana: 0, view: 1 }[which]
  return screen.container.querySelectorAll('.anl-dial .seg')[idx].querySelectorAll('.seg__opt')
}

// Resolve the palette the same way the page does, so an assertion
// holds in both themes.
function resolver() {
  const probe = document.createElement('div')
  document.body.appendChild(probe)
  return v => {
    probe.style.color = v
    return getComputedStyle(probe).color
  }
}

const hidden = el => {
  const cs = getComputedStyle(el)
  return cs.display === 'none' || cs.visibility === 'hidden'
}

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockResolvedValue({ sentences: SENTENCES, truncated: 0 })
  apiUpload.mockReset()
  apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
})

describe('the line (canvas: a sentence of tokens, not a readout)', () => {
  it('holds the tokens and nothing else — no badge row, no speaker, no grammar chips, no explanation', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const line = screen.container.querySelector('.tok-line')
    expect(line).not.toBeNull()
    expect(line.querySelector('.analysis-level-badge')).toBeNull()
    expect(line.querySelector('.anl-speak')).toBeNull()
    expect(line.querySelector('.analysis-grammar-chips')).toBeNull()
    expect(line.querySelector('.anl-explain__body')).toBeNull()
    // Every child is a token, and every token is the control.
    for (const child of line.children) {
      expect(child.classList.contains('tok'), child.className).toBe(true)
      expect(child.tagName).toBe('BUTTON')
    }
    expect(tokens(screen).length).toBe(SENTENCES[0].tokens.length)
  })

  it('rules every word with a record, 2px, in its state ink — and never re-inks the word', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const [mastered, particle, learning, fresh] = tokens(screen)
    const resolve = resolver()
    const stateMastered = resolve('var(--state-mastered)')
    const stateLearning = resolve('var(--state-learning)')
    const stateNew = resolve('var(--state-new)')

    for (const tok of [mastered, learning, fresh]) {
      expect(getComputedStyle(tok).borderBottomWidth).toBe('2px')
      expect(getComputedStyle(tok).borderBottomStyle).toBe('solid')
    }
    expect(getComputedStyle(mastered).borderBottomColor).toBe(stateMastered)
    expect(getComputedStyle(learning).borderBottomColor).toBe(stateLearning)
    expect(getComputedStyle(fresh).borderBottomColor).toBe(stateNew)
    // A bare particle carries no rule.
    expect(getComputedStyle(particle).borderBottomColor).toBe('rgba(0, 0, 0, 0)')

    // The state is the rule, not the word: the three inked words share
    // one ink (the particle alone steps back to the secondary ink).
    const inks = new Set([mastered, learning, fresh].map(tok => getComputedStyle(tok).color))
    expect(inks.size).toBe(1)
    expect(getComputedStyle(particle).color).not.toBe(getComputedStyle(mastered).color)
  })

  it('marks the focused token with a tint, not a weight change', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const on = screen.container.querySelector('.tok-line .tok--on')
    expect(on).not.toBeNull()
    const other = tokens(screen).find(tok => tok !== on)
    // Bolding the focused token reflows the whole line on every step.
    expect(getComputedStyle(on).fontWeight).toBe(getComputedStyle(other).fontWeight)
    expect(getComputedStyle(on).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(other).backgroundColor).toBe('rgba(0, 0, 0, 0)')

    // Tapping another word moves the tint with the focus.
    tokens(screen)[2].click()
    await settle(60)
    expect(screen.container.querySelectorAll('.tok-line .tok--on').length).toBe(1)
    expect(tokens(screen)[2].classList.contains('tok--on')).toBe(true)
  })

  it('prints the reading over a word with kanji only, and the furigana dial governs it', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const [mastered, particle, learning] = tokens(screen)
    expect(mastered.querySelector('.tok__furi').textContent).toBe('でんしゃ')
    // は already spells its own sound: the slot stays empty (and keeps
    // the line's baseline, so the words do not jump).
    expect(particle.querySelector('.tok__furi').textContent).toBe('')

    const furi = which => which.querySelector('.tok__furi')

    // All · Unknown · None — the canvas's three positions, in order.
    // The stage opens on Unknown (the reading only where it is still
    // needed), so All is a press away.
    const opts = segOptions(screen, 'furigana')
    expect(opts.length).toBe(3)
    expect(opts[1].getAttribute('aria-checked')).toBe('true')
    expect(hidden(furi(mastered)), 'the mastered word opens bare').toBe(true)
    opts[0].click()
    await settle(60)
    expect(hidden(furi(tokens(screen)[0]))).toBe(false)

    // 'Unknown' bares only the mastered word; a word still being
    // learned keeps its reading.
    opts[1].click()
    await settle(60)
    expect(hidden(furi(tokens(screen)[0])), 'mastered word keeps its furigana under Unknown').toBe(true)
    expect(hidden(furi(tokens(screen)[2])), 'learning word lost its furigana under Unknown').toBe(false)

    // 'None' hides every reading.
    opts[2].click()
    await settle(60)
    expect(hidden(furi(tokens(screen)[0]))).toBe(true)
    expect(hidden(furi(tokens(screen)[2]))).toBe(true)

    // And 'All' brings them all back.
    opts[0].click()
    await settle(60)
    expect(hidden(furi(tokens(screen)[0]))).toBe(false)
    expect(hidden(furi(tokens(screen)[2]))).toBe(false)
    expect(learning.isConnected).toBe(true)
  })
})

describe('the explanation (canvas: explain__body above the explain row)', () => {
  it('renders inside the explain panel, not inside the line', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const body = screen.container.querySelector('.anl-explain__body')
    expect(body).not.toBeNull()
    expect(body.closest('.anl-explainbox')).not.toBeNull()
    expect(body.closest('.tok-line')).toBeNull()
    // The canvas's rule: a 3px line of the station's pigment on its left.
    expect(getComputedStyle(body).borderLeftWidth).toBe('3px')
  })
})

describe('the token card (canvas: gloss, squares, one action)', () => {
  it('shows the dictionary translation under the word before any deep tier', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    // The focused token is 電車 (index 0 in this fixture) — its card
    // must carry the entry gloss.
    const gloss = screen.container.querySelector('.anl-stagebd .token-card__gloss')
    expect(gloss).not.toBeNull()
    expect(gloss.textContent).toBe('electric train')
  })

  it('rules the reading over its kanji — real ruby on the surface, the reading beside it', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const surface = screen.container.querySelector('.anl-stagebd .token-card__surface')
    const rt = surface.querySelector('rt')
    expect(rt).not.toBeNull()
    expect(rt.textContent).toBe('でんしゃ')
    expect(getComputedStyle(rt).display).not.toBe('none')
    expect(screen.container.querySelector('.anl-stagebd .token-card__reading').textContent).toBe('でんしゃ')
    // The word with a record is the door to its detail.
    expect(surface.tagName).toBe('BUTTON')
    expect(surface.classList.contains('token-card__surface--door')).toBe(true)
  })

  it('keeps each kanji square to its glyph — the whole square is the control, the meaning waits in its title', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    // Step to 発車 (4th token), the one with kanji — and let the card's
    // arrival (CardTransition's 0.34s) finish before measuring boxes.
    tokens(screen)[3].click()
    await settle(450)

    const squares = [...screen.container.querySelectorAll('.anl-stagebd .token-card__k')]
    expect(squares.length).toBe(2)
    expect(squares.map(k => k.textContent)).toEqual(['発', '車'])
    expect(squares.map(k => k.getAttribute('title'))).toEqual(['depart', 'vehicle'])
    for (const k of squares) {
      expect(k.tagName).toBe('BUTTON')
      expect(k.querySelector('.status-pill')).toBeNull()
      expect(k.querySelector('.analysis-mine-btn')).toBeNull()
      // A square, on the surface, framed — not a sumi box…
      const r = k.getBoundingClientRect()
      expect(Math.abs(r.width - r.height), `${r.width}×${r.height}`).toBeLessThan(1)
      expect(r.width).toBeGreaterThanOrEqual(30)
      expect(getComputedStyle(k).borderStyle).toBe('solid')
      // …and its glyph stays inside it.
      expect(k.scrollWidth).toBeLessThanOrEqual(k.clientWidth + 1)
    }
    // The row of squares stays inside the card.
    const row = screen.container.querySelector('.anl-stagebd .token-card__kanji')
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1)
  })

  it('offers the part of speech in the head and ONE deck action in the foot — no options, no pills', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    tokens(screen)[3].click()
    await settle(60)

    const card = screen.container.querySelector('.anl-stagebd .token-card')
    expect(card).not.toBeNull()
    // The cloze disclosure lives with the full controls in WordDetail,
    // not here; the line's rule already says the state.
    expect(card.querySelector('.anl-mine__options')).toBeNull()
    expect(card.querySelector('.status-pill')).toBeNull()

    const pos = card.querySelector('.token-card__head .token-card__pos')
    expect(pos).not.toBeNull()
    expect(pos.textContent).toBe('noun')

    const actions = card.querySelectorAll('.token-card__foot button:not(.token-card__k)')
    expect(actions.length).toBe(1)
    // The one filled action of the card, in the screen's gold — the
    // canvas's button, not the analyser's old quiet control.
    expect(actions[0].classList.contains('btn-primary')).toBe(true)
    expect(actions[0].classList.contains('analysis-mine-btn')).toBe(false)
    const resolve = resolver()
    expect(getComputedStyle(actions[0]).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(actions[0]).color).toBe(resolve('var(--text-on-panel)'))
  })
})

describe('the token table (canvas: a real table, not the list layout)', () => {
  it('switches the stage to a Word/Reading/Meaning/State grid and back', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const viewOpts = segOptions(screen, 'view')
    expect(viewOpts.length).toBe(2)
    viewOpts[1].click()
    await settle(60)

    const table = screen.container.querySelector('.anl-toktable')
    expect(table).not.toBeNull()
    // The old list layout must NOT be what renders here.
    expect(screen.container.querySelector('.phrase-words-list')).toBeNull()
    expect(screen.container.querySelector('.status-legend')).toBeNull()
    expect(screen.container.querySelector('.anl-stagebd .token-card')).toBeNull()

    // One row per token, plus the head.
    expect(table.querySelectorAll('.anl-trow').length).toBe(SENTENCES[0].tokens.length + 1)
    // Reading and state land in their columns.
    expect(table.textContent).toContain('でんしゃ')
    expect(table.querySelectorAll('.anl-trow .status-pill').length).toBe(3)

    // The line stays above the table — the table replaces the card,
    // not the stage.
    expect(screen.container.querySelector('.tok-line')).not.toBeNull()

    // A surface click focuses that token and returns to the card.
    table.querySelectorAll('.anl-trow__surface')[2].click()
    await settle(60)
    expect(screen.container.querySelector('.anl-toktable')).toBeNull()
    expect(screen.container.querySelector('.anl-stagebd .token-card')).not.toBeNull()
    // toContain, not toBe: the surface carries its reading as ruby, so
    // textContent is base + rt.
    expect(screen.container.querySelector('.token-card__surface').textContent).toContain('三番線')
    expect(tokens(screen)[2].classList.contains('tok--on')).toBe(true)
  })
})

describe('the stage rhythm, the stepper and the dials', () => {
  it('breathes: line, card and dials are separated by the stage gap', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const bd = screen.container.querySelector('.anl-stagebd')
    expect(parseFloat(getComputedStyle(bd).rowGap)).toBeGreaterThanOrEqual(12)
  })

  it('counts the stops and steps through them', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const count = () => screen.container.querySelector('.anl-stepper__count').textContent.replace(/\s+/g, ' ').trim()
    expect(count()).toMatch(/^1 \/ 2/)
    // A stop per sentence, the ones reached filled.
    expect(screen.container.querySelectorAll('.anl-stops__dot').length).toBe(2)
    expect(screen.container.querySelectorAll('.anl-stops__dot--on').length).toBe(1)

    const [prev, next] = screen.container.querySelectorAll('.anl-stepper__btn')
    expect(prev.disabled).toBe(true)
    next.click()
    await settle(60)
    expect(count()).toMatch(/^2 \/ 2/)
    expect(screen.container.querySelectorAll('.anl-stops__dot--on').length).toBe(2)
    expect(screen.container.querySelectorAll('.anl-stepper__btn')[1].disabled).toBe(true)
    // The line now holds the second sentence's tokens.
    expect(tokens(screen).length).toBe(SENTENCES[1].tokens.length)
  })

  it('labels the dials with the caption register and draws them as segmented controls', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const dials = screen.container.querySelectorAll('.anl-dial')
    expect(dials.length).toBe(2)
    for (const dial of dials) {
      expect(dial.querySelector('.anl-dial__cap')).not.toBeNull()
      expect(dial.querySelector('.seg[role="radiogroup"]')).not.toBeNull()
    }
  })
})

describe('the route line (the working rail, and the widths it answers for)', () => {
  it('never lies down as a horizontal strip — beside the stage, the vertical route map', async () => {
    // Explicitly WIDE: since 2026-09-11 the rail is built at 1100px and
    // up only, and the strip was the other answer to the same question,
    // so this is now the width where its absence means something.
    await page.viewport(1280, 900)
    const screen = await renderScreen()
    await analyze(screen)

    expect(screen.container.querySelector('.anl-line--strip')).toBeNull()
    const line = screen.container.querySelector('.anl-line')
    expect(line).not.toBeNull()
    expect(getComputedStyle(line).flexDirection).toBe('column')
    // The pin rides every row, never hidden by an orientation.
    expect(screen.container.querySelectorAll('.anl-keep').length).toBe(2)
  })

  it('is not built at all below the split — the stepper walks, the head keeps', async () => {
    // The rail used to stack above the stage here as a ~170px window.
    // A long Passage is the case that made it wrong: eight stops of
    // scroller, a search field and a bulk pin standing between the
    // learner and the sentence they opened the screen for.
    await page.viewport(500, 900)
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

    // Not hidden — absent. A control the learner cannot see has no
    // business in the tab order or the accessibility tree.
    expect(screen.container.querySelector('.anl-railcol')).toBeNull()
    expect(screen.container.querySelector('.anl-line')).toBeNull()
    expect(screen.container.querySelectorAll('.anl-stop').length).toBe(0)
    expect(screen.container.querySelectorAll('.anl-keep').length).toBe(0)

    // What the rail was doing is done by two things that stay: the
    // stepper walks the eight stops...
    expect(screen.container.querySelector('.anl-stepper__count').textContent).toContain('1 / 8')
    // ...and 保存, the one act only the rail could perform, is on the
    // head, at the size a thumb needs.
    const keep = screen.container.querySelector('.anl-head__keep')
    expect(keep).not.toBeNull()
    expect(keep.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })
})

describe('the history (canvas: a section head over a framed row list)', () => {
  it('draws the head outside the list and pads every row', async () => {
    // A row to measure: the history fetch must return one passage
    // (apiFetch, raw Response shape — see useAnalyzerSession.fetchHistory).
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (typeof path === 'string' && path.includes('/phrase/history')
        ? [{ id: 1, phrase: '駅前の掲示板。', kept: true, source: 'typed', created_at: '2026-09-01T00:00:00Z' }]
        : []),
    }))
    const screen = await renderScreen()
    await settle(120)

    // The canvas's shape: the head is a sibling ABOVE the framed list,
    // never inside it.
    const history = screen.container.querySelector('.anl-history')
    expect(history).not.toBeNull()
    const list = history.querySelector('.anl-hist-list')
    expect(list).not.toBeNull()
    expect(list.querySelector('.head2')).toBeNull()
    expect(history.querySelector('.head2')).not.toBeNull()

    const cs = getComputedStyle(list)
    expect(cs.borderTopStyle).toBe('solid')
    expect(parseFloat(cs.borderTopLeftRadius)).toBeGreaterThan(0)

    // The row carries the canvas's padding (sp-3 sp-4): nothing sits
    // flush against the frame, and the row is a real target.
    const row = list.querySelector('.anl-hist')
    expect(row).not.toBeNull()
    const rs = getComputedStyle(row)
    expect(parseFloat(rs.paddingLeft), `row padding-left is ${rs.paddingLeft}`).toBeGreaterThanOrEqual(12)
    expect(parseFloat(rs.paddingTop), `row padding-top is ${rs.paddingTop}`).toBeGreaterThanOrEqual(8)
    expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)

    // The Kept mark holds its word on one line inside its own frame.
    const kept = row.querySelector('.anl-kept')
    expect(kept).not.toBeNull()
    expect(kept.scrollWidth).toBeLessThanOrEqual(kept.clientWidth + 1)
    expect(kept.scrollHeight).toBeLessThanOrEqual(kept.clientHeight + 1)
  })

  // ── ?intake= — the door's deep link ──
  // The dictionary draws the three platforms on the analyzer's row, and
  // a tap on the camera there means "open standing on 写真", not "open
  // on 文字 with the camera one tap further in". A platform is a mode of
  // this one screen, so it travels as a query, read once on mount.
  it('opens on the platform the door sent it to, and on 文字 without one', async () => {
    const screen = await renderScreen('/dictionary/analyzer?intake=video')
    expect(platform(screen)).toBe('video')
  })

  it('ignores an intake that is not a platform', async () => {
    const screen = await renderScreen('/dictionary/analyzer?intake=hovercraft')
    expect(platform(screen)).toBe(DEFAULT_SOURCE)
  })
})
