import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── 主 — a line's modes added to Today from its services (plan 273) ──
// Opened, a kana, word or kanji line offers its other modes as chips,
// lit while Today deals them; a tap writes the line's list. A lane the
// server marks as ridden in the learner's own modes rides under 主.

vi.mock('../../stores/credits', () => ({ useCredits: () => null, openBalance: vi.fn() }))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playAnnouncement: vi.fn() }))
const setExtraModes = vi.hoisted(() => vi.fn(async () => ({})))
const MODES = {
  main: { kana: 'kana.flashcard.f2b', vocab: 'vocab.flashcard.f2b', kanji: 'kanji.flashcard.f2b' },
  extra: { kana: [], vocab: [], kanji: ['kanji.write_kanji'] },
  choices: {
    main: {},
    extra: {
      kana: ['kana.flashcard.f2b', 'kana.flashcard.b2f'],
      vocab: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f', 'vocab.word_reading'],
      kanji: ['kanji.flashcard.f2b', 'kanji.flashcard.b2f', 'kanji.write_kanji'],
    },
  },
}
vi.mock('../../stores/learnerModes', () => ({
  MODE_LINES: ['kana', 'vocab', 'kanji'],
  useLearnerModes: () => ({ data: MODES, failed: false }),
  setExtraModes: (...a) => setExtraModes(...a),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GateCard } = await import('./GateCard')

const LANES = [
  { id: 's~kanji~N4~kanji.flashcard.f2b', kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.flashcard.f2b', due: 4, new: 0, main: true },
  { id: 's~kanji~N5~kanji.write_kanji', kind: 'section', source: 'kanji', deck: 'N5', mode: 'kanji.write_kanji', due: 0, new: 3, main: true },
  { id: 's~kanji~N4~kanji.readings', kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.readings', due: 2, new: 0, main: false },
  { id: 's~grammar~N4~grammar.ladder', kind: 'section', source: 'grammar', deck: 'N4', mode: 'grammar.ladder', due: 1, new: 0, main: true },
]
const TODAY = { total: 10, lanes: LANES, next_due: null }
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function services() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter><GateCard today={TODAY} failed={false} session={{ access_token: 'tok' }} /></MemoryRouter>
    </LangProvider>,
  )
  screen.container.querySelector('.tdy-door').click()
  await settle()
  return [...document.querySelectorAll('.tdy-sheet .tdy-line')]
}
const line = (lines, word) => lines.find(l => l.querySelector('.tdy-line__name').textContent.includes(word))

describe('GateCard — a line\'s modes', () => {
  beforeEach(() => {
    localStorage.setItem('lang', 'fr')
    localStorage.removeItem('tsuji.gateMain')
    setExtraModes.mockClear()
  })

  it('boards the lanes the server marks as the learner\'s own under 主', async () => {
    await services()
    const count = Number(document.querySelector('.tdy-dial__count').textContent)
    // The main and added kanji lanes and the ladder: not the readings.
    expect(count).toBe(4 + 3 + 1)
  })

  it('offers the line\'s other modes as chips and writes the line\'s list', async () => {
    const lines = await services()
    const kanji = line(lines, 'Kanji')
    expect(kanji.querySelector('.tdy-line__add')).toBeNull()
    kanji.querySelector('.tdy-line__more').click()
    await settle()
    const chips = [...kanji.querySelectorAll('.tdy-line__add .chip')]
    // Every mode but the main one, lit while Today deals it.
    expect(chips.map(c => c.dataset.mode)).toEqual(['kanji.flashcard.b2f', 'kanji.write_kanji'])
    expect(chips.map(c => c.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(chips[0].getAttribute('aria-label')).toBe(fr.gateModeAdd(fr.mode_kanji_flashcard_b2f))
    chips[0].click()
    await settle()
    expect(setExtraModes).toHaveBeenCalledWith('kanji', ['kanji.write_kanji', 'kanji.flashcard.b2f'], { access_token: 'tok' })
    chips[1].click()
    await settle()
    expect(setExtraModes).toHaveBeenLastCalledWith('kanji', [], { access_token: 'tok' })
    // Grammar rides its ladder: nothing to add there.
    expect(line(lines, 'Grammaire').querySelector('.tdy-line__more')).toBeNull()
  })
})
