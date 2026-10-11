import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import cards from '../../testing/grammarLadder.json'
import '../../index.css'

// ── 194 — Choisir, Construire, the point's steps ──────────────
// The owner's second round: no band and no plate; the point's steps a
// quiet line at the card's head (no Japanese in a label); the sentence
// and its hole on the card, its translation under it; Choisir's forms
// as the mock exam's answer tiles; the reveal a flashcard's turn to the
// back -- what happened, the sentence whole with the point picked out,
// the point -- and a tap turning it back and forth. The fixtures are the
// cards the backend builds for 〜てください at Choisir 2 and Construire 2
// (srs/ladder.py).

vi.mock('../../lib/track', () => ({ track: vi.fn() }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))

const { GrammarChoose, GrammarConstruire, GrammarTiles, LadderMap, PointLine } = await import('./GrammarPlate')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function Run({ card, onDone }) {
  const [answered, setAnswered] = useState(false)
  return <GrammarConstruire card={card} answered={answered} onDone={() => { onDone(); setAnswered(true) }} session={null} />
}

async function mount(node) {
  const screen = await render(<LangProvider>{node}</LangProvider>)
  await settle()
  return screen
}

beforeEach(() => { apiJson.mockReset(); localStorage.setItem('lang', 'en') })
afterEach(() => { localStorage.removeItem('lang') })

describe('the point’s steps', () => {
  it('draws Choisir’s three stops and Construire’s four, the one asked ringed, named in plain words', async () => {
    const root = (await mount(<PointLine card={cards.choose} />)).container
    const walk = root.querySelector('.gl-walk')
    expect(walk.getAttribute('aria-label')).toBe('This point: Choose, step 2 of 3')
    expect(root.querySelectorAll('.gl-walk__dot')).toHaveLength(7)
    expect(root.querySelectorAll('.gl-walk__dot--on')).toHaveLength(1)
    expect(root.querySelector('.gl-walk__dot--now')).toBeTruthy()
    expect(root.querySelector('.gl-walk__name').textContent).toBe('Choose 2/3')
    expect(walk.textContent).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
  })

  it('fills every stop and lights the star once mastered', async () => {
    const root = (await mount(<PointLine card={cards.mastered} />)).container
    expect(root.querySelectorAll('.gl-walk__dot--on')).toHaveLength(7)
    expect(root.querySelector('.gl-walk__star--on')).toBeTruthy()
    expect(root.querySelector('.gl-walk__name').textContent).toBe('Mastered')
  })

  it('maps the walk on the desk, each stop with its wait', async () => {
    const root = (await mount(<LadderMap card={cards.build} />)).container
    const stops = [...root.querySelectorAll('.gl-map__stop')]
    expect(stops.map(s => s.querySelector('.gl-map__name').textContent)).toEqual([
      'Tutorial', 'Choose 1', 'Choose 2', 'Choose 3', 'Build 1', 'Build 2', 'Build 3', 'Build 4', 'Mastered',
    ])
    expect(root.querySelector('[aria-current="step"] .gl-map__name').textContent).toBe('Build 2')
    expect(stops[6].querySelector('.gl-map__when').textContent).toBe('+4 d')
  })
})

describe('Choisir', () => {
  const card = cards.choose
  it('asks the sentence and its hole, the translation under it, and no band', async () => {
    const root = (await mount(<GrammarChoose card={card} />)).container
    const front = root.querySelector('.gl-card .gl-front')
    expect(front.querySelector('.gl-sent .gl-gap')).toBeTruthy()
    expect(front.querySelector('.gl-tr').textContent).toBe(card.contrast.tr)
    expect(root.querySelector('.gl-band, .gl-plate')).toBeNull()
    expect(root.querySelector('.gl-back')).toBeNull()
  })

  it('turns to the back once answered: the trap named, the sentence whole, the point; a tap turns it back', async () => {
    const rival = card.contrast.choices.find(c => c !== card.grammar && card.contrast.why[c])
    const root = (await mount(<GrammarChoose card={card} revealed selected={rival} />)).container
    const back = root.querySelector('.gl-card .gl-back')
    expect(back.querySelector('.gl-back__head--no').textContent).toBe(`${rival.replace(/^〜/, '')}, the trap`)
    expect(back.querySelector('.gl-back__why').textContent).toBe(card.contrast.why[rival])
    // The point picked out as every example picks it, never a coloured rule.
    expect(back.querySelector('.gl-back__sentence .dict-ex__hl')).toBeTruthy()
    expect(back.querySelector('.grammar-answer')).toBeTruthy()
    root.querySelector('.gl-card').click()
    await settle()
    expect(root.querySelector('.gl-front')).toBeTruthy()
    root.querySelector('.gl-card').click()
    await settle()
    expect(root.querySelector('.gl-back')).toBeTruthy()
  })

  it('offers the forms as the exam’s tiles, a bubble and the form, and marks them once answered', async () => {
    const onAnswer = vi.fn()
    const choices = card.contrast.choices
    const screen = await mount(
      <GrammarTiles choices={choices} correct={card.grammar} readings={card.choices_furigana}
                    selected={null} answered={false} onAnswer={onAnswer} />,
    )
    const tiles = [...screen.container.querySelectorAll('.gl-dock .gl-tile')]
    expect(tiles).toHaveLength(choices.length)
    expect(tiles.map(b => b.querySelector('.gl-tile__b').textContent)).toEqual(choices.map((_, i) => String(i + 1)))
    // The form as written in a sentence: no 〜.
    expect(tiles.every(b => !b.querySelector('.gl-tile__t').textContent.startsWith('〜'))).toBe(true)
    tiles[1].click()
    expect(onAnswer).toHaveBeenCalledWith(choices[1])
    const wrong = choices.find(c => c !== card.grammar)
    await screen.rerender(
      <LangProvider>
        <GrammarTiles choices={choices} correct={card.grammar} readings={card.choices_furigana}
                      selected={wrong} answered onAnswer={onAnswer} />
      </LangProvider>,
    )
    await settle()
    expect(screen.container.querySelector('.gl-tile--ok [lang="ja"]').textContent).toBe(card.grammar.replace(/^〜/, ''))
    expect(screen.container.querySelector('.gl-tile--no')).toBeTruthy()
  })
})

describe('Construire', () => {
  const card = cards.build

  it('gives the translation, takes what is typed in the hole and turns to the point when right', async () => {
    apiJson.mockResolvedValue(cards.checks.right)
    const onDone = vi.fn()
    const screen = await mount(<Run card={card} onDone={onDone} />)
    const root = screen.container
    expect(root.querySelector('.gl-tr--lead').textContent).toBe(card.build.tr)
    const go = root.querySelector('.gl-ticket__go')
    expect(go.disabled).toBe(true)
    await screen.getByLabelText('Your answer').fill('tekudasai')
    await settle()
    expect(root.querySelector('.gl-gap--typed').textContent).toBe('tekudasai')
    go.click()
    await settle()
    expect(onDone).toHaveBeenCalledTimes(1)
    const [url, , init] = apiJson.mock.calls[0]
    expect(url).toBe('/api/grammar/build/check?lang=en')
    expect(JSON.parse(init.body)).toEqual({ raw_id: card.raw_id, key: card.build.key, answers: ['tekudasai'] })
    expect(root.querySelector('.flashcard__face--turned .gl-back__head--ok').textContent).toBe('Right.')
    expect(root.querySelector('.gl-back__sentence .dict-ex__hl')).toBeTruthy()
    expect(root.querySelector('.gl-ticket')).toBeNull()
  })

  it('crosses out the one kana off and writes the right one over it, on the back', async () => {
    apiJson.mockResolvedValue(cards.checks.close)
    const screen = await mount(<Run card={card} onDone={() => {}} />)
    const root = screen.container
    await screen.getByLabelText('Your answer').fill(cards.checks.typed.close)
    root.querySelector('.gl-ticket__go').click()
    await settle()
    const fix = root.querySelector('.gl-back__mine .gl-fix')
    expect(fix.querySelector('s').textContent).toBe('で')
    expect(fix.querySelector('ins').textContent).toBe('て')
    expect(root.querySelector('.gl-back__head--no').textContent).toBe('Almost.')
    expect(root.querySelector('.gl-walk__dot--miss')).toBeTruthy()
  })
})
