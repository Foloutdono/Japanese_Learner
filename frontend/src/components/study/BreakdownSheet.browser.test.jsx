import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import en from '../../locales/en'
import '../../index.css'

// ── A grammar card's sentence, taken apart from the reveal corner ──
// The owner's pick (option A): a round door beside the dictionary's,
// only once the answer is out and only on a card that says a sentence,
// opening the practice runs' breakdown in a sheet. The local tier is
// asked when the sheet opens, never before.

vi.mock('../../lib/track', () => ({ track: vi.fn() }))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn() }))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', async o => ({ ...(await o()), apiFetch }))

const { RevealActions } = await import('./QuizComponents')

const SENTENCE = 'この本を読んでください。'
const ANALYSIS = {
  available: true, explanation: '', grammar: [],
  tokens: [
    { surface: 'この', start: 0, end: 2, reading: 'この', pos: 'determiner', furigana: [{ text: 'この' }], vocab_match: null, kanji_matches: [] },
    { surface: '本', start: 2, end: 3, reading: 'ほん', pos: 'noun', furigana: [{ text: '本', reading: 'ほん' }], kanji_matches: [],
      vocab_match: { level: 'N5', raw_id: 'vocab_N5_本_ほん', entry: { word: '本', meaning: 'book' }, stats: { status: 'not_started', due: false } } },
    { surface: 'を読んでください。', start: 3, end: 12, reading: 'をよんでください。', pos: 'particle', furigana: [{ text: 'を読んでください。' }], vocab_match: null, kanji_matches: [] },
  ],
}
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const door = () => document.querySelector(`[aria-label="${en.breakdownSentence}"]`)

function mount(props) {
  return render(
    <LangProvider>
      <div className="prompt-card">
        <RevealActions t={en} resetKey="c" dictCategory="grammar" dictId="grammar_N5_〜てください" session={{ access_token: 'tok' }} {...props} />
      </div>
    </LangProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem('lang', 'en')
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ANALYSIS }))
})
afterEach(() => { localStorage.removeItem('lang') })

describe('the breakdown door', () => {
  it('stands beside the dictionary once the answer is out, and asks nothing until pressed', async () => {
    await mount({ revealed: true, breakdown: { sentence: SENTENCE, translation: 'Please read this book.' } })
    expect(door()).not.toBeNull()
    expect(door().parentElement.querySelector(`[aria-label="${en.openDictionary}"]`)).not.toBeNull()
    expect(apiFetch).not.toHaveBeenCalled()

    door().click()
    await settle()
    const [url, , init] = apiFetch.mock.calls[0]
    expect(url).toBe('/api/phrase/analyze')
    expect(JSON.parse(init.body)).toMatchObject({ phrase: SENTENCE, save: false, deep: false })
    const sheet = document.querySelector('[role="dialog"]')
    expect(sheet.querySelector('.sheet__title').textContent).toBe(en.deskBreakdownLabel)
    expect(sheet.querySelector('.bkd')).not.toBeNull()
    expect(sheet.textContent).toContain('Please read this book.')
  })

  it('is not offered before the answer, nor on a card that says no sentence', async () => {
    await mount({ revealed: false, breakdown: { sentence: SENTENCE } })
    expect(door()).toBeNull()
    await mount({ revealed: true, breakdown: null })
    expect(door()).toBeNull()
  })

  it('says so when the breakdown cannot be had', async () => {
    apiFetch.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await mount({ revealed: true, breakdown: { sentence: SENTENCE } })
    door().click()
    await settle()
    expect(document.querySelector('[role="dialog"]').textContent).toContain(en.breakdownUnavailable)
  })
})
