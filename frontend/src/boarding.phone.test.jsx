import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── The boarding's contract at phone width (plans 075, 168) ──────
// The canvas's frame, pinned against the real cascade at 390×844: the
// foot is docked at the bottom edge with the one filled action full
// width at 66 px (plan 164's gate), in the same place on every screen;
// the head is 44 px with a 44 px back button and a 2 px track; the
// question stands centred over its drawing, the pair on the room's
// middle (plan 168); every choice is a 44 px target or taller; nothing
// scrolls sideways; the sign-in stands in the Welcome's place, its
// segmented control filling its card and its action the same gate. The
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
const shell = vi.hoisted(() => ({ nudge: false }))
vi.mock('./lib/platform', async o => ({ ...(await o()), canNudge: () => shell.nudge }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')
const { default: Welcome } = await import('./components/boarding/Welcome')

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

const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

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
    expect(rect(frame.querySelector('.brd-plate__field')).height).toBeGreaterThanOrEqual(44)
    // Not yet is the gate's outline (plan 164), not the family's 0.45:
    // the button stays at full strength, its fill layer gone and its
    // edge drawn, the same shape. The field arrives filled with the
    // account's name, so empty it first.
    const height = rect(action).height
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const field = frame.querySelector('.brd-plate__field')
    setValue.call(field, '')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(600)
    expect(action.disabled).toBe(true)
    expect(getComputedStyle(action).opacity).toBe('1')
    expect(getComputedStyle(action, '::before').opacity).toBe('0')
    expect(getComputedStyle(action).boxShadow).toContain('inset')
    expect(getComputedStyle(action).animationName).toBe('none')
    expect(rect(action).height).toBe(height)
  })

  // ── 改札, the gate button (plan 164) ──
  // The owner's pick D: a 66 px gold pill with the pass's mark in a
  // sumi reader at its left and the word on the pill's centre line; a
  // pick wakes it with one overshoot, and only a pick -- a Continue
  // that arrives ready does not pop.
  it('draws Continue as the gate, and a pick wakes it once', async () => {
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const go = () => live(screen.container).querySelector('[data-action="continue"]')
    expect(go().disabled).toBe(true)
    expect(go().classList.contains('btn-depart--waking')).toBe(false)
    expect(Math.round(rect(go()).height)).toBe(66)
    expect(getComputedStyle(go()).borderRadius).toBe('999px')
    const reader = go().querySelector('.btn-depart__reader')
    expect(Math.round(rect(reader).width)).toBe(48)
    expect(reader.querySelectorAll('.pass__wave span')).toHaveLength(3)
    // The word on the pill's centre line, whatever stands at its ends.
    const word = rect(go().querySelector('.btn-depart__jp'))
    const pill = rect(go())
    expect(Math.abs((word.left + word.right) / 2 - (pill.left + pill.right) / 2)).toBeLessThanOrEqual(1)

    await click(screen.container, '[data-motive="trip"]')
    expect(go().disabled).toBe(false)
    expect(go().classList.contains('btn-depart--waking')).toBe(true)
    expect(getComputedStyle(go()).animationName).toContain('btn-gate-wake')
    // The pop lets go once it has landed; the breath stays.
    await settle(700)
    expect(go().classList.contains('btn-depart--waking')).toBe(false)
    expect(getComputedStyle(go()).animationName).toBe('btn-gate-breathe')
    expect(getComputedStyle(go(), '::before').opacity).toBe('1')
    // The idle nudge waits four seconds on a ready gate.
    expect(getComputedStyle(go().querySelector('.btn-depart__reader')).animationDelay).toBe('4s')
  })

  it('arrives ready on the Welcome without the pop, the halo inside the frame', async () => {
    const screen = await render(
      <LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    const board = screen.container.querySelector('[data-action="board"]')
    expect(board.classList.contains('btn-depart--gate')).toBe(true)
    expect(board.classList.contains('btn-depart--waking')).toBe(false)
    expect(getComputedStyle(board).animationName).toBe('btn-gate-breathe')
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
    // One stop per question, the one you stand at a larger ring --
    // your train -- the ones behind filled, the ones ahead empty.
    const stops = [...track.querySelectorAll('.brd__stop')]
    expect(stops).toHaveLength(Number(track.getAttribute('aria-valuemax')))
    const here = track.querySelector('.brd__stop--here')
    expect(Math.round(rect(here).width)).toBe(19)
    expect(track.querySelectorAll('.brd__stop--passed')).toHaveLength(Number(track.getAttribute('aria-valuenow')) - 1)
  })

  // ── The junction (plan 168, the owner's A02) ──
  // Six reasons at the ends of three rungs off one trunk, each its
  // pictogram in a ring over its name: one choice each, a thumb's
  // target, inside the screen and clear of each other.
  it('hangs the six reasons off the junction, each a target of its own', async () => {
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const ways = [...live(screen.container).querySelectorAll('.brd-way')]
    expect(ways).toHaveLength(6)
    for (const way of ways) {
      expect(rect(way).height).toBeGreaterThanOrEqual(44)
      expect(rect(way).width).toBeGreaterThanOrEqual(44)
      expect(rect(way).left).toBeGreaterThanOrEqual(0)
      expect(rect(way).right).toBeLessThanOrEqual(390)
      expect(way.getAttribute('aria-pressed')).toBe('false')
    }
    for (const [i, a] of ways.entries()) {
      for (const b of ways.slice(i + 1)) {
        const [p, q] = [rect(a), rect(b)]
        const apart = p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top
        expect(apart, `${a.dataset.motive} / ${b.dataset.motive}`).toBe(true)
      }
    }
    // A pick lights its road from the hub, and its ring.
    await click(screen.container, '[data-motive="live"]')
    expect(live(screen.container).querySelector('[data-motive="live"]').getAttribute('aria-pressed')).toBe('true')
    expect(live(screen.container).querySelectorAll('.brd-road--on')).toHaveLength(1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  // The owner's word on the built junction: a name that wraps under its
  // ring -- "Pour un voyage au Japon" -- stood all but on the ring under
  // it. A rung between them, on the lane's phone and on a notched one
  // whose frame is drawn short (the 723 px an iPhone leaves the page).
  it('keeps a rung between a reason\'s name and the ring under it', async () => {
    localStorage.setItem('lang', 'fr')
    try {
      const screen = await mountFlow()
      await click(screen.container, '[data-action="continue"]')
      await settle(900)
      const clear = () => {
        const ways = [...live(screen.container).querySelectorAll('.brd-way')]
        return Math.min(...ways.slice(0, 4).map((way, i) => (
          rect(ways[i + 2].querySelector('.brd-way__ring')).top - rect(way.querySelector('.brd-way__name')).bottom
        )))
      }
      expect(clear()).toBeGreaterThanOrEqual(12)
      for (const height of [764, 723]) {
        await atHeight(height, () => {
          expect(clear(), `${height} px`).toBeGreaterThanOrEqual(12)
          // And still nothing scrolls: the sixth reason over the gate.
          const body = live(screen.container).querySelector('.brd__body')
          expect(body.scrollHeight, `${height} px`).toBe(body.clientHeight)
        })
      }
    } finally {
      localStorage.removeItem('lang')
    }
  })

  // ── The question over its drawing, the pair on the room's middle ──
  // Plan 168, the owner's word on the built screens: the titles
  // centred, and not always at the top of the screen. The question is
  // set centred, a rung (--sp-8) over its drawing, and the two stand as
  // one block in the middle of the room between the head and the foot --
  // the room over the question the room under the drawing. A shorter
  // phone spends that room first, then the rung, down to the body's own
  // gap, before anything scrolls.
  it('centres the question over its drawing, and the pair in the room', async () => {
    const screen = await mountFlow('SilentSamurai6323')
    const q = () => live(screen.container).querySelector('.brd__q')
    const body = () => live(screen.container).querySelector('.brd__body')
    const stage = () => live(screen.container).querySelector('.brd__body > .brd__stage')
    const gap = () => parseFloat(getComputedStyle(body()).rowGap)
    const rung = () => rect(stage()).top - rect(q()).bottom
    const over = () => rect(q()).top - rect(body()).top
    const under = () => rect(body()).bottom - rect(stage()).bottom
    await click(screen.container, '[data-action="continue"]')
    // Past the drawing's arrival: a stage still translated 6 px down is
    // 6 px of overflow that says nothing about the rest state.
    await settle(900)
    expect(getComputedStyle(q()).textAlign).toBe('center')
    expect(Math.round(rung())).toBe(44)
    expect(Math.abs(over() - under())).toBeLessThanOrEqual(1)
    // Not pinned under the head: the room is spent round the pair.
    expect(over()).toBeGreaterThan(gap())
    expect(body().scrollHeight).toBe(body().clientHeight)

    for (const height of [800, 764, 700]) {
      await atHeight(height, () => {
        const ways = [...live(screen.container).querySelectorAll('.brd-way')]
        expect(ways).toHaveLength(6)
        // Nothing scrolls, the sixth reason clears the docked action,
        // and the rung gives way no further than the body's own gap.
        expect(body().scrollHeight, `${height} px`).toBe(body().clientHeight)
        expect(rect(ways[5]).bottom).toBeLessThanOrEqual(rect(live(screen.container).querySelector('.brd__foot')).top)
        expect(rung(), `${height} px`).toBeGreaterThanOrEqual(gap() - 0.5)
        expect(Math.abs(over() - under()), `${height} px`).toBeLessThanOrEqual(1)
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
    const q = live(screen.container).querySelector('.brd__q')
    expect(document.activeElement).toBe(q)
    expect(q.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(q).outlineStyle).toBe('none')
    // The ring is intact for anything a hand can actually reach.
    const way = live(screen.container).querySelector('.brd-way')
    way.focus()
    await settle(20)
    expect(getComputedStyle(way).outlineStyle).toBe('solid')
    expect(getComputedStyle(way).outlineWidth).toBe('2px')
  })

  // ── The name's plate rings gold, inside the clip ──
  // The cars slide sideways, so `.brd__cars` clips them. The name is
  // the station's plate now (plan 168): the field draws no ring of its
  // own, the plate's edge turns gold while the field holds the focus,
  // and that edge -- 2 px outside the plate -- stands inside the clip.
  it('rings the name\'s plate in gold while it holds the focus, inside the frame that clips the cars', async () => {
    const screen = await mountFlow()
    const cars = screen.container.querySelector('.brd__cars')
    const field = screen.container.querySelector('.brd-plate__field')
    const plate = field.closest('.brd-plate')
    expect(getComputedStyle(cars).overflow).toBe('hidden')
    expect(document.activeElement).toBe(field)
    expect(getComputedStyle(field).outlineStyle).toBe('none')
    const gold = getComputedStyle(plate).boxShadow
    field.blur()
    await settle(20)
    expect(getComputedStyle(plate).boxShadow).not.toBe(gold)
    field.focus()
    await settle(20)
    expect(getComputedStyle(plate).boxShadow).toBe(gold)
    const clip = rect(cars)
    const box = rect(plate)
    expect(box.left - clip.left).toBeGreaterThanOrEqual(2)
    expect(clip.right - box.right).toBeGreaterThanOrEqual(2)
  })

  // The kana's answers go on by themselves, so the screen has no foot;
  // the four stand at the crossing's ends. The pace is four trains on
  // the departure board, and the hour is the board turned by hand, the
  // three services under it.
  it('the kana at the crossing\'s four ends, the pace as four trains, the hour turned on the board', async () => {
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-motive="trip"]')
    await click(screen.container, '[data-action="continue"]')
    await settle()
    expect(live(screen.container).querySelector('.brd__foot')).toBeNull()
    expect(live(screen.container).querySelector('.brd-cross__words')).not.toBeNull()
    const answers = [...live(screen.container).querySelectorAll('.brd-cross__ans')]
    expect(answers).toHaveLength(4)
    for (const a of answers) {
      expect(rect(a).height).toBeGreaterThanOrEqual(56)
      expect(rect(a).left).toBeGreaterThanOrEqual(0)
      expect(rect(a).right).toBeLessThanOrEqual(390)
    }

    await click(screen.container, '[data-kana="both"]')
    await settle()
    await click(screen.container, '[data-level="N5"]')
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-action="continue"]')   // the goal
    await settle()
    await click(screen.container, '[data-action="continue"]')   // the lines
    await settle()
    const trains = [...live(screen.container).querySelectorAll('.brd-train')]
    expect(trains).toHaveLength(4)
    for (const tr of trains) expect(Math.round(rect(tr).height)).toBeGreaterThanOrEqual(56)
    await click(screen.container, '[data-action="continue"]')
    await settle()
    const hours = [...live(screen.container).querySelectorAll('.brd-hour')]
    expect(hours).toHaveLength(3)
    for (const h of hours) expect(rect(h).height).toBeGreaterThanOrEqual(76)
    const steps = [...live(screen.container).querySelectorAll('.brd-clock__step')]
    expect(steps).toHaveLength(4)
    for (const s of steps) {
      expect(Math.round(rect(s).height)).toBe(44)
      expect(rect(s).width).toBeGreaterThanOrEqual(44)
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })

  // ── The gate, in one place (plan 168) ──
  // The owner's word on the built screens: the buttons differed from
  // screen to screen, and they are the feature that matters most. Every
  // way on is the one gate, the foot's last row -- a quiet way (the
  // sign-in, Not now, the account already held, the offer) stands over
  // it, never under -- so the pill stands in the same place at the same
  // size from Board to the pass, and its word, at the gate's own size,
  // holds one line beside the reader.
  it('stands the one gate in the same place on every screen', async () => {
    localStorage.setItem('lang', 'fr')
    shell.nudge = true
    try {
      const welcome = await render(
        <LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
      )
      await settle(60)
      const board = welcome.container.querySelector('[data-action="board"]')
      const place = rect(board)
      const size = getComputedStyle(board.querySelector('.btn-depart__jp')).fontSize
      await welcome.unmount()

      const screen = await render(
        <LangProvider>
          <BoardingFlow session={{ access_token: 'tok' }} initialProfile={{ username: 'Tester' }} onComplete={() => {}} onSignIn={() => {}} guest dryRun />
        </LangProvider>
      )
      await settle(60)
      const step = () => screen.container.querySelector('.brd').dataset.step
      const seen = []
      const measure = () => {
        const foot = live(screen.container).querySelector('.brd__foot')
        const gate = foot.lastElementChild
        expect(gate.classList.contains('btn-depart--gate'), step()).toBe(true)
        expect(foot.querySelectorAll('.btn-depart'), step()).toHaveLength(1)
        const at = rect(gate)
        for (const k of ['left', 'top', 'width', 'height']) {
          expect(Math.round(at[k]), `${step()} ${k}`).toBe(Math.round(place[k]))
        }
        const word = gate.querySelector('.btn-depart__jp')
        expect(getComputedStyle(word).fontSize, step()).toBe(size)
        expect(rect(word).height, `${step()}: one line`).toBeLessThan(2 * parseFloat(size))
        expect(rect(word).left, step()).toBeGreaterThan(rect(gate.querySelector('.btn-depart__reader')).right)
        seen.push(step())
      }
      // Each step measured once its car has landed and a pick's wake (the
      // pill's one overshoot, 540 ms) has let go.
      const on = async sel => { await click(screen.container, sel); await settle(700) }

      measure()                                   // the name, the sign-in over it
      expect(live(screen.container).querySelector('.brd__foot > [data-action="sign-in"] + .btn-depart--gate')).not.toBeNull()
      await on('[data-action="continue"]')
      await on('[data-motive="trip"]')
      measure()                                   // the reasons
      await on('[data-action="continue"]')
      await on('[data-kana="both"]')
      await on('[data-level="N5"]')
      measure()                                   // the level
      await on('[data-action="continue"]')
      measure()                                   // the goal
      await on('[data-action="continue"]')
      measure()                                   // the lines
      await on('[data-action="continue"]')
      measure()                                   // the rhythm
      await on('[data-action="continue"]')
      measure()                                   // the hour
      await on('[data-action="continue"]')
      measure()                                   // the nudge, Not now over it
      expect(live(screen.container).querySelector('.brd__foot > [data-action="not-now"] + .btn-depart--gate')).not.toBeNull()
      await on('[data-action="not-now"]')
      measure()                                   // the plan
      await on('[data-action="continue"]')
      measure()                                   // the account, the one already held over it
      expect(live(screen.container).querySelector('.brd__foot > [data-action="account-sign-in"] + .btn-depart--gate')).not.toBeNull()
      await on('[data-action="account-skip"]')
      measure()                                   // the pass, the offer over it
      expect(live(screen.container).querySelector('.brd__foot > [data-action="paywall-open"].brd__link')).not.toBeNull()
      expect(seen).toEqual(['name', 'why', 'level', 'goal', 'lines', 'rhythm', 'time', 'nudge', 'plan', 'account', 'pass'])
    } finally {
      shell.nudge = false
      localStorage.removeItem('lang')
    }
  })

  // The reveal, the kana's second half for a learner who reads neither:
  // the same gate, in the same place.
  it('stands the reveal\'s gate where the others stand', async () => {
    const welcome = await render(
      <LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    const place = rect(welcome.container.querySelector('[data-action="board"]'))
    await welcome.unmount()
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-motive="trip"]')
    await click(screen.container, '[data-action="continue"]')
    await settle()
    await click(screen.container, '[data-kana="none"]')
    await settle()
    expect(screen.container.querySelector('.brd').dataset.step).toBe('reveal')
    const gate = live(screen.container).querySelector('.brd__foot').lastElementChild
    expect(gate.classList.contains('btn-depart--gate')).toBe(true)
    const at = rect(gate)
    for (const k of ['left', 'top', 'width', 'height']) expect(Math.round(at[k]), k).toBe(Math.round(place[k]))
  })

  // ── The front door as the crossroads (plan 168, the owner's A00) ──
  it('draws the Welcome as the crossroads: seven lines out of 辻, and the gold road into Board', async () => {
    const screen = await render(
      <LangProvider><Welcome onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    const stations = [...screen.container.querySelectorAll('.brd-front__stn')]
    expect(stations).toHaveLength(7)
    expect(screen.container.querySelector('.brd-front__hub .mark')).not.toBeNull()
    expect(screen.container.querySelector('.brd-front__way').getAttribute('d')).toMatch(/^M/)
    const action = screen.container.querySelector('[data-action="board"]')
    for (const stn of stations) {
      for (const part of stn.querySelectorAll('.brd-front__sign, .brd-front__name')) {
        expect(rect(part).left, stn.dataset.line).toBeGreaterThanOrEqual(0)
        expect(rect(part).right, stn.dataset.line).toBeLessThanOrEqual(390)
        expect(rect(part).bottom, stn.dataset.line).toBeLessThanOrEqual(rect(action).top)
      }
    }
    const body = screen.container.querySelector('.brd-front__body')
    expect(body.scrollHeight).toBe(body.clientHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    expect(rect(action).height).toBeGreaterThanOrEqual(52)
    expect(rect(screen.container.querySelector('[data-action="sign-in"]')).height).toBeGreaterThanOrEqual(44)
  })

  // ── The sign-in, in the promise's place (plan 168, A00b) ──
  it('the sign-in: the segmented control fills the card, the action is the gate', async () => {
    const screen = await render(
      <LangProvider><Welcome authMode="signup" onBack={() => {}} onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    const card = screen.container.querySelector('.auth-card')
    const seg = card.querySelector('.seg--full')
    const pad = parseFloat(getComputedStyle(card).paddingLeft)
    expect(Math.abs(rect(seg).width - (rect(card).width - 2 * pad))).toBeLessThanOrEqual(4)
    const action = screen.container.querySelector('[data-action="auth-submit"]')
    expect(rect(action).height).toBeGreaterThanOrEqual(52)
    expect(Math.round(rect(screen.container.querySelector('[data-action="welcome"]')).height)).toBe(44)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    // Its action is the boarding's gate, Board's own (the owner's word:
    // one button, drawn alike everywhere), filled while it can be pressed.
    expect(action.classList.contains('btn-depart--gate')).toBe(true)
    expect(action.disabled).toBe(false)
    expect(getComputedStyle(action, '::before').opacity).toBe('1')
    // The gold road ends in the gate's reader, on its middle, the gate
    // painting over its last stretch as Board's does on the Welcome.
    const way = screen.container.querySelector('.brd-signin__road .brd-front__way')
    const [endY, endX] = way.getAttribute('d').trim().split(/[\s,A-Z]+/).filter(Boolean).map(Number).slice(-2)
    const stage = rect(screen.container.querySelector('.brd-signin__stage'))
    const reader = rect(action.querySelector('.btn-depart__reader'))
    expect(Math.abs(stage.top + endY - (reader.top + reader.height / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(stage.left + endX - (reader.left + reader.width / 2))).toBeLessThanOrEqual(1)
  })

  it('opens the sign-in on Log in, the address focused and no Sign up beside it', async () => {
    const screen = await render(
      <LangProvider><Welcome authMode="login" onBack={() => {}} onBoard={() => {}} onSignIn={() => {}} /></LangProvider>
    )
    await settle(60)
    expect(screen.container.querySelector('.seg--full')).toBeNull()
    expect(document.activeElement.type).toBe('email')
    expect(screen.container.querySelector('.brd-front__promise')).toBeNull()
    expect(screen.container.querySelector('[data-action="board-corner"]')).not.toBeNull()
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

  it('steps back one question at a time, keeping every answer', async () => {
    const start = window.history.length
    const screen = await mountFlow()
    await click(screen.container, '[data-action="continue"]')        // name → why
    await settle()
    await click(screen.container, '[data-motive="trip"]')
    await click(screen.container, '[data-action="continue"]')        // why → kana
    await settle()
    expect(live(screen.container).querySelector('.brd-cross')).not.toBeNull()
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
    expect(live(screen.container).querySelector('.brd-plate__field')).not.toBeNull()
    expect(live(screen.container).querySelector('.brd-plate__field').value).toBe('Tester')
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
    expect(live(screen.container).querySelector('.brd-plate__field')).not.toBeNull()
  })
})
