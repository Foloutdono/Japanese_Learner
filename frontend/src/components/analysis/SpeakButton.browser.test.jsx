import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SpeakButton } from './SpeakButton'

// docs/adr/0006 requires the control to hide itself (not just disable)
// when the browser has no Japanese voice, and to reach the mixer's
// speakJapanese rather than construct its own utterance. These cases
// pin both, plus the stopPropagation guard the two mount points
// (inside a Sentence's badge row, beside a Token's surface button) both
// rely on.

const realDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
const realUtterance = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance')

// speakJapanese now picks a voice OBJECT rather than setting `lang` and
// hoping (lib/audio/speech.js: a device with no Japanese voice does not
// report a failure, it reads the kana with whatever voice it has). A
// real SpeechSynthesisUtterance refuses any `voice` that is not a real
// SpeechSynthesisVoice, and a test can construct neither — so the
// utterance is a recorder here, beside the synthesiser that is already
// one.
class FakeUtterance {
  constructor(text) { this.text = text }
}

function installFake(voices) {
  // Calling onstart is what a device that actually speaks does, and
  // what tells speech.js it need not fall back to the server clip.
  const speak = vi.fn(utterance => utterance.onstart?.())
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      speak,
    },
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance })
  return { speak }
}

afterEach(() => {
  if (realDescriptor) Object.defineProperty(window, 'speechSynthesis', realDescriptor)
  if (realUtterance) Object.defineProperty(window, 'SpeechSynthesisUtterance', realUtterance)
})

const t = { hearThis: 'Hear this' }

describe('SpeakButton', () => {
  it('renders nothing when no Japanese voice is available', async () => {
    installFake([])
    const screen = await render(<SpeakButton text="こんにちは" t={t} />)
    expect(screen.container.querySelector('button')).toBeNull()
  })

  it('renders a button with a non-empty aria-label when a voice is available', async () => {
    installFake([{ lang: 'ja-JP' }])
    const screen = await render(<SpeakButton text="こんにちは" t={t} />)
    const button = screen.container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-label')).toBeTruthy()
  })

  it('renders nothing when text is empty, even with a voice present', async () => {
    installFake([{ lang: 'ja-JP' }])
    const screen = await render(<SpeakButton text="" t={t} />)
    expect(screen.container.querySelector('button')).toBeNull()
  })

  it('clicking calls through to the synthesiser with an utterance matching the text', async () => {
    const fake = installFake([{ lang: 'ja-JP' }])
    const screen = await render(<SpeakButton text="こんにちは" t={t} />)
    screen.container.querySelector('button').click()
    expect(fake.speak).toHaveBeenCalledTimes(1)
    expect(fake.speak.mock.calls[0][0].text).toBe('こんにちは')
  })

  it('does not let the click bubble, so a wrapping click handler never fires', async () => {
    installFake([{ lang: 'ja-JP' }])
    const wrapperClick = vi.fn()
    const screen = await render(
      <div onClick={wrapperClick}>
        <SpeakButton text="こんにちは" t={t} />
      </div>,
    )
    screen.container.querySelector('button').click()
    expect(wrapperClick).not.toHaveBeenCalled()
  })
})
