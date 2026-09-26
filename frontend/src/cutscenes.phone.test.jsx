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

// ── The door opens before it leaves (plan 144) ─────────────────────
// The shipped door landed over the menu on the tap's own frame, and
// faded its whole scene out from 882ms with the leaves still 85% of
// the way across, so the doors dissolved rather than opened. Now it
// fades in, the leaves finish their travel, the header and the sill
// step off the screen after them, and the scene unmounts with nothing
// of it left to fade. Read off the animations themselves, so the test
// holds the order of the beats rather than a wall-clock guess at them.
describe('the door opens before it leaves (plan 144)', () => {
  const ends = anims => anims.map(a => a.effect.getComputedTiming().endTime)

  it('arrives by fading in, and never fades out', async () => {
    await SCENES.door()
    await settle(20)
    const names = document.querySelector('.door').getAnimations().map(a => a.animationName)
    expect(names).toContain('door-in')
    expect(names).not.toContain('door-leave')
  })

  it('the leaves are open before the frame has left, and the frame has left before the scene ends', async () => {
    await SCENES.door()
    const start = performance.now()
    await settle(20)
    const door = document.querySelector('.door')
    const all = door.getAnimations({ subtree: true })
    const leaves = ends(all.filter(a => a.animationName.startsWith('door-part-')))
    const frame = ends(all.filter(a => ['door-head-out', 'door-sill-out'].includes(a.animationName)))
    expect(leaves).toHaveLength(2)
    expect(frame).toHaveLength(2)
    expect(Math.max(...leaves)).toBeLessThanOrEqual(Math.min(...frame))
    await vi.waitFor(() => expect(document.querySelector('.door')).toBeNull(), { timeout: 3000, interval: 10 })
    // The scene came down no earlier than its frame's last frame.
    expect(performance.now() - start + 20).toBeGreaterThanOrEqual(Math.max(...frame))
  })
})

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
