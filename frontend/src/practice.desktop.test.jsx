import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider, useLang } from './LangContext'
import './index.css'

// ── 机 — the practice runs without the pointer (plan 123, P6) ──────
// A sentence on the desk went: type, Enter (the form submits), a digit
// (the rating bar rates from the window) -- and then the pointer, to a
// Next that had no key, on every sentence. Comprehension's Next one
// platform over answered Enter. Now all of 読解, 翻訳 and 書取 go:
// type, Enter, a digit, Enter, and the next sentence is in hand.
// Dictation's clip answers Space (the exam's does), the listen puts the
// pen in the field, and replays stay on ▶: Space in the field is a
// space. The placement retake in Settings answers the mock exam's keys,
// and the video platform's link field takes Enter.

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
const { default: TranslationRun } = await import('./screens/TranslationRun')
const { default: DictationRun } = await import('./screens/DictationRun')
const { default: PlacementTest } = await import('./components/onboarding/PlacementTest')
const { IntakeVideo } = await import('./components/analysis/IntakeVideo')

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

const nextButton = () => $$('.stage__foot .btn-primary').find(b => b.getAttribute('aria-keyshortcuts') === 'Enter')
const field = () => $('form.stage__foot input')

// Type, Enter, a digit, Enter: one sentence, and the next in hand.
async function oneSentence(answer) {
  await userEvent.keyboard(answer)
  await userEvent.keyboard('{Enter}')
  await settle(250)
  expect($('.rating-bar'), 'the answer was submitted').not.toBeNull()
  // '1' is the best rating on either scale (domain/ratingScales).
  await userEvent.keyboard('1')
  await settle(250)
  expect($('.rating-bar')).toBeNull()
  const next = nextButton()
  expect(next, 'Next answers Enter').toBeTruthy()
  // On the run's panels (plan 128) the button prints no cap: the run's
  // lines list the keys, Enter first.
  expect(next.querySelector('.desk-kbd')).toBeNull()
  expect($$('.desk-sentences .desk-keys .desk-kbd').some(k => /^(Enter|Entrée)$/.test(k.textContent))).toBe(true)
  await userEvent.keyboard('{Enter}')
  await settle(300)
  expect(nextButton()).toBeUndefined()
  expect(field(), 'the next sentence is in hand').not.toBeNull()
}

describe('a sentence run on the desk', () => {
  it('reads with no pointer: type, Enter, a digit, Enter', async () => {
    await render(<Run at="/practice/reading/level/N5" path="/practice/reading/level/:level" element={<ReadingRun session={null} />} />)
    await settle(300)
    expect(document.activeElement).toBe(field())
    await oneSentence('gakkou wa kuji desu')
    expect(document.activeElement).toBe(field())
  })

  it('translates with no pointer', async () => {
    await render(<Run at="/practice/translation/level/N5" path="/practice/translation/level/:level" element={<TranslationRun session={null} />} />)
    await settle(300)
    field().focus()
    await oneSentence('gakkou')
  })

  it('takes a line of dictation with no pointer: Space listens, and the pen is in the field', async () => {
    await render(<Run at="/practice/dictation/N5" path="/practice/dictation/:level" element={<DictationRun session={null} />} />)
    await settle(300)
    const play = $('.clip-player__play')
    expect(play.getAttribute('aria-keyshortcuts')).toBe('Space')
    expect($('.clip-player .desk-kbd')).toBeNull()
    expect($('.desk-sentences .desk-keys .desk-kbd')?.textContent).toMatch(/^(Space|Espace)$/)
    // Nothing is focused on arrival, so the first Space is the clip's.
    expect(document.activeElement).not.toBe(field())
    await userEvent.keyboard(' ')
    await settle(200)
    expect($$('.clip-player__mark--spent')).toHaveLength(1)
    expect(document.activeElement).toBe(field())
    // In the field a space is a space, not a second listen.
    await oneSentence('gakkou wa kuji desu')
    expect($$('.clip-player__mark--spent')).toHaveLength(0)
  })

  it('keeps Space from a spent clip', async () => {
    await render(<Run at="/practice/dictation/N5" path="/practice/dictation/:level" element={<DictationRun session={null} />} />)
    await settle(300)
    await userEvent.keyboard(' ')
    await settle(300)
    document.activeElement.blur()
    await userEvent.keyboard(' ')
    await settle(300)
    document.activeElement.blur()
    expect($$('.clip-player__mark--spent')).toHaveLength(2)
    await userEvent.keyboard(' ')
    await settle(200)
    expect($$('.clip-player__mark--spent')).toHaveLength(2)
  })
})

// ── the placement retake (Settings → Learning) ──
const question = (id, sectionId, texts, answer) => ({
  id, sectionId, kind: 'reading', type: 'mcq-text', promptJp: `${id}の問題`,
  choices: texts.map((textJp, i) => ({ id: `${id}-c${i + 1}`, textJp })), answer,
})

describe('the placement retake on the desk', () => {
  it('picks with a digit and goes on with Enter, from a clicked choice too', async () => {
    apiJsonWithTimeout.mockImplementation(async path => path === '/api/onboarding/placement'
      ? { seed: 7, questions: [question('q1', 'N5', ['一', '二', '三', '四'], 'q1-c2'), question('q2', 'N4', ['東', '西', '南', '北'], 'q2-c1')] }
      : { recommendedLevel: 'N5', correct: 2, total: 2, perLevel: {} })
    const onResult = vi.fn()
    await render(
      <LangProvider>
        <div className="phone phone--desk"><div className="phone__content"><PlacementTest session={{}} onResult={onResult} /></div></div>
      </LangProvider>
    )
    await settle(200)
    const go = $('.onb-action')
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(go.querySelector('.desk-kbd')).not.toBeNull()
    expect($$('.mcq-row').map(r => r.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4'])

    await userEvent.keyboard('2')
    await settle()
    expect($$('.mcq-row')[1].getAttribute('aria-checked')).toBe('true')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect($('.exam-question, .mcq-list')?.textContent ?? document.body.textContent).toContain('東')

    await userEvent.click($$('.mcq-row')[0])
    await userEvent.keyboard('{Enter}')
    await settle(200)
    const score = apiJsonWithTimeout.mock.calls.find(c => c[0] === '/api/onboarding/placement/score')
    expect(JSON.parse(score[2].body).answers).toEqual({ q1: 'q1-c2', q2: 'q2-c1' })
    expect(onResult).toHaveBeenCalledTimes(1)
  })

  it('leaves Stop its own Enter', async () => {
    apiJsonWithTimeout.mockImplementation(async path => path === '/api/onboarding/placement'
      ? { seed: 7, questions: [question('q1', 'N5', ['一', '二', '三', '四'], 'q1-c2'), question('q2', 'N4', ['東', '西', '南', '北'], 'q2-c1')] }
      : { recommendedLevel: 'N5', correct: 0, total: 2, perLevel: {} })
    const onCancel = vi.fn()
    await render(
      <LangProvider>
        <div className="phone phone--desk"><div className="phone__content"><PlacementTest session={{}} onResult={() => {}} onCancel={onCancel} /></div></div>
      </LangProvider>
    )
    await settle(200)
    await userEvent.keyboard('1')
    await settle()
    $$('.onb-link').at(-1).focus()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

// ── the video platform's link ──
describe('the video link on the desk', () => {
  function Intake({ onStart, linkFetch = true }) {
    const { t } = useLang()
    return (
      <IntakeVideo t={t} url="https://youtu.be/dQw4w9WgXcQ" onUrlChange={() => {}} onStartFromFile={() => {}}
        onStartFromLink={onStart} linkFetch={linkFetch} />
    )
  }

  it('analyses the link on Enter in its field, the key printed on the button', async () => {
    const onStart = vi.fn()
    await render(<LangProvider><Intake onStart={onStart} /></LangProvider>)
    await settle()
    const button = $('.anl-link .btn-primary')
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(button.querySelector('.desk-kbd')).not.toBeNull()
    $('.anl-field-row input').focus()
    await userEvent.keyboard('{Enter}')
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart.mock.calls[0][0]).toBe('https://youtu.be/dQw4w9WgXcQ')
  })

  it('leaves Enter alone where the server cannot fetch a link', async () => {
    const onStart = vi.fn()
    await render(<LangProvider><Intake onStart={onStart} linkFetch={false} /></LangProvider>)
    await settle()
    $('.anl-field-row input').focus()
    await userEvent.keyboard('{Enter}')
    expect(onStart).not.toHaveBeenCalled()
  })
})
