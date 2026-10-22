// ── 故障 — what an uncaught error records ──
// The screen, the kind, and since the boarding lost a learner to an
// error nobody could place (2026-10-16), the step of the flow on screen.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const track = vi.fn()
vi.mock('./track', () => ({ track }))

const { recordClientError, noteStep, errorKind, _reset } = await import('./clientErrors')

beforeEach(() => {
  track.mockClear()
  _reset()
})

describe('client_error', () => {
  it('names the screen and the where, and no step outside a flow', () => {
    recordClientError('error', '/today')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/today', where: 'error', kind: 'other' })
  })

  it('names the step a flow noted', () => {
    noteStep('card')
    recordClientError('error', '/')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/', step: 'card', where: 'error', kind: 'other' })
  })

  it('forgets the step once the flow clears it', () => {
    noteStep('read')
    noteStep(null)
    recordClientError('rejection', '/ride/reading')
    expect(track).toHaveBeenCalledWith('client_error', { route: '/ride/reading', where: 'rejection', kind: 'other' })
  })

  it('names the class of the error, and never its message', () => {
    recordClientError('error', '/today', errorKind(new TypeError('the words on the screen')))
    expect(track).toHaveBeenCalledWith('client_error', { route: '/today', where: 'error', kind: 'TypeError' })
  })

  it('keeps the class of an error to the classes the trail lists, else other', () => {
    expect(errorKind(new RangeError('x'))).toBe('RangeError')
    expect(errorKind(new Error('x'))).toBe('Error')
    expect(errorKind('a thrown string')).toBe('other')
    expect(errorKind(null)).toBe('other')
    expect(errorKind(undefined)).toBe('other')
    expect(errorKind({ name: 'MyOwnError' })).toBe('other')
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
