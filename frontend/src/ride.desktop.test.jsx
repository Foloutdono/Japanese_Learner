import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the first ride at a desk (plans 122, 132) ──────────────────
// The two cards and the reading ride, from the keys alone: Space turns
// a card, a digit rates it, and Enter goes on from the ride's end --
// the key its Continue prints (P8). Since plan 132 both rides stand on
// the runs' three panels and walk the learner round them first (the
// guide, handed components/guide/rideTours' stops; P11, P12). The
// phone's side is ride.phone.test.jsx.

const apiJson = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
const summary = vi.hoisted(() => ({ current: { kanaKnown: 'both', dailyNewTarget: 10 } }))
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => summary.current,
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 200, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: RideRun } = await import('./screens/RideRun')
const { default: RideReading } = await import('./screens/RideReading')

// A new card's forecast, as the ride serves it (plan 132).
const FORECAST = Object.fromEntries([60, 180, 180, 390, 600, 3600].map((due_in, q) => [String(q), { due_in }]))
const KNOWN = {
  card_id: 'vocab_N3__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N3', romaji: 'konnichiwa',
  stage: null, review_preview: FORECAST, hints: {},
}
const UNKNOWN = {
  card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki',
  stage: null, review_preview: FORECAST, hints: { indice_3: [{ text: '駅', reading: 'えき' }] },
}
const SENTENCE = {
  phrase: '駅で友だちに会います。', romaji: 'eki de tomodachi ni aimasu.',
  translation: 'I meet a friend at the station.', translation_lang: 'en',
  display_seconds: 0.4, grammar: 'で',
}

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
// After a rating: the next card up, turned face down (its Space hint
// printed), or the done room -- and the rated card gone with its docked
// entry. It comes after the ride's hold (420ms) and the old card's way
// out (220ms), so it is waited for, not guessed: a fixed 650ms left a
// loaded CI runner 10ms, and a Space pressed inside the hold is lost.
const nextCard = () => vi.waitFor(() => {
  expect($('.desk-run__side .desk-entry')).toBeNull()
  expect($('.ride__done') ?? $('.flashcard__hint .desk-kbd')).not.toBeNull()
}, { timeout: 3000 })
const posts = () => apiJson.mock.calls.filter(([, , init]) => init?.method === 'POST')
const ok = body => ({ ok: true, status: 200, json: async () => body })
const ANALYSIS = {
  text: '駅で友だちに会います。', level: 'N5', available: true, grammar: [], unknown_count: 0, off_deck_count: 0,
  tokens: [{
    surface: '駅', reading: 'えき', meaning: 'station', pos: 'noun', furigana: [{ text: '駅', reading: 'えき' }], kanji_matches: [],
    vocab_match: { level: 'N5', raw_id: 'vocab_N5_駅_えき', entry: { word: '駅', kanji: '駅', kana: 'えき', meaning: 'station' }, stats: { status: 'new' } },
  }],
}

const ENTRIES = {
  こんにちは: { type: 'vocab', kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N5', senses: [], examples: [] },
  駅: { type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', senses: [], examples: [] },
}
beforeEach(() => {
  summary.current = { kanaKnown: 'both', dailyNewTarget: 10 }
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const q = new URLSearchParams(String(url).split('?')[1] ?? '').get('q')
    if (String(url) === '/api/phrase/analyze') return ok(ANALYSIS)
    const e = String(url).startsWith('/api/dictionary') && ENTRIES[q]
    return ok({ results: e ? [e] : [] })
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async (url, _s, init) => {
    if (String(url).startsWith('/api/onboarding/ride?')) return { cards: [KNOWN, UNKNOWN], sentence: SENTENCE }
    if (String(url) === '/api/onboarding/ride/check') return { accuracy: 100, matched: 'romaji' }
    if (String(url) === '/api/onboarding/ride/done') return { tutorialAt: 'x', skipped: JSON.parse(init.body).skipped }
    return {}
  })
  localStorage.clear()
})

function mount(element, at) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">today</div>} />
          <Route path="/ride/reading" element={<div className="reading-probe">reading</div>} />
          <Route path={at} element={element} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

/** The walk open over the run, if any: its stop's anchor. */
const walkStop = () => $('.guide')?.dataset.stop ?? null
const $$ = s => [...document.querySelectorAll(s)]
/** Walk every stop with →, collecting their anchors. */
async function walk() {
  const seen = []
  await vi.waitFor(() => expect(walkStop()).not.toBeNull(), { timeout: 3000 })
  for (let i = 0; i < 12 && walkStop(); i++) {
    seen.push(walkStop())
    await userEvent.keyboard('{ArrowRight}')
    await settle(60)
  }
  return seen
}
/** Decline a walk: Esc is the guide's Skip. */
async function skipWalk() {
  await vi.waitFor(() => expect(walkStop()).not.toBeNull(), { timeout: 3000 })
  await userEvent.keyboard('{Escape}')
  await settle(80)
}

/** Both cards turned and rated from the keys: Space, then '1'. */
async function rideTheCards() {
  for (let i = 0; i < 2; i++) {
    await userEvent.keyboard(' ')
    await settle(120)
    await userEvent.keyboard('1')
    await nextCard()
  }
}

describe('the ride\'s ends on the desk (P8)', () => {
  it('goes on from the cards\' end on Enter, the key printed on Continue', async () => {
    const onNext = vi.fn()
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={onNext} />, '/ride/cards')
    await settle(250)
    await skipWalk()
    await rideTheCards()
    const go = $('.ride__done-foot .btn-depart')
    expect(go, 'the ride reached its end').toBeTruthy()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(go.querySelector('.desk-kbd')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('stamps the lesson from the plate on Enter', async () => {
    const onDone = vi.fn()
    await mount(<RideReading session={{ access_token: 'tok' }} onDone={onDone} />, '/ride/reading-run')
    await settle(250)
    await skipWalk()
    await settle(700)
    $('form.stage__foot input').focus()
    await userEvent.keyboard('eki de tomodachi ni aimasu{Enter}')
    await settle(250)
    await userEvent.keyboard('1')
    await settle(250)
    await skipWalk()
    // Graded: Continue goes on to the plate, on Enter too.
    await userEvent.keyboard('{Enter}')
    await settle(250)
    const go = $('.ride__plate [data-action="enter"]')
    expect(go, 'the plate is up').toBeTruthy()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    await userEvent.keyboard('{Enter}')
    await settle(250)
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

// ── P11 — the card ride on three panels (plan 132) ──
// The card run's layout (plan 126): this run's figures and the card
// panel at the left, the card, the details sealed at the right until
// the flip docks the card's entry there. The walk points at every part
// before the first turn, and at the entry and the forecast after it.
const box = el => el.getBoundingClientRect()
const plate = () => $('.desk-run__side .desk-entry .dict-plate__word')?.textContent ?? null
const figure = () => $('.desk-run__left .desk-figs .desk-fig__value')?.firstChild?.textContent ?? null

describe('the card ride on the desk\'s panels (P11)', () => {
  it('stands on the three panels and walks every part of them', async () => {
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
    await settle(250)
    expect($('.desk-run--panels')).not.toBeNull()
    expect($('.desk-run__left .desk-session')).not.toBeNull()
    expect($('.desk-run__left .desk-card')).not.toBeNull()
    expect($('.desk-run__side .desk-sealed')).not.toBeNull()
    // The ride has no choices: no C among the keys.
    expect($$('.desk-card .desk-keys .desk-kbd').map(k => k.textContent)).not.toContain('C')
    // The tiles carry the new card's forecast, not dashes.
    expect($$('.desk-verdict__value').every(v => v.textContent !== '—')).toBe(true)
    expect(await walk()).toEqual([
      'run.records', 'run.state', 'run.verdicts', 'run.keys', 'run.rhythm', 'ride.card', 'ride.rate', 'run.side',
    ])
    // The walk over, the ride's own note says how to turn the card.
    expect($('.guide-callout__text').textContent).toMatch(/Space|Espace/)

    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('こんにちは')
    expect(await walk()).toEqual(['run.side', 'run.verdicts'])

    await userEvent.keyboard('1')
    await nextCard()
    // The grade counts in this run's figures; the second card is not walked.
    expect(figure()).toBe('1')
    expect($('.desk-run__side .desk-sealed')).not.toBeNull()
    await settle(200)
    expect(walkStop()).toBeNull()
    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('駅')
    await userEvent.keyboard('1')
    await nextCard()
    expect($('.ride__done')).not.toBeNull()
    expect($('.desk-run__side')).toBeNull()
    expect($('.desk-run__left')).toBeNull()
  })

  it('declines both walks on the first one\'s Skip', async () => {
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
    await settle(250)
    await skipWalk()
    expect(walkStop()).toBeNull()
    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('こんにちは')
    expect(walkStop()).toBeNull()
    // No 🔍 on the card: the column is where the look-up goes.
    expect($$('.reveal-action-btn').some(b => /dictionar|dictionnaire/i.test(b.title))).toBe(false)
  })

  it('stands the ride\'s notes over the card, not over the window\'s middle', async () => {
    document.documentElement.dataset.chrome = 'stage'
    try {
      await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
      await settle(300)
      await skipWalk()
      await settle(120)
      const note = $('.guide-callout')
      expect(note).not.toBeNull()
      const mid = r => (r.left + r.right) / 2
      expect(Math.abs(mid(box(note)) - mid(box($('.flashcard'))))).toBeLessThan(1.5)
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })
})

// ── P12 — the reading ride on three panels (plan 132) ──
// A practice run's layout (plan 129): the figures and the run's lines
// at the left, the breakdown sealed at the right until the grade. The
// walk comes before the clock, and the grade opens the breakdown.
describe('the reading ride on the desk\'s panels (P12)', () => {
  it('walks the panels with the clock held, then opens the breakdown at the grade', async () => {
    await mount(<RideReading session={{ access_token: 'tok' }} onDone={() => {}} />, '/ride/reading-run')
    await settle(250)
    expect($('.desk-run--panels')).not.toBeNull()
    expect($('.desk-run__left .desk-sentences')).not.toBeNull()
    expect($('.desk-run__side .desk-sealed')).not.toBeNull()
    // Held: the sentence covered and the clock full while the walk is open.
    expect($('.sentence--covered')).not.toBeNull()
    await settle(600)
    expect($('.timer__label').textContent).toBe(`${SENTENCE.display_seconds.toFixed(1)}s`)
    expect(await walk()).toEqual([
      'run.records', 'run.lines', 'run.keys', 'run.rhythm', 'ride.sentence', 'ride.answer', 'run.side',
    ])
    // The clock runs now: the sentence shows, then hides.
    expect($('.sentence').textContent).toBe(SENTENCE.phrase)
    await settle(700)
    expect($('.sentence--covered')).not.toBeNull()

    $('form.stage__foot input').focus()
    await userEvent.keyboard('eki de tomodachi ni aimasu{Enter}')
    await settle(250)
    expect($('.desk-run__side .desk-sealed')).not.toBeNull()
    await userEvent.keyboard('1')
    await settle(250)
    expect(await walk()).toEqual(['run.side', 'run.lines'])
    // Graded: the breakdown in the side, the sentence a line with its grade.
    expect($('.desk-run__side .desk-sealed')).toBeNull()
    expect($('.desk-run__side').textContent).toContain('station')
    expect($('.desk-sentence__text').textContent).toBe(SENTENCE.phrase)
    expect($('.desk-sentence__dot--q4')).not.toBeNull()  // '1' is the best tile: q4 on the default scale
    expect(figure()).toBe('1')
    expect(posts().some(([u]) => u === '/api/onboarding/ride/done')).toBe(false)
  })
})
