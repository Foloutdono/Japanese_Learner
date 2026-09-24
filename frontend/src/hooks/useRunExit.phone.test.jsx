import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'

// ── Leaving a run never leaves the run in the history ──────────────
// A run's way out used to PUSH its platforms, so the history read
// platforms, run, platforms and Back re-boarded the run just left.
// useRunExit goes back one entry when the run was boarded from those
// platforms in this tab (stores/boarding's returnsTo), and otherwise
// replaces the run with them. Either way Back never shows the run.

const boarding = vi.hoisted(() => ({ returns: false }))
vi.mock('../stores/boarding', async o => ({ ...(await o()), returnsTo: () => boarding.returns }))

const { useRunExit } = await import('./useRunExit')

const PLATFORMS = '/learn/kana/hiragana_basic'
const RUN = `${PLATFORMS}/kana.flashcard.f2b`
const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))

function Run() {
  const leave = useRunExit(PLATFORMS)
  return <button type="button" className="probe-leave" onClick={leave}>leave</button>
}
function Platforms() {
  const navigate = useNavigate()
  return <button type="button" className="probe-back" onClick={() => navigate(-1)}>platforms</button>
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/learn', PLATFORMS, RUN]} initialIndex={2}>
      <Routes>
        <Route path="/learn" element={<p className="probe-gate">gate</p>} />
        <Route path={PLATFORMS} element={<Platforms />} />
        <Route path={RUN} element={<Run />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => { boarding.returns = false })

describe('a run\'s way out', () => {
  it('steps back to the platforms it was boarded from', async () => {
    boarding.returns = true
    const screen = await mount()
    screen.container.querySelector('.probe-leave').click()
    await settle()
    screen.container.querySelector('.probe-back').click()
    await settle()
    expect(screen.container.querySelector('.probe-gate')).not.toBeNull()
  })

  it('replaces the run when it was not boarded from them', async () => {
    const screen = await mount()
    screen.container.querySelector('.probe-leave').click()
    await settle()
    expect(screen.container.querySelector('.probe-back')).not.toBeNull()
    screen.container.querySelector('.probe-back').click()
    await settle()
    // Back lands on the platforms pushed before the run, never the run.
    expect(screen.container.querySelector('.probe-leave')).toBeNull()
  })
})

describe('the boarding record', () => {
  it('is spent by the asking', async () => {
    const real = await vi.importActual('../stores/boarding')
    window.history.pushState({ ...window.history.state, idx: 1 }, '')
    real.board(() => {})
    expect(real.returnsTo(window.location.pathname)).toBe(true)
    expect(real.returnsTo(window.location.pathname)).toBe(false)
    real.board(() => {})
    expect(real.returnsTo('/elsewhere')).toBe(false)
    real.endBoarding()
  })
})
