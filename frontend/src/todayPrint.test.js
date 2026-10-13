import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { PRINT, printHour, printVars } from './components/station/print/usePrint'

// ── 浮世絵 — the print behind Today's gate (plan 205) ────────────────
// The print is drawn ahead of time (scripts/today-print/build.py) into
// public/today/print/<rev>/, and its moving parts are styled here, in
// index.css. The two are written apart, so this holds them together:
// every print the gate can ask for is on disk at the revision the app
// asks for; every class a print carries has its rule and every
// animation its keyframes; every reference inside a print finds its
// id; and under reduced motion the whole print keeps still.

const HOURS = ['dawn', 'day', 'dusk', 'night']
const DEVICES = ['phone', 'desk']
const ROOT = new URL(`../public/today/print/${PRINT.rev}/`, import.meta.url)
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const scene = (hour, device) => JSON.parse(readFileSync(new URL(`${hour}-${device}.json`, ROOT), 'utf8'))
const markup = doc => Object.values(doc.layers).join('')
const at = (h, m) => new Date(2026, 9, 13, h, m)

describe('the hour the print shows', () => {
  it('turns at 5:00, 9:00, 16:00 and 19:30, local', () => {
    expect(printHour(at(0, 0))).toBe('night')
    expect(printHour(at(4, 59))).toBe('night')
    expect(printHour(at(5, 0))).toBe('dawn')
    expect(printHour(at(8, 59))).toBe('dawn')
    expect(printHour(at(9, 0))).toBe('day')
    expect(printHour(at(15, 59))).toBe('day')
    expect(printHour(at(16, 0))).toBe('dusk')
    expect(printHour(at(19, 29))).toBe('dusk')
    expect(printHour(at(19, 30))).toBe('night')
    expect(printHour(at(23, 59))).toBe('night')
  })

  it('has a look for every hour, its view a single print title', () => {
    for (const hour of HOURS) {
      const look = PRINT.hours[hour]
      expect(look.view, hour).toMatch(/^\p{Script=Han}+$/u)
      expect(look.sky.length, hour).toBeGreaterThan(1)
      expect(Object.keys(printVars(hour, 'phone', null))).toContain('--tpr-sky')
    }
  })
})

describe('the prints on disk', () => {
  it('holds every hour on both frames, at the revision the app asks for', () => {
    for (const hour of HOURS) {
      for (const device of DEVICES) {
        const doc = scene(hour, device)
        expect(doc.rev, `${hour}-${device}`).toBe(PRINT.rev)
        expect([doc.w, doc.h]).toEqual([PRINT.frames[device].w, PRINT.frames[device].h])
        expect(Object.keys(doc.layers)).toEqual(['sky', 'back', 'train', 'front'])
        expect(doc.train.dur).toBeGreaterThan(0)
      }
    }
    expect(existsSync(new URL('grain.png', ROOT))).toBe(true)
    expect(existsSync(new URL('paper.png', ROOT))).toBe(true)
  })

  it('finds every reference inside a print, and names nothing outside its own namespace', () => {
    for (const hour of HOURS) {
      for (const device of DEVICES) {
        const text = markup(scene(hour, device))
        const ids = [...text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
        expect(new Set(ids).size, `${hour}-${device}: an id twice`).toBe(ids.length)
        for (const id of ids) expect(id).toMatch(/^tpr-/)
        const refs = [...text.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map(m => m[1] ?? m[2])
        for (const ref of refs) expect(ids, `${hour}-${device}`).toContain(ref)
      }
    }
  })

  it('styles every class a print carries, and every animation has its keyframes', () => {
    const classes = new Set()
    for (const hour of HOURS) {
      for (const device of DEVICES) {
        for (const m of markup(scene(hour, device)).matchAll(/class="([^"]+)"/g)) {
          for (const c of m[1].split(/\s+/)) classes.add(c)
        }
      }
    }
    for (const c of classes) {
      expect(c).toMatch(/^tpr-/)
      expect(CSS, `.${c} has no rule`).toMatch(new RegExp(`\\.${c}(?![\\w-])`))
    }
    const names = new Set()
    for (const m of CSS.matchAll(/animation(?:-name)?:\s*(tpr-[\w-]+)/g)) names.add(m[1])
    for (const name of names) expect(CSS, `@keyframes ${name}`).toContain(`@keyframes ${name} `)
  })

  it('keeps the whole print still under reduced motion', () => {
    const still = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
      .map(m => m[1]).find(body => body.includes('.tpr__train'))
    expect(still).toBeDefined()
    expect(still).toMatch(/\.tpr \[class\*="tpr-"\][\s\S]*?\{ animation: none; \}/)
  })
})
