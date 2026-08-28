import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PassageLine } from './PassageLine'

// Retargeted from components/video/Transcript.browser.test.jsx by plan
// 028: the flat transcript became the 路線図, and these three cases are
// the same three invariants -- a stop per Sentence, one of them
// current, and i+1 marked on exactly the ones that are i+1. The fourth
// is new, and pins the accessibility defect the old component had.
const T = {
  iPlusOne: 'One step beyond you',
  routeMap: 'Route map',
  // The group's label carries the count a role="list" would have
  // announced -- see the role note in PassageLine.
  stopsInPassage: n => `${n} sentences`,
  stopNumber: (i, n) => `Sentence ${i} of ${n}`,
  notJapaneseShort: 'not Japanese',
  alreadyExplained: 'already explained',
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

  // Plan 034: a 47-cue subtitle track used to put 47 tab stops between
  // the platform rail and the breakdown. Roving tabindex makes the line
  // ONE tab stop, whatever its length.
  it('is one tab stop, whatever the length', async () => {
    const sentences = Array.from({ length: 20 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={7} onSelect={() => {}} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops.length).toBe(20)
    const zeroTabbable = Array.from(stops).filter(el => el.tabIndex === 0)
    expect(zeroTabbable.length).toBe(1)
    expect(zeroTabbable[0]).toBe(stops[7])
    Array.from(stops).forEach((el, i) => {
      if (i !== 7) expect(el.tabIndex).toBe(-1)
    })
  })

  it('moves along the line with the arrow keys', async () => {
    const onSelect = vi.fn()
    const sentences = Array.from({ length: 5 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={2} onSelect={onSelect} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    stops[2].focus()
    stops[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it('jumps to the termini with Home and End', async () => {
    const onSelect = vi.fn()
    const sentences = Array.from({ length: 5 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={2} onSelect={onSelect} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    stops[2].focus()
    stops[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(onSelect).toHaveBeenCalledWith(4)

    onSelect.mockClear()
    stops[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('steps ten with PageDown', async () => {
    const onSelect = vi.fn()
    const sentences = Array.from({ length: 20 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={onSelect} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    stops[0].focus()
    stops[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }))
    expect(onSelect).toHaveBeenCalledWith(10)
  })

  // Regression guard for the Token-stepper conflict: the screen installs
  // a WINDOW-level ArrowLeft/ArrowRight handler, and without
  // stopPropagation the line's own arrow handling would leak up to it.
  it('stops the arrow event from reaching the window', async () => {
    const sentences = Array.from({ length: 5 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={2} onSelect={() => {}} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    const spy = vi.fn()
    window.addEventListener('keydown', spy)
    try {
      stops[2].focus()
      stops[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
      expect(spy).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', spy)
    }
  })

  it('names each stop with its position', async () => {
    const sentences = Array.from({ length: 20 }, (_, i) => sentenceFixture({ text: `文${i}` }))
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops[2].getAttribute('aria-label').startsWith(T.stopNumber(3, 20))).toBe(true)
  })

  // Plan 038: the route map should show which stops already carry an
  // explanation from a prior deep-tier call.
  it('marks a stop that carries an explanation', async () => {
    const sentences = [
      sentenceFixture({ text: 'A' }),
      sentenceFixture({ text: 'B', explanation: 'これは説明です。' }),
      sentenceFixture({ text: 'C' }),
    ]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    const marks = screen.container.querySelectorAll('.anl-stop__done')
    expect(marks.length).toBe(1)
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops[1].contains(marks[0])).toBe(true)
  })

  it('says so in the stop name', async () => {
    const sentences = [
      sentenceFixture({ text: 'A' }),
      sentenceFixture({ text: 'B', explanation: 'これは説明です。' }),
      sentenceFixture({ text: 'C' }),
    ]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    const stops = screen.container.querySelectorAll('.anl-stop')
    expect(stops[1].getAttribute('aria-label')).toContain(T.alreadyExplained)
    expect(stops[0].getAttribute('aria-label')).not.toContain(T.alreadyExplained)
    expect(stops[2].getAttribute('aria-label')).not.toContain(T.alreadyExplained)
  })

  it('marks nothing when nothing is explained', async () => {
    const sentences = [sentenceFixture({ text: 'A' }), sentenceFixture({ text: 'B' })]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} />
    )
    expect(screen.container.querySelectorAll('.anl-stop__done').length).toBe(0)
  })

  it('does not scroll when scrollOnChange is false', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const sentences = [sentenceFixture({ text: 'A' }), sentenceFixture({ text: 'B' })]
    const screen = await render(
      <PassageLine sentences={sentences} activeIndex={0} onSelect={() => {}} t={T} scrollOnChange={false} />
    )
    spy.mockClear()
    await screen.rerender(
      <PassageLine sentences={sentences} activeIndex={1} onSelect={() => {}} t={T} scrollOnChange={false} />
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
