import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 問 — the asking on a phone (plan 197) ────────────────────────────────
// The desk asks in the run's lines panel (ask.desktop.test); a phone has
// no panel, and the owner's pick D of four drawn on the real run gave it
// a page of its own, entered from a button in the graded card. What is
// held here: the button is not there before the grade and is the card's
// own after it; the page is a modal dialog over the run (so the run's keys
// stand down and the shell's back button, which presses Esc, closes it),
// with the sentence pinned and the field in focus; the question goes out
// with the exercise's context as the desk's does; the run is where it
// was left when the page closes and the thread is there when it opens
// again; and the browser's Back closes the page rather than leaving the
// run. Comprehension's button is in the open question's detail.

const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {}, playCorrect: () => {}, playWrong: () => {},
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('./stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ReadingRun } = await import('./screens/ReadingRun')
const { default: ComprehensionRun } = await import('./screens/ComprehensionRun')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const ok = body => ({ ok: true, status: 200, json: async () => body })
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const FIRST = { phrase: '電気をつけましょうか。', romaji: 'denki o tsukemashou ka', translation: 'Shall I turn on the light?', translation_lang: 'en', display_seconds: 30, grammar: '〜ましょうか' }
const tok = (surface, reading, meaning) => ({ surface, reading, meaning, pos: 'noun', furigana: [{ text: surface, reading }] })
const analysisOf = phrase => ({
  text: phrase, level: 'N5', available: true, grammar: [],
  tokens: [tok(phrase.slice(0, 2), 'よみ', `the words of ${phrase}`)],
})
const EXERCISE = {
  text: '駅で友達を待ちました。電車は遅れました。',
  translation: 'I waited for a friend at the station. The train was late.',
  breakdown: [
    { jp: '駅で友達を待ちました。', translation: 'I waited.', note: '', analysis: { text: '駅で友達を待ちました。', available: true, grammar: [], tokens: [tok('駅', 'えき', 'station')] } },
    { jp: '電車は遅れました。', translation: 'The train was late.', note: '', analysis: { text: '電車は遅れました。', available: true, grammar: [], tokens: [tok('電車', 'でんしゃ', 'train')] } },
  ],
  grammar_points: [],
  read_seconds: 60,
  questions: [
    { type: 'comprehension', question: 'Where did they wait?', options: ['At home', 'At the station', 'At school', 'At work'], correct: 1 },
    { type: 'vocabulary', question: 'What does 「電車」 mean?', options: ['friend', 'car', 'train', 'bus'], correct: 2 },
  ],
}
const RESULT = {
  score: 1, total: 2, xp_earned: 5,
  results: [
    { ...EXERCISE.questions[0], user_answer: 1, is_correct: true },
    { ...EXERCISE.questions[1], user_answer: 0, is_correct: false },
  ],
}

let reply
const askCalls = () => apiFetch.mock.calls.filter(c => c[0] === '/api/ask').map(c => JSON.parse(c[2].body))

beforeEach(() => {
  // The lane's one history is shared: a test that ends with the page open
  // leaves its guard entry standing, which a real unmount never meets.
  window.history.replaceState(null, '')
  reply = { answer: '「ましょうか」 offers to do it for the listener.', off_topic: false, left: 39 }
  apiFetch.mockReset()
  apiFetch.mockImplementation(async (url, _session, init) => {
    const u = String(url)
    if (u.startsWith('/api/reading/batch')) return ok({ phrases: [FIRST] })
    if (u === '/api/reading/check') return ok({ accuracy: 17, matched: 'romaji' })
    if (u === '/api/reading/result') return ok({ xp_earned: 7 })
    if (u === '/api/phrase/analyze') return ok(analysisOf(JSON.parse(init.body).phrase))
    if (u === '/api/ask') return ok(reply)
    if (u.startsWith('/api/reading/comprehension/result')) return ok(RESULT)
    if (u.startsWith('/api/reading/comprehension')) return ok(EXERCISE)
    return ok({})
  })
})

function Run({ at, path, element }) {
  return (
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes><Route path={path} element={element} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
}
const reading = () => render(<Run at="/practice/reading/level/N5" path="/practice/reading/level/:level" element={<ReadingRun session={null} />} />)

// The answer typed, then rated by the bar's last tile (the best), as a
// thumb does it.
async function answer(text) {
  $('.clip-player__play').click()
  await settle(20)
  await userEvent.fill($('form.stage__foot input'), text)
  await userEvent.keyboard('{Enter}')
  await settle(250)
}
async function rate() {
  $$('.rating-bar button').at(-1).click()
  await settle(300)
}
const launch = () => $('.ask-launch')
const page = () => $('.ask-layer')
const field = () => $('.ask__field')
const turns = () => $$('.ask__turn')
async function ask(question) {
  await userEvent.fill(field(), question)
  await userEvent.keyboard('{Enter}')
  await settle(250)
}
async function openPage() {
  launch().click()
  await settle(200)
}

describe('the asking in a sentence run, on a phone', () => {
  it('has no button before the grade, and puts one in the card after it', async () => {
    await reading()
    await settle(300)
    expect(launch()).toBeNull()
    await answer('denki')
    expect($('.rating-bar')).not.toBeNull()
    expect(launch()).toBeNull()
    await rate()
    // The card's own column of buttons, under the breakdown's.
    const buttons = $$('.prose__breakdown > button')
    expect(buttons).toHaveLength(2)
    expect(buttons[1]).toBe(launch())
    expect(launch().textContent).toBe('問Poser une question')
    // The desk's panel is not drawn: the phone's page is not mounted either.
    expect($('.desk-ask')).toBeNull()
    expect(page()).toBeNull()
  })

  it('opens a page of its own over the run, with the sentence pinned and the field in focus', async () => {
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    await openPage()
    const dialog = page()
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Une question')
    // The run's own head, its way out named Retour.
    expect(dialog.querySelector('.stage__leave').textContent).toContain('Retour')
    expect(dialog.querySelector('.stage__where-jp').textContent).toBe('Une question')
    // The sentence and its translation, pinned.
    expect(dialog.querySelector('.ask-echo__main').textContent).toBe(FIRST.phrase)
    expect(dialog.querySelector('.ask-echo__main').lang).toBe('ja')
    expect(dialog.querySelector('.ask-echo__sub').textContent).toBe(FIRST.translation)
    // Nothing asked yet: the hint, and the field takes the focus.
    expect(dialog.querySelector('.ask__hint').textContent).toBe('Une réponse courte et précise, sur cet exercice.')
    expect(document.activeElement).toBe(field())
    expect(field().disabled).toBe(false)
    expect(field().placeholder).toBe('Ta question…')
    // It covers the viewport, opaque.
    const box = dialog.getBoundingClientRect()
    // The whole page (the lane's browser keeps a scrollbar's room, which a
    // phone's does not, so the page is the root's box, not the window's).
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, document.documentElement.getBoundingClientRect().width, window.innerHeight])
    expect(getComputedStyle(dialog).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('asks with the exercise\'s context, as the desk does, and prints the answer', async () => {
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    await openPage()
    await ask('Pourquoi ましょうか ?')
    const [body] = askCalls()
    expect(body).toMatchObject({
      mode: 'reading', sentence: FIRST.phrase, level: 'N5', translation: FIRST.translation,
      answer: 'denki', point: '〜ましょうか', question: 'Pourquoi ましょうか ?', history: [], lang: 'fr',
    })
    expect(body.words).toEqual([`電気 (よみ): the words of ${FIRST.phrase}`])
    expect(turns()).toHaveLength(1)
    expect(turns()[0].querySelector('.ask__q').textContent).toContain('Pourquoi ましょうか ?')
    expect(turns()[0].querySelector('.ask__a').textContent).toContain('「ましょうか」 offers')
    expect(field().value).toBe('')
    expect(document.activeElement).toBe(field())
  })

  // A long thread grew the page past the window: the field went off the
  // foot with it, and the thread, never short of room, never scrolled.
  it('keeps the field on the foot and scrolls the thread when it outgrows the window', async () => {
    reply = { ...reply, answer: 'La particule は (wa) indique le thème de la phrase ; が (ga) mettrait l’accent sur qui fait l’action. '.repeat(4) }
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    await openPage()
    for (const q of ['Pourquoi wa ?', 'Et de ?', 'Et e ?', 'Et ni ?']) await ask(q)
    expect(turns()).toHaveLength(4)
    const thread = $('.ask__thread')
    expect(thread.scrollHeight).toBeGreaterThan(thread.clientHeight)
    // The newest exchange in view, and the page itself as tall as the window.
    expect(thread.scrollTop + thread.clientHeight).toBeGreaterThanOrEqual(thread.scrollHeight - 1)
    expect(page().scrollHeight).toBeLessThanOrEqual(page().clientHeight)
    const foot = $('.ask__form').getBoundingClientRect()
    expect(foot.top).toBeGreaterThan(thread.getBoundingClientRect().bottom - 1)
    expect(foot.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(field().disabled).toBe(false)
  })

  it('leaves the run where it was on closing, and finds the thread on opening again', async () => {
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    await openPage()
    await ask('Pourquoi ましょうか ?')
    page().querySelector('.stage__leave').click()
    await settle(200)
    expect(page()).toBeNull()
    // Graded, its card and the button still there; nothing was sent again.
    expect($('.prose__breakdown')).not.toBeNull()
    expect($('.stage__foot .btn-primary')).not.toBeNull()
    expect($('.stage').textContent).toContain(FIRST.phrase)
    expect(apiFetch.mock.calls.filter(c => c[0] === '/api/reading/result')).toHaveLength(1)
    await openPage()
    expect(turns()).toHaveLength(1)
    expect(turns()[0].textContent).toContain('Pourquoi ましょうか ?')
    // Not the focus-in of an empty page: a thread to read is not covered by a keyboard.
    expect(document.activeElement).not.toBe(field())
    await ask('Et ますか ?')
    expect(askCalls()[1].history).toHaveLength(1)
  })

  it('is one step in the history: Back closes the page, and the page closing leaves no entry', async () => {
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    expect(window.history.state?.ask).toBeFalsy()
    await openPage()
    expect(window.history.state?.ask).toBe(true)
    window.history.back()
    await settle(250)
    expect(page()).toBeNull()
    expect($('.prose__breakdown')).not.toBeNull()
    // Closed from the page: the guard is taken out, not left to be walked back through.
    await openPage()
    page().querySelector('.stage__leave').click()
    await settle(250)
    expect(page()).toBeNull()
    expect(window.history.state?.ask).toBeFalsy()
  })

  it('closes on Esc, which is what the shell\'s back button presses', async () => {
    await reading()
    await settle(300)
    await answer('denki')
    await rate()
    await openPage()
    press('Escape')
    await settle(200)
    expect(page()).toBeNull()
    expect($('.prose__breakdown')).not.toBeNull()
  })
})

describe('the asking in comprehension, on a phone', () => {
  it('is in the open question\'s detail on the results, and asks about that question', async () => {
    await render(<Run at="/practice/comprehension/N5" path="/practice/comprehension/:level" element={<ComprehensionRun session={null} />} />)
    await settle(1200)
    expect(launch()).toBeNull()
    press('Enter')
    await settle(200)
    press('b'); await settle(60); press('Enter'); await settle(120)
    press('a'); await settle(60); press('Enter'); await settle(400)
    // Results, no question open yet: the text is not what is asked about.
    expect(launch()).toBeNull()
    $$('.qrow')[1].click()
    await settle(250)
    expect($('.qrow__detail > .ask-launch')).not.toBeNull()
    await openPage()
    // The page names the open question, not the screen-long text.
    expect(page().querySelector('.ask-echo__main').textContent).toBe('What does 「電車」 mean?')
    expect(page().querySelector('.ask-echo__sub')).toBeNull()
    await ask('Pourquoi « train » ?')
    const [body] = askCalls()
    expect(body.mode).toBe('comprehension')
    expect(body.sentence).toBe(EXERCISE.text)
    expect(body.review).toContain('What does 「電車」 mean?')
    expect(body.review).toContain('Right answer: C. The learner chose: A.')
    expect(body.words).toEqual(['電車 (でんしゃ): train'])
  })
})
