import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 縁 — the referral's slip, door and sheets (plan 332) ──────────────
// Today's slip speaks only when GET /api/profile says the referral has a
// word for this learner; the holder's door opens one sheet with
// everything; a parrain is named in two steps, the second for good; a
// filleul whose reward waits is a button that collects it.

const apiJson = vi.fn(async () => ({}))
vi.mock('../../lib/api', async o => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
const countUse = vi.fn()
vi.mock('../../lib/screenTrail', async o => ({ ...(await o()), countUse: (...a) => countUse(...a) }))
vi.mock('../../stores/credits', async o => ({ ...(await o()), refreshCredits: vi.fn(async () => {}) }))
vi.mock('../../stores/profileSummary', async o => ({ ...(await o()), refreshSummary: vi.fn(async () => {}) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })

const { ReferralNotice, ReferralDoor, ChooseSheet } = await import('./Referral')
const { seedReferral, forgetReferral } = await import('../../stores/referral')
const { seedSummary, forgetSummary } = await import('../../stores/profileSummary')
const { referralFixture } = await import('./fixtures')
const { REFERRAL_KEY } = await import('../../lib/arrival')
const { default: en } = await import('../../locales/en/index.js')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const shell = ui => render(<LangProvider><MemoryRouter>{ui}</MemoryRouter></LangProvider>)

beforeEach(() => {
  localStorage.setItem('lang', 'en')
  localStorage.removeItem(REFERRAL_KEY)
  forgetReferral()
  forgetSummary()
  apiJson.mockReset()
  countUse.mockReset()
})

describe('Today\'s slip', () => {
  it('says nothing, and asks nothing, when the profile has no word', async () => {
    seedSummary({ referralNotice: false })
    seedReferral(referralFixture({ role: 'new' }))
    const screen = await shell(<ReferralNotice />)
    await settle()
    expect(screen.container.querySelector('.ref-slip')).toBeNull()
  })

  it('asks a new learner to choose, with the days left', async () => {
    seedSummary({ referralNotice: true })
    seedReferral(referralFixture({ role: 'new' }))
    const screen = await shell(<ReferralNotice />)
    const slip = screen.container.querySelector('.ref-slip')
    expect(slip.textContent).toContain(en.refNoticeChoose)
    expect(slip.textContent).toContain(en.refDaysShort(2))
  })

  it('walks a filleul to their reward, then says it was paid', async () => {
    seedSummary({ referralNotice: true })
    seedReferral(referralFixture({ role: 'filleul' }))
    const screen = await shell(<ReferralNotice />)
    expect(screen.container.querySelector('.ref-slip').textContent).toContain(en.refStudyDays(2, 3))
    seedReferral(referralFixture({ role: 'filleul', step: 2 }))
    await settle()
    const slip = screen.container.querySelector('.ref-slip')
    expect(slip.classList.contains('ref-slip--paid')).toBe(true)
    expect(slip.textContent).toContain('+300')
  })

  it('tells a parrain someone named them', async () => {
    seedSummary({ referralNotice: true })
    seedReferral(referralFixture({ role: 'parrain' }))
    const screen = await shell(<ReferralNotice />)
    expect(screen.container.querySelector('.ref-slip').textContent).toContain(en.refNoticeRequests(1))
  })
})

describe('the holder\'s door and its sheet', () => {
  it('draws nothing before the server has answered', async () => {
    const screen = await shell(<ReferralDoor />)
    await settle()
    expect(screen.container.querySelector('.record--door')).toBeNull()
  })

  it('counts the places and opens one sheet with everything', async () => {
    seedReferral(referralFixture({ role: 'parrain' }))
    const screen = await shell(<ReferralDoor />)
    const door = screen.container.querySelector('.record--door')
    expect(door.textContent).toContain('2/3')
    expect(door.textContent).toContain(en.refNoticeRequests(1))
    await userEvent.click(door)
    await settle()
    const sheet = document.querySelector('.ref-sheet')
    expect(sheet.textContent).toContain('Yuki')
    expect(sheet.querySelectorAll('.msn-cpn')).toHaveLength(3)          // Kenji, Sora, the free place
    expect(sheet.querySelector('.ref-invite').textContent).toContain('+300')
    expect(countUse).toHaveBeenCalledWith('referral', 'open')
  })

  it('collects what a filleul earned', async () => {
    seedReferral(referralFixture({ role: 'parrain' }))
    apiJson.mockResolvedValueOnce({ paid: { credits: 25, xp: 0 }, referral: referralFixture({ role: 'parrain', step: 2 }) })
    const screen = await shell(<ReferralDoor />)
    await userEvent.click(screen.container.querySelector('.record--door'))
    await settle()
    await userEvent.click(document.querySelector('[data-action="referral-collect"]'))
    await settle()
    expect(apiJson.mock.calls[0][0]).toBe('/api/referral/claim')
    expect(JSON.parse(apiJson.mock.calls[0][2].body)).toEqual({ username: 'Kenji' })
    expect(document.querySelector('[data-action="referral-collect"]')).toBeNull()
  })

  it('shows the pass its rewards as XP', async () => {
    seedReferral(referralFixture({ role: 'parrain', plan: 'max' }))
    const screen = await shell(<ReferralDoor />)
    expect(screen.container.querySelector('.record--door').textContent).toContain(en.refNoticeRequests(1))
    await userEvent.click(screen.container.querySelector('.record--door'))
    await settle()
    expect(document.querySelector('[data-action="referral-collect"]').textContent).toContain('+25 XP')
  })
})

describe('naming a parrain', () => {
  const find = vi.fn(async name => ({ username: name, relation: 'none' }))

  it('looks up the link\'s name, and names it only once confirmed', async () => {
    localStorage.setItem(REFERRAL_KEY, 'Mei')
    seedReferral(referralFixture({ role: 'new' }))
    apiJson.mockResolvedValueOnce(referralFixture({ role: 'filleul' }))
    await shell(<ChooseSheet open onClose={() => {}} find={find} />)
    await settle()
    expect(find).toHaveBeenCalledWith('Mei', null)
    expect(document.querySelector('.ref-sheet').textContent).toContain(en.refSuggested)
    await userEvent.click(document.querySelector('.ref-sheet .btn-primary'))
    await settle()
    expect(apiJson).not.toHaveBeenCalled()                               // the first tap asks to be sure
    expect(document.querySelector('.ref-sure').textContent).toContain(en.refSure('Mei'))
    await userEvent.click(document.querySelector('[data-action="referral-confirm"]'))
    await settle()
    expect(apiJson.mock.calls[0][0]).toBe('/api/referral/choose')
    expect(JSON.parse(apiJson.mock.calls[0][2].body)).toEqual({ username: 'Mei' })
  })

  it('words a refusal in the learner\'s language, never the server\'s', async () => {
    seedReferral(referralFixture({ role: 'new' }))
    const nobody = vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'pvp_not_found' }) })
    await shell(<ChooseSheet open onClose={() => {}} find={nobody} />)
    await userEvent.type(document.querySelector('#ref-find'), 'Ghost')
    await userEvent.click(document.querySelector('.pvp-find__go'))
    await settle()
    expect(document.querySelector('.pvp-error').textContent).toBe(en.refErrors.referral_not_found)
    expect(document.querySelector('.ref-sheet .btn-primary').disabled).toBe(true)
  })
})
