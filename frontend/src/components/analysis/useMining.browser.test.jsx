import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { useMining, buildCloze } from './useMining'

// useMining is a hook, not a component -- same problem
// useDialog.browser.test.jsx solves by mounting a tiny harness and
// observing its effects. Here the harness just re-exposes the hook's
// return value to the test via a callback on every render, so the
// captured `mining` reference is always the latest one once the
// harness has settled (its initial GET /api/decks resolves).
function Harness({ session, onReady }) {
  const mining = useMining(session)
  onReady(mining)
  return null
}

function mockFetchOnce(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

async function mountMining(decks) {
  let mining
  mockFetchOnce(200, { decks })
  await render(<Harness session={null} onReady={m => { mining = m }} />)
  await vi.waitFor(() => expect(mining.loaded).toBe(true))
  return () => mining
}

const ALL_TYPE_DECKS = [
  { id: 1, name: 'My Vocab', type: 'vocab' },
  { id: 2, name: 'My Kanji', type: 'kanji' },
  { id: 3, name: 'My Grammar', type: 'grammar' },
  { id: 4, name: 'My Standard', type: 'standard' },
]

describe('useMining', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('decksFor only returns decks whose type matches the kind', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    const vocabDecks = getMining().decksFor('vocab')
    expect(vocabDecks).toHaveLength(1)
    expect(vocabDecks[0].type).toBe('vocab')
    expect(vocabDecks.some(d => d.type === 'kanji')).toBe(false)
  })

  it('mineApp posts a single-element cards array with the right source/level/raw_id', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    mockFetchOnce(200, { added: 1 })

    await getMining().mineApp({ deckId: 1, source: 'vocab', level: 'N5', rawId: 'vocab_N5_大学_だいがく', kind: 'vocab' })

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = globalThis.fetch.mock.calls[0]
    expect(url).toContain('/api/decks/1/cards/app')
    const body = JSON.parse(options.body)
    expect(body).toEqual({ cards: [{ source: 'vocab', level: 'N5', raw_id: 'vocab_N5_大学_だいがく' }] })
  })

  it('a response of {"added": 0} is returned as exactly 0, not coerced to success', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    mockFetchOnce(200, { added: 0 })

    const result = await getMining().mineApp({ deckId: 1, source: 'vocab', level: 'N5', rawId: 'x' })
    expect(result).toBe(0)
  })

  it('a localStorage read that throws does not break targetFor', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error('blocked') }
    try {
      expect(() => getMining().targetFor('vocab')).not.toThrow()
      expect(getMining().targetFor('vocab')).toBeNull()
    } finally {
      Storage.prototype.getItem = original
    }
  })

  it('cloze front blanks only the targeted span when the surface repeats in the Sentence', () => {
    // 「猫が猫を見た」 -- indices 0:猫 1:が 2:猫 3:を 4:見 5:た. 猫
    // appears twice; only the SECOND occurrence (offsets 2-3) is the
    // token being clozed.
    const sentence = '猫が猫を見た'
    const token = { surface: '猫', start: 2, end: 3, reading: 'ねこ' }
    const { front } = buildCloze(sentence, token)
    expect(front).toBe('猫が＿＿＿を見た')
    // The first occurrence must survive untouched.
    expect(front.startsWith('猫')).toBe(true)
  })

  it('buildCloze falls back to surface + reading when no meaning is available', () => {
    const sentence = '大学に行く'
    const token = { surface: '大学', start: 0, end: 2, reading: 'だいがく' }
    const { back } = buildCloze(sentence, token)
    expect(back).toBe('大学 (だいがく)')
  })

  it('mineCloze rejects (and never calls fetch) when back would be empty', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    globalThis.fetch = vi.fn()

    await expect(
      getMining().mineCloze({ deckId: 4, front: '＿＿＿を見た', back: '', notes: '猫を見た' })
    ).rejects.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
