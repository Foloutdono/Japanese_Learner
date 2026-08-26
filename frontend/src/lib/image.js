// ── Image preparation for OCR ─────────────────────────────────
// Crop and downscale before upload. Both matter for accuracy, not just
// for bytes: recognition quality is dominated by how much irrelevant
// pixel area surrounds the target text, and a whole-page photo asks the
// model to transcribe everything the learner did not want.

// Long-edge cap before upload. A GUESS, not a measurement -- the same
// honesty plan 018 applied to its confidence thresholds. Downscaling is
// the one lossy step this client performs, so if small print
// disappoints, raise this before blaming the model.
export const MAX_EDGE = 1600

export const JPEG_QUALITY = 0.9

// Must agree with routes/ocr.py's _MAX_IMAGE_BYTES. The backend rejects
// anything larger with a 413; this is the client-side guard so a phone
// photo (routinely 4-12 MB) never gets that far.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/**
 * Fit (width, height) inside a square of `maxEdge`, preserving aspect
 * ratio. Returns the original size when it already fits -- upscaling a
 * small image adds no information and only costs bytes.
 *
 * Pure, so it can be unit-tested without a canvas.
 */
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / longest
  return {
    // Never round down to zero: a very wide, very short image
    // (a single line of text) would otherwise lose its height entirely.
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')) }
    img.src = url
  })
}

/**
 * Draw `img` (optionally cropped to `crop`, in NATURAL image
 * coordinates) onto a canvas at a size fitting MAX_EDGE, and encode it.
 *
 * JPEG rather than PNG deliberately: a photograph re-encoded as PNG is
 * routinely LARGER than the original, which would defeat the point of
 * downscaling at all.
 */
export function toBlob(img, crop = null, maxEdge = MAX_EDGE) {
  const sx = crop ? Math.max(0, Math.round(crop.x)) : 0
  const sy = crop ? Math.max(0, Math.round(crop.y)) : 0
  const sw = crop ? Math.max(1, Math.round(crop.width)) : img.naturalWidth
  const sh = crop ? Math.max(1, Math.round(crop.height)) : img.naturalHeight

  const { width, height } = fitWithin(sw, sh, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // White behind the drawing: a JPEG has no alpha channel, and a
  // transparent source would otherwise encode as black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not encode that image'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}


// The one real invariant of ImageCropper, in one place: a rectangle
// dragged in DISPLAY space becomes one in NATURAL image space. The
// component calls this and so does its test -- duplicating it would
// let the tested version and the used version drift.
export function rectToNatural(displayRect, displayBox, naturalSize) {
  const scaleX = naturalSize.width / displayBox.width
  const scaleY = naturalSize.height / displayBox.height
  return {
    x: Math.max(0, displayRect.x * scaleX),
    y: Math.max(0, displayRect.y * scaleY),
    width: Math.min(naturalSize.width, displayRect.w * scaleX),
    height: Math.min(naturalSize.height, displayRect.h * scaleY),
  }
}
