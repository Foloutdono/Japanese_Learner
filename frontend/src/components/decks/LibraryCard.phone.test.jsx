import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── A library card at 390px ─────────────────────────────────────
// The shelf card carries two things a private deck's card does not —
// whose deck it is, and how many people follow it — and a phone is
// where that has to fit or not at all.
//
// What is pinned here is the density contract: nothing overflows the
// viewport, the whole card is one thumb target, and a long description
// is clamped rather than allowed to push the row to any height it
// likes.

vi.mock('../../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playClick: vi.fn(),
}))

const { LibraryCard } = await import('./LibraryCard')

const DECK = {
  id: 7,
  name: 'Verbes irréguliers N3',
  description: 'Les verbes que les listes officielles rangent comme réguliers '
    + 'et qui ne le sont pas, avec la forme en て et la forme polie pour chacun, '
    + 'plus une phrase d’exemple prise dans un journal.',
  type: 'vocab',
  card_count: 128,
  followers: 12,
  author: 'SwiftKitsune4821',
}

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function card(deck = DECK) {
  const t = {
    vocabType: 'Vocabulaire', kanjiType: 'Kanji', grammarType: 'Grammaire',
    standardType: 'Standard', standardDesc: '', deckVocabDesc: '',
    deckKanjiDesc: '', deckGrammarDesc: '',
    cards: 'cartes',
    libraryBy: name => `par ${name}`,
    libraryFollowers: n => `${n} abonnés`,
  }
  await render(
    <LangProvider>
      <MemoryRouter>
        <main className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
          <div className="platform-grid">
            <LibraryCard deck={deck} t={t} onOpen={() => {}} />
          </div>
        </main>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return document.querySelector('.lib-card')
}

describe('the library card on a phone', () => {
  it('stays inside the viewport', async () => {
    const el = await card()
    expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(390)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  it('is one thumb target, not a row of small ones', async () => {
    const el = await card()
    expect(el.tagName).toBe('BUTTON')
    expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // No nested pressables: a button cannot nest in a button, and the
    // whole card is the press.
    expect(el.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('clamps a long description instead of growing without limit', async () => {
    const el = await card()
    const blurb = el.querySelector('.lib-card__blurb')
    const line = parseFloat(getComputedStyle(blurb).lineHeight)
    // Two lines, per the clamp — and measured, because -webkit-line-clamp
    // silently does nothing without the box properties beside it.
    expect(blurb.getBoundingClientRect().height).toBeLessThanOrEqual(line * 2 + 1)
    expect(blurb.scrollHeight).toBeGreaterThan(blurb.clientHeight)
  })

  it('prints the author and the follower count', async () => {
    const el = await card()
    expect(el.querySelector('.lib-card__author').textContent).toBe('par SwiftKitsune4821')
    expect(el.querySelector('.lib-card__follows').textContent).toBe('12 abonnés')
  })

  it('drops the blurb line entirely when there is no description', async () => {
    const el = await card({ ...DECK, description: '' })
    expect(el.querySelector('.lib-card__blurb')).toBeNull()
  })

  // The shelf reads as a column of figures behind one rule, so neither
  // the rule nor the figure can be measured per card: a deck with
  // followers used to widen its own aside, carrying the hairline left
  // of the deck above it, and lift its count off the height that
  // deck's count sat at. Both are pinned against a followed deck, an
  // unfollowed one, and the follower line long enough to set on two
  // lines, all on the shelf together.
  it('keeps the aside rule and the count where its neighbour has them', async () => {
    await card()
    await card({ ...DECK, id: 8, followers: 0 })
    await card({ ...DECK, id: 9, followers: 128 })
    const cards = [...document.querySelectorAll('.lib-card')]
    expect(cards).toHaveLength(3)
    expect(cards[1].querySelector('.lib-card__follows')).toBeNull()

    const rule = el => el.querySelector('.deck-card__aside').getBoundingClientRect().left
    const fig = el => el.querySelector('.deck-card__fig').getBoundingClientRect().top
      - el.getBoundingClientRect().top

    for (const el of cards.slice(1)) {
      expect(rule(el)).toBeCloseTo(rule(cards[0]), 1)
      expect(fig(el)).toBeCloseTo(fig(cards[0]), 1)
    }
  })

  // A learner's text has no spaces where the column needs them. A deck
  // named in one run-on word, by an author named in another, used to
  // set straight through the aside's hairline and under the count; the
  // body is the only place either is allowed to be.
  it('breaks a run-on name rather than setting it through the rule', async () => {
    const el = await card({
      ...DECK,
      name: 'Verbesirreguliersdutroisiemegroupe',
      author: 'KeenSakura6224666666',
      description: '',
    })
    const rule = el.querySelector('.deck-card__aside').getBoundingClientRect().left
    // The text's own extent, not its box's: a flex item's box stops at
    // the body's edge whether the line inside it does or not, so a rect
    // over the box would pass either way.
    for (const sel of ['.platform-card__title', '.platform-card__desc']) {
      const range = document.createRange()
      range.selectNodeContents(el.querySelector(sel))
      const box = range.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.right).toBeLessThanOrEqual(rule)
    }
  })
})
