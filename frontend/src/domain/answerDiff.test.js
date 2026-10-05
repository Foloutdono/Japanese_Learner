import { describe, it, expect } from 'vitest'
import { diffWords, diffChars, correctionParts, markedCount, isRomajiAnswer } from './answerDiff'

describe('diffWords', () => {
  it('strikes the word in another word\'s place and gives the right one', () => {
    expect(diffWords('koko de tchisai yasumimashou', 'koko de sukoshi yasumimashou.')).toEqual([
      { kind: 'same', text: 'koko' },
      { kind: 'same', text: 'de' },
      { kind: 'miss', given: 'tchisai', right: 'sukoshi' },
      { kind: 'same', text: 'yasumimashou' },
    ])
  })

  it('reads a long vowel left short as a near miss, not a wrong word', () => {
    const segs = diffWords('kuji ni eki de aimasho', 'kuji ni eki de aimashou.')
    expect(segs.at(-1)).toEqual({ kind: 'near', given: 'aimasho', right: 'aimashou' })
    expect(markedCount(segs)).toBe(1)
  })

  it('reads words run together or split apart as the same answer', () => {
    expect(diffWords('mainichi, namae o kakanakerebanarimasen', 'mainichi, namae o kakanakereba narimasen.'))
      .toEqual([
        { kind: 'same', text: 'mainichi' },
        { kind: 'same', text: 'namae' },
        { kind: 'same', text: 'o' },
        { kind: 'same', text: 'kakanakerebanarimasen' },
      ])
  })

  it('takes every spelling of one sound: particles, Kunrei, macrons, n before a labial', () => {
    const segs = diffWords('watashi ha sinbun wo yomimasu', 'watashi wa shimbun o yomimasu.')
    expect(markedCount(segs)).toBe(0)
    expect(markedCount(diffWords('Tōkyō e ikimasu', 'toukyou e ikimasu.'))).toBe(0)
  })

  it('names a word left out and a word added', () => {
    expect(diffWords('koko de yasumimashou', 'koko de sukoshi yasumimashou.'))
      .toContainEqual({ kind: 'missing', right: 'sukoshi' })
    expect(diffWords('koko de totemo sukoshi yasumimashou', 'koko de sukoshi yasumimashou.'))
      .toContainEqual({ kind: 'extra', given: 'totemo' })
  })

  it('keeps a doubled consonant: a dropped っ is a real miss', () => {
    expect(diffWords('kite kudasai', 'kitte kudasai.')[0]).toEqual({ kind: 'miss', given: 'kite', right: 'kitte' })
  })

  it('marks nothing on an answer that is not in romaji', () => {
    expect(isRomajiAnswer('ここで少し')).toBe(false)
    expect(diffWords('ここで少し休みましょう', 'koko de sukoshi yasumimashou.')).toBeNull()
    expect(diffWords('', 'koko')).toBeNull()
  })
})

describe('diffChars and correctionParts', () => {
  it('strikes the learner\'s particle and inserts the tutor\'s', () => {
    expect(diffChars('音楽が聞きながら勉強します。', '音楽を聞きながら勉強します。')).toEqual([
      { kind: 'same', text: '音楽' },
      { kind: 'del', text: 'が' },
      { kind: 'ins', text: 'を' },
      { kind: 'same', text: '聞きながら勉強します。' },
    ])
  })

  it('lays the corrected sentence\'s readings over every part a run holds whole', () => {
    const parts = [
      { text: '音楽', reading: 'おんがく' }, { text: 'を' }, { text: '聞', reading: 'き' },
      { text: 'きながら' }, { text: '勉強', reading: 'べんきょう' }, { text: 'します。' },
    ]
    const out = correctionParts('音楽が聞きながら勉強します。', parts)
    expect(out.map(r => r.kind)).toEqual(['same', 'del', 'ins', 'same'])
    expect(out[0].parts).toEqual([{ text: '音楽', reading: 'おんがく' }])
    expect(out[1].parts).toEqual([{ text: 'が' }])
    expect(out[2].parts).toEqual([{ text: 'を' }])
    expect(out[3].parts).toEqual([
      { text: '聞', reading: 'き' }, { text: 'きながら' }, { text: '勉強', reading: 'べんきょう' }, { text: 'します。' },
    ])
  })

  it('prints a part a run cuts through bare rather than with half its reading', () => {
    const out = correctionParts('学校', [{ text: '学生', reading: 'がくせい' }])
    expect(out.flatMap(r => r.parts).every(p => !p.reading)).toBe(true)
    expect(out.filter(r => r.kind !== 'del').flatMap(r => r.parts).map(p => p.text).join('')).toBe('学生')
  })

  it('is the sentence whole when nothing was corrected', () => {
    expect(diffChars('山へ行きます。', '山へ行きます。')).toEqual([{ kind: 'same', text: '山へ行きます。' }])
  })
})
