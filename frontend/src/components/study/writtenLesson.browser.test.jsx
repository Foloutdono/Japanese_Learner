import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import CardPrompt from './CardPrompt'
import { normalizeCard } from '../../domain/cardShape'
import '../../index.css'

// A grammar card a learner wrote carries its lesson (decks.py's
// build_personal_card): the formation on the card's face and, once it
// is turned, a door to the lesson in the sheet a catalogue point's
// lesson opens in -- its steps, its translated sentences, its rivals,
// none of them a door, since a written rival names no catalogue point.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const lesson = {
  pattern: '〜せいで', structure: 'nom + の + せいで', meaning: 'à cause de', register: 'neutral',
  steps: [{ kind: 'rule', text: 'Une cause **négative**.' }],
  compare: [{ pattern: '〜おかげで', text: 'cause heureuse' }],
  examples: [{ jp: '雨のせいで中止。', tr: 'À cause de la pluie.', furigana: [{ text: '雨のせいで中止。' }] }],
}

function written(extra = {}) {
  return normalizeCard({
    card_id: '42', source: 'custom', structure: 'grammar', mode: 'grammar.flashcard.f2b', direction: 'f2b',
    fields: { rule: '〜せいで', meaning: 'à cause de', structure: 'nom + の + せいで' },
    lesson, ...extra,
  })
}

async function mount(card) {
  const screen = await render(<LangProvider><CardPrompt card={card} t={{}} session={{}} /></LangProvider>)
  await settle()
  return screen
}

describe('a written grammar card', () => {
  it('prints its formation under the rule', async () => {
    const screen = await mount(written())
    expect(screen.container.querySelector('.grammar-structure')?.textContent).toBe('nom + の + せいで')
  })

  it('opens its lesson once turned', async () => {
    const screen = await mount(written())
    expect(screen.container.querySelector('.reveal-action-btn')).toBeNull()
    screen.container.querySelector('.flashcard').click()
    await settle()
    const door = screen.container.querySelector('.reveal-action-btn')
    expect(door).toBeTruthy()
    door.click()
    await settle()
    const sheet = document.querySelector('.gl-sheet')
    expect(sheet).toBeTruthy()
    expect(sheet.textContent).toContain('À cause de la pluie.')
    expect(sheet.textContent).toContain('cause heureuse')
    expect(sheet.querySelector('button.gl-door')).toBeNull()
    expect(sheet.querySelector('.gl-door--inert')).toBeTruthy()
    sheet.closest('.dict-sheet__scrim').click()
    await settle()
  })

  it('has no door when it was written with its two faces alone', async () => {
    const screen = await mount(written({
      fields: { rule: '〜せいで', meaning: 'à cause de' },
      lesson: { ...lesson, structure: '', steps: [], compare: [], examples: [] },
    }))
    screen.container.querySelector('.flashcard').click()
    await settle()
    expect(screen.container.querySelector('.reveal-action-btn')).toBeNull()
  })
})
