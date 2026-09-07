import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── Settings › Account, for someone who has no account ───────────
// The boarding can now be refused (lib/guest.js, components/boarding/
// AccountStep.jsx), which is only an honest offer if the refusal is
// reversible: a guest pass lives in one browser's storage and nothing
// else, so an offer made once at the end and never again would be a
// trap rather than a choice. This page is where it is made again.
//
// The sign-out row matters as much as the offer. For a learner with
// credentials it means "sign out of this device"; for a guest the very
// same button is the end of their progress, and the row has to say so.

const auth = { signOut: vi.fn(), updateUser: vi.fn() }
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })) }))
vi.mock('../../lib/platform', () => ({ isNative: () => false, openExternal: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { AccountPage } = await import('./AccountPage')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const GUEST = { user: { id: 'g1', is_anonymous: true } }
const MEMBER = { user: { id: 'm1', email: 'aiko@example.com' } }

async function page(session) {
  const screen = await render(
    <MemoryRouter><LangProvider><AccountPage session={session} /></LangProvider></MemoryRouter>,
  )
  await settle()
  return screen.container
}

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

  it('leaves a learner with credentials alone: no offer, no fields', async () => {
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
