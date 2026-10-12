import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import tours from '../../testing/grammarTour.json'
import '../../index.css'

// ── 発見 — the tour before a never-met point (plan 187b) ─────────
// Look, guess, found, results: a wrong guess is answered by the
// lesson's own line for that rival, the hint comes after one miss and
// the rule after two, the gate waits for a pick, and the results hand
// back what it took. The fixture is the payload the backend serves for
// 〜てください (study/grammar_tour.py), in English -- its derived half
// alone here -- and for か, whose tour is written (plan 187c): since
// plan 194 its scene comes after the rule, then « That's not all! », a
// stop per usage with two readings and its translation said once it is
// answered (plan 196), then the quiz, voiced (187d).

const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))
vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(),
  speakLine: (...a) => speakLine(...a), stopSpeaking: vi.fn(),
}))
const speakLine = vi.fn(async () => true)

const { GrammarTour, Results } = await import('./GrammarTour')

// The derived half alone: look, guess, found, results.
const TOUR = { ...tours.en, twists: [], scene: null, quiz: null }
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
    // No quiz to score: the results are the point and its sheet.
    expect(root().querySelector('.tour-score')).toBeNull()
    root().querySelector('[data-action="lesson"]').click()
    expect(onLesson).toHaveBeenCalledTimes(1)
    expect(gate().textContent).toContain('Start: Choose 1')
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 2, helped: true, quizRight: null, quizTotal: null })

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
    expect(onBoard).toHaveBeenCalledWith({ tries: 0, helped: false, quizRight: null, quizTotal: null })
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

async function toScene(mounted) {
  const { root, gate, guess } = mounted
  gate().click()
  await settle()
  guess(KA.guesses.findIndex(g => g.correct)).click()
  await settle()
  gate().click()
  await settle()
  gate().click()
  await settle()
  expect(root().dataset.stop).toBe('scene')
}

const choice = (root, i) => root().querySelector(`[data-choice="${i}"]`)

describe('the written tour', () => {
  it('rides the scene, a stop per usage, then the quiz, to the results, every line voiced', async () => {
    const mounted = await mount({ ...KA_POINT })
    const { root, gate, onBoard } = mounted
    expect(KA.twists.length).toBeGreaterThan(1)
    expect(KA.quiz.length).toBeGreaterThanOrEqual(4)
    // look, guess, found, scene, the usages, the quiz, the results.
    expect(root().querySelectorAll('.tour__stop')).toHaveLength(6 + KA.twists.length)
    root().querySelector('.tour-look [data-action="speak"]').click()
    expect(speakLine).toHaveBeenLastCalledWith(KA.look[0].jp, 'reader')

    await toScene(mounted)
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
    const reply = KA.scene.ask.choices.findIndex(c => c.correct)
    choice(root, reply).click()
    await settle()
    gate().click()
    await settle()
    expect(root().querySelector('.tour-said--ok')).toBeTruthy()
    expect(speakLine).toHaveBeenLastCalledWith(KA.scene.ask.choices[reply].jp, 'me')
    gate().click()
    await settle()

    for (const [i, twist] of KA.twists.entries()) {
      expect(root().dataset.stop).toBe('twist')
      expect(root().dataset.twist).toBe(String(i))
      // « That's not all! » over the usage's notion, which of them it is.
      expect(root().querySelector('.tour__notion-head').textContent).toBe("That's not all!")
      expect(root().querySelector('.tour__notion-name').textContent).toBe(twist.notion)
      expect(root().querySelector('.tour__notion-count').textContent).toBe(`${i + 1} of ${KA.twists.length}`)
      expect(root().querySelector('.tour__q').textContent).toBe(twist.ask)
      // Two readings to choose from, and the sentence NOT translated: its
      // translation was the answer to « what does it say? » (plan 196).
      expect(root().querySelector('.tour-twist .dict-ex__tr')).toBeNull()
      expect(root().querySelectorAll('.tour-guesses [data-choice]')).toHaveLength(2)
      expect(gate().disabled).toBe(true)
      const wrong = twist.choices.findIndex(c => !c.correct)
      const rightTwist = twist.choices.findIndex(c => c.correct)
      choice(root, i === 0 ? wrong : rightTwist).click()
      await settle()
      gate().click()
      await settle()
      // Answered: the translation is said.
      expect(root().querySelector('.tour-twist .dict-ex__tr').textContent).toBe(twist.tr)
      expect(choice(root, rightTwist).classList.contains('tour-guess--ok')).toBe(true)
      if (i === 0) expect(choice(root, wrong).classList.contains('tour-guess--no')).toBe(true)
      expect(root().querySelector(i === 0 ? '.tour-said--no' : '.tour-said--ok')).toBeTruthy()
      gate().click()
      await settle()
    }

    // The quiz: every question right but the first.
    for (const [i, q] of KA.quiz.entries()) {
      expect(root().dataset.stop).toBe('quiz')
      expect(root().querySelector('.tour__notion-count').textContent).toBe(`Question ${i + 1} of ${KA.quiz.length}`)
      const rightQ = q.choices.findIndex(c => c.correct)
      const wrongQ = q.choices.findIndex(c => !c.correct)
      expect(root().querySelector('.tour__notion-head').textContent.length).toBeGreaterThan(0)
      // A meaning is read with no translation under it until it is answered
      // (plan 196); a form says what the sentence says, it being the thing
      // to say.
      if (q.kind === 'meaning') expect(root().querySelector('.tour-twist .dict-ex__tr')).toBeNull()
      if (q.kind === 'form') expect(root().querySelector('.tour-twist .dict-ex__tr').textContent).toBe(q.tr)
      choice(root, i === 0 ? wrongQ : rightQ).click()
      await settle()
      gate().click()
      await settle()
      if (q.kind === 'meaning') expect(root().querySelector('.tour-twist .dict-ex__tr').textContent).toBe(q.tr)
      // The trap, where the question has one, is named once it is checked.
      if (q.choices.some(c => c.trap)) expect(root().querySelector('.tour-guesses .tour-trap')).toBeTruthy()
      gate().click()
      await settle()
    }

    expect(root().dataset.stop).toBe('terminus')
    expect(root().querySelector('.tour-score__right').textContent).toBe(String(KA.quiz.length - 1))
    const rows = root().querySelectorAll('.tour-recap__row')
    expect(rows).toHaveLength(KA.quiz.length)
    expect(rows[0].classList.contains('tour-recap__row--no')).toBe(true)
    // The score is a dial, one arc a question: the miss's ink on the
    // first, the success ink on the rest; the point stands beside it.
    const arcs = [...root().querySelectorAll('.tour-tally__arc')]
    expect(arcs).toHaveLength(KA.quiz.length)
    expect(arcs[0].classList.contains('tour-tally__arc--no')).toBe(true)
    expect(arcs.slice(1).every(a => a.classList.contains('tour-tally__arc--ok'))).toBe(true)
    expect(root().querySelector('.tour-end .tour-pattern').textContent).toBe('か')
    // The first was missed: what was taken is struck under the right one.
    expect(rows[0].querySelector('.tour-recap__fix')).toBeTruthy()
    // Each row says its kind, and the heading is for a screen reader.
    expect(rows[0].querySelector('.tour-recap__kind').textContent.length).toBeGreaterThan(0)
    expect(root().querySelector('.tour__q.sr-only').textContent).toBe('Results')
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 0, helped: false, quizRight: KA.quiz.length - 1, quizTotal: KA.quiz.length })
    const steps = track.mock.calls.filter(c => c[0] === 'grammar_tour_step').map(c => c[1].stop + ':' + c[1].outcome)
    expect(steps).toEqual(['look:first', 'guess:first', 'found:first', 'scene:first', 'twist:retry',
      ...KA.twists.slice(1).map(() => 'twist:first'), 'quiz:retry'])
    expect(track).toHaveBeenCalledWith('grammar_tour_done', { level: 'N5', tries: 0, helped: false, authored: true })
  })

  it('stops playing the scene through once a line is tapped alone', async () => {
    const mounted = await mount({ ...KA_POINT })
    const { root } = mounted
    await toScene(mounted)
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

describe('the results', () => {
  const GAP = tours.en.quiz.findIndex(q => q.kind === 'gap')

  it('writes a missed gap\'s right form into its sentence, the form taken struck under it', async () => {
    const picks = tours.en.quiz.map(q => q.choices.findIndex(c => c.correct))
    const taken = tours.en.quiz[GAP].choices.findIndex(c => !c.correct)
    picks[GAP] = taken
    const screen = await render(
      <LangProvider>
        <Results tour={tours.en} point={POINT} picks={picks} onLesson={() => {}} replay={false} />
      </LangProvider>
    )
    const rows = screen.container.querySelectorAll('.tour-recap__row')
    const row = rows[GAP]
    expect(row.classList.contains('tour-recap__row--no')).toBe(true)
    const right = tours.en.quiz[GAP].choices.find(c => c.correct).pattern.replace(/^[〜～]/, '')
    expect(row.querySelector('.tour-recap__form').textContent).toBe(right)
    expect(row.querySelector('.tour-recap__fix').textContent)
      .toBe(tours.en.quiz[GAP].choices[taken].pattern.replace(/^[〜～]/, ''))
    // The sentence stands whole, its hole filled.
    expect(row.querySelector('.tour-recap__jp').textContent).toContain(right)
    expect(screen.container.querySelectorAll('.tour-tally__arc--no')).toHaveLength(1)
    expect(screen.container.querySelector('.tour-score__right').textContent).toBe(String(tours.en.quiz.length - 1))
  })
})

// ── Plan 196: the quiz asks what only understanding answers ───────
// ない形 〜ない, whose tutorial is the owner's reference: a form, a
// meaning and a reply, none of them « which of these uses it? ».

const NAI = tours.nai
const NAI_POINT = {
  raw_id: 'grammar_N5_ない形 〜ない', level: 'N5', pattern: 'ない形 〜ない',
  structure: 'う-verb あ-row ・ る-verb stem + ない', meaning: 'the plain negative', tour: NAI,
}

// A sentence as written, without the readings set over its kanji.
function written(node) {
  const copy = node.cloneNode(true)
  copy.querySelectorAll('rt').forEach(rt => rt.remove())
  return copy.textContent
}

async function mountQuiz() {
  const onBoard = vi.fn()
  const screen = await render(
    <LangProvider>
      <GrammarTour point={NAI_POINT} onBoard={onBoard} onLesson={vi.fn()} startAt="quiz" />
    </LangProvider>
  )
  await settle()
  const root = () => screen.container.querySelector('.tour')
  const gate = () => root().querySelector('.tour__foot .btn-depart')
  return { screen, root, gate, onBoard }
}

describe('the quiz', () => {
  it('has no question that is answered by finding the point in a sentence', () => {
    expect(NAI.quiz.length).toBeGreaterThanOrEqual(4)
    expect(NAI.quiz.every(q => ['meaning', 'form', 'use', 'gap'].includes(q.kind))).toBe(true)
    // Never the same kind twice running, and no sentence stands twice in the tour.
    NAI.quiz.slice(1).forEach((q, i) => expect(q.kind).not.toBe(NAI.quiz[i].kind))
    const seen = [
      ...NAI.look.map(x => x.jp), ...NAI.twists.map(x => x.jp),
      ...NAI.scene.lines.map(x => x.jp), NAI.scene.ask.cue.jp, ...NAI.scene.ask.choices.map(c => c.jp),
      ...NAI.quiz.flatMap(q => (q.kind === 'meaning' || q.kind === 'form' ? [q.jp] : q.choices.map(c => c.jp).filter(Boolean))),
    ]
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('reads a meaning with no translation until it is answered, builds a form into its blank, answers a situation', async () => {
    const { root, gate, onBoard } = await mountQuiz()
    for (const [i, q] of NAI.quiz.entries()) {
      expect(root().dataset.stop).toBe('quiz')
      expect(root().querySelector('.tour__q').textContent).toBe(q.ask)
      expect(root().querySelector('.tour__notion-count').textContent).toBe(`Question ${i + 1} of ${NAI.quiz.length}`)
      const tr = () => root().querySelector('.tour-twist .dict-ex__tr')
      if (q.kind === 'meaning') {
        // The sentence, and not what it says.
        expect(written(root().querySelector('.tour-twist .dict-ex__jp'))).toBe(q.jp)
        expect(tr()).toBeNull()
      } else if (q.kind === 'form') {
        // The sentence with its hole, and what the whole says as the thing to say.
        expect(root().querySelectorAll('.gl-blank')).toHaveLength(1)
        expect(tr().textContent).toBe(q.tr)
        expect(written(root().querySelector('.tour-twist .dict-ex__jp'))).not.toContain(q.choices.find(c => c.correct).jp)
      } else {
        // A situation and three lines of Japanese: no sentence card at all.
        expect(root().querySelector('.tour-twist')).toBeNull()
      }
      if (q.kind !== 'meaning') {
        const lines = [...root().querySelectorAll('.tour-guess__text--ja')].map(n => n.textContent)
        expect(lines).toEqual(q.choices.map(c => c.jp))
      }
      expect(gate().disabled).toBe(true)
      root().querySelector(`[data-choice="${q.choices.findIndex(c => c.correct)}"]`).click()
      await settle()
      gate().click()
      await settle()
      expect(root().querySelector('.tour-said--ok')).toBeTruthy()
      // (The lesson's inline set puts a thin space where Japanese meets Latin.)
      const flat = text => text.replace(/\s+/g, ' ')
      expect(flat(root().querySelector('.tour-said__line').textContent)).toBe(flat(q.why.replace(/\*\*/g, '')))
      if (q.kind === 'meaning') expect(tr().textContent).toBe(q.tr)
      // The blank is filled with the right form, marked, once it is checked.
      if (q.kind === 'form') expect(root().querySelector('.gl-blank--revealed').textContent).toBe(q.choices.find(c => c.correct).jp)
      gate().click()
      await settle()
    }
    expect(root().dataset.stop).toBe('terminus')
    expect(root().querySelector('.tour-score__right').textContent).toBe(String(NAI.quiz.length))
    const rows = root().querySelectorAll('.tour-recap__row')
    expect(rows).toHaveLength(NAI.quiz.length)
    // A form's row says the sentence with the right form in it.
    const formAt = NAI.quiz.findIndex(q => q.kind === 'form')
    expect(rows[formAt].querySelector('.tour-recap__form').textContent).toBe(NAI.quiz[formAt].choices.find(c => c.correct).jp)
    gate().click()
    expect(onBoard).toHaveBeenCalledWith({ tries: 0, helped: false, quizRight: NAI.quiz.length, quizTotal: NAI.quiz.length })
  }, 30000)

  it('strikes what a missed form, meaning or reply took on the results', async () => {
    const picks = NAI.quiz.map(q => q.choices.findIndex(c => !c.correct))
    const screen = await render(
      <LangProvider>
        <Results tour={NAI} point={NAI_POINT} picks={picks} onLesson={() => {}} replay={false} />
      </LangProvider>
    )
    const rows = [...screen.container.querySelectorAll('.tour-recap__row')]
    expect(rows).toHaveLength(NAI.quiz.length)
    for (const [i, q] of NAI.quiz.entries()) {
      expect(rows[i].classList.contains('tour-recap__row--no')).toBe(true)
      const taken = q.choices[picks[i]]
      expect(rows[i].querySelector('.tour-recap__fix').textContent).toBe(taken.text ?? taken.jp)
    }
    expect(screen.container.querySelector('.tour-score__right').textContent).toBe('0')
  })
})
