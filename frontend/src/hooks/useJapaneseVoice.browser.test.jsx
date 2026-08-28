import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { useJapaneseVoice } from './useJapaneseVoice'

// This hook decides whether the analyser's SpeakButton renders at all
// (ADR-0006: "hide or disable itself rather than failing silently"), so
// "does it react when getVoices() populates asynchronously" is the
// load-bearing case -- it is exactly the real Chrome behaviour a
// once-at-mount read would miss.

// window.speechSynthesis is a read-only getter on the real object, so a
// plain assignment throws -- redefine the property for the duration of
// each test and restore the original definition after.
const realDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')

function installFake(initialVoices) {
  let voices = initialVoices
  let listeners = []
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      addEventListener: (_, cb) => listeners.push(cb),
      removeEventListener: (_, cb) => { listeners = listeners.filter(l => l !== cb) },
    },
  })
  return {
    setVoices: next => {
      voices = next
      listeners.forEach(cb => cb())
    },
    listenerCount: () => listeners.length,
  }
}

afterEach(() => {
  if (realDescriptor) Object.defineProperty(window, 'speechSynthesis', realDescriptor)
})

function Probe() {
  const available = useJapaneseVoice()
  return <span data-testid="v">{available ? 'yes' : 'no'}</span>
}

describe('useJapaneseVoice', () => {
  it('returns false when getVoices() returns []', async () => {
    installFake([])
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('no')
  })

  it('returns true when a voice with lang "ja-JP" is present', async () => {
    installFake([{ lang: 'ja-JP' }])
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('yes')
  })

  it('returns true for lang "ja" -- the prefix match', async () => {
    installFake([{ lang: 'ja' }])
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('yes')
  })

  it('returns true for lang "ja_JP" -- the prefix match', async () => {
    installFake([{ lang: 'ja_JP' }])
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('yes')
  })

  it('flips from false to true when voiceschanged fires after voices populate', async () => {
    const fake = installFake([])
    const screen = await render(<Probe />)
    expect(screen.container.textContent).toBe('no')

    fake.setVoices([{ lang: 'ja-JP' }])
    await new Promise(r => setTimeout(r, 30))
    expect(screen.container.textContent).toBe('yes')
  })

  it('unsubscribes on unmount', async () => {
    const fake = installFake([])
    const screen = await render(<Probe />)
    expect(fake.listenerCount()).toBe(1)
    screen.unmount()
    expect(fake.listenerCount()).toBe(0)
  })
})
