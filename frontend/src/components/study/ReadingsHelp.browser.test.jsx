import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 読み — what the kanji card says about its readings (plan 276) ──
// A learner asked what 音読み · on'yomi and 訓読み · kun'yomi were, and
// how to know a card was understood. The owner picked two answers off
// the canvas: a Kanji → meaning front says what it asks (B2), and each
// register's name on the back is a door onto a sheet that says what
// the two readings are, in a word of the card's own kanji (A3). These
// pin both on CardPrompt, the card Today and the decks draw.

const fetchLookup = vi.fn()
vi.mock('../../lib/dictionaryLookup', async (o) => ({ ...(await o()), fetchLookup: (...a) => fetchLookup(...a) }))
const countUse = vi.fn()
vi.mock('../../lib/screenTrail', async (o) => ({ ...(await o()), countUse: (...a) => countUse(...a) }))
vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playFlip: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))

const { default: CardPrompt } = await import('./CardPrompt')
const { default: fr } = await import('../../locales/fr/index.js')

const furi = (...pairs) => pairs.map(([text, reading]) => (reading ? { text, reading } : { text }))
// 日 as the deck packs it and the dictionary groups it.
const HI = {
  card_id: 'kanji_N5_日', source: 'builtin_kanji', mode: 'kanji.flashcard.f2b', direction: 'f2b',
  kanji: '日', kana: 'ニチ・ジツ・ひ・~び・~か', meaning: 'jour; soleil; Japon; compteur de jours',
  reading_shares: { total: 79, whole: 14, readings: { 'ニチ': 18, 'ジツ': 10, 'ひ': 17, '~び': 11, '~か': 9 } },
}
const ENTRY = {
  kanji: '日',
  readings: [
    { reading: 'ニチ', words: [{ kanji: '日曜日', kana: 'にちようび', meaning: 'dimanche', furigana: furi(['日', 'にち'], ['曜', 'よう'], ['日', 'び']) }] },
    { reading: 'ひ', words: [{ kanji: '日付', kana: 'ひづけ', meaning: 'date', furigana: furi(['日', 'ひ'], ['付', 'づけ']) }] },
    { reading: '~び', words: [{ kanji: '火曜日', kana: 'かようび', meaning: 'mardi', furigana: furi(['火', 'か'], ['曜', 'よう'], ['日', 'び']) }] },
  ],
}

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

async function card(c, props = {}) {
  const screen = await render(
    <LangProvider>
      <CardPrompt card={c} t={fr} session={{ access_token: 'tok' }} {...props} />
    </LangProvider>
  )
  const q = sel => screen.container.querySelector(sel)
  return { screen, q, doors: () => [...screen.container.querySelectorAll('.reading-group__door')] }
}

async function turn(q) {
  q('.flashcard').click()
  await settle()
}

beforeEach(() => {
  fetchLookup.mockReset()
  fetchLookup.mockResolvedValue({ results: [ENTRY] })
  countUse.mockReset()
  document.querySelectorAll('.scrim').forEach(n => n.remove())
})

describe('the Kanji → meaning front asks what it asks', () => {
  it('says the meaning is the answer, under the kanji', async () => {
    const { q } = await card(HI)
    expect(q('.flashcard__face .char-display').textContent).toBe('日')
    expect(q('.prompt-ask').textContent).toBe(fr.askKanjiMeaning)
  })

  it('is gone once the card is turned', async () => {
    const { q } = await card(HI)
    await turn(q)
    expect(q('.prompt-ask')).toBeNull()
  })

  it('is not on a meaning → kanji front', async () => {
    const { q } = await card({ ...HI, direction: 'b2f' })
    expect(q('.prompt-ask')).toBeNull()
  })
})

describe('a register name opens what the readings are', () => {
  it('is a door on the turned card, and the tap does not turn it back', async () => {
    const { q, doors } = await card(HI)
    expect(doors()).toHaveLength(0)
    await turn(q)
    expect(doors().map(d => d.textContent)).toEqual([fr.readingsOnName, fr.readingsKunName])
    doors()[0].click()
    await settle()
    const sheet = document.querySelector('.sheet[role="dialog"]')
    expect(sheet?.getAttribute('aria-label')).toBe('Les deux lectures')
    // Still the back: the tap was the door's.
    expect(q('.meaning-display__primary')?.textContent).toBe('Jour')
    expect(countUse).toHaveBeenCalledWith('readings', 'open')
  })

  it('closes on the scrim and leaves the card on its back', async () => {
    const { q, doors } = await card(HI)
    await turn(q)
    doors()[0].click()
    await settle()
    // The sheet is a portal, but its scrim's click bubbles through the
    // React tree to the Flashcard: it must not turn the card.
    document.querySelector('.scrim').click()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(q('.meaning-display__primary')?.textContent).toBe('Jour')
  })

  it('says both readings, each in a word of the kanji, then the marks it carries', async () => {
    const { q, doors } = await card(HI)
    await turn(q)
    doors()[1].click()
    await settle(150)
    const sheet = document.querySelector('.sheet')
    expect([...sheet.querySelectorAll('.readings-help__name')].map(n => n.textContent))
      .toEqual(['Lecture chinoise音読み', 'Lecture japonaise訓読み'])
    const [onEg, kunEg] = sheet.querySelectorAll('.readings-help__eg')
    expect(onEg.textContent).toBe('日曜日にちようびDimanche')
    // The kanji and its sound picked out: the first 日, read にち.
    expect([...onEg.querySelectorAll('b')].map(b => b.textContent)).toEqual(['日', 'にち'])
    expect(kunEg.textContent).toContain('日付')
    const marks = [...sheet.querySelectorAll('.readings-help__marks dt')].map(d => d.textContent)
    expect(marks).toEqual(['22,8%', '~び'])
    expect(sheet.querySelector('.readings-help__marks').textContent).toContain('火曜日, かようび')
    expect(fetchLookup).toHaveBeenCalledWith({ access_token: 'tok' }, { term: '日', category: 'kanji', lang: 'fr' })
  })

  it('stands on its sentences when the entry does not come', async () => {
    fetchLookup.mockRejectedValue(new Error('offline'))
    const { q, doors } = await card(HI)
    await turn(q)
    doors()[0].click()
    await settle(150)
    const sheet = document.querySelector('.sheet')
    expect(sheet.querySelectorAll('.readings-help__text')).toHaveLength(2)
    expect(sheet.querySelector('.readings-help__eg')).toBeNull()
  })

  it('is no door on a word card, whose reading has one register', async () => {
    const { q, doors } = await card({
      card_id: 'vocab_N5_日曜日_にちようび', source: 'builtin_vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
      kanji: '日曜日', kana: 'にちようび', meaning: 'dimanche',
    })
    await turn(q)
    expect(doors()).toHaveLength(0)
  })
})
