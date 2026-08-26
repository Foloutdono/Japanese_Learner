import { describe, it, expect } from 'vitest'
import { loadImage, toBlob } from './image'

// fitWithin's arithmetic is unit-tested in image.test.js. What THAT
// cannot check is whether toBlob actually crops the region it was told
// to -- the canvas drawImage call takes eight arguments and getting the
// source/destination pair backwards produces a plausible-looking image
// of the WRONG part of the photo. No error, just silently recognizing
// text the learner didn't select.
//
// So this runs in a real browser against a real canvas: build an image
// with known colour regions, crop to one of them, and read the pixels
// back.

const RED = [255, 0, 0]
const BLUE = [0, 0, 255]

// A Blob, not a data URL: loadImage takes what a file input gives it,
// and testing it with a different input type would test a code path the
// app never runs.
function makeTwoToneImage(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.fillRect(0, 0, width / 2, height)          // left half red
  ctx.fillStyle = 'rgb(0,0,255)'
  ctx.fillRect(width / 2, 0, width / 2, height)  // right half blue
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

async function blobToPixel(blob, atX = 0.5, atY = 0.5) {
  const img = await loadImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const x = Math.floor(img.naturalWidth * atX)
  const y = Math.floor(img.naturalHeight * atY)
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
  return [r, g, b]
}

function closeTo(actual, expected, tolerance = 40) {
  return actual.every((v, i) => Math.abs(v - expected[i]) <= tolerance)
}

describe('toBlob cropping (real canvas)', () => {
  it('crops to the requested region, not the whole image', async () => {
    const img = await loadImage(await makeTwoToneImage(400, 200))
    // Right half only -- must come back blue throughout.
    const blob = await toBlob(img, { x: 200, y: 0, width: 200, height: 200 })
    const centre = await blobToPixel(blob, 0.5, 0.5)
    const leftEdge = await blobToPixel(blob, 0.05, 0.5)
    expect(closeTo(centre, BLUE)).toBe(true)
    expect(closeTo(leftEdge, BLUE)).toBe(true)
  })

  it('crops the other half correctly too', async () => {
    const img = await loadImage(await makeTwoToneImage(400, 200))
    const blob = await toBlob(img, { x: 0, y: 0, width: 200, height: 200 })
    expect(closeTo(await blobToPixel(blob, 0.5, 0.5), RED)).toBe(true)
  })

  it('keeps both halves when no crop is given', async () => {
    const img = await loadImage(await makeTwoToneImage(400, 200))
    const blob = await toBlob(img, null)
    expect(closeTo(await blobToPixel(blob, 0.25, 0.5), RED)).toBe(true)
    expect(closeTo(await blobToPixel(blob, 0.75, 0.5), BLUE)).toBe(true)
  })

  it('downscales a large image to the long-edge cap', async () => {
    const img = await loadImage(await makeTwoToneImage(3200, 1600))
    const blob = await toBlob(img, null)
    const out = await loadImage(blob)
    expect(out.naturalWidth).toBe(1600)
    expect(out.naturalHeight).toBe(800)
  })

  it('encodes JPEG, which is what keeps a photo from growing', async () => {
    const img = await loadImage(await makeTwoToneImage(400, 200))
    const blob = await toBlob(img, null)
    expect(blob.type).toBe('image/jpeg')
  })
})
