import { describe, it, expect } from 'vitest'
import { fitWithin, MAX_EDGE, MAX_UPLOAD_BYTES } from './image'

// fitWithin is the only pure part of image.js -- toBlob and loadImage
// need a real canvas/DOM and are exercised by the component tests.
describe('fitWithin', () => {
  it('leaves an already-small image alone rather than upscaling it', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('caps the long edge of a landscape image and keeps the ratio', () => {
    const out = fitWithin(3200, 2400)
    expect(out.width).toBe(MAX_EDGE)
    expect(out.height).toBe(1200)
  })

  it('caps the long edge of a portrait image and keeps the ratio', () => {
    const out = fitWithin(2400, 3200)
    expect(out.height).toBe(MAX_EDGE)
    expect(out.width).toBe(1200)
  })

  it('handles a square image', () => {
    expect(fitWithin(4000, 4000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE })
  })

  it('returns integers', () => {
    const out = fitWithin(3333, 1777)
    expect(Number.isInteger(out.width)).toBe(true)
    expect(Number.isInteger(out.height)).toBe(true)
  })

  it('never collapses a dimension to zero', () => {
    // A single wide line of text: naive rounding takes the height to 0
    // and the canvas draws nothing.
    const out = fitWithin(20000, 5)
    expect(out.width).toBe(MAX_EDGE)
    expect(out.height).toBeGreaterThanOrEqual(1)
  })

  it('respects an explicit maxEdge', () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50 })
  })
})

describe('upload limit', () => {
  it('agrees with routes/ocr.py _MAX_IMAGE_BYTES (8 MB)', () => {
    // Both sides must agree or the backend 413s on images the client
    // thought were fine. Each file names the other in a comment.
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024)
  })
})
