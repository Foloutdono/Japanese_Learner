import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./api', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from './api'
import { postResult } from './postResult'

const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  vi.useFakeTimers()
  apiFetch.mockReset()
})
afterEach(() => vi.useRealTimers())

const post = () => {
  const done = postResult('/api/reading/result', { access_token: 't' }, { phrase: 'x' })
  return vi.runAllTimersAsync().then(() => done)
}

describe('postResult (plan 178)', () => {
  it('is saved on the first answer, with its body', async () => {
    apiFetch.mockResolvedValueOnce(reply(200, { xp_earned: 7 }))
    expect(await post()).toEqual({ saved: true, data: { xp_earned: 7 } })
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch.mock.calls[0][2]).toMatchObject({ method: 'POST', body: JSON.stringify({ phrase: 'x' }) })
  })

  it('tries once more after a server error, and again after the network', async () => {
    apiFetch.mockResolvedValueOnce(reply(500)).mockResolvedValueOnce(reply(200, { xp_earned: 1 }))
    expect(await post()).toEqual({ saved: true, data: { xp_earned: 1 } })
    apiFetch.mockReset()
    apiFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(reply(200))
    expect((await post()).saved).toBe(true)
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('says so when neither try landed, and never rejects', async () => {
    apiFetch.mockResolvedValue(reply(503))
    expect(await post()).toEqual({ saved: false, data: null })
    expect(apiFetch).toHaveBeenCalledTimes(2)
    apiFetch.mockReset()
    apiFetch.mockRejectedValue(new Error('offline'))
    expect(await post()).toEqual({ saved: false, data: null })
  })

  it('does not retry what a retry cannot fix', async () => {
    apiFetch.mockResolvedValue(reply(422))
    expect(await post()).toEqual({ saved: false, data: null })
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
