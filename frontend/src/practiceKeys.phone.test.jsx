import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── the practice runs' keys stay the desk's (plan 123, P6) ─────────
// practice.desktop.test.jsx is the desk's side: Enter takes a graded
// sentence's Next, Space plays dictation's clip, ← → turn a browse, the
// placement retake answers digits and Enter, and each prints its key.
// This is the phone's: none of those keys is listened for, no key is
// printed or named, and dictation's field has the focus on arrival, as
// it always had -- the phone's keyboard comes up with the clip.

const apiFetch = vi.hoisted(() => vi.fn())
const apiJson = vi.hoisted(() => vi.fn())
const apiJsonWithTimeout = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
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
const { default: DictationRun } = await import('./screens/DictationRun')
const { default: ReviewDeck } = await import('./components/study/ReviewDeck')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const ok = body => ({ ok: true, status: 200, json: async () => body })

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='
const PHRASE = {
  phrase: '学校は九時からです。', romaji: 'gakkou wa kuji kara desu', translation: 'School starts at nine.',
  translation_lang: 'en', display_seconds: 30, source_word: { kanji: '学校', kana: 'がっこう', level: 'N5' },
}
const ANALYSIS = {
  text: PHRASE.phrase, level: 'N5', available: true, grammar: [], unknown_count: 0, off_deck_count: 0,
  tokens: [{ surface: '学校', reading: 'がっこう', meaning: 'school', pos: 'noun', furigana: [{ text: '学校', reading: 'がっこう' }] }],
}
const REVEAL = {
  id: 'clip-one', level: 'N5', jp: PHRASE.phrase, kana: 'がっこうはくじからです。', romaji: PHRASE.romaji,
  furigana: [{ text: '学校', reading: 'がっこう' }, { text: 'は九時からです。' }],
  translation: PHRASE.translation, translation_lang: 'en', accuracy: 90, matched: 'romaji',
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/reading/batch') || u.startsWith('/api/translation/batch')) return ok({ phrases: [PHRASE, { ...PHRASE, phrase: '駅で会いました。' }] })
    if (u === '/api/reading/check') return ok({ accuracy: 80, matched: 'romaji' })
    if (u === '/api/translation/analyze') return ok({ review: null, analysis: 'Natural.' })
    if (u === '/api/phrase/analyze') return ok(ANALYSIS)
    return ok({})
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async path => {
    if (path.startsWith('/api/dictation/batch')) {
      return { level: 'N5', max_plays: 2, clips: [{ id: 'clip-one', level: 'N5', audioSrc: SILENCE }, { id: 'clip-two', level: 'N5', audioSrc: `${SILENCE}#2` }] }
    }
    if (path === '/api/dictation/check') return REVEAL
    return { correct: true }
  })
  apiJsonWithTimeout.mockReset()
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
const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

describe('the practice runs on a phone', () => {
  it('prints no key on a graded sentence\'s Next, and Enter does not take it', async () => {
    await render(<Run at="/practice/reading/level/N5" path="/practice/reading/level/:level" element={<ReadingRun session={null} />} />)
    await settle(300)
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const input = $('form.stage__foot input')
    setValue.call(input, 'gakkou')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    $('form.stage__foot').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(250)
    $$('.rating-bar__btn').at(-1).click()
    await settle(250)
    const next = $('.stage__foot .btn-primary')
    expect(next.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(next.querySelector('.desk-kbd')).toBeNull()
    document.activeElement?.blur?.()
    key('Enter')
    await settle(250)
    expect($('.stage__foot .btn-primary')).toBe(next)
  })

  it('keeps dictation\'s field focused on arrival, and Space nobody\'s', async () => {
    await render(<Run at="/practice/dictation/N5" path="/practice/dictation/:level" element={<DictationRun session={null} />} />)
    await settle(300)
    expect(document.activeElement).toBe($('form.stage__foot input'))
    const play = $('.clip-player__play')
    expect(play.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect($('.clip-player .desk-kbd')).toBeNull()
    document.activeElement.blur()
    key(' ')
    await settle(200)
    expect($$('.clip-player__mark--spent')).toHaveLength(0)
  })

  it('turns a browse by its buttons only', async () => {
    const cards = [{ card_id: 'a', stage: 'learning' }, { card_id: 'b', stage: 'learning' }]
    await render(
      <LangProvider>
        <ReviewDeck cards={cards} loading={false} t={{ reviewPrev: 'Prev', reviewNext: 'Next', nothingGraded: '' }} session={null}
          renderFront={c => <span>{c.card_id}</span>} renderBack={c => <span>{c.card_id}!</span>} onExit={() => {}} />
      </LangProvider>
    )
    await settle()
    expect($$('.browse-nav button').map(b => b.hasAttribute('aria-keyshortcuts'))).toEqual([false, false])
    expect($('.browse-nav .desk-kbd')).toBeNull()
    key('ArrowRight')
    await settle()
    expect($('.review-deck__counter').textContent).toBe('1 / 2')
  })
})
