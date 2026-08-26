import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Transcript } from './Transcript'

const T = {}

function sentenceFixture(overrides = {}) {
  return { text: 'テスト文です。', cue_start: 0, cue_end: 2, unknown_count: 0, ...overrides }
}

describe('Transcript', () => {
  it('renders one row per Sentence and marks the active one', async () => {
    const sentences = [sentenceFixture({ text: '一つ目' }), sentenceFixture({ text: '二つ目' })]
    const screen = await render(
      <Transcript sentences={sentences} activeIndex={1} onSeek={() => {}} t={T} />
    )
    const rows = screen.container.querySelectorAll('.video-transcript__row')
    expect(rows.length).toBe(2)
    expect(rows[1].className).toContain('video-transcript__row--active')
    expect(rows[0].className).not.toContain('video-transcript__row--active')
  })

  it('calls onSeek with the clicked row index', async () => {
    const onSeek = vi.fn()
    const sentences = [sentenceFixture({ text: 'A' }), sentenceFixture({ text: 'B' })]
    const screen = await render(
      <Transcript sentences={sentences} activeIndex={0} onSeek={onSeek} t={T} />
    )
    screen.container.querySelectorAll('.video-transcript__row')[1].click()
    expect(onSeek).toHaveBeenCalledWith(1)
  })

  it('flags an i+1 Sentence (unknown_count === 1) and not others', async () => {
    const sentences = [
      sentenceFixture({ text: 'A', unknown_count: 0 }),
      sentenceFixture({ text: 'B', unknown_count: 1 }),
      sentenceFixture({ text: 'C', unknown_count: 3 }),
    ]
    const screen = await render(
      <Transcript sentences={sentences} activeIndex={0} onSeek={() => {}} t={T} />
    )
    const flags = screen.container.querySelectorAll('.video-transcript__i-plus-one')
    expect(flags.length).toBe(1)
  })
})
