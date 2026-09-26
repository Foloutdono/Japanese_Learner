import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { parkPointer } from './testing/parkPointer'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — what a keyboard and a copy are shown (plan 123, P19) ────────
// Three things the desk's pointer had and its keyboard and clipboard
// did not:
//   - a hover with no focus twin (DESIGN.md, Controls): the answer
//     sheet's chips in an exam's side, the analyser's stops, chips and
//     table rows, a word's kanji chips, Browse's rows -- a keyboard got
//     the global ring and none of what a pointer is shown;
//   - five ruby lines that put their readings into a copy (日本語にほんご);
//   - the keys a walked list answers, and the names of icon-only
//     controls, said nowhere a pointer or a screen reader could find.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 20, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const PROPS = ['border-top-color', 'color', 'background-color', 'text-decoration-line']
const read = el => Object.fromEntries(PROPS.map(p => [p, getComputedStyle(el).getPropertyValue(p)]))

// The pointer parked clear of everything, nothing focused, and every
// transition out of either finished.
async function rest() {
  await parkPointer()
  document.activeElement?.blur?.()
  await settle()
}

// The lane's pointer is shared: leave it parked, not over whatever the
// next file draws where these controls stood.
afterEach(rest)

// Hovered, then reached by Tab from the control before it: the same face.
async function twins(target, { hover = target, shown = target } = {}) {
  await rest()
  const still = read(shown)
  await userEvent.hover(hover)
  await settle()
  const pointed = read(shown)
  expect(pointed, 'the hover changes something').not.toEqual(still)
  await rest()
  $('.before').focus()
  await userEvent.keyboard('{Tab}')
  await settle()
  expect(document.activeElement).toBe(target)
  expect(read(shown)).toEqual(pointed)
}

function Desk({ children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <div className="phone phone--desk">
          <div className="phone__content">
            <button type="button" className="before">before</button>
            {children}
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('every hover has its focus twin on the desk', () => {
  it('the answer sheet\'s chips in an exam\'s side', async () => {
    await render(
      <Desk>
        <div className="desk-run__side" style={{ position: 'static' }}>
          <button type="button" className="exam-sheet__chip">3</button>
        </div>
      </Desk>
    )
    await twins($('.exam-sheet__chip'))
  })

  it('the analyser\'s stops and chips', async () => {
    for (const cls of ['anl-stop', 'anl-chip']) {
      document.body.innerHTML = ''
      await render(<Desk><button type="button" className={cls}>学校</button></Desk>)
      await twins($(`.${cls}`))
    }
  })

  it('a word\'s kanji chip, its border and its character', async () => {
    await render(
      <Desk>
        <div className="phrase-kanji-chip">
          <button type="button" className="phrase-kanji-chip__char" lang="ja">学</button>
          <span className="phrase-kanji-chip__level">N5</span>
        </div>
      </Desk>
    )
    const char = $('.phrase-kanji-chip__char')
    await twins(char, { hover: $('.phrase-kanji-chip'), shown: $('.phrase-kanji-chip') })
    await twins(char)
  })

  it('Browse\'s rows in the deck\'s side', async () => {
    await render(
      <Desk>
        <div className="desk-browse">
          <div role="checkbox" aria-checked="false" tabIndex={0} className="browse-result-row browse-result-row--selectable">
            <div className="deckdetail-checkbox" />
            <div className="browse-result-row__entry"><span className="browse-result-row__front" lang="ja">水</span></div>
          </div>
        </div>
      </Desk>
    )
    await twins($('.browse-result-row'))
  })
})

describe('a copy on the desk', () => {
  it('leaves the readings out of every ruby line', async () => {
    const lines = ['rvw__better', 'kaki-line', 'bkd-line', 'bkd-row__word', 'dict-word__jp', 'furigana-word']
    await render(
      <Desk>
        {lines.map(cls => <span key={cls} className={cls}><ruby>日本<rt>にほん</rt></ruby></span>)}
      </Desk>
    )
    for (const cls of lines) expect(getComputedStyle($(`.${cls} rt`)).userSelect, cls).toBe('none')
  })
})

describe('the keys and the names the desk prints', () => {
  // The pocket pass is the stage head's since plan 127 gave the rail a
  // pass of its own (DeskPass, whose level door carries its title:
  // chrome.desktop.test.jsx).
  it('names the stage head\'s pass and the console\'s clear under a pointer', async () => {
    const { HudPass } = await import('./components/chrome/Hud')
    const { ConsoleIndex } = await import('./components/chrome/Console')
    await render(
      <Desk>
        <HudPass onClick={() => {}} />
        <ConsoleIndex value="駅" onChange={() => {}} onClear={() => {}} clearLabel="Effacer" />
      </Desk>
    )
    const pass = $('.hud__pass')
    expect(pass.title).toBe(pass.getAttribute('aria-label'))
    expect($('.console__clear').title).toBe('Effacer')
  })

  it('tells a screen reader which keys walk a list', async () => {
    const { default: GrammarIndex } = await import('./components/selection/GrammarIndex')
    const points = ['a', 'b'].map(k => ({ raw_id: `g_${k}`, pattern: k, meaning: k, stage: 'new' }))
    await render(<Desk><GrammarIndex points={points} selected="g_a" linkTo={id => `/learn/grammar/N5?point=${id}`} /></Desk>)
    expect($('.gl-index').getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown Home End ArrowLeft ArrowRight')
  })
})
