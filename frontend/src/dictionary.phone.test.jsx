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
  it('the door is a row target and the catalogue is two columns of centred cards with the level in its corner and the stage on the edge', async () => {
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
          {[['駅', 'mastered'], ['電車', 'learning'], ['テープレコーダー', 'new'], ['エアコンディショナー', 'learning']].map(([c, stage]) => (
            <button
              key={c}
              type="button"
              className={`dict-entry-card dict-entry-card--${stage}`}
              style={{ '--level-color': 'var(--line-kanji)', '--len': [...c].length }}
            >
              <span className="dict-level-badge">N5</span>
              <span className="sr-only">{stage}</span>
              <span className="dict-entry-card__char">
                <ruby>{c}<rt>えき</rt></ruby>
              </span>
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
    // The level sits in the top-left corner and the glyph under it.
    // Nothing sits in the other one: the stage word printed there was a
    // two-word phrase in the caption's tracking, it ran nearly the full
    // width of a 168px tile, and it changed length card by card — so
    // the stage moved onto the card's own bottom edge (owner's ruling,
    // from six rendered directions).
    const cr = card.getBoundingClientRect()
    const level = card.querySelector('.dict-level-badge').getBoundingClientRect()
    expect(card.querySelector('.stage-mark')).toBeNull()
    expect(level.left - cr.left).toBeLessThan(cr.width / 2)
    expect(level.top - cr.top).toBeLessThan(20)
    const char = card.querySelector('.dict-entry-card__char').getBoundingClientRect()
    expect(char.top).toBeGreaterThan(level.top)
    // Every register of the card stands on the card's own axis, with
    // nothing in the corner to push it off.
    const mid = r => (r.left + r.right) / 2
    for (const sel of ['.dict-entry-card__char', '.dict-entry-card__meaning']) {
      expect(mid(card.querySelector(sel).getBoundingClientRect())).toBeCloseTo(mid(cr), 0)
    }

    // ── The headword is fitted to the tile it stands on ──
    // The specimen rung is 72px, and at 72px a 168px tile takes two
    // characters to a line: テープレコーダー printed one character per
    // line over four of them and grew its row to 390px. The word
    // divides the tile's width by its own length now, floors and
    // ceilings on the scale, and the box it stands in is the same on
    // every tile.
    const chars = cards.map(el => el.querySelector('.dict-entry-card__char'))
    const size = el => parseFloat(getComputedStyle(el).fontSize)
    const rung = value => {
      const probe = document.createElement('div')
      probe.style.fontSize = value
      document.body.append(probe)
      const px = parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()
      return px
    }
    // A word short enough for the tile is the specimen it always was —
    // 駅 and 電車 both sit at the ceiling — and past that each longer
    // headword is set smaller than the one before it.
    expect(size(chars[0])).toBe(rung('var(--fs-specimen-word)'))
    expect(size(chars[1])).toBe(rung('var(--fs-specimen-word)'))
    expect(size(chars[2])).toBeLessThan(size(chars[1]))
    expect(size(chars[3])).toBeLessThan(size(chars[2]))
    expect(size(chars[3])).toBeGreaterThanOrEqual(rung('var(--fs-caption)'))
    for (const char of chars) {
      // One line, and it fits on it: nothing wraps, and the word is
      // whole — no ellipsis at any of these lengths.
      expect(getComputedStyle(char).whiteSpace).toBe('nowrap')
      expect(char.scrollWidth).toBeLessThanOrEqual(char.clientWidth + 1)
      // The box is the same on every tile, whatever it holds.
      expect(char.getBoundingClientRect().height).toBeCloseTo(chars[0].getBoundingClientRect().height, 0)
    }
    // And the wall is even: one box on every tile, so the meaning under
    // it prints at the same y whatever the word above it is.
    for (const box of cards.map(el => el.getBoundingClientRect())) {
      expect(box.height).toBeCloseTo(cards[0].getBoundingClientRect().height, 0)
    }
    const meanings = cards.map(el => el.querySelector('.dict-entry-card__meaning').getBoundingClientRect())
    expect(meanings[1].top - cards[1].getBoundingClientRect().top)
      .toBeCloseTo(meanings[2].top - cards[2].getBoundingClientRect().top, 0)

    // ── The furigana stands off the character ──
    // An annotation sits on the line above its base, so the room for a
    // gap is inside that line: the reading is set in a line box of its
    // own height and rides at the top of it. And it is CENTRED over the
    // base rather than spread across it — the browser's default put
    // やま over 山 as や    ま, the kanji's own width apart, which reads
    // as two marks instead of one word.
    const rt = card.querySelector('rt')
    expect(getComputedStyle(card.querySelector('ruby')).rubyAlign).toBe('center')
    const rtSize = parseFloat(getComputedStyle(rt).fontSize)
    expect(parseFloat(getComputedStyle(rt).lineHeight)).toBeGreaterThan(rtSize * 2)
    // The gap is real: the reading's own box ends well clear of the
    // character under it.
    expect(rt.getBoundingClientRect().bottom)
      .toBeLessThan(card.querySelector('.dict-entry-card__char').getBoundingClientRect().bottom - rtSize)

    // The edge says where the card is: the state's own ink, and the
    // card's plain hairline where the schedule has never seen it.
    const ink = value => {
      const probe = document.createElement('div')
      probe.style.background = value
      document.body.append(probe)
      const colour = getComputedStyle(probe).backgroundColor
      probe.remove()
      return colour
    }
    const edge = el => getComputedStyle(el, '::after').backgroundColor
    expect(edge(cards[0])).toBe(ink('var(--state-mastered)'))
    expect(edge(cards[1])).toBe(ink('var(--state-learning)'))
    expect(edge(cards[2])).toBe(ink('var(--surface-line)'))
    expect(edge(cards[0])).not.toBe(edge(cards[1]))
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

  // The transport bar carries five things now -- play, the scrubber,
  // the clock, the sound and 追従 -- and a phone has room for about
  // three. It takes a second line rather than giving the scrubber's
  // width away: a track free to shrink to nothing never wraps, it just
  // becomes ungrabbable, and a learner watching a video with their
  // thumb on the edge of the screen has nothing left to seek with.
  it('the player: the transport wraps rather than crushing its scrubber, and nothing runs off the edge', async () => {
    const screen = await render(
      <main className="dictionary analyzer">
        <div className="anl-player">
          <div className="anl-player__bar">
            <button type="button" className="anl-player__btn">▶</button>
            <div className="anl-player__track"><span className="anl-player__fill" style={{ width: '30%' }} /></div>
            <span className="anl-player__time">0:12 / 1:30</span>
            <div className="anl-player__vol">
              <button type="button" className="anl-player__btn">S</button>
              <input type="range" className="dial anl-player__dial" min={0} max={100} defaultValue={70} readOnly />
            </div>
            <button type="button" className="anl-follow anl-follow--on">
              <span className="anl-follow__label">Follow the video</span>
            </button>
          </div>
        </div>
      </main>
    )
    const bar = screen.container.querySelector('.anl-player__bar')
    const track = screen.container.querySelector('.anl-player__track')
    const play = screen.container.querySelector('.anl-player__btn')
    const follow = screen.container.querySelector('.anl-follow')
    const barBox = bar.getBoundingClientRect()

    // Two rows, not one crushed one.
    expect(getComputedStyle(bar).flexWrap).toBe('wrap')
    expect(follow.getBoundingClientRect().top).toBeGreaterThan(play.getBoundingClientRect().top)

    // Still grabbable, and still inside the panel.
    expect(track.getBoundingClientRect().width).toBeGreaterThanOrEqual(96)
    for (const el of bar.children) {
      const r = el.getBoundingClientRect()
      expect(r.right, el.className).toBeLessThanOrEqual(barBox.right + 0.5)
      expect(r.left, el.className).toBeGreaterThanOrEqual(barBox.left - 0.5)
    }

    // The mute and its dial travel together: a wrap must never leave the
    // speaker on one line and the slider on the next.
    const vol = screen.container.querySelector('.anl-player__vol')
    const mute = vol.querySelector('.anl-player__btn')
    const dial = vol.querySelector('.anl-player__dial')
    // Centres, not tops: the 18px dial and the 34px button share a row
    // by sharing its middle.
    const middle = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }
    expect(middle(dial)).toBeCloseTo(middle(mute), 0)
  })
})
