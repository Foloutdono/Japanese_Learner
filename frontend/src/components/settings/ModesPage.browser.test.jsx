import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Main modes (plan 273) ─────────────────────────────
// One slip a line: its main mode as a radio, its other modes as chips
// lit while Today deals them too. A new main mode asks first, with
// what the switch marks known; a chip writes on the spot.

const MODES = {
  main: { kana: 'kana.flashcard.f2b', vocab: 'vocab.flashcard.f2b', kanji: 'kanji.flashcard.f2b' },
  extra: { kana: [], vocab: [], kanji: ['kanji.readings'] },
  choices: {
    main: {
      kana: ['kana.flashcard.f2b', 'kana.flashcard.b2f', 'kana.write_romaji', 'kana.write_kana'],
      vocab: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f'],
      kanji: ['kanji.flashcard.f2b', 'kanji.flashcard.b2f', 'kanji.write_kanji', 'kanji.readings'],
    },
    extra: {
      kana: ['kana.flashcard.f2b', 'kana.flashcard.b2f', 'kana.write_romaji', 'kana.write_kana'],
      vocab: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f', 'vocab.word_reading'],
      kanji: ['kanji.flashcard.f2b', 'kanji.flashcard.b2f', 'kanji.write_kanji', 'kanji.readings', 'kanji.radical'],
    },
  },
}

const apiJson = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', () => ({ apiFetch: (...a) => apiFetch(...a), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }))
const refreshToday = vi.hoisted(() => vi.fn())
vi.mock('../../stores/today', () => ({ refreshToday: (...a) => refreshToday(...a), useTodaySummary: () => ({ data: null }) }))
vi.mock('../../stores/profileSummary', () => ({ refreshSummary: vi.fn(), useProfileSummary: () => null }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { ModesPage } = await import('./ModesPage')
const { forgetModes } = await import('../../stores/learnerModes')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const slip = line => $(`.mmodes[data-line="${line}"]`).closest('.slip')

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter><ModesPage session={{ access_token: 'tok' }} /></MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

describe('Settings › Main modes', () => {
  beforeEach(() => {
    localStorage.setItem('lang', 'fr')
    forgetModes()
    apiFetch.mockReset()
    apiJson.mockReset()
    refreshToday.mockReset()
    apiFetch.mockImplementation(async () => ({ ok: true, json: async () => MODES }))
  })
  afterEach(() => cleanup())

  it('draws one slip a line, its main mode checked and its added modes lit', async () => {
    await mount()
    expect($$('.mmodes').map(g => g.dataset.line)).toEqual(['kana', 'vocab', 'kanji'])
    const kanji = slip('kanji')
    const radios = [...kanji.querySelectorAll('[role="radio"]')]
    expect(radios.map(r => r.dataset.mode)).toEqual(MODES.choices.main.kanji)
    expect(radios.map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
    expect(radios[2].textContent).toContain(fr.mode_kanji_write_kanji)
    // The main mode is never offered as its own extra.
    const chips = [...kanji.querySelectorAll('.chip')]
    expect(chips.map(c => c.dataset.mode)).toEqual(['kanji.flashcard.b2f', 'kanji.write_kanji', 'kanji.readings', 'kanji.radical'])
    expect(chips.map(c => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false'])
  })

  it('asks before a new main mode, with what it marks known, then writes it', async () => {
    await mount()
    apiJson.mockImplementation(async (path) => {
      if (path.startsWith('/api/profile/modes/preview')) {
        return { line: 'kanji', from: 'kanji.flashcard.f2b', to: 'kanji.write_kanji', markedKnown: 84, spreadWeeks: 6 }
      }
      return { modes: { ...MODES, main: { ...MODES.main, kanji: 'kanji.write_kanji' } }, mainSwitch: [] }
    })
    await userEvent.click(slip('kanji').querySelector('[data-mode="kanji.write_kanji"]'))
    await settle()
    expect(apiJson.mock.calls[0][0]).toBe('/api/profile/modes/preview?line=kanji&mode=kanji.write_kanji')
    const sheet = $('.lvl-sheet')
    expect(sheet.textContent).toContain('84')
    expect(sheet.textContent).toContain(fr.levelMarkedKnown)
    await userEvent.click($('[data-action="mode-confirm"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/profile/learning', expect.anything(),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ mainModes: { kanji: 'kanji.write_kanji' } }) }))
    expect(refreshToday).toHaveBeenCalled()
    const radios = [...slip('kanji').querySelectorAll('[role="radio"]')]
    expect(radios.find(r => r.getAttribute('aria-checked') === 'true').dataset.mode).toBe('kanji.write_kanji')
  })

  it('adds a mode to Today, and takes one off, on the spot', async () => {
    await mount()
    apiJson.mockImplementation(async (_path, _s, init) => {
      const extra = JSON.parse(init.body).extraModes
      return { modes: { ...MODES, extra: { ...MODES.extra, ...extra } } }
    })
    await userEvent.click(slip('kanji').querySelector('.chip[data-mode="kanji.write_kanji"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/profile/learning', expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ extraModes: { kanji: ['kanji.readings', 'kanji.write_kanji'] } }) }))
    expect(slip('kanji').querySelector('.chip[data-mode="kanji.write_kanji"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(slip('kanji').querySelector('.chip[data-mode="kanji.readings"]'))
    await settle()
    expect(apiJson).toHaveBeenLastCalledWith('/api/profile/learning', expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ extraModes: { kanji: ['kanji.write_kanji'] } }) }))
    expect(refreshToday).toHaveBeenCalledTimes(2)
  })
})
