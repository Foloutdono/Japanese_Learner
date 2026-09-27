import { describe, it, expect, vi, beforeEach } from 'vitest'

// 仏訳 (plan 162): the words list asks for a line in the learner's
// language for the pool words the analysis has none for -- once a word,
// once at a time, keeping the English where no line came.
const apiJson = vi.fn()
vi.mock('../../lib/api', () => ({ apiJson: (...a) => apiJson(...a) }))

const { poolIdsOf, askPoolGlosses, knownPoolGlosses, clearPoolGlosses } = await import('./poolGlosses')
const { wordGloss } = await import('./tokens')

const pool = (id, extra = {}) => ({
  surface: 'x', vocab_match: { pool: true, level: null, raw_id: id, entry: { kanji: 'x', kana: 'x', meaning: 'english', ...extra.entry }, ...extra.match },
  ...extra.tok,
})
const deck = { surface: '駅', vocab_match: { level: 'N5', raw_id: 'vocab_N5_駅_えき', entry: { kanji: '駅', kana: 'えき', meaning: 'station', meaning_fr: 'gare' } } }

beforeEach(() => {
  clearPoolGlosses()
  apiJson.mockReset()
})

describe('the pool words a list asks for', () => {
  it('asks for the pool words with no line in the learner\'s language, and none in English', () => {
    const analysis = {
      tokens: [
        deck,
        pool('vocab_jmdict_1'),
        pool('vocab_jmdict_2', { entry: { meaning_fr: 'portillon' } }),
        pool('vocab_jmdict_3', { match: { affix: true } }),
        pool('vocab_jmdict_4', { tok: { meaning: 'en contexte' } }),
        { surface: 'で' },
      ],
    }
    expect(poolIdsOf(analysis, 'fr')).toEqual(['vocab_jmdict_1'])
    // JMdict's French is French's alone.
    expect(poolIdsOf(analysis, 'es')).toEqual(['vocab_jmdict_1', 'vocab_jmdict_2'])
    expect(poolIdsOf(analysis, 'en')).toEqual([])
    expect(poolIdsOf(null, 'fr')).toEqual([])
  })

  it('asks for a word once, and keeps what came back', async () => {
    apiJson.mockResolvedValue({ glosses: { vocab_jmdict_1: 'portillon' }, limited: false })
    await Promise.all([
      askPoolGlosses({}, ['vocab_jmdict_1', 'vocab_jmdict_2'], 'fr'),
      askPoolGlosses({}, ['vocab_jmdict_1'], 'fr'),
    ])
    expect(apiJson).toHaveBeenCalledTimes(1)
    const [url, , init] = apiJson.mock.calls[0]
    expect(url).toBe('/api/phrase/glosses')
    expect(JSON.parse(init.body)).toEqual({ ids: ['vocab_jmdict_1', 'vocab_jmdict_2'], lang: 'fr' })
    expect(knownPoolGlosses(['vocab_jmdict_1', 'vocab_jmdict_2'], 'fr')).toEqual({ vocab_jmdict_1: 'portillon' })
    // Answered: not asked again. The word with no line waits for the next visit.
    await askPoolGlosses({}, ['vocab_jmdict_1'], 'fr')
    expect(apiJson).toHaveBeenCalledTimes(1)
    // Another language is another line.
    expect(knownPoolGlosses(['vocab_jmdict_1'], 'es')).toEqual({})
  })

  it('keeps the English when the call fails, and asks again later', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'))
    await askPoolGlosses({}, ['vocab_jmdict_1'], 'fr')
    expect(knownPoolGlosses(['vocab_jmdict_1'], 'fr')).toEqual({})
    apiJson.mockResolvedValueOnce({ glosses: { vocab_jmdict_1: 'portillon' } })
    await askPoolGlosses({}, ['vocab_jmdict_1'], 'fr')
    expect(knownPoolGlosses(['vocab_jmdict_1'], 'fr')).toEqual({ vocab_jmdict_1: 'portillon' })
  })
})

describe('a word\'s gloss', () => {
  const lines = { vocab_jmdict_1: 'portillon' }
  it('reads the model\'s line first, the card\'s French, then the line asked for, then the English', () => {
    expect(wordGloss(pool('vocab_jmdict_1', { tok: { meaning: 'en contexte' } }), 'fr', lines)).toBe('en contexte')
    expect(wordGloss(deck, 'fr', lines)).toBe('gare')
    expect(wordGloss(pool('vocab_jmdict_1', { entry: { meaning_fr: 'guichet' } }), 'fr', lines)).toBe('guichet')
    expect(wordGloss(pool('vocab_jmdict_1'), 'fr', lines)).toBe('portillon')
    expect(wordGloss(pool('vocab_jmdict_9'), 'fr', lines)).toBe('english')
    // English reads the pool's own line.
    expect(wordGloss(pool('vocab_jmdict_1'), 'en', lines)).toBe('english')
    expect(wordGloss(pool('vocab_jmdict_1'), 'fr')).toBe('english')
  })
})
