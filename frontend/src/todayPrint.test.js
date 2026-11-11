import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { PRINT, printHour, printName, printSeason, printVars } from './components/station/print/usePrint'
import en from './locales/en/index.js'
import fr from './locales/fr/index.js'

// ── 浮世絵 — the print behind Today's gate (plan 205) ────────────────
// The print is drawn ahead of time (scripts/today-print/build.py) into
// public/today/print/<rev>/, and its moving parts are styled here, in
// index.css. The two are written apart, so this holds them together:
// every print the gate can ask for, at any hour of any day of the year,
// is on disk at the revision the app asks for, and nothing else is;
// every class a print carries has its rule and every animation its
// keyframes; every reference inside a print finds its id; and under
// reduced motion the whole print keeps still.

const HOURS = ['dawn', 'day', 'dusk', 'night']
// Every print the year shows (plan 261): a season's at each hour, the
// summer's August night, and the summer's again with the other crape
// myrtle (`-b`, round 5).
const PRINTS = Object.keys(PRINT.prints)
const DEVICES = ['phone', 'desk']
const ROOT = new URL(`../public/today/print/${PRINT.rev}/`, import.meta.url)
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const scene = (name, device) => JSON.parse(readFileSync(new URL(`${name}-${device}.json`, ROOT), 'utf8'))
const markup = doc => Object.values(doc.layers).join('')
const at = (h, m) => new Date(2026, 9, 13, h, m)
const on = (month, day, h = 12) => new Date(2026, month - 1, day, h, 0)

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

  it('has a look for every print, its view a single print title, said in both languages', () => {
    for (const name of PRINTS) {
      const look = PRINT.prints[name]
      expect(look.view, name).toMatch(/^\p{Script=Han}+$/u)
      expect(look.sky.length, name).toBeGreaterThan(1)
      expect(HOURS, name).toContain(look.hour)
      expect(Object.keys(printVars(name, 'phone', null))).toContain('--tpr-sky')
      // a B print is said as the print whose view it shows
      expect(PRINT.prints[look.viewKey]?.view, name).toBe(look.view)
    }
    const views = [...new Set(PRINTS.map(name => PRINT.prints[name].viewKey))].sort()
    expect(Object.keys(en.printViews).sort()).toEqual(views)
    expect(Object.keys(fr.printViews).sort()).toEqual(views)
  })
})

describe('the season the print shows (plan 261)', () => {
  it('turns by the month: spring from March, summer from June, autumn from September, winter from December', () => {
    expect(printSeason(on(2, 28))).toBe('winter')
    expect(printSeason(on(3, 1))).toBe('spring')
    expect(printSeason(on(5, 31))).toBe('spring')
    expect(printSeason(on(6, 1))).toBe('summer')
    expect(printSeason(on(8, 31))).toBe('summer')
    expect(printSeason(on(9, 1))).toBe('autumn')
    expect(printSeason(on(11, 30))).toBe('autumn')
    expect(printSeason(on(12, 1))).toBe('winter')
    expect(printSeason(on(1, 15))).toBe('winter')
  })

  it('shows the fireflies on a June or July night and the fireworks on an August one', () => {
    expect(printName(on(6, 20, 22))).toBe('summer-night')
    expect(printName(on(7, 30, 23))).toBe('summer-night')
    expect(printName(on(8, 1, 21))).toBe('summer-hanabi')
    expect(printName(on(8, 31, 23))).toBe('summer-hanabi')
    expect(printName(on(8, 15, 13))).toBe('summer-day')
    expect(printName(on(9, 1, 21))).toBe('autumn-night')
  })

  it('takes the two crape myrtles in turn, a day each, a night keeping its evening’s (round 5)', () => {
    expect(printName(on(7, 20, 13))).toBe('summer-day')
    expect(printName(on(7, 21, 13))).toBe('summer-day-b')
    expect(printName(on(7, 21, 7))).toBe('summer-dawn-b')
    expect(printName(on(7, 21, 22))).toBe('summer-night-b')
    // the print's day starts at its dawn: past midnight, still the 21st's
    expect(printName(on(7, 22, 3))).toBe('summer-night-b')
    expect(printName(on(7, 22, 5))).toBe('summer-dawn')
    expect(printName(on(8, 16, 21))).toBe('summer-hanabi-b')
    // one print an hour in the other seasons
    expect(printName(on(10, 21, 13))).toBe('autumn-day')
  })

  it('names the hour a finish keeps, in the season of the day', () => {
    expect(printName(on(8, 15, 9), 'night')).toBe('summer-hanabi')
    expect(printName(on(4, 5, 7), 'night')).toBe('spring-night')
  })

  it('asks only for prints there are, and every print is asked for some hour of the year', () => {
    const asked = new Set()
    for (let month = 1; month <= 12; month++) {
      for (const day of [15, 16]) for (const h of [0, 5, 9, 16, 20]) asked.add(printName(on(month, day, h)))
    }
    expect([...asked].sort()).toEqual([...PRINTS].sort())
  })
})

describe('the prints on disk', () => {
  it('holds every print on both frames, at the revision the app asks for', () => {
    for (const name of PRINTS) {
      for (const device of DEVICES) {
        const doc = scene(name, device)
        expect(doc.rev, `${name}-${device}`).toBe(PRINT.rev)
        expect(doc.print, `${name}-${device}`).toBe(name)
        expect([doc.w, doc.h]).toEqual([PRINT.frames[device].w, PRINT.frames[device].h])
        expect(Object.keys(doc.layers)).toEqual(['sky', 'back', 'train', 'front'])
        expect(doc.train.dur).toBeGreaterThan(0)
      }
    }
    expect(existsSync(new URL('grain.png', ROOT))).toBe(true)
    expect(existsSync(new URL('paper.png', ROOT))).toBe(true)
  })

  it('keeps nothing else: no other revision, no stray print', () => {
    // The worker keeps /today/ for a year: an old file is only weight
    // in the repository.
    expect(readdirSync(new URL('../', ROOT))).toEqual([String(PRINT.rev)])
    const files = PRINTS.flatMap(name => DEVICES.map(device => `${name}-${device}.json`))
    expect(readdirSync(ROOT).sort()).toEqual([...files, 'grain.png', 'paper.png'].sort())
  })

  it('finds every reference inside a print, and names nothing outside its own namespace', () => {
    for (const name of PRINTS) {
      for (const device of DEVICES) {
        const text = markup(scene(name, device))
        const ids = [...text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
        expect(new Set(ids).size, `${name}-${device}: an id twice`).toBe(ids.length)
        for (const id of ids) expect(id).toMatch(/^tpr-/)
        const refs = [...text.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map(m => m[1] ?? m[2])
        for (const ref of refs) expect(ids, `${name}-${device}`).toContain(ref)
      }
    }
  })

  it('styles every class a print carries, and every animation has its keyframes', () => {
    const classes = new Set()
    for (const name of PRINTS) {
      for (const device of DEVICES) {
        for (const m of markup(scene(name, device)).matchAll(/class="([^"]+)"/g)) {
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

  it('gives no moving part an opacity of its own, which a lifted box could not keep under its rule', () => {
    // print/liftPrint.js (plan 208) carries a moving part's class to an
    // HTML box. In an SVG a class's rule outranks an opacity attribute;
    // on the box the attribute would be inline and outrank the rule.
    for (const name of PRINTS) {
      for (const device of DEVICES) {
        for (const m of markup(scene(name, device)).matchAll(/<\w+ [^>]*class="tpr-[^"]*"[^>]*>/g)) {
          expect(m[0], `${name}-${device}`).not.toMatch(/\sopacity="/)
        }
      }
    }
    for (const c of ['tpr-lift', 'tpr-lift__root', 'tpr-lift__run']) {
      expect(CSS, `.${c} has no rule`).toMatch(new RegExp(`\\.${c}(?![\\w-])`))
    }
  })

  it('keeps the whole print still under reduced motion', () => {
    const still = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
      .map(m => m[1]).find(body => body.includes('.tpr__train'))
    expect(still).toBeDefined()
    expect(still).toMatch(/\.tpr \[class\*="tpr-"\][\s\S]*?\{ animation: none; \}/)
  })
})
