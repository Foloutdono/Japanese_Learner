import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — 三面, the practice runs on three panels (plan 129) ─────────────
// Reading, translation, dictation, composition and comprehension stand on
// the card runs' three columns (plan 126): this run's figures over the
// run's lines at the left -- every sentence so far with the grade it got,
// the one on the stage last, each reopening its breakdown -- the exercise
// in the middle with its floor one framed row, and the breakdown, the
// lesson or the text at the right, sealed until the grade. The elements
// print no key caps; the lines list them. The phone's side is
// deskfree.phone ("the run's lines").

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
const { default: TranslationRun } = await import('./screens/TranslationRun')
const { default: DictationRun } = await import('./screens/DictationRun')
const { seedSummary } = await import('./stores/profileSummary')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const ok = body => ({ ok: true, status: 200, json: async () => body })
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='
const FIRST = { phrase: '電気をつけましょうか。', romaji: 'denki o tsukemashou ka', translation: 'Shall I turn on the light?', translation_lang: 'en', display_seconds: 30 }
const SECOND = { ...FIRST, phrase: '山へ行きます。', romaji: 'yama e ikimasu', translation: 'I go to the mountain.' }
const THIRD = { ...FIRST, phrase: '駅で会いました。', romaji: 'eki de aimashita', translation: 'We met at the station.' }
const tok = (surface, reading, meaning) => ({
  surface, reading, meaning, pos: 'noun', furigana: [{ text: surface, reading }], kanji_matches: [],
  vocab_match: { level: 'N5', raw_id: `vocab_N5_${surface}_${reading}`, entry: { word: surface, kanji: surface, kana: reading, meaning }, stats: { status: 'learning' } },
})
const analysisOf = phrase => ({
  text: phrase, level: 'N5', available: true, grammar: [], unknown_count: 0, off_deck_count: 0,
  tokens: [tok(phrase.slice(0, 2), 'よみ', `the words of ${phrase}`)],
})
const REVEAL = {
  id: 'clip-one', level: 'N5', jp: FIRST.phrase, kana: 'でんきをつけましょうか。', romaji: FIRST.romaji,
  furigana: [{ text: FIRST.phrase }], translation: FIRST.translation, translation_lang: 'en', accuracy: 90, matched: 'romaji',
}

// Which phrases' breakdowns fail, to commit a line with none.
let failing = new Set()
beforeEach(() => {
  failing = new Set()
  seedSummary({ username: 'Aiko', level: 20, xp: 1076, xpPrevLevel: 1000, xpForNext: 1398 })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async (url, _session, init) => {
    const u = String(url)
    if (u.startsWith('/api/reading/batch') || u.startsWith('/api/translation/batch')) return ok({ phrases: [FIRST, SECOND, THIRD] })
    if (u === '/api/reading/check') return ok({ accuracy: 17, matched: 'romaji' })
    if (u === '/api/reading/result' || u === '/api/translation/result') return ok({ xp_earned: 7 })
    if (u === '/api/translation/analyze') return ok({ review: null, analysis: 'Natural.' })
    if (u.startsWith('/api/dictionary?')) {
      const q = new URLSearchParams(u.split('?')[1]).get('q')
      return ok({ results: [{ type: 'vocab', kanji: q, kana: 'よみ', meaning: q, level: 'N5', status: { status: 'new' }, senses: [], examples: [] }] })
    }
    if (u === '/api/phrase/analyze') {
      const { phrase } = JSON.parse(init.body)
      if (failing.has(phrase)) return { ok: false, status: 503, json: async () => ({}) }
      return ok(analysisOf(phrase))
    }
    return ok({})
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async path => {
    if (path.startsWith('/api/dictation/batch')) {
      return { level: 'N5', max_plays: 2, clips: [{ id: 'clip-one', level: 'N5', audioSrc: SILENCE }, { id: 'clip-two', level: 'N5', audioSrc: `${SILENCE}#2` }] }
    }
    if (path === '/api/dictation/check') return REVEAL
    if (path === '/api/dictation/result') return { xp_earned: 7 }
    return {}
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

// Play, type, Enter, a digit: the sentence on the stage, graded ('1' is
// the best on either scale). Play by its button: the field takes the
// focus as the sentence shows.
async function grade(answer, digit = '1') {
  $('.clip-player__play').click()
  await settle(20)
  await userEvent.keyboard(answer)
  await userEvent.keyboard('{Enter}')
  await settle(250)
  await userEvent.keyboard(digit)
  await settle(300)
}
async function next() {
  await userEvent.keyboard('{Enter}')
  await settle(300)
}
const lineRows = () => $$('.desk-sentences__list button.desk-sentence')

describe('a practice run on three panels', () => {
  it('stands this run and its lines, the exercise, and the sealed breakdown side by side', async () => {
    await reading()
    await settle(300)
    expect($('.screen').classList.contains('desk-run--panels')).toBe(true)
    const left = $('.desk-run__left').getBoundingClientRect()
    const stage = $('.stage').getBoundingClientRect()
    const side = $('.desk-run__side').getBoundingClientRect()
    expect(left.right).toBeLessThanOrEqual(stage.left)
    expect(stage.right).toBeLessThanOrEqual(side.left)
    // The run panel over the lines, the level bar a row of it: no strip
    // on the floor, no count in the head.
    expect($('.desk-run__left > .desk-session .lvlbar')).not.toBeNull()
    expect($('.desk-run__left > .desk-sentences')).not.toBeNull()
    expect($('.screen > .lvlbar')).toBeNull()
    expect($('.stage__head .today-remaining')).toBeNull()
    expect($('.desk-figs').textContent).toContain('Phrases')
    // Before the grade the breakdown is the answer: sealed.
    expect($('.desk-run__side > .desk-sealed')).not.toBeNull()
    expect($('.desk-run__side .bkd')).toBeNull()
  })

  it('frames the floor under the card, and prints no cap on it', async () => {
    await reading()
    await settle(300)
    const foot = $('form.stage__foot')
    const stage = $('.stage').getBoundingClientRect()
    const box = foot.getBoundingClientRect()
    expect(Math.abs(box.bottom - stage.bottom)).toBeLessThan(2)
    expect(getComputedStyle(foot).borderTopStyle).toBe('solid')
    expect(getComputedStyle(foot).position).toBe('static')
    // The card grows to what the floor leaves.
    const card = $('.stage .prompt-card').getBoundingClientRect()
    expect(box.top - card.bottom).toBeLessThan(40)
    await grade('denki')
    expect($('.stage__foot .btn-primary .desk-kbd')).toBeNull()
    expect($('.stage__head .desk-kbd')).toBeNull()
    const caps = $$('.desk-sentences .desk-keys .desk-kbd').map(k => k.textContent)
    // Space first: it shows the sentence the run's play button holds.
    expect(caps).toEqual(['Espace', 'Entrée', '1–4', 'Échap'])
  })

  it('opens the breakdown as the column\'s panel once graded, and counts the sentence', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    expect($('.desk-run__side > .desk-pane .bkd')).not.toBeNull()
    expect($('.desk-run__side .desk-sealed')).toBeNull()
    // One sentence, good, the fare paid.
    const figures = $$('.desk-figs .desk-fig__value').map(v => v.textContent)
    expect(figures.slice(0, 3)).toEqual(['1', '100%', '+7XP'])
    // The row on the stage now names its sentence, in its verdict's ink.
    const now = $('.desk-sentence--now')
    expect(now.textContent).toContain(FIRST.phrase)
    expect(now.querySelector('.desk-sentence__dot--q4')).not.toBeNull()
  })
})

describe('the run\'s lines', () => {
  it('keep the sentence on the stage an ellipsis until the answer is in', async () => {
    await reading()
    await settle(300)
    const rows = $$('.desk-sentences__list .desk-sentence')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).not.toContain(FIRST.phrase)
    expect(rows[0].getAttribute('aria-current')).toBe('true')
  })

  it('reopen a sentence already passed, beside the one being written', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await next()
    const rows = lineRows()
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain(FIRST.phrase)
    expect(rows[0].querySelector('.desk-sentence__dot--q4')).not.toBeNull()
    expect(rows[1].classList.contains('desk-sentence--lit')).toBe(true)
    // The sentence being written keeps its column sealed...
    expect($('.desk-run__side > .desk-sealed')).not.toBeNull()
    // ...until a passed one is opened: its breakdown, not an answer key.
    rows[0].click()
    await settle(200)
    expect($('.desk-run__side .bkd').textContent).toContain(`the words of ${FIRST.phrase}`)
    expect(rows[0].getAttribute('aria-current')).toBe('true')
    expect(rows[1].hasAttribute('aria-current')).toBe(false)
    // Esc steps back to the sentence on the stage, and does not leave.
    rows[0].focus()
    press('Escape')
    await settle(150)
    expect($('.desk-run__side > .desk-sealed')).not.toBeNull()
    expect($('.stage')).not.toBeNull()
    expect(lineRows()[1].getAttribute('aria-current')).toBe('true')
  })

  it('open a door in a passed sentence in the column, Esc closing the door first', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await next()
    lineRows()[0].click()
    await settle(200)
    $('.desk-run__side button.bkd-row').click()
    await settle(200)
    expect($('.desk-run__side .desk-entry')).not.toBeNull()
    press('Escape')
    await settle(150)
    // The door closed; the passed sentence is still open.
    expect($('.desk-run__side .desk-entry')).toBeNull()
    expect($('.desk-run__side .bkd').textContent).toContain(`the words of ${FIRST.phrase}`)
    press('Escape')
    await settle(150)
    expect($('.desk-run__side > .desk-sealed')).not.toBeNull()
  })

  it('fetch the breakdown a sentence never had, when it is opened', async () => {
    failing.add(FIRST.phrase)
    await reading()
    await settle(300)
    await grade('denki')
    expect($('.desk-run__side').textContent).toContain('indisponible')
    await next()
    failing.delete(FIRST.phrase)
    const before = apiFetch.mock.calls.filter(c => c[0] === '/api/phrase/analyze').length
    lineRows()[0].click()
    await settle(250)
    expect(apiFetch.mock.calls.filter(c => c[0] === '/api/phrase/analyze').length).toBe(before + 1)
    const call = apiFetch.mock.calls.filter(c => c[0] === '/api/phrase/analyze').at(-1)
    expect(JSON.parse(call[2].body)).toMatchObject({ phrase: FIRST.phrase, deep: false, save: false })
    expect($('.desk-run__side .bkd').textContent).toContain(`the words of ${FIRST.phrase}`)
  })

  it('walk with the arrows, one tab stop', async () => {
    await reading()
    await settle(300)
    await grade('denki')
    await next()
    await grade('yama', '4')
    await next()
    const rows = lineRows()
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.tabIndex)).toEqual([-1, -1, 0])
    rows[2].focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(rows[1])
    // The worst on the four-tile scale: its dot in the wrong ink.
    expect(rows[1].querySelector('.desk-sentence__dot--q1')).not.toBeNull()
  })

  it('keep translation\'s reference off the row until the answer is in', async () => {
    await render(<Run at="/practice/translation/level/N5" path="/practice/translation/level/:level" element={<TranslationRun session={null} />} />)
    await settle(300)
    expect($('.desk-sentence--now').textContent).not.toContain(FIRST.phrase)
    $('form.stage__foot input').focus()
    await userEvent.keyboard('denki')
    await userEvent.keyboard('{Enter}')
    await settle(250)
    expect($('.desk-sentence--now').textContent).toContain(FIRST.phrase)
  })

  it('keep dictation\'s line unknown until the reveal, and list Space first', async () => {
    await render(<Run at="/practice/dictation/N5" path="/practice/dictation/:level" element={<DictationRun session={null} />} />)
    await settle(300)
    expect($$('.desk-sentences .desk-keys .desk-kbd').map(k => k.textContent)).toEqual(['Espace', 'Entrée', '1–4', 'Échap'])
    expect($('.desk-sentence--now').textContent).toContain('…')
    $('form.stage__foot input').focus()
    await userEvent.keyboard('denki')
    await userEvent.keyboard('{Enter}')
    await settle(300)
    expect($('.desk-sentence--now').textContent).toContain(FIRST.phrase)
  })
})
