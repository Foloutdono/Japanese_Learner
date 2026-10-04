import { describe, it, expect } from 'vitest'
import fr from '../locales/fr/index.js'
import en from '../locales/en/index.js'
import { AGENDA_IDS, planAgenda, subjectInfo } from './agenda'
import { NUDGE_IDS, LEGACY_NUDGE_ID } from './ahead'
import { SUBJECTS } from '../domain/agenda'

// The agenda's reminders (plan 181): one local notification for each
// coming occurrence of each block that asks for one, a lead before its
// start.

const block = (over = {}) => ({ subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10, ...over })
// Wednesday 7 October 2026, 08:00.
const now = new Date(2026, 9, 7, 8, 0)

describe('the ids', () => {
  it('stand clear of the day\'s train', () => {
    for (const id of AGENDA_IDS) {
      expect(NUDGE_IDS).not.toContain(id)
      expect(id).not.toBe(LEGACY_NUDGE_ID)
    }
    expect(new Set(AGENDA_IDS).size).toBe(AGENDA_IDS.length)
    // iOS keeps 64 pending between everything an app schedules.
    expect(AGENDA_IDS.length + NUDGE_IDS.length).toBeLessThanOrEqual(64)
  })
})

describe('planAgenda', () => {
  it('schedules a lead before each start, nearest first, each opening its subject', () => {
    const plan = planAgenda({ blocks: [block({ days: [2, 3] })], t: en, now })
    expect(plan.map(p => [p.at.getDate(), p.at.getHours(), p.at.getMinutes()])).toEqual([[7, 8, 50], [8, 8, 50], [14, 8, 50]])
    expect(plan[0]).toMatchObject({ id: AGENDA_IDS[0], extra: { to: '/learn/kanji' }, lines: [] })
    expect(plan[0].title).toBe('Kanji in 10 min')
    expect(plan[0].body).toBe('At 9:00, until 11:00')
  })

  it('says it starts now for a block with no lead', () => {
    const [p] = planAgenda({ blocks: [block({ days: [3], lead: 0 })], t: en, now })
    expect(p.at.getHours()).toBe(9)
    expect(p.title).toBe('Kanji starts now')
    expect(p.body).toBe('9:00–11:00')
  })

  it('leaves out a block that asks for no reminder', () => {
    expect(planAgenda({ blocks: [block({ notify: false })], t: en, now })).toEqual([])
  })

  it('leaves out a reminder that is already gone, or about to fire', () => {
    // 09:00 less ten minutes is 08:50: ten minutes after `now`. Move `now` to 08:49:30.
    const late = new Date(2026, 9, 7, 8, 49, 30)
    const plan = planAgenda({ blocks: [block({ days: [2] })], t: en, now: late })
    expect(plan.every(p => p.at.getDate() !== 7)).toBe(true)
    const past = new Date(2026, 9, 7, 9, 30)
    expect(planAgenda({ blocks: [block({ days: [2] })], t: en, now: past }).map(p => p.at.getDate())).toEqual([14])
  })

  it('never plans more than it has ids for, the nearest first', () => {
    const busy = Array.from({ length: 16 }, (_, i) => block({ days: [0, 1, 2, 3, 4, 5, 6], start: 360 + i * 60, end: 400 + i * 60 }))
    const plan = planAgenda({ blocks: busy, t: en, now })
    expect(plan).toHaveLength(AGENDA_IDS.length)
    expect(plan.map(p => p.id)).toEqual(AGENDA_IDS)
    const times = plan.map(p => p.at.getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('speaks both languages', () => {
    const [p] = planAgenda({ blocks: [block({ days: [3], lead: 5 })], t: fr, now })
    expect(p.title).toBe('Kanji dans 5 min')
  })
})

describe('subjectInfo', () => {
  it('names every subject as its gate does, with its glyph and its line colour', () => {
    for (const subject of SUBJECTS) {
      const info = subjectInfo(subject, en)
      expect(info.title, subject).toBeTruthy()
      expect(info.title, subject).not.toBe(subject)
      expect(info.icon, subject).toBeTruthy()
      expect(info.color, subject).toMatch(/^var\(--/)
    }
    expect(subjectInfo('kanji', en)).toMatchObject({ path: '/learn/kanji', icon: '漢字', color: 'var(--line-kanji)' })
  })

  it('names a subject short, as a block and a notification have room for', () => {
    expect(subjectInfo('reading', fr).title).toBe('Lecture')
    expect(subjectInfo('review', en).title).toBe('Reviews')
    for (const subject of SUBJECTS) {
      expect(subjectInfo(subject, fr).title.length, subject).toBeLessThanOrEqual(14)
      expect(subjectInfo(subject, en).title.length, subject).toBeLessThanOrEqual(14)
    }
    const [p] = planAgenda({ blocks: [block({ subject: 'reading', days: [3], lead: 30 })], t: fr, now })
    expect(p.title).toBe('Lecture dans 30 min')
  })
})
