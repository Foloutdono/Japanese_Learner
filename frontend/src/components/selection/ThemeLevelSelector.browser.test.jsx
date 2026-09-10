import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playUi: vi.fn() }))
const { default: ThemeLevelSelector } = await import('./ThemeLevelSelector')
// The browser lane runs at locale fr-FR (see vite.config.js), so the
// captions come out of the French table. Read from it rather than
// hard-coding them, so adding a language or rewording a band does not
// break a test that is really about the pairing.
const { default: fr } = await import('../../locales/fr/index.js')
const { THEME_LEVELS, THEME_LEVEL_JP, themeLevelLabel } = await import('../../domain/themes')

// ── A theme's four bands, drawn as the line they are ────────────
// A theme is cut into 基本 · 中級 · 上級 · 達人 by frequency, easiest
// first. That is an ordered line, so it borrows RouteStops — the same
// component the JLPT levels and the kana sets ride — rather than a
// fourth thing that looks like it.
//
// What these pin is the part a rebuild or a rename can silently break:
// the order, the pairing, and the two figures deliberately NOT drawn.

const THEMES = [{
  key: 'fruits',
  count: 24,
  levels: [
    { level: 'basic', count: 5 },
    { level: 'medium', count: 6 },
    { level: 'advanced', count: 6 },
    { level: 'expert', count: 7 },
  ],
}]

let originalFetch

beforeEach(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(async () => new Response(
    JSON.stringify({ themes: THEMES }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))
})
afterEach(() => { globalThis.fetch = originalFetch })

async function stops(onSelect = () => {}) {
  const screen = await render(
    <LangProvider>
      <ThemeLevelSelector session={null} theme="fruits" onSelect={onSelect} />
    </LangProvider>
  )
  await expect.poll(
    () => screen.container.querySelectorAll('.route-stop').length,
  ).toBe(4)
  return [...screen.container.querySelectorAll('.route-stop')]
}

describe('ThemeLevelSelector', () => {
  it('draws the four bands easiest-first', async () => {
    const rows = await stops()
    expect(rows.map(r => r.querySelector('.route-stop__code').textContent))
      .toEqual(THEME_LEVELS.map(k => THEME_LEVEL_JP[k]))
    expect(THEME_LEVELS).toEqual(['basic', 'medium', 'advanced', 'expert'])
  })

  it('pairs each Japanese name with its plain-language caption', async () => {
    // DESIGN.md's one rule: the Japanese is the heading, the Latin is
    // its caption — and never a transliteration ('基本' pairs with
    // 'Basic', not with 'Kihon').
    const rows = await stops()
    const codes = rows.map(r => r.querySelector('.route-stop__code'))
    expect(codes.every(c => c.getAttribute('lang') === 'ja')).toBe(true)
    expect(rows.map(r => r.querySelector('.route-stop__jp').textContent))
      .toEqual(THEME_LEVELS.map(k => themeLevelLabel(fr, k)))
    // Never a transliteration: 基本 pairs with 'Base', not with 'Kihon'.
    expect(rows.every((r, i) =>
      r.querySelector('.route-stop__jp').textContent !== THEME_LEVEL_JP[THEME_LEVELS[i]]
    )).toBe(true)
  })

  it('prints each band’s word count', async () => {
    const rows = await stops()
    const hints = rows.map(r => r.querySelector('.route-stop__hint').textContent)
    expect(hints.map(h => h.trim().split(' ')[0])).toEqual(['5', '6', '6', '7'])
  })

  it('caps the rail at both ends', async () => {
    // The rail is drawn per stop so the ends can be capped — a line
    // running off the top of the first row reads as "there is more up
    // there", which for a four-band ladder there is not.
    const rows = await stops()
    expect(rows[0].classList.contains('route-stop--first')).toBe(true)
    expect(rows[3].classList.contains('route-stop--last')).toBe(true)
  })

  it('marks no band as "you are here"', async () => {
    // There is no stored "your band" the way there is a stored JLPT
    // level, so nothing may claim to be the learner's position and no
    // band may be drawn as already passed.
    const rows = await stops()
    expect(rows.some(r => r.classList.contains('route-stop--current'))).toBe(false)
    expect(rows.some(r => r.classList.contains('route-stop--past'))).toBe(false)
  })

  it('prints no learned/total figure', async () => {
    // Theme progress is per-MODE and the mode is not chosen until the
    // next screen, so there is no honest figure to print here.
    // RouteStops renders `learned ?? 0`, so passing them at all would
    // stamp "0 / 24" on every band forever.
    const rows = await stops()
    expect(rows.some(r => r.querySelector('.route-stop__fig'))).toBe(false)
  })

  it('hands back the band key', async () => {
    const onSelect = vi.fn()
    const rows = await stops(onSelect)
    rows[2].click()
    expect(onSelect).toHaveBeenCalledWith('advanced')
  })
})
