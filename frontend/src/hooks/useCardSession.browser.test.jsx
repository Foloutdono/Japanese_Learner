import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── A saved queue asks before it replays ─────────────────────────
// Every run screen keeps its queue in localStorage and resumed it
// exactly as saved, so a card answered since — in Today, in another
// section holding the same card, on another device, or while a stamp
// held the queue — came straight back out of it, days before it was
// due. `checkCached` is asked first now; these pin what the hook does
// with its answer, and with no answer.

vi.mock('../lib/track', () => ({ track: vi.fn() }))

const { useCardSession, sessionKey } = await import('./useCardSession')

const settle = ms => new Promise(r => setTimeout(r, ms))

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const card = (id, mode = 'm') => ({ card_id: id, mode })

// A probe rather than a screen, as in useReviewGates.browser.test.jsx.
// `seen` is every card that was ever on screen, so a test can say a
// stale card was never shown, not merely that it is gone by the end.
let api
let seen
function Probe(props) {
  api = useCardSession(props)
  if (api.current && seen[seen.length - 1] !== api.current.card_id) seen.push(api.current.card_id)
  return <div data-loading={String(api.loading)} />
}

let n = 0
function freshKey() {
  n += 1
  return sessionKey('test', `k${n}`, 'm')
}

function save(key, cards) {
  window.localStorage.setItem(key, JSON.stringify(cards))
}

function saved(key) {
  return JSON.parse(window.localStorage.getItem(key) ?? '[]').map(c => c.card_id)
}

// Never resolves: these tests are about the saved queue, not the refill.
const pendingBatch = () => new Promise(() => {})

beforeEach(() => {
  window.localStorage.clear()
  seen = []
})

describe('useCardSession resuming a saved queue', () => {
  it('plays the saved queue at once when there is nothing to ask', async () => {
    const key = freshKey()
    save(key, [card('a'), card('b')])
    await render(<Probe storageKey={key} fetchBatch={vi.fn(pendingBatch)} mode="m" />)
    expect(api.current?.card_id).toBe('a')
    expect(api.loading).toBe(false)
  })

  it('holds the queue until the check answers, then drops what it named', async () => {
    const key = freshKey()
    save(key, [card('a'), card('b'), card('c')])
    const check = deferred()
    const checkCached = vi.fn(() => check.promise)
    const fetchBatch = vi.fn(pendingBatch)
    await render(<Probe storageKey={key} fetchBatch={fetchBatch} mode="m" checkCached={checkCached} />)

    expect(api.loading, 'held back while the check is out').toBe(true)
    expect(api.current).toBeNull()
    expect(checkCached).toHaveBeenCalledTimes(1)
    expect(checkCached.mock.calls[0][0]).toEqual([
      { card_id: 'a', mode: 'm' }, { card_id: 'b', mode: 'm' }, { card_id: 'c', mode: 'm' },
    ])
    expect(fetchBatch, 'no refill while the saved queue is held back').not.toHaveBeenCalled()

    check.resolve([{ card_id: 'a', mode: 'm' }])
    await vi.waitFor(() => expect(api.current?.card_id).toBe('b'))
    expect(seen, 'the answered card was never on screen').toEqual(['b'])
    expect(api.queueLength).toBe(2)
    expect(saved(key), 'and it is gone from the saved copy too').toEqual(['b', 'c'])
  })

  it('reads the mode as half of a card', async () => {
    // Today's queue can hold 土 as a flashcard and 土 as a writing
    // drill; answering one says nothing about the other.
    const key = freshKey()
    save(key, [card('tsuchi', 'kanji.flashcard.f2b'), card('tsuchi', 'kanji.write_kanji')])
    const checkCached = vi.fn(async () => [{ card_id: 'tsuchi', mode: 'kanji.flashcard.f2b' }])
    await render(<Probe storageKey={key} fetchBatch={vi.fn(pendingBatch)} checkCached={checkCached}
      cardKey={c => `${c.card_id}|${c.mode}`} />)

    await vi.waitFor(() => expect(api.current).not.toBeNull())
    expect(api.current.mode).toBe('kanji.write_kanji')
    expect(api.queueLength).toBe(1)
  })

  it('plays the queue as saved when the check fails', async () => {
    const key = freshKey()
    save(key, [card('a'), card('b')])
    const checkCached = vi.fn(async () => { throw new Error('offline') })
    await render(<Probe storageKey={key} fetchBatch={vi.fn(pendingBatch)} mode="m" checkCached={checkCached} />)

    await vi.waitFor(() => expect(api.current?.card_id).toBe('a'))
    expect(api.queueLength).toBe(2)
  })

  it('refills rather than finishing when every saved card was answered', async () => {
    const key = freshKey()
    save(key, [card('a'), card('b')])
    const checkCached = vi.fn(async () => [card('a'), card('b')])
    const fetchBatch = vi.fn(async () => [card('z')])
    await render(<Probe storageKey={key} fetchBatch={fetchBatch} mode="m" checkCached={checkCached} />)

    await vi.waitFor(() => expect(api.current?.card_id).toBe('z'))
    expect(api.done).toBe(false)
    expect(seen).toEqual(['z'])
  })

  it('stops waiting on a slow check, and trims behind the card on screen when it lands', async () => {
    // A cold backend can take thirty seconds; the saved queue exists so
    // a returning learner is not staring at a spinner for them.
    const key = freshKey()
    save(key, [card('a'), card('b'), card('c')])
    const check = deferred()
    await render(<Probe storageKey={key} fetchBatch={vi.fn(pendingBatch)} mode="m"
      checkCached={() => check.promise} />)

    await settle(2800)
    expect(api.current?.card_id, 'shown as saved once the wait is up').toBe('a')
    expect(api.queueLength).toBe(3)

    // 'a' is on screen and may be mid-answer: advance() pops the head,
    // so dropping it here would pop 'b' in its place.
    check.resolve([card('a'), card('b')])
    await vi.waitFor(() => expect(api.queueLength).toBe(2))
    expect(api.current?.card_id).toBe('a')
    expect(saved(key)).toEqual(['a', 'c'])
  }, 10000)
})
