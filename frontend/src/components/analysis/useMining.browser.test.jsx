import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { useMining, buildCloze } from './useMining'
import { MineButton } from './MineButton'

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
    // ensureDeck remembers its target; a leftover key must not steer
    // another case's targetFor.
    localStorage.clear()
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

  // The duplicate-deck bug this pins: "create" from the picker POSTed
  // unconditionally, so typing an existing deck's name minted a clone —
  // eleven identical « Mots du boulot » rows in the real account.
  // ensureDeck now REUSES a same-type deck whose name matches
  // (trimmed, case-insensitively) and only creates when none does.
  it('ensureDeck reuses an existing same-name deck instead of minting a clone', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    globalThis.fetch = vi.fn()

    const deck = await getMining().ensureDeck('vocab', '  my vocab ')
    expect(deck.id).toBe(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    // And it is now the remembered target for that kind.
    expect(getMining().targetFor('vocab')?.id).toBe(1)
  })

  it('ensureDeck still creates when no deck of that type carries the name', async () => {
    const getMining = await mountMining(ALL_TYPE_DECKS)
    // "My Vocab" exists as type vocab — but a KANJI deck of that name
    // does not, so the create must go through.
    mockFetchOnce(200, { id: 9, name: 'My Vocab', type: 'kanji' })

    const deck = await getMining().ensureDeck('kanji', 'My Vocab')
    expect(deck.id).toBe(9)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
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

// Plan 037: MineButton used to REPLACE itself with a status span the
// moment a write succeeded, so a learner who mined one word into "N5
// words" had no way to also add it to "Animals" without a reload.
const MINE_T = {
  mineToDeck: 'Mine',
  addToAnotherDeck: 'Add to another deck',
  inDeck: 'In deck',
  alreadyInDeck: 'Already there',
  mineFailed: "Couldn't add this card.",
  chooseDeck: 'Choose a deck',
  close: 'Close',
}

// MineButtonHarness mounts a real useMining instance (so targetFor/
// localStorage behave exactly as in the app) alongside the button under
// test.
function MineButtonHarness({ session, onMine, kind = 'vocab' }) {
  const mining = useMining(session)
  if (!mining.loaded) return null
  return <MineButton mining={mining} kind={kind} onMine={onMine} t={MINE_T} />
}

describe('MineButton (via useMining)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('keeps the mine button after a successful add', async () => {
    // Seeded explicitly: this case is about what happens AFTER a
    // direct add, so the remembered target must exist. (It used to
    // pass on a key leaked by earlier test files in the same browser
    // session — the ensureDeck cases' cleanup exposed that.)
    localStorage.setItem('jp-mine-target:vocab', '1')
    mockFetchOnce(200, { decks: ALL_TYPE_DECKS })
    const onMine = vi.fn().mockResolvedValue(1)
    const screen = await render(<MineButtonHarness session={null} onMine={onMine} />)

    const button = screen.getByRole('button', { name: MINE_T.mineToDeck })
    await button.click()

    await vi.waitFor(() => {
      expect(screen.container.querySelector('.analysis-mine-btn')).not.toBeNull()
    })
    expect(screen.container.querySelector('.analysis-mine-btn').textContent).toBe(MINE_T.addToAnotherDeck)
  })

  it('opens the picker on a second add rather than reusing the target', async () => {
    // A remembered target for 'vocab', matching one of the seeded decks.
    localStorage.setItem('jp-mine-target:vocab', '1')
    mockFetchOnce(200, { decks: ALL_TYPE_DECKS })
    const onMine = vi.fn().mockResolvedValue(1)
    const screen = await render(<MineButtonHarness session={null} onMine={onMine} />)

    await vi.waitFor(() => expect(screen.container.querySelector('.analysis-mine-btn')).not.toBeNull())

    // First press: mines directly into the remembered deck, no dialog.
    await screen.container.querySelector('.analysis-mine-btn').click()
    await vi.waitFor(() => expect(onMine).toHaveBeenCalledTimes(1))
    // Wait for the outcome/addedOnce state from that press to actually
    // commit before pressing again, or the second click can land while
    // the button still thinks no add has happened yet.
    await vi.waitFor(() => {
      expect(screen.container.querySelector('.analysis-mine-btn').textContent).toBe(MINE_T.addToAnotherDeck)
    })
    expect(screen.container.querySelector('[role="dialog"]')).toBeNull()

    // Second press: a different deck is by definition a choice, so the
    // picker opens rather than mining the same target again.
    await screen.container.querySelector('.analysis-mine-btn').click()
    await vi.waitFor(() => {
      expect(screen.container.querySelector('[role="dialog"]')).not.toBeNull()
    })
    expect(onMine).toHaveBeenCalledTimes(1)
  })
})
