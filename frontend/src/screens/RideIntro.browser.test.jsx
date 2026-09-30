import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 入門 — the introduction before the first card (plan 170) ─────
// Six screens, walked as a learner would: a script lit in the sentence,
// a vowel heard, « ke » found where row k meets column e, a katakana word
// said whole, the two tagged words swapped with the meaning kept, the ride
// dated -- then the cards. The way out boards the cards too, and the
// trail says which way was taken.

const track = vi.hoisted(() => vi.fn())
vi.mock('../lib/track', () => ({ track: (...a) => track(...a), flush: vi.fn() }))
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const audio = vi.hoisted(() => ({ playKana: vi.fn(), preloadKana: vi.fn(), speakJapanese: vi.fn() }))
vi.mock('../lib/audio', async o => ({
  ...(await o()),
  playKana: (...a) => audio.playKana(...a),
  preloadKana: (...a) => audio.preloadKana(...a),
  speakJapanese: (...a) => audio.speakJapanese(...a),
  playClick: vi.fn(),
}))
vi.mock('../stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => ({ kanaKnown: 'none', dailyNewTarget: 10, lines: null }),
}))

const { default: RideIntro } = await import('./RideIntro')
// The lane runs fr-FR: the copy is asserted from the French table.
const { default: fr } = await import('../locales/fr/index.js')

const VOLUMES = {
  vocab: { N5: 678, N4: 643, N3: 1738, N2: 1767, N1: 3229 },
  kanji: { N5: 103, N4: 144, N3: 366, N2: 367, N1: 1232 },
  grammar: { N5: 93, N4: 110, N3: 110, N2: 115, N1: 117 },
  kana: 238,
}
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

async function mount() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/ride/intro']}>
        <Routes>
          <Route path="/ride/intro" element={<RideIntro session={{ access_token: 'tok' }} volumes={VOLUMES} />} />
          <Route path="/ride/cards" element={<p data-testid="cards">cards</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(150)
  return screen.container
}

async function next(root) {
  live(root).querySelector('[data-action="continue"]').click()
  await settle(350)
}

beforeEach(() => {
  track.mockClear()
  audio.playKana.mockClear()
  audio.preloadKana.mockClear()
  audio.speakJapanese.mockClear()
})

describe('入門, the six screens', () => {
  it('walks the map of the language to the cards', async () => {
    const root = await mount()
    expect(root.querySelector('main.brd.nyu').dataset.step).toBe('scripts')
    expect(live(root).querySelector('.brd__q').textContent).toBe(fr.nyuScriptsQ)

    // 1 · hiragana lit on arrival; katakana lights コーヒー and dims the rest.
    const lit = () => [...live(root).querySelectorAll('.nyu-run--on')].map(r => r.textContent).join('')
    expect(lit()).toBe('でをみます')
    live(root).querySelector('[data-script="kata"]').click()
    await settle()
    expect(lit()).toBe('コーヒー')
    expect(live(root).querySelector('[data-script="kata"]').getAttribute('aria-pressed')).toBe('true')
    await next(root)

    // 2 · the vowels are warmed on arrival and heard on a touch.
    expect(audio.preloadKana).toHaveBeenCalledWith(['a', 'i', 'u', 'e', 'o'])
    live(root).querySelector('[data-vowel="e"]').click()
    await settle()
    expect(audio.playKana).toHaveBeenCalledWith('e')
    expect(live(root).querySelector('.nyu-vowel--on [data-vowel="e"]')).not.toBeNull()
    await next(root)

    // 3 · « ke » where row k meets column e: heard, read, found.
    expect(audio.preloadKana.mock.calls.at(-1)[0]).toHaveLength(46)
    live(root).querySelector('[data-kana="か"]').click()
    await settle()
    expect(live(root).querySelector('.nyu-cell--found')).toBeNull()
    live(root).querySelector('[data-kana="け"]').click()
    await settle()
    expect(audio.playKana).toHaveBeenLastCalledWith('ke')
    expect(live(root).querySelector('.nyu-cell--found').dataset.kana).toBe('け')
    expect(live(root).querySelector('.brd__hint').textContent).toContain('k + e = ke.')
    await next(root)

    // 4 · a word is said whole, not its first sign.
    live(root).querySelector('[data-word="coffee"]').click()
    await settle()
    expect(audio.speakJapanese).toHaveBeenCalledWith('コーヒー')
    expect(live(root).querySelector('[data-word="coffee"] .nyu-word__beats').textContent).toBe('kō · hī')
    await next(root)

    // 5 · swapped, the café comes first, the verb stays last and the
    // meaning holds.
    const words = () => [...live(root).querySelectorAll('.nyu-stn__jp')].map(w => w.textContent)
    expect(words()).toEqual(['駅', 'コーヒー', '飲みます'])
    live(root).querySelector('[data-action="swap"]').click()
    await settle()
    expect(words()).toEqual(['コーヒー', '駅', '飲みます'])
    expect(live(root).querySelector('.nyu-fr').textContent).toBe(fr.nyuTranslation)
    await next(root)

    // 6 · the ride dated at the learner's pace, and the gate to the cards.
    const title = live(root).querySelector('.brd__q').textContent
    expect(title).not.toBe(fr.nyuRouteQSoon)
    expect(live(root).querySelectorAll('.nyu-route__stop')).toHaveLength(3)
    expect(live(root).querySelectorAll('.nyu-route__date')).toHaveLength(2)
    const gate = live(root).querySelector('[data-action="continue"]')
    expect(gate.textContent).toContain(fr.nyuTryCard)
    gate.click()
    await settle(200)
    expect(root.querySelector('[data-testid="cards"]')).not.toBeNull()

    const steps = track.mock.calls.filter(([name]) => name === 'ride_step').map(([, p]) => `${p.step}>${p.to}`)
    expect(steps).toEqual([
      'intro-scripts>intro-sounds',
      'intro-sounds>intro-table',
      'intro-table>intro-katakana',
      'intro-katakana>intro-sentence',
      'intro-sentence>intro-route',
      'intro-route>cards',
    ])
  })

  it('goes back a screen with ‹ and leaves for the cards on its way out', async () => {
    const root = await mount()
    expect(root.querySelector('.brd__back--void')).not.toBeNull()
    await next(root)
    root.querySelector('.brd__head .brd__back').click()
    await settle(350)
    expect(root.querySelector('main.brd.nyu').dataset.step).toBe('scripts')

    const skip = live(root).querySelector('[data-action="skip"]')
    expect(skip.textContent).toBe(fr.nyuSkip)
    skip.click()
    await settle(200)
    expect(root.querySelector('[data-testid="cards"]')).not.toBeNull()
    const [, last] = track.mock.calls.filter(([name]) => name === 'ride_step').at(-1)
    expect(last).toMatchObject({ step: 'intro-scripts', to: 'cards', dir: 'skip' })
  })
})
