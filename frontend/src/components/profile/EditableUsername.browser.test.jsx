import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import fr from '../../locales/fr/index.js'

// ── The name on the pass, refused (plan 210) ──────────────────
// A dropped connection rejects the PATCH with the browser's own English
// ("Failed to fetch", Safari's "Load failed"), and the field printed it
// as it stood. Only sentences from the table may reach it.
//
// The answer is a plain function rather than a vi.fn: what is under test
// is the screen's catch, and nothing here needs the call log.
let answer = async () => ({ ok: true, json: async () => ({}) })
vi.mock('../../lib/api', () => ({ apiFetch: (...a) => answer(...a) }))

const { EditableUsername } = await import('./EditableUsername')

async function rename(to) {
  const screen = await render(<EditableUsername username="tabibito" session={{}} onChange={() => {}} t={fr} />)
  screen.container.querySelector('.profile-card__name--editable').click()
  await vi.waitFor(() => expect(screen.container.querySelector('input')).not.toBeNull())
  const input = screen.container.querySelector('input')
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, to)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await new Promise(r => setTimeout(r, 0))
  screen.container.querySelector('.profile-card__name-save').click()
  await vi.waitFor(() => expect(screen.container.querySelector('.profile-card__name-error')).not.toBeNull())
  return screen.container.querySelector('.profile-card__name-error').textContent
}

describe('EditableUsername', () => {
  it('says the generic line, never the browser’s, when the connection drops', async () => {
    answer = () => new Promise((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch')), 0))
    const said = await rename('voyageur')
    expect(said).toBe(fr.genericError)
  })

  it('names a name already taken', async () => {
    answer = async () => ({ ok: false, status: 409, json: async () => ({}) })
    expect(await rename('voyageur')).toBe(fr.usernameTaken)
  })

  it('says the generic line for any other refusal', async () => {
    answer = async () => ({ ok: false, status: 500, json: async () => ({}) })
    expect(await rename('voyageur')).toBe(fr.genericError)
  })
})
