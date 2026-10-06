import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import tours from '../../testing/grammarTour.json'
import '../../index.css'

// ── 発見 — the tour before a never-met point (plan 187b) ─────────
// Look, guess, found, terminus: a wrong guess is answered by the
// lesson's own line for that rival, the hint comes after one miss and
// the rule after two, the gate waits for a pick, and the terminus
// hands back what it took. The fixture is the payload the backend
// serves for 〜てください (study/grammar_tour.py), in English, and for
// か, whose tour is written (plan 187c): its twist and its scene join
// the line before the terminus, voiced (187d).

const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))
vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(),
  speakLine: (...a) => speakLine(...a), stopSpeaking: vi.fn(),
}))
const speakLine = vi.fn(async () => true)

const { GrammarTour } = await import('./GrammarTour')

const TOUR = tours.en
const POINT = {
  raw_id: 'grammar_N5_〜てください', level: 'N5', pattern: '〜てください',
  structure: 'verb て-form + ください', meaning: 'please do', tour: TOUR,
}
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const idx = pattern => TOUR.guesses.findIndex(g => g.pattern === pattern)
const right = TOUR.guesses.findIndex(g => g.correct)

async function mount(over = {}) {
  const onBoard = vi.fn()
  const onLesson = vi.fn()
  const screen = await render(
    <LangProvider>
      <GrammarTour point={{ ...POINT, ...over }} onBoard={onBoard} onLesson={onLesson} />
    </LangProvider>
  )
  await settle()
  const root = () => screen.container.querySelector('.tour')
  const gate = () => root().querySelector('.tour__foot .btn-depart')
  const guess = i => root().querySelector(`[data-guess="${i}"]`)
  return { screen, root, gate, guess, onBoard, onLesson }
}

beforeEach(() => {
  track.mockReset()
  speakLine.mockClear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => { localStorage.removeItem('lang') })

describe('the tour', () => {
  it('looks at three examples with the point lit, on a track of four stops', async () => {
    const { root } = await mount()
    expect(root().dataset.stop).toBe('look')
    expect(root().querySelectorAll('.tour__stop')).toHaveLength(4)
    expect(root().querySelector('.tour__stop--here')).toBe(root().querySelectorAll('.tour__stop')[0])
    expect(root().querySelector('.tour__q').textContent).toBe('What does 〜てください do?')
    const sentences = root().querySelectorAll('.tour-look .dict-ex')
    expect(sentences).toHaveLength(3)
    for (const s of sentences) expect(s.querySelector('.dict-ex__hl')).toBeTruthy()
    expect(root().querySelector('.tour__foot .brd__link')).toBeNull()
  })

  it('answers a wrong guess with the rival’s own line, then gives the rule after two', async () => {
    const { root, gate, guess, onBoard, onLesson } = await mount()
    gate().click()
    await settle()
    expect(root().dataset.stop).toBe('guess')
    // The gate is the outline until a pick wakes it.
    expect(gate().disabled).toBe(true)

    guess(idx('〜をください')).click()
    await settle()
    expect(guess(idx('〜をください')).getAttribute('aria-checked')).toBe('true')
    expect(gate().disabled).toBe(false)
    gate().click()
    await settle()
    const said = root().querySelector('.tour-said--no')
    expect(said.querySelector('.tour-said__head').textContent).toBe('That one is 〜をください.')
    const flat = text => text.replace(/\*\*/g, '').replace(/\s+/g, '')
    expect(flat(said.querySelector('.tour-said__line').textContent)).toBe(flat(TOUR.guesses[idx('〜をください')].answer))
    expect(said.querySelector('.tour-said__hint')).toBeTruthy()
    expect(guess(idx('〜をください')).disabled).toBe(true)
    expect(gate().disabled).toBe(true)

    guess(idx('〜ないでください')).click()
    await settle()
    gate().click()
    await settle()
    // Two misses: the rule is given, the right one ringed, and the gate goes on.
    expect(root().querySelector('.tour-said--given')).toBeTruthy()
    expect(guess(right).classList.contains('tour-guess--ok')).toBe(true)
    expect(gate().disabled).toBe(false)
    gate().click()
    await settle()

    expect(root().dataset.stop).toBe('found')
    // Helped, so no "well spotted".
    expect(root().querySelector('.tour-said--ok')).toBeNull()
    expect(root().querySelector('.tour-chain').textContent).toBe('読む→読んでください')
    gate().click()
    await settle()

    expect(root().dataset.stop).toBe('terminus')
    expect(root().querySelectorAll('.tour-found__line')).toHaveLength(2)
    root().querySelector('.tour__foot .brd__link').click()
    expect(onLesson).toHaveBeenCalledTimes(1)
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 2, helped: true })

    const steps = track.mock.calls.filter(c => c[0] === 'grammar_tour_step').map(c => c[1])
    expect(steps).toEqual([
      { level: 'N5', stop: 'look', outcome: 'first' },
      { level: 'N5', stop: 'guess', outcome: 'helped' },
      { level: 'N5', stop: 'found', outcome: 'first' },
    ])
    expect(track).toHaveBeenCalledWith('grammar_tour_done', { level: 'N5', tries: 2, helped: true, authored: false })
  })

  it('says well spotted for a guess right first time', async () => {
    const { root, gate, guess, onBoard } = await mount()
    gate().click()
    await settle()
    guess(right).click()
    await settle()
    gate().click()
    await settle()
    expect(root().dataset.stop).toBe('found')
    expect(root().querySelector('.tour-said--ok .tour-said__head').textContent).toBe('Well spotted, first time.')
    gate().click()
    await settle()
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 0, helped: false })
    expect(track).toHaveBeenCalledWith('grammar_tour_step', { level: 'N5', stop: 'guess', outcome: 'first' })
  })

  it('a point with no chain prints its formation', async () => {
    const { root, gate, guess } = await mount({ tour: { ...TOUR, chain: null } })
    gate().click()
    await settle()
    guess(right).click()
    await settle()
    gate().click()
    await settle()
    expect(root().querySelector('.tour-chain')).toBeNull()
    expect(root().querySelector('.tour-rule__structure').textContent).toBe(TOUR.structure)
  })
})

const KA = tours.ka
const KA_POINT = {
  raw_id: 'grammar_N5_か', level: 'N5', pattern: 'か',
  structure: 'sentence + か', meaning: 'question marker', tour: KA,
}

async function toTwist(mounted) {
  const { root, gate, guess } = mounted
  gate().click()
  await settle()
  guess(KA.guesses.findIndex(g => g.correct)).click()
  await settle()
  gate().click()
  await settle()
  gate().click()
  await settle()
  expect(root().dataset.stop).toBe('twist')
}

const choice = (root, i) => root().querySelector(`[data-choice="${i}"]`)

describe('the written tour', () => {
  it('rides a stop per notion, then the scene, before the terminus, every line voiced', async () => {
    const mounted = await mount({ ...KA_POINT })
    const { root, gate, onBoard } = mounted
    expect(KA.twists.length).toBeGreaterThan(1)
    expect(root().querySelectorAll('.tour__stop')).toHaveLength(5 + KA.twists.length)
    root().querySelector('.tour-look [data-action="speak"]').click()
    expect(speakLine).toHaveBeenLastCalledWith(KA.look[0].jp, 'reader')

    await toTwist(mounted)
    for (const [i, twist] of KA.twists.entries()) {
      // Each notion named over its question, and which of them it is.
      expect(root().dataset.twist).toBe(String(i))
      expect(root().querySelector('.tour__notion-name').textContent).toBe(twist.notion)
      expect(root().querySelector('.tour__notion-count').textContent).toBe(`${i + 1} of ${KA.twists.length}`)
      expect(root().querySelector('.tour__q').textContent).toBe(twist.ask)
      // The point lit where the sentence writes it.
      expect(Boolean(root().querySelector('.tour-twist .dict-ex__hl'))).toBe(twist.furigana.some(p => p.highlight))
      expect(gate().disabled).toBe(true)
      const wrong = twist.choices.findIndex(c => !c.correct)
      const rightTwist = twist.choices.findIndex(c => c.correct)
      // The first missed, the others right.
      choice(root, i === 0 ? wrong : rightTwist).click()
      await settle()
      gate().click()
      await settle()
      // Checked once: the right one ringed, a wrong pick crossed, the why said.
      expect(choice(root, rightTwist).classList.contains('tour-guess--ok')).toBe(true)
      if (i === 0) expect(choice(root, wrong).classList.contains('tour-guess--no')).toBe(true)
      expect(root().querySelector(i === 0 ? '.tour-said--no' : '.tour-said--ok')).toBeTruthy()
      gate().click()
      await settle()
    }

    expect(root().dataset.stop).toBe('scene')
    expect(root().querySelector('.tour-plate__name').textContent).toContain(KA.scene.place)
    const lines = root().querySelectorAll('.tour-scene .tour-line')
    expect(lines).toHaveLength(KA.scene.lines.length)
    expect(root().querySelector('.tour-line--me .tour-line__who').textContent).toBe('You')
    root().querySelector('[data-action="play-scene"]').click()
    await settle()
    expect(speakLine.mock.calls.map(c => c[1])).toEqual(['reader', ...KA.scene.lines.map(l => l.who)])
    expect(gate().textContent).toContain('Your turn')
    gate().click()
    await settle()

    expect(root().querySelector('.tour__q').textContent).toBe(KA.scene.ask.task)
    expect(root().querySelectorAll('.tour-scene .tour-line')).toHaveLength(1)
    const reply = KA.scene.ask.choices.findIndex(c => c.correct)
    choice(root, reply).click()
    await settle()
    gate().click()
    await settle()
    expect(root().querySelector('.tour-said--ok')).toBeTruthy()
    // The learner's line, heard in their own voice.
    expect(speakLine).toHaveBeenLastCalledWith(KA.scene.ask.choices[reply].jp, 'me')
    gate().click()
    await settle()

    expect(root().dataset.stop).toBe('terminus')
    // The rule, a line per notion under its name, the neighbour.
    expect(root().querySelectorAll('.tour-found__line')).toHaveLength(KA.twists.length + 2)
    expect([...root().querySelectorAll('.tour-found__notion')].map(n => n.textContent)).toEqual(KA.twists.map(tw => tw.notion))
    expect(root().querySelector('.tour-reply__ja').textContent).toBe(KA.scene.ask.choices[reply].jp)
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 0, helped: false })
    const steps = track.mock.calls.filter(c => c[0] === 'grammar_tour_step').map(c => c[1].stop + ':' + c[1].outcome)
    expect(steps).toEqual(['look:first', 'guess:first', 'found:first', 'twist:retry', ...KA.twists.slice(1).map(() => 'twist:first'), 'scene:first'])
    expect(track).toHaveBeenCalledWith('grammar_tour_done', { level: 'N5', tries: 0, helped: false, authored: true })
  })

  it('stops playing the scene through once a line is tapped alone', async () => {
    const mounted = await mount({ ...KA_POINT })
    const { root, gate } = mounted
    await toTwist(mounted)
    for (let i = 0; i < KA.twists.length; i++) {
      choice(root, 0).click()
      await settle()
      gate().click()
      await settle()
      gate().click()
      await settle()
    }
    expect(root().dataset.stop).toBe('scene')
    // Each line ends when the test says so.
    const ends = []
    speakLine.mockClear()
    speakLine.mockImplementation(() => new Promise(r => ends.push(r)))
    root().querySelector('[data-action="play-scene"]').click()
    await settle()
    expect(speakLine).toHaveBeenCalledTimes(1)
    root().querySelectorAll('.tour-line [data-action="speak"]')[2].click()
    ends.forEach(r => r(true))
    await settle()
    // The tapped line only: the play-through does not go on to line two.
    expect(speakLine.mock.calls.map(c => c[0])).toEqual([KA.scene.lines[0].jp, KA.scene.lines[2].jp])
    speakLine.mockImplementation(async () => true)
  })
})
