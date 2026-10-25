import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── The gesture that lets the app play, and every one after ─────────
// A finger grants a page the right to play when it lifts, not when it
// lands: context.js listened to pointerdown alone, once, so on a phone
// the context was made and asked to resume before the browser would
// allow it, and nothing asked again. And Safari puts a context that
// has played to sleep on its own (`interrupted`: a call, a locked
// screen), which nothing woke. What is pinned here is when the context
// is made and when it is woken; the browser's own refusal behind it is
// the browser's business, so the context is a recorder.

class FakeContext {
  state = 'suspended'
  resume = vi.fn(() => { this.state = 'running'; return Promise.resolve() })
}

const realContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
let audio
let fresh = 0

beforeEach(async () => {
  Object.defineProperty(window, 'AudioContext', { value: FakeContext, configurable: true, writable: true })
  // No gesture yet, whatever the runner's page has seen.
  Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: false }, configurable: true })
  // A module of its own per test, not yet unlocked. vi.resetModules()
  // hands the browser lane back the instance it already has; a query
  // is a new one. (The earlier ones still listen, each to its own
  // context, which no assertion here reads.)
  audio = await import(/* @vite-ignore */ `./context.js?test=${++fresh}`)
})

afterEach(() => {
  if (realContext) Object.defineProperty(window, 'AudioContext', realContext)
  delete navigator.userActivation
  delete document.hidden
})

function press(type, init = {}) {
  const event = type === 'pointerdown' ? new PointerEvent(type, { bubbles: true, ...init })
    : type === 'keydown' ? new KeyboardEvent(type, { bubbles: true, ...init })
    : new Event(type, { bubbles: true })
  window.dispatchEvent(event)
}

/** A context made by a tap, then put to sleep as Safari does. */
function interrupted() {
  press('click')
  const ctx = audio.getAudioContext()
  ctx.state = 'interrupted'
  ctx.resume.mockClear()
  return ctx
}

describe('the first gesture', () => {
  it('waits for a finger to lift', () => {
    const unlocked = vi.fn()
    audio.whenUnlocked(unlocked)

    press('pointerdown', { pointerType: 'touch' })
    expect(unlocked).not.toHaveBeenCalled()
    expect(audio.getAudioContext()).toBeNull()

    press('touchend')
    expect(unlocked).toHaveBeenCalledOnce()
    const ctx = audio.getAudioContext()
    expect(ctx).toBeInstanceOf(FakeContext)
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('takes a mouse button going down, as before', () => {
    const unlocked = vi.fn()
    audio.whenUnlocked(unlocked)
    press('pointerdown', { pointerType: 'mouse' })
    expect(unlocked).toHaveBeenCalledOnce()
  })

  it('takes a tap that only reaches us as a click', () => {
    const unlocked = vi.fn()
    audio.whenUnlocked(unlocked)
    press('click')
    expect(unlocked).toHaveBeenCalledOnce()
  })

  it('does not take Escape', () => {
    const unlocked = vi.fn()
    audio.whenUnlocked(unlocked)
    press('keydown', { key: 'Escape' })
    expect(unlocked).not.toHaveBeenCalled()
    press('keydown', { key: ' ' })
    expect(unlocked).toHaveBeenCalledOnce()
  })
})

describe('the session', () => {
  // iOS mutes a page's Web Audio under the silent switch unless the
  // page asks for a video's session; asked before the context exists,
  // so its first sound is already in it.
  it('asks to play through the silent switch before the context is made', () => {
    const session = { type: 'auto' }
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true })
    try {
      press('click')
      expect(session.type).toBe('playback')
      expect(audio.getAudioContext()).toBeInstanceOf(FakeContext)
    } finally {
      delete navigator.audioSession
    }
  })

  it('makes the context all the same where there is no session to ask', () => {
    press('click')
    expect(audio.getAudioContext()).toBeInstanceOf(FakeContext)
  })
})

describe('a context put to sleep', () => {
  it('is woken by the next tap', () => {
    const ctx = interrupted()
    press('touchend')
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(ctx.state).toBe('running')
  })

  it('is woken by the next sound', () => {
    const ctx = interrupted()
    audio.getAudioContext()
    expect(ctx.resume).toHaveBeenCalledOnce()
  })

  it('is left asleep while the page is hidden', () => {
    const ctx = interrupted()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    press('touchend')
    audio.getAudioContext()
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('is not asked again once awake', () => {
    press('click')
    const ctx = audio.getAudioContext()
    ctx.resume.mockClear()
    press('touchend')
    press('click')
    expect(ctx.resume).not.toHaveBeenCalled()
  })
})

describe('the decoded clips', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Every word heard through the server is a clip of its own, and a
  // session's worth used to be kept to the end of it.
  it('keeps the ones asked for last and lets the oldest go', async () => {
    const fetched = []
    vi.stubGlobal('fetch', vi.fn(async url => {
      fetched.push(url)
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
    }))
    press('click')
    audio.getAudioContext().decodeAudioData = vi.fn(async () => ({}))
    const times = url => fetched.filter(u => u === url).length

    for (let i = 0; i < 200; i++) await audio.getBuffer(`/clip/${i}`)
    // Asked for again, the oldest goes to the back of the line...
    await audio.getBuffer('/clip/0')
    expect(times('/clip/0')).toBe(1)
    // ...so the one past the limit lets the next oldest go instead.
    await audio.getBuffer('/clip/200')
    await audio.getBuffer('/clip/0')
    expect(times('/clip/0')).toBe(1)
    await audio.getBuffer('/clip/1')
    expect(times('/clip/1')).toBe(2)
  })
})
