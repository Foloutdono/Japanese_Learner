// ── 車両 — the shell's listeners, bound once ──────────────────
// The widget's Depart starts the app on its run. NativeBridge bound the
// openings again whenever the path moved (react-router's `navigate` is
// a new function at every path), each binding read the start's link
// again, and the learner was boarded again on every way out of the run.
// lib/native.js reads that link once a run now; this pins the other
// half: the listeners are bound once, and still read the path and the
// router of the moment.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'

const openings = []
const backButtons = []
const bindOpenings = vi.fn(async fn => { openings.push(fn); return () => {} })
const bindBackButton = vi.fn(async fn => { backButtons.push(fn); return () => {} })
const exitApp = vi.fn()

vi.mock('../../lib/platform', async importOriginal => ({
  ...(await importOriginal()),
  isNative: () => true,
  nativePlatform: () => 'android',
  bindOpenings: fn => bindOpenings(fn),
  bindBackButton: fn => bindBackButton(fn),
  bindResume: async () => () => {},
  exitApp: () => exitApp(),
  syncNudges: async () => {},
  syncAgenda: async () => {},
  updateWidget: async () => {},
}))
vi.mock('../../stores/profileSummary', () => ({
  useProfileSummaryState: () => ({ summary: { notifications: false, reminderTime: null } }),
}))
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: null, at: 0 }),
  refreshToday: () => {},
}))
vi.mock('../../stores/agenda', () => ({
  useAgenda: () => ({ blocks: null }),
  refreshAgenda: () => {},
}))
vi.mock('../../LangContext', () => ({ useLang: () => ({ t: {}, lang: 'en' }) }))
vi.mock('../../lib/track', () => ({ track: () => {} }))

const { NativeBridge } = await import('./NativeBridge')

function Harness() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <>
      <NativeBridge />
      <output data-testid="path">{pathname}</output>
      <button type="button" onClick={() => navigate('/today')}>leave</button>
      <button type="button" onClick={() => navigate('/practice')}>practice</button>
      <Routes>
        <Route path="*" element={<p>screen</p>} />
      </Routes>
    </>
  )
}

const mount = () => render(
  <MemoryRouter initialEntries={['/today']}>
    <Harness />
  </MemoryRouter>,
)

beforeEach(() => {
  openings.length = 0
  backButtons.length = 0
  bindOpenings.mockClear()
  bindBackButton.mockClear()
  exitApp.mockClear()
})

describe('NativeBridge', () => {
  it('binds the openings once, however often the path moves', async () => {
    const screen = await mount()
    await vi.waitFor(() => expect(openings).toHaveLength(1))

    // The widget's Depart boards the run ...
    openings[0]({ to: '/today/run', via: 'widget' })
    await expect.element(screen.getByTestId('path')).toHaveTextContent('/today/run')

    // ... and the learner can leave it, and go anywhere after.
    await screen.getByRole('button', { name: 'leave' }).click()
    await expect.element(screen.getByTestId('path')).toHaveTextContent(/^\/today$/)
    await screen.getByRole('button', { name: 'practice' }).click()
    await expect.element(screen.getByTestId('path')).toHaveTextContent('/practice')

    expect(bindOpenings).toHaveBeenCalledTimes(1)
  })

  it('binds the back button once, and it reads the path of the moment', async () => {
    const screen = await mount()
    await vi.waitFor(() => expect(backButtons).toHaveLength(1))

    openings[0]({ to: '/today/run', via: 'widget' })
    await expect.element(screen.getByTestId('path')).toHaveTextContent('/today/run')

    // In the run, back steps out of it, to the gate behind.
    backButtons[0]({ canGoBack: true })
    await expect.element(screen.getByTestId('path')).toHaveTextContent(/^\/today$/)
    expect(exitApp).not.toHaveBeenCalled()

    // At the gate's root, back leaves the app. The path reaches the
    // listener in an effect, after the commit the DOM already shows.
    await new Promise(r => setTimeout(r, 50))
    backButtons[0]({ canGoBack: true })
    expect(exitApp).toHaveBeenCalledTimes(1)
    expect(bindBackButton).toHaveBeenCalledTimes(1)
  })
})
