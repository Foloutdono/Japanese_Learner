import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import ladder from '../testing/grammarLadder.json'
import '../index.css'

// ── The run (plan 070) ────────────────────────────────────────
// /today/run on the stage: ‹ Gate, where the card in hand is from, the
// remaining pill, the pass; the review posted under the card's OWN
// mode; and, once the queue is empty, back to the gate with the
// figures for the finish.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const summaryRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: summaryRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
  speakSentence: vi.fn(), playToggle: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./TodayRun')
const { playKana, speakJapanese, speakSentence, isSpeakOnReveal, toggleSpeakOnReveal } = await import('../lib/audio')

const LANE = { id: 's~kana~hiragana_basic~kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b', due: 1 }
const CARD = {
  card_id: 'kana_no', kana: 'の', romaji: 'no', source: 'kana', deck: 'hiragana_basic',
  mode: 'kana.flashcard.f2b', direction: 'f2b', stage: 'learning',
  hints: {}, review_preview: { 4: { xp_earned: 3 } }, lane: LANE,
}

// The run's end: since plan 191 a run that reviewed anything hands its
// tally to /today/clear (the finish), one that reviewed nothing goes
// back to the gate. The probe stands on both and prints what it was handed.
function Gate() {
  const { state, pathname } = useLocation()
  return (
    <div className="gate-probe" data-path={pathname} data-faces={(state?.run?.cards ?? []).map(c => `${c.term}:${c.verdict}`).join(',')}>
      {state?.run ? `cleared ${state.run.cleared} xp ${state.run.xp}` : 'gate'}
    </div>
  )
}

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
// The cards the run's meter (plan 174) has left: its segments not yet
// rated -- the one in hand and the unlit ones after it.
const left = root => root.querySelectorAll('.run-meter .run-meter__s:not(.run-meter__s--done)').length

function mount(entry = '/today/run') {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/today" element={<Gate />} />
          <Route path="/today/clear" element={<Gate />} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  summaryRef.current = { total: 1, lanes: [LANE], next_due: null }
})

describe('TodayRun', () => {
  it('runs on the stage, posts the review under the card\'s mode, and hands the figures to the finish', async () => {
    let batch = 0
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        batch += 1
        return { cards: batch === 1 ? [CARD] : [] }
      }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })

    const screen = await mount()
    await settle(300)

    // The stage, not a screen with a bar: ‹ Gate, the lane in the gate's
    // words, the mode under it, the pass -- and under the head the run's
    // meter (plan 174), a segment a card, the ones left unrated.
    const stage = screen.container.querySelector('main.stage')
    expect(stage, `no stage — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()
    expect(document.querySelector('.hud')).toBeNull()
    expect(stage.querySelector('.stage__leave').textContent).toContain('Portique')
    expect(stage.querySelector('.stage__where-jp').textContent).toContain('Hiragana')
    expect(stage.querySelector('.today-remaining')).toBeNull()
    expect(left(stage)).toBe(1)
    expect(stage.querySelector('.hstrip--solo [data-guide="hud.pass"]')).toBeTruthy()
    expect(stage.querySelector('.prompt-card')).toBeTruthy()

    // Reveal and rate.
    stage.querySelector('.flashcard').click()
    await settle(80)
    const correct = [...stage.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct'))
    expect(correct).toBeTruthy()
    correct.click()
    await settle(600)

    const review = apiJson.mock.calls.find(c => c[0] === '/api/today/review')
    expect(review).toBeTruthy()
    expect(JSON.parse(review[2].body)).toMatchObject({ card_id: 'kana_no', mode: 'kana.flashcard.f2b', quality: 4 })

    // The next batch is empty: the run is over and hands its tally to
    // the finish -- the figures and each card's face (plan 191).
    await settle(1200)
    const probe = screen.container.querySelector('.gate-probe')
    expect(probe?.textContent).toBe('cleared 1 xp 3')
    expect(probe.dataset.path).toBe('/today/clear')
    expect(probe.dataset.faces).toBe('の:1')
  }, 20000)

  it('counts what the queue holds, not the gate\'s figure run down', async () => {
    // The gate counted one card; one more fell due before the run
    // reached it (a miss comes back minutes later). The pill was the
    // gate's figure less what was cleared, so it read 0 with that card
    // on screen. It counts the cards in hand and what the queue said
    // it holds past them.
    const NE = { ...CARD, card_id: 'kana_ne', kana: 'ね', romaji: 'ne' }
    let batch = 0
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        batch += 1
        if (batch === 1) return { cards: [CARD], beyond: 1 }
        if (batch === 2) return { cards: [NE], beyond: 0 }
        return { cards: [], beyond: 0 }
      }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })

    const screen = await mount()
    await settle(300)
    const pill = () => left(screen.container)
    expect(pill()).toBe(2)

    const rate = async () => {
      screen.container.querySelector('.flashcard').click()
      await settle(80)
      ;[...screen.container.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct')).click()
      await settle(1500)
    }
    await rate()
    // The second card, past the gate's one: one left, not zero.
    expect(screen.container.querySelector('.prompt-card')?.textContent).toContain('ね')
    expect(pill()).toBe(1)

    await rate()
    expect(screen.container.querySelector('.gate-probe')?.textContent).toBe('cleared 2 xp 6')
  }, 20000)

  it('a failed first fetch stays on the stage with the retry, never a finish', async () => {
    apiJson.mockImplementation(async () => { throw new Error('down') })
    const screen = await mount()
    await settle(400)
    expect(screen.container.querySelector('main.stage')).toBeTruthy()
    expect(screen.container.querySelector('.empty--error')).toBeTruthy()
    expect(screen.container.querySelector('.gate-probe')).toBeNull()
  })
})

// ── 区間 — a run of a chosen length (plan 135) ──────────────────
// The desk's gate sends each lane's share as `quota`. The run asks the
// queue for no more than a lane has left, less what it has answered
// and holds, and ends when every share is served without asking again.
describe('TodayRun with a quota', () => {
  it('asks for each lane\'s share, counts it off, and ends without another fetch', async () => {
    const calls = []
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        calls.push(String(url))
        return { cards: calls.length === 1 ? [CARD] : [] }
      }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })
    const screen = await mount(`/today/run?quota=${encodeURIComponent(`${LANE.id}:1`)}`)
    await settle(300)
    expect(calls[0]).toContain(`quota=${encodeURIComponent(`${LANE.id}:1`)}`)
    // The meter counts the run's length, not the lane's whole due.
    expect(left(screen.container)).toBe(1)
    // Holding the one card, the lane has nothing left to ask for.
    expect(calls.every(u => u === calls[0] || !u.includes('quota='))).toBe(true)

    screen.container.querySelector('.flashcard').click()
    await settle(80)
    ;[...screen.container.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct')).click()
    await settle(1500)
    expect(screen.container.querySelector('.gate-probe')?.textContent).toBe('cleared 1 xp 3')
    // Answered, the share is spent: the run never asked the queue again.
    expect(calls).toHaveLength(1)
  }, 20000)

  it('a second run of the same length starts from nothing answered', async () => {
    // The run keeps its count in the tab for a reload mid-run. Kept past
    // the end, the next run dealt the same way -- the same key -- read
    // every share as spent, served nothing and went straight back.
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) return { cards: [CARD], beyond: 0 }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })
    const entry = `/today/run?quota=${encodeURIComponent(`${LANE.id}:1`)}`
    for (const run of [1, 2]) {
      const screen = await mount(entry)
      await settle(300)
      const flashcard = screen.container.querySelector('.flashcard')
      expect(flashcard, `run ${run} served nothing`).toBeTruthy()
      flashcard.click()
      await settle(80)
      ;[...screen.container.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct')).click()
      await settle(1500)
      expect(screen.container.querySelector('.gate-probe')?.textContent).toBe('cleared 1 xp 3')
      await screen.unmount()
    }
  }, 30000)
})

// ── 回復運転 — the run past the share (plan 217) ─────────────────
// Boarded from a cleared gate whose ceiling held reviews back: the
// queue is asked for them (`extra=1`), as a session of its own.
describe('TodayRun past the share', () => {
  it('asks the queue for the reviews held back', async () => {
    const calls = []
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        calls.push(String(url))
        return { cards: [CARD], beyond: 0 }
      }
      return {}
    })
    await mount('/today/run?extra=1')
    await settle(300)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(u => u.includes('&extra=1'))).toBe(true)
  })
})

// ── 音 — speak on reveal ─────────────────────────────────────────
// A card in the queue says its answer once revealed as it does on its
// own run, and the switch that stops it stands where that run keeps it:
// beside the hints for a kana or a word, in the head for a grammar card
// that says a sentence. A personal deck's word says nothing, as in the
// deck's own run; a drawn kanji says its reading once the drawing is
// checked; off, nothing is said.
describe('TodayRun speaks on reveal', () => {
  const VOCAB_LANE = { id: 's~vocab~N5~vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 1 }
  const WORD = {
    card_id: 'vocab_N5_水_みず', kanji: '水', kana: 'みず', meaning: 'eau', source: 'vocab', deck: 'N5',
    mode: 'vocab.flashcard.f2b', direction: 'f2b', stage: 'learning',
    hints: {}, review_preview: { 4: { xp_earned: 3 } }, lane: VOCAB_LANE,
  }
  const DECK_LANE = { id: 'p~d1~vocab.flashcard.f2b', kind: 'personal', deck_name: 'Mes mots', mode: 'vocab.flashcard.f2b', due: 1 }
  const DECK_WORD = {
    card_id: 'd1_c1', source: 'custom', structure: 'vocab', fields: { word: '猫', meaning: 'chat' }, kana: 'ねこ',
    mode: 'vocab.flashcard.f2b', direction: 'f2b', stage: 'learning',
    hints: {}, review_preview: { 4: { xp_earned: 3 } }, lane: DECK_LANE,
  }
  const KANJI_LANE = { id: 's~kanji~N5~kanji.write_kanji', kind: 'section', source: 'kanji', deck: 'N5', mode: 'kanji.write_kanji', due: 1 }
  const DRAWN = {
    card_id: 'kanji_N5_水', kanji: '水', kana: 'みず', meaning: 'eau', source: 'kanji', deck: 'N5',
    mode: 'kanji.write_kanji', direction: 'b2f', stage: 'learning',
    hints: {}, review_preview: { 4: { xp_earned: 3 } }, lane: KANJI_LANE,
  }
  const GRAMMAR_LANE = { id: 's~grammar~N5~grammar.ladder', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.ladder', due: 2 }
  const CHOOSE = { ...ladder.choose, source: 'grammar', deck: 'N5', lane: GRAMMAR_LANE }
  // A second Choisir, its own point and sentence.
  const CHOOSE_NOT = {
    ...CHOOSE, card_id: 'grammar_N5_〜ないでください', raw_id: 'grammar_N5_〜ないでください', grammar: '〜ないでください',
    contrast: { ...CHOOSE.contrast, jp: 'ここで写真を撮らないでください。', answer: '〜ないでください' },
  }
  const said = fn => fn.mock.calls.map(c => c[0])
  const speaker = root => root.querySelector('[data-action="speak-on-reveal"]')

  // The queue's first batch holds `cards`; every later one is empty.
  function serve(cards) {
    let batch = 0
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        batch += 1
        return { cards: batch === 1 ? cards : [], beyond: 0 }
      }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })
  }
  async function rate(root) {
    ;[...root.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct')).click()
  }

  beforeEach(() => {
    if (!isSpeakOnReveal()) toggleSpeakOnReveal()
    playKana.mockClear()
    speakJapanese.mockClear()
    speakSentence.mockClear()
  })
  afterEach(() => {
    if (!isSpeakOnReveal()) toggleSpeakOnReveal()
  })

  it('a kana says its sound on the flip, with the switch beside the hints', async () => {
    serve([CARD])
    const root = (await mount()).container
    await settle(300)
    // The card offers no hint, and the row stands for the switch alone.
    expect(root.querySelector('.study-assist [data-action="speak-on-reveal"]')).toBeTruthy()
    expect(root.querySelector('.stage__head [data-action="speak-on-reveal"]')).toBeNull()
    expect(playKana).not.toHaveBeenCalled()

    root.querySelector('.flashcard').click()
    await settle(80)
    root.querySelector('.flashcard').click()
    await settle(80)
    expect(said(playKana)).toEqual(['no'])
  }, 20000)

  it("a word says its reading; a personal deck's word says nothing and offers no switch", async () => {
    serve([WORD, DECK_WORD])
    const root = (await mount()).container
    await settle(300)
    expect(root.querySelector('.study-assist [data-action="speak-on-reveal"]')).toBeTruthy()
    root.querySelector('.flashcard').click()
    await settle(80)
    expect(said(speakJapanese)).toEqual(['みず'])

    await rate(root)
    await vi.waitFor(() => expect(root.querySelector('.prompt-card')?.textContent).toContain('猫'), { timeout: 5000 })
    expect(speaker(root)).toBeNull()
    root.querySelector('.flashcard').click()
    await settle(80)
    expect(said(speakJapanese)).toEqual(['みず'])
  }, 20000)

  it('says nothing with the switch off', async () => {
    serve([WORD])
    const root = (await mount()).container
    await settle(300)
    speaker(root).click()
    await settle(30)
    expect(isSpeakOnReveal()).toBe(false)
    root.querySelector('.flashcard').click()
    await settle(80)
    expect(speakJapanese).not.toHaveBeenCalled()
  }, 20000)

  it('a drawn kanji says its reading once the drawing is checked', async () => {
    serve([DRAWN])
    const root = (await mount()).container
    await settle(300)
    expect(speakJapanese).not.toHaveBeenCalled()
    root.querySelector('.drawing-quiz__validate').click()
    await settle(80)
    expect(said(speakJapanese)).toEqual(['みず'])
  }, 20000)

  it("a Choisir card says its sentence once chosen, the switch in the head, and never the next card's before it is answered", async () => {
    serve([CHOOSE, CHOOSE_NOT])
    const root = (await mount()).container
    await settle(300)
    expect(root.querySelector('.stage__head [data-action="speak-on-reveal"]')).toBeTruthy()
    expect(root.querySelector('.study-assist [data-action="speak-on-reveal"]')).toBeNull()

    root.querySelector('.gl-tile[data-choice="1"]').click()
    await vi.waitFor(() => expect(said(speakSentence)).toEqual(['この本を読んでください。']))

    // Drawn under the last card's reveal for a render, the next Choisir
    // said its sentence -- its answer -- before it was asked.
    await rate(root)
    await vi.waitFor(() => expect(root.querySelector('.gl-tile:not(:disabled)')).toBeTruthy(), { timeout: 5000 })
    await settle(80)
    expect(said(speakSentence)).toEqual(['この本を読んでください。'])

    root.querySelector('.gl-tile[data-choice="0"]').click()
    await vi.waitFor(() => expect(said(speakSentence)).toEqual(['この本を読んでください。', 'ここで写真を撮らないでください。']))
  }, 20000)
})
