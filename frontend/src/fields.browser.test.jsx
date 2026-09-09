import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Guard: no field is painted in its own ground.
//
// .field's well is --bg-main -- the PAGE's ground -- which reads as a
// step down through whatever raised thing the field sits on. Mount one
// on the page itself and the step is nil: --bg-main on --bg-main, no
// border at rest, and there is no field on the screen at all. A line of
// placeholder text, both themes, every width.
//
// Nothing already in the suite could see it. Guard 4 measures INK on
// ground and both inks were fine; Guard 5 reads the sheet, where a well
// held in a custom property is deliberately invisible to it; and the
// phone/tablet lanes pin geometry, which was also fine. The defect is
// entirely in the pairing of a rule with a MOUNT, so it needs the mount.
//
// Hence fixture markup, one case per real call site, ancestors copied
// from the component named beside each -- the same trick
// contrast.browser.test.jsx uses. A case's chain only needs the
// ancestors that PAINT: those are what a ground is made of.
import './index.css'

// Every ancestor chain in the app that ends in a .field/.textarea, with
// the file it was copied from. Add a case when a screen grows a field;
// that is the whole point of the file.
const CASES = [
  ['ReadingRun / TranslationRun — the run\'s entry',
    <main className="container stage"><form className="stage__foot">
      <input className="field field--page" placeholder="ex. konnichiwa" />
    </form></main>],

  ['AuthScreen — sign in',
    <div className="auth-card"><input className="field" placeholder="email" /></div>],

  ['AccountPage — the guest\'s claim fields',
    <main className="settings"><div className="slip">
      <input className="field field--page" placeholder="email" />
    </div></main>],

  ['DecksScreen — create a deck',
    <div className="form"><input className="field" placeholder="deck name" /></div>],

  ['DeckDetailScreen — the card form',
    <div className="form deckdetail-form"><div className="deckdetail-form__fields">
      <div className="deckdetail-form__group">
        <input className="field deckdetail-form__input" placeholder="front" />
      </div>
    </div></div>],

  ['ImportCardsMenu — the paste box',
    <div className="import-overlay"><div className="import-modal">
      <textarea className="field field--multi field--page import-textarea" placeholder="Front, Back" />
    </div></div>],

  ['ImportCardsMenu — the custom separator',
    <div className="import-overlay"><div className="import-modal"><div className="import-sep-row">
      <div><label className="import-sep-option">
        <input className="field field--page import-sep-custom-input" placeholder="," />
      </label></div>
    </div></div></div>],

  ['BrowseCardsMenu — search the catalogue',
    <div className="import-overlay"><div className="import-modal browse-modal">
      <input className="field field--page deckdetail-form__input browse-search-input" placeholder="search" />
    </div></div>],

  ['ReadingsInput — the readings quiz',
    <div className="prompt-card readings-input"><div className="readings-input__group">
      <div className="readings-input__row">
        <input className="field quiz-input readings-input__field" placeholder="reading" />
      </div>
    </div></div>],

  ['QuizComponents — the typed answer',
    <div className="prompt-card"><input className="field quiz-input" placeholder="answer" /></div>],

  ['DeckPicker — a new deck, from the analyzer',
    <div className="surface"><input className="field" placeholder="deck" /></div>],

  ['AnalyzerScreen — the working rail search',
    <div className="anl-results"><div className="anl-railcol"><div className="anl-railhead">
      <input type="search" className="field field--page anl-railhead__search" placeholder="search" />
    </div></div></div>],

  ['IntakeVideo — the video URL',
    <div className="anl-panel"><label className="anl-field-row">
      <input className="field field--page anl-field" placeholder="https://youtu.be/" />
    </label></div>],

  ['IntakeVideo — the window fields, inside a notice',
    <div className="anl-panel"><div className="anl-notice"><div className="anl-window">
      <div className="anl-window__field"><input className="field anl-field" placeholder="0:00" /></div>
    </div></div></div>],

  ['WritingSlip — .textarea, which draws its own edge instead',
    <div className="anl-panel"><div className="anl-slip">
      <textarea className="textarea anl-slip__field" placeholder="paste Japanese" />
    </div></div>],

  ['NameStep — .brd-field, which draws its own edge instead',
    <div className="brd__stage"><input className="brd-field brd-field--empty" placeholder="name" /></div>],
]

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
    // case here has one; assert rather than guess if that changes.
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

const setTheme = (t) => document.documentElement.setAttribute('data-theme', t)

describe('every field is visible on the ground it is mounted on', () => {
  it.each(CASES)('%s', async (label, markup) => {
    const screen = await render(markup)
    const el = screen.container.querySelector('input, textarea')
    expect(el, 'the fixture has no field in it').toBeTruthy()

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
  })
})
