import { useEffect, useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import cards from '../../testing/grammarLadder.json'
import '../../index.css'

// ── Speak on reveal ─────────────────────────────────────────────
// A kana or vocab card says its word when it is revealed, a grammar,
// reading or translation card its sentence; the speaker switch beside
// the hints (or in a sentence run's head) stops it, for every run, and
// the choice is kept. What is pinned: the switch stands where a card
// speaks even with no hint to offer, a tap turns it off and keeps that,
// off means the reveal says nothing, and a run's next card says nothing
// before its own reveal.

const speakSentence = vi.fn()
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), speakSentence: (...a) => speakSentence(...a), playToggle: vi.fn() }))

const { default: HintBar } = await import('./HintBar')
const { default: SpeakToggle } = await import('./SpeakToggle')
const { useRevealSpeech } = await import('../../hooks/useRevealSpeech')
const { grammarSentence } = await import('../../domain/cardShape')
const { isSpeakOnReveal, toggleSpeakOnReveal } = await import('../../lib/audio')

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))

async function mount(node) {
  const screen = await render(<LangProvider>{node}</LangProvider>)
  await settle()
  return screen
}

function Card({ text }) {
  const [revealed, setRevealed] = useState(false)
  useRevealSpeech(text, revealed)
  return (
    <>
      <button type="button" className="reveal" onClick={() => setRevealed(true)}>reveal</button>
      <button type="button" className="hide" onClick={() => setRevealed(false)}>hide</button>
      <span className="rerender">{String(revealed)}</span>
    </>
  )
}

// A card run's shape (GrammarRun, TodayRun): the reveal is reset in an
// effect once the next card is drawn, so that card renders once under
// the last card's reveal.
function Run({ sentences }) {
  const [at, setAt] = useState(0)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { setRevealed(false) }, [at])
  useRevealSpeech(sentences[at], revealed, at)
  return (
    <>
      <button type="button" className="reveal" onClick={() => setRevealed(true)}>reveal</button>
      <button type="button" className="next" onClick={() => setAt(i => i + 1)}>next</button>
    </>
  )
}

beforeEach(() => {
  speakSentence.mockReset()
  localStorage.setItem('lang', 'en')
  if (!isSpeakOnReveal()) toggleSpeakOnReveal()
})
afterEach(() => {
  localStorage.removeItem('lang')
  if (!isSpeakOnReveal()) toggleSpeakOnReveal()
  localStorage.removeItem('jp-app-speak-on-reveal')
})

describe('the switch', () => {
  it('stands last beside the hints, and alone on a card that speaks with none to offer', async () => {
    const withHints = (await mount(
      <HintBar available={['indice_3', 'indice_1']} active={[]} onToggle={() => {}} speaks />,
    )).container
    const buttons = [...withHints.querySelectorAll('.study-assist button')]
    expect(buttons).toHaveLength(3)
    expect(buttons.at(-1).dataset.action).toBe('speak-on-reveal')

    const alone = (await mount(<HintBar available={[]} active={[]} onToggle={() => {}} speaks />)).container
    expect(alone.querySelectorAll('.study-assist button')).toHaveLength(1)
  })

  it('is not offered on a card that says nothing', async () => {
    const root = (await mount(<HintBar available={[]} active={[]} onToggle={() => {}} />)).container
    expect(root.querySelector('.study-assist')).toBeNull()
  })

  it('is on until tapped, then off, and the choice is kept', async () => {
    const root = (await mount(<SpeakToggle />)).container
    const button = root.querySelector('[data-action="speak-on-reveal"]')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('Speak on reveal')

    button.click()
    await settle()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(isSpeakOnReveal()).toBe(false)
    expect(localStorage.getItem('jp-app-speak-on-reveal')).toBe('0')
  })

  it("wears the run head's icon switch in a sentence run", async () => {
    const root = (await mount(<SpeakToggle variant="head" />)).container
    expect(root.querySelector('.btn-icon-toggle.btn-icon-toggle--on')).not.toBeNull()
  })
})

describe('the reveal', () => {
  it('says the sentence once when the answer is revealed', async () => {
    const root = (await mount(<Card text="水だけ飲みました。" />)).container
    expect(speakSentence).not.toHaveBeenCalled()

    root.querySelector('.reveal').click()
    await settle()
    root.querySelector('.reveal').click()
    await settle()
    expect(speakSentence).toHaveBeenCalledTimes(1)
    expect(speakSentence).toHaveBeenCalledWith('水だけ飲みました。')

    // The next card, even with the same sentence, speaks again.
    root.querySelector('.hide').click()
    await settle()
    root.querySelector('.reveal').click()
    await settle()
    expect(speakSentence).toHaveBeenCalledTimes(2)
  })

  it("does not say the next card's sentence before it is revealed", async () => {
    // Drawn under the last card's reveal for a render, the next card
    // said its sentence on arrival: on Choisir, its answer.
    const root = (await mount(<Run sentences={['水だけ飲みました。', '窓を開けてください。']} />)).container
    root.querySelector('.reveal').click()
    await settle()
    root.querySelector('.next').click()
    await settle()
    expect(speakSentence.mock.calls.map(c => c[0])).toEqual(['水だけ飲みました。'])

    root.querySelector('.reveal').click()
    await settle()
    expect(speakSentence.mock.calls.map(c => c[0])).toEqual(['水だけ飲みました。', '窓を開けてください。'])
  })

  it('says nothing with the switch off', async () => {
    toggleSpeakOnReveal()
    const root = (await mount(<Card text="水だけ飲みました。" />)).container
    root.querySelector('.reveal').click()
    await settle()
    expect(speakSentence).not.toHaveBeenCalled()
  })
})

describe("a grammar card's sentence", () => {
  it("is Choisir's question with its hole filled, Construire's once checked, Écrire's model", () => {
    expect(grammarSentence(cards.choose)).toBe(cards.choose.contrast.jp)
    // The answer stays on the server until the verdict brings it.
    expect(grammarSentence(cards.build)).toBeNull()
    expect(grammarSentence(cards.build, { jp: '窓を開けてください。' })).toBe('窓を開けてください。')
    expect(grammarSentence(cards.write)).toBe(cards.write.write.model.jp)
  })

  it('is none on a rule or a meaning flipped', () => {
    expect(grammarSentence({ mode: 'grammar.flashcard.f2b', grammar: '〜てください' })).toBeNull()
  })
})
