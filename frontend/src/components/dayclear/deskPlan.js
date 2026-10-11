// ── 終着 on the desk — the board's geometry and clock (plan 191) ─────
// The canvas's Desk board (1440×900, "Tsuji — the day cleared") is drawn
// at fixed board pixels: the rail 0–232, the centre column 276–1048, the
// side column 1092–1396, three bands down the page (the seal and the
// header 44–244, the grid 296–780, the tally and the gate 804–856), and
// a clock of beats read off the run's 32 cards. In the app the real rail
// stands at the left and the run has as many cards as it has, so this
// module lays the board out in whatever box the Shell gives it and deals
// the clock for any count -- as facts, no markup, so a test can read it:
//
//   deskGeometry({ width, height, count, compact })
//       the box's columns, bands and the tiles' size: at 1440×900 the
//       board's own (86×112 tiles every 98×124, the 200px seal), the air
//       first to give way on a short window, then the tiles, the side
//       column never under the width its words need
//   deskPlan(faces, geometry, { perfect })
//       each card's slot in the grid sorted by verdict, its flight
//       (launch, dive, throw, landing) and the beats after the sweep
//
// Every figure is a board pixel or a millisecond, as on the board.

const COLS = 8

// The board's own sizes (px).
const BOARD = Object.freeze({
  width: 1120, // centre 772 + gutter 44 + side 304
  side: 304,
  gutter: 44,
  centre: 772,
  tileW: 86,
  tileH: 112,
  gap: 12,
  readerW: 232,
  readerH: 72,
  gate: 52,
  header: 121, // the caption, the name and the week row, top to foot
})

// How far the board may grow on a big window: to the desk's canvas
// (--desk-board-w, 1240px) and no further, so it never looks lost.
const WIDEST = 1232
// The side column's words (the fare's line, tomorrow's, the gate's) need
// this much whatever the window; the centre column gives way instead.
const SIDE_MIN = 264
const SIDE_MAX = 336
// The air between the bands: the board's, and how far it may close up
// on a short window before a tile shrinks.
const AIR = Object.freeze({
  margin: [16, 44],
  seal: [22, 52], // the seal band to the grid
  tally: [12, 24], // the grid to the tally and the gate
})
const MARGIN_X = 28
// Tomorrow's panel stands as tall as the grid beside it, and at least
// this tall for its words: the board's spacing, or the short desk's.
const TOMORROW = Object.freeze({ normal: 400, compact: 300 })
// The smallest tile a card can still be read on (its term alone).
const TILE_MIN = 24
// The seal's band holds the header whatever the tiles' size.
const SEAL_MIN = 128
const SEAL_MAX = 212
// The week row: seven 28px stamps 8px apart.
const WEEK_W = 7 * 28 + 6 * 8
// The sweep's counter: its caption, its figure and its line, top to foot.
const COUNTER_H = 76

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

/** The tile density a size draws at: the board's, then a rung down at each step. */
export function tileDensity(tileW, tileH) {
  if (tileH < 40) return 'chip'
  if (tileH < 60 || tileW < 56) return 'small'
  if (tileH < 96 || tileW < 76) return 'mid'
  return 'full'
}

/**
 * The board laid out in a box of `width` × `height` px (the Shell's
 * content area) for a run of `count` cards; `compact` is the short desk
 * (tomorrow's panel drawn closer). Returns every position the screen
 * places, in the box's own px.
 */
export function deskGeometry({ width, height, count, compact = false, headW = 410 }) {
  const rows = Math.max(1, Math.ceil(Math.max(1, count) / COLS))

  // ── across: the centre column, the gutter, the side column ──
  // The board's own 1120px wherever the window holds it with the board's
  // margins; grown towards the desk's canvas only past that, so it never
  // looks lost; on a narrower window the margins close up first.
  const roomy = width - 2 * BOARD.gutter
  const span = Math.max(0, roomy >= BOARD.width ? Math.min(roomy, WIDEST) : Math.min(width - 2 * MARGIN_X, BOARD.width))
  const side = Math.round(clamp(span * BOARD.side / BOARD.width, SIDE_MIN, SIDE_MAX))
  const gutter = Math.round(clamp(span * BOARD.gutter / BOARD.width, MARGIN_X, 48))
  let centre = span - side - gutter
  const gapX = Math.round(clamp(centre * BOARD.gap / BOARD.centre, 6, 13))
  const tileW = Math.max(28, Math.floor(Math.min((centre - (COLS - 1) * gapX) / COLS, BOARD.tileW * 1.1)))
  centre = COLS * tileW + (COLS - 1) * gapX
  const across = centre + gutter + side
  const x0 = Math.round((width - across) / 2)
  const sideX = x0 + centre + gutter

  // ── the header: the seal, then the name and the week row beside it ──
  // The row (the week, the streak) needs `headW`; on a narrow centre
  // column the seal gives way first, then the streak takes a row of its
  // own under the week, and the band grows to hold it.
  const headRoom = centre - 28
  const stacked = headRoom - SEAL_MIN < headW
  const headBlock = stacked ? BOARD.header + 56 : BOARD.header

  // ── down: the seal's band, the grid, the tally and the gate ──
  const tom = compact ? TOMORROW.compact : TOMORROW.normal
  const tileHMax = Math.min(Math.round(tileW * BOARD.tileH / BOARD.tileW), Math.round(BOARD.tileH * 1.1))
  const gapOf = h => Math.round(clamp(h * BOARD.gap / BOARD.tileH, 4, 13))
  const sealOf = h => Math.max(clamp(h + 88, SEAL_MIN, SEAL_MAX), stacked ? headBlock + 16 : 0)
  const gridOf = h => rows * h + (rows - 1) * gapOf(h)
  const bandOf = h => Math.max(gridOf(h), tom)
  const airAt = a => {
    const at = ([lo, hi]) => lo + (hi - lo) * a
    return { margin: at(AIR.margin), seal: at(AIR.seal), tally: at(AIR.tally) }
  }
  const total = (h, air) => 2 * air.margin + sealOf(h) + air.seal + bandOf(h) + air.tally + BOARD.gate

  let tileH = tileHMax
  let air = airAt(1)
  if (total(tileH, air) > height) {
    // The air gives way first, then the tiles.
    const full = total(tileH, airAt(1))
    const none = total(tileH, airAt(0))
    if (none <= height) {
      air = airAt((height - none) / (full - none))
    } else {
      air = airAt(0)
      // Shrink the tiles only while it helps: below the height where
      // tomorrow's panel holds the band, a smaller tile gains nothing.
      const floor = total(TILE_MIN, air)
      while (tileH > TILE_MIN && total(tileH, air) > Math.max(height, floor)) tileH -= 1
    }
  }
  const used = total(tileH, air)
  // A big window: the spare height stands above and below, so the board
  // sits in the middle of the page rather than on its roof.
  const spare = Math.max(0, height - used)
  const top = Math.round(air.margin + spare / 2)
  const gapY = gapOf(tileH)
  const band1 = sealOf(tileH)
  const grid = gridOf(tileH)
  const band = bandOf(tileH)
  // The seal fills its band, as on the board, unless the header beside
  // it needs the room: then it is drawn smaller, centred in the band.
  // Stacked, the row beside it only holds the week (and the name).
  const seal = Math.round(clamp(headRoom - (stacked ? WEEK_W + 16 : headW), SEAL_MIN, band1))

  const y0 = top
  const sealY = y0 + Math.round((band1 - seal) / 2)
  // The header block (caption, name, week row) centred in the seal's band;
  // the fare card from its top to the band's foot.
  const hdrY = y0 + Math.round((band1 - headBlock) / 2)
  const hdrX = x0 + seal + 28
  const headWidth = centre - seal - 28
  const weekY = hdrY + 73
  const fareY = hdrY
  const fareH = y0 + band1 - fareY

  // The sweep: the deck card over the reader's slot, the reader, the dive.
  const stack = tileH + 4 + BOARD.readerH + 12
  const deckY = y0 + Math.max(0, Math.round((band1 - stack) / 2))
  const readerY = deckY + tileH + 4
  const slotX = x0 + 128 // the slot's centre: 76px in, before the 52px lamp
  // The sweep's counter stands where the header will, and always clear of
  // the reader's top (on the board it ends where the reader begins).
  const countY = Math.min(hdrY, readerY - COUNTER_H)
  const deckX = Math.round(slotX - tileW / 2)
  const dive = stack

  const bandTop = y0 + band1 + Math.round(air.seal)
  // The grid stands on the band's floor: each column is stacked from it.
  const gridTop = bandTop + band - grid
  const tallyTop = bandTop + band + Math.round(air.tally)
  const bottom = tallyTop + BOARD.gate + Math.round(air.margin)

  return {
    width,
    height: bottom > height + 2 ? bottom : height,
    overflow: bottom > height + 2,
    rows,
    cols: COLS,
    x0,
    centre,
    gutter,
    side,
    sideX,
    tileW,
    tileH,
    gapX,
    gapY,
    pitchX: tileW + gapX,
    pitchY: tileH + gapY,
    density: tileDensity(tileW, tileH),
    compact,
    y0,
    band1,
    seal,
    sealY,
    stacked,
    hdrX,
    hdrY,
    headWidth,
    weekY,
    fareY,
    fareH,
    deckX,
    deckY,
    countY,
    readerX: x0,
    readerY,
    readerW: BOARD.readerW,
    readerH: BOARD.readerH,
    slotLine: readerY + BOARD.readerH / 2,
    readerFoot: readerY + BOARD.readerH,
    dive,
    bandTop,
    band,
    gridTop,
    grid,
    tallyTop,
    gate: BOARD.gate,
  }
}

/** A tile's place in the grid: its row and column's top-left corner. */
export function slotAt(geo, r, c) {
  return { x: geo.x0 + c * geo.pitchX, y: geo.gridTop + r * geo.pitchY }
}

/**
 * The grid sorted by verdict as it fills, as the board does it: the
 * zones left to right (À revoir, Justes, Parfaites), each column filled
 * from the floor up. Where a column is shared, the later zone stands on
 * the floor and the earlier one over it, so the boundary steps down to
 * the right. The run is spread over the eight columns (the leftmost a
 * card taller where it does not divide), so a run of 34 stands on all
 * eight rather than leaving the last one empty. `counts` is the cards
 * per shown verdict; returns, per verdict, its slots in the order its
 * cards land ([row, col]).
 */
export function zoneSlots(counts, rows, cols = COLS) {
  const slots = counts.map(() => [])
  let total = counts.reduce((a, b) => a + b, 0)
  const base = Math.floor(total / cols)
  const extra = total % cols
  let v = 0
  let left = counts[0] ?? 0
  let col = 0
  while (total > 0) {
    const cap = Math.min(rows, total, base + (col < extra ? 1 : 0))
    const parts = []
    let room = cap
    while (room > 0) {
      while (left === 0) { v += 1; left = counts[v] }
      const take = Math.min(room, left)
      parts.push([v, take])
      left -= take
      room -= take
    }
    let row = rows - 1
    for (let p = parts.length - 1; p >= 0; p--) {
      const [pv, take] = parts[p]
      for (let j = 0; j < take; j++) slots[pv].push([row - j, col])
      row -= take
    }
    total -= cap
    col += 1
  }
  return slots
}

// The board's run: 28 launches that speed up (260ms down to 40), the
// last three slowing to a stop. A bigger run sweeps its first 28 the
// same and lands the rest in bulk -- a stream through the reader in
// under a second -- before the same last three.
const SOLO = 28
const BULK_MS = 720
const READ_RING = 130 // a read rings the reader only when its last ring is this old

function launchGaps(n) {
  if (n <= 1) return []
  const tailN = Math.min(3, n - 1)
  const head = n - 1 - tailN
  const gaps = []
  const solo = Math.min(head, SOLO)
  for (let i = 0; i < solo; i++) gaps.push(Math.max(40, Math.round(260 * 0.84 ** i)))
  if (head > SOLO) {
    const bulk = head - SOLO
    const step = clamp(Math.round(BULK_MS / bulk), 6, 40)
    for (let i = 0; i < bulk; i++) gaps.push(step)
  }
  const last = gaps.length ? gaps[gaps.length - 1] : 260
  const tail = [80, 150, 260].slice(3 - tailN).map(g => Math.max(g, Math.min(last, 260)))
  return [...gaps, ...tail]
}

/**
 * The run's clock and flights over a geometry. `faces` are the run's
 * cards ({ term, kana, line, verdict, up, mastered }); `perfect` whether
 * the third verdict is a zone of its own (the learner's bar offers it).
 * Returns { cards, beats, order, emits, holes, verdicts, finals }.
 */
export function deskPlan(faces, geo, { perfect = true } = {}) {
  const verdicts = perfect ? [0, 1, 2] : [0, 1]
  const zoneOf = v => (perfect ? v : Math.min(v, 1))
  const finals = verdicts.map(() => 0)
  faces.forEach(f => { finals[zoneOf(f.verdict)] += 1 })
  const slots = zoneSlots(finals, geo.rows)
  const n = faces.length
  const gaps = launchGaps(n)
  const L = [640]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + gaps[i - 1])
  const LAST = n - 1
  const seen = verdicts.map(() => 0)
  const exitY = geo.deckY + geo.dive
  const cards = faces.map((face, i) => {
    const z = zoneOf(face.verdict)
    const [r, c] = slots[z][seen[z]++]
    const at = slotAt(geo, r, c)
    const tx = at.x - geo.deckX
    const ty = at.y - exitY
    const dist = Math.hypot(tx, ty)
    const pace = i < LAST ? gaps[i] : 320
    const last = i === LAST
    const fd = last ? 460 : clamp(Math.round(150 + pace), 200, 420)
    let fa = last ? 760 : clamp(Math.round(260 + dist * 0.32 + pace * 0.6), 380, 700)
    if (!last && pace <= 60) fa = Math.min(fa, 460)
    const d = L[i]
    const ad = d + Math.round(fd * 0.82)
    return {
      i, face, v: z, r, c, x: at.x, y: at.y,
      d, fd, fa, ad, land: ad + fa, read: Math.round(d + fd * 0.72),
      tx, ty, lean: Number(clamp(tx / 80, -7, 7).toFixed(1)),
      streak: pace <= 110 && tx > 150,
      last,
    }
  })
  const lr = cards[LAST]?.r ?? 0
  const lc = cards[LAST]?.c ?? 0
  cards.forEach(cd => { cd.wd = 250 + Math.round(Math.hypot(cd.r - lr, cd.c - lc) * 60) })

  // The reader's flash and ring: one a read while the run is slow; while
  // it is fast, a read rings only when the last ring is 130ms old.
  const emits = { of: [], verdict: [] }
  let lastEmit = -1e9
  cards.forEach(cd => {
    if (cd.read - lastEmit >= READ_RING) { emits.verdict.push(cd.face.verdict); lastEmit = cd.read }
    emits.of.push(emits.verdict.length - 1)
  })

  // The beats after the sweep, in ms since the run's clock started.
  const E = cards.length ? cards[LAST].land : 640
  const B = { SWEEP: 0, READER_OUT: (cards[LAST]?.read ?? 640) + 200, WAVE: E + 10, DONE: E + 40, SEAL: E + 320 }
  B.IMPACT = B.SEAL + 370 // the drop's contact, 56% of .66s
  B.HAND = B.IMPACT + 600 // a milestone day hands over here: the stamp has settled
  B.ROLL = B.IMPACT + 800
  B.FLY = B.ROLL + 500
  B.PRESSED = B.FLY + 640
  B.CHIP = B.PRESSED + 400
  B.MERGE = B.CHIP + 720
  B.LANDED = B.MERGE + 600 // the total has counted to its figure
  B.ECHO = B.MERGE + 400
  B.TAIL = B.MERGE + 700
  B.FINAL = B.TAIL + 1100
  const order = ['SWEEP', 'READER_OUT', 'WAVE', 'DONE', 'SEAL', 'IMPACT', 'HAND', 'ROLL', 'FLY', 'PRESSED', 'CHIP', 'MERGE', 'ECHO', 'LANDED', 'TAIL', 'FINAL']
  const beats = order.map(k => B[k])

  const holes = cards.map(cd => ({
    x: cd.x, y: cd.y,
    d: Math.min(cd.c * 24 + (geo.rows - 1 - cd.r) * 18, 240),
  }))
  return { cards, B, order, beats, emits, holes, verdicts, finals }
}

/** A run's face's dictionary entry: a kanji by its character, a word by
 *  its spelling and reading, a grammar point by its card id, a kana by
 *  its syllabary; a deck of one's own has none. */
export function faceLookup(face) {
  if (!face?.term) return null
  const id = String(face.id ?? '').split('|')[0]
  if (face.line === 'kanji') return { category: 'kanji', term: face.term }
  if (face.line === 'vocab') return { category: 'vocab', term: face.term, kana: face.kana || undefined }
  if (face.line === 'grammar') return id ? { category: 'grammar', id } : null
  if (face.line === 'kana') {
    const code = face.term.codePointAt(0)
    return { category: code >= 0x30a0 && code <= 0x30ff ? 'katakana' : 'hiragana', term: face.term }
  }
  return null
}

/** The beat index (1-based count of beats reached) at `t` ms. */
export function beatAt(plan, t) {
  let beat = 0
  for (let i = 0; i < plan.beats.length; i++) if (plan.beats[i] <= t) beat = i + 1
  return beat
}

/** How many of the run's cards have been launched, read and landed (per zone) at `t`. */
export function countsAt(plan, t) {
  let launched = 0
  let read = 0
  const landed = plan.verdicts.map(() => 0)
  for (const cd of plan.cards) {
    if (cd.d <= t) launched += 1
    if (cd.read <= t) read += 1
    if (cd.land <= t) landed[cd.v] += 1
  }
  return { launched, read, landed }
}
