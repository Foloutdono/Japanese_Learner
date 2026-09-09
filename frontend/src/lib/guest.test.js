import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 仮乗車券 — the guest pass ─────────────────────────────────────
// The rules that decide whether someone is riding without an account,
// how that pass is minted, and how it becomes a real one. All three
// matter more than they look: the mint has a failure mode that is
// pure project configuration (anonymous sign-ins are a dashboard
// toggle) and must degrade to "ask for an account" rather than to a
// dead button, and the claim must never be reported as finished when
// the address is still only pending confirmation.

const auth = {
  signInAnonymously: vi.fn(),
  updateUser: vi.fn(),
}
vi.mock('./supabase', () => ({ supabase: { auth } }))

const { isGuest, startGuest, claimAccount } = await import('./guest')

beforeEach(() => {
  auth.signInAnonymously.mockReset()
  auth.updateUser.mockReset()
})

describe('who is a guest', () => {
  it('is the session Supabase marks anonymous, and only that', () => {
    expect(isGuest({ user: { is_anonymous: true } })).toBe(true)
    expect(isGuest({ user: { is_anonymous: false } })).toBe(false)
    // A real account carries no flag at all on older tokens — absent
    // must never read as "guest", or every learner would be offered
    // an account they already have.
    expect(isGuest({ user: { email: 'a@b.co' } })).toBe(false)
    expect(isGuest(null)).toBe(false)
    expect(isGuest(undefined)).toBe(false)
    expect(isGuest({})).toBe(false)
  })
})

describe('minting the pass', () => {
  it('reports the session it got', async () => {
    auth.signInAnonymously.mockResolvedValue({ data: { session: { user: {} } }, error: null })
    expect(await startGuest()).toEqual({ ok: true })
  })

  it('calls the disabled provider unavailable, by code', async () => {
    auth.signInAnonymously.mockResolvedValue({
      data: {}, error: { code: 'anonymous_provider_disabled', message: 'Signups not allowed' },
    })
    expect(await startGuest()).toEqual({ ok: false, unavailable: true })
  })

  it('recognises it by message too, for deployments that send no code', async () => {
    auth.signInAnonymously.mockResolvedValue({
      data: {}, error: { message: 'Anonymous sign-ins are disabled' },
    })
    expect(await startGuest()).toEqual({ ok: false, unavailable: true })
  })

  it('treats a success with no session as unavailable rather than boarding nobody', async () => {
    auth.signInAnonymously.mockResolvedValue({ data: { session: null }, error: null })
    expect(await startGuest()).toEqual({ ok: false, unavailable: true })
  })

  it('passes anything else back as a message, not as configuration', async () => {
    auth.signInAnonymously.mockResolvedValue({ data: {}, error: { message: 'rate limit' } })
    expect(await startGuest()).toEqual({ ok: false, message: 'rate limit' })
  })

  it('survives a transport failure, which supabase-js throws rather than returns', async () => {
    auth.signInAnonymously.mockRejectedValue(new Error('offline'))
    expect(await startGuest()).toEqual({ ok: false, message: 'offline' })
  })
})

describe('claiming the pass', () => {
  it('is done when the address is on the user and the flag is gone', async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: { email: 'a@b.co', is_anonymous: false } }, error: null,
    })
    expect(await claimAccount({ email: 'a@b.co', password: 'hunter22' }))
      .toEqual({ ok: true, needsConfirmation: false })
  })

  it('is only pending while the address waits on its link', async () => {
    // "Confirm email" on: the password is set, the address is not yet
    // the user's. Saying "account created" here would be a lie the
    // learner discovers on their next device.
    auth.updateUser.mockResolvedValue({
      data: { user: { email: null, is_anonymous: true } }, error: null,
    })
    expect(await claimAccount({ email: 'a@b.co', password: 'hunter22' }))
      .toEqual({ ok: true, needsConfirmation: true })
  })

  it('reports the address already in use rather than swallowing it', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'already registered' } })
    expect(await claimAccount({ email: 'a@b.co', password: 'hunter22' }))
      .toEqual({ ok: false, code: undefined, message: 'already registered' })
  })

  // The message is a developer's English, and on this call it can name
  // the wrong field entirely: for a guest — who has no current address
  // — Supabase quotes the address it was about to MAIL, which is the
  // empty one, and refuses `patou@gmail.com` as `""`. The code is the
  // only part of the refusal that stays true, so it is what comes out
  // of here (lib/authErrors.js turns it into a sentence).
  it('carries the code out, not just the sentence', async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: 'email_address_invalid', message: 'Email address "" is invalid' },
    })
    expect(await claimAccount({ email: 'patou@gmail.com', password: 'hunter22' }))
      .toEqual({ ok: false, code: 'email_address_invalid', message: 'Email address "" is invalid' })
  })

  it('sends exactly the credentials it was given', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: { email: 'a@b.co', is_anonymous: false } }, error: null })
    await claimAccount({ email: 'a@b.co', password: 'hunter22' })
    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'a@b.co', password: 'hunter22' })
  })
})
