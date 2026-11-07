import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import { LONG_SCENE } from './ConversationRun.fixtures'
import '../index.css'

// ── 会話 — the talk on a phone, 390×844 (plan 221) ─────────────────
// The complaint this pins (2026-10-16): "when the conversation gets
// long the replies are hidden and you have to scroll". The talk grew
// down the page a line at a time, and by the fourth exchange of a
// scene the three replies stood under the fold -- the first one's top
// at 877px on this 844px screen, measured -- so every turn was a
// scroll down to answer and a scroll back up to read what was said.
//
// So the run is bounded to the screen once the talk is under way and
// the talk scrolls inside its card (index.css, .stage--talk). Measured
// here on a whole scene from the bank, whatever the way of riding: the
// page itself never scrolls, what answers the talk is on the screen,
// and the newest exchange is in view in the card.

const apiFetch = vi.fn()
const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {},
  speakLine: vi.fn(() => Promise.resolve(false)), speakSentence: vi.fn(),
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))

const { default: ConversationRun } = await import('./ConversationRun')

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
// Every entrance still running waited out (a line arrives 10px low),
// and the card's smooth scroll after it: a measurement of a line still
// moving reads it a few px off.
async function landed() {
  await settle()
  await Promise.all(document.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime) && a.effect.getComputedTiming().endTime <= 2000)
    .map(a => a.finished.catch(() => {})))
  await settle(700)
}

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function submit(text) {
  const field = document.querySelector('.stage__foot input')
  setValue.call(field, text)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  document.querySelector('form.stage__foot').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}
const tile = jp => [...document.querySelectorAll('.kaiwa-reply')].find(t => t.textContent.includes(jp))
const primary = () => document.querySelector('.stage__foot .btn-primary')
const talkBox = () => document.querySelector('.kaiwa-card > .prompt-card__body')
/** A line's Japanese as written, its readings left out. */
function written(line) {
  const jp = line.querySelector('.dict-ex__jp').cloneNode(true)
  jp.querySelectorAll('rt').forEach(rt => rt.remove())
  return jp.textContent
}

/** On the screen, whole. */
function onScreen(el) {
  const box = el.getBoundingClientRect()
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5)
}
/** In view in the talk's card: its top at least, and the whole of it
 *  when it is no taller than the card's room. */
function inTalk(el) {
  const room = talkBox().getBoundingClientRect()
  const box = el.getBoundingClientRect()
  expect(box.top).toBeGreaterThanOrEqual(room.top - 0.5)
  expect(box.top).toBeLessThan(room.bottom)
  if (box.height <= room.height) expect(box.bottom).toBeLessThanOrEqual(room.bottom + 0.5)
}
/** The page itself stays put: the talk is what scrolls. */
function pageIsStill() {
  const doc = document.documentElement
  expect(doc.scrollHeight).toBeLessThanOrEqual(doc.clientHeight + 1)
}

async function board(mode) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/practice/conversation/${LONG_SCENE.id}/${mode}`]}>
        <Routes>
          {/* The real frame: it stamps data-chrome="stage", whose
              --dock-bottom the bounded stage ends on. */}
          <Route element={<StageFrame />}>
            <Route path="/practice/conversation/:scenario/:mode" element={<ConversationRun session={null} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(300)
  primary().click()
  await landed()
  return screen
}

/** Choose, the right reply each time, up to the scene's last turn. */
async function rideToLastTurn() {
  for (const turn of LONG_SCENE.turns.slice(0, -1)) {
    tile(turn.me.jp).click()
    await settle()
    primary().click()
    await landed()
  }
}

let held = null
beforeEach(() => {
  apiFetch.mockReset()
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (String(url).startsWith('/api/conversation/scenario/')) return JSON.parse(JSON.stringify(LONG_SCENE))
    if (String(url) === '/api/conversation/check') return { accuracy: 72, matched: 'romaji', target: 0, japanese: null }
    return {}
  })
  apiFetch.mockImplementation(async url => {
    if (url === '/api/conversation/review') {
      return ok({
        review: {
          verdict: 'almost', summary: 'Presque : une particule ne va pas.', meaning: 'Un studio.',
          good: ['「ので」 donne bien ta raison'], fix: [], grammar_used: null, better: '',
        },
        analysis: '', japanese: null,
      })
    }
    if (url === '/api/conversation/talk') {
      await new Promise(r => { held = r })
      return ok({
        reply: { jp: 'ご予算はどのくらいですか。', parts: [{ text: 'ご予算はどのくらいですか。' }], translation: 'Et quel est votre budget ?', done: false },
        review: { verdict: 'correct', summary: 'Naturel.', meaning: 'Je cherche un studio.', good: ['clair'], fix: [], grammar_used: null, better: '' },
        analysis: '', japanese: null,
      })
    }
    return ok({ correct: true, quality: 4, xp_earned: 7, leveled_up: false, new_level: 2 })
  })
})

describe('a whole scene on a phone (plan 221)', () => {
  it('keeps the three replies on the screen at its last turn, the talk scrolling in its card', async () => {
    const screen = await board('choose')
    await rideToLastTurn()
    // Eleven lines said: far more than the card holds, which is what
    // used to push the replies down the page.
    expect(document.querySelectorAll('.kaiwa-talk > .tour-line')).toHaveLength(11)
    const box = talkBox()
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
    pageIsStill()
    const tiles = document.querySelectorAll('.kaiwa-reply')
    expect(tiles).toHaveLength(3)
    tiles.forEach(onScreen)
    // And the line they answer is the one in view.
    inTalk(document.querySelector('.kaiwa-talk > .tour-line:last-child'))
    // Clear of the floor, by the stage's gutter: flush on it, the last
    // tile read as cut off under the floor.
    const last = [...document.querySelectorAll('.kaiwa-reply')].at(-1).getBoundingClientRect()
    expect(document.querySelector('.run-floor').getBoundingClientRect().top - last.bottom).toBeGreaterThanOrEqual(16)
    await screen.unmount()
  })

  it('draws the talk as bubbles: theirs at the left on the line\'s rail, the learner\'s at the right on the gold (plan 223)', async () => {
    const screen = await board('choose')
    await rideToLastTurn()
    const talk = document.querySelector('.kaiwa-talk').getBoundingClientRect()
    const theirs = document.querySelector('.kaiwa-talk > .tour-line--them:last-child > .tour-line__text')
    const mine = [...document.querySelectorAll('.kaiwa-talk > .tour-line--me > .tour-line__text')].at(-1)
    // Each on its own side, its voice on the far one.
    expect(Math.abs(theirs.getBoundingClientRect().left - talk.left)).toBeLessThan(1)
    expect(Math.abs(mine.getBoundingClientRect().right - talk.right)).toBeLessThan(1)
    expect(mine.parentElement.querySelector('.tour-speak').getBoundingClientRect().right).toBeLessThanOrEqual(mine.getBoundingClientRect().left)
    // The rails: an edge each, never a fill.
    expect(getComputedStyle(theirs).borderLeftWidth).toBe('3px')
    expect(getComputedStyle(mine).borderRightWidth).toBe('3px')
    // Who says it is the side it stands on: the name stays for a reader.
    const who = theirs.parentElement.querySelector('.tour-line__who')
    expect(who.textContent).toBe(LONG_SCENE.them)
    expect(who.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    await screen.unmount()
  })

  it('sends a wrong pick into the talk struck, the right reply after it, the exchange in view and Next under it', async () => {
    const screen = await board('choose')
    await rideToLastTurn()
    const last = LONG_SCENE.turns.at(-1)
    const wrong = last.choices.find(c => !c.right)
    tile(wrong.jp).click()
    await landed()
    // The replies go; the pick is in the talk, and the right one after it.
    expect(document.querySelector('.kaiwa-reply')).toBeNull()
    const taken = document.querySelector('.kaiwa-talk > .kaiwa-line--taken')
    const right = document.querySelector('.kaiwa-talk > .kaiwa-line--right')
    expect(written(taken)).toBe(wrong.jp)
    // (French copy is welded: its no-break spaces read as spaces here.)
    expect(taken.querySelector('.tour-line__foot').textContent.replace(/[\u00a0\u202f]/g, ' ')).toBe(wrong.note)
    expect(written(right)).toBe(last.me.jp)
    inTalk(taken)
    inTalk(right)
    onScreen(primary())
    pageIsStill()
    // The scene's end comes into view the same way.
    primary().click()
    await landed()
    inTalk(document.querySelector('.kaiwa-over'))
    document.querySelectorAll('.stage__foot button').forEach(onScreen)
    pageIsStill()
    await screen.unmount()
  })

  it('keeps what to say and the field on the screen in Translate, and the practice card in view', async () => {
    const screen = await board('translate')
    for (const turn of LONG_SCENE.turns.slice(0, 4)) {
      inTalk(document.querySelector('.kaiwa-ask'))
      onScreen(document.querySelector('.stage__foot input'))
      pageIsStill()
      submit(turn.me.romaji)
      await landed()
      inTalk(document.querySelector('.kaiwa-check'))
      onScreen(document.querySelector('.rating-bar'))
      ;[...document.querySelectorAll('.rating-bar button')].at(-1).click()
      await settle()
      primary().click()
      await landed()
    }
    expect(talkBox().scrollHeight).toBeGreaterThan(talkBox().clientHeight)
    inTalk(document.querySelector('.kaiwa-ask'))
    onScreen(document.querySelector('.stage__foot input'))
    await screen.unmount()
  })

  it('holds the free talk\'s wait in the talk, then the learner\'s line in view over the bar', async () => {
    const screen = await board('free')
    for (let i = 0; i < 3; i++) {
      submit('hitori de sumu node, wanruumu o sagashite imasu')
      await landed()
      // The other person answering: their row, at the talk's foot.
      const wait = document.querySelector('.kaiwa-talk > .kaiwa-pending')
      inTalk(wait)
      held()
      await landed()
      expect(document.querySelector('.kaiwa-pending')).toBeNull()
      // The exchange from its start: the learner's line and the
      // tutor's word under it, the bar to grade it on the screen.
      const mine = [...document.querySelectorAll('.kaiwa-talk > .tour-line--me')].at(-1)
      inTalk(mine)
      onScreen(document.querySelector('.rating-bar'))
      pageIsStill()
      ;[...document.querySelectorAll('.rating-bar button')].at(-1).click()
      await landed()
    }
    expect(talkBox().scrollHeight).toBeGreaterThan(talkBox().clientHeight)
    onScreen(document.querySelector('.stage__foot input'))
    await screen.unmount()
  })
})
