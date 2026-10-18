import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { outcomesOf } from '../../domain/ladderLine'
import { ratingButtons } from '../../domain/ratingScales'
import en from '../../locales/en'
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
const { choiceAnswer } = await import('../../domain/cardShape')

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

  // Plan 198: a stop done wears a check and a stop in hand is lit; neither
  // prints a word (it is for a screen reader), and only a stop ahead says
  // its wait.
  it('checks the stops done and leaves them, and the stop in hand, to say nothing', async () => {
    const root = (await mount(<LadderMap card={cards.build} />)).container
    const stops = [...root.querySelectorAll('.gl-map__stop')]
    expect(stops.map(s => s.className.match(/gl-map__stop--(done|now|ahead)/)[1])).toEqual([
      'done', 'done', 'done', 'done', 'done', 'now', 'ahead', 'ahead', 'ahead',
    ])
    expect(root.querySelectorAll('.gl-map__stop--done .gl-map__dot svg')).toHaveLength(5)
    expect(root.querySelectorAll('.gl-map__when')).toHaveLength(3)
    expect(root.querySelector('.gl-map__stop--done > .sr-only').textContent).toBe('done')
    expect(root.querySelector('.gl-map__stop--now > .sr-only').textContent).toBe('now')
    expect(root.querySelector('.gl-outs')).toBeNull()
  })

  it('opens the stop in hand into what each rating does, a row an outcome', async () => {
    const verdicts = ratingButtons('simple', en).map((b, i) => ({ ...b, digit: i + 1 })).reverse()
    const outcomes = outcomesOf(cards.choose, verdicts, en)
    const root = (await mount(<LadderMap card={cards.choose} outcomes={outcomes} />)).container
    const stop = root.querySelector('[aria-current="step"]')
    expect(stop.classList.contains('gl-map__stop--outs')).toBe(true)
    const rows = [...stop.querySelectorAll(':scope > .gl-outs > .gl-out')]
    expect(rows.map(r => r.className)).toEqual(['gl-out gl-out--stay', 'gl-out gl-out--next gl-out--pass'])
    expect(rows.map(r => [...r.querySelectorAll('.gl-out__key')].map(k => k.textContent))).toEqual([
      ['4Wrong', '3Almost'], ['2Difficult', '1Correct'],
    ])
    expect(rows.map(r => r.querySelector('.gl-out__when').textContent)).toEqual(['10min', '1h'])
    // The keys and the wait are drawn; a screen reader hears each row whole.
    expect(rows.every(r => r.querySelector('.gl-out__keys').getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(rows.map(r => r.querySelector(':scope > .sr-only').textContent)).toEqual([
      'Wrong, Almost: try again, in 10 min',
      'Difficult, Correct: next step, in 1 h',
    ])
    expect(stop.querySelector('.gl-outs').getAttribute('aria-label')).toBe('What each rating does')
  })

  it('names the relapse a miss once mastered is, and says a pass stays mastered', async () => {
    const verdicts = ratingButtons('simple', en).map((b, i) => ({ ...b, digit: i + 1 })).reverse()
    const root = (await mount(<LadderMap card={cards.mastered} outcomes={outcomesOf(cards.mastered, verdicts, en)} />)).container
    const rows = [...root.querySelectorAll('.gl-out')]
    expect(rows.map(r => r.className)).toEqual([
      'gl-out gl-out--back', 'gl-out gl-out--stay gl-out--pass', 'gl-out gl-out--stay gl-out--pass',
    ])
    expect(rows[0].querySelector('.gl-out__note').textContent).toBe('Relapse')
    expect(rows.slice(1).every(r => !r.querySelector('.gl-out__note'))).toBe(true)
    expect(rows[0].querySelector(':scope > .sr-only').textContent).toBe('Wrong, Almost: relapse, in 10 min')
    expect(rows[2].querySelector(':scope > .sr-only').textContent).toMatch(/^Correct: stays mastered, in /)
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

  it('fills the hole with what the sentence has there, never the pattern poured back in', async () => {
    // から〜まで is blanked on its から: 十時＿＿＿七時まで. The pattern in
    // the hole read 十時から〜まで七時まで.
    const split = {
      ...card,
      grammar: 'から〜まで',
      contrast: {
        ...card.contrast,
        jp: '店は十時から七時までです。',
        furigana: [{ text: '店は十時' }, { text: '＿＿＿', blank: true }, { text: '七時までです。' }],
        fill: [{ text: 'から' }],
        choices: ['から〜まで', 'まで〜から'],
        answer: 'から〜まで',
      },
    }
    const root = (await mount(<GrammarChoose card={split} revealed selected="から〜まで" />)).container
    expect(root.querySelector('.gl-echo .gl-gap--filled').textContent).toBe('から')
    expect(root.querySelector('.gl-echo .gl-sent').textContent).toBe('店は十時から七時までです。')
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

// ── 200 — Choisir on a question of its own ─────────────────────────
// A point the contrast drill cannot blank (は, です／だ, 可能形...) is asked
// from questions written by hand (study/grammar_choose.py): the choices are
// forms that stand in the hole, not catalogue points, so the answer is the
// form the card names, the hole turns to what stood in it, and a tile with
// kanji carries its ruby. The fixture is the card the backend builds for
// 可能形 〜(ら)れる at Choisir 1.
describe('Choisir, on a question of its own', () => {
  const card = cards.authored
  const answer = card.contrast.answer
  const wrong = card.contrast.choices.find(c => c !== answer)

  it('is judged against the form in the hole, not the point', () => {
    expect(choiceAnswer(card)).toBe(answer)
    expect(choiceAnswer(card)).not.toBe(card.grammar)
    // a contrast on patterns answers with its point, as before
    expect(choiceAnswer(cards.choose)).toBe(cards.choose.grammar)
  })

  it('asks the sentence and its hole, the translation under it', async () => {
    const root = (await mount(<GrammarChoose card={card} />)).container
    const front = root.querySelector('.gl-card .gl-front')
    expect(front.querySelector('.gl-sent .gl-gap')).toBeTruthy()
    expect(front.querySelector('.gl-tr').textContent).toBe(card.contrast.tr)
    expect(front.querySelector('.gl-gap--filled')).toBeNull()
  })

  it('turns to the answer: the hole holds the form that stood in it, with its ruby, and the wrong tile is answered', async () => {
    const root = (await mount(<GrammarChoose card={card} revealed selected={wrong} />)).container
    const back = root.querySelector('.gl-card .gl-back')
    expect(back.querySelector('.gl-back__head--no').textContent).toBe(`${wrong}, the trap`)
    const filled = back.querySelector('.gl-echo .gl-gap--filled')
    // the form as the sentence has it, not the point's name
    expect(filled.textContent.replace(/\s+/g, '')).toBe('使つかえません')
    expect(filled.querySelector('ruby rt').textContent).toBe('つか')
    expect(back.querySelector('.gl-echo .gl-tr').textContent).toBe(card.contrast.tr)
    expect(back.querySelector('.grammar-answer')).toBeTruthy()
    expect(back.querySelector('.gl-back__why').textContent).toBe(card.contrast.why[wrong])
    expect(root.querySelector('.gl-ring__arc--miss')).toBeTruthy()
  })

  it('says it was right when the form is the one in the hole', async () => {
    const root = (await mount(<GrammarChoose card={card} revealed selected={answer} />)).container
    expect(root.querySelector('.gl-back__head--ok').textContent).toBe('Right.')
    expect(root.querySelector('.gl-back__why')).toBeNull()
    expect(root.querySelector('.gl-ring__arc--miss')).toBeNull()
  })

  it('offers the forms as tiles with their ruby, and marks the right one by the form, not the point', async () => {
    const onAnswer = vi.fn()
    const choices = card.contrast.choices
    const screen = await mount(
      <GrammarTiles choices={choices} correct={choiceAnswer(card)} readings={card.choices_furigana}
                    selected={null} answered={false} onAnswer={onAnswer} />,
    )
    const tiles = [...screen.container.querySelectorAll('.gl-dock .gl-tile')]
    expect(tiles).toHaveLength(choices.length)
    expect(tiles.every(b => b.querySelector('.gl-tile__t ruby rt').textContent === 'つか')).toBe(true)
    tiles[0].click()
    expect(onAnswer).toHaveBeenCalledWith(choices[0])
    await screen.rerender(
      <LangProvider>
        <GrammarTiles choices={choices} correct={choiceAnswer(card)} readings={card.choices_furigana}
                      selected={wrong} answered onAnswer={onAnswer} />
      </LangProvider>,
    )
    await settle()
    expect(screen.container.querySelectorAll('.gl-tile--ok')).toHaveLength(1)
    expect(screen.container.querySelector('.gl-tile--ok [lang="ja"]').textContent.replace(/\s+/g, '')).toBe('使つかえません')
    expect(screen.container.querySelectorAll('.gl-tile--no')).toHaveLength(1)
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

  // Plan 241: です in あしたはテストだ is right -- the translation does
  // not say which register -- and the card says what the sentence has.
  it('takes an answer in the other register as right, and says what the sentence itself has', async () => {
    const copula = {
      ...card,
      card_id: 'grammar_N5_です／だ',
      raw_id: 'grammar_N5_です／だ',
      grammar: 'です／だ',
      build: {
        key: 'tw:2',
        tr: "Tomorrow's the test.",
        pieces: [{ furigana: [{ text: 'あしたはテスト' }] }, { gap: 0, size: 1 }, { furigana: [{ text: '。' }] }],
      },
    }
    // What the backend answers (study/grammar_ladder.check_build).
    apiJson.mockResolvedValue({
      verdict: 'right',
      gaps: [{ verdict: 'right', answer: 'です', reading: 'だ', marks: [], said: 'だ', register: 'plain' }],
      jp: 'あしたはテストだ。',
      tr: "Tomorrow's the test.",
      furigana: [{ text: 'あしたはテスト' }, { text: 'だ', highlight: true }, { text: '。' }],
    })
    const screen = await mount(<Run card={copula} onDone={() => {}} />)
    const root = screen.container
    await screen.getByLabelText('Your answer').fill('desu')
    root.querySelector('form.gl-entry .btn-primary').click()
    await settle()
    expect(root.querySelector('.gl-back__head--ok').textContent).toBe('Right.')
    expect(root.querySelector('.gl-echo .gl-gap--filled').textContent).toBe('です')
    expect(root.querySelector('.gl-back__why').textContent).toBe('The sentence says だ: the same, in plain speech.')
    expect(root.querySelector('.gl-ring__arc--miss')).toBeNull()
  })

  it('says nothing more when the answer is the sentence’s own', async () => {
    apiJson.mockResolvedValue(cards.checks.right)
    const screen = await mount(<Run card={card} onDone={() => {}} />)
    await screen.getByLabelText('Your answer').fill('tekudasai')
    screen.container.querySelector('form.gl-entry .btn-primary').click()
    await settle()
    expect(screen.container.querySelector('.gl-back__why')).toBeNull()
  })
})
