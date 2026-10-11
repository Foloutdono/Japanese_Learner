import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import cards from '../../testing/grammarLadder.json'
import '../../index.css'

// ── 194 — Choisir, Construire, the point's roundel ─────────────
// The owner's pick (option C): no band and no plate; the point's roundel
// in the card's top-right corner, in the stage word's place, its group
// named in plain words; the sentence and its hole on the front, its
// translation under it; the answer turning the card once, to the
// sentence echoed small with the answer in its hole, the point, and the
// lesson's line on a rival taken; Choisir's forms as the mock exam's
// answer tiles; Construire's entry under the card, as the practice runs
// take theirs. The fixtures are the cards the backend builds for
// 〜てください at Choisir 2 and Construire 2 (srs/ladder.py).

vi.mock('../../lib/track', () => ({ track: vi.fn() }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))

const { GrammarChoose, GrammarConstruire, GrammarTiles, LadderMap, PointLine } = await import('./GrammarPlate')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function Toggle({ card }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <>
      <GrammarChoose card={card} revealed={revealed} selected={revealed ? card.grammar : null} />
      <button type="button" className="answer" onClick={() => setRevealed(true)}>answer</button>
    </>
  )
}

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

describe('the point’s roundel', () => {
  it('cuts the ring into the group’s steps, the one asked in ink, its number inside, the group named in plain words', async () => {
    const root = (await mount(<div className="prompt-card prompt-card--footed"><div className="prompt-card__body"><PointLine card={cards.choose} /></div></div>)).container
    const ring = root.querySelector('.gl-ring')
    // In the card's top-right corner, where the stage's word stands on
    // a card off the ladder.
    const card = root.querySelector('.prompt-card').getBoundingClientRect()
    const box = ring.getBoundingClientRect()
    expect(card.right - box.right).toBeLessThan(24)
    expect(box.top - card.top).toBeLessThan(20)
    expect(ring.getAttribute('aria-label')).toBe('This point: Choose, step 2 of 3')
    expect(root.querySelectorAll('.gl-ring__arc')).toHaveLength(3)
    expect(root.querySelectorAll('.gl-ring__arc--on')).toHaveLength(1)
    expect(root.querySelectorAll('.gl-ring__arc--now')).toHaveLength(1)
    expect(root.querySelector('.gl-ring__n').textContent).toBe('2')
    expect(root.querySelector('.gl-ring__name').textContent).toBe('Choose')
    expect(root.querySelector('.gl-ring__of').textContent).toBe('2 / 3')
    expect(ring.textContent).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
  })

  it('counts Construire’s four', async () => {
    const root = (await mount(<PointLine card={cards.build} />)).container
    expect(root.querySelectorAll('.gl-ring__arc')).toHaveLength(4)
    expect(root.querySelector('.gl-ring__name').textContent).toBe('Build')
    expect(root.querySelector('.gl-ring__of').textContent).toBe('2 / 4')
  })

  it('closes the ring round a star once mastered', async () => {
    const root = (await mount(<PointLine card={cards.mastered} />)).container
    expect(root.querySelectorAll('.gl-ring__arc')).toHaveLength(1)
    expect(root.querySelector('.gl-ring__arc--on')).toBeTruthy()
    expect(root.querySelector('.gl-ring__n').textContent).toBe('★')
    expect(root.querySelector('.gl-ring__name').textContent).toBe('Mastered')
    expect(root.querySelector('.gl-ring__of')).toBeNull()
  })

  it('says again once missed, in the miss’s ink', async () => {
    const root = (await mount(<PointLine card={cards.choose} missed />)).container
    expect(root.querySelector('.gl-ring__arc--miss')).toBeTruthy()
    expect(root.querySelector('.gl-ring__of--miss').textContent).toBe('again')
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

  it('turns to the answer once answered: the trap named, the sentence echoed with the right form in its hole, the point, the lesson’s line on the rival', async () => {
    const rival = card.contrast.choices.find(c => c !== card.grammar && card.contrast.why[c])
    const root = (await mount(<GrammarChoose card={card} revealed selected={rival} />)).container
    const back = root.querySelector('.gl-card .gl-back')
    expect(back.querySelector('.gl-back__head--no').textContent).toBe(`${rival.replace(/^〜/, '')}, the trap`)
    expect(back.querySelector('.gl-echo .gl-gap--filled').textContent).toBe(card.grammar.replace(/^〜/, ''))
    expect(back.querySelector('.gl-echo .gl-tr').textContent).toBe(card.contrast.tr)
    expect(back.querySelector('.grammar-answer')).toBeTruthy()
    expect(back.querySelector('.gl-back__why').textContent).toBe(card.contrast.why[rival])
    expect(root.querySelector('.gl-ring__arc--miss')).toBeTruthy()
  })

  it('turns once: nothing is left on the other side, so a tap or Space leaves the answer up', async () => {
    const screen = await mount(<Toggle card={card} />)
    const root = screen.container
    root.querySelector('.gl-card').click()
    await settle()
    expect(root.querySelector('.gl-front .gl-gap:not(.gl-gap--filled)')).toBeTruthy()
    root.querySelector('.answer').click()
    await settle()
    expect(root.querySelector('.flashcard__face--turned .gl-back__head--ok').textContent).toBe('Right.')
    root.querySelector('.gl-card').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await settle()
    expect(root.querySelector('.gl-back')).toBeTruthy()
    expect(root.querySelector('.gl-front:not(.gl-echo .gl-front)')).toBeNull()
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
    // The practice runs' entry: the page's field and the filled action.
    const go = root.querySelector('form.gl-entry .btn-primary')
    expect(root.querySelector('form.gl-entry .field.field--page')).toBeTruthy()
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
    expect(root.querySelector('.gl-back .grammar-answer')).toBeTruthy()
    expect(root.querySelector('.gl-entry')).toBeNull()
  })

  it('says almost, and in the echoed hole crosses out the one kana off with the right one over it', async () => {
    apiJson.mockResolvedValue(cards.checks.close)
    const screen = await mount(<Run card={card} onDone={() => {}} />)
    const root = screen.container
    await screen.getByLabelText('Your answer').fill(cards.checks.typed.close)
    root.querySelector('form.gl-entry .btn-primary').click()
    await settle()
    expect(root.querySelector('.gl-back__head--no').textContent).toBe('Almost.')
    expect(root.querySelector('.gl-ring__arc--miss')).toBeTruthy()
    const fix = root.querySelector('.gl-echo .gl-gap--filled .gl-fix')
    expect(fix.querySelector('s').textContent).toBe('で')
    expect(fix.querySelector('ins').textContent).toBe('て')
  })
})
