import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import en from '../../locales/en/index.js'
import { PassBack } from './PassBack'
import { paceLabel, hourLabel } from '../settings/contract'
import { PACES } from '../onboarding/paces'
import { DAY_START_MIN, DAY_STEP_MIN, LAST_DEPARTURE_MIN, bucketFor, minutesToTime } from '../../domain/boarding'
// The real faces: whether a value fits its field is a question of the
// metrics the card is drawn in, not the runner's fallback's.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'
import '../../index.css'

// ── 定期券 — every value the back prints, whole (plan 247) ─────────
// The back's fields cut a value too long for them with an ellipsis, and
// in English the hour's field cut its own time: "Morning · 07:…", on
// the card the boarding issues and on the profile's. The columns are
// measured against what the fields can print, and this holds them to
// it: each pace the card names and the 15 the departure board adds,
// every departure the hour's board offers as the boarding prints it,
// Settings' flexible hour, in both tables. The card is drawn at its own
// size and scaled, so one width answers for every screen.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))

const BACK = {
  from: { code: 'N4', name: 'Élémentaire' },
  to: { code: 'N3', name: 'Intermédiaire' },
  valid: '28 août 2027',
  lines: ['vocab', 'kanji', 'grammar'],
  level: 1,
  into: 0,
  span: 100,
  share: 0,
  balance: 200,
  unlimited: false,
  cap: 200,
  unit: 'crédits offerts',
  note: '+1 toutes les 48 min',
  status: { status: 'onTime', word: 'À l’heure' },
  name: '',
  since: 'octobre 2026',
}

function printed(t) {
  const service = [...PACES.map(p => p.perDay), 15].map(n => paceLabel(t, n))
  const hour = [hourLabel(t, null)]
  for (let m = DAY_START_MIN; m <= LAST_DEPARTURE_MIN; m += DAY_STEP_MIN) {
    // BoardingFlow's contract: the bucket's name and the departure.
    hour.push(`${t.destHour[bucketFor(m)]} · ${minutesToTime(m)}`)
  }
  return { service, hour }
}

// A value's own run against the box that holds it: past it, the
// ellipsis shows.
function cut(el) {
  const run = document.createRange()
  run.selectNodeContents(el)
  return run.getBoundingClientRect().width - el.getBoundingClientRect().width
}

const value = (screen, door) => screen.container.querySelector(`[data-door="${door}"] .pcb__value`)

describe('the back\'s fields', () => {
  it('print every pace and every departure whole, in both tables', async () => {
    await document.fonts.ready
    const back = data => (
      <LangProvider>
        <PassBack tier="free" data={data} doors={{ open: () => {}, onSign: () => {} }} />
      </LangProvider>
    )
    const screen = await render(back({ ...BACK, service: '', hour: '' }))
    await document.fonts.ready
    const over = []
    for (const [lang, t] of [['fr', fr], ['en', en]]) {
      const { service, hour } = printed(t)
      for (const text of service) {
        await screen.rerender(back({ ...BACK, service: text, hour: '' }))
        if (cut(value(screen, 'service')) > 0) over.push(`${lang} service "${text}"`)
      }
      for (const text of hour) {
        await screen.rerender(back({ ...BACK, service: '', hour: text }))
        if (cut(value(screen, 'hour')) > 0) over.push(`${lang} hour "${text}"`)
      }
    }
    expect(over).toEqual([])
  })

  it('stands the lines\' › clear of their marks', async () => {
    const screen = await render(
      <LangProvider>
        <PassBack tier="free" data={{ ...BACK, service: '10 / jour', hour: '07:30' }} doors={{ open: () => {}, onSign: () => {} }} />
      </LangProvider>
    )
    await document.fonts.ready
    const door = screen.container.querySelector('[data-door="lines"]')
    const chev = door.querySelector('.pcb__chev').getBoundingClientRect()
    for (const mark of door.querySelectorAll('.pcb__line')) {
      const box = mark.getBoundingClientRect()
      const meet = chev.left < box.right && box.left < chev.right && chev.top < box.bottom && box.top < chev.bottom
      expect(meet, mark.textContent).toBe(false)
    }
  })
})
