import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import tours from '../../testing/glyphTour.json'
import { sampleStroke } from '../../domain/strokePath'
import '../../index.css'

// ── 初見 — a kana or a kanji met before it is drilled (plan 216) ──
// Read, write, use: the glyph and what it reads, its strokes traced in
// turn from the dot to the ring, the ink filling each as the hand goes
// (plan 263) -- a miss answered by what to fix, the
// stroke drawn for the learner after three, « Show me » drawing the rest
// -- and a few words, each voiced. The fixture is the payload the
// backend serves for あ and 日 in English (study/glyph_tour.py;
// backend/tests/test_glyph_tour.py holds the two equal).

const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))
const playKana = vi.fn()
const speakJapanese = vi.fn()
vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(), stopSpeaking: vi.fn(),
  playKana: (...a) => playKana(...a), speakJapanese: (...a) => speakJapanese(...a),
}))

const { GlyphTour } = await import('./GlyphTour')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

async function mount(tour = tours.kana) {
  const onBoard = vi.fn()
  const screen = await render(
    <LangProvider>
      <GlyphTour tour={tour} onBoard={onBoard} />
    </LangProvider>
  )
  await settle()
  const root = () => screen.container.querySelector('.tour')
  const gate = () => root().querySelector('.tour__foot .btn-depart')
  const board = () => root().querySelector('.gt-board')
  return { screen, root, gate, board, onBoard }
}

// A line drawn on the pen, in KanjiVG's units, through the pointer.
function draw(board, points) {
  const pen = board.querySelector('.gt-pen')
  const box = pen.getBoundingClientRect()
  const at = ([x, y]) => ({
    clientX: box.left + (x / 109) * box.width,
    clientY: box.top + (y / 109) * box.height,
    bubbles: true, pointerId: 7, button: 0,
  })
  pen.dispatchEvent(new PointerEvent('pointerdown', at(points[0])))
  for (const p of points.slice(1)) pen.dispatchEvent(new PointerEvent('pointermove', at(p)))
  pen.dispatchEvent(new PointerEvent('pointerup', at(points[points.length - 1])))
}

const along = d => sampleStroke(d, 24)
const backwards = d => [...along(d)].reverse()

async function trace(t, i) {
  draw(t.board(), along(tours.kana.strokes[i]))
  await settle(30)
}

beforeEach(() => {
  track.mockReset()
  playKana.mockClear()
  speakJapanese.mockClear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => { localStorage.removeItem('lang') })

describe('a kana met for the first time', () => {
  it('reads it first: the glyph, its romaji, its twin, and its sound', async () => {
    const t = await mount()
    expect(t.root().dataset.stop).toBe('read')
    expect(t.root().querySelectorAll('.tour__stop')).toHaveLength(3)
    expect(t.root().querySelector('.char-display').textContent).toBe('あ')
    expect(t.root().querySelector('.gt-romaji').textContent).toBe('a')
    expect(t.root().querySelector('.gt-twin').textContent).toContain('ア')
    expect(t.root().querySelector('.gt-twin').textContent).toContain('in katakana')
    expect(playKana).toHaveBeenCalledWith('a')
    t.root().querySelector('[data-action="speak"]').click()
    expect(playKana).toHaveBeenCalledTimes(2)
    t.gate().click()
    await settle()
    expect(t.root().dataset.stop).toBe('write')
  })

  it('has each stroke traced in turn from the dot to the ring', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    expect(t.gate().disabled).toBe(true)
    expect(t.board().dataset.stroke).toBe('1')
    // The track names the stop and how far it is (plan 264); the card
    // says only which stroke, never the stop's name again.
    expect(t.root().querySelector('.tour__track-name').textContent).toBe('Write')
    expect(t.root().querySelector('.tour__track-count').textContent).toBe('2 / 3')
    expect(t.root().querySelector('.tour__stop-fill').style.width).toBe('0%')
    expect(t.root().querySelector('.tour-leaf__head .tour__notion').textContent).toBe('Stroke 1 of 3')
    // The stroke asked: its hollow, its dot with its number, its ring,
    // the chevrons inside it and its ink, empty; the others faint.
    expect(t.board().querySelector('.gt-hollow')).not.toBeNull()
    expect(t.board().querySelector('.gt-start').textContent).toBe('1')
    expect(t.board().querySelector('.gt-end')).not.toBeNull()
    expect(t.board().querySelectorAll('.gt-chevron')).toHaveLength(3)
    expect(t.board().querySelector('.gt-ink').style.opacity).toBe('0')
    expect(t.board().querySelectorAll('[data-state="ahead"]')).toHaveLength(2)
    await trace(t, 0)
    expect(t.board().dataset.stroke).toBe('2')
    expect(t.board().querySelector('[data-state="done"]')).not.toBeNull()
    // The stop's segment fills a stroke at a time.
    expect(t.root().querySelector('.tour__stop-fill').style.width).toBe('33%')
    await trace(t, 1)
    await trace(t, 2)
    expect(t.board().dataset.stroke).toBeUndefined()
    expect(t.board().querySelectorAll('[data-state="done"]')).toHaveLength(3)
    expect(t.board().querySelector('.gt-hollow')).toBeNull()
    expect(t.root().querySelector('.tour-said--ok').textContent).toContain('Traced first time.')
    expect(t.root().querySelector('.tour__stop-fill').style.width).toBe('100%')
    expect(t.root().querySelector('.tour-leaf__head .tour__notion')).toBeNull()
    expect(t.root().querySelector('[data-action="show"]')).toBeNull()
    expect(t.gate().disabled).toBe(false)
  })

  it('fills the stroke with ink as the hand goes, and drains it when lifted short', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    const pen = t.board().querySelector('.gt-pen')
    const box = pen.getBoundingClientRect()
    const at = ([x, y]) => ({
      clientX: box.left + (x / 109) * box.width,
      clientY: box.top + (y / 109) * box.height,
      bubbles: true, pointerId: 7, button: 0,
    })
    const stroke = along(tours.kana.strokes[0])
    pen.dispatchEvent(new PointerEvent('pointerdown', at(stroke[0])))
    for (const p of stroke.slice(1, 13)) pen.dispatchEvent(new PointerEvent('pointermove', at(p)))
    const ink = t.board().querySelector('.gt-ink')
    // Half the stroke: the ink is the stroke's, filled half way along it.
    expect(ink.style.opacity).toBe('1')
    const half = parseFloat(ink.style.strokeDasharray)
    expect(half).toBeCloseTo(0.5, 1)
    // A finger off the stroke, then on past the ring, carries no ink further.
    const off = [stroke[12][0], 100]
    pen.dispatchEvent(new PointerEvent('pointermove', at(off)))
    pen.dispatchEvent(new PointerEvent('pointermove', at(stroke[stroke.length - 1])))
    expect(parseFloat(ink.style.strokeDasharray)).toBeLessThan(half + 0.05)
    pen.dispatchEvent(new PointerEvent('pointerup', at(stroke[stroke.length - 1])))
    await settle(30)
    expect(ink.classList.contains('gt-ink--drain')).toBe(true)
    expect(ink.style.opacity).toBe('0')
    expect(t.root().querySelector('.tour-said--no').textContent).toContain('Follow the stroke.')
    expect(t.board().dataset.stroke).toBe('1')
  })

  it('calls the dot after a stroke begun away from it', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    expect(t.board().querySelector('.gt-start--call')).toBeNull()
    draw(t.board(), backwards(tours.kana.strokes[0]))
    await settle(30)
    expect(t.board().querySelector('.gt-start--call')).not.toBeNull()
    await trace(t, 0)
    expect(t.board().querySelector('.gt-start--call')).toBeNull()
    expect(t.board().querySelector('.gt-start').textContent).toBe('2')
  })

  it('answers a miss with what to fix, and draws the stroke after three', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    draw(t.board(), backwards(tours.kana.strokes[0]))
    await settle(30)
    expect(t.board().dataset.stroke).toBe('1')
    expect(t.root().querySelector('.tour-said--no').textContent).toContain('Start on the full dot.')
    // The missed line, a moment in the miss's ink.
    expect(t.board().querySelector('.gt-missed polyline')).not.toBeNull()
    draw(t.board(), along(tours.kana.strokes[0]).slice(0, 10))
    await settle(30)
    expect(t.root().querySelector('.tour-said--no').textContent).toContain('Go all the way to the ring.')
    draw(t.board(), backwards(tours.kana.strokes[0]))
    await settle(30)
    // Three misses on one stroke: drawn for the learner, the next asked.
    expect(t.board().dataset.stroke).toBe('2')
    expect(t.board().querySelector('[data-state="given"]')).not.toBeNull()
    expect(t.root().querySelector('.tour-said--given').textContent).toContain('This stroke is drawn for you.')
    await trace(t, 1)
    await trace(t, 2)
    expect(t.root().querySelector('.tour-said--ok').textContent).toContain('Traced.')
    t.gate().click()
    await settle()
    t.gate().click()
    await settle()
    expect(t.onBoard).toHaveBeenCalledWith({ misses: 3, shown: true })
  })

  it('refuses a straight cut across a curved stroke', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    await trace(t, 0)
    await trace(t, 1)
    const bowl = along(tours.kana.strokes[2])
    draw(t.board(), [bowl[0], bowl[bowl.length - 1]])
    await settle(30)
    expect(t.board().dataset.stroke).toBe('3')
    expect(t.root().querySelector('.tour-said--no').textContent).toContain('Follow the stroke.')
  })

  it('draws the rest on « Show me »', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    await trace(t, 0)
    t.root().querySelector('[data-action="show"]').click()
    await settle()
    expect(t.board().querySelectorAll('[data-state="shown"]')).toHaveLength(2)
    expect(t.root().querySelector('.tour-said--given').textContent).toContain('That is how it is written.')
    expect(t.gate().disabled).toBe(false)
  })

  it('ends on the words it is read in, each voiced, and boards the card', async () => {
    const t = await mount()
    t.gate().click()
    await settle()
    t.root().querySelector('[data-action="show"]').click()
    await settle()
    t.gate().click()
    await settle()
    expect(t.root().dataset.stop).toBe('use')
    expect(t.root().querySelector('.tour__track-name').textContent).toBe('In words')
    expect(t.root().querySelector('.tour__track-count').textContent).toBe('3 / 3')
    expect(t.root().querySelectorAll('.tour__stop--passed')).toHaveLength(2)
    expect(t.root().querySelector('.tour-leaf__head .tour__notion')).toBeNull()
    const words = [...t.root().querySelectorAll('.gt-word')]
    expect(words).toHaveLength(tours.kana.words.length)
    // A word printed as it is read, the kana picked out of it.
    expect(words[0].querySelector('.gt-word__jp').textContent).toBe(tours.kana.words[0].kana)
    expect(words[0].querySelector('.gt-word__hit').textContent).toBe('あ')
    words[0].querySelector('[data-action="speak"]').click()
    expect(speakJapanese).toHaveBeenCalledWith(tours.kana.words[0].kana)
    expect(t.gate().textContent).toContain('Start')
    t.gate().click()
    expect(t.onBoard).toHaveBeenCalledWith({ misses: 0, shown: true })
    expect(track).toHaveBeenCalledWith('glyph_tour_done', { source: 'kana', misses: 0, shown: true })
  })
})

describe('a kanji met for the first time', () => {
  it('reads it by its meaning and its two registers of readings', async () => {
    const t = await mount(tours.kanji)
    expect(t.root().querySelector('.char-display').textContent).toBe('日')
    expect(t.root().querySelector('.gt-meaning').textContent).toBe('Day · sun · Japan · counter for days')
    const readings = t.root().querySelector('.gt-readings').textContent
    expect(readings).toContain('ニチ')
    expect(readings).toContain('ひ')
    expect(t.root().querySelectorAll('.reading-group__label')).toHaveLength(2)
    expect(playKana).not.toHaveBeenCalled()
  })

  it('picks the kanji out of each word it shows', async () => {
    const t = await mount(tours.kanji)
    t.gate().click()
    await settle()
    expect(t.root().querySelector('.tour-leaf__head .tour__notion').textContent).toBe('Stroke 1 of 4')
    t.root().querySelector('[data-action="show"]').click()
    await settle()
    t.gate().click()
    await settle()
    const words = [...t.root().querySelectorAll('.gt-word')]
    expect(words.map(w => w.querySelector('.gt-word__gloss').textContent)).toEqual(['Sunday', 'Tuesday', 'Five days'])
    expect(words.every(w => w.querySelector('.gt-word__hit')?.textContent.includes('日'))).toBe(true)
  })

  it('draws no stop it has nothing for', async () => {
    const t = await mount({ ...tours.kanji, words: [] })
    expect(t.root().querySelectorAll('.tour__stop')).toHaveLength(2)
    t.gate().click()
    await settle()
    t.root().querySelector('[data-action="show"]').click()
    await settle()
    expect(t.gate().textContent).toContain('Start')
  })
})
