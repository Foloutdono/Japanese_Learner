import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { PRINTS_REV, SCENERIES } from '../carousel/sceneries.js'

// ── 景 — the reading challenge's sceneries (plan 309) ─────────────────
// The challenge can stand on other views than the bay: prints drawn
// ahead of time (scripts/sceneries/build.py) from today-print's own
// parts into carousel/prints/<PRINTS_REV>/<scenery>/, for the carousel
// alone. They are held to what the app's prints are held to
// (todayPrint.test.js), and to what the carousel's loader asks of them:
// one revision on disk, the build's; a folder for every scenery the
// carousel draws from them, and none for another; each with its meta
// (the frame, the app's own look of each of the year's prints) and its
// seventeen prints in the app's shape; every id in the print's
// namespace, and every reference found in the image the loader makes
// of its layer (the layer and every layer's <defs>); every class one
// index.css already rules; no opacity of its own on a moving part; no
// <defs> inside another (the loader gathers them with a non-greedy
// match); the train whole in the image the loader draws it in and
// inside its band; and a scenery's weight bounded.

const APP = JSON.parse(readFileSync(new URL('./components/station/print/print.json', import.meta.url), 'utf8'))
// the year's prints, as the app's: the summer's -b myrtle is the app's alone
const NAMES = Object.keys(APP.prints).filter(name => !name.endsWith('-b')).sort()
const ROOT = new URL('../carousel/prints/', import.meta.url)
const HERE = new URL(`${PRINTS_REV}/`, ROOT)
const BUILD = readFileSync(new URL('../scripts/sceneries/build.py', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const BUDGET = 12_000_000
const FRAME = { w: 390, h: 746, cx: 195, cy: 150, disc: 24 }

// the train as small_train lays it (scripts/sceneries/common.py): placed
// and scaled, then train8's own start a little off the print's edge
// (CLEAR); in train8's drawing its wheels 99.6 down and nothing of it
// more than 19.6 above them
const TRAIN = /<g id="(tpr-\w+Train)" transform="translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)"><g transform="translate\((-?[\d.]+) 0\)">/
const WHEELS = 99.6
const TALL = 19.6
const CLEAR = 20

const folders = existsSync(HERE) ? readdirSync(HERE).filter(name => statSync(new URL(name, HERE)).isDirectory()).sort() : []
const read = (scenery, file) => readFileSync(new URL(`${scenery}/${file}`, HERE), 'utf8')
const prints = scenery => NAMES.map(name => [name, JSON.parse(read(scenery, `${name}.json`))])
const markup = doc => Object.values(doc.layers).join('')
const idsIn = svg => [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])

describe('the sceneries on disk (plan 309)', () => {
  it('are at the revision build.py writes, and no other', () => {
    const rev = BUILD.match(/^REV = (\d+)$/m)
    expect(rev, 'build.py names its REV').not.toBeNull()
    expect(Number(rev[1])).toBe(PRINTS_REV)
    if (existsSync(ROOT)) expect(readdirSync(ROOT)).toEqual([String(PRINTS_REV)])
  })

  it('keep a folder only for a scenery the carousel draws from them', () => {
    const drawn = SCENERIES.filter(row => row.source === 'carousel').map(row => row.id)
    for (const folder of folders) expect(drawn, `${folder} is no scenery of the carousel's`).toContain(folder)
  })

  it('hold each scenery to its meta: the frame, and the app’s own look of each of the year’s prints', () => {
    for (const scenery of folders) {
      const meta = JSON.parse(read(scenery, 'meta.json'))
      expect(meta.rev, scenery).toBe(PRINTS_REV)
      expect(meta.generator, `${scenery}: drawn by the app's print revision`).toBe(APP.rev)
      for (const [key, value] of Object.entries(FRAME)) expect(meta.frame[key], `${scenery}: frame.${key}`).toBe(value)
      expect(meta.frame.horizon).toBeGreaterThan(0)
      expect(meta.frame.horizon).toBeLessThan(FRAME.h)
      const band = meta.frame.trainBand
      if (band !== null) {
        expect(band, `${scenery}: trainBand`).toHaveLength(2)
        expect(band[0]).toBeGreaterThanOrEqual(0)
        expect(band[1]).toBeGreaterThan(band[0])
        expect(band[1]).toBeLessThanOrEqual(FRAME.h)
      }
      expect(Object.keys(meta.prints).sort(), scenery).toEqual(NAMES)
      for (const name of NAMES) expect(meta.prints[name], `${scenery}/${name}`).toEqual(APP.prints[name])
      expect(readdirSync(new URL(`${scenery}/`, HERE)).sort(), scenery)
        .toEqual([...NAMES.map(name => `${name}.json`), 'meta.json'].sort())
    }
  })

  it('hold each print to the app’s shape', () => {
    for (const scenery of folders) {
      for (const [name, doc] of prints(scenery)) {
        const at = `${scenery}/${name}`
        expect(doc.rev, at).toBe(PRINTS_REV)
        expect(doc.print, at).toBe(name)
        expect(doc.device, at).toBe('phone')
        expect([doc.w, doc.h], at).toEqual([FRAME.w, FRAME.h])
        expect(Object.keys(doc.layers), at).toEqual(['sky', 'back', 'train', 'front'])
        expect(doc.train.dur, at).toBe(46)
        expect(doc.train.delay, at).toBe(20)
        expect(doc.train.run, at).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('find every reference in the image the loader makes of its layer, and name nothing outside the print’s namespace', () => {
    for (const scenery of folders) {
      for (const [name, doc] of prints(scenery)) {
        const ids = idsIn(markup(doc))
        expect(new Set(ids).size, `${scenery}/${name}: an id twice`).toBe(ids.length)
        for (const id of ids) expect(id).toMatch(/^tpr-/)
        // app.loadPrint draws each layer as its own image, carrying every
        // layer's <defs>: a body drawn in one layer is nothing in another
        const shared = Object.values(doc.layers).flatMap(l => (l.match(/<defs>[\s\S]*?<\/defs>/g) || []).flatMap(idsIn))
        for (const [layer, svg] of Object.entries(doc.layers)) {
          const known = new Set([...shared, ...idsIn(svg)])
          for (const m of svg.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) {
            const ref = m[1] ?? m[2]
            expect(known.has(ref), `${scenery}/${name}: its ${layer} points at #${ref}, which its image will not hold`).toBe(true)
          }
        }
      }
    }
  })

  it('lay each train whole in the image the loader draws it in, off the print at both ends of its run, and inside its band', () => {
    for (const scenery of folders) {
      const band = JSON.parse(read(scenery, 'meta.json')).frame.trainBand
      for (const [name, doc] of prints(scenery)) {
        const at = `${scenery}/${name}`
        const layer = doc.layers.train
        if (!layer) {
          expect(band, `${at}: a trainBand over an empty train layer`).toBeNull()
          continue
        }
        const m = TRAIN.exec(layer)
        expect(m, `${at}: a train small_train did not lay`).not.toBeNull()
        expect(band, `${at}: a train with no trainBand`).not.toBeNull()
        const [tx, ty, k, start] = m.slice(2).map(Number)
        const nose = tx - CLEAR * k
        const tail = tx + k * start
        const travel = (doc.train.run / 100) * doc.w
        // the layer's image spans a print's width either side of the frame
        expect(tail, `${at}: the train's tail past the image's left edge`).toBeGreaterThanOrEqual(-doc.w)
        expect(nose, `${at}: the train on the print as its run begins`).toBeLessThanOrEqual(0)
        expect(tail + travel, `${at}: the train still on the print as its run ends`).toBeGreaterThanOrEqual(doc.w)
        const wheels = ty + k * WHEELS
        const rows = [[wheels - k * TALL, wheels]]
        for (const r of layer.matchAll(new RegExp(`<use href="#${m[1]}" transform="matrix\\(1 0 0 -1 0 (-?[\\d.]+)\\)">`, 'g'))) {
          rows.push([Number(r[1]) - wheels, Number(r[1]) - wheels + k * TALL])
        }
        for (const [y0, y1] of rows) {
          expect(y0, `${at}: the train above its band`).toBeGreaterThanOrEqual(band[0])
          expect(y1, `${at}: the train below its band`).toBeLessThanOrEqual(band[1])
        }
      }
    }
  })

  it('carry only classes index.css already rules: a scenery adds none', () => {
    const classes = new Set()
    for (const scenery of folders) {
      for (const [, doc] of prints(scenery)) {
        for (const m of markup(doc).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) classes.add(c)
      }
    }
    for (const c of classes) {
      expect(c).toMatch(/^tpr-/)
      expect(CSS, `.${c} has no rule`).toMatch(new RegExp(`\\.${c}(?![\\w-])`))
    }
  })

  it('give no moving part an opacity of its own, and set no <defs> inside another', () => {
    for (const scenery of folders) {
      for (const [name, doc] of prints(scenery)) {
        for (const m of markup(doc).matchAll(/<\w+ [^>]*class="tpr-[^"]*"[^>]*>/g)) {
          expect(m[0], `${scenery}/${name}`).not.toMatch(/\sopacity="/)
        }
        for (const [layer, svg] of Object.entries(doc.layers)) {
          let depth = 0
          let deepest = 0
          for (const m of svg.matchAll(/<(\/?)defs>/g)) {
            depth += m[1] ? -1 : 1
            deepest = Math.max(deepest, depth)
          }
          expect(deepest, `${scenery}/${name}: a <defs> inside another in its ${layer}`).toBeLessThanOrEqual(1)
          expect(depth, `${scenery}/${name}: ${layer}'s <defs> closed`).toBe(0)
        }
      }
    }
  })

  it('keep a folder for every scenery of the carousel’s own, its seventeen prints and its meta, at most 12 MB', () => {
    // Read from the rows, not from the disk: a scenery offered whose
    // folder is gone has the bay stand in for it in the studio, and the
    // render stops on it.
    expect(NAMES).toHaveLength(17)
    const own = SCENERIES.filter(row => row.source === 'carousel').map(row => row.id)
    expect(own.length, 'no scenery of the carousel’s own').toBeGreaterThan(0)
    for (const id of own) {
      const dir = new URL(`${id}/`, HERE)
      expect(existsSync(dir), `carousel/prints/${PRINTS_REV}/${id}/ is missing: draw it with python3 scripts/sceneries/build.py`).toBe(true)
      const files = readdirSync(dir).sort()
      expect(files, id).toEqual([...NAMES.map(name => `${name}.json`), 'meta.json'].sort())
      const bytes = files.reduce((sum, file) => sum + statSync(new URL(file, dir)).size, 0)
      expect(bytes, `${id}: ${(bytes / 1e6).toFixed(1)} MB`).toBeLessThanOrEqual(BUDGET)
    }
  })
})
