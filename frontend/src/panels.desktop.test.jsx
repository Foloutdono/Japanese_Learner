import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — 三面, the run on three panels (plan 126) ─────────────────────
// A card run on the desk stands on three columns of surface panels: at
// the left this run (the figures, the level bar as a row, the deck's
// legend, the remaining count) over the card panel (the card's state,
// the verdicts as tiles, each a figure of when the card comes back, the
// keys, the rhythm); the card in the middle with its tiles framed under
// it, unlit before the reveal; the card's details at the right, sealed
// before the reveal and the entry in its band after, scrolling rather
// than shrinking the stroke sheet. The columns share the width 28 | 42
// | 30. The elements print no key caps but the flashcard's hint. A run
// without records keeps the side alone. The phone's side is
// deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(), playArrival: vi.fn(),
}))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { CardPanel } = await import('./components/study/CardPanel')
const { Flashcard, MCQGrid, MeaningDisplay, CharDisplay } = await import('./components/study/QuizComponents')
const { CardTransition } = await import('./components/study/CardTransition')
const { default: PromptCard } = await import('./components/study/PromptCard')
const { default: RatingBar } = await import('./components/study/RatingBar')
const { default: HintBar } = await import('./components/study/HintBar')
const { DrawingQuiz } = await import('./components/study/DrawingCanvas')
const { default: ReadingsInput } = await import('./components/study/ReadingsInput')
const { startTally, countReview } = await import('./stores/runTally')
const { seedSummary } = await import('./stores/profileSummary')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const rect = s => $(s).getBoundingClientRect()
// A token expression as Chromium computes it, so a size is compared with
// the scale and never a hand-copied constant.
function probe(prop, expr) {
  const el = document.createElement('div')
  el.style[prop] = expr
  document.body.appendChild(el)
  const v = getComputedStyle(el)[prop]
  el.remove()
  return v
}
const CHOICES = ['gare', 'électricité', 'voiture', 'montagne']
const DAY = 86400

// A learning card as a run serves it: its stage, and per rating when
// the scheduler would bring it back (srs.py's preview_reviews_bulk).
const CARD = {
  card_id: 'kanji_N5_山', stage: 'learning', progress: 0.25,
  review_preview: {
    0: { due_in: 180 }, 1: { due_in: 180 }, 2: { due_in: 600 },
    3: { due_in: 3 * DAY }, 4: { due_in: 21 * DAY }, 5: { due_in: 40 * DAY },
  },
}
const PROGRESS = { total: 24, new: 20, learning: 3, mastered: 1 }

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const q = new URLSearchParams(String(url).split('?')[1]).get('q')
    return { ok: true, status: 200, json: async () => ({ results: [{ type: 'kanji', kanji: q, kana: 'x', meaning: `meaning of ${q}`, level: 'N5' }] }) }
  })
  seedSummary({ username: 'Aiko', level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500 })
  startTally('kanji:N5:f2b')
})

function Stage({ records = true, side = <SessionPanel />, done = false, panel = <CardPanel card={CARD} remaining={19} />, remaining = 19, children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage
          where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false}
          records={records} done={done} side={side} sideLabel="La fiche"
          panel={panel} progress={PROGRESS} remaining={remaining}
        >
          {children}
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}
// A box at a given width for the run to lay itself out in: the grid's
// columns and its centring answer to the box, while the lane's window
// (and so the desk's line, and every other file in the lane) stays put.
function Frame({ width, children }) {
  return <div data-frame="" style={{ width: `${width}px` }}>{children}</div>
}
function Card() {
  return (
    <CardTransition className="specimen-card-stage" cardKey="k">
      <PromptCard foot={<span>N5</span>}><span className="probe-kanji">駅</span></PromptCard>
    </CardTransition>
  )
}
// A card that docks its entry on reveal (Space), as the runs' cards do.
// A card that docks its entry on reveal (Space), on its card as the runs
// stage it.
function Revealing({ card = 'yama' }) {
  return (
    <CardTransition className="specimen-card-stage" cardKey={card}>
      <PromptCard foot={<span>N5</span>}>
        <Flashcard
          t={{ keySpace: 'Espace', revealByKey: 'pour révéler', tapToReveal: 'Touche' }}
          resetKey={card}
          front={<span className="probe-front">山</span>}
          back={<span className="probe-back">mountain</span>}
          dictTerm="山"
          dictCategory="kanji"
          session={{ access_token: 't' }}
        />
      </PromptCard>
    </CardTransition>
  )
}

describe('the three columns', () => {
  it('stands this run, the card and its details side by side, centred, on the window', async () => {
    await render(<Stage><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle(400)
    expect($('.screen').classList.contains('desk-run--panels')).toBe(true)
    const left = rect('.desk-run__left')
    const stage = rect('.stage')
    const side = rect('.desk-run__side')
    expect(left.right).toBeLessThanOrEqual(stage.left)
    expect(stage.right).toBeLessThanOrEqual(side.left)
    expect(left.width).toBeGreaterThanOrEqual(300)
    expect(side.width).toBeGreaterThanOrEqual(300)
    expect(stage.width).toBeGreaterThanOrEqual(300)
    expect(stage.width).toBeLessThanOrEqual(640)
    expect(side.right).toBeLessThanOrEqual(window.innerWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // The columns share the window's height; the side is static, not fixed.
    expect(getComputedStyle($('.desk-run__side')).position).toBe('static')
    // No level strip on the floor: the level bar is a row of the session panel.
    expect($('.screen > .lvlbar')).toBeNull()
    expect($('.desk-session .lvlbar__track').getAttribute('role')).toBe('progressbar')
  })

  it('shares the width 28 | 42 | 30 on the owner\'s window, and stands centred past it', async () => {
    // The run laid out in a box at the owner's width rather than a
    // resized window: the lane's files share one browser, and a resize
    // reaches the others running beside this one.
    await render(<Frame width={1877}><Stage><Card /><RatingBar active onRate={() => {}} /></Stage></Frame>)
    await settle(400)
    const widths = ['.desk-run__left', '.stage', '.desk-run__side'].map(s => rect(s).width)
    const sum = widths.reduce((a, b) => a + b, 0)
    expect(widths.map(w => Math.round((100 * w) / sum))).toEqual([28, 42, 30])
    // Past --desk-run-w the three keep their widths, centred.
    $('[data-frame]').style.width = '2400px'
    await settle(100)
    const wide = ['.desk-run__left', '.stage', '.desk-run__side'].map(s => rect(s).width)
    wide.forEach((w, i) => expect(w).toBeCloseTo(widths[i], 0))
    const screen = rect('.screen')
    expect(screen.width).toBeCloseTo(2400, 0)
    expect(Math.abs((rect('.desk-run__left').left - screen.left) - (screen.right - rect('.desk-run__side').right))).toBeLessThan(2)
  })

  it('heads the left column with this run: the figures, the count among them, the level and the legend', async () => {
    await render(<Stage><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle()
    const panel = $('.desk-run__left > .desk-session')
    expect($$('.desk-session .desk-figs .desk-fig__value').map(el => el.textContent)).toEqual(['0', '—', '+0XP', '19'])
    expect($$('.desk-session .desk-figs .desk-fig__label').map(el => el.textContent)).toEqual(['Révisions', 'Précision', 'Gagnés', 'Restantes'])
    // No caption on the panel.
    expect(panel.querySelector('.desk-panel__cap')).toBeNull()
    expect(panel.querySelector('.deck-progress__legend').textContent).toContain('20')
    // The legend left the hairline in the stage, and the count the head.
    expect($('.stage__head .today-remaining')).toBeNull()
    countReview({ quality: 4, xp: 12, entry: { term: '駅', category: 'kanji', session: {} } })
    await settle()
    expect($$('.desk-session .desk-figs .desk-fig__value').map(el => el.textContent)).toEqual(['1', '100%', '+12XP', '19'])
  })

  it('stands its figures bare where the column is too narrow for their labels, and labels them where it is not', async () => {
    const labels = () => $$('.desk-session .desk-figs .desk-fig__label')
    const clear = () => {
      const boxes = $$('.desk-session .desk-figs .desk-fig__value').map(el => el.getBoundingClientRect())
      return boxes.every((b, i) => i === 0 || b.left >= boxes[i - 1].right)
    }
    // A laptop: the left column at its 300px, four labels in caps.
    await render(<Frame width={1100}><Stage><Card /><RatingBar active onRate={() => {}} /></Stage></Frame>)
    await settle(300)
    expect(rect('.desk-run__left').width).toBeCloseTo(300, 0)
    expect(labels().every(l => l.classList.contains('sr-only')), 'bare on a laptop').toBe(true)
    // Still named for a screen reader, and the figures clear of each other.
    expect(labels().map(l => l.textContent)).toEqual(['Révisions', 'Précision', 'Gagnés', 'Restantes'])
    expect(clear()).toBe(true)
    // The owner's width has the room: the labels come back, whole.
    $('[data-frame]').style.width = '1877px'
    await settle(300)
    expect(labels().some(l => l.classList.contains('sr-only')), 'labelled on a wide window').toBe(false)
    expect(labels().every(l => l.scrollWidth <= l.clientWidth + 1)).toBe(true)
    expect(clear()).toBe(true)
  })
})

describe('the card panel', () => {
  it('prints the card\'s state, and each verdict as a tile: when, large, its word and its digit', async () => {
    await render(<Stage><Card /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    const panel = $('.desk-run__left > .desk-card')
    // No caption, no aside, nothing under an interval (the owner's cut).
    expect(panel.querySelector('.desk-panel__cap')).toBeNull()
    expect(panel.querySelector('.desk-verdict__lands')).toBeNull()
    expect(panel.querySelector('.desk-rhythm__cap')).toBeNull()
    const labels = $$('.desk-stops__labels > span')
    expect(labels).toHaveLength(3)
    expect(labels[1].classList.contains('desk-stops__here')).toBe(true)
    // The fare strip (plan 147): the stretch behind the card full, the
    // one it is in filled to its progress, the one ahead empty -- each
    // stretch on its label's column.
    const legs = $$('.desk-stops__leg')
    expect(legs).toHaveLength(3)
    const fill = leg => leg.querySelector('.desk-stops__fill').getBoundingClientRect().width / leg.getBoundingClientRect().width
    expect(legs.map(fill).map(f => Math.round(f * 100) / 100)).toEqual([1, 0.25, 0])
    legs.forEach((leg, i) => {
      const a = leg.getBoundingClientRect(), b = labels[i].getBoundingClientRect()
      expect(Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2)).toBeLessThan(1)
    })
    expect($('.desk-stops').getAttribute('aria-label')).toContain('25 %')
    // Four verdicts, worst to best as the bar draws them, each with its digit.
    const tiles = $$('.desk-verdict')
    expect(tiles).toHaveLength(4)
    expect(tiles.map(t => t.querySelector('.desk-kbd').textContent)).toEqual(['4', '3', '2', '1'])
    // The four-button bar's best is quality 4 (domain/ratingScales).
    // Each tile is a figure: the wait as a numeral and its unit over the
    // verdict's word, and in words to a screen reader.
    expect(tiles.map(t => t.querySelector('.desk-verdict__value').textContent)).toEqual(['3', '10', '3', '3'])
    expect(tiles.map(t => t.querySelector('.desk-verdict__unit').textContent)).toEqual(['min', 'min', 'jours', 'sem.'])
    expect(tiles.map(t => t.querySelector('.desk-verdict__word').textContent)).toEqual(['Raté', 'Presque', 'Difficile', 'Correct'])
    expect(tiles.map(t => t.querySelector('.sr-only').textContent)).toEqual(['dans 3 min', 'dans 10 min', 'dans 3 j', 'dans 3 sem.'])
    const value = tiles[0].querySelector('.desk-verdict__value')
    expect(getComputedStyle(value).fontSize).toBe(probe('fontSize', 'var(--fs-display)'))
    // The numeral is the tile's largest thing, its word beneath it.
    const word = tiles[0].querySelector('.desk-verdict__word').getBoundingClientRect()
    expect(word.top).toBeGreaterThanOrEqual(value.getBoundingClientRect().bottom)
    // The keys the elements no longer print, and the rhythm on its foot.
    expect($$('.desk-keys .desk-kbd').map(el => el.textContent)).toEqual(expect.arrayContaining(['C']))
    expect($$('.desk-keys__item')).toHaveLength(3)
    expect($$('.desk-rhythm .desk-fig__value').map(el => el.textContent)).toEqual(['0min', '—', '—'])
    // The panel fills the column to its floor.
    expect(Math.abs(rect('.desk-card').bottom - rect('.desk-run__left').bottom)).toBeLessThan(2)
  })
})

describe('the elements print no key caps', () => {
  it('leaves the head, the hint switch and the tiles bare, and the card its hint', async () => {
    await render(
      <Stage>
        <HintBar available={['indice_1']} active={[]} onToggle={() => {}} />
        <Revealing />
        <RatingBar active onRate={() => {}} />
      </Stage>
    )
    await settle()
    expect($('.stage__leave .desk-kbd')).toBeNull()
    expect($('.stage__leave').getAttribute('aria-keyshortcuts')).toBeNull()
    expect($('.study-assist__toggle .desk-kbd')).toBeNull()
    expect($('.study-assist__toggle').getAttribute('aria-keyshortcuts')).toBe('C')
    // The card says how it turns, as it does on every desk (owner's call).
    expect($('.flashcard__hint .desk-kbd').textContent).toBe('Espace')
    expect($('.flashcard__hint').textContent).toBe('Espace pour révéler')
    expect($('.rating-bar .desk-kbd')).toBeNull()
    expect($$('.rating-bar__btn').map(b => b.getAttribute('aria-keyshortcuts'))).toEqual(['4', '3', '2', '1'])
  })
})

describe('the tiles under the card', () => {
  it('stand framed, unlit and inert before the reveal, and lit after it', async () => {
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle(400)
    const bar = $('.rating-bar')
    expect(bar.classList.contains('rating-bar--unlit')).toBe(true)
    expect(getComputedStyle(bar).visibility).toBe('visible')
    expect(getComputedStyle(bar).position).toBe('static')
    expect(getComputedStyle(bar).borderTopWidth).toBe('1px')
    expect($$('.rating-bar__btn').every(b => b.disabled)).toBe(true)
    expect(parseFloat(getComputedStyle($('.rating-bar__btn--best')).opacity)).toBeLessThan(0.5)
    // The row stands under the card, inside the stage's column.
    expect(rect('.rating-bar').top).toBeGreaterThanOrEqual(rect('.prompt-card').bottom)
    expect(rect('.rating-bar').bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  // The owner's report: on a wide window the middle column is wider
  // than a card, and the tiles' frame stood at the column's width, 41px
  // past the card on each side -- and with the choices or a board open,
  // the head and the choices with it. Every row stands at the card's.
  it.each([
    ['a card', null],
    ['choices', <MCQGrid key="m" choices={CHOICES} correct="gare" selected={null} answered={false} onAnswer={() => {}} />],
    ['a writing board', <DrawingQuiz key="d" kanji="急" resetKey="k" onValidate={() => {}} />],
  ])('stand at the card\'s width under %s, the head over it at the same', async (_, beside) => {
    for (const width of [1877, 1100]) {
      const screen = await render(
        <Frame width={width}><Stage><Card />{beside}<RatingBar active onRate={() => {}} /></Stage></Frame>
      )
      await settle(400)
      const card = rect('.quiz-card-stage .prompt-card')
      if (width === 1877) expect(rect('.stage').width, 'the column is wider than a card').toBeGreaterThan(card.width + 40)
      for (const row of ['.rating-bar', '.stage__head', ...(beside ? ['.stage > .mcq-list, .stage > .drawing-quiz'] : [])]) {
        expect(rect(row).left, `${row} at ${width}`).toBeCloseTo(card.left, 0)
        expect(rect(row).right, `${row} at ${width}`).toBeCloseTo(card.right, 0)
      }
      await screen.unmount()
    }
  })

  it('light up on the reveal, the best one gold', async () => {
    await render(<Stage><Revealing /><RatingBar active onRate={() => {}} /></Stage>)
    await settle()
    expect($('.rating-bar').classList.contains('rating-bar--unlit')).toBe(false)
    expect($$('.rating-bar__btn').some(b => b.disabled)).toBe(false)
    expect(getComputedStyle($('.rating-bar__btn--best')).opacity).toBe('1')
  })
})

describe('the card\'s details', () => {
  it('are sealed before the reveal and open in their band after it', async () => {
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    const sealed = $('.desk-run__side > .desk-sealed')
    expect(sealed).not.toBeNull()
    expect(sealed.textContent).toBe('?')
    expect($('.desk-entry')).toBeNull()
    expect(Math.abs(rect('.desk-sealed').bottom - rect('.desk-run__side').bottom)).toBeLessThan(2)
    press(' ')
    await settle(400)
    expect($('.desk-sealed')).toBeNull()
    const entry = $('.desk-run__side .desk-entry .dict-entry--band')
    expect(entry).not.toBeNull()
    expect(entry.textContent.toLowerCase()).toContain('meaning of 山')
    const top = rect('.dict-entry__top')
    const body = rect('.dict-entry--band > .dict-entry__body')
    expect(top.bottom).toBeLessThanOrEqual(body.top)
    expect($('.dict-entry__top > .dict-plate')).not.toBeNull()
    expect(getComputedStyle($('.dict-entry__top')).borderTopWidth).toBe('1px')
  })

  // A kanji the learner has met, with its stroke sheet and more words
  // than a laptop's column holds beside it.
  function dockKanji(words) {
    const word = i => ({ kanji: `山${i}`, kana: 'やま', meaning: `word ${i}`, level: 'N5', furigana: [{ text: '山', reading: 'やま' }, { text: String(i) }] })
    apiFetch.mockImplementation(async () => ({
      ok: true, status: 200,
      json: async () => ({ results: [{
        type: 'kanji', kanji: '山', kana: 'サン・やま', meaning: 'mountain', level: 'N5',
        stroke_count: 3, radical: 46, radical_glyph: '山', radical_name: 'やま', svg_url: '/kanjivg/05c71.svg',
        status: { status: 'learning', total_reviews: 2, correct_reviews: 2, accuracy: 100, interval_days: 0, next_review: '2026-09-25T08:00:00Z', due: true },
        vocab_examples: Array.from({ length: words }, (_, i) => word(i)),
      }] }),
    }))
  }

  it('keep the learner\'s two figures and leave the schedule to the tiles', async () => {
    dockKanji(2)
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    press(' ')
    await settle(400)
    const figures = $$('.dict-entry__top .records > .record')
    expect(figures.map(f => f.querySelector('.record__label').textContent)).toEqual(['Précision', 'Révisions'])
    // One row of two, across the panel.
    const [a, b] = figures.map(f => f.getBoundingClientRect())
    expect(b.top).toBeCloseTo(a.top, 0)
  })

  it('scroll rather than shrink the stroke sheet when the column is short', async () => {
    dockKanji(12)
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    press(' ')
    await settle(400)
    const body = $('.dict-entry--band > .dict-entry__body')
    const sheet = $('.dict-entry--band .dict-form__sheet')
    // The sheet stands at twice the specimen at least, and the panel
    // scrolls to it; the column itself does not.
    expect(sheet.getBoundingClientRect().height).toBeGreaterThanOrEqual(2 * parseFloat(probe('fontSize', 'var(--fs-specimen-glyph)')) - 1)
    expect(getComputedStyle(body).overflowY).toBe('auto')
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    const side = $('.desk-run__side')
    expect(side.scrollHeight).toBeLessThanOrEqual(side.clientHeight + 1)
    body.scrollTop = body.scrollHeight
    await settle(50)
    expect(sheet.getBoundingClientRect().bottom).toBeLessThanOrEqual(body.getBoundingClientRect().bottom + 1)
  })
})

describe('the choices beside the card', () => {
  it('stack under it in the middle column', async () => {
    await render(
      <Stage>
        <Card />
        <MCQGrid choices={CHOICES} correct="gare" selected={null} answered={false} onAnswer={() => {}} />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
    await settle(400)
    expect(rect('.mcq-list').top).toBeGreaterThanOrEqual(rect('.prompt-card').bottom)
    expect(rect('.mcq-list').right).toBeLessThanOrEqual(rect('.stage').right + 1)
  })

  // The stage word is pinned to the card stage's corner, so the stage is
  // the card's width: beside choices or a writing board the rule that
  // stacks them had widened it to the column, and the word stood off the
  // card's edge (a kanji trace on the Today queue).
  it.each([
    ['choices', <MCQGrid key="m" choices={CHOICES} correct="gare" selected={null} answered={false} onAnswer={() => {}} />],
    ['a writing board', <DrawingQuiz key="d" kanji="急" resetKey="k" onValidate={() => {}} />],
  ])('keep the card\'s stage word on the card beside %s', async (_, beside) => {
    // At the owner's width, where the middle column is wider than a card.
    await render(
      <Frame width={1877}><Stage>
        <CardTransition className="specimen-card-stage" cardKey="k" stage="learning">
          <PromptCard foot={<span>N4</span>}><span className="probe-kanji">急</span></PromptCard>
        </CardTransition>
        {beside}
        <RatingBar active={false} onRate={() => {}} />
      </Stage></Frame>
    )
    await settle(400)
    const card = rect('.quiz-card-stage .prompt-card')
    const mark = rect('.stage-mark')
    expect(mark.right).toBeLessThanOrEqual(card.right)
    expect(mark.top).toBeGreaterThanOrEqual(card.top)
    expect(rect('.quiz-card-stage').width).toBeCloseTo(card.width, 0)
  })
})

describe('the writing board in the middle column', () => {
  // The drawing drill's column: the prompt, the board with its erase
  // button and Show the answer, the unlit tiles. The board was sized
  // off the window (52vh, to 440px) with no word from the column, so
  // the four stood taller than it and the column scrolled -- Show the
  // answer under the fold, and the tiles under that. The board takes
  // what the prompt, its buttons and the tiles leave. The prompt is
  // KanjiRun's: the meaning, its second sense and the reading.
  function Draw() {
    return (
      <Stage>
        <CardTransition className="specimen-card-stage" cardKey="k">
          <PromptCard foot={{ left: 'N4 漢字', right: 'Tracer le kanji' }}>
            <MeaningDisplay meaning="Tribu, famille" size={32} />
            <div className="quiz-subtitle">(ゾク)</div>
          </PromptCard>
        </CardTransition>
        <DrawingQuiz kanji="族" onValidate={() => {}} resetKey="k" />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
  }

  it('fits the prompt, a square board, its buttons and the tiles without scrolling', async () => {
    await render(<Draw />)
    await settle(400)
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
    const board = rect('.canvas-board')
    expect(Math.round(board.width)).toBe(Math.round(board.height))
    // On the lane's 800px window, a mouse's worth of board rather than
    // a thumbnail.
    expect(board.height).toBeGreaterThanOrEqual(160)
    // The eraser beside Show the answer, small, on one row under the card.
    const show = rect('.drawing-quiz__validate')
    const erase = rect('.drawing-quiz__clear')
    expect(erase.top).toBeCloseTo(show.top, 0)
    expect(erase.left).toBeGreaterThanOrEqual(show.right)
    expect(erase.width).toBeLessThan(show.width / 2)
    expect(rect('.drawing-quiz__card').bottom).toBeLessThanOrEqual(show.top)
    expect(show.bottom).toBeLessThanOrEqual(rect('.rating-bar').top)
    // The 田 guide quarters the board.
    const grid = rect('.canvas-grid')
    expect(grid.width).toBeCloseTo(board.width, 0)
    expect(rect('.rating-bar').bottom).toBeLessThanOrEqual(rect('.stage').bottom + 1)
  })

  it('stands the board on the smaller side of its room, to its cap', async () => {
    // The room is what the column leaves, so a taller window is a
    // taller room and a bigger board, until the 440px cap.
    await render(<Frame width={1877}><Draw /></Frame>)
    await settle(400)
    const board = rect('.canvas-board')
    const room = rect('.canvas-field')
    expect(board.height).toBeCloseTo(Math.min(room.height, room.width, 440), 0)
    expect(board.top).toBeGreaterThanOrEqual(room.top - 1)
    expect(board.bottom).toBeLessThanOrEqual(room.bottom + 1)
  })

  it('keeps the board still when the answer is shown, Show the answer keeping its room', async () => {
    await render(<Draw />)
    await settle(400)
    const before = rect('.canvas-board')
    $('.drawing-quiz__validate').click()
    await settle(200)
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
    const after = rect('.canvas-board')
    expect(after.top).toBeCloseTo(before.top, 0)
    expect(after.height).toBeCloseTo(before.height, 0)
    // The eraser stays where it was.
    expect($('.drawing-quiz__clear')).not.toBeNull()
    // Kept, but unseen and out of reach.
    const spent = $('.drawing-quiz__validate')
    expect(getComputedStyle(spent).visibility).toBe('hidden')
    expect(spent.disabled).toBe(true)
    expect(spent.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('a run without records', () => {
  it('keeps the side alone, the strip on the floor and the tiles docked in the stage', async () => {
    await render(<Stage records={false} panel={null}><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle(400)
    expect($('.screen').classList.contains('desk-run')).toBe(true)
    expect($('.desk-run--panels')).toBeNull()
    expect($('.desk-run__left')).toBeNull()
    expect(rect('.screen > .lvlbar').height).toBe(36)
    expect(getComputedStyle($('.rating-bar')).position).toBe('sticky')
    expect(getComputedStyle($('.desk-run__side')).position).toBe('fixed')
  })
})

describe('a run with nothing to count', () => {
  it('shows no panels beside a failed batch, the side an empty column', async () => {
    await render(<Stage side={null}><p>error</p></Stage>)
    await settle()
    expect($('.desk-run__side')).not.toBeNull()
    expect($('.desk-run--panels')).toBeNull()
    expect($('.desk-run__left')).toBeNull()
  })

  it('keeps no three zeros at the end of a run that rated nothing', async () => {
    await render(<Stage done><p>done</p></Stage>)
    await settle()
    expect($('.desk-figs')).toBeNull()
  })

  it('lists the misses at the end of a run, each opening its entry', async () => {
    countReview({ quality: 1, xp: 1, entry: { term: '駅', category: 'kanji', session: {} } })
    await render(<Stage done side={<SessionPanel done />}><p>done</p></Stage>)
    await settle()
    const chips = $$('.desk-run__side .desk-misses .desk-miss')
    expect(chips.map(c => c.textContent)).toEqual(['駅'])
    chips[0].click()
    await settle(250)
    expect($('.desk-entry').textContent.toLowerCase()).toContain('meaning of 駅')
  })
})

describe('the readings drill in the middle column', () => {
  // The kanji, its box of readings a kind, Valider, the unlit tiles. The
  // stacked rows it replaced grew down the column a reading at a time
  // and scrolled it, Valider inline-block 51px off the fields' axis.
  const READINGS = {
    on: [{ reading: 'シュ', display: 'シュ' }, { reading: 'ス', display: 'ス' }],
    kun: [{ reading: 'ぬし', display: 'ぬし' }, { reading: 'おも', display: 'おも' }, { reading: 'あるじ', display: 'あるじ' }],
  }
  function Readings() {
    return (
      <Stage panel={<CardPanel card={CARD} remaining={19} keys="readings" />}>
        <CardTransition className="specimen-card-stage" cardKey="k">
          <PromptCard foot={{ left: 'N4 漢字', right: 'Lectures' }}><CharDisplay char="主" size={100} /></PromptCard>
        </CardTransition>
        <ReadingsInput readings={READINGS} submitted={false} onSubmit={() => {}} />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
  }

  it('stands Valider on the boxes\' axis, and fits the column', async () => {
    await render(<Frame width={1877}><Readings /></Frame>)
    await settle(400)
    const group = rect('.readings-input__group')
    const submit = rect('.readings-input__submit')
    expect(submit.left).toBeCloseTo(group.left, 0)
    expect(submit.width).toBeCloseTo(group.width, 0)
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
  })

  it('lists the drill\'s own keys on the card panel: a comma or Space adds, Enter checks', async () => {
    await render(<Readings />)
    await settle()
    const keys = $$('.desk-card .desk-keys__item').map(el => el.textContent)
    expect(keys).toEqual([',Espaceajoute une lecture', 'Entréevalide', 'Échapquitte le trajet'])
  })
})
