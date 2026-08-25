import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ImageInput } from './ImageInput'

// Real OCR is deliberately NOT exercised here (slow, flaky, and tests
// Tesseract rather than this component -- see plan 018's test plan).
// `recognize` is mocked so this test proves what ImageInput itself is
// responsible for: handing recognized text to the caller in an
// EDITABLE field via onTextReady, and never analyzing or submitting
// anything on its own.
vi.mock('../../lib/ocr', () => ({
  recognize: vi.fn(async () => ({ text: '日本語のテスト', confidence: 92 })),
  JAPANESE_SCRIPT_RE: /[぀-ゟ゠-ヿ一-鿿]/,
}))

const T = {}

function makeImageFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })
}

describe('ImageInput', () => {
  it('hands recognized text to onTextReady rather than analyzing it itself', async () => {
    globalThis.fetch = vi.fn()
    const onTextReady = vi.fn()
    const screen = await render(<ImageInput t={T} onTextReady={onTextReady} />)

    const fileInput = screen.container.querySelector('.analysis-image-input__file')
    const file = makeImageFile()
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    fileInput.files = dataTransfer.files
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(onTextReady).toHaveBeenCalledWith('日本語のテスト'))

    // ImageInput never calls the network itself -- the caller decides
    // when (and whether) to analyze the text it was handed.
    expect(globalThis.fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('renders no visible text output of its own -- the editable field lives in the caller', async () => {
    // ImageInput intentionally has no textarea/output of its own; the
    // recognized text is handed to the CALLER's own editable field
    // (PhraseAnalyzerScreen's textarea) via onTextReady, never rendered
    // here. This guards against a future change accidentally adding a
    // second, un-editable display of the OCR result.
    const screen = await render(<ImageInput t={T} onTextReady={() => {}} />)
    expect(screen.container.querySelectorAll('textarea').length).toBe(0)
  })
})
