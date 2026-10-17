// ── 時刻表 — the daily train as a calendar file (plan 246) ──
// The one thing the web's hour sheet hands a learner to keep: if a
// calendar refuses the file, the reminder is gone without a word. So
// the file is held to what RFC 5545 asks of it -- CRLF lines of 75
// octets at most, folded without cutting a character, TEXT escaped --
// and to what it promises: a floating time at the hour, every day.
import { describe, it, expect } from 'vitest'
import { dailyTrain, fold } from './calendarFile'

const octets = s => new TextEncoder().encode(s).length
const unfold = ics => ics.replace(/\r\n /g, '')

describe('the daily train as a calendar file', () => {
  const first = new Date(2026, 9, 18, 7, 30)
  const now = new Date(Date.UTC(2026, 9, 17, 22, 5, 9))
  const ics = dailyTrain({
    first,
    minutes: 10,
    title: 'Tsuji · ton train de japonais',
    body: '10 min de japonais, chaque jour; sans faute.',
    url: 'https://tsuji.app/app',
    now,
  })

  it('writes one daily event at the hour, floating in the device\'s own zone', () => {
    const lines = unfold(ics).split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('DTSTART:20261018T073000')
    expect(lines).toContain('DURATION:PT10M')
    expect(lines).toContain('RRULE:FREQ=DAILY')
    expect(lines).toContain('DTSTAMP:20261017T220509Z')
    expect(lines).toContain('URL:https://tsuji.app/app')
    // No zone on the start: the train leaves at the learner's seven.
    expect(ics).not.toMatch(/TZID|DTSTART:[^\r]*Z/)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('escapes TEXT, and keeps every line to 75 octets', () => {
    expect(unfold(ics)).toContain(String.raw`DESCRIPTION:10 min de japonais\, chaque jour\; sans faute.`)
    for (const line of ics.split('\r\n')) expect(octets(line), line).toBeLessThanOrEqual(75)
  })

  it('folds a long line without cutting a character, and unfolds to the same', () => {
    const long = `SUMMARY:${'Départ à l’heure · 辻 · '.repeat(6)}`
    const folded = fold(long)
    expect(folded).toContain('\r\n ')
    for (const line of folded.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75)
    expect(unfold(folded)).toBe(long)
    expect(folded).not.toContain('�')
    expect(fold('BEGIN:VEVENT')).toBe('BEGIN:VEVENT')
  })
})
