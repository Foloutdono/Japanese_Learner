import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { ImageInput } from './ImageInput'

// Neither OCR tier is exercised for real: the remote one would need a
// model and the local one tests Tesseract rather than this component.
// Both are mocked so these tests prove what ImageInput itself owns --
// pick -> crop -> recognize -> onTextReady, which tier gets called, and
// that each failure gets its OWN message.
const recognize = vi.fn(async () => ({ text: 'ローカル', remote: false }))
const recognizeRemote = vi.fn(async () => ({ text: '日本語のテスト', remote: true }))

vi.mock('../../lib/ocr', () => ({
  recognize: (...a) => recognize(...a),
  recognizeRemote: (...a) => recognizeRemote(...a),
  JAPANESE_SCRIPT_RE: /[぀-ゟ゠-ヿ一-鿿]/,
}))

// loadImage/toBlob need a decodable image and a real canvas; the bytes
// below are not a real PNG, so stub the pair. fitWithin has its own
// pure unit tests in lib/image.test.js.
vi.mock('../../lib/image', async importOriginal => ({
  ...(await importOriginal()),
  loadImage: vi.fn(async () => ({ naturalWidth: 100, naturalHeight: 80 })),
  toBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })),
}))

const T = {
  takePhoto: 'Take a photo',
  chooseImage: 'Choose an image',
  useWholeImage: 'Use the whole image',
  ocrLocalOption: 'Read on my device',
  ocrTooLarge: 'TOO_LARGE',
  ocrLimitReached: 'LIMIT',
  ocrUnavailable: 'UNAVAILABLE',
  ocrFailed: 'FAILED',
}

function pick(screen, index = 1) {
  // index 0 is the camera input (capture), 1 is the gallery input.
  const inputs = screen.container.querySelectorAll('.analysis-image-input__file')
  const dt = new DataTransfer()
  dt.items.add(new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' }))
  inputs[index].files = dt.files
  inputs[index].dispatchEvent(new Event('change', { bubbles: true }))
  return inputs
}

function clickText(screen, text) {
  const btn = [...screen.container.querySelectorAll('button')]
    .find(b => b.textContent.includes(text))
  btn.click()
  return btn
}

const tick = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  recognize.mockClear()
  recognizeRemote.mockClear()
  globalThis.fetch = vi.fn()
})

describe('ImageInput', () => {
  it('offers a camera input AND a gallery input, only one with capture', async () => {
    // The bug this fixes: `capture` sends a phone straight to the camera
    // and hides the gallery, so a single input could not honour a UI
    // that promised both. Verifiable here; the phone behaviour itself is
    // not, which is why plan 024's manual test insists on a real device.
    const screen = await render(<ImageInput t={T} session={{}} onTextReady={() => {}} />)
    const inputs = screen.container.querySelectorAll('.analysis-image-input__file')
    expect(inputs.length).toBe(2)
    expect(inputs[0].hasAttribute('capture')).toBe(true)
    expect(inputs[1].hasAttribute('capture')).toBe(false)
  })

  it('shows the cropper after a file is picked rather than recognizing immediately', async () => {
    const screen = await render(<ImageInput t={T} session={{}} onTextReady={() => {}} />)
    pick(screen)
    await tick()
    expect(screen.container.querySelector('.analysis-cropper')).not.toBeNull()
    expect(recognizeRemote).not.toHaveBeenCalled()
  })

  it('uses the REMOTE tier on confirm and hands the text to onTextReady', async () => {
    const onTextReady = vi.fn()
    const screen = await render(<ImageInput t={T} session={{}} onTextReady={onTextReady} />)
    pick(screen)
    await tick()
    clickText(screen, T.useWholeImage)
    await tick(); await tick()
    expect(recognizeRemote).toHaveBeenCalled()
    expect(recognize).not.toHaveBeenCalled()
    expect(onTextReady).toHaveBeenCalledWith('日本語のテスト')
  })

  it('uses the LOCAL tier when the on-device option is chosen', async () => {
    const onTextReady = vi.fn()
    const screen = await render(<ImageInput t={T} session={{}} onTextReady={onTextReady} />)
    pick(screen)
    await tick()
    clickText(screen, T.ocrLocalOption)
    await tick(); await tick()
    expect(recognize).toHaveBeenCalled()
    expect(recognizeRemote).not.toHaveBeenCalled()
    expect(onTextReady).toHaveBeenCalledWith('ローカル')
  })

  it.each([
    [413, 'TOO_LARGE'],
    [429, 'LIMIT'],
    [503, 'UNAVAILABLE'],
  ])('renders its own message for HTTP %i', async (status, expected) => {
    // Collapsing these into one "couldn't read this image" is what makes
    // a rate-limited feature look broken rather than busy.
    recognizeRemote.mockRejectedValueOnce(Object.assign(new Error('x'), { status }))
    const screen = await render(<ImageInput t={T} session={{}} onTextReady={() => {}} />)
    pick(screen)
    await tick()
    clickText(screen, T.useWholeImage)
    await tick(); await tick()
    expect(screen.container.querySelector('.analysis-image-input__error').textContent)
      .toBe(expected)
  })
})
