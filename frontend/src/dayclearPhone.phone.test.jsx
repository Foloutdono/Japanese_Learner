import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 — the everyday clear and the partial finish, on a phone (plan 191) ──
// The canvas's Main and Partial boards as ClearPhone and PartialFinish
// draw them at 390×844: the rest state's figures from the boards' data
// story, a tap (and Enter) skipping to it, reduced motion opening on it,
// the piles three or two by the learner's bar, a milestone day handing
// over after the stamp instead of paying the fare, and the partial
// finish's figures and its two ways out.

const sounds = vi.hoisted(() => ({ stamp: 0, clear: 0, tick: 0 }))
vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playDayClear: vi.fn(() => { sounds.clear += 1 }),
  playStamp: vi.fn(() => { sounds.stamp += 1 }),
  playFareTick: vi.fn(() => { sounds.tick += 1 }),
  playArrival: vi.fn(),
  playClick: vi.fn(),
}))
const scale = vi.hoisted(() => ({ value: 'full' }))
vi.mock('./stores/ratingScale', () => ({ useRatingScale: () => scale.value }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: ClearPhone } = await import('./components/dayclear/ClearPhone')
const { default: PartialFinish, loopOf } = await import('./components/dayclear/PartialFinish')
const { entryOf } = await import('./components/dayclear/PileSheet')
const { InkFilters } = await import('./components/dayclear/kit')
const { clearModel } = await import('./domain/dayClear')
const { RUN_DAY, CLEAR_DAY, RUN_PARTIAL, CLEAR_PARTIAL, CARDS_32, RUN_TICKET7, CLEAR_TICKET7 } = await import('./components/dayclear/fixtures')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const text = el => el?.textContent.replace(/\s+/g, ' ').trim()

async function mountClear({ run = RUN_DAY, result = CLEAR_DAY, ...props } = {}) {
  const calls = { fare: 0, handover: 0, leave: 0 }
  const screen = await render(
    <LangProvider>
      <InkFilters />
      <ClearPhone
        result={result}
        run={run}
        model={clearModel(result, run)}
        onFareBeat={() => { calls.fare += 1 }}
        onHandover={() => { calls.handover += 1 }}
        onLeave={() => { calls.leave += 1 }}
        {...props}
      />
    </LangProvider>,
  )
  return { screen, calls }
}

const pileNumbers = root => [...root.querySelectorAll('.clr-phone__pile .clr-phone__pile-n')].map(n => n.textContent)
const pileNames = root => [...root.querySelectorAll('.clr-phone__pile .clr-phone__pile-name')].map(n => n.textContent)

// The board's rest, read off the screen.
function expectRest(root) {
  expect(text(root.querySelector('.clrk-hdr__title'))).toBe('Service terminé')
  expect(root.querySelectorAll('.clrk-week > .clrk-slot')).toHaveLength(7)
  expect(root.querySelector('.clrk-week').lastElementChild.className).toContain('clrk-slot--now')
  expect(text(root.querySelector('.clr-phone__streak'))).toBe('6 jours de suite')
  expect(text(root.querySelector('.clr-phone__total .clrk-xp')).replace(/\s/g, '')).toBe('+252')
  expect(text(root.querySelector('.clr-phone__break'))).toBe('+197 trajet · +55 prime de série')
  expect(pileNumbers(root)).toEqual(['6', '18', '8'])
  expect(pileNames(root)).toEqual(['À revoir', 'Justes', 'Parfaites'])
  expect(text(root.querySelector('.clr-phone__sum'))).toBe('4 montent · 1 maîtrisée · 11 min')
  expect(text(root.querySelector('.clr-phone__tomorrow-main'))).toBe('Demain · ~18 cartes · 6 min')
  expect(text(root.querySelector('.clr-phone__tomorrow-sub')).replace(/\s/g, ' ')).toBe('7e jour : billet de la semaine +250 xp')
  expect(text(root.querySelector('.clr-phone__gate .btn-depart--gate'))).toContain('Retour à la gare')
}

beforeEach(() => {
  scale.value = 'full'
  sounds.stamp = 0
  sounds.clear = 0
  sounds.tick = 0
})

describe('ClearPhone, the everyday clear', () => {
  it('opens on the rest at once under reduced motion, the board\'s figures from the fixtures', async () => {
    const { screen, calls } = await mountClear({ reduced: true })
    await settle()
    const root = screen.container.querySelector('main.clr-phone')
    expect(root.className).toContain('clrk--reduced')
    expectRest(root)
    // the sweep's pieces are gone, the cards rest on their piles
    expect(root.querySelector('.clr-phone__count')).toBeNull()
    expect(root.querySelector('.clr-phone__reader')).toBeNull()
    expect(root.querySelector('.clr-phone__clipB').className).toContain('clr-phone--rest')
    // plain gold, no shimmer and no glints
    expect(root.querySelector('.clrk-xp-shine')).toBeNull()
    expect(root.querySelector('.clrk-xp-glint')).toBeNull()
    expect(calls.fare).toBe(1)
    expect(calls.handover).toBe(0)
    expect(sounds.clear).toBe(1)
  })

  it('begins on the deck and the count of the day\'s trip', async () => {
    const { screen } = await mountClear()
    await settle(120)
    const root = screen.container.querySelector('main.clr-phone')
    expect(text(root.querySelector('.clr-phone__cap'))).toBe('Le trajet du jour')
    expect(text(root.querySelector('.clr-phone__of'))).toBe('/ 32')
    expect(root.querySelector('.clr-phone__reader .clrk-reader')).not.toBeNull()
    expect(root.querySelectorAll('.clr-phone__deck .clr-phone__card--a')).toHaveLength(32)
    expect(root.querySelector('.clr-phone__clipB').className).toContain('clr-phone--live')
    expect(root.querySelector('.clr-phone__fare')).toBeNull()
  })

  it('skips to the rest on a tap: the fare said once, the shimmer on', async () => {
    const { screen, calls } = await mountClear()
    await settle(300)
    const root = screen.container.querySelector('main.clr-phone')
    root.click()
    await settle()
    expect(root.className).toContain('clrk--skip')
    expectRest(root)
    expect(root.querySelector('.clr-phone__total .clrk-xp-shine')).not.toBeNull()
    expect(calls.fare).toBe(1)
    expect(sounds.clear).toBe(1)
    // at rest a tap does nothing more
    root.click()
    await settle()
    expect(calls.fare).toBe(1)
    // the gate leaves
    root.querySelector('.clr-phone__gate .btn-depart--gate').click()
    expect(calls.leave).toBe(1)
  })

  it('skips on Enter, as on a tap', async () => {
    const { screen, calls } = await mountClear()
    await settle(200)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle()
    const root = screen.container.querySelector('main.clr-phone')
    expect(root.className).toContain('clrk--skip')
    expectRest(root)
    expect(calls.fare).toBe(1)
  })

  it('stands the rest on the screen: nothing over anything, the gate at the foot', async () => {
    const { screen } = await mountClear({ reduced: true })
    await settle()
    const root = screen.container.querySelector('main.clr-phone')
    const box = s => root.querySelector(s).getBoundingClientRect()
    const piles = [...root.querySelectorAll('.clr-phone__pile')].map(p => p.getBoundingClientRect())
    expect(box('.clr-phone__streak').bottom).toBeLessThan(box('.clr-phone__fare').top)
    expect(box('.clr-phone__fare').bottom).toBeLessThan(Math.min(...piles.map(p => p.top)))
    expect(Math.max(...piles.map(p => p.bottom)) + 8).toBeLessThan(box('.clr-phone__sum').top)
    expect(box('.clr-phone__sum').bottom).toBeLessThan(box('.clr-phone__tomorrow').top)
    expect(box('.clr-phone__tomorrow').bottom).toBeLessThan(box('.clr-phone__gate').top)
    expect(box('.clr-phone__gate').bottom).toBeLessThanOrEqual(window.innerHeight - 20)
    // the board's places at 844
    expect(Math.round(box('.clr-phone__fare').top)).toBe(264)
    expect(Math.round(box('.clr-phone__tomorrow').top)).toBe(650)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('opens a pile at rest on the list of its cards', async () => {
    const { screen } = await mountClear({ reduced: true })
    await settle()
    const wrong = screen.container.querySelector('.clr-phone__pile')
    expect(wrong.getAttribute('aria-label').replace(/\s/g, ' ')).toBe('À revoir : 6 cartes')
    wrong.click()
    await settle()
    const sheet = document.querySelector('.clr-pile-sheet[role="dialog"]')
    expect(sheet).not.toBeNull()
    const rows = [...sheet.querySelectorAll('.clr-pile-sheet__term')].map(t => t.textContent)
    expect(rows).toEqual(['火', '飲む', '〜に', '大きい', '友達', '来る'])
    expect(text(sheet.querySelector('.sheet__jp'))).toBe('À revoir')
    // a card opens its dictionary entry in the list's place, and the list
    // comes back when it closes
    sheet.querySelector('.clr-pile-sheet__row').click()
    await settle(200)
    expect(document.querySelector('.dict-sheet[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('.clr-pile-sheet')).toBeNull()
    document.querySelector('.dict-sheet .btn-secondary').click()
    await settle()
    expect(document.querySelector('.dict-sheet')).toBeNull()
    expect(document.querySelector('.clr-pile-sheet[role="dialog"]')).not.toBeNull()
  })
})

describe('ClearPhone, three piles or two', () => {
  const noPerfect = { ...RUN_DAY, cards: CARDS_32.map(c => (c.verdict === 2 ? { ...c, verdict: 1 } : c)) }

  it('has two piles, centred, when the learner\'s bar offers no Perfect', async () => {
    scale.value = 'simple'
    const { screen } = await mountClear({ run: noPerfect, reduced: true })
    await settle()
    const root = screen.container.querySelector('main.clr-phone')
    expect(pileNames(root)).toEqual(['À revoir', 'Justes'])
    expect(pileNumbers(root)).toEqual(['6', '26'])
    const [a, b] = [...root.querySelectorAll('.clr-phone__pile')].map(p => p.getBoundingClientRect())
    const mid = window.innerWidth / 2
    expect(Math.abs((a.left + b.right) / 2 - mid)).toBeLessThan(8)
  })

  it('has three when the bar offers Perfect, however few it holds', async () => {
    scale.value = 'full'
    const { screen } = await mountClear({ run: noPerfect, reduced: true })
    await settle()
    const root = screen.container.querySelector('main.clr-phone')
    expect(pileNumbers(root)).toEqual(['6', '26', '0'])
    expect(root.querySelectorAll('.clr-phone__pile')[2].disabled).toBe(true)
  })

  it('keeps a Perfect the run holds, rated on a bar that offered it', async () => {
    scale.value = 'simple'
    const { screen } = await mountClear({ reduced: true })
    await settle()
    expect(pileNumbers(screen.container)).toEqual(['6', '18', '8'])
  })
})

describe('ClearPhone on a milestone day', () => {
  const model7 = () => clearModel(CLEAR_TICKET7, RUN_TICKET7)

  it('hands over on a tap instead of paying the fare', async () => {
    const { screen, calls } = await mountClear({ run: RUN_TICKET7, result: CLEAR_TICKET7, model: model7(), handover: true })
    await settle(200)
    screen.container.querySelector('main.clr-phone').click()
    await settle()
    expect(calls.handover).toBe(1)
    expect(calls.fare).toBe(0)
  })

  it('hands over once the stamp is pressed and the streak home, the fare never drawn', async () => {
    const one = { ...RUN_TICKET7, cards: RUN_TICKET7.cards.slice(0, 1), cleared: 1 }
    const { screen, calls } = await mountClear({ run: one, result: CLEAR_TICKET7, model: clearModel(CLEAR_TICKET7, one), handover: true })
    const root = screen.container.querySelector('main.clr-phone')
    let sawFare = false
    let sawSeal = false
    const deadline = performance.now() + 7000
    while (!calls.handover && performance.now() < deadline) {
      sawFare ||= Boolean(root.querySelector('.clr-phone__fare'))
      sawSeal ||= Boolean(root.querySelector('.clr-phone__seal'))
      await settle(50)
    }
    expect(calls.handover).toBe(1)
    expect(calls.fare).toBe(0)
    expect(sawSeal).toBe(true)
    expect(sawFare).toBe(false)
    expect(sounds.stamp).toBe(1)
    expect(sounds.clear).toBe(1)
    // the streak went home unrolled: the milestone rolls it
    expect(text(root.querySelector('.clr-phone__streak'))).toBe('6 jours de suite')
  }, 10000)
})

describe('PileSheet\'s doors', () => {
  it('opens each card\'s entry by its line', () => {
    expect(entryOf({ id: 'k_日|kanji.f2b', term: '日', kana: 'ひ', line: 'kanji' })).toEqual({ term: '日', category: 'kanji' })
    expect(entryOf({ id: 'v1|vocab.f2b', term: '電車', kana: 'でんしゃ', line: 'vocab' })).toEqual({ term: '電車', kana: 'でんしゃ', category: 'vocab' })
    expect(entryOf({ id: 'grammar_N5_は|grammar.ladder', term: '〜は', kana: 'topic', line: 'grammar' })).toEqual({ id: 'grammar_N5_は', category: 'grammar' })
    expect(entryOf({ id: 'k|kana', term: 'カ', line: 'kana' }).category).toBe('katakana')
    expect(entryOf({ id: 'k|kana', term: 'か', line: 'kana' }).category).toBe('hiragana')
  })
})

describe('PartialFinish, cards left today', () => {
  async function mountPartial(props = {}) {
    const calls = { cont: 0, leave: 0 }
    const screen = await render(
      <LangProvider>
        <InkFilters />
        <PartialFinish
          result={CLEAR_PARTIAL}
          run={RUN_PARTIAL}
          onContinue={() => { calls.cont += 1 }}
          onLeave={() => { calls.leave += 1 }}
          {...props}
        />
      </LangProvider>,
    )
    return { screen, calls }
  }

  it('prints the leg\'s fare, the day as a loop and what is left of it', async () => {
    const { screen } = await mountPartial()
    await settle(150)
    const root = screen.container.querySelector('main.ptl')
    expect(text(root.querySelector('.clrk-hdr__cap'))).toBe('途中下車')
    expect(text(root.querySelector('.clrk-hdr__title'))).toBe('Trajet terminé')
    const figs = [...root.querySelectorAll('.ptl__fig')].map(text)
    expect(figs).toEqual(['20 révisions', '+118 xp', '85% justes'])
    expect(root.querySelector('.ptl__xp.clrk-xp-shine')).not.toBeNull()
    expect(root.querySelector('.ptl__loop').getAttribute('aria-label'))
      .toBe('20 cartes sur 34 aujourd’hui ; le tampon du jour attend au bout des 14 autres'.replace(' ;', '\u00a0;'))
    // a stop a card but the terminus and this one: 19 ridden, 13 ahead
    expect(root.querySelectorAll('.ptl__stop')).toHaveLength(32)
    expect(root.querySelectorAll('.ptl__stop--done')).toHaveLength(19)
    expect(text(root.querySelector('.ptl__left'))).toBe('14 cartes restent aujourd’hui')
    expect(text(root.querySelector('.ptl__tease'))).toBe('~5 min pour le tampon du jour et la prime de série +55 xp')
    expect(root.querySelector('.ptl__wait .clrk-seal__day').textContent).toBe('火')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('goes on with the gate and back with the quiet way', async () => {
    const { screen, calls } = await mountPartial()
    await settle()
    const root = screen.container.querySelector('main.ptl')
    expect(text(root.querySelector('.btn-depart--gate'))).toContain('Continuer · 14 cartes')
    root.querySelector('.btn-depart--gate').click()
    expect(calls.cont).toBe(1)
    root.querySelector('.ptl__quiet').click()
    expect(calls.leave).toBe(1)
    // the quiet way stands over the gate
    expect(root.querySelector('.ptl__quiet').getBoundingClientRect().bottom)
      .toBeLessThan(root.querySelector('.btn-depart--gate').getBoundingClientRect().top)
  })

  it('skips its entrance on a tap, and opens on its rest when reduced', async () => {
    const { screen } = await mountPartial()
    await settle(100)
    const root = screen.container.querySelector('main.ptl')
    root.click()
    await settle()
    expect(root.className).toContain('clrk--skip')
    const reduced = await mountPartial({ reduced: true })
    await settle()
    const quiet = reduced.screen.container.querySelector('main.ptl.clrk--reduced')
    expect(quiet).not.toBeNull()
    expect(quiet.querySelector('.clrk-xp-shine')).toBeNull()
    expect(quiet.querySelector('.clrk-xp-glint')).toBeNull()
  })

  it('times the tease by the pace, or names the ticket on a milestone\'s eve', async () => {
    const eve = { ...CLEAR_PARTIAL, seconds_per_review: null, preview: { streak: 7, bonus: 60, jackpot: 250, milestone: 7 } }
    const { screen } = await mountPartial({ result: eve })
    await settle()
    expect(text(screen.container.querySelector('.ptl__tease'))).toBe('Au bout : le tampon du jour et le billet de la semaine +310 xp')
  })

  it('draws a long day as its two stretches, with no stops', () => {
    expect(loopOf(20, 34).stops).toHaveLength(32)
    expect(loopOf(80, 200).stops).toHaveLength(0)
  })
})
