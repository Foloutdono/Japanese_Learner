import { describe, it, expect } from 'vitest'

// ── 改札 — the capture, in a real browser ────────────────────────
// The refusal is taken off the URL at IMPORT time, before
// lib/supabase.js constructs the client, so this test has to arrange
// the URL BEFORE the module is first loaded — which is why the import
// is dynamic and why this file holds exactly one scenario. Only the
// fragment is touched: rewriting the path would move the test page out
// from under the runner.
const back = `${window.location.pathname}${window.location.search}`
history.replaceState(null, '',
  `${back}#error=server_error&error_code=identity_already_exists` +
  '&error_description=Identity+is+already+linked+to+another+user')

const { authRedirectError } = await import('./authRedirect')

describe('the refusal a redirect came back with', () => {
  it('is off the URL by the time anything else can read it', () => {
    // supabase-js reads the same URL as it constructs the client, and
    // an error left on it makes its initialize() skip recovering the
    // stored session — which would sign a guest out mid-boarding.
    expect(window.location.hash).toBe('')
  })

  it('is there for whichever screen asks, as often as it asks', () => {
    const err = authRedirectError()
    expect(err.code).toBe('identity_already_exists')
    expect(err.description).toBe('Identity is already linked to another user')
    // Idempotent: screens read it straight from a render, and React
    // renders as many times as it likes.
    expect(authRedirectError()).toBe(err)
  })
})
