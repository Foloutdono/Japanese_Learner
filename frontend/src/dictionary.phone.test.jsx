import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Stylesheet contracts for the dictionary and the analyzer at 390px
// (plan 073), on fixture markup — the same trick as practice.phone.test.jsx.
// The objects the canvas draws for Dictionary, DictionaryEntry,
// DictionaryReadings, AnalyzerResult and DeckPickerSheet, pinned by
// their real classes.
import './index.css'

// Resolve a token the way the page does, so an assertion holds in
// both themes and at any root size.
function resolver() {
  const probe = document.createElement('div')
  document.body.appendChild(probe)
  return (prop, value) => {
    probe.style[prop] = value
    return getComputedStyle(probe)[prop]
  }
}

describe('the dictionary at phone width', () => {
  it('the door is a row target and the catalogue is two columns of centred cards with the level and the stage in the corners', async () => {
    const screen = await render(
      <main className="dictionary" style={{ '--line-color': 'var(--line-jisho)' }}>
        <button type="button" className="anl-door">
          <span className="wmap-roundel anl-door__roundel">KS</span>
          <span className="anl-door__names">
            <span className="anl-door__title">Analyzer</span>
            <span className="anl-door__desc">Text, a photo or a video — a description long enough to run past the row at phone width</span>
          </span>
          <span className="anl-door__intakes">
            <span className="anl-door__intake">T</span>
            <span className="anl-door__intake">C</span>
            <span className="anl-door__intake">V</span>
          </span>
        </button>
        <div className="dict-grid">
          {['駅', '電車', '発', '車'].map(c => (
            <button key={c} type="button" className="dict-entry-card" style={{ '--level-color': 'var(--line-kanji)' }}>
              <span className="dict-level-badge">N5</span>
              <span className="stage-mark stage-mark--mastered">Mastered</span>
              <span className="dict-entry-card__kana">えき</span>
              <span className="dict-entry-card__char">{c}</span>
              <span className="dict-entry-card__meaning">station</span>
            </button>
          ))}
        </div>
      </main>
    )
    const door = screen.container.querySelector('.anl-door')
    expect(door.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // The description ellipsises instead of wrapping the row.
    const desc = door.querySelector('.anl-door__desc')
    expect(getComputedStyle(desc).textOverflow).toBe('ellipsis')
    expect(desc.getBoundingClientRect().height).toBeLessThan(2 * parseFloat(getComputedStyle(desc).fontSize) * 1.4)
    // The three intakes are the same round badge.
    for (const intake of door.querySelectorAll('.anl-door__intake')) {
      const r = intake.getBoundingClientRect()
      expect(r.width).toBe(36)
      expect(r.height).toBe(36)
      expect(getComputedStyle(intake).borderTopLeftRadius).toBe('999px')
    }

    const grid = screen.container.querySelector('.dict-grid')
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(2)
    const cards = [...grid.querySelectorAll('.dict-entry-card')]
    expect(cards[0].getBoundingClientRect().top).toBe(cards[1].getBoundingClientRect().top)
    expect(cards[2].getBoundingClientRect().top).toBeGreaterThanOrEqual(cards[0].getBoundingClientRect().bottom)
    const card = cards[0]
    expect(getComputedStyle(card).textAlign).toBe('center')
    // The level sits in the top-left corner, the stage in the top-right,
    // and the glyph under both.
    const cr = card.getBoundingClientRect()
    const level = card.querySelector('.dict-level-badge').getBoundingClientRect()
    const mark = card.querySelector('.stage-mark').getBoundingClientRect()
    expect(level.left - cr.left).toBeLessThan(cr.width / 2)
    expect(cr.right - mark.right).toBeLessThan(cr.width / 2)
    expect(level.top - cr.top).toBeLessThan(20)
    expect(mark.top - cr.top).toBeLessThan(20)
    const char = card.querySelector('.dict-entry-card__char').getBoundingClientRect()
    expect(char.top).toBeGreaterThan(level.top)
    expect(char.top).toBeGreaterThan(mark.top)
  })

  it('the plate: the marks row is a target, the glyph is a specimen, the stripe bleeds to the edges; the blocks divide by hairlines, the word rows are targets, the records a lattice', async () => {
    const screen = await render(
      <article className="dict-entry">
        <header className="dict-plate">
          <div className="dict-plate__row">
            <div className="dict-plate__marks">
              <button type="button" className="stage__leave">‹ Dictionary</button>
              <span className="dict-plate__level">N5</span>
            </div>
            <div className="dict-plate__actions"><button type="button" className="dict-plate__btn">♪</button></div>
          </div>
          <div className="dict-plate__stack">
            <span className="dict-plate__reading">エキ</span>
            <h1 className="dict-plate__word dict-plate__word--glyph">駅</h1>
            <div className="dict-plate__readings">
              <span className="dict-plate__yomi"><span className="dict-kind">音</span><span>エキ</span></span>
              <button type="button" className="dict-plate__more">+3</button>
            </div>
            <span className="dict-plate__caption">station</span>
          </div>
          <div className="dict-plate__stripe" />
        </header>
        <div className="dict-entry__body">
          <section className="dict-block">
            <ol className="dict-senses">
              <li className="dict-sense"><span className="dict-sense__n">1</span><div className="dict-sense__body"><span className="dict-sense__gloss">station</span></div></li>
            </ol>
          </section>
          <section className="dict-block">
            <div className="dict-words">
              <button type="button" className="dict-word"><span className="dict-word__jp">駅員</span><span className="dict-word__gloss">station staff</span></button>
              <button type="button" className="dict-word"><span className="dict-word__jp">駅前</span><span className="dict-word__gloss">in front of the station</span></button>
            </div>
          </section>
          <section className="dict-block">
            <div className="records">
              <div className="record"><span className="record__value">92%</span><span className="record__label">accuracy</span></div>
              <div className="record"><span className="record__value">14</span><span className="record__label">reviews</span></div>
            </div>
          </section>
        </div>
      </article>
    )
    const resolve = resolver()
    const plate = screen.container.querySelector('.dict-plate')
    expect(plate.querySelector('.dict-plate__row').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    const word = plate.querySelector('.dict-plate__word')
    expect(getComputedStyle(word).fontSize).toBe(resolve('fontSize', 'var(--fs-specimen-word)'))
    expect(getComputedStyle(plate.querySelector('.dict-plate__more')).borderTopLeftRadius).toBe('999px')
    const stripe = plate.querySelector('.dict-plate__stripe')
    expect(getComputedStyle(stripe).height).toBe('3px')
    // main's plate (the 2026-09 dictionary-detail redesign, merged into
    // this wave) keeps the stripe inside the plate's own padding: it
    // spans the content box, edge to edge of what the plate prints.
    const ps = getComputedStyle(plate)
    const content = plate.getBoundingClientRect().width - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
    expect(stripe.getBoundingClientRect().width).toBeCloseTo(content, 0)

    const blocks = screen.container.querySelectorAll('.dict-block')
    expect(getComputedStyle(blocks[0]).borderTopWidth).toBe('0px')
    expect(getComputedStyle(blocks[1]).borderTopWidth).toBe('1px')
    expect(getComputedStyle(blocks[2]).borderTopWidth).toBe('1px')
    const words = screen.container.querySelectorAll('.dict-word')
    for (const w of words) expect(w.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(getComputedStyle(words[0]).borderTopWidth).toBe('0px')
    expect(getComputedStyle(words[1]).borderTopWidth).toBe('1px')
    expect(getComputedStyle(words[0].querySelector('.dict-word__gloss')).whiteSpace).toBe('nowrap')
    const records = screen.container.querySelector('.records')
    expect(getComputedStyle(records).gridTemplateColumns.split(' ').length).toBe(2)
    expect(getComputedStyle(records).columnGap).toBe('1px')
  })
})

describe('the analyzer at phone width', () => {
  it('the line: a 2px rule per state, dashed for a word without a card, none for a particle; the dial governs the furigana; the stepper and the squares are targets', async () => {
    const screen = await render(
      <main className="dictionary analyzer">
        <div className="anl-stage" data-furigana="all">
          <div className="anl-stepper">
            <button type="button" className="anl-stepper__btn">‹</button>
            <span className="anl-stops"><i className="anl-stops__dot anl-stops__dot--on" /><i className="anl-stops__dot" /></span>
            <span className="anl-stepper__count">1 / 2</span>
            <button type="button" className="anl-stepper__btn">›</button>
          </div>
          <div className="anl-stagebd">
            <div className="tok-line">
              <button type="button" className="tok tok--mastered tok--on"><span className="tok__furi">でんしゃ</span><span className="tok__word">電車</span></button>
              <button type="button" className="tok tok--particle"><span className="tok__furi" /><span className="tok__word">は</span></button>
              <button type="button" className="tok tok--learning"><span className="tok__furi">さんばんせん</span><span className="tok__word">三番線</span></button>
              <button type="button" className="tok tok--unknown"><span className="tok__furi">はっしゃ</span><span className="tok__word">発車</span></button>
              <button type="button" className="tok tok--offdeck"><span className="tok__furi">たろう</span><span className="tok__word">太郎</span></button>
            </div>
            <div className="token-card">
              <div className="token-card__foot">
                <span className="token-card__kanji">
                  <button type="button" className="token-card__k">発</button>
                  <button type="button" className="token-card__k">車</button>
                </span>
                <button type="button" className="btn-primary">Add to deck</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
    const resolve = resolver()
    const [mastered, particle, learning, unknown, offdeck] = screen.container.querySelectorAll('.tok')
    const rule = tok => {
      const cs = getComputedStyle(tok)
      return [cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor]
    }
    expect(rule(mastered)).toEqual(['2px', 'solid', resolve('color', 'var(--state-mastered)')])
    expect(rule(learning)).toEqual(['2px', 'solid', resolve('color', 'var(--state-learning)')])
    expect(rule(unknown)).toEqual(['2px', 'solid', resolve('color', 'var(--state-new)')])
    expect(rule(offdeck)[1]).toBe('dashed')
    expect(rule(particle)[2]).toBe('rgba(0, 0, 0, 0)')
    // The tint marks the focused token; nothing else changes on it.
    expect(getComputedStyle(mastered).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(mastered).fontWeight).toBe(getComputedStyle(learning).fontWeight)
    // The empty reading slot keeps the particle on the line's baseline.
    expect(particle.getBoundingClientRect().bottom).toBeCloseTo(mastered.getBoundingClientRect().bottom, 0)

    const stage = screen.container.querySelector('.anl-stage')
    const furi = tok => getComputedStyle(tok.querySelector('.tok__furi')).visibility
    expect(furi(mastered)).toBe('visible')
    stage.setAttribute('data-furigana', 'unknown')
    expect(furi(mastered), 'Unknown bares the mastered word').toBe('hidden')
    expect(furi(learning), 'Unknown keeps a learning word\'s reading').toBe('visible')
    expect(furi(unknown)).toBe('visible')
    stage.setAttribute('data-furigana', 'none')
    expect(furi(learning)).toBe('hidden')
    expect(furi(unknown)).toBe('hidden')

    for (const b of screen.container.querySelectorAll('.anl-stepper__btn')) {
      const r = b.getBoundingClientRect()
      expect(r.width).toBe(44)
      expect(r.height).toBe(44)
      expect(getComputedStyle(b).borderTopLeftRadius).toBe('999px')
    }
    const dots = screen.container.querySelectorAll('.anl-stops__dot')
    for (const d of dots) expect(d.getBoundingClientRect().width).toBe(8)
    expect(getComputedStyle(dots[0]).backgroundColor).not.toBe(getComputedStyle(dots[1]).backgroundColor)

    for (const k of screen.container.querySelectorAll('.token-card__k')) {
      const r = k.getBoundingClientRect()
      expect(r.width).toBe(30)
      expect(r.height).toBe(30)
    }
    const action = screen.container.querySelector('.token-card__foot .btn-primary')
    expect(getComputedStyle(action).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(action).color).toBe(resolve('color', 'var(--text-on-panel)'))
    expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })

  it('the sheets: the deck picker rows and the reading chips are targets divided by hairlines', async () => {
    const screen = await render(
      <div>
        <div className="surface picker">
          <button type="button" className="picker-row picker-row--current">
            <span className="wmap-roundel picker-row__roundel">単</span>
            <span className="picker-row__name">N5 words</span>
            <span className="picker-row__count">12 cards</span>
          </button>
          <button type="button" className="picker-row">
            <span className="wmap-roundel picker-row__roundel">漢</span>
            <span className="picker-row__name">Kanji</span>
            <span className="picker-row__count">3 cards</span>
          </button>
          <button type="button" className="picker-row picker-row--new">
            <span className="picker-row__name picker-row__name--latin">New deck</span>
          </button>
        </div>
        <div className="dict-readings">
          <div className="dict-register">
            <span className="cap">On</span>
            <ul className="dict-register__rest">
              <li className="dict-register__chip">サン</li>
              <li className="dict-register__chip">ザン</li>
            </ul>
          </div>
        </div>
      </div>
    )
    const rows = screen.container.querySelectorAll('.picker-row')
    for (const row of rows) expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(getComputedStyle(rows[0]).borderTopWidth).toBe('0px')
    expect(getComputedStyle(rows[1]).borderTopWidth).toBe('1px')
    expect(getComputedStyle(rows[2]).borderTopWidth).toBe('1px')
    // The register's chips are quiet pills, not targets (nothing opens
    // from one): the --sp-6 floor of main's rule, in a pill.
    const resolve = resolver()
    for (const chip of screen.container.querySelectorAll('.dict-register__chip')) {
      expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(parseFloat(resolve('minHeight', 'var(--sp-6)')))
      expect(getComputedStyle(chip).borderTopLeftRadius).toBe('999px')
    }
  })
})
