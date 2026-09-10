import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Account, and the two doors off it ─────────────────
// The boarding can now be refused (lib/guest.js, components/boarding/
// AccountStep.jsx), which is only an honest offer if the refusal is
// reversible: a guest pass lives in one browser's storage and nothing
// else, so an offer made once at the end and never again would be a
// trap rather than a choice. This page is where it is made again.
//
// The sign-out row matters as much as the offer. For a learner with
// credentials it means "sign out of this device"; for a guest the very
// same button is the end of their progress, and the row has to say so.
//
// The second door is Google on a pass that already has a key, and its
// absence was a loop nobody could see the shape of. "Continue with
// Google" on the sign-in screen is signInWithOAuth: it opens the pass
// carrying that Google identity, and when no pass carries it, Supabase
// issues a NEW one — which has no journey on it, so App.jsx hands the
// learner the boarding from question one. Pressing Google again does
// exactly the same thing. The only way to make that button find an
// existing account is to put the identity ON it from inside, and this
// page is where that is offered. It used to be offered to guests alone
// (`{guest && <ClaimSlip/>}`), i.e. to everyone except the learner
// about to lose their way back to their own account.

const auth = { signOut: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(async () => ({})) }
const connectProvider = vi.fn(async () => ({ ok: true }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })) }))
vi.mock('../../lib/platform', () => ({ isNative: () => false, openExternal: vi.fn() }))
// Only the round trip is stubbed: hasProvider is the module's own
// reading of a session shape and is exactly what this page branches
// on, so it stays real.
vi.mock('../../lib/oauth', async (importOriginal) => ({
  ...(await importOriginal()),
  connectProvider: (...a) => connectProvider(...a),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { AccountPage } = await import('./AccountPage')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const GUEST = { user: { id: 'g1', is_anonymous: true } }
const MEMBER = { user: { id: 'm1', email: 'aiko@example.com' } }
// `providers` is the token's own claim, which a session carries from
// the moment it exists; `identities` is the fuller list a link or a
// refresh brings back. Either is enough to have been asked already.
const WITH_GOOGLE = {
  user: { id: 'm2', email: 'aiko@example.com', app_metadata: { providers: ['email', 'google'] } },
}

async function page(session) {
  const screen = await render(
    <MemoryRouter><LangProvider><AccountPage session={session} /></LangProvider></MemoryRouter>,
  )
  await settle()
  return screen.container
}

beforeEach(() => { connectProvider.mockClear(); auth.refreshSession.mockClear() })
afterEach(async () => { await cleanup() })

describe('Settings › Account', () => {
  it('offers a guest the account the boarding let them refuse', async () => {
    const root = await page(GUEST)
    expect(root.querySelector('input[type="email"]')).not.toBeNull()
    expect(root.querySelector('input[type="password"]')).not.toBeNull()
    // Nobody to issue the card to yet, so that row stays away.
    expect(root.textContent).not.toContain('@')
  })

  it('says what signing out costs a guest, which is everything', async () => {
    const guest = await page(GUEST)
    const guestRow = guest.textContent
    await cleanup()
    const member = await page(MEMBER)
    // Not the same sentence — the member's is about this device, the
    // guest's is about the progress itself.
    expect(guestRow).not.toBe(member.textContent)
    expect(member.textContent).toContain('aiko@example.com')
  })

  // The CLAIM is what a learner with credentials is spared — they
  // already have both halves of it. The Google row below is a
  // different offer and is theirs.
  it('asks a learner with credentials for no address and no password', async () => {
    const root = await page(MEMBER)
    expect(root.querySelector('input[type="email"]')).toBeNull()
    expect(root.querySelector('input[type="password"]')).toBeNull()
  })

  it('will not submit an empty or half-filled claim', async () => {
    const root = await page(GUEST)
    const submit = [...root.querySelectorAll('button')]
      .find(b => b.className.includes('slip__act'))
    expect(submit).toBeTruthy()
    expect(submit.disabled).toBe(true)
    submit.click()
    await settle()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('connecting Google to an account that already has a key', () => {
  it('is offered to a pass without it, and says what it is for', async () => {
    const root = await page(MEMBER)
    expect(root.textContent).toContain(fr.linkGoogleDesc)
    expect(root.querySelectorAll('.auth-provider')).toHaveLength(1)
  })

  it('LINKS the identity rather than signing in as somebody new', async () => {
    const root = await page(MEMBER)
    root.querySelector('.auth-provider').click()
    await settle()
    expect(connectProvider).toHaveBeenCalledTimes(1)
    // The whole point of the row: this learner has a journey on this
    // account, and signInWithOAuth here would leave it behind in
    // silence — the same trap the row exists to close.
    expect(connectProvider.mock.calls[0][0]).toEqual({ provider: 'google', link: true })
  })

  // In the shell the link resolves in process and the session in
  // memory still says "no Google"; on the web the page has already
  // left. Either way the offer must not stay up once it is taken.
  it('refreshes the session once the shell finishes the round trip', async () => {
    const root = await page(MEMBER)
    root.querySelector('.auth-provider').click()
    await settle()
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('is not offered to a pass that already carries it', async () => {
    const root = await page(WITH_GOOGLE)
    expect(root.textContent).not.toContain(fr.linkGoogleDesc)
    expect(root.querySelectorAll('.auth-provider')).toHaveLength(0)
  })

  // A guest is offered the whole account instead (ClaimSlip, Google
  // included). Two Google buttons on one page would be the same offer
  // twice, in two different words.
  it('leaves the guest slip to make the offer, once', async () => {
    const root = await page(GUEST)
    expect(root.textContent).toContain(fr.guestClaimDesc)
    expect(root.textContent).not.toContain(fr.linkGoogleDesc)
    expect(root.querySelectorAll('.auth-provider')).toHaveLength(1)
  })
})
