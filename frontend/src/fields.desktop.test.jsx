import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'
import { expectVisibleWell, wellOf } from './testing/wells'

// ── 机 — no field is painted in its own ground, on the desk (plan 157) ──
// fields.browser.test.jsx asks this at a phone's width, where the desk's
// rules never apply -- and on the desk three of .field--page's mounts
// stand on a surface the phone does not draw: the run's entry on its
// framed floor (plan 129), the guest's claim in a settings slip (plan
// 145) and the import dialog (plan 120). --surface on --surface: each
// showed its placeholder and no field, until the owner's screenshots of
// "ex. konnichiwa" and "E-mail" floating on a card. The desk's search
// wells are here too, since the rail's and the shelf's exist only here.
//
// The same trick as the phone's guard: fixture markup, the ancestors
// that PAINT copied from the component named beside each. Add a case
// when the desk mounts a field somewhere new.
const CASES = [
  ['ReadingRun, TranslationRun, DictationRun, CompositionRun — the entry on the three panels\' floor',
    <div className="screen desk-run desk-run--panels"><main className="container stage">
      <form className="stage__foot">
        <input className="field field--page" placeholder="ex. konnichiwa" />
        <button type="submit" className="btn-primary">Valider</button>
      </form>
    </main></div>],

  ['AccountPage — the guest\'s claim, in a slip on the settings page',
    <section className="desk-settings__page"><div className="slip slip--ways"><div className="slip__way">
      <input className="field field--page" placeholder="E-mail" />
    </div></div></section>],

  ['ImportCardsMenu — the paste box, in the desk\'s dialog',
    <div className="import-overlay"><div className="import-modal">
      <textarea className="field field--multi field--page import-textarea" placeholder="Front, Back" />
    </div></div>],

  ['ImportCardsMenu — the custom separator, in the desk\'s dialog',
    <div className="import-overlay"><div className="import-modal"><div className="import-sep-row">
      <div><label className="import-sep-option">
        <input className="field field--page import-sep-custom-input" placeholder="," />
      </label></div>
    </div></div></div>],

  ['AnalyzerScreen — the rail\'s search, a search well on the rail',
    <div className="anl-desk"><div className="anl-railcol anl-desk__rail"><div className="anl-railhead">
      <label className="field field--search anl-railhead__well">
        <input type="search" className="anl-railhead__search" placeholder="Chercher dans le passage…" />
      </label>
    </div></div></div>],

  ['GateShelf — the shelf\'s search, a search well in the panel\'s foot',
    <section className="gate-panel"><form className="gate-panel__foot">
      <label className="field field--search gate-field">
        <input type="search" placeholder="Chercher un deck…" />
      </label>
    </form></section>],

  ['ConsoleIndex — every console\'s search, a search well in row 2',
    <div className="console"><div className="console__index">
      <div className="field field--search console__well">
        <input className="console__field" placeholder="Rechercher un kanji, un kana ou un sens…" />
      </div>
    </div></div>],
]

describe('every field is visible on the desk ground it is mounted on', () => {
  it.each(CASES)('%s', async (label, markup) => {
    const screen = await render(markup)
    expectVisibleWell(wellOf(screen.container), label)
  })
})

// The entry's floor is one row (plan 157): the answer beside Check, as
// 問's well stands beside its send, the field at Check's height.
describe('the entry\'s floor on the desk', () => {
  it('stands the field beside Check, at its height, taking the rest of the row', async () => {
    const screen = await render(CASES[0][1])
    const field = screen.container.querySelector('.field').getBoundingClientRect()
    const check = screen.container.querySelector('.btn-primary').getBoundingClientRect()
    const foot = screen.container.querySelector('.stage__foot')
    const box = foot.getBoundingClientRect()
    const pad = getComputedStyle(foot)
    expect(Math.abs(field.top - check.top)).toBeLessThan(1)
    expect(Math.abs(field.height - check.height)).toBeLessThan(1)
    // The field from the floor's leading edge to Check, one gap between.
    expect(Math.round(field.left)).toBe(Math.round(box.left + 1 + parseFloat(pad.paddingLeft)))
    expect(check.left - field.right).toBeGreaterThan(0)
    expect(check.left - field.right).toBeLessThanOrEqual(parseFloat(pad.columnGap) + 0.5)
    expect(Math.round(check.right)).toBe(Math.round(box.right - 1 - parseFloat(pad.paddingRight)))
  })
})
