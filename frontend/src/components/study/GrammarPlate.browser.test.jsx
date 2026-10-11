import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import cards from '../../testing/grammarLadder.json'
import '../../index.css'

// ── 194 — the grammar plate, the point's line, Choisir, Construire ──
// The owner's pick of the canvas "Tsuji — grammar rework": the sentence
// on the plate with its translation right under it and the band at its
// foot; the point's line over it, Choisir three bars and Construire four
// under their names (no Japanese in a label); Choisir's hole filled with
// the point, lit, and a rival taken answered by the lesson's own line;
// Construire typed into the hole, checked by the server and corrected
// kana by kana. The fixtures are the cards the backend builds for
// 〜てください at Choisir 2 and Construire 2 (srs/ladder.py).

vi.mock('../../lib/track', () => ({ track: vi.fn() }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))

const { GrammarChoose, GrammarConstruire, LadderMap, PointLine } = await import('./GrammarPlate')

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

describe('the point’s line', () => {
  it('draws Choisir’s three bars and Construire’s four under plain names, the step asked taller', async () => {
    const root = (await mount(<PointLine card={cards.choose} />)).container
    const line = root.querySelector('.gl-line')
    expect(line.getAttribute('aria-label')).toBe('This point: Choose, step 2 of 3')
    const segs = root.querySelectorAll('.gl-line__seg')
    expect([...segs].map(s => s.querySelectorAll('.gl-line__bar').length)).toEqual([3, 4])
    expect(segs[0].querySelectorAll('.gl-line__bar--on')).toHaveLength(1)
    expect(segs[0].querySelector('.gl-line__bar--now')).toBeTruthy()
    expect(segs[0].textContent).toBe('Choose2/3')
    // No Japanese in a label (the owner's word).
    expect(line.textContent).not.toMatch(/[぀-ヿ㐀-鿿]/)
  })

  it('fills Choisir and lights the star once mastered', async () => {
    const root = (await mount(<PointLine card={cards.mastered} />)).container
    expect(root.querySelectorAll('.gl-line__bar--on')).toHaveLength(7)
    expect(root.querySelector('.gl-line__star--on').textContent).toContain('Mastered')
  })

  it('maps the walk on the desk, each stop with its wait', async () => {
    const root = (await mount(<LadderMap card={cards.build} />)).container
    const stops = [...root.querySelectorAll('.gl-map__stop')]
    expect(stops.map(s => s.querySelector('.gl-map__name').textContent)).toEqual([
      'Tutorial', 'Choose 1', 'Choose 2', 'Choose 3', 'Build 1', 'Build 2', 'Build 3', 'Build 4', 'Mastered',
    ])
    expect(root.querySelector('[aria-current="step"] .gl-map__name').textContent).toBe('Build 2')
    expect(stops[6].querySelector('.gl-map__when').textContent).toBe('+4 d')
    expect(root.querySelectorAll('.gl-map__stop--done')).toHaveLength(5)
  })
})

describe('Choisir', () => {
  const card = cards.choose
  it('stands the sentence on the plate, the translation under it and the band at its foot', async () => {
    const root = (await mount(<GrammarChoose card={card} />)).container
    const plate = root.querySelector('.gl-plate')
    const body = plate.querySelector('.gl-plate__body')
    expect(body.querySelector('.gl-plate__sent .gl-gap')).toBeTruthy()
    expect(body.querySelector('.gl-plate__tr').textContent).toBe(card.contrast.tr)
    expect(plate.lastElementChild.classList.contains('gl-band')).toBe(true)
    expect(plate.querySelector('.gl-band__prev').textContent).toBe('Choose 1 · passed')
    expect(plate.querySelector('.gl-band__next').textContent).toBe('Choose 3 · in 1 h')
  })

  it('fills the hole with the point, lit, and names a rival taken as the trap', async () => {
    const rival = card.contrast.choices.find(c => c !== card.grammar && card.contrast.why[c])
    const root = (await mount(<GrammarChoose card={card} revealed selected={rival} />)).container
    expect(root.querySelector('.gl-gap--done .gl-lit').textContent).toBe(card.grammar.replace(/^〜/, ''))
    expect(root.querySelector('.gl-said--no .gl-said__head').textContent).toBe(`${rival.replace(/^〜/, '')}, the trap`)
    expect(root.querySelector('.gl-said__line').textContent).toBe(card.contrast.why[rival])
    expect(root.querySelector('.gl-line__bar--miss')).toBeTruthy()
  })

  it('says nothing more when the point is taken', async () => {
    const root = (await mount(<GrammarChoose card={card} revealed selected={card.grammar} />)).container
    expect(root.querySelector('.gl-said')).toBeNull()
  })
})

describe('Construire', () => {
  const card = cards.build

  it('gives the translation, takes what is typed in the hole and is right as read', async () => {
    apiJson.mockResolvedValue(cards.checks.right)
    const onDone = vi.fn()
    const screen = await mount(<Run card={card} onDone={onDone} />)
    const root = screen.container
    expect(root.querySelector('.gl-plate__tr--lead').textContent).toBe(card.build.tr)
    const go = root.querySelector('.gl-ticket__go')
    expect(go.disabled).toBe(true)
    await screen.getByLabelText('Your answer').fill('tekudasai')
    await settle()
    // What is typed shows in the hole as it is typed.
    expect(root.querySelector('.gl-gap--typed').textContent).toBe('tekudasai')
    go.click()
    await settle()
    expect(onDone).toHaveBeenCalledTimes(1)
    const [url, , init] = apiJson.mock.calls[0]
    expect(url).toBe('/api/grammar/build/check?lang=en')
    expect(JSON.parse(init.body)).toEqual({ raw_id: card.raw_id, key: card.build.key, answers: ['tekudasai'] })
    expect(root.querySelector('.gl-gap--done .gl-lit').textContent).toBe(cards.checks.right.gaps[0].answer)
    expect(root.querySelector('.gl-said--ok .gl-said__head').textContent).toBe('Right.')
    expect(root.querySelector('.gl-ticket')).toBeNull()
  })

  it('crosses out the one kana off and writes the right one over it', async () => {
    apiJson.mockResolvedValue(cards.checks.close)
    const screen = await mount(<Run card={card} onDone={() => {}} />)
    const root = screen.container
    await screen.getByLabelText('Your answer').fill(cards.checks.typed.close)
    root.querySelector('.gl-ticket__go').click()
    await settle()
    const fix = root.querySelector('.gl-gap--no .gl-fix')
    expect(fix.querySelector('s').textContent).toBe('で')
    expect(fix.querySelector('ins').textContent).toBe('て')
    expect(root.querySelector('.gl-said--no .gl-said__head').textContent).toBe('Almost.')
    expect(root.querySelector('.gl-said__sent .gl-lit')).toBeTruthy()
    expect(root.querySelector('.gl-line__bar--miss')).toBeTruthy()
  })
})
