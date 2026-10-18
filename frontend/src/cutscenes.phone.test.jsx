import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── A key that skips a cutscene is spent on it (plan 123) ──────────
// The 改札 and the train door each cut to their end on any key, and
// each plays over a screen that is already mounted: the ride's first
// card under the gate, a run under the door (the arrival over the plan
// went with the plan, plan 247). The skip never took the key, so the same Space
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
    await render(<LangProvider><TicketGate section={{ color: 'var(--line-kana)', name: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={onDone} /></LangProvider>)
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

// ── The gate, up close (plan 249) ───────────────────────────────────
// The owner's pick B of three drawn as game assets: the two cabinets are
// the screen's two halves, the flaps close the lane between them, and
// the cabinets part on the door's keyframes. What it replaced grew a
// box of blurred shadows four times over on the main thread, which was
// the lag the owner filmed; so the two promises held first are the ones
// that keep it smooth: no blur anywhere, and nothing animated but a
// transform or an opacity. Read off the scene's own animations, not a
// clock.
describe('the gate stands up close and parts like the door (plan 249)', () => {
  const X = 1.4
  const box = s => document.querySelector(s).getBoundingClientRect()
  const anims = () => document.querySelector('.gate').getAnimations({ subtree: true })
  const named = name => anims().find(a => a.animationName === name)
  const all = name => anims().filter(a => a.animationName === name)
  const end = a => a.effect.getComputedTiming().endTime
  const start = a => a.effect.getComputedTiming().delay ?? a.effect.getTiming().delay
  // Every animation of the scene stopped at `ms` from its mount — the
  // ones this block reads were all started by the mount itself.
  const at = ms => anims().forEach(a => { a.pause(); a.currentTime = ms })

  async function gate(section = {}) {
    const onDone = vi.fn()
    await render(
      <LangProvider>
        <TicketGate
          section={{ color: 'var(--line-vocab)', icon: '単語', title: 'Vocabulary', ...section }}
          station={{ code: 'V01' }}
          onNavigate={() => {}}
          onDone={onDone}
        />
      </LangProvider>,
    )
    await settle()
    return onDone
  }

  it('fills the screen with its two cabinets, the flaps shut across the lane', async () => {
    await gate()
    const scene = box('.gate')
    const [l, r] = [box('.gate__cab--l'), box('.gate__cab--r')]
    expect(l.left).toBeLessThanOrEqual(scene.left)
    expect(r.right).toBeGreaterThanOrEqual(scene.right)
    const [fl, fr] = [...document.querySelectorAll('.gate__flap')].map(f => f.getBoundingClientRect())
    // They meet in the middle of the lane, a hair apart.
    expect(fr.left - fl.right).toBeGreaterThanOrEqual(0)
    expect(fr.left - fl.right).toBeLessThanOrEqual(6)
    expect(Math.abs((fl.right + fr.left) / 2 - (scene.left + scene.right) / 2)).toBeLessThan(2)
  })

  it('holds on the line\'s light alone: one flat fill behind the name', async () => {
    await gate()
    const beyond = document.querySelector('.gate__beyond')
    expect(getComputedStyle(beyond).backgroundImage).toBe('none')
    expect([...beyond.children].map(c => c.className)).toEqual(['gate__dim'])
  })

  it('draws no blurred shadow, on any part', async () => {
    await gate()
    // The pass is the pass, drawn by its own component, and only moved.
    const parts = [...document.querySelectorAll('.gate, .gate *')].filter(el => !el.closest('.gate__card'))
    for (const el of parts) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo)
        expect(cs.boxShadow, el.className).toBe('none')
        expect(cs.textShadow, el.className).toBe('none')
        expect(cs.filter, el.className).toBe('none')
      }
    }
  })

  it('animates nothing but transforms and opacities', async () => {
    await gate()
    const moved = new Set()
    for (const a of anims()) {
      for (const k of a.effect.getKeyframes()) {
        for (const prop of Object.keys(k)) {
          if (!['offset', 'computedOffset', 'easing', 'composite'].includes(prop)) moved.add(prop)
        }
      }
    }
    expect([...moved].filter(p => !['transform', 'opacity'].includes(p))).toEqual([])
  })

  it('lifts the pass clear of the reader once the tap has been held', async () => {
    await gate()
    // 68% of the pass's flight: the tap held from 48% to 60%, then up.
    const tap = named('gate-tap')
    tap.pause()
    tap.currentTime = 0.68 * tap.effect.getComputedTiming().activeDuration
    expect(box('.gate__card').bottom).toBeLessThan(box('.gate__reader').top)
  })

  it('takes the flaps in before the cabinets part, and the cabinets off the screen before the hold', async () => {
    await gate()
    const flaps = [...all('gate-flap-l'), ...all('gate-flap-r')]
    const cabs = [...all('door-part-l'), ...all('door-part-r')]
    expect(flaps).toHaveLength(2)
    expect(cabs).toHaveLength(2)
    expect(Math.max(...flaps.map(end))).toBeLessThanOrEqual(Math.min(...cabs.map(start)))
    expect(Math.max(...cabs.map(end))).toBeLessThanOrEqual(665 * X + 1)
    at(665 * X + 1)
    const scene = box('.gate')
    expect(box('.gate__cab--l').right).toBeLessThanOrEqual(scene.left)
    expect(box('.gate__cab--r').left).toBeGreaterThanOrEqual(scene.right)
  })

  // The fade is declared on its beat, by the scene's own timer, not with
  // a delay from the mount: a waiting opacity animation on the scene had
  // the browser draw the whole scene twice a frame (plan 210).
  it('holds a beat on the full light, then fades off it and keeps its end', async () => {
    vi.useFakeTimers()
    try {
      await render(<LangProvider><TicketGate section={{ color: 'var(--line-kana)', icon: 'あ', title: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={() => {}} /></LangProvider>)
      const parted = Math.max(...[...all('door-part-l'), ...all('door-part-r')].map(end))
      // A beat on the full light before it fades: 175ms, times the dial.
      await vi.advanceTimersByTimeAsync(parted + 175 * X - 5)
      expect(named('gate-leave')).toBeUndefined()
      await vi.advanceTimersByTimeAsync(10)
      // And the fade keeps its end until the scene is taken down.
      expect(['forwards', 'both']).toContain(named('gate-leave').effect.getComputedTiming().fill)
    } finally {
      vi.useRealTimers()
    }
  })

  it('draws nothing of the scene twice before it leaves, and covers the screen whole', async () => {
    await gate()
    expect(named('gate-leave')).toBeUndefined()
    const scrim = named('gate-scrim')
    scrim.finish()
    expect(getComputedStyle(document.querySelector('.gate__scrim')).opacity).toBe('1')
  })

  it('stands the name in the hall over the gate, and holds it across the screen', async () => {
    await gate()
    const scene = box('.gate')
    // Settled onto the gate, and the cabinets not yet parting.
    at(300 * X)
    const hall = box('.gate__title-body')
    const [sign, cab] = [box('.gate__sign'), box('.gate__cab--l')]
    expect(hall.top).toBeGreaterThanOrEqual(sign.bottom)
    expect(hall.bottom).toBeLessThanOrEqual(cab.top)
    expect(Math.abs((hall.top + hall.bottom) / 2 - (sign.bottom + cab.top) / 2)).toBeLessThan(2)
    // The hold: centred, across most of the screen, and on it.
    at(700 * X)
    const held = box('.gate__title-body')
    expect(Math.abs((held.left + held.right) / 2 - (scene.left + scene.right) / 2)).toBeLessThan(2)
    expect(Math.abs((held.top + held.bottom) / 2 - (scene.top + scene.bottom) / 2)).toBeLessThan(2)
    expect(held.width / scene.width).toBeGreaterThan(0.8)
    expect(held.left).toBeGreaterThanOrEqual(scene.left)
    expect(held.right).toBeLessThanOrEqual(scene.right)
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
      await render(<LangProvider><TicketGate section={{ color: 'var(--line-kana)', icon: 'あ', title: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={onDone} /></LangProvider>)
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
      await render(<LangProvider><TicketGate section={{ color: 'var(--line-kana)', icon: 'あ', title: 'Kana' }} station={{ code: 'KN' }} onNavigate={() => {}} onDone={() => {}} /></LangProvider>)
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

// Each scene ends on its own timers -- the door comes down at 920ms --
// and userEvent's key travels out to the browser and back. On a loaded
// runner it reached the page after the door had gone, and the screen
// under it heard the Space (CI, 2026-10-05). So the scenes' clock is
// held while the key travels: it always lands mid-scene, and `done`,
// not yet called when it is pressed, can only be the skip's.
describe('a cutscene spends the key that skips it', () => {
  for (const [name, mount] of Object.entries(SCENES)) {
    it(`the ${name}: Space skips it and never reaches the screen under it`, async () => {
      vi.useFakeTimers()
      try {
        const heard = screenUnder()
        const done = await mount()
        await vi.advanceTimersByTimeAsync(60)
        expect(done).not.toHaveBeenCalled()
        await userEvent.keyboard(' ')
        await vi.advanceTimersByTimeAsync(60)
        expect(done).toHaveBeenCalledTimes(1)
        expect(heard).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it(`the ${name}: a browser chord skips it but is left to the browser`, async () => {
      vi.useFakeTimers()
      try {
        const heard = screenUnder()
        const done = await mount()
        await vi.advanceTimersByTimeAsync(60)
        expect(done).not.toHaveBeenCalled()
        const chord = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true })
        window.dispatchEvent(chord)
        await vi.advanceTimersByTimeAsync(60)
        expect(done).toHaveBeenCalledTimes(1)
        expect(chord.defaultPrevented).toBe(false)
        expect(heard).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })
  }
})
