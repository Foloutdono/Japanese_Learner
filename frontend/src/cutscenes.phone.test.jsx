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

// ── The gate stands whole on a phone (plan 144) ─────────────────────
// Its motion kept, its look redrawn. Two of the fixes are faults
// rather than taste, so they are held here: at 110vw the rig was
// squeezed back to the screen's width and ran edge to edge, each
// cabinet's outer side on the glass; and both lamps sat on their
// pillars' OUTER edges, where the comment over them had always put
// them inside, by the lane.
describe('the gate stands whole on a phone (plan 144)', () => {
  it('both cabinets stand clear of the edges of the screen', async () => {
    await SCENES.gate()
    await settle()
    // Measured against the scene's own box, which is the screen less
    // any scrollbar gutter the browser keeps (index.css reserves one).
    const box = document.querySelector('.gate').getBoundingClientRect()
    const rig = document.querySelector('.gate__rig').getBoundingClientRect()
    expect(rig.left - box.left).toBeGreaterThanOrEqual(4)
    expect(box.right - rig.right).toBeGreaterThanOrEqual(4)
  })

  it('each lamp runs down its pillar on the lane side', async () => {
    await SCENES.gate()
    await settle()
    const lane = document.querySelector('.gate__lane').getBoundingClientRect()
    const [left, right] = [...document.querySelectorAll('.gate__lamp')].map(l => l.getBoundingClientRect())
    const [pl, pr] = [...document.querySelectorAll('.gate__pillar')].map(p => p.getBoundingClientRect())
    // Each nearer the lane than its pillar's outer edge.
    expect(lane.left - left.right).toBeLessThan(left.left - pl.left)
    expect(right.left - lane.right).toBeLessThan(pr.right - right.right)
  })
})

// ── The gate's objects stand clear of each other ───────────────────
// The owner found things on top of each other in the gate, and effects
// that read as faults. Each was one: the pass came to rest over the
// reader it taps (it is two and a half cabinets wide) and hung over the
// right flap; the right lamp ran up into the reader; the wipe was the
// scene's box at a 50% radius, an oval that was never quite opaque, so
// the rig showed through the wash as the scene faded; and the fade held
// its end only `backwards`, so a late unmount was a frame of the whole
// scene again. Measured with the scene's own animations, not a clock.
describe('the gate stands clear of itself', () => {
  const anim = (el, name) => el.getAnimations().find(a => a.animationName === name)
  const box = s => document.querySelector(s).getBoundingClientRect()

  it('the pass comes to rest on the reader\'s head, over neither the reader nor the lane', async () => {
    await SCENES.gate()
    await settle()
    // Its place at rest is the tap: the keyframes hold it there, untransformed.
    anim(document.querySelector('.gate__card'), 'gate-tap').cancel()
    anim(document.querySelector('.gate__rig'), 'arrive')?.cancel()
    const [card, reader, lane, scene] = ['.gate__card', '.gate__reader', '.gate__lane', '.gate'].map(box)
    expect(card.bottom).toBeLessThanOrEqual(reader.top + 0.5)
    expect(reader.top - card.bottom).toBeLessThan(3)
    expect(card.bottom).toBeLessThan(lane.top)
    // Over the pad, and on the screen.
    expect(card.left).toBeLessThan(reader.left)
    expect(card.right).toBeGreaterThan(reader.right)
    expect(card.right).toBeLessThanOrEqual(scene.right)
    expect(card.top).toBeGreaterThanOrEqual(scene.top)
  })

  it('the lamp under the reader starts below it', async () => {
    await SCENES.gate()
    await settle()
    const reader = box('.gate__reader')
    const lamp = document.querySelector('.gate__pillar--right .gate__lamp').getBoundingClientRect()
    expect(lamp.top).toBeGreaterThan(reader.bottom)
  })

  it('the lane\'s light is whole, and has the scene, before the scene fades', async () => {
    await SCENES.gate()
    await settle()
    const gate = document.querySelector('.gate')
    const lane = document.querySelector('.gate__lane')
    const end = a => a.effect.getComputedTiming().endTime
    const leave = anim(gate, 'gate-leave')
    const fadeFrom = leave.effect.getComputedTiming().delay
    expect(end(anim(document.querySelector('.gate__wipe'), 'gate-flood'))).toBeLessThanOrEqual(fadeFrom)
    expect(end(anim(document.querySelector('.gate__rig'), 'gate-through'))).toBeLessThanOrEqual(fadeFrom)
    // Pushed to --gate-push about the lane's centre, the lane covers the scene.
    const push = parseFloat(gate.style.getPropertyValue('--gate-push'))
    expect(lane.clientWidth * push).toBeGreaterThanOrEqual(gate.clientWidth)
    expect(lane.clientHeight * push).toBeGreaterThanOrEqual(gate.clientHeight)
    // And the fade keeps its end until the scene is taken down.
    expect(['forwards', 'both']).toContain(leave.effect.getComputedTiming().fill)
  })

  it('lends the window\'s gutter its wash once the light has the screen, and takes it back', async () => {
    vi.useFakeTimers()
    try {
      const done = await SCENES.gate()
      const ground = () => document.documentElement.style.getPropertyValue('--gate-ground')
      await vi.advanceTimersByTimeAsync(600 * 1.4)
      expect(ground()).toBe('')
      await vi.advanceTimersByTimeAsync(35 * 1.4)
      expect(ground()).toBe('var(--line-kana)')
      await vi.advanceTimersByTimeAsync(10 * 1.4)
      expect(ground()).toBe('')
      await vi.advanceTimersByTimeAsync(200 * 1.4)
      expect(done).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives the gutter back when it is skipped', async () => {
    vi.useFakeTimers()
    try {
      await SCENES.gate()
      await vi.advanceTimersByTimeAsync(632 * 1.4)
      expect(document.documentElement.style.getPropertyValue('--gate-ground')).not.toBe('')
      window.dispatchEvent(new PointerEvent('pointerdown'))
      expect(document.documentElement.style.getPropertyValue('--gate-ground')).toBe('')
      expect(document.documentElement.style.getPropertyValue('transition')).toBe('')
    } finally {
      vi.useRealTimers()
    }
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
