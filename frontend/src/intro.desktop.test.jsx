import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 入門 on the desk (plan 170) ─────────────────────────────────────
// The boarding's desk frame (plan 163): the question at the paper's
// corner, the strip of six named stops at the floor's left end, a stop
// behind a door back to its screen, the way out at the top-right corner
// rather than over the gate. From the keys alone: a digit picks what
// prints it (a script, a vowel, a word, the swap), Enter goes on, and
// the last Enter boards the cards.

const track = vi.hoisted(() => vi.fn())
vi.mock('./lib/track', () => ({ track: (...a) => track(...a), flush: vi.fn() }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const audio = vi.hoisted(() => ({ playKana: vi.fn(), speakJapanese: vi.fn() }))
vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playKana: (...a) => audio.playKana(...a),
  preloadKana: vi.fn(),
  speakJapanese: (...a) => audio.speakJapanese(...a),
  playClick: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => ({ kanaKnown: 'none', dailyNewTarget: 10, lines: null }),
}))

const { default: RideIntro } = await import('./screens/RideIntro')
const { default: fr } = await import('./locales/fr/index.js')

const VOLUMES = {
  vocab: { N5: 678, N4: 643, N3: 1738, N2: 1767, N1: 3229 },
  kanji: { N5: 103, N4: 144, N3: 366, N2: 367, N1: 1232 },
  grammar: { N5: 93, N4: 110, N3: 110, N2: 115, N1: 117 },
  kana: 238,
}
const settle = (ms = 900) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()
const $ = s => document.querySelector(s)
const live = () => $('.brd__car:not(.brd__car--out)')
const stepOf = () => $('main.nyu')?.dataset.step

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/ride/intro']}>
        <Routes>
          <Route path="/ride/intro" element={<RideIntro session={{ access_token: 'tok' }} volumes={VOLUMES} />} />
          <Route path="/ride/cards" element={<p data-testid="cards">cards</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(200)
}

beforeEach(() => {
  track.mockClear()
  audio.playKana.mockClear()
  audio.speakJapanese.mockClear()
})

describe('入門 on the desk', () => {
  it('stands in the boarding desk frame: the strip, the corner and the floor', async () => {
    await mount()
    expect($('main.brd.desk-brd.nyu')).not.toBeNull()
    expect($('.brd__head')).toBeNull()
    const stops = [...document.querySelectorAll('.desk-brd__sp')]
    expect(stops.map(s => s.dataset.stop)).toEqual(['scripts', 'sounds', 'table', 'katakana', 'sentence', 'route'])
    expect(stops.map(s => s.textContent)).toEqual(['scripts', 'sounds', 'table', 'katakana', 'sentence', 'route'].map(k => fr.nyuStop[k]))
    expect($('.desk-brd__strip').getAttribute('aria-label')).toBe(fr.nyuStripAria)
    expect(stops[0].getAttribute('aria-current')).toBe('step')
    // The way out at the top-right corner, clear of the question.
    const skip = $('main.nyu > .nyu-skip')
    expect(skip.textContent).toBe(fr.nyuSkip)
    expect(rect(skip).right).toBeGreaterThan(window.innerWidth - 120)
    expect(rect(skip).top).toBeLessThan(120)
    expect(rect(skip).height).toBeGreaterThanOrEqual(44)
    expect(live().querySelector('.brd__foot [data-action="skip"]')).toBeNull()
    // The strip and the gate on one floor, neither under the other.
    const gate = live().querySelector('[data-action="continue"]')
    const strip = $('.desk-brd__strip')
    expect(rect(gate).bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(rect(strip).right).toBeLessThanOrEqual(rect(gate).left)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('holds every screen in its body at 1100×800, the sentence\'s words unbroken', async () => {
    await mount()
    for (const step of ['scripts', 'sounds', 'table', 'katakana', 'sentence', 'route']) {
      expect(stepOf()).toBe(step)
      const body = live().querySelector('.brd__body')
      expect(body.scrollHeight - body.clientHeight, step).toBeLessThanOrEqual(1)
      // コーヒー and 飲みます had broken across two lines on a 1100px paper.
      for (const word of live().querySelectorAll('.nyu-stn__jp')) {
        expect(word.getClientRects().length, word.textContent).toBe(1)
        expect(rect(word).height, word.textContent).toBeLessThan(1.6 * parseFloat(getComputedStyle(word).fontSize))
      }
      if (step === 'route') break
      live().querySelector('[data-action="continue"]').click()
      await settle()
    }
  })

  it('walks the six screens from the keys and boards the cards on the last Enter', async () => {
    await mount()
    // 1 · the digit picks the script it prints.
    await userEvent.keyboard('2')
    await settle(60)
    expect(live().querySelector('[data-script="kata"]').getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('sounds')

    // 2 · a digit says its vowel.
    await userEvent.keyboard('4')
    expect(audio.playKana).toHaveBeenLastCalledWith('e')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('table')
    // The sum stands beside the table and fills once け is found.
    expect(live().querySelector('.nyu-sum__ring--is').textContent).toBe('?')
    live().querySelector('[data-kana="け"]').click()
    await settle(60)
    expect(live().querySelector('.nyu-sum__ring--is').textContent).toBe('け')
    const table = rect(live().querySelector('.nyu-table'))
    const sum = rect(live().querySelector('.nyu-sum'))
    expect(sum.left).toBeGreaterThanOrEqual(table.right)
    live().querySelector('.brd__q').focus()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('katakana')

    // 4 · a digit says its word whole.
    await userEvent.keyboard('2')
    expect(audio.speakJapanese).toHaveBeenLastCalledWith('コーヒー')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(stepOf()).toBe('sentence')

    // 5 · the swap on 1.
    await userEvent.keyboard('1')
    await settle(60)
    expect([...live().querySelectorAll('.nyu-stn__jp')].map(w => w.textContent)).toEqual(['コーヒー', '駅', '飲みます'])

    // A stop behind is a door back to its screen.
    $('.desk-brd__sp[data-stop="table"] button').click()
    await settle()
    expect(stepOf()).toBe('table')
    live().querySelector('.brd__q').focus()
    for (const want of ['katakana', 'sentence', 'route']) {
      await userEvent.keyboard('{Enter}')
      await settle()
      expect(stepOf()).toBe(want)
    }
    expect(live().querySelector('[data-action="continue"]').textContent).toContain(fr.nyuTryCard)
    await userEvent.keyboard('{Enter}')
    await settle(200)
    expect($('[data-testid="cards"]')).not.toBeNull()
    const [, last] = track.mock.calls.filter(([n]) => n === 'ride_step').at(-1)
    expect(last).toMatchObject({ step: 'intro-route', to: 'cards', dir: 'fwd' })
  })
})
