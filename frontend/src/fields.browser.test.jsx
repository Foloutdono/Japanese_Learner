import { describe, it } from 'vitest'
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
import { expectVisibleWell, wellOf } from './testing/wells'

// Every ancestor chain in the app that ends in a .field/.textarea, with
// the file it was copied from. Add a case when a screen grows a field;
// that is the whole point of the file. A chain the desk draws on its
// own grounds -- and the analyser rail's search, which only the desk
// builds -- is fields.desktop.test.jsx's (plan 156).
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

  ['ReadingsInput — the readings quiz, whose box is the field',
    <div className="prompt-card readings-input"><div className="readings-input__group">
      <div className="field readings-input__box">
        <input className="field field--bare quiz-input readings-input__field" placeholder="reading" />
      </div>
    </div></div>],

  ['QuizComponents — the typed answer',
    <div className="prompt-card"><input className="field quiz-input" placeholder="answer" /></div>],

  ['DeckPicker — a new deck, from the analyzer',
    <div className="surface"><input className="field" placeholder="deck" /></div>],

  ['IntakeVideo — the video URL',
    <div className="anl-panel"><label className="anl-field-row">
      <input className="field field--page anl-field" placeholder="https://youtu.be/" />
    </label></div>],

  ['IntakeVideo — the window fields, on the page under Section',
    <div className="anl-panel"><div className="anl-window">
      <div className="anl-window__field"><input className="field field--page anl-field" placeholder="0:00" /></div>
    </div></div>],

  ['IntakeVideo — the window fields in a phone\'s sheet (plan 136)',
    <div className="sheet anl-sheet"><div className="anl-panel"><div className="anl-window">
      <div className="anl-window__field"><input className="field field--page anl-field" placeholder="0:00" /></div>
    </div></div></div>],

  ['IntakeVideo — the video URL in a phone\'s sheet (plan 136), a raised ground',
    <div className="sheet anl-sheet"><div className="anl-panel"><label className="anl-field-row">
      <input className="field field--page anl-field" placeholder="https://youtu.be/" />
    </label></div></div>],

  ['WritingSlip — .textarea, which draws its own edge instead',
    <div className="anl-panel"><div className="anl-slip">
      <textarea className="textarea anl-slip__field" placeholder="paste Japanese" />
    </div></div>],

  ['NameStep — .brd-field, which draws its own edge instead',
    <div className="brd__stage"><input className="brd-field brd-field--empty" placeholder="name" /></div>],
]

describe('every field is visible on the ground it is mounted on', () => {
  it.each(CASES)('%s', async (label, markup) => {
    const screen = await render(markup)
    expectVisibleWell(wellOf(screen.container), label)
  })
})
