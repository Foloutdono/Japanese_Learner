import { describe, it, expect } from 'vitest'
import { fold, searchWords, sceneMatches, nearestLevel } from './conversation'

// ── The station's search (plan 245) ──────────────────────────────
// A query is folded as the scenes are: case, accents, full width and
// the two kana scripts set aside, every word wanted somewhere in the
// scene's own fields.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const konbini = {
  id: 'konbini-lunch',
  level: 'N5',
  title: 'Le déjeuner à la supérette',
  situation: 'Tu es à la caisse d’une supérette avec un bento pour midi.',
  goal: 'Achète ton déjeuner.',
  steps: ['Fais réchauffer le bento', 'Paie par carte'],
  them: 'Vendeur',
  place: { jp: 'コンビニ', parts: [{ text: 'コンビニ' }], name: 'Supérette' },
  opener: 'いらっしゃいませ。お弁当は温めますか。',
}
const hotel = {
  id: 'hotel-checkin',
  level: 'N4',
  title: 'L’arrivée à l’hôtel',
  situation: 'Tu arrives à ton hôtel avec ta valise.',
  goal: 'Enregistre-toi pour deux nuits.',
  steps: ['Montre ton passeport'],
  them: 'Réceptionniste',
  place: { jp: 'ホテル', parts: [{ text: 'ホテル' }], name: 'Hôtel' },
  opener: 'いらっしゃいませ。チェックインでしょうか。',
}
const station = {
  id: 'station-platform',
  level: 'N5',
  title: 'Le train pour Shibuya',
  situation: 'Tu es dans une grande gare.',
  goal: 'Trouve le quai.',
  steps: ['Trouve le quai'],
  them: 'Agent de gare',
  place: { jp: '駅', parts: [{ text: '駅', reading: 'えき' }], name: 'Gare' },
  opener: 'どうしましたか。',
}

describe('the station search', () => {
  it('folds case, accents, full width and katakana', () => {
    expect(fold('Hôtel')).toBe('hotel')
    expect(fold('ＨＯＴＥＬ')).toBe('hotel')
    expect(fold('コンビニ')).toBe('こんびに')
    expect(fold('ガイド')).toBe('がいど')
    expect(fold(null)).toBe('')
  })

  it('splits a query into its words, and a blank one into none', () => {
    expect(searchWords('  Carte   Supérette ')).toEqual(['carte', 'superette'])
    expect(searchWords('   ')).toEqual([])
  })

  it('finds a scene by any of its fields, every word wanted', () => {
    expect(sceneMatches(hotel, searchWords('hotel'))).toBe(true)
    expect(sceneMatches(konbini, searchWords('carte'))).toBe(true)          // a step
    expect(sceneMatches(konbini, searchWords('vendeur'))).toBe(true)        // the role
    expect(sceneMatches(konbini, searchWords('こんびに'))).toBe(true)        // the place, as typed in hiragana
    expect(sceneMatches(konbini, searchWords('弁当'))).toBe(true)            // the line it opens on
    expect(sceneMatches(station, searchWords('えき'))).toBe(true)            // the place, as read
    expect(sceneMatches(konbini, searchWords('bento carte'))).toBe(true)
    expect(sceneMatches(konbini, searchWords('bento hôtel'))).toBe(false)
    expect(sceneMatches(hotel, [])).toBe(true)
  })

  it('sends the learner to the nearest grade that has it, the easier on a tie', () => {
    expect(nearestLevel('N3', ['N5', 'N1'], LEVELS)).toBe('N5')
    expect(nearestLevel('N3', ['N4', 'N2'], LEVELS)).toBe('N4')
    expect(nearestLevel('N5', ['N2', 'N4'], LEVELS)).toBe('N4')
    expect(nearestLevel('N4', [], LEVELS)).toBeNull()
  })
})
