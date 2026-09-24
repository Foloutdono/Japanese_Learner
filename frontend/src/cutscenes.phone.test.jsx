import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── A key that skips a cutscene is spent on it (plan 123) ──────────
// The 改札, the train door and the arrival each cut to their end on
// any key, and each plays over a screen that is already mounted: the
// ride's first card under the gate, a run under the door, the plan
// under the arrival. The skip never took the key, so the same Space
// also turned the card underneath (and on the desk the same Esc left
// the ride the gate was opening). Now the key is caught in the capture
// phase and stopped, and a browser chord still skips without being
// taken from the browser.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playGateChime: vi.fn(), playDoorChime: vi.fn(), playDoorSlide: vi.fn(), playPlatformChime: vi.fn(),
}))
vi.mock('./stores/profileSummary', () => ({ useProfileSummary: () => ({ username: 'aiko', level: 3 }) }))

const { TicketGate } = await import('./components/station/TicketGate')
const { TrainArrival } = await import('./components/onboarding/TrainArrival')
const { TrainDoor } = await import('./components/station/TrainDoor')
const { board } = await import('./stores/boarding')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
let under
afterEach(() => { if (under) window.removeEventListener('keydown', under); under = null })

// What the screen under the scene would do with the key: a window
// listener in the bubble phase, as a run's Space and a desk's Esc are.
function screenUnder() {
  under = vi.fn()
  window.addEventListener('keydown', under)
  return under
}

const SCENES = {
  gate: async () => {
    const onDone = vi.fn()
    await render(<TicketGate section={{ color: 'var(--line-kana)', name: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={onDone} />)
    return onDone
  },
  arrival: async () => {
    const onDone = vi.fn()
    await render(<TrainArrival jp="案内" title="Tour" onDone={onDone} />)
    return onDone
  },
  door: async () => {
    const onDone = vi.fn()
    await render(<LangProvider><MemoryRouter initialEntries={['/learn/kana']}><TrainDoor /></MemoryRouter></LangProvider>)
    board(onDone)
    return onDone
  },
}

describe('a cutscene spends the key that skips it', () => {
  for (const [name, mount] of Object.entries(SCENES)) {
    it(`the ${name}: Space skips it and never reaches the screen under it`, async () => {
      const heard = screenUnder()
      const done = await mount()
      await settle()
      await userEvent.keyboard(' ')
      await settle()
      expect(done).toHaveBeenCalledTimes(1)
      expect(heard).not.toHaveBeenCalled()
    })

    it(`the ${name}: a browser chord skips it but is left to the browser`, async () => {
      const heard = screenUnder()
      const done = await mount()
      await settle()
      const chord = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true })
      window.dispatchEvent(chord)
      await settle()
      expect(done).toHaveBeenCalledTimes(1)
      expect(chord.defaultPrevented).toBe(false)
      expect(heard).toHaveBeenCalledTimes(1)
    })
  }
})
