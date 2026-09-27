import { expect } from 'vitest'

// ── Whether a field is on the screen at all ──
// Shared by the two guards, fields.browser.test.jsx (a phone's width)
// and fields.desktop.test.jsx (the desk's): a field separates from what
// it is mounted on by its WELL or by an EDGE, and one that does neither
// is a line of placeholder text with no field round it. What that needs
// is the mount, so each guard renders fixture chains copied from the
// components, and this measures one.

const canvas = document.createElement('canvas')
canvas.width = canvas.height = 4
const ctx = canvas.getContext('2d', { willReadFrequently: true })
const readPixel = () => Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3)

function paint(colours) {
  ctx.clearRect(0, 0, 4, 4)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 4, 4)
  for (const c of colours) {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') continue
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 4, 4)
  }
  return readPixel()
}

// The ground is everything painted BENEATH the field -- the element's
// own background deliberately excluded, since that is the other half of
// the comparison.
function groundUnder(el) {
  const stack = []
  for (let n = el.parentElement; n; n = n.parentElement) {
    const s = getComputedStyle(n)
    // A gradient lives in background-image and never in
    // backgroundColor, so an ancestor carrying one (the pass) would
    // otherwise read as transparent and the ground would be wrong. No
    // case has one; assert rather than guess if that changes.
    expect(s.backgroundImage, `${n.className} paints a gradient — this composite reads solid colours only`).toBe('none')
    stack.push(s.backgroundColor)
  }
  return paint(stack.reverse())
}

const luminance = ([r, g, b]) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The page cross-fades between themes: html and body carry `transition:
// background 0.2s` and .field its own 0.15s, so a read straight after a
// switch is a frame of the fade and not the theme. At t=0 that frame is
// the OLD theme -- the light pass was measuring every .field's dark
// well -- and partway through it is neither: the sheet's own first paint
// fades body from the UA's transparent to --bg-main as a test file
// imports it, and a case that sits on the page read ~90-100ms into that
// fade found its well matching the ground. Finish every fade the switch
// started, in passes -- finishing html's can restart body's -- and read
// the colours the theme settles on.
export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  for (let pass = 0; ; pass++) {
    const fades = document.getAnimations().filter(a => a instanceof CSSTransition)
    if (!fades.length) return
    if (pass === 5) throw new Error(`the ${t} theme never settled: its fades keep restarting`)
    fades.forEach(a => a.finish())
  }
}

// The element that paints the well in a rendered case: the field
// itself, or the .field a bare input sits in (a search well, the
// readings quiz's box).
export function wellOf(container) {
  return container.querySelector('.field:not(.field--bare), input, textarea')
}

/** Fails unless `el` stands off its ground, by well or by edge, in both themes. */
export function expectVisibleWell(el, label) {
  expect(el, `${label}: the case has no field in it`).toBeTruthy()
  for (const theme of ['dark', 'light']) {
    setTheme(theme)
    const style = getComputedStyle(el)
    const well = paint([style.backgroundColor])
    const ground = groundUnder(el)
    const step = contrast(well, ground)

    // A field may separate from its ground by WELL or by EDGE — the
    // filled well is the app's idiom and .textarea/.brd-field are the
    // two that draw a resting hairline instead. What none of them may
    // do is neither.
    const edge = parseFloat(style.borderTopWidth) > 0
      && style.borderTopColor !== 'rgba(0, 0, 0, 0)'
      && contrast(paint([style.borderTopColor]), ground) > 1.06

    expect(
      step > 1.03 || edge,
      `${label} (${theme}): the well is its own ground and no edge is drawn — `
      + 'there is no field on the screen. Give it .field--page if it sits on '
      + 'the page, or the variant that matches whatever it does sit on.',
    ).toBe(true)
  }
  setTheme('dark')
}
