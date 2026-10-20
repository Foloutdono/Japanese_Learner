// ── 故障 — what an uncaught error records ──
// The screen, the kind, and since the boarding lost a learner to an
// error nobody could place (2026-10-16), the step of the flow on screen.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const track = vi.fn()
vi.mock('./track', () => ({ track }))

const { recordClientError, noteStep, _reset } = await import('./clientErrors')

beforeEach(() => {
  track.mockClear()
  _reset()
})

describe('client_error', () => {
  it('names the screen and the kind, and no step outside a flow', () => {
    recordClientError('error', '/today')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/today', where: 'error' })
  })

  it('names the step a flow noted', () => {
    noteStep('card')
    recordClientError('error', '/')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/', step: 'card', where: 'error' })
  })

  it('forgets the step once the flow clears it', () => {
    noteStep('read')
    noteStep(null)
    recordClientError('rejection', '/ride/reading')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/ride/reading', where: 'rejection' })
  })

  it('records once a minute per step, not once per screen', () => {
    noteStep('level')
    recordClientError('error', '/')
    recordClientError('error', '/')
    noteStep('test')
    recordClientError('error', '/')
    expect(track).toHaveBeenCalledTimes(2)
    expect(track.mock.calls.map(([, p]) => p.step)).toEqual(['level', 'test'])
  })
})
