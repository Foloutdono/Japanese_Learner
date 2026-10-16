import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 会話 — a scenario ridden three ways (plan 217) ──────────────────
// Someone speaks to the learner and they answer. The rules worth
// pinning, whatever the way: the scene opens on its brief; the line
// just said is held untranslated until it is answered, unless the
// learner asks; the talk goes on as the script has it. Choose: a pick
// is the answer, the right reply ringed and why said, graded by the
// pick. Translate: what to say is the learner's language, the check and
// the tutor go out together, the bar is the grade, a spent day loses
// the tutor and nothing else. Free: the other person answers what was
// written, the tutor's word stands under the line, the bar grades it,
// and the day's ceiling closes the talk and says so. Since plan 221 the
// talk is heard as it is said, under the run's speaker switch (the
// layout itself is measured in ConversationRun.phone.test.jsx); since
// plan 223 a pick is sent into the talk as the learner's bubble,
// marked, a wrong one struck with the right one after it. French copy:
// the lane's.

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
  playUi: () => {},
  playClick: () => {},
  playSfx: () => {},
  speakLine: vi.fn(() => Promise.resolve(false)),
  speakSentence: vi.fn(),
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ConversationRun } = await import('./ConversationRun')
const { speakLine, speakSentence } = await import('../lib/audio')
const { setSpeakOnReveal } = await import('../lib/audio/reveal')

const plain = text => [{ text }]
const SCRIPT = {
  id: 'konbini-lunch',
  level: 'N5',
  place: { jp: 'コンビニ', parts: plain('コンビニ'), name: 'Supérette' },
  title: 'Le déjeuner à la supérette',
  situation: 'Tu es à la caisse d’une supérette avec un bento.',
  goal: 'Achète ton déjeuner.',
  them: 'Vendeur',
  register: 'polite',
  turns: [
    {
      them: { jp: 'お弁当は温めますか。', parts: plain('お弁当は温めますか。'), translation: 'Je vous réchauffe le bento.' },
      me: {
        jp: 'はい、お願いします。', parts: plain('はい、お願いします。'), romaji: 'hai, onegai shimasu', words: [],
        translation: 'Oui, s’il vous plaît.', note: '「お願いします」 accepte poliment une offre.',
      },
      alt: [{ jp: 'はい、温めてください。', parts: plain('はい、温めてください。'), romaji: 'hai, atatamete kudasai', words: [] }],
      choices: [
        { jp: 'はい、温かいです。', parts: plain('はい、温かいです。'), translation: 'Oui, il est chaud.', note: '「温かいです」 dit que le bento est chaud.', right: false },
        { jp: 'はい、お願いします。', parts: plain('はい、お願いします。'), translation: 'Oui, s’il vous plaît.', note: '「お願いします」 accepte poliment une offre.', right: true },
        { jp: 'いただきます。', parts: plain('いただきます。'), translation: 'Bon appétit.', note: '「いただきます」 se dit à table.', right: false },
      ],
    },
    {
      them: { jp: 'お箸はいりますか。', parts: plain('お箸はいりますか。'), translation: 'Il vous faut des baguettes.' },
      me: {
        jp: 'はい、ください。', parts: plain('はい、ください。'), romaji: 'hai, kudasai', words: [],
        translation: 'Oui, donnez-m’en.', note: '「ください」 demande qu’on te donne quelque chose.',
      },
      alt: [],
      choices: [
        { jp: 'はい、ください。', parts: plain('はい、ください。'), translation: 'Oui, donnez-m’en.', note: '「ください」 demande.', right: true },
        { jp: 'はい、あります。', parts: plain('はい、あります。'), translation: 'Oui, il y en a.', note: '「あります」 dit qu’une chose existe.', right: false },
        { jp: 'いいえ、いります。', parts: plain('いいえ、いります。'), translation: 'Non, j’en ai besoin.', note: 'Non et oui à la fois.', right: false },
      ],
    },
  ],
  close: { jp: 'ありがとうございました。', parts: plain('ありがとうございました。'), translation: 'Merci beaucoup.' },
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
const refused = status => ({ ok: false, status, json: async () => ({ detail: 'no' }) })
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const fetchCalls = url => apiFetch.mock.calls.filter(c => String(c[0]) === url)
const jsonCalls = url => apiJson.mock.calls.filter(c => String(c[0]).startsWith(url))
const body = call => JSON.parse(call[2].body)
const lineTexts = root => [...root.querySelectorAll('.kaiwa-talk > .tour-line .dict-ex__jp')].map(el => el.textContent)

// What each stub answers; a test bends one of these before mounting.
let review = () => ok({ review: null, analysis: 'Très naturel.', japanese: null })
let talk = () => ok({})

const here = { path: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname + loc.search
  return null
}

async function run(mode = 'choose', id = 'konbini-lunch') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/practice/conversation/${id}/${mode}`]}>
        <Routes>
          <Route path="/practice/conversation" element={<p>station</p>} />
          <Route path="/practice/conversation/:scenario/:mode" element={<ConversationRun session={null} />} />
        </Routes>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(120)
  return screen.container
}

async function started(mode) {
  const root = await run(mode)
  const start = [...root.querySelectorAll('.stage__foot .btn-primary')].find(b => b.textContent.includes('Commencer'))
  start.click()
  await settle(80)
  return root
}

function submit(root, text) {
  type(root.querySelector('.stage__foot input'), text)
  root.querySelector('form.stage__foot').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  apiFetch.mockReset()
  apiJson.mockReset()
  review = () => ok({ review: null, analysis: 'Très naturel.', japanese: null })
  talk = () => ok({})
  apiJson.mockImplementation(async url => {
    if (String(url).startsWith('/api/conversation/scenario/')) return JSON.parse(JSON.stringify(SCRIPT))
    if (String(url) === '/api/conversation/check') return { accuracy: 100, matched: 'romaji', target: 0, japanese: 'はい、おねがいします' }
    return {}
  })
  apiFetch.mockImplementation(async url => {
    if (url === '/api/conversation/review') return review()
    if (url === '/api/conversation/talk') return talk()
    if (url === '/api/conversation/result') return ok({ correct: true, quality: 4, xp_earned: 7, leveled_up: false, new_level: 2 })
    return ok({})
  })
})

describe('a conversation, before it starts', () => {
  it('opens on the scene: its place, what is going on, the errand and the way', async () => {
    const root = await run('choose')
    expect(root.querySelector('.tour-plate').getAttribute('aria-label')).toBe('Supérette')
    expect(root.querySelector('.kaiwa-brief__situation').textContent).toContain('Tu es à la caisse')
    expect(root.querySelector('.kaiwa-brief__goal').textContent).toContain('Achète ton déjeuner.')
    expect(root.querySelector('.kaiwa-brief .kaiwa-how').textContent.length).toBeGreaterThan(10)
    // Nothing is said yet.
    expect(root.querySelector('.kaiwa-talk')).toBeNull()
  })

  it('sends a way it does not know back to the station', async () => {
    await run('sing')
    await vi.waitFor(() => expect(here.path).toBe('/practice/conversation'))
  })
})

describe('Choose', () => {
  it('holds the line just said untranslated until it is answered, unless asked', async () => {
    const root = await started('choose')
    const lines = root.querySelectorAll('.kaiwa-talk > .tour-line')
    expect(lines).toHaveLength(1)
    expect(lines[0].querySelector('.dict-ex__tr')).toBeNull()
    root.querySelector('.kaiwa-tr').click()
    await settle(40)
    expect(root.querySelector('.kaiwa-talk .dict-ex__tr').textContent).toBe('Je vous réchauffe le bento.')
  })

  it('sends a pick into the talk: a wrong one struck under its mark and why, the right one after it, the pick graded', async () => {
    const root = await started('choose')
    const replies = [...root.querySelectorAll('.kaiwa-reply')]
    expect(replies.map(r => r.textContent)).toEqual(expect.arrayContaining(['1はい、温かいです。', '2はい、お願いします。', '3いただきます。']))
    replies[0].click()
    await settle(120)
    // The replies go: the pick is the learner's bubble now.
    expect(root.querySelector('.kaiwa-reply')).toBeNull()
    const taken = root.querySelector('.kaiwa-talk > .kaiwa-line--taken')
    expect(taken.querySelector('.dict-ex__jp').textContent).toBe('はい、温かいです。')
    expect(taken.querySelector('.kaiwa-mark--no .sr-only').textContent).toBe('Faux')
    expect(taken.querySelector('.tour-line__foot').textContent).toContain('dit que le bento est chaud')
    // The reply that was right follows it, named, its own why inside.
    const right = root.querySelector('.kaiwa-talk > .kaiwa-line--right')
    expect(taken.nextElementSibling).toBe(right)
    expect(right.querySelector('.tour-line__who').textContent).toBe('La réponse')
    expect(right.querySelector('.dict-ex__jp').textContent).toBe('はい、お願いします。')
    expect(right.querySelector('.kaiwa-why').textContent).toContain('accepte poliment une offre')
    const [call] = fetchCalls('/api/conversation/result')
    expect(body(call)).toEqual({ scenario: 'konbini-lunch', mode: 'choose', turn: 0, correct: false })
  })

  it('keeps a miss in the talk once it goes on, and lets the notes go', async () => {
    const root = await started('choose')
    root.querySelectorAll('.kaiwa-reply')[0].click()
    await settle(80)
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    // The struck reply, the right one and the next line: the talk's
    // history, marks and all -- and no note left from the last turn.
    expect(lineTexts(root)).toEqual(['お弁当は温めますか。', 'はい、温かいです。', 'はい、お願いします。', 'お箸はいりますか。'])
    expect(root.querySelector('.kaiwa-line--taken .kaiwa-mark--no')).not.toBeNull()
    expect(root.querySelector('.tour-line__foot')).toBeNull()
    expect(root.querySelector('.kaiwa-why')).toBeNull()
    // And the next turn's replies are back under it.
    expect(root.querySelectorAll('.kaiwa-reply')).toHaveLength(3)
  })

  it('goes on as the script has it, and ends on the scene\'s last word', async () => {
    const root = await started('choose')
    root.querySelectorAll('.kaiwa-reply')[1].click()
    await settle(80)
    // A right pick is the learner's line at once, ringed, its why inside.
    const mine = root.querySelector('.kaiwa-talk > .tour-line--me')
    expect(mine.querySelector('.kaiwa-mark--ok .sr-only').textContent).toBe('Juste')
    expect(mine.querySelector('.kaiwa-why').textContent).toContain('accepte poliment une offre')
    expect(root.querySelector('.kaiwa-line--taken')).toBeNull()
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    // The learner is credited with the reply, and the next line follows.
    expect(lineTexts(root)).toEqual(['お弁当は温めますか。', 'はい、お願いします。', 'お箸はいりますか。'])
    // The line answered now shows what it said.
    expect(root.querySelector('.kaiwa-talk .dict-ex__tr').textContent).toBe('Je vous réchauffe le bento.')
    root.querySelectorAll('.kaiwa-reply')[0].click()
    await settle(80)
    const finish = root.querySelector('.stage__foot .btn-primary')
    expect(finish.textContent).toContain('Terminer')
    finish.click()
    await settle(80)
    expect(lineTexts(root).at(-1)).toBe('ありがとうございました。')
    expect(root.querySelector('.kaiwa-over')).not.toBeNull()
    expect(root.querySelector('.kaiwa-over .record__value').textContent).toBe('2/ 2')
    // Another scene: back to the station, on the scene's grade.
    ;[...root.querySelectorAll('.stage__foot .btn-primary')].at(-1).click()
    await vi.waitFor(() => expect(here.path).toBe('/practice/conversation?level=N5'))
  })
})

describe('the talk heard as it is said (plan 221)', () => {
  const heard = () => speakLine.mock.calls.map(([jp, who]) => `${who}:${jp}`)

  beforeEach(() => {
    speakLine.mockClear()
    speakSentence.mockClear()
    setSpeakOnReveal(true)
  })

  it('voices the other person as they speak, and a right reply in the learner\'s voice once, at the pick', async () => {
    const root = await started('choose')
    expect(heard()).toEqual(['them:お弁当は温めますか。'])
    root.querySelectorAll('.kaiwa-reply')[1].click()
    await settle(60)
    expect(heard().at(-1)).toBe('me:はい、お願いします。')
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    // The reply was said at the pick: Next says only what answers it.
    expect(heard()).toEqual(['them:お弁当は温めますか。', 'me:はい、お願いします。', 'them:お箸はいりますか。'])
  })

  it('says the reply that was right at a wrong pick, never the one taken, then the answer to it', async () => {
    const root = await started('choose')
    root.querySelectorAll('.kaiwa-reply')[0].click()
    await settle(60)
    // The reply the talk takes, in the learner's voice, as it appears.
    expect(heard()).toEqual(['them:お弁当は温めますか。', 'me:はい、お願いします。'])
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    expect(heard()).toEqual(['them:お弁当は温めますか。', 'me:はい、お願いします。', 'them:お箸はいりますか。'])
  })

  it('stays quiet with the run\'s speaker switched off, and the switch is in the head', async () => {
    setSpeakOnReveal(false)
    const root = await started('choose')
    expect(root.querySelector('.stage__head [data-action="speak-on-reveal"]').getAttribute('aria-pressed')).toBe('false')
    root.querySelectorAll('.kaiwa-reply')[1].click()
    await settle(60)
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    expect(speakLine).not.toHaveBeenCalled()
    setSpeakOnReveal(true)
  })

  it('voices a free reply on the device, as it lands', async () => {
    talk = () => ok({
      reply: { jp: '温めますね。', parts: plain('温めますね。'), translation: 'Je le réchauffe.', done: false },
      review: null, analysis: 'Naturel.', japanese: 'はい',
    })
    const root = await started('free')
    submit(root, 'hai')
    await settle(160)
    expect(speakSentence).toHaveBeenCalledWith('温めますね。')
  })
})

describe('Translate', () => {
  it('asks in the learner\'s language, then measures, reviews and lets the bar grade', async () => {
    const root = await started('translate')
    expect(root.querySelector('.kaiwa-ask').textContent).toContain('Oui, s’il vous plaît.')
    submit(root, 'hai onegai shimasu')
    await settle(160)
    expect(body(jsonCalls('/api/conversation/check')[0])).toEqual({ scenario: 'konbini-lunch', turn: 0, answer: 'hai onegai shimasu' })
    expect(body(fetchCalls('/api/conversation/review')[0])).toEqual({ scenario: 'konbini-lunch', turn: 0, answer: 'hai onegai shimasu', lang: 'fr' })
    // The reply the answer is read against, and the learner's answer in its well.
    expect(root.querySelector('.kaiwa-check .pcard-lead__jp').textContent).toBe('はい、お願いします。')
    expect(root.querySelector('.kaiwa-check .pcard-well').textContent).toContain('hai')
    expect(root.querySelector('.kaiwa-check .prose__ai').textContent).toBe('Très naturel.')
    const keys = [...root.querySelectorAll('.rating-bar button')]
    expect(keys.length).toBeGreaterThan(0)
    keys.at(-1).click()
    await settle(120)
    const result = body(fetchCalls('/api/conversation/result')[0])
    expect(result).toMatchObject({ scenario: 'konbini-lunch', mode: 'translate', turn: 0, accuracy: 100, verdict: null })
    expect(result.quality).toBeGreaterThan(2)
    expect(root.querySelector('.stage__foot .btn-primary').textContent).toContain('Suivant')
  })

  it('loses the tutor and nothing else once the day is spent', async () => {
    review = () => refused(429)
    const root = await started('translate')
    submit(root, 'hai')
    await settle(160)
    expect(root.querySelector('.kaiwa-check').textContent).toContain('Le tuteur a fini sa journée')
    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(80)
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(80)
    submit(root, 'hai kudasai')
    await settle(160)
    // No second call the server would refuse and still count.
    expect(fetchCalls('/api/conversation/review')).toHaveLength(1)
    expect(jsonCalls('/api/conversation/check')).toHaveLength(2)
  })
})

describe('Free talk', () => {
  const REPLY = {
    reply: { jp: '温めますね。', parts: plain('温めますね。'), translation: 'Je le réchauffe.', done: false },
    review: {
      verdict: 'correct', summary: 'Naturel.', meaning: 'Oui.', good: ['「はい」 répond'], fix: [], grammar_used: null, better: '',
    },
    analysis: 'Naturel.',
    japanese: 'はい',
  }

  it('answers what was written, reads it back under the line, and lets the bar grade it', async () => {
    talk = () => ok(REPLY)
    const root = await started('free')
    submit(root, 'hai')
    await settle(160)
    expect(body(fetchCalls('/api/conversation/talk')[0])).toEqual({
      scenario: 'konbini-lunch',
      lines: [{ who: 'them', jp: 'お弁当は温めますか。' }],
      answer: 'hai',
      lang: 'fr',
    })
    // The learner's line in the Japanese the tutor read it as, what was
    // typed under it, the tutor's word, then the other person's answer.
    expect(lineTexts(root)).toEqual(['お弁当は温めますか。', 'はい', '温めますね。'])
    expect(root.querySelector('.kaiwa-typed').textContent).toBe('hai')
    expect(root.querySelector('.kaiwa-review .rvw__summary').textContent).toBe('Naturel.')
    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(120)
    expect(body(fetchCalls('/api/conversation/result')[0])).toMatchObject({ mode: 'free', turn: 0, verdict: 'correct' })
    // Graded, the field is back for the next line.
    expect(root.querySelector('.stage__foot input')).not.toBeNull()
  })

  it('ends when the other person closes the scene, once the last line is graded', async () => {
    talk = () => ok({ ...REPLY, reply: { ...REPLY.reply, jp: 'ありがとうございました。', done: true } })
    const root = await started('free')
    submit(root, 'arigatou')
    await settle(160)
    expect(root.querySelector('.kaiwa-end')).not.toBeNull()
    ;[...root.querySelectorAll('.rating-bar button')].at(-1).click()
    await settle(120)
    expect(root.querySelector('.kaiwa-over')).not.toBeNull()
  })

  it('says so when the day\'s lines are spent, and keeps what was written', async () => {
    talk = () => refused(429)
    const root = await started('free')
    submit(root, 'hai')
    await settle(160)
    expect(root.querySelector('.kaiwa-alert').textContent).toContain('C’est tout pour la conversation libre')
    expect(lineTexts(root)).toEqual(['お弁当は温めますか。'])
    expect(root.querySelector('.stage__foot input')).toBeNull()
  })

  it('takes a failed line back into the field to be sent again', async () => {
    talk = () => refused(503)
    const root = await started('free')
    submit(root, 'hai')
    await settle(160)
    expect(root.querySelector('.kaiwa-alert').textContent).toContain('Réessaie')
    expect(root.querySelector('.stage__foot input').value).toBe('hai')
  })

  it('waits in the other person\'s row while they answer', async () => {
    let answer
    talk = () => new Promise(r => { answer = () => r(ok(REPLY)) })
    const root = await started('free')
    submit(root, 'hai')
    await settle(80)
    const wait = root.querySelector('.kaiwa-talk > .kaiwa-pending')
    expect(wait.querySelector('.tour-line__who').textContent).toBe('Vendeur')
    expect(wait.querySelector('.loading')).not.toBeNull()
    expect(wait.querySelector('.sr-only').textContent).toBe('Vendeur répond…')
    answer()
    await settle(120)
    expect(root.querySelector('.kaiwa-pending')).toBeNull()
    expect(lineTexts(root).at(-1)).toBe('温めますね。')
  })
})
