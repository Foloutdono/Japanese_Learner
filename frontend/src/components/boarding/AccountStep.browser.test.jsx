import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr'

// ── 本乗車券, in the shell ────────────────────────────────────────
// On the web a Google refusal arrives on the URL and the account step
// reads it off the page load (screens/BoardingFlow.browser.test.jsx
// covers that road). In the shell the page never leaves: the refusal
// comes back through the button, and the step must say the same
// sentence and offer the same way out — signing in with the Google
// account that is already somebody's pass — rather than the shrug it
// used to print ("no credentials on the callback").

const connectProvider = vi.fn()
vi.mock('../../lib/oauth', () => ({ connectProvider: (...a) => connectProvider(...a) }))
vi.mock('../../lib/platform', () => ({ isNative: () => true, canNudge: () => false }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AccountStep } = await import('./AccountStep')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const q = (screen, sel) => screen.container.querySelector(sel)

beforeEach(() => { connectProvider.mockReset() })

describe('AccountStep in the shell', () => {
  it('names an already-linked Google account and offers to sign in with it', async () => {
    connectProvider.mockResolvedValue({
      ok: false,
      refusal: { error: 'server_error', code: 'identity_already_exists', description: 'Identity is already linked to another user' },
      code: 'identity_already_exists',
      message: 'Identity is already linked to another user',
    })
    const onCreated = vi.fn()
    const screen = await render(
      <LangProvider><AccountStep onCreated={onCreated} onSkip={() => {}} onSignIn={() => {}} /></LangProvider>,
    )
    await settle()
    expect(screen.container.querySelectorAll('.auth-provider')).toHaveLength(1)

    q(screen, '.auth-provider').click()
    await settle()

    expect(connectProvider).toHaveBeenCalledWith({ provider: 'google', link: true })
    expect(screen.container.textContent).toContain(fr.oauthAlreadyLinked)
    expect(screen.container.textContent).not.toContain('no credentials')
    // The way out: the second button, signing in as that account.
    const buttons = screen.container.querySelectorAll('.auth-provider')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].textContent).toContain(fr.oauthSignInInstead)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('says nothing when the learner backed out at Google', async () => {
    connectProvider.mockResolvedValue({ ok: false, cancelled: true })
    const screen = await render(
      <LangProvider><AccountStep onCreated={() => {}} onSkip={() => {}} onSignIn={() => {}} /></LangProvider>,
    )
    await settle()
    q(screen, '.auth-provider').click()
    await settle()
    expect(q(screen, '.auth-message--error')).toBeNull()
    expect(screen.container.querySelectorAll('.auth-provider')).toHaveLength(1)
  })
})
