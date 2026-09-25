import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — 問, the asking (plan 131) ─────────────────────────────────────
// A short question about the exercise just graded, in the lower half of
// a practice run's lines panel: sealed until the grade (comprehension:
// until the results), the exercise's context sent with the question and
// the thread's earlier exchanges with a follow-up, a question off the
// exercise declined, the day's limit and an outage said in the panel, a
// thread per sentence -- a reopened line keeps its own -- and Enter in
// the field asking rather than taking the next sentence. The phone draws
// none of it (deskfree.phone, "the run's lines").

const apiFetch = vi.hoisted(() => vi.fn())
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
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
const SECOND = { ...FIRST, phrase: '山へ行きます。', romaji: 'yama e ikimasu', translation: 'I go to the mountain.', grammar: null }
const tok = (surface, reading, meaning) => ({ surface, reading, meaning, pos: 'noun', furigana: [{ text: surface, reading }] })
const analysisOf = phrase => ({
  text: phrase, level: 'N5', available: true, grammar: [],
  tokens: [tok(phrase.slice(0, 2), 'よみ', `the words of ${phrase}`)],
})

// What the next /api/ask answers: a body, or a status.
let reply
const askCalls = () => apiFetch.mock.calls.filter(c => c[0] === '/api/ask').map(c => JSON.parse(c[2].body))

beforeEach(() => {
  reply = { answer: '「ましょうか」 offers to do it for the listener.', off_topic: false, left: 39 }
  apiFetch.mockReset()
  apiFetch.mockImplementation(async (url, _session, init) => {
    const u = String(url)
    if (u.startsWith('/api/reading/batch')) return ok({ phrases: [FIRST, SECOND, { ...SECOND, phrase: '駅で会いました。' }] })
    if (u === '/api/reading/check') return ok({ accuracy: 17, matched: 'romaji' })
    if (u === '/api/reading/result') return ok({ xp_earned: 7 })
    if (u === '/api/phrase/analyze') return ok(analysisOf(JSON.parse(init.body).phrase))
    if (u === '/api/ask') {
      if (typeof reply === 'number') return { ok: false, status: reply, json: async () => ({ detail: 'Daily limit of 40 questions reached; resets 2026-09-26T22:00Z' }) }
      return ok(reply)
    }
    if (u.startsWith('/api/reading/comprehension/result')) return ok(RESULT)
    if (u.startsWith('/api/reading/comprehension')) return ok(EXERCISE)
    return ok({})
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async () => ({}))
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

async function grade(answer, digit = '1') {
  $('form.stage__foot input').focus()
  await userEvent.keyboard(answer)
  await userEvent.keyboard('{Enter}')
  await settle(250)
  await userEvent.keyboard(digit)
  await settle(300)
}
async function ask(question) {
  $('.desk-ask__field').focus()
  await userEvent.keyboard(question)
  await userEvent.keyboard('{Enter}')
  await settle(250)
}
const field = () => $('.desk-ask__field')
const turns = () => $$('.desk-ask__turn')

describe('the asking in a sentence run', () => {
  it('stands sealed in the lines panel\'s lower half until the answer is graded', async () => {
    await reading()
    await settle(300)
    const panel = $('.desk-run__left .desk-sentences')
    expect(panel.querySelector(':scope > .desk-ask')).not.toBeNull()
    expect(field().disabled).toBe(true)
    expect($('.desk-ask__hint').textContent).toBe('Les questions s’ouvrent une fois ta réponse notée.')
    // The list and the asking a half each.
    const list = panel.querySelector('.desk-sentences__list').getBoundingClientRect()
    const asking = panel.querySelector('.desk-ask').getBoundingClientRect()
    expect(Math.abs(list.height - asking.height)).toBeLessThan(40)
    expect(asking.top).toBeGreaterThanOrEqual(list.bottom)
    await grade('denki')
    expect(field().disabled).toBe(false)
    expect(field().placeholder).toBe('Ta question…')
    expect(askCalls()).toHaveLength(0)
  })

  it('asks with the exercise\'s context, and prints the answer under the question', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await ask('Pourquoi ましょうか ?')
    const [body] = askCalls()
    expect(body).toMatchObject({
      mode: 'reading', sentence: FIRST.phrase, level: 'N5', translation: FIRST.translation,
      answer: 'denki', point: '〜ましょうか', question: 'Pourquoi ましょうか ?', history: [], lang: 'fr',
    })
    expect(body.words).toEqual([`電気 (よみ): the words of ${FIRST.phrase}`])
    expect(turns()).toHaveLength(1)
    expect(turns()[0].querySelector('.desk-ask__q').textContent).toContain('Pourquoi ましょうか ?')
    expect(turns()[0].querySelector('.desk-ask__a').textContent).toContain('「ましょうか」 offers')
    // The field is cleared and keeps the focus; its Enter asked, it did
    // not take the next sentence.
    expect(field().value).toBe('')
    expect(document.activeElement).toBe(field())
    expect($('.stage').textContent).toContain(FIRST.phrase)
  })

  it('sends a follow-up with the thread, and says a question off the exercise is declined', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await ask('Pourquoi ましょうか ?')
    reply = { answer: null, off_topic: true, left: 38 }
    await ask('Et la météo ?')
    const second = askCalls()[1]
    expect(second.history).toEqual([{ question: 'Pourquoi ましょうか ?', answer: '「ましょうか」 offers to do it for the listener.' }])
    expect(turns()[1].querySelector('.desk-ask__a').textContent).toContain('Je ne réponds qu’aux questions sur cet exercice.')
    // A declined question is not sent back as history.
    await ask('Et ますか ?')
    expect(askCalls()[2].history).toHaveLength(1)
  })

  it('says the day is spent and when it comes back, and closes the field', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    reply = 429
    await ask('Pourquoi ?')
    expect($('.desk-ask__note').textContent).toMatch(/^Plus de questions aujourd’hui\s: elles reviennent à \d\d:\d\d\.$/)
    expect(field().disabled).toBe(true)
  })

  it('says so when no answer can be had', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    reply = 503
    await ask('Pourquoi ?')
    expect(turns()[0].querySelector('.desk-ask__a').textContent).toContain('Les réponses sont indisponibles pour le moment.')
    expect(field().disabled).toBe(false)
  })

  it('keeps a thread per sentence: a reopened line has its own', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await ask('Question sur la première ?')
    await userEvent.keyboard('{Tab}')
    // Next, from the page (the field keeps its Enter).
    document.activeElement.blur()
    await userEvent.keyboard('{Enter}')
    await settle(300)
    expect(turns()).toHaveLength(0)
    expect(field().disabled).toBe(true)
    await grade('yama')
    await ask('Question sur la deuxième ?')
    expect(askCalls()[1].sentence).toBe(SECOND.phrase)
    // The first sentence, reopened from the list: its thread and its context.
    $$('.desk-sentences__list button.desk-sentence')[0].click()
    await settle(250)
    expect(turns()).toHaveLength(1)
    expect(turns()[0].textContent).toContain('Question sur la première ?')
    await ask('Encore une ?')
    expect(askCalls()[2]).toMatchObject({ sentence: FIRST.phrase, answer: 'denki', point: '〜ましょうか' })
    expect(askCalls()[2].history).toHaveLength(1)
  })

  it('stops at five questions a sentence', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    for (let i = 0; i < 5; i++) await ask(`Question ${i} ?`)
    expect(turns()).toHaveLength(5)
    expect(field().disabled).toBe(true)
    expect($('.desk-ask__note').textContent).toBe('C’est tout pour cette phrase.')
    expect(askCalls().at(-1).history).toHaveLength(4)
  })
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

describe('the asking in comprehension', () => {
  it('is sealed through the paper and asks about the open question on the results', async () => {
    await render(<Run at="/practice/comprehension/N5" path="/practice/comprehension/:level" element={<ComprehensionRun session={null} />} />)
    await settle(1200)
    expect(field().disabled).toBe(true)
    expect($('.desk-ask__hint').textContent).toBe('Les questions s’ouvrent avec les résultats.')
    press('Enter')
    await settle(200)
    press('b'); await settle(60); press('Enter'); await settle(120)
    expect(field().disabled).toBe(true)
    press('a'); await settle(60); press('Enter'); await settle(400)
    // The results open on the first miss (Q2): the asking is about it.
    expect(field().disabled).toBe(false)
    await ask('Pourquoi « train » ?')
    const [body] = askCalls()
    expect(body.mode).toBe('comprehension')
    expect(body.sentence).toBe(EXERCISE.text)
    expect(body.review).toContain('What does 「電車」 mean?')
    expect(body.review).toContain('C. train')
    expect(body.review).toContain('Right answer: C. The learner chose: A.')
    expect(body.words).toEqual(['電車 (でんしゃ): train'])
  })
})

describe('the asking beside a sentence still to grade', () => {
  it('keeps its digits: a question typed in a reopened line\'s thread grades nothing', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    document.activeElement.blur()
    await userEvent.keyboard('{Enter}')
    await settle(300)
    // The second sentence answered, its rating bar up, not yet graded.
    $('form.stage__foot input').focus()
    await userEvent.keyboard('yama{Enter}')
    await settle(250)
    expect($('.rating-bar')).not.toBeNull()
    $$('.desk-sentences__list button.desk-sentence')[0].click()
    await settle(250)
    const results = () => apiFetch.mock.calls.filter(c => c[0] === '/api/reading/result').length
    const before = results()
    await ask('Que veut dire 1 ou 2 ?')
    expect(results()).toBe(before)
    expect($('.rating-bar')).not.toBeNull()
    expect(askCalls().at(-1)).toMatchObject({ question: 'Que veut dire 1 ou 2 ?', sentence: FIRST.phrase })
  })
})
