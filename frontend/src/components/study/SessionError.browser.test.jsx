import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import fr from '../../locales/fr/index.js'
import { ApiError } from '../../lib/api'

// ── What a failed study session says (plan 215) ───────────────
// It used to print the backend's own sentence whenever the error
// carried a status: FastAPI's English ("Invalid token", "Deck not
// found") or lib/api.js's fallback, which names the request's path. A
// French learner read both. The refusals worth a line of their own are
// recognised by what they are, and worded from the table; the rest get
// the sheet's line. Against the real French table, the app's first.
vi.mock('../../LangContext', () => ({ useLang: () => ({ t: fr, lang: 'fr' }) }))

const { default: SessionError } = await import('./SessionError')

async function hintFor(error) {
  const screen = await render(<SessionError error={error} onRetry={() => {}} />)
  return screen.container.textContent
}

describe('SessionError', () => {
  it('never prints the server’s sentence or a request path', async () => {
    const said = await hintFor(new ApiError(400, { detail: "Invalid mode for kana: 'banana'" }, '/api/kana?mode=banana'))
    expect(said).toContain(fr.errorHint)
    expect(said).not.toContain('Invalid mode')

    const bare = await hintFor(new ApiError(500, null, '/api/today/queue'))
    expect(bare).toContain(fr.errorHint)
    expect(bare).not.toContain('/api/')
    expect(bare).not.toContain('Request failed')
  })

  it('names a session the server no longer recognises', async () => {
    const said = await hintFor(new ApiError(401, { detail: 'Invalid token' }, '/api/kana'))
    expect(said).toContain(fr.sessionExpired)
    expect(said).not.toContain('Invalid token')
  })

  it('names a deck that is no longer there', async () => {
    const said = await hintFor(new ApiError(404, { detail: 'Deck not found' }, '/api/decks/42/study?mode=f2b'))
    expect(said).toContain(fr.deckGone)
    expect(said).not.toContain('Deck not found')
    // A 404 elsewhere is not a deck's.
    expect(await hintFor(new ApiError(404, { detail: 'Not Found' }, '/api/kana'))).toContain(fr.errorHint)
  })

  it('gives a dropped connection the sheet’s own line', async () => {
    const said = await hintFor(new TypeError('Failed to fetch'))
    expect(said).toContain(fr.errorHint)
    expect(said).not.toContain('Failed to fetch')
  })
})
