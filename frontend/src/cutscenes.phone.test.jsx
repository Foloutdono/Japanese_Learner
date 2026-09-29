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

// ── The gate's arrival (the owner's picks) ──────────────────────────
// The owner kept plan 144's drawing and asked for its ending: the open
// gate grows into view with the line's light until its lane is the
// screen, the destination's name grows with it until it takes the
// screen, and the two hold a beat before fading off the destination.
// That replaced a wipe that was the scene's box at a 50% radius, never
// quite opaque, so the rig showed through it as it faded. With it: the
// pass lifts clear of the reader after the tap, so the reader is seen
// to answer; the fade holds its end, where `backwards` let a late
// unmount show the whole scene again; and a desk's scrollbar gutter
// takes the light. Read off the scene's own animations, not a clock.
describe('the gate grows into view and holds on its name', () => {
  const X = 1.4
  const box = s => document.querySelector(s).getBoundingClientRect()
  const anims = () => document.querySelector('.gate').getAnimations({ subtree: true })
  const named = name => anims().find(a => a.animationName === name)
  const end = a => a.effect.getComputedTiming().endTime
  // Every animation of the scene stopped at `ms` from its mount — the
  // ones this block reads were all started by the mount itself.
  const at = ms => anims().forEach(a => { a.pause(); a.currentTime = ms })

  async function gate(section = {}) {
    const onDone = vi.fn()
    await render(
      <TicketGate
        section={{ color: 'var(--line-vocab)', icon: '単語', title: 'Vocabulary', ...section }}
        station={{ code: 'V01' }}
        onNavigate={() => {}}
        onDone={onDone}
      />,
    )
    await settle()
    return onDone
  }

  it('lifts the pass clear of the reader once the tap has been held', async () => {
    await gate()
    // 68% of the pass's flight: the tap held from 48% to 60%, then up.
    const tap = named('gate-tap')
    tap.pause()
    tap.currentTime = 0.68 * tap.effect.getComputedTiming().activeDuration
    expect(box('.gate__card').bottom).toBeLessThan(box('.gate__reader').top)
  })

  it('floods the lane whole, and grows it over the scene, before the hold', async () => {
    await gate()
    const gateEl = document.querySelector('.gate')
    const lane = document.querySelector('.gate__lane')
    const hold = named('gate-leave').effect.getComputedTiming().delay
    expect(end(named('gate-flood'))).toBeLessThan(end(named('gate-through')))
    expect(end(named('gate-through'))).toBeLessThanOrEqual(660 * X + 1)
    // A beat on the full light before it fades: 180ms, times the dial.
    expect(hold - end(named('gate-through'))).toBeGreaterThanOrEqual(180 * X - 1)
    const push = parseFloat(gateEl.style.getPropertyValue('--gate-push'))
    expect(lane.clientWidth * push).toBeGreaterThanOrEqual(gateEl.clientWidth)
    expect(lane.clientHeight * push).toBeGreaterThanOrEqual(gateEl.clientHeight)
    // And the fade keeps its end until the scene is taken down.
    expect(['forwards', 'both']).toContain(named('gate-leave').effect.getComputedTiming().fill)
  })

  it('hands the name out of the lane where it stood, and holds it across the screen', async () => {
    await gate()
    const scene = box('.gate')
    // The hand-off: the name leaves the lane on the frame the layer over
    // it appears, standing where the name stood and at its size.
    at(480 * X + 2)
    const [lane, title] = [box('.gate__name'), box('.gate__title-body')]
    expect(getComputedStyle(document.querySelector('.gate__name')).opacity).toBe('0')
    expect(getComputedStyle(document.querySelector('.gate__title')).opacity).toBe('1')
    expect(Math.abs((title.left + title.right) / 2 - (lane.left + lane.right) / 2)).toBeLessThan(1.5)
    expect(Math.abs((title.top + title.bottom) / 2 - (lane.top + lane.bottom) / 2)).toBeLessThan(1.5)
    expect(title.width / lane.width).toBeCloseTo(1, 1)
    // The hold: centred, across most of the screen, and on it.
    at(700 * X)
    const held = box('.gate__title-body')
    expect(Math.abs((held.left + held.right) / 2 - (scene.left + scene.right) / 2)).toBeLessThan(2)
    expect(Math.abs((held.top + held.bottom) / 2 - (scene.top + scene.bottom) / 2)).toBeLessThan(2)
    expect(held.width / scene.width).toBeGreaterThan(0.8)
    expect(held.left).toBeGreaterThanOrEqual(scene.left)
    expect(held.right).toBeLessThanOrEqual(scene.right)
  })

  // The owner's two notes on the gate in the door's dress: the right
  // lamp ran up into the reader, and a light blinked in the middle of
  // the opening flaps (the door's seam lamp, drawn at the lane's top).
  it('starts both lamps under the reader, the pad crossed by nothing', async () => {
    await gate()
    const reader = box('.gate__reader')
    for (const lamp of document.querySelectorAll('.gate__lamp')) {
      expect(lamp.getBoundingClientRect().top).toBeGreaterThan(reader.bottom)
    }
  })

  it('lights nothing in the opening', async () => {
    await gate()
    const lane = document.querySelector('.gate__lane')
    expect(getComputedStyle(lane, '::before').content).toBe('none')
    expect(getComputedStyle(lane, '::after').content).toBe('none')
  })

  it('inks the name in kinari on the lines that carry it, and dark on gold', async () => {
    await gate()
    await gate({ color: 'var(--accent2)', icon: '本日', title: 'Today' })
    const [vocab, today] = document.querySelectorAll('.gate')
    expect(vocab.dataset.ink).toBe('panel')
    expect(today.dataset.ink).toBe('fill')
  })

  it('lends the window\'s gutter the light while it has the screen, and takes it back', async () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      await render(<TicketGate section={{ color: 'var(--line-kana)', icon: 'あ', title: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={onDone} />)
      const ground = () => document.documentElement.style.getPropertyValue('--gate-ground')
      await vi.advanceTimersByTimeAsync(650 * X)
      expect(ground()).toBe('')
      await vi.advanceTimersByTimeAsync(20 * X)
      expect(ground()).toBe('var(--line-kana)')
      await vi.advanceTimersByTimeAsync(180 * X)
      expect(ground()).toBe('')
      expect(document.documentElement.style.getPropertyValue('transition')).toBe('')
      await vi.advanceTimersByTimeAsync(150 * X)
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives the gutter back when it is skipped', async () => {
    vi.useFakeTimers()
    try {
      await render(<TicketGate section={{ color: 'var(--line-kana)', icon: 'あ', title: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={() => {}} />)
      await vi.advanceTimersByTimeAsync(700 * X)
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
