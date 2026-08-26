import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PassageLine } from './PassageLine'

// Retargeted from components/video/Transcript.browser.test.jsx by plan
// 028: the flat transcript became the 路線図, and these three cases are
// the same three invariants -- a stop per Sentence, one of them
// current, and i+1 marked on exactly the ones that are i+1. The fourth
// is new, and pins the accessibility defect the old component had.
const T = {
  jumpToStop: 'Go to this sentence',
  iPlusOne: 'One step beyond you',
  routeMap: 'Route map',
  // The group's label carries the count a role="list" would have
  // announced -- see the role note in PassageLine.
  stopsInPassage: n => `${n} sentences`,
}

function sentenceFixture(overrides = {}) {
  return { text: 'テスト文です。', cue_start: 0, cue_end: 2, unknown_count: 0, ...overrides }
}

describe('PassageLine', () => {
  it('renders one stop per Sentence and marks the current one', async () => {
    const sentences = [sentenceFixture({ text: '一つ目' }), sentenceFixture({ text: '二つ目' })]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={1} onSelect={() => {}} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops.length).toBe(2)
    expect(stops[1].getAttribute('aria-current')).toBe('true')
    expect(stops[0].getAttribute('aria-current')).toBeNull()
  })

  it('calls onSelect with the clicked stop index', async () => {
    const onSelect = vi.fn()
    const sentences = [sentenceFixture({ text: 'A' }), sentenceFixture({ text: 'B' })]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={onSelect} t={T} />
    )
    screen.container.querySelectorAll('.anl-stop')[1].click()
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('flags an i+1 Sentence (unknown_count === 1) and not others', async () => {
    const sentences = [
      sentenceFixture({ text: 'A', unknown_count: 0 }),
      sentenceFixture({ text: 'B', unknown_count: 1 }),
      sentenceFixture({ text: 'C', unknown_count: 3 }),
    ]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    expect(screen.container.querySelectorAll('.anl-stop__iplus').length).toBe(1)
  })

  // The defect this component fixes: the transcript's rows were
  // <div onClick>, so they were unreachable by keyboard and invisible to
  // a screen reader as controls. Without a test this regresses the first
  // time somebody "simplifies" the markup.
  it('renders every stop as a real button', async () => {
    const sentences = [sentenceFixture({ text: 'A' }), sentenceFixture({ text: 'B' })]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    expect(screen.container.querySelectorAll('button.anl-stop').length).toBe(sentences.length)
    expect(screen.container.querySelectorAll('.anl-stop:not(button)').length).toBe(0)
  })

  // A typed or photographed Passage has no cue times at all; a video one
  // does. The same component draws both, so the timestamp has to be
  // conditional rather than assumed.
  it('shows a timestamp only when the Sentence has a cue time', async () => {
    const withTime = await render(
      <PassageLine sentences={[sentenceFixture({ cue_start: 65 })]} activeIndex={0} onSelect={() => {}} t={T} />
    )
    expect(withTime.container.querySelector('.anl-stop__time').textContent).toBe('1:05')

    const withoutTime = await render(
      <PassageLine
        sentences={[{ text: '猫', unknown_count: 0 }]}
        activeIndex={0}
        onSelect={() => {}}
        t={T}
      />
    )
    expect(withoutTime.container.querySelector('.anl-stop__time')).toBeNull()
  })
})
