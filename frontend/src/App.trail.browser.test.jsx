// ── 足跡 — the observer beside <Routes/>, against a real router ──
//
// Two failures this pins, both of which leave a working app:
//
//   A pathname reaching track(). The unit test on routePattern proves
//   the function is safe; this proves Trail actually calls it, rather
//   than passing `pathname` straight through -- which is a one-word
//   edit away at any time and breaks nothing visible.
//
//   One event per RENDER instead of per navigation. Trail sits beside
//   <Routes/>, so it re-renders whenever App does; an effect with the
//   wrong dependency array would multiply every screen_view by however
//   many times the tree happened to render, and the counts would look
//   plausible while being wrong.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'

const track = vi.fn()
vi.mock('./lib/track', () => ({ track }))

const { Trail } = await import('./App')

function Harness({ to }) {
  const navigate = useNavigate()
  return (
    <>
      <Trail />
      <button type="button" onClick={() => navigate(to)}>go</button>
      <Routes>
        <Route path="*" element={<p>screen</p>} />
      </Routes>
    </>
  )
}

beforeEach(() => track.mockClear())

describe('Trail', () => {
  it('records the pattern, never the path', async () => {
    await render(
      <MemoryRouter initialEntries={['/learn/vocab/theme/animaux/level/N4/recognition']}>
        <Harness to="/today" />
      </MemoryRouter>,
    )
    expect(track).toHaveBeenCalledWith('screen_view', {
      route: '/learn/vocab/theme/:theme/level/:themeLevel/:mode',
      tab: 'learn',
    })
    const [, props] = track.mock.calls[0]
    expect(JSON.stringify(props)).not.toContain('animaux')
  })

  it('records once per navigation, not once per render', async () => {
    const screen = await render(
      <MemoryRouter initialEntries={['/today']}>
        <Harness to="/practice" />
      </MemoryRouter>,
    )
    expect(track).toHaveBeenCalledTimes(1)

    await screen.getByRole('button', { name: 'go' }).click()
    expect(track).toHaveBeenCalledTimes(2)
    expect(track.mock.calls[1]).toEqual(['screen_view', { route: '/practice', tab: 'practice' }])
  })

  it('says nothing at all about a path it does not recognise', async () => {
    // Returning the raw path here is the leak; staying silent is the
    // only safe answer for a path no route declared.
    await render(
      <MemoryRouter initialEntries={['/nothing/like/a/route']}>
        <Harness to="/today" />
      </MemoryRouter>,
    )
    expect(track).not.toHaveBeenCalled()
  })

  it('carries the deck id no further than its pattern', async () => {
    await render(
      <MemoryRouter initialEntries={['/learn/decks/8f21/study']}>
        <Harness to="/today" />
      </MemoryRouter>,
    )
    const [, props] = track.mock.calls[0]
    expect(props.route).toBe('/learn/decks/:deck_id/study')
    expect(props.route).not.toContain('8f21')
  })
})
