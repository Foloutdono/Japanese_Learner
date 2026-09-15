import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import '../../index.css'

// ── 部首索引 on a phone ───────────────────────────────────────
// The index shipped with two defects a 390px screen makes obvious and
// a desktop lane never sees:
//
//   - the stroke counts were a rail the LEARNER had to drag. Seven of
//     the eighteen fit, the eighth was cut by a fade, and the rest
//     were behind a horizontal drag inside a page that scrolls
//     vertically. The page under it had to name its own neighbours
//     (‹ 1画 · 6 … 2画 · 23 ›) to make the hidden half reachable at
//     all. The counts stay on one line — wrapping them onto three
//     rows put a number pad over the index — and the two chevrons
//     walk it, with the flick kept as a shortcut beside them.
//   - six tile columns at 390px is a 52px tile, and the study index's
//     tile is chosen ON its meaning: "marche…", "soi-mê…", "tête de …".
//
// Both are geometry, so these pin geometry: nothing scrolls sideways,
// every stroke count is on screen, and no meaning is cut off.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playUi: vi.fn() }))
const { RadicalGrid } = await import('./RadicalIndex')

const t = {
  dictStrokeIndex: 'Index par nombre de traits',
  dictStrokeSingular: 'trait',
  dictStrokesPlural: 'traits',
  dictStrokePrev: 'Moins de traits',
  dictStrokeNext: 'Plus de traits',
}

// The real 3画 group of the course's index, meanings included — the
// page the screenshots were taken on — and its real neighbours' sizes.
const THREE = [
  ['水', 'eau', 123], ['手', 'main', 88], ['心', 'cœur', 77], ['口', 'bouche', 66],
  ['辶', 'marche', 52], ['土', 'terre', 47], ['囗', 'enceinte', 12], ['士', 'lettré', 5],
  ['夂', 'marcher', 1], ['夊', 'marcher lentement', 1], ['夕', 'soir', 5], ['大', 'grand', 17],
  ['女', 'femme', 34], ['子', 'enfant', 9], ['宀', 'toit', 38], ['寸', 'pouce', 11],
  ['小', 'petit', 3], ['尢', 'boiteux', 1], ['尸', 'cadavre', 14], ['屮', 'pousse', 1],
  ['山', 'montagne', 20], ['川', 'rivière', 4], ['工', 'travail', 5], ['己', 'soi-même', 5],
  ['巾', 'tissu', 16], ['干', 'sec', 5], ['幺', 'fil court', 4], ['广', 'bâtiment', 18],
  ['廴', 'grand pas', 3], ['廾', 'deux mains', 2], ['弋', 'pieu', 2], ['弓', 'arc', 12],
  ['ヨ', 'tête de porc', 2], ['彡', 'poils, traits', 8], ['彳', 'pas', 19], ['犭', 'chien', 17],
  ['阝', 'colline', 22],
]
// 1画, and the longest meaning the table holds (radical 172, 隹) on a
// short page — the two widths a tile is drawn at.
const ONE = [
  ['一', 'un', 17], ['乙', 'second, crochet', 7], ['丿', 'trait oblique', 5],
  ['亅', 'crochet', 4], ['丶', 'point', 3], ['隹', 'oiseau à queue courte', 8],
]

const group = (stroke, rows) => ({
  stroke_count: stroke,
  radicals: rows.map(([glyph, meaning, count], i) => ({
    number: stroke * 100 + i, glyph, char: glyph, meaning, count, kanji_count: count,
    learned: i === 0 ? Math.round(count / 3) : 0, started: i === 0 ? 2 : 0,
  })),
})
// Eighteen groups, which is what the dictionary's index has and what
// never fitted a phone in one line.
const GROUPS = [
  group(1, ONE), group(2, THREE.slice(0, 23)), group(3, THREE),
  ...[4, 5, 6, 7, 8, 9, 10, 11].map(n => group(n, THREE.slice(0, 20))),
  ...[12, 13, 14, 15, 16, 17].map(n => group(n, ONE.slice(0, 4))),
]

const studyTile = r => ({
  glyph: r.glyph, sub: r.meaning, count: r.count, learned: r.learned, started: r.started > 0,
})

async function index({ stroke = 3, tile = studyTile, onPick = () => {}, onStroke } = {}) {
  const screen = await render(
    <main className="dictionary" style={{ '--line-color': 'var(--line-kanji)' }}>
      <RadicalGrid
        groups={GROUPS}
        onPick={onPick}
        t={t}
        tile={tile}
        order="rank"
        stroke={stroke}
        onStroke={onStroke}
      />
    </main>
  )
  const all = sel => [...screen.container.querySelectorAll(sel)]
  return { screen, all, one: sel => screen.container.querySelector(sel) }
}

/** Nothing inside `el` sits outside it on the inline axis. */
const fits = el => el.scrollWidth <= el.clientWidth + 1

const rail = s => s.one('.stroke-rail')
const track = s => s.one('.stroke-rail__track')
const steps = s => s.all('.stroke-rail__step')

describe('the stroke rail', () => {
  it('keeps every count on one line, swipable, with no bar under it', async () => {
    const s = await index()
    const keys = s.all('.stroke-rail__key')
    expect(keys.length).toBe(GROUPS.length)
    // One line: every key shares a top, and the rail itself fits the
    // phone — only the track behind it holds more than it shows.
    expect(new Set(keys.map(k => Math.round(k.getBoundingClientRect().top))).size).toBe(1)
    expect(fits(rail(s))).toBe(true)
    expect(track(s).scrollWidth).toBeGreaterThan(track(s).clientWidth)
    // The flick is the shortcut beside the two chevrons...
    expect(getComputedStyle(track(s)).overflowX).toBe('auto')
    // ...and it stays inside the rail rather than turning into the
    // browser's back gesture at the end of the index.
    expect(getComputedStyle(track(s)).overscrollBehaviorX).toBe('contain')
    // ...and it carries no scrollbar on any pointer: the track is
    // taller than the window it scrolls in, by exactly the room the
    // bar would be drawn in, and the clip hides that edge. Asking for
    // `scrollbar-width` instead is what summons a phone's classic bar
    // (index.scrollbar.browser.test.jsx).
    const clip = s.one('.stroke-rail__clip')
    expect(getComputedStyle(clip).overflow).toBe('hidden')
    expect(track(s).offsetHeight).toBeGreaterThan(clip.clientHeight)
    // Every key and both chevrons are targets a thumb can hit.
    for (const el of [...keys, ...steps(s)]) {
      const box = el.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  })

  it('sets every figure in the middle of its own key', async () => {
    const s = await index()
    // A figure is the only ink in its key — the 画 the chosen one used
    // to carry pushed it 8px off its own centre while the seventeen
    // without one were true, and every figure sat 5px high in its box
    // besides.
    for (const key of s.all('.stroke-rail__key')) {
      const k = key.getBoundingClientRect()
      const n = key.querySelector('.stroke-rail__n').getBoundingClientRect()
      expect(Math.abs((n.left + n.right) / 2 - (k.left + k.right) / 2), key.textContent).toBeLessThan(0.6)
      expect(Math.abs((n.top + n.bottom) / 2 - (k.top + k.bottom) / 2), key.textContent).toBeLessThan(0.6)
    }
  })

  it('walks the index from the two chevrons, and stops at its ends', async () => {
    const picked = []
    const s = await index({ onStroke: n => picked.push(n) })
    const [back, on] = steps(s)
    expect(back.disabled).toBe(false)
    back.click()
    on.click()
    expect(picked).toEqual([2, 4])

    const first = await index({ stroke: 1, onStroke: n => picked.push(n) })
    expect(steps(first)[0].disabled, 'nothing before 1画').toBe(true)
    const last = await index({ stroke: 17, onStroke: n => picked.push(n) })
    expect(steps(last)[1].disabled, 'nothing after the last count').toBe(true)
  })

  it('carries the count being read into the middle of the track', async () => {
    const s = await index({ stroke: 12 })
    const chosen = () => s.one('.stroke-rail__key--on').getBoundingClientRect()
    const box = () => track(s).getBoundingClientRect()
    // 12画 is well past what fits, so it is only in view because the
    // rail put it there.
    await expect.poll(() => chosen().left >= box().left - 1).toBe(true)
    await expect.poll(() => chosen().right <= box().right + 1).toBe(true)
    // And the counts either side of it are a tap away, not a drag.
    const visible = s.all('.stroke-rail__key').filter(k => {
      const r = k.getBoundingClientRect()
      return r.left >= box().left - 1 && r.right <= box().right + 1
    })
    expect(visible.length).toBeGreaterThan(2)
  })

  it('prints bare figures, and names every one of them for a reader', async () => {
    const s = await index()
    // Nothing on a key but its number — not even the unit the chosen
    // one used to carry.
    expect(s.all('.stroke-rail__key').map(k => k.textContent)).toEqual(GROUPS.map(g => String(g.stroke_count)))
    // And they are one size, so the rail cannot shift under the thumb
    // that just tapped it.
    const widths = new Set(s.all('.stroke-rail__key').map(k => Math.round(k.getBoundingClientRect().width)))
    expect(widths.size).toBe(1)

    const keys = s.all('.stroke-rail__key')
    expect(keys[0].getAttribute('aria-label')).toBe('1 trait')
    expect(keys[2].getAttribute('aria-label')).toBe('3 traits')
    expect(keys[2].getAttribute('aria-current')).toBe('true')
    expect(keys.filter(k => k.getAttribute('aria-current')).length).toBe(1)
    expect(rail(s).getAttribute('aria-label')).toBe(t.dictStrokeIndex)
    expect(steps(s).map(b => b.getAttribute('aria-label'))).toEqual([t.dictStrokePrev, t.dictStrokeNext])
  })
})

describe('the page', () => {
  it('prints every meaning in full and keeps its tiles one height', async () => {
    const s = await index()
    const subs = s.all('.radical-tile__sub')
    expect(subs.length).toBe(THREE.length)
    for (const sub of subs) {
      // Cut off vertically is what the two-line box exists to prevent;
      // cut off horizontally is the ellipsis this page used to print.
      expect(sub.scrollHeight, sub.textContent).toBeLessThanOrEqual(sub.clientHeight + 1)
      expect(fits(sub), sub.textContent).toBe(true)
    }
    const heights = new Set(s.all('.radical-tile').map(el => Math.round(el.getBoundingClientRect().height)))
    expect(heights.size, 'a reserved second line keeps every row the same height').toBe(1)
    expect(fits(s.one('.radical-page__grid'))).toBe(true)
  })

  it('opens with the biggest families, and lets a tile say how far in it is', async () => {
    const s = await index()
    expect(s.all('.radical-tile__char').slice(0, 4).map(n => n.textContent)).toEqual(['水', '手', '心', '口'])
    const first = s.all('.radical-tile')[0]
    expect(first.classList.contains('radical-tile--started')).toBe(true)
    expect(first.querySelector('.radical-tile__count').textContent).toBe('41/ 123')
    // The same figure along the tile's own bottom edge.
    const run = first.querySelector('.radical-tile__run')
    expect(parseFloat(run.style.getPropertyValue('--done'))).toBeCloseTo(41 / 123, 3)
    expect(run.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('spends the room on its tiles when a stroke count files only a few', async () => {
    const wide = await index({ stroke: 1 })
    const wideTile = wide.one('.radical-tile').getBoundingClientRect().width
    expect(wide.one('.radical-page').getAttribute('data-fill')).toBe('short')
    for (const sub of wide.all('.radical-tile__sub')) {
      expect(sub.scrollHeight, sub.textContent).toBeLessThanOrEqual(sub.clientHeight + 1)
    }
    const full = await index({ stroke: 3 })
    expect(full.one('.radical-page').getAttribute('data-fill')).toBeNull()
    expect(wideTile).toBeGreaterThan(full.one('.radical-tile').getBoundingClientRect().width)
  })

  it('gives the dictionary its own tile, and more of them to a row', async () => {
    const dict = await index({ tile: r => ({ glyph: r.char, count: r.kanji_count }) })
    expect(dict.all('.radical-tile__sub').length).toBe(0)
    expect(dict.all('.radical-tile__run').length, 'no figure, no edge').toBe(0)
    const perRow = new Map()
    for (const tile of dict.all('.radical-tile')) {
      const top = Math.round(tile.getBoundingClientRect().top)
      perRow.set(top, (perRow.get(top) || 0) + 1)
    }
    expect([...perRow.values()][0]).toBeGreaterThan(4)
  })
})
