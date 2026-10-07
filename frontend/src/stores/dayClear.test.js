import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 終着 — the day cleared, asked once a run (plan 191) ───────────────
const api = vi.hoisted(() => ({ apiJson: vi.fn() }))
const xp = vi.hoisted(() => ({ applyXpGain: vi.fn() }))
const today = vi.hoisted(() => ({ refreshToday: vi.fn() }))
const reviews = vi.hoisted(() => ({ reviewsSettled: vi.fn(() => Promise.resolve()) }))
vi.mock('../lib/api', () => ({ apiJson: api.apiJson }))
vi.mock('./profileSummary', () => ({ applyXpGain: xp.applyXpGain }))
vi.mock('./today', () => ({ refreshToday: today.refreshToday }))
vi.mock('../lib/reviews', () => ({ reviewsSettled: reviews.reviewsSettled }))

const { requestClear, retryClear, peekDayClear, resetDayClear, runKey, markRestSeen, restNoticeSeen } = await import('./dayClear')
const { RUN_DAY, CLEAR_DAY, CLEAR_MONTH30, RUN_MONTH30, CLEAR_PARTIAL, RUN_PARTIAL } = await import('../components/dayclear/fixtures')

const settle = () => new Promise(r => setTimeout(r, 0))
const SESSION = { access_token: 't' }

beforeEach(() => {
  resetDayClear()
  vi.clearAllMocks()
  xp.applyXpGain.mockReturnValue({ leveledUp: false, newLevel: 14 })
})

describe('asking whether the day is cleared', () => {
  it('posts once per run, however often it is asked (StrictMode, a layout swap)', async () => {
    api.apiJson.mockResolvedValue(CLEAR_DAY)
    requestClear(RUN_DAY, SESSION)
    requestClear(RUN_DAY, SESSION)
    expect(peekDayClear(RUN_DAY).status).toBe('loading')
    await settle()
    requestClear({ ...RUN_DAY }, SESSION)
    await settle()
    expect(api.apiJson).toHaveBeenCalledTimes(1)
    expect(api.apiJson).toHaveBeenCalledWith('/api/today/clear', SESSION, expect.objectContaining({ method: 'POST' }))
    expect(peekDayClear(RUN_DAY)).toMatchObject({ status: 'cleared', result: CLEAR_DAY, levelUp: null })
  })

  it('waits for the reviews still in flight before it asks', async () => {
    let release
    reviews.reviewsSettled.mockReturnValueOnce(new Promise(r => { release = r }))
    api.apiJson.mockResolvedValue(CLEAR_DAY)
    requestClear(RUN_DAY, SESSION)
    await settle()
    expect(api.apiJson).not.toHaveBeenCalled()
    release()
    await settle()
    await settle()
    expect(api.apiJson).toHaveBeenCalledTimes(1)
  })

  it('pays the bonus and the jackpot into the pass once, and says when a level is crossed', async () => {
    api.apiJson.mockResolvedValue(CLEAR_MONTH30)
    xp.applyXpGain.mockReturnValue({ leveledUp: true, newLevel: 15 })
    requestClear(RUN_MONTH30, SESSION)
    await settle()
    await settle()
    expect(xp.applyXpGain).toHaveBeenCalledTimes(1)
    expect(xp.applyXpGain).toHaveBeenCalledWith({ amount: 1175 })
    expect(peekDayClear(RUN_MONTH30)).toMatchObject({ status: 'cleared', levelUp: { newLevel: 15 } })
    expect(today.refreshToday).toHaveBeenCalled()
  })

  it('takes the server\'s word on the level when no pass is cached', async () => {
    api.apiJson.mockResolvedValue(CLEAR_MONTH30)
    xp.applyXpGain.mockReturnValue({ leveledUp: false, newLevel: undefined })
    requestClear(RUN_MONTH30, SESSION)
    await settle()
    await settle()
    expect(peekDayClear(RUN_MONTH30).levelUp).toEqual({ newLevel: 15 })
  })

  it('pays nothing on a day already cleared', async () => {
    api.apiJson.mockResolvedValue({ ...CLEAR_DAY, already: true, xp: { xp_earned: 0, leveled_up: false } })
    requestClear(RUN_DAY, SESSION)
    await settle()
    await settle()
    expect(xp.applyXpGain).not.toHaveBeenCalled()
    expect(peekDayClear(RUN_DAY).status).toBe('cleared')
  })

  it('answers partial when cards remain, and pays nothing', async () => {
    api.apiJson.mockResolvedValue(CLEAR_PARTIAL)
    requestClear(RUN_PARTIAL, SESSION)
    await settle()
    await settle()
    expect(peekDayClear(RUN_PARTIAL)).toMatchObject({ status: 'partial', result: CLEAR_PARTIAL, levelUp: null })
    expect(xp.applyXpGain).not.toHaveBeenCalled()
  })

  it('asks again only after a failure', async () => {
    api.apiJson.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(CLEAR_DAY)
    requestClear(RUN_DAY, SESSION)
    await settle()
    await settle()
    expect(peekDayClear(RUN_DAY).status).toBe('error')
    retryClear(RUN_DAY, SESSION)
    await settle()
    await settle()
    expect(peekDayClear(RUN_DAY).status).toBe('cleared')
    retryClear(RUN_DAY, SESSION)
    await settle()
    expect(api.apiJson).toHaveBeenCalledTimes(2)
  })

  it('knows no run without its identity', () => {
    expect(runKey(null)).toBeNull()
    expect(runKey(RUN_DAY)).toBe(String(RUN_DAY.at))
    expect(peekDayClear(null).status).toBe('idle')
  })
})

describe('the rest-day notice, seen', () => {
  it('tells the server once per set of rest days', async () => {
    api.apiJson.mockResolvedValue({ ok: true })
    expect(restNoticeSeen('2026-10-06')).toBe(false)
    markRestSeen(SESSION, '2026-10-06')
    markRestSeen(SESSION, '2026-10-06')
    await settle()
    expect(api.apiJson).toHaveBeenCalledTimes(1)
    expect(api.apiJson).toHaveBeenCalledWith('/api/today/rest/seen', SESSION, expect.objectContaining({ method: 'POST' }))
    expect(restNoticeSeen('2026-10-06')).toBe(true)
  })
})
