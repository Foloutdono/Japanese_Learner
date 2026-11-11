import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import fr from '../../locales/fr/index.js'
import { ApiError } from '../../lib/api'
import '../../index.css'

// ── Nous écrire on a phone (plan 222) ────────────────────────────────
// The owner's pick A + B + C: the form in a sheet (Settings' row, the
// link under a failure) and the card's own sheet behind the flag. What
// the learner sees is what is sent -- the classes printed under their
// box go, unticked none do -- the reply is offered only with an address
// to reply to, a refusal is said in the table's words, and every send
// ends on the 受付 stamp.
vi.mock('../../LangContext', () => ({ useLang: () => ({ t: fr, lang: 'fr' }) }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))

const { FeedbackSheet, CardFlag, ReportProblem, FeedbackHost, QuestionReport } = await import('./FeedbackSheet')
const { closeFeedback } = await import('../../stores/feedbackSheet')
// A run's doors raise their sheet in App's host, beside <Routes/>.
const inApp = node => <MemoryRouter>{node}<FeedbackHost session={LEARNER} /></MemoryRouter>
const { default: SessionError } = await import('../study/SessionError')

const LEARNER = { access_token: 'tok', user: { id: 'u1', email: 'aiko@example.com' } }
const GUEST = { access_token: 'tok', user: { id: 'u2', is_anonymous: true } }
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const sent = () => JSON.parse(apiJson.mock.calls.at(-1)[2].body)

beforeEach(() => {
  closeFeedback()
  apiJson.mockReset()
  apiJson.mockResolvedValue({ ok: true, at: '2026-10-16T09:30:00+00:00' })
})

describe('the form, in its sheet', () => {
  it('sends nothing empty, then the kind, the words and the classes it printed', async () => {
    await render(<FeedbackSheet open onClose={() => {}} session={LEARNER} />)
    const send = $('.fb-form__send')
    expect(send.disabled).toBe(true)
    await userEvent.click(document.querySelector('.seg__opt:nth-child(2)'))
    expect($('.fb-form__text').placeholder).toBe(fr.fbPlaceholder.idea)
    await userEvent.type($('.fb-form__text'), 'Revoir les cartes ratées.')
    expect($('.fb-form__count').textContent).toBe('25 / 1000')
    const printed = $('.fb-check__what').textContent
    await userEvent.click(send)
    await settle()
    expect(apiJson).toHaveBeenCalledTimes(1)
    expect(apiJson.mock.calls[0][0]).toBe('/api/feedback')
    const body = sent()
    expect(body).toMatchObject({ kind: 'idea', text: 'Revoir les cartes ratées.', reply: false })
    // Exactly the classes the box named, in words, and the route as a
    // pattern at most -- never a path.
    expect(printed).toContain(fr.fbDevice[body.vp])
    expect(printed).toContain(fr.fbPlatform[body.platform])
    expect(Object.keys(body).sort()).toEqual(['kind', 'lang', 'os', 'platform', 'reply', 'route', 'text', 'vp'])
    expect($('.fb-stamp__jp').textContent).toBe('受付')
    expect($('.fb-stamp__date').textContent).toBe('16.10.26')
    expect($('.fb-sent__say').textContent).toBe(fr.fbSent)
    expect($('.fb-sent__sub').textContent).toBe(fr.fbSentNote)
  })

  it('sends no class once the box is unticked, and the reply when asked', async () => {
    await render(<FeedbackSheet open onClose={() => {}} session={LEARNER} />)
    const [join, reply] = document.querySelectorAll('.fb-check__box')
    expect(reply.closest('label').textContent).toContain('contact.tsujijapanese@gmail.com')
    expect(reply.closest('label').textContent).not.toContain('aiko@example.com')
    await userEvent.click(join)
    await userEvent.click(reply)
    await userEvent.type($('.fb-form__text'), 'Ça plante.')
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect(sent()).toEqual({ kind: 'problem', text: 'Ça plante.', reply: true })
    expect($('.fb-sent__sub').textContent).toBe(fr.fbSentReply)
  })

  it('offers no reply to a guest, who has no address', async () => {
    await render(<FeedbackSheet open onClose={() => {}} session={GUEST} />)
    expect(document.querySelectorAll('.fb-check__box')).toHaveLength(1)
  })

  it('says the day’s limit in its own words and keeps the message', async () => {
    apiJson.mockRejectedValue(new ApiError(429, { detail: { code: 'feedback_limit', message: 'Five messages a day' } }, '/api/feedback'))
    await render(<FeedbackSheet open onClose={() => {}} session={LEARNER} />)
    await userEvent.type($('.fb-form__text'), 'Encore une.')
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect($('.fb-form__error').textContent).toBe(fr.fbErrLimit)
    expect($('.fb-form__text').value).toBe('Encore une.')
    expect($('.fb-form__send').disabled).toBe(false)
    expect($('.fb-form__error').textContent).not.toContain('Five')
  })

  it('says any other failure without the server’s sentence', async () => {
    apiJson.mockRejectedValue(new TypeError('Failed to fetch'))
    await render(<FeedbackSheet open onClose={() => {}} session={LEARNER} />)
    await userEvent.type($('.fb-form__text'), 'x')
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect($('.fb-form__error').textContent).toBe(fr.fbErrSend)
  })

  it('sends once, however fast the second press', async () => {
    let answer
    apiJson.mockImplementation(() => new Promise(r => { answer = r }))
    await render(<FeedbackSheet open onClose={() => {}} session={LEARNER} />)
    await userEvent.type($('.fb-form__text'), 'Deux fois ?')
    const send = $('.fb-form__send')
    send.click()
    send.click()
    await settle()
    expect(apiJson).toHaveBeenCalledTimes(1)
    answer({ ok: true })
  })
})

describe('the link under a failure (door C)', () => {
  it('joins the failure’s area and status, never its path', async () => {
    const error = new ApiError(503, null, '/api/decks/9f3a/study?mode=f2b')
    await render(inApp(<ReportProblem error={error} />))
    await userEvent.click($('.fb-link'))
    expect($('.fb-check__what').textContent).toContain(fr.fbFailure(503, '/api/decks'))
    await userEvent.type($('.fb-form__text'), 'La séance ne charge pas.')
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect(sent()).toMatchObject({ kind: 'problem', area: '/api/decks', status: 503 })
    expect(JSON.stringify(sent())).not.toContain('9f3a')
  })

  it('stays open while the run retries and the failure that raised it goes', async () => {
    // hooks/useCardSession clears its error to retry after 1, 2, 4 and
    // 8 seconds, which unmounts SessionError: the sheet must not go too.
    let setFailed
    function Run() {
      const [failed, set] = useState(true)
      setFailed = set
      return failed
        ? <SessionError error={new ApiError(503, null, '/api/today/queue')} onRetry={() => {}} session={LEARNER} />
        : <p>…</p>
    }
    await render(inApp(<Run />))
    await userEvent.click($('.fb-link'))
    await userEvent.type($('.fb-form__text'), 'Ça ne charge pas.')
    setFailed(false)
    await settle(60)
    expect($('.fb-link')).toBeNull()
    expect($('[role="dialog"] .fb-form__text')?.value).toBe('Ça ne charge pas.')
  })

  it('stands under a session’s failure, and not under an expired one', async () => {
    await render(
      <>
        <div data-case="failed"><SessionError error={new ApiError(500, null, '/api/today/queue')} onRetry={() => {}} session={LEARNER} /></div>
        <div data-case="expired"><SessionError error={new ApiError(401, null, '/api/today/queue')} onRetry={() => {}} session={LEARNER} /></div>
        <div data-case="bare"><SessionError error={new ApiError(500, null, '/api/today/queue')} onRetry={() => {}} /></div>
      </>,
    )
    expect($('[data-case="failed"] .fb-link')?.textContent).toBe(fr.reportProblem)
    expect($('[data-case="expired"] .fb-link')).toBeNull()
    expect($('[data-case="bare"] .fb-link')).toBeNull()
  })
})

describe('the flag on an answered card (door B)', () => {
  const CARD = { card_id: 'vocab_N5_先生_せんせい', kanji: '先生', kana: 'せんせい', meaning: 'professeur', mode: 'vocab.flashcard.f2b' }

  it('opens the card’s sheet and sends the card and what is wrong with it', async () => {
    await render(inApp(<CardFlag card={CARD} />))
    const flag = $('.fb-flag')
    expect(flag.getAttribute('aria-label')).toBe(fr.cardReport)
    await userEvent.click(flag)
    expect($('.fb-card__face').textContent).toBe('先生')
    expect($('.fb-card__level').textContent).toBe('N5')
    const send = $('.fb-form__send')
    expect(send.disabled).toBe(true)
    const chips = [...document.querySelectorAll('.fb-reasons .chip')]
    expect(chips.map(c => c.textContent)).toEqual(['Lecture', 'Sens', 'Audio', 'Exemple', 'Autre'])
    await userEvent.click(chips[1])
    expect(chips[1].getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(send)
    await settle()
    expect(sent()).toEqual({ kind: 'card', card_id: 'vocab_N5_先生_せんせい', reasons: ['meaning'], text: '' })
    expect($('.fb-stamp__jp').textContent).toBe('受付')
  })

  it('is not drawn on a personal card', async () => {
    const screen = await render(inApp(<CardFlag card={{ card_id: 'custom_12_7', kanji: '駅' }} />))
    expect(screen.container.querySelector('.fb-flag')).toBeNull()
  })

  it('keeps the head’s height on a phone, its target a thumb’s', async () => {
    await render(<div className="stage__head"><CardFlag card={CARD} /></div>)
    const box = $('.fb-flag').getBoundingClientRect()
    expect(box.height).toBeLessThanOrEqual(40)
    const hit = getComputedStyle($('.fb-flag'), '::after')
    expect(hit.position).toBe('absolute')
  })
})

describe('the flag on a sat exam question', () => {
  it('names the paper and the question, and offers a question\'s reasons', async () => {
    await render(inApp(<QuestionReport examId="n5-listening-01" revision={2} question={{ id: 'm1_q9', number: 9 }} />))
    await userEvent.click($('.fb-link'))
    await settle()
    // A question's reasons, not a card's: no reading or example.
    expect([...document.querySelectorAll('.fb-reasons .chip')].map(c => c.textContent))
      .toEqual([fr.questionReason.answer, fr.questionReason.ambiguous, fr.questionReason.audio, fr.questionReason.other])
    await userEvent.click(document.querySelectorAll('.fb-reasons .chip')[1])
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect(sent()).toEqual({ kind: 'question', exam_id: 'n5-listening-01', revision: 2, question_id: 'm1_q9', reasons: ['ambiguous'], text: '' })
  })
})
