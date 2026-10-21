import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import fr from '../../locales/fr/index.js'
import { ApiError } from '../../lib/api'
import '../../index.css'

// ── The early-access sheet on a phone (plan 268) ─────────────────────
// Once, from 400 XP: five stars and a few words. Nothing is sent before a
// star is chosen; what is sent is the rating and the words, no class of the
// device; a rating sent ends on the 受付 stamp and tells the server nothing
// more when the sheet is shut; shut without one, the sheet tells the server
// it was asked, so it is not asked again.
vi.mock('../../LangContext', () => ({ useLang: () => ({ t: fr, lang: 'fr' }) }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn() }))
const refreshSummary = vi.fn(async () => {})
vi.mock('../../stores/profileSummary', async (o) => ({ ...(await o()), refreshSummary: (...a) => refreshSummary(...a) }))

const { RatingSheet } = await import('./RatingSheet')

const LEARNER = { access_token: 'tok', user: { id: 'u1', email: 'aiko@example.com' } }
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const stars = () => [...document.querySelectorAll('.fb-rate__star')]
const posted = path => apiJson.mock.calls.filter(([u]) => u === path)
const body = call => JSON.parse(call[2].body)

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockResolvedValue({ ok: true, at: '2026-10-21T09:30:00+00:00' })
  refreshSummary.mockClear()
})

describe('the early-access sheet', () => {
  it('asks in the table’s words and sends nothing before a star is chosen', async () => {
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    expect($('.sheet__cap').textContent).toBe(fr.rateCap)
    expect($('h2').textContent).toBe(fr.rateQ)
    expect($('.fb-rate__lead').textContent).toBe(fr.rateLead)
    expect(stars()).toHaveLength(5)
    expect(stars().map(s => s.getAttribute('aria-label'))).toEqual([1, 2, 3, 4, 5].map(fr.rateStar))
    expect($('.fb-form__send').disabled).toBe(true)
    await userEvent.type($('.fb-form__text'), 'Plus de dictées.')
    expect($('.fb-form__send').disabled).toBe(true)
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('lights the stars up to the one chosen, and sends the rating with the words', async () => {
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    await userEvent.click(stars()[3])
    expect(stars().map(s => s.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'false'])
    expect(stars().map(s => s.classList.contains('fb-rate__star--on'))).toEqual([true, true, true, true, false])
    await userEvent.type($('.fb-form__text'), '  Plus de dictées.  ')
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect(posted('/api/feedback')).toHaveLength(1)
    // The rating and the words: no device, no screen, nothing joined.
    expect(body(posted('/api/feedback')[0])).toEqual({ kind: 'rating', rating: 4, text: '  Plus de dictées.  ' })
    expect($('.fb-stamp__jp').textContent).toBe('受付')
    expect($('.fb-stamp__date').textContent).toBe('21.10.26')
    expect($('.fb-sent__say').textContent).toBe(fr.fbSent)
  })

  it('takes a rating with no words, and changes its mind before sending', async () => {
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    await userEvent.click(stars()[4])
    await userEvent.click(stars()[1])
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect(body(posted('/api/feedback')[0])).toEqual({ kind: 'rating', rating: 2, text: '' })
  })

  it('shut after a rating tells the server nothing more, and refreshes the profile', async () => {
    const onClose = vi.fn()
    await render(<RatingSheet session={LEARNER} onClose={onClose} />)
    await userEvent.click(stars()[2])
    await userEvent.click($('.fb-form__send'))
    await settle()
    // The thank-you stays up until the learner shuts it: the profile is
    // not refreshed under it.
    expect(refreshSummary).not.toHaveBeenCalled()
    await userEvent.click($('.fb-sent__close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(posted('/api/feedback/offer')).toHaveLength(0)
    expect(refreshSummary).toHaveBeenCalledTimes(1)
  })

  it('"Plus tard" says the sheet was asked, once, and sends no rating', async () => {
    const onClose = vi.fn()
    await render(<RatingSheet session={LEARNER} onClose={onClose} />)
    await userEvent.type($('.fb-form__text'), 'Peu importe.')
    await userEvent.click($('[data-action="rating-later"]'))
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(posted('/api/feedback')).toHaveLength(0)
    expect(posted('/api/feedback/offer')).toHaveLength(1)
    expect(posted('/api/feedback/offer')[0][2].method).toBe('POST')
  })

  it('shut with Escape counts as the same answer', async () => {
    const onClose = vi.fn()
    await render(<RatingSheet session={LEARNER} onClose={onClose} />)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(posted('/api/feedback/offer')).toHaveLength(1)
  })

  it('says the day’s limit in its own words and keeps the rating', async () => {
    apiJson.mockRejectedValue(new ApiError(429, { detail: { code: 'feedback_limit', message: 'Five messages a day' } }, '/api/feedback'))
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    await userEvent.click(stars()[0])
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect($('.fb-form__error').textContent).toBe(fr.fbErrLimit)
    expect(stars()[0].getAttribute('aria-pressed')).toBe('true')
    expect($('.fb-form__send').disabled).toBe(false)
  })

  it('says any other failure without the server’s sentence', async () => {
    apiJson.mockRejectedValue(new TypeError('Failed to fetch'))
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    await userEvent.click(stars()[0])
    await userEvent.click($('.fb-form__send'))
    await settle()
    expect($('.fb-form__error').textContent).toBe(fr.fbErrSend)
  })

  it('sends once, however fast the second press', async () => {
    let answer
    apiJson.mockImplementation(() => new Promise(r => { answer = r }))
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    await userEvent.click(stars()[4])
    const send = $('.fb-form__send')
    send.click()
    send.click()
    await settle()
    expect(posted('/api/feedback')).toHaveLength(1)
    answer({ ok: true })
  })

  it('fits a phone: the sheet inside the screen, each star a thumb’s target', async () => {
    await render(<RatingSheet session={LEARNER} onClose={() => {}} />)
    const panel = $('[role="dialog"]').getBoundingClientRect()
    expect(panel.left).toBeGreaterThanOrEqual(0)
    expect(panel.right).toBeLessThanOrEqual(window.innerWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const star of stars()) {
      const box = star.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})
