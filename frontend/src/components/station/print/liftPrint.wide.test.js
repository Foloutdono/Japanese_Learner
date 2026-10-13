import { describe, it, expect, afterEach } from 'vitest'
import { page } from 'vitest/browser'
import '../../../index.css'
import { handOver, liftLayer } from './liftPrint'
import { PRINT } from './usePrint'

// ── The print lifted is the print as drawn (plan 208) ──────────────
// liftPrint rebuilds a print's layers as boxes the compositor can move,
// and hands their loops to the Web Animations API (plan 207).
// That is only a fix if the picture is the same, so every print is
// drawn both ways and frozen at the same instants: every shape stands
// where it stood (its box on the screen), and the picture matches, read
// in tiles so a hairline's antialiasing does not count while a missing
// part does (the boat's reflection, clipped away in the wrong units,
// read 25 to 49 on the day and night prints; the lift as it is reads 17
// at most).

const HOURS = ['dawn', 'day', 'dusk', 'night']
const DEVICES = ['phone', 'desk']
const LAYERS = ['sky', 'back', 'front']
const SHAPES = 'path, rect, circle, ellipse, polygon, polyline, line'
const AT = [2300, 9100]
const TILE = 8

let host = null
afterEach(() => { host?.remove(); host = null })

const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

async function freeze(t) {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = t }
  await frames()
}

async function pixels(el) {
  const shot = await page.screenshot({ element: el, base64: true, save: false })
  const img = new Image()
  img.src = `data:image/png;base64,${typeof shot === 'string' ? shot : shot.base64}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

// The largest difference between the two pictures' mean colour over
// any one tile, on 0..255.
function tileDiff(a, b) {
  let worst = 0
  for (let ty = 0; ty + TILE <= a.height; ty += TILE) {
    for (let tx = 0; tx + TILE <= a.width; tx += TILE) {
      const sum = [0, 0, 0]
      for (let y = ty; y < ty + TILE; y++) {
        for (let x = tx; x < tx + TILE; x++) {
          const i = (y * a.width + x) * 4
          for (let k = 0; k < 3; k++) sum[k] += a.data[i + k] - b.data[i + k]
        }
      }
      for (const s of sum) worst = Math.max(worst, Math.abs(s) / (TILE * TILE))
    }
  }
  return worst
}

function mount(doc) {
  host = document.createElement('div')
  host.style.cssText = `position:relative;width:${doc.w}px;height:${doc.h}px;overflow:hidden`
  const art = document.createElement('div')
  art.className = 'tpr__art'
  // The print at its own size: one pixel to its unit, at the corner.
  art.style.cssText = `--tpr-u:1px;--tpr-zoom:1;--tpr-x:0px;--tpr-y:0px;--tpr-w:${doc.w};--tpr-h:${doc.h};--tpr-sky:none`
  host.appendChild(art)
  document.body.appendChild(host)
  return LAYERS.map(name => {
    const layer = document.createElement('div')
    layer.className = 'tpr__layer'
    layer.innerHTML = `<svg viewBox="0 0 ${doc.w} ${doc.h}">${doc.layers[name]}</svg>`
    art.appendChild(layer)
    return layer
  })
}

const boxes = () => [...host.querySelectorAll(SHAPES)].map(s => s.getBoundingClientRect())

describe('the print lifted', () => {
  for (const hour of HOURS) {
    for (const device of DEVICES) {
      // Two screenshots of a whole print: slow when every lane runs at once.
      it(`${hour}, ${device}: every part lifted, every shape where it was, the same picture`, { timeout: 60_000 }, async () => {
        const doc = await (await fetch(`/today/print/${PRINT.rev}/${hour}-${device}.json`)).json()
        const layers = mount(doc)
        const moving = host.querySelectorAll('svg [class*="tpr-"]').length
        // Each part's timing as drawn, in the order the print draws them:
        // a part read a timing its group set (a gull's wing beat) and
        // must keep it once lifted.
        const timing = els => els.flatMap(e => e.getAnimations().map(a => {
          const t = a.effect.getTiming()
          return `${a.animationName ?? a.effect.getKeyframes().length}|${Math.round(t.duration)}|${Math.round(t.delay)}|${t.direction}|${t.iterations}`
        }))
        const asDrawn = timing([...host.querySelectorAll('svg [class*="tpr-"]')]).map(x => x.replace(/^[^|]*\|/, ''))
        const drawn = []
        for (const [i, t] of AT.entries()) {
          await freeze(t)
          drawn.push({ boxes: boxes(), picture: i === 0 ? await pixels(host) : null })
        }

        const lifted = layers.map(l => liftLayer(l.firstChild))
        layers.forEach((l, i) => { l.innerHTML = `<div class="tpr-lift__root">${lifted[i]}</div>` })
        // And handed to the Web Animations API (plan 207): every loop, none
        // left a CSS animation to fire an event each time it turns.
        const handed = layers.flatMap(l => handOver(l.firstChild))
        const parts = [...host.querySelectorAll('div.tpr-lift[class*="tpr-"]:not([class="tpr-lift"])')]
        expect(timing(parts).map(x => x.replace(/^[^|]*\|/, ''))).toEqual(asDrawn)
        // Nothing in the stack keeps a custom property of its own once handed over.
        expect(host.querySelectorAll('.tpr-lift__root [style*="--"]')).toHaveLength(0)
        expect(handed.length).toBe(host.querySelectorAll('div.tpr-lift[class*="tpr-"]:not([class="tpr-lift"])').length)
        expect(host.getAnimations({ subtree: true }).filter(a => a instanceof CSSAnimation && a.effect.target.closest('.tpr-lift__root'))).toHaveLength(0)

        // Every part the print moves is a box now, and nothing moves in an SVG.
        expect(host.querySelectorAll('div.tpr-lift[class*="tpr-"]:not([class="tpr-lift"])').length).toBe(moving)
        expect(host.querySelectorAll('svg [class*="tpr-"]').length).toBe(0)

        for (const [i, t] of AT.entries()) {
          await freeze(t)
          const now = boxes()
          expect(now.length).toBe(drawn[i].boxes.length)
          let off = 0
          now.forEach((r, j) => {
            const was = drawn[i].boxes[j]
            off = Math.max(off, Math.abs(r.x - was.x), Math.abs(r.y - was.y), Math.abs(r.width - was.width), Math.abs(r.height - was.height))
          })
          expect(off, `a shape moved at ${t}ms`).toBeLessThan(0.5)
          if (drawn[i].picture) expect(tileDiff(drawn[i].picture, await pixels(host)), `the picture at ${t}ms`).toBeLessThan(21)
        }
      })
    }
  }
})
