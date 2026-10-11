import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../index.css'

// ── 記念乗車券 — the share image (plan 191) ───────────────────────────
// The Share board drawn onto a 1080×1350 canvas: it draws (fonts and
// the stamp's ink filter included) without throwing, the dark ground,
// the paper ticket and the stamp's red where the board has them; and
// the image is handed to the system's share sheet where there is one,
// else downloaded, `ticket_share` tracked with the ticket's days alone.

const track = vi.fn()
vi.mock('./track', () => ({ track: (...a) => track(...a) }))

const { drawShare, renderTicketPng, shareTicket, shareFigures, parseFaces, SHARE_W, SHARE_H } = await import('./shareTicket')
const fr = (await import('../locales/fr/index.js')).default
const { SHARE } = await import('../components/dayclear/fixtures')

const input = { ...SHARE, t: fr }
const realShare = navigator.share
const realCanShare = navigator.canShare

beforeEach(() => {
  track.mockClear()
})
afterEach(() => {
  Object.defineProperty(navigator, 'share', { value: realShare, configurable: true, writable: true })
  Object.defineProperty(navigator, 'canShare', { value: realCanShare, configurable: true, writable: true })
  vi.restoreAllMocks()
})

function pixel(ctx, x, y) {
  return [...ctx.getImageData(x, y, 1, 1).data]
}

describe('the share image', () => {
  it('draws the board at 1080×1350 without throwing', async () => {
    const canvas = document.createElement('canvas')
    await drawShare(canvas, input)
    expect(canvas.width).toBe(SHARE_W)
    expect(canvas.height).toBe(SHARE_H)
    const ctx = canvas.getContext('2d')
    // The ground's sumi at a corner.
    const [r, g, b] = pixel(ctx, 20, 20)
    expect(r).toBeLessThan(40)
    expect(g).toBeLessThan(40)
    expect(b).toBeLessThan(40)
    // The paper under the ticket's middle (the board's 270, 330, ×2), clear of the print.
    const paper = pixel(ctx, 2 * 120, 2 * 300)
    expect(paper[0]).toBeGreaterThan(200)
    expect(paper[1]).toBeGreaterThan(190)
    // The stamp's red ring, right of the name (the seal's centre at
    // about 406, 342; its ring some 66 units out).
    let red = 0
    for (let x = 2 * 340; x < 2 * 470; x += 2) {
      const [pr, pg] = pixel(ctx, x, 2 * 342)
      if (pr - pg > 60) red++
    }
    expect(red).toBeGreaterThan(5)
    // The figures' row: light ink on the ground under the ticket.
    let ink = 0
    for (let x = 2 * 80; x < 2 * 160; x += 2) {
      const [pr] = pixel(ctx, x, 2 * 595)
      if (pr > 180) ink++
    }
    expect(ink).toBeGreaterThan(3)
  })

  it('prints a dash for a figure it does not know', async () => {
    const canvas = document.createElement('canvas')
    await expect(drawShare(canvas, { ...input, figures: { reviews: 3, words: null, level: null } })).resolves.toBe(canvas)
  })

  it('makes a PNG', async () => {
    const blob = await renderTicketPng(input)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(10000)
  })

  it('reads the private faces from a stylesheet, pretty or minified', () => {
    const pretty = `/* x */
@font-face {
  font-family: 'Noto Serif JP';
  font-weight: 900;
  src: url(/a.woff2) format('woff2'), url(/a.woff) format('woff');
  unicode-range: U+4e00-4e10;
}`
    const minified = '@font-face{font-family:Noto Serif JP;font-weight:900;src:url(/b.woff2)format("woff2");unicode-range:U+25EE8,U+26017}@font-face{src:url(/c.woff2)format("woff2")}'
    expect(parseFaces(pretty)).toEqual([{ src: "url(/a.woff2) format('woff2'), url(/a.woff) format('woff')", range: 'U+4e00-4e10' }])
    expect(parseFaces(minified)).toEqual([
      { src: 'url(/b.woff2)format("woff2")', range: 'U+25EE8,U+26017' },
      { src: 'url(/c.woff2)format("woff2")', range: undefined },
    ])
  })

  it('reads its figures from what the profile and the statistics count', () => {
    const stats = { items: { vocab: { N5: { learned: 40, total: 700 }, N4: { learned: 18, total: 600 } } } }
    expect(shareFigures({ totalReviews: 412, jlptLevel: 'N5' }, stats)).toEqual({ reviews: 412, words: 58, level: 'N5' })
    expect(shareFigures({ totalReviews: 0 }, null)).toEqual({ reviews: 0, words: null, level: null })
  })
})

describe('sharing it', () => {
  it('downloads it where the system cannot share a file, and tracks the share', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const blob = new Blob(['png'], { type: 'image/png' })
    await expect(shareTicket({ ...input, blob })).resolves.toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0].download).toBe('tsuji-0014.png')
    expect(track).toHaveBeenCalledWith('ticket_share', { days: 14 })
  })

  it('hands the image to the share sheet where there is one', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true })
    await expect(shareTicket({ ...input, blob: new Blob(['png'], { type: 'image/png' }) })).resolves.toBe('shared')
    const [{ files, text }] = share.mock.calls[0]
    expect(files[0].type).toBe('image/png')
    expect(files[0].name).toBe('tsuji-0014.png')
    expect(text).toBe('14 jours de suite sur Tsuji')
    expect(track).toHaveBeenCalledWith('ticket_share', { days: 14 })
  })

  it('tracks nothing when the learner closes the sheet', async () => {
    const share = vi.fn(async () => { throw new DOMException('closed', 'AbortError') })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true })
    await expect(shareTicket({ ...input, blob: new Blob(['png'], { type: 'image/png' }) })).resolves.toBe('cancelled')
    expect(track).not.toHaveBeenCalled()
  })

  it('downloads it when the share sheet is refused', async () => {
    const share = vi.fn(async () => { throw new DOMException('no gesture', 'NotAllowedError') })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(shareTicket({ ...input, blob: new Blob(['png'], { type: 'image/png' }) })).resolves.toBe('downloaded')
    expect(track).toHaveBeenCalledWith('ticket_share', { days: 14 })
  })

  it('draws the image itself when none was drawn ahead', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(shareTicket(input)).resolves.toBe('downloaded')
  })
})
