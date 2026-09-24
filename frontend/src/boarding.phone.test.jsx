import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── The boarding's contract at phone width (plan 075) ────────────
// The canvas's frame, pinned against the real cascade at 390×844: the
// foot is docked at the bottom edge with the one filled action full
// width at 56 px; the head is 44 px with a 44 px back button and a 2
// px track; every choice is a 44 px target or taller; nothing scrolls
// sideways; the sign-in's segmented control fills its card. The
// stores behind the pass are stubbed: this is about the frame.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')
const { default: Welcome } = await import('./components/boarding/Welcome')
const { default: AuthScreen } = await import('./screens/AuthScreen')

const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()
async function click(root, sel) {
  const el = root.querySelector(sel)
  expect(el, sel).toBeTruthy()
  el.click()
  await settle(20)
}

async function mountFlow(username = 'Tester') {
  const screen = await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username }} onComplete={() => {}} dryRun />
    </LangProvider>
  )
  await settle(60)
  return screen
}

// The lane's 844 IS the canvas's artboard, and the frame is 100dvh, so
// a shorter phone is drawn by shortening the frame: 764 px is a 6.1"
// Android with its status and navigation bars taking the rest -- the
// screen the sixth motive was falling off.
async function atHeight(px, fn) {
  const shorter = document.createElement('style')
  shorter.textContent = `.brd { height: ${px}px; }`
  document.head.append(shorter)
  await settle(30)
  try { await fn() } finally { shorter.remove() }
}

describe('the boarding at 390×844', () => {
  it('docks the foot with a full-width 52 px action and never scrolls sideways', async () => {
    const screen = await mountFlow()
    const frame = screen.container.querySelector('.brd')
    const foot = frame.querySelector('.brd__foot')
    const action = foot.querySelector('.btn-depart')
    // The frame fills its column (the test container, never wider than the phone).
    expect(Math.round(rect(frame).width)).toBe(Math.round(rect(screen.container).width))
    expect(rect(frame).width).toBeLessThanOrEqual(390)
    expect(rect(foot).bottom).toBeLessThanOrEqual(844)
    expect(rect(foot).bottom).toBeGreaterThan(844 - 80)
    expect(Math.round(rect(action).width)).toBe(Math.round(rect(foot).width))
    expect(rect(action).height).toBeGreaterThanOrEqual(52)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    // The field is the screen's own control, already focused, 44 px or taller.
    expect(rect(frame.querySelector('.brd-field')).height).toBeGreaterThanOrEqual(44)
    // Disabled is opacity alone: the closed gate keeps its shape. The
    // field arrives filled with the account's name, so empty it first.
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const field = frame.querySelector('.brd-field')
    setValue.call(field, '')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(20)
    expect(action.disabled).toBe(true)
    expect(getComputedStyle(action).opacity).toBe('0.45')
    expect(Math.round(rect(action).height)).toBe(Math.round(rect(action).height))
  })

  it('keeps a 44 px head: the back button, the line with its stops', async () => {
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const head = screen.container.querySelector('.brd__head')
    const back = head.querySelector('button.brd__back')
    const track = head.querySelector('.brd__track')
    expect(Math.round(rect(head).height)).toBe(44)
    expect(Math.round(rect(back).width)).toBe(44)
    expect(Math.round(rect(back).height)).toBe(44)
    expect(rect(head.querySelector('.brd__rail')).height).toBe(2)
    // One stop per question, the one you stand at the largest and
    // gold, the ones behind filled, the ones ahead empty.
    const stops = [...track.querySelectorAll('.brd__stop')]
    expect(stops).toHaveLength(Number(track.getAttribute('aria-valuemax')))
    const here = track.querySelector('.brd__stop--here')
    expect(Math.round(rect(here).width)).toBe(16)
    expect(track.querySelectorAll('.brd__stop--passed')).toHaveLength(Number(track.getAttribute('aria-valuenow')) - 1)
    const frame = screen.container.querySelector('.brd')
    // The rows are one choice each, 60 px or taller, the width of the column.
    const rows = [...screen.container.querySelectorAll('.brd__car:not(.brd__car--out) .brd-opt')]
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      // Rounded: a 60 px min-height lays out at 59.99997 on a fractional scale.
      expect(Math.round(rect(row).height)).toBeGreaterThanOrEqual(60)
      expect(row.getAttribute('aria-pressed')).not.toBeNull()
    }
    expect(Math.round(rect(rows[0]).width)).toBeGreaterThanOrEqual(Math.round(rect(frame).width) - 2 * 20 - 4)
    expect(rect(rows[0]).right).toBeLessThanOrEqual(390)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  // ── The block stands on the centre line; the air gives way before
  //    the body scrolls ──
  // The rhythm around a question was a fixed pad, so on any phone
  // shorter than the artboard the six motives ran off the bottom while
  // 164 px of nothing sat above the question -- and on a taller one
  // the block sat pinned under the head with the room below it empty.
  // The question and its answers are one block now, centred in the
  // room between the head and the foot: the spacers at either end
  // share the free room equally and are nothing once there is none,
  // the rung under the question is a maximum, and the body only
  // scrolls once all of it is spent.
  it('centres the block, then collapses the air rather than scroll the six motives off a shorter phone', async () => {
    const screen = await mountFlow('SilentSamurai6323')
    await click(screen.container, '[data-action="continue"]')
    // Past the staggered arrival: the sixth row's brd-in is 200 ms of
    // delay and 360 ms of travel, and a row still translated 6 px down
    // is 6 px of scrollable overflow that says nothing about the rest
    // state being measured here.
    await settle(620)
    const frame = screen.container.querySelector('.brd')
    const live = sel => frame.querySelector(`.brd__car:not(.brd__car--out) ${sel}`)
    const body = () => live('.brd__body')

    // At rest, one rung of air under the question: --sp-8, the body's
    // --sp-5 gap included -- the same on every screen since the
    // 2026-09-20 rework -- and the block centred: the room over the
    // question is the room under the rows, to the pixel.
    const above = () => rect(live('.brd__q')).top - rect(body()).top
    const below = () => rect(body()).bottom - rect(live('.brd__stage')).bottom
    expect(Math.round(rect(live('.brd__stage')).top - rect(live('.brd__q')).bottom)).toBe(60)
    expect(Math.abs(above() - below())).toBeLessThanOrEqual(1)
    expect(above()).toBeGreaterThan(16)
    expect(body().scrollHeight).toBe(body().clientHeight)

    for (const height of [800, 764, 700]) {
      await atHeight(height, () => {
        const rows = [...frame.querySelectorAll('.brd__car:not(.brd__car--out) .brd-opt')]
        expect(rows).toHaveLength(6)
        // Nothing scrolls, and the sixth motive clears the docked action.
        expect(body().scrollHeight, `${height} px`).toBe(body().clientHeight)
        expect(rect(rows[5]).bottom).toBeLessThanOrEqual(rect(live('.brd__foot')).top)
        // The air is spent evenly at the two ends and never past the
        // body's own gap: the question keeps --sp-5 off the head and
        // off the rows, and the block stays on the centre line.
        expect(above()).toBeGreaterThanOrEqual(16)
        expect(rect(live('.brd__stage')).top - rect(live('.brd__q')).bottom).toBeGreaterThanOrEqual(16)
        expect(Math.abs(above() - below())).toBeLessThanOrEqual(1)
      })
    }
  })

  // ── The question takes focus, and wears no ring for it ──
  // The flow moves focus onto the new question at every step so a
  // screen reader reads it. Chrome matches :focus-visible on a
  // scripted .focus() whenever the last interaction was a key press,
  // so answering with Enter drew a gold box around the next question
  // (`.brd :focus-visible`, two classes, beating the heading's own
  // `outline: none`) and answering with a thumb drew nothing.
  it('rings the choices but never the question it moves focus to', async () => {
    const screen = await mountFlow()
    // A key press first: it is what puts Chrome in the mode that draws
    // the ring at all, and so the premise of everything below.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const frame = screen.container.querySelector('.brd')
    const q = frame.querySelector('.brd__car:not(.brd__car--out) .brd__q')
    expect(document.activeElement).toBe(q)
    expect(q.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(q).outlineStyle).toBe('none')
    // The ring is intact for anything a hand can actually reach.
    const opt = frame.querySelector('.brd__car:not(.brd__car--out) .brd-opt')
    opt.focus()
    await settle(20)
    expect(getComputedStyle(opt).outlineStyle).toBe('solid')
    expect(getComputedStyle(opt).outlineWidth).toBe('2px')
  })

  // ── The ring on the name field is inside the clip ──
  // The cars slide sideways, so `.brd__cars` clips them — and the name
  // field is the full width of its car, with the ring every control
  // wears drawn OUTSIDE its border box (2px at +2px offset). The clip
  // took it off at both edges, which is what the owner photographed on
  // the very first question.
  it('leaves the name field its focus ring inside the frame that clips the cars', async () => {
    const screen = await mountFlow()
    const cars = screen.container.querySelector('.brd__cars')
    const field = screen.container.querySelector('.brd-field')
    expect(getComputedStyle(cars).overflow).toBe('hidden')
    // The ring's own reach: 2px of outline at 2px of offset.
    const ring = parseFloat(getComputedStyle(field).outlineOffset) + 2
    expect(ring).toBe(4)
    const clip = cars.getBoundingClientRect()
    const box = field.getBoundingClientRect()
    expect(box.left - clip.left).toBeGreaterThanOrEqual(ring)
    expect(clip.right - box.right).toBeGreaterThanOrEqual(ring)
  })

  it('the kana answers are the foot of their screen, 56 px each, and the hour cells 76', async () => {
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-motive="trip"]')
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const live = () => screen.container.querySelector('.brd__car:not(.brd__car--out)')
    expect(live().querySelector('.brd__foot')).toBeNull()
    const kopts = [...live().querySelectorAll('.brd-kopt')]
    expect(kopts).toHaveLength(4)
    for (const k of kopts) expect(rect(k).height).toBeGreaterThanOrEqual(56)
    const card = rect(live().querySelector('.brd-kana'))
    expect(card.width).toBeGreaterThanOrEqual(340)
    expect(card.right).toBeLessThanOrEqual(390)

    await click(screen.container, '[data-kana="both"]')
    await settle()
    await click(screen.container, '[data-level="N5"]')
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-action="continue"]')   // the goal
    await settle()
    await click(screen.container, '[data-action="continue"]')   // the lines
    await settle()
    const cells = [...live().querySelectorAll('.brd-cell')]
    expect(cells).toHaveLength(4)
    for (const c of cells) expect(Math.round(rect(c).height)).toBeGreaterThanOrEqual(120)
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const hours = [...live().querySelectorAll('.brd-cell--sm')]
    expect(hours).toHaveLength(3)
    for (const h of hours) expect(rect(h).height).toBeGreaterThanOrEqual(76)
    const knob = live().querySelector('.brd-day__train')
    expect(Math.round(rect(knob).width)).toBe(26)
    expect(getComputedStyle(live().querySelector('.brd-day')).touchAction).toBe('none')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  it('Welcome rolls two lanes of 156×204 cards clipped to the screen', async () => {
    const screen = await render(
      <LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    const roll = screen.container.querySelector('.brd-roll')
    expect(getComputedStyle(roll).overflow).toBe('hidden')
    const card = screen.container.querySelector('.brd-demo')
    expect(Math.round(rect(card).width)).toBe(156)
    expect(Math.round(rect(card).height)).toBe(204)
    expect(getComputedStyle(screen.container.querySelector('.brd-roll__lane')).animationName).toBe('brd-roll')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    const action = screen.container.querySelector('[data-action="board"]')
    expect(rect(action).height).toBeGreaterThanOrEqual(52)
    expect(rect(screen.container.querySelector('[data-action="sign-in"]')).height).toBeGreaterThanOrEqual(44)
  })

  it('the sign-in: the segmented control fills the card, the action is 48 px', async () => {
    const screen = await render(
      <LangProvider><AuthScreen mode="signup" onBack={() => {}} /></LangProvider>
    )
    await settle(60)
    const card = screen.container.querySelector('.auth-card')
    const seg = card.querySelector('.seg--full')
    const pad = parseFloat(getComputedStyle(card).paddingLeft)
    expect(Math.abs(rect(seg).width - (rect(card).width - 2 * pad))).toBeLessThanOrEqual(4)
    expect(rect(card.querySelector('.auth-submit')).height).toBeGreaterThanOrEqual(48)
    expect(Math.round(rect(screen.container.querySelector('.auth__head .brd__back')).height)).toBe(44)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })
})

// ── The browser's Back walks the questions (plan 123) ─────────────
// The flow changes screens through state, so the browser's Back (a
// phone's back gesture, Alt+←) left Tsuji from any question and the
// answers were gone on the way back in. One guard entry now stands in
// the browser's history while a question is behind the learner: Back
// steps back one question, answers kept, and from the first question
// it leaves as it always has.
describe('the browser\'s Back in the boarding', () => {
  const popped = () => new Promise(r => window.addEventListener('popstate', () => setTimeout(r, 60), { once: true }))
  const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

  it('steps back one question at a time, keeping every answer', async () => {
    const start = window.history.length
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')        // name → why
    await settle()
    await click(screen.container, '[data-motive="trip"]')
    await click(screen.container, '[data-action="continue"]')        // why → kana
    await settle()
    expect(live(screen.container).querySelector('.brd-kana')).not.toBeNull()
    // One entry for the whole flow, however deep.
    expect(window.history.length).toBe(start + 1)

    let back = popped()
    window.history.back()
    await back
    await settle()
    // Back on the motives, the one chosen still chosen.
    expect(live(screen.container).querySelector('[data-motive="trip"]').getAttribute('aria-pressed')).toBe('true')

    back = popped()
    window.history.back()
    await back
    await settle()
    // Back on the name, with nothing left behind: the guard is gone.
    expect(live(screen.container).querySelector('.brd-field')).not.toBeNull()
    expect(live(screen.container).querySelector('.brd-field').value).toBe('Tester')
  })

  it('takes the guard out when ‹ brings the learner back to the first question', async () => {
    const screen = await mountFlow()
    const before = window.history.state
    await click(screen.container, '[data-action="continue"]')        // name → why
    await settle()
    expect(window.history.state).toEqual({ brd: true })
    const back = popped()
    await click(screen.container, '.brd__back')                      // ‹ to the name
    await back
    await settle()
    expect(window.history.state).toEqual(before)
    expect(live(screen.container).querySelector('.brd-field')).not.toBeNull()
  })
})
