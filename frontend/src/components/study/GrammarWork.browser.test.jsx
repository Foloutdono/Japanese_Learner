import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import cards from '../../testing/grammarLadder.json'
import tours from '../../testing/grammarTour.json'
import '../../index.css'

// ── 書く — write (plan 187e), and the plate's two ghosts ──────────
// A write asks composition's check and shows what was said, the
// detector's word and one way to say it. The plate's two ghosts run the
// tour again, from its start or at its scene, recording nothing. The
// ladder's own exercises are GrammarPlate.browser.test.jsx's (plan 194).
// The fixtures are the payloads the backend builds for 〜てください
// (study/grammar_ladder.py) and か's tour.

const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))
vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(),
  speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))

const { GrammarWrite } = await import('./GrammarWork')
const { GrammarLesson } = await import('./GrammarLesson')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// The run's reveal, as TodayRun and GrammarRun hold it.
function Run({ Exercise, card, onDone }) {
  const [answered, setAnswered] = useState(false)
  return <Exercise card={card} answered={answered} onDone={() => { onDone(); setAnswered(true) }} session={null} />
}

async function mount(node) {
  const screen = await render(<LangProvider>{node}</LangProvider>)
  await settle()
  return screen
}

beforeEach(() => {
  track.mockReset()
  apiJson.mockReset()
  localStorage.setItem('lang', 'en')
})
afterEach(() => { localStorage.removeItem('lang') })

describe('write', () => {
  const card = cards.write
  const W = card.write

  it('asks the check, then says whether the point is there and how one would say it', async () => {
    apiJson.mockResolvedValue({ found: true, japanese: 'はいってください' })
    const onDone = vi.fn()
    const screen = await mount(<Run Exercise={GrammarWrite} card={card} onDone={onDone} />)
    const root = screen.container
    expect(root.querySelector('.wrt-cue__situation').textContent).toBe(W.situation)
    expect([...root.querySelectorAll('.wrt-word')].map(w => w.textContent))
      .toEqual(W.helpers.map(h => h.text + (h.reading ?? '')))
    const field = root.querySelector('.wrt-form .field')
    const check = root.querySelector('.wrt-form button[type="submit"]')
    expect(check.disabled).toBe(true)

    await screen.getByLabelText('Your sentence (kana or rōmaji)').fill('haitte kudasai')
    await settle()
    expect(field.value).toBe('haitte kudasai')
    check.click()
    await settle()
    expect(onDone).toHaveBeenCalledTimes(1)
    const [url, , init] = apiJson.mock.calls[0]
    expect(url).toBe('/api/composition/check')
    expect(JSON.parse(init.body)).toEqual({ raw_id: card.raw_id, sentence: 'haitte kudasai' })
    expect(root.querySelector('.wrt-said__mine').textContent).toBe('はいってください')
    expect(root.querySelector('.wrt-said__found--ok').textContent).toBe('The pattern is there.')
    expect(root.querySelector('.wrt-said .dict-ex__hl')).toBeTruthy()
  })

  it('prints no verdict where the detector is not trusted', async () => {
    apiJson.mockResolvedValue({ found: null, japanese: null })
    const screen = await mount(<Run Exercise={GrammarWrite} card={card} onDone={() => {}} />)
    const root = screen.container
    await screen.getByLabelText('Your sentence (kana or rōmaji)').fill('入ってください')
    root.querySelector('.wrt-form button[type="submit"]').click()
    await settle()
    expect(root.querySelector('.wrt-said__mine').textContent).toBe('入ってください')
    expect(root.querySelector('.wrt-said__found')).toBeNull()
  })
})

describe('the plate’s two ghosts', () => {
  const KA = tours.ka
  const point = {
    raw_id: 'grammar_N5_か', level: 'N5', pattern: 'か', structure: 'sentence + か',
    meaning: 'question marker', steps: [], compare: [], examples: [], tour: KA,
    tour_record: { done_at: '2026-10-05T09:00:00+00:00', tries: 2, helped: false },
  }

  it('says how the point was met and runs the tour again at its scene, recording nothing', async () => {
    const screen = await mount(<GrammarLesson point={point} variant="sheet" />)
    const root = screen.container
    expect(root.querySelector('.gl-tour__record').textContent).toMatch(/^Found on .+ · 2 misses$/)
    root.querySelector('[data-action="replay-scene"]').click()
    await settle()
    const tour = root.querySelector('.gl-replay .tour')
    expect(tour.dataset.stop).toBe('scene')
    expect(root.querySelector('.gl-body')).toBeNull()
    // The quiet way to the lesson is not offered: this is the lesson.
    expect(root.querySelector('.tour__foot [data-action="lesson"]')).toBeNull()
    root.querySelector('.tour__foot .btn-depart').click()
    await settle()
    expect(root.querySelector('.gl-replay .tour').dataset.stop).toBe('scene')
    const right = KA.scene.ask.choices.findIndex(c => c.correct)
    root.querySelector(`[data-choice="${right}"]`).click()
    await settle()
    root.querySelector('.tour__foot .btn-depart').click()
    await settle()
    root.querySelector('.tour__foot .btn-depart').click()
    await settle()
    // The usages and the quiz follow the scene (plan 194): ride them.
    for (let n = 0; n < 40 && root.querySelector('.gl-replay .tour').dataset.stop !== 'terminus'; n++) {
      const gate = root.querySelector('.tour__foot .btn-depart')
      if (gate.disabled) root.querySelector('.tour__body [data-choice="0"]').click()
      else gate.click()
      await settle()
    }
    expect(root.querySelector('.gl-replay .tour').dataset.stop).toBe('terminus')
    const back = root.querySelector('.tour__foot .btn-depart')
    expect(back.textContent).toContain('Back to the lesson')
    back.click()
    await settle()
    expect(root.querySelector('.gl-replay')).toBeNull()
    expect(root.querySelector('.gl-body')).toBeTruthy()
    expect(track).not.toHaveBeenCalled()
  })

  it('offers the whole tour where the point has no scene, and nothing where it has no tour', async () => {
    const plain = { ...point, tour: { ...KA, scene: null }, tour_record: null }
    let screen = await mount(<GrammarLesson point={plain} variant="sheet" />)
    expect(screen.container.querySelector('[data-action="replay"]')).toBeTruthy()
    expect(screen.container.querySelector('[data-action="replay-scene"]')).toBeNull()
    expect(screen.container.querySelector('.gl-tour__record')).toBeNull()
    screen.unmount()
    screen = await mount(<GrammarLesson point={{ ...point, tour: null }} variant="sheet" />)
    expect(screen.container.querySelector('.gl-tour')).toBeNull()
  })
})
