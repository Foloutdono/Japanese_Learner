import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { SOURCES, DEFAULT_SOURCE } from '../components/analysis/sources'
// Every case here asserts COMPUTED style — the whole point is pinning
// what ships, not what the JSX intends.
import '../index.css'

// ── The canvas contract (plans 073, 134) ──
// The owner's drawing is the specification for the result on a phone
// (plan 134, replacing plan 073's stage): the head, the video and its
// trimmed bar, the subtitles -- the next sentence over the current one
// and the previous under it -- the numbered grammar, Explain. The
// sentence is a line of tokens whose SRS state is a 2px rule under each
// word in the state's own ink (never an ink change on the word), a word
// tapped opens its dictionary card, a point its lesson, and Explain the
// explanation, each in the dictionary's sheet; the history is a section
// head over a framed row list. Each case below names the rule it pins,
// so a regression fails with the rule in the message.

const SENTENCES = [
  {
    text: '次の電車は三番線から発車します。',
    cue_start: null, cue_end: null, grammar: [
      // Written on から (offsets 8..10 of the text), as the local tier
      // reports it: the piece the light finds (plan 095).
      // The explanation below was bought, so the point carries the
      // model's line about it too (plan 095).
      { raw_id: 'g1', pattern: '〜から', level: 'N5', start: 8, end: 10, segments: [[8, 10]],
        note: 'Here から marks platform three as where the train departs from.' },
    ],
    unknown_count: 1, available: true, level: 'N2', off_deck_count: 0,
    explanation: 'から marks the origin — the train departs FROM platform three.',
    tokens: [
      // mastered → the mastered rule, ruby hidden in 'unknown' mode. The
      // entry carries the dictionary gloss the card shows under the
      // word before any deep tier is bought.
      { surface: '電車', start: 2, end: 4, reading: 'でんしゃ', pos: 'noun',
        furigana: [{ text: '電車', reading: 'でんしゃ' }],
        vocab_match: { entry: { meaning: 'electric train' }, stats: { status: 'mastered' }, level: 'N5', raw_id: 'v1' } },
      // particle, no vocab_match → no rule ever, and no reading (no kanji)
      { surface: 'は', start: 4, end: 5, reading: 'は', pos: 'particle',
        furigana: [{ text: 'は' }] },
      // learning → the learning rule
      { surface: '三番線', start: 5, end: 8, reading: 'さんばんせん', pos: 'noun',
        furigana: [{ text: '三番線', reading: 'さんばんせん' }],
        vocab_match: { entry: {}, stats: { status: 'learning' }, level: 'N4', raw_id: 'v2' } },
      // not yet started → the "new to you" rule, kanji squares on the card
      { surface: '発車', start: 10, end: 12, reading: 'はっしゃ', pos: 'noun',
        furigana: [{ text: '発車', reading: 'はっしゃ' }],
        vocab_match: { entry: {}, stats: { status: 'not_started' }, level: 'N3', raw_id: 'v3' },
        kanji_matches: [
          { kanji: '発', level: 'N3', raw_id: 'k1', entry: { meaning: 'depart' }, stats: { status: 'not_started' } },
          { kanji: '車', level: 'N5', raw_id: 'k2', entry: { meaning: 'vehicle' }, stats: { status: 'mastered' } },
        ] },
      // the particle the grammar point is written on: what its chip lights
      { surface: 'から', start: 8, end: 10, reading: 'から', pos: 'particle',
        furigana: [{ text: 'から' }] },
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

describe('the result on a phone (plan 134, the owner\'s drawing)', () => {
  beforeEach(async () => { await page.viewport(414, 900) })

  it('stands the head, the subtitles, the grammar and Explain, in that order, and nothing more', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const m = screen.container.querySelector('.anl-m')
    expect([...m.children].map(el => el.className.split(' ')[0]))
      .toEqual(['anl-m__head', 'anl-m__subs', 'anl-m__points', 'anl-explainbtn'])
    // The stage it replaced is gone: no stepper, no dials, no card, no
    // table, no legend, no key map, no ✕.
    expect(screen.container.querySelector('.anl-stepper, .anl-dials, .token-card, .anl-toktable, .anl-legend, .anl-kbd, .anl-clear')).toBeNull()
  })

  it('draws the next sentence over the current one and the previous under it, quieter and unlit', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const lines = () => [...screen.container.querySelectorAll('.anl-m__subs > .anl-m__line')]
    // On the first sentence: the next one above, no previous one below.
    expect(lines()[0].textContent).toBe('犬も好き。')
    expect(lines()[1].classList.contains('anl-m__line--none')).toBe(true)
    // Smaller than the current sentence, in the quieter ink, and no word
    // lit or ruled on it.
    const current = screen.container.querySelector('.anl-m__subs .tok')
    expect(parseFloat(getComputedStyle(lines()[0]).fontSize)).toBeLessThan(parseFloat(getComputedStyle(current).fontSize))
    expect(getComputedStyle(lines()[0]).color).toBe(resolver()('var(--text-secondary)'))
    expect(lines()[0].querySelector('.tok')).toBeNull()

    // A tap walks to it; the first sentence is now the one below.
    lines()[0].click()
    await settle()
    expect(screen.container.querySelector('.anl-m__subs .tok__word').textContent).toBe('犬')
    expect(lines()[0].classList.contains('anl-m__line--none')).toBe(true)
    expect(lines()[1].textContent).toBe(SENTENCES[0].text)
  })

  it('rules every word with a record, 2px, in its state ink — and never re-inks the word', async () => {
    const screen = await renderScreen()
    await analyze(screen)

    const [mastered, particle, learning, fresh] = tokens(screen)
    const resolve = resolver()
    for (const tok of [mastered, learning, fresh]) {
      expect(getComputedStyle(tok).borderBottomWidth).toBe('2px')
      expect(getComputedStyle(tok).borderBottomStyle).toBe('solid')
    }
    expect(getComputedStyle(mastered).borderBottomColor).toBe(resolve('var(--state-mastered)'))
    expect(getComputedStyle(learning).borderBottomColor).toBe(resolve('var(--state-learning)'))
    expect(getComputedStyle(fresh).borderBottomColor).toBe(resolve('var(--state-new)'))
    // A bare particle carries no rule.
    expect(getComputedStyle(particle).borderBottomColor).toBe('rgba(0, 0, 0, 0)')
    const inks = new Set([mastered, learning, fresh].map(tok => getComputedStyle(tok).color))
    expect(inks.size).toBe(1)
  })

  it('prints the reading only over the words the learner has not mastered', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const [mastered, , learning] = tokens(screen)
    expect(hidden(mastered.querySelector('.tok__furi'))).toBe(true)
    expect(hidden(learning.querySelector('.tok__furi'))).toBe(false)
    expect(learning.querySelector('.tok__furi').textContent).toBe('さんばんせん')
  })

  it('opens a word\'s dictionary card on a tap, and a particle\'s rule', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    tokens(screen)[0].click()
    await settle(100)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    document.querySelector('.dict-sheet__scrim').click()
    await settle(100)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    // は has no card and no marker here: a tap on it opens nothing.
    tokens(screen)[1].click()
    await settle(100)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('numbers each grammar point on its card and on its words, each card a door to its lesson', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    const card = screen.container.querySelector('.anl-m__points .bkd-point')
    expect(card.querySelector('.anl-num').textContent).toBe('1')
    expect(card.querySelector('.bkd-point__pattern').textContent).toBe('〜から')
    const frame = screen.container.querySelector('.anl-m__subs .anl-subs__pt')
    expect(frame.querySelector('.anl-subs__n').textContent).toBe('1')
    expect(frame.querySelector('.tok__word').textContent).toBe('から')
    card.click()
    await settle(100)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('opens the explanation in a sheet of the dictionary\'s shape, and closes it on Esc', async () => {
    const screen = await renderScreen()
    await analyze(screen)
    screen.container.querySelector('.anl-m__explain').click()
    await settle(100)
    const sheet = document.querySelector('.dict-sheet.anl-explainsheet[role="dialog"]')
    expect(sheet).not.toBeNull()
    expect(sheet.querySelector('.anl-explainsheet__jp').textContent).toBe(SENTENCES[0].text)
    // Bought already: no second call, the explanation printed.
    expect(sheet.querySelector('.anl-explainpanel__body').textContent).toBe(SENTENCES[0].explanation)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(100)
    expect(document.querySelector('.anl-explainsheet')).toBeNull()
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

  it('is not built at all below the split — the subtitles walk, the head keeps', async () => {
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
    // subtitles' next line walks the eight stops (plan 134)...
    expect(screen.container.querySelector('.anl-m__subs > .anl-m__line').textContent).toBe('文1です。')
    // ...and 保存, the one act only the rail could perform, is on the
    // head, at the size a thumb needs.
    const keep = screen.container.querySelector('.anl-head__keep')
    expect(keep).not.toBeNull()
    // Its laid-out height, not its box on screen: the result is still
    // sliding in (`arrive`, 0.28s) when this runs, and a box read
    // mid-slide is 44 give or take a float's rounding (43.999996 on
    // some frames).
    expect(parseFloat(getComputedStyle(keep).height)).toBeGreaterThanOrEqual(44)
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
