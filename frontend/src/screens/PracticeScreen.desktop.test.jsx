import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The shipped face (main.jsx), so the board's names are measured in the
// font they are drawn in (gates.wide.test.jsx says why).
import '@fontsource/space-grotesk/latin-700.css'
import '../index.css'

// ── 練習の改札、机 — the painted platform on the desk (plan 244) ──────
// The owner's pick B of the canvas "Tsuji — Practice on the desk", from
// the owner's own painting of it: the station the window's height and
// the width the rail leaves, a car standing at it with its door open,
// and one board over its right side -- the levels as a band, the seven
// trains with the learner's record at that level, the chosen train's
// card. The gold button on the platform boards it. At the desk's
// tightest, 1100×800 (gates.wide.test.jsx and gates.short.test.jsx hold
// the laptop and the short window).

const { default: CARDS } = await import('../testing/practiceCards.json')
// What the learner has done at N4: reading and conversation, nothing else.
const RECORD = vi.hoisted(() => ({
  reading: { N4: { done: 24, right: 20, of: 24, last: '2026-10-10T08:00:00+00:00' } },
  conversation: { N4: { done: 11, right: 8, of: 11, last: '2026-10-12T08:00:00+00:00' } },
}))
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path === '/api/practice/record') return { ok: true, status: 200, json: async () => RECORD }
    const line = path.match(/^\/api\/station\/(\w+)\/samples/)?.[1]
    return { ok: true, status: 200, json: async () => (line ? { stops: CARDS[line] } : {}) }
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn(),
  playBoardFlap: vi.fn(), playGateChime: vi.fn(), playDoorChime: vi.fn(), playDoorSlide: vi.fn(),
}))
vi.mock('../stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N4' }) }))
const beginDeparture = vi.hoisted(() => vi.fn())
vi.mock('../stores/departure', async o => ({ ...(await o()), beginDeparture }))
// The train's acts take seconds; most cases board under reduced motion,
// where the gold button opens the run at once.
const motion = vi.hoisted(() => ({ reduced: true }))
vi.mock('../components/dayclear/useReducedMotion', () => ({
  REDUCED_QUERY: '(prefers-reduced-motion: reduce)',
  useReducedMotion: () => motion.reduced,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: PracticeScreen } = await import('./PracticeScreen')
const { getSections } = await import('../config/tabs')
const { printHour } = await import('../domain/printHour')
const { default: DESK } = await import('../components/practice/gate/desk.json')
const { AIR } = await import('../components/practice/gate/deskFit')
const { default: fr } = await import('../locales/fr/index.js')

const SECTIONS = getSections('practice', fr)
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const settle = async (ms = 400) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
}
const here = { path: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname + loc.search
  return null
}
// The shell's frame without the shell: the content column beside a
// rail's width of nothing, which is what the desk leaves a screen.
async function gate() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice']}>
        <div className="phone phone--desk">
          <div className="phone__content"><PracticeScreen /></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

const $ = sel => document.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const box = el => el.getBoundingClientRect()
const press = (key, el = document.activeElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const trains = () => $$('.pdesk-dep')
const levels = () => $$('.pdesk-levels [role="radio"]')
const well = () => $('.pdesk-card .prc-spec')
async function choose(train, level) {
  if (train != null) trains()[train].click()
  if (level != null) levels()[LEVELS.indexOf(level)].click()
  await settle(150)
}

describe('the painted platform on the desk (plan 244)', () => {
  it('stands the painting in the window, the board over its right side', async () => {
    await gate()
    expect($('.practice > .pdesk')).not.toBeNull()
    expect($('.practice > .plates')).toBeNull()
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
    const root = box($('.pdesk'))
    expect(Math.abs(root.height - window.innerHeight)).toBeLessThanOrEqual(1)
    // The painting covers the frame, at Today's hour.
    const stage = box($('.pdesk__stage'))
    expect(stage.left).toBeLessThanOrEqual(root.left + 0.5)
    expect(stage.top).toBeLessThanOrEqual(root.top + 0.5)
    expect(stage.right).toBeGreaterThanOrEqual(root.right - 0.5)
    expect(stage.bottom).toBeGreaterThanOrEqual(root.bottom - 0.5)
    const hour = printHour(new Date())
    expect($('.pdesk').classList.contains(`pgate--${hour}`)).toBe(true)
    expect($('.pdesk__layers img.is-on').getAttribute('src')).toBe(`/practice/gate/desk/${DESK.rev}/bg-${hour}.webp`)
    // The board at the right, at a station's side on the tightest desk.
    const board = box($('.pdesk__board'))
    expect(Math.round(board.width)).toBe(360)
    expect(board.right).toBeLessThan(root.right)
    // What the stage keeps of the painting, left of the board: the open
    // door with its air, the sign whole or gone, the clock whole.
    const u = stage.width / DESK.scene.w
    expect(box($('.pdesk-door')).right + AIR * u).toBeLessThanOrEqual(board.left + 0.5)
    const sign = [stage.left + DESK.sign.x * u, stage.left + DESK.sign.right * u]
    expect(sign[0] >= root.left - 0.5 || sign[1] <= root.left + 0.5).toBe(true)
    const clock = box($('.pdesk-clock'))
    expect(clock.right <= board.left + 0.5 || clock.left >= board.left - 0.5).toBe(true)
    // The gold button under the stage's middle, never under the board.
    const go = box($('.pdesk__go .btn-depart'))
    expect(go.right).toBeLessThanOrEqual(board.left)
    expect(Math.abs((go.left + go.right) / 2 - (root.left + board.left) / 2)).toBeLessThanOrEqual(1)
  })

  it('boards seven trains under the five levels, the learner\'s own marked and chosen', async () => {
    await gate()
    expect(levels().map(l => l.textContent)).toEqual(LEVELS)
    const own = levels()[1]
    expect(own.getAttribute('aria-checked')).toBe('true')
    expect(own.getAttribute('aria-current')).toBe('location')
    expect(own.querySelector('.pdesk-here')).not.toBeNull()
    expect(levels().filter(l => l.hasAttribute('aria-current'))).toHaveLength(1)
    // Every platform a train, 会話 the seventh, the first chosen.
    expect(trains().map(t => t.querySelector('.pdesk-dep__title').textContent)).toEqual(SECTIONS.map(s => s.title))
    expect(trains()).toHaveLength(7)
    expect(trains().map(t => t.getAttribute('aria-checked'))).toEqual(['true', ...Array(6).fill('false')])
    expect(trains().map(t => t.tabIndex)).toEqual([0, ...Array(6).fill(-1)])
    // The learner's record at the chosen level, each in its station's unit.
    const rec = trains().map(t => t.querySelector('.pdesk-dep__rec').textContent)
    expect(rec[0]).toBe(`${fr.practiceDone.sentences(24)} · ${fr.practiceRight(83)}`)
    expect(rec[6]).toBe(`${fr.practiceDone.replies(11)} · ${fr.practiceRight(73)}`)
    expect(rec.slice(1, 6)).toEqual(Array(5).fill(fr.practiceNotYet))
    // The chosen train's card, at the chosen level.
    const card = $('.pdesk-card')
    expect(card.getAttribute('aria-label')).toBe(SECTIONS[0].title)
    expect(card.querySelector('.pdesk-card__level').textContent).toBe('N4')
    expect(well().querySelector('.prc-spec__jp').textContent).toBe(CARDS.reading.N4.card.jp)
    expect(well().getAttribute('aria-hidden')).toBe('true')
  })

  it('walks the trains and the levels, the card and the record following', async () => {
    await gate()
    await choose(6, 'N4')
    // 会話's card: the scene's place on its plate, the line it opens on.
    const scene = CARDS.conversation.N4.card
    expect($('.pdesk-card').getAttribute('aria-label')).toBe(fr.conversationTitle)
    expect(well().querySelector('.tour-plate__name').textContent).toBe(scene.place.jp)
    expect(well().querySelector('.tour-plate__cap').textContent).toBe(scene.place.name)
    expect(well().querySelector('.prc-spec__jp').textContent).toBe(scene.opener)
    // The arrows walk the trains and choose as they go; the band is one
    // tab stop of its own.
    trains()[6].focus()
    press('ArrowUp')
    expect(document.activeElement).toBe(trains()[5])
    await settle(150)
    expect(trains()[5].getAttribute('aria-checked')).toBe('true')
    const vocab = CARDS.exam.N4.card.vocab
    expect(well().querySelector('.prc-spec__mark').textContent).toBe(vocab.word)
    expect($$('.prc-spec__opt', well()).map(o => o.textContent.slice(1))).toEqual(vocab.options)
    // Another level: the card and every record are that level's.
    await choose(null, 'N2')
    expect(levels()[3].getAttribute('aria-checked')).toBe('true')
    expect($('.pdesk-card__level').textContent).toBe('N2')
    expect(well().querySelector('.prc-spec__mark').textContent).toBe(CARDS.exam.N2.card.vocab.word)
    expect(trains().map(t => t.querySelector('.pdesk-dep__rec').textContent)).toEqual(Array(7).fill(fr.practiceNotYet))
    // The learner's own stays marked, chosen or not.
    expect(levels()[1].getAttribute('aria-current')).toBe('location')
  })

  it('holds every train\'s card whole at every level', async () => {
    await gate()
    for (const level of LEVELS) {
      for (const [i, section] of SECTIONS.entries()) {
        await choose(i, level)
        const w = well()
        const what = `${level} ${section.path}`
        expect(w.textContent, what).not.toBe('')
        expect(w.scrollHeight, what).toBeLessThanOrEqual(w.clientHeight + 1)
        expect(w.scrollWidth, what).toBeLessThanOrEqual(w.clientWidth + 1)
      }
    }
    // At 800px the card is short: the line over the well goes, still the
    // gate's description, and the well draws its compact face.
    expect($('.pdesk-card__how').hidden).toBe(true)
    expect(well().classList.contains('prc-spec--compact')).toBe(true)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })

  it('departs for the chosen train at the chosen level', async () => {
    await gate()
    await choose(6, 'N3')
    const go = $('.pdesk__go .btn-depart')
    expect(go.getAttribute('aria-label')).toBe(fr.practiceGateBoard(fr.conversationTitle, 'N3'))
    expect(document.getElementById(go.getAttribute('aria-describedby')).textContent).toBe(fr.practiceHow.conversation)
    expect(go.getAttribute('data-guide')).toBe('practice.board')
    go.click()
    // The router moves in a transition: waited for, not timed.
    await vi.waitFor(() => expect(here.path).toBe('/practice/conversation?level=N3'))
  })

  it('departs on Enter from a train, and opens a train\'s station from its card', async () => {
    const screen = await gate()
    await choose(2, 'N5')
    trains()[2].focus()
    press('Enter')
    await vi.waitFor(() => expect(here.path).toBe('/practice/translation/level/N5'))
    await screen.unmount()
    await gate()
    await choose(4, 'N4')
    beginDeparture.mockClear()
    $('.pdesk-card__open').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0].path).toBe('/practice/composition')
  })

  it('turns the clock to the next hour, the painting lit for it', async () => {
    await gate()
    const order = ['dawn', 'day', 'dusk', 'night']
    const now = printHour(new Date())
    const next = order[(order.indexOf(now) + 1) % 4]
    const clock = $('.pdesk-clock .pgate-clock')
    expect(clock.getAttribute('aria-label')).toBe(fr.practiceGateClockDesk(fr.practiceGateHour[now]))
    clock.click()
    await settle(100)
    expect($('.pdesk').classList.contains(`pgate--${next}`)).toBe(true)
    expect($('.pdesk__layers img.is-on').getAttribute('src')).toBe(`/practice/gate/desk/${DESK.rev}/bg-${next}.webp`)
  })

  // 案内 (plan 100): the guide's three stops, on the board and the
  // platform; the pass tag is drawn once something is for sale.
  it('marks the levels, the trains and the gate for the guide, once each', async () => {
    await gate()
    expect($$('[data-guide="practice.grade"] .pdesk-levels')).toHaveLength(1)
    expect($$('[data-guide="practice.sign"]')).toEqual([$('.pdesk-deps__list')])
    expect($$('[data-guide="practice.board"]')).toEqual([$('.pdesk__go .btn-depart')])
    expect($('[data-guide="practice.pass"]')).toBeNull()
  })

  // plan 244b: the sky alive -- its clouds drift behind its own mask,
  // the stars catch the light, the glow breathes, birds cross by day --
  // and under reduced motion the painting's own sky.
  it('keeps the painting\'s sky under reduced motion', async () => {
    await gate()
    const sky = $('.pdesk__sky')
    expect(getComputedStyle(sky).maskImage).toContain(`/practice/gate/desk/${DESK.rev}/sky.png`)
    const hour = printHour(new Date())
    expect($('.pdesk__clouds img.is-on').getAttribute('src')).toBe(`/practice/gate/desk/${DESK.rev}/clouds-${hour}.webp`)
    expect(getComputedStyle($('.pdesk__clouds')).animationName).toBe('none')
    expect($$('.pdesk-glint, .pdesk-flock, .pdesk-disc, .pdesk-flicker')).toHaveLength(0)
  })

  it('brings its sky to life: stars and the moon\'s glow at night, birds by day', async () => {
    motion.reduced = false
    await gate()
    const turnTo = async h => {
      for (let i = 0; i < 4 && !$('.pdesk').classList.contains(`pgate--${h}`); i++) {
        $('.pdesk-clock .pgate-clock').click()
        await settle(60)
      }
    }
    expect(getComputedStyle($('.pdesk__clouds')).animationName).toBe('desk-drift')
    await turnTo('night')
    expect($$('.pdesk-glint')).toHaveLength(DESK.stars.night.length)
    expect($$('.pdesk-glint').every(g => g.getAnimations().length === 1)).toBe(true)
    expect($('.pdesk-disc').getAnimations()).toHaveLength(1)
    expect($('.pdesk-flock')).toBeNull()
    // a tube of the canopy stutters now and then, once the lamps are on
    expect($$('.pdesk-flicker')).toHaveLength(1)
    expect($('.pdesk-flicker').getAnimations()).toHaveLength(1)
    await turnTo('day')
    expect($$('.pdesk-glint, .pdesk-disc, .pdesk-flicker')).toHaveLength(0)
    // by day, gulls: each bird jointed, its wings beating at the shoulder
    // and the wrist (DeskBirds, plan 244c)
    const birds = $$('.pdesk-flock .pdesk-bird')
    expect(birds.length).toBeGreaterThan(2)
    expect($('.pdesk-flock').getAnimations()).toHaveLength(1)
    for (const bird of birds) {
      const joints = $$('[data-move]', bird)
      expect(joints.map(j => j.dataset.move)).toEqual(expect.arrayContaining(['garm-l', 'garm-r', 'ghand-l', 'ghand-r']))
      expect(joints.every(j => j.getAnimations().length === 1)).toBe(true)
    }
    // at dusk, the geese of 落雁 in their V
    await turnTo('dusk')
    expect($$('.pdesk-flock .pdesk-bird')).toHaveLength(5)
    expect($$('.pdesk-flock [data-move="arm"]')).toHaveLength(5)
    // the birds fly in the sky, behind the pillars and the land
    expect($('.pdesk-flock').closest('.pdesk__sky')).not.toBeNull()
    motion.reduced = true
  })

  // Last: the train leaves, and the gate remembers it did (the next
  // visit sees it come in).
  it('plays the departure: the doors close, the train pulls out, the veil, then the run', async () => {
    motion.reduced = false
    await gate()
    await choose(0, 'N4')
    // Woken, the train opens its doors.
    await settle(900)
    expect($('.pdesk-door--open')).not.toBeNull()
    $('.pdesk__go .btn-depart').click()
    await settle(800)
    expect($('.pdesk-door--open')).toBeNull()
    expect($('.pdesk__train--closing')).not.toBeNull()
    await settle(900)
    expect($('.pdesk__train--leaving')).not.toBeNull()
    await settle(1400)
    const veil = $('.pdesk > .pgate-veil')
    expect(veil.classList.contains('is-on')).toBe(true)
    expect(veil.querySelector('.pgate-veil__name').textContent).toBe(SECTIONS[0].title)
    expect(veil.querySelector('.pgate-veil__grade').textContent).toBe('N4')
    await vi.waitFor(() => expect(here.path).toBe('/practice/reading/level/N4'))
    motion.reduced = true
  })
})
