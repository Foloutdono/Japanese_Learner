import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { cdp } from 'vitest/browser'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 目盛 — the score read off its bar (plan 254) ────────────────────
// The owner's pick A of the canvas "Tsuji — the exam result, animated",
// pinned against the real cascade at phone width: the bar fills from
// nothing in the neutral ink with the figures counting, the target's tick
// lights as it is passed (the chime then, and only then), and the verdict
// lands on a line whose room was held from the first frame. A press ends
// it; reduced motion and a link to a question draw it ended.

const playCorrect = vi.fn()
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playCorrect: () => playCorrect(),
}))

// LangProvider asks for /api/translations/* on mount; keep it offline.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { ScoreReveal } = await import('./ScoreReveal')

const wait = ms => new Promise(r => setTimeout(r, ms))

// Chromium's own preference, through the lane's CDP session: the hook
// reads matchMedia and the stylesheet its @media block, and this reaches
// both (states.phone.test.jsx).
async function reducedMotion(on) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: on ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
  })
}

async function mount(props) {
  const screen = await render(
    <LangProvider>
      <div className="exam-res__score">
        <ScoreReveal base="exam-res" target={60} {...props} />
        <span className="cap">Objectif 60 %</span>
      </div>
    </LangProvider>
  )
  return s => screen.container.querySelector(s)
}

describe('the score read off its bar', () => {
  beforeEach(() => playCorrect.mockClear())
  afterEach(() => reducedMotion(false))

  it('fills from nothing and lands on the verdict, chiming as it passes the target', async () => {
    const $ = await mount({ correct: 19, total: 25, pct: 76 })
    expect($('.exam-res__fig').textContent).toBe('0')
    expect($('.exam-res__pct').className).toBe('exam-res__pct exam-res__pct--run')
    expect($('.exam-score__fill').className).toBe('exam-score__fill exam-score__fill--run')
    expect($('.exam-res__tick').className).toBe('exam-res__tick')
    const verdict = $('.exam-score__verdict')
    expect(getComputedStyle(verdict).visibility).toBe('hidden')
    expect(verdict.getBoundingClientRect().height).toBeGreaterThan(0)
    const capTop = $('.cap').getBoundingClientRect().top
    expect(playCorrect).not.toHaveBeenCalled()

    await wait(2300)
    expect($('.exam-res__fig').textContent).toBe('19')
    expect($('.exam-res__pct').textContent).toBe('76 %')
    expect($('.exam-res__pct').className).toBe('exam-res__pct')
    expect($('.exam-score__fill').className).toBe('exam-score__fill')
    expect($('.exam-score__fill').style.transform).toBe('')
    expect($('.exam-res__tick').className).toBe('exam-res__tick exam-res__tick--lit')
    expect($('.exam-score__ping')).not.toBeNull()
    expect($('.exam-score__owed')).toBeNull()
    expect(getComputedStyle(verdict).visibility).toBe('visible')
    expect(verdict.textContent).toBe('Objectif atteint')
    // The verdict's line was held: nothing under it moved when it landed.
    expect($('.cap').getBoundingClientRect().top).toBe(capTop)
    expect(playCorrect).toHaveBeenCalledTimes(1)
  })

  it('ends at a press and, short of the target, hatches what is owed', async () => {
    const $ = await mount({ correct: 12, total: 25, pct: 48 })
    window.dispatchEvent(new PointerEvent('pointerdown'))
    await wait(60)
    expect($('.exam-res__fig').textContent).toBe('12')
    expect($('.exam-res__pct').className).toBe('exam-res__pct exam-res__pct--low')
    expect($('.exam-score__fill').className).toBe('exam-score__fill exam-score__fill--low')
    const owed = $('.exam-score__owed')
    expect(owed.style.left).toBe('48%')
    expect(owed.style.width).toBe('12%')
    expect($('.exam-res__tick').className).toBe('exam-res__tick')
    expect($('.exam-score__ping')).toBeNull()
    const verdict = $('.exam-score__verdict')
    expect(verdict.className).toBe('exam-score__verdict exam-score__verdict--low exam-score__verdict--in')
    expect(verdict.textContent).toBe('À 3 bonnes réponses de l’objectif')
    expect(playCorrect).not.toHaveBeenCalled()
  })

  it('counts the answers owed from the counts, not the rounded percentage', async () => {
    // 4 of 7 is 57 %: the target wants 4.2, so one more answer.
    const $ = await mount({ correct: 4, total: 7, pct: 57, still: true })
    expect($('.exam-score__verdict').textContent).toBe('À 1 bonne réponse de l’objectif')
  })

  it('is drawn ended under reduced motion, with no ring', async () => {
    await reducedMotion(true)
    const $ = await mount({ correct: 19, total: 25, pct: 76 })
    expect($('.exam-res__fig').textContent).toBe('19')
    expect($('.exam-score__fill').className).toBe('exam-score__fill')
    expect($('.exam-score__verdict').classList.contains('exam-score__verdict--in')).toBe(true)
    expect(getComputedStyle($('.exam-score__verdict')).animationName).toBe('arrive-soft')
    expect($('.exam-score__ping')).toBeNull()
    expect(playCorrect).toHaveBeenCalledTimes(1)
  })

  it('is drawn ended on a link to a question, with no ring', async () => {
    const $ = await mount({ correct: 19, total: 25, pct: 76, still: true })
    expect($('.exam-res__fig').textContent).toBe('19')
    expect($('.exam-res__tick').className).toBe('exam-res__tick exam-res__tick--lit')
    expect($('.exam-score__ping')).toBeNull()
  })
})
