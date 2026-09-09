import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { cdp } from 'vitest/browser'
import { LangProvider } from './LangContext'
import { Loading } from './components/ui/Loading'
import Empty from './components/ui/Empty'
import AppLoading from './screens/AppLoading'
import './index.css'

// ── The states sheet (plan 067) ─────────────────────────────
// The canvas's contract for every wait, every empty state and every
// error in the app, pinned against the real cascade at phone width:
// loading is three gold dots and nothing else moves under reduced
// motion; an empty state carries its action only when given one; the
// boot screen stands with no session and owns up to a sleeping server;
// disabled is opacity 0.45 and the gate keeps its shape.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Chromium's own preference, switched through the CDP session the
// phone lane already holds — a matchMedia stub cannot reach a
// stylesheet's @media block, and this test is about the stylesheet.
async function reducedMotion(on) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: on ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
  })
}

const mount = ui => render(<LangProvider>{ui}</LangProvider>)

describe('the wait', () => {
  afterEach(() => reducedMotion(false))

  it('is three gold dots that breathe', async () => {
    const screen = await mount(<Loading />)
    const box = screen.container.querySelector('.loading')
    expect(box.getAttribute('role')).toBe('status')
    expect(box.getAttribute('aria-label')).toBeTruthy()
    const dots = box.querySelectorAll('.loading__dot')
    expect(dots).toHaveLength(3)
    // No spinner: the app has no <svg> and no border-radius trick here,
    // only the three 8px dots in --accent2 at the sheet's gap.
    expect(box.querySelector('svg')).toBeNull()
    expect(getComputedStyle(box).gap).toBe('6px')
    for (const dot of dots) {
      const cs = getComputedStyle(dot)
      expect(cs.width).toBe('8px')
      expect(cs.height).toBe('8px')
      expect(cs.animationName).toBe('loading-breathe')
    }
    expect(getComputedStyle(dots[0]).backgroundColor).toBe(getComputedStyle(dots[2]).backgroundColor)
  })

  it('holds the sheet\'s rest state under reduced motion', async () => {
    await reducedMotion(true)
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
    const screen = await mount(<Loading />)
    const dots = [...screen.container.querySelectorAll('.loading__dot')]
    expect(dots.map(d => getComputedStyle(d).animationName)).toEqual(['none', 'none', 'none'])
    expect(dots.map(d => getComputedStyle(d).opacity)).toEqual(['0.35', '0.7', '1'])
  })

  it('carries a sentence for a long wait, and shrinks into a slot', async () => {
    const screen = await mount(
      <div>
        <Loading copy="Writing your exam…" />
        <Loading inline />
      </div>
    )
    const [long, slot] = screen.container.querySelectorAll('.loading')
    expect(long.querySelector('.loading__copy').textContent).toBe('Writing your exam…')
    // The copy is what a screen reader gets, not a second "Loading" label.
    expect(long.getAttribute('aria-label')).toBeNull()
    expect(getComputedStyle(slot).paddingTop).toBe('0px')
    expect(getComputedStyle(slot).display).toBe('inline-flex')
    expect(slot.tagName).toBe('SPAN')
    expect(slot.getAttribute('role')).toBeNull()
    expect(slot.querySelectorAll('.loading__dot')).toHaveLength(3)
  })
})

describe('the empty state and the error', () => {
  it('names the missing thing, and carries the action only when given', async () => {
    const screen = await mount(
      <div>
        <Empty message="No decks yet." hint="Create your first deck above." />
        <Empty icon={null} message="No results" action={{ label: 'Clear filters', onClick() {} }} />
      </div>
    )
    const [plain, withAction] = screen.container.querySelectorAll('.empty')
    expect(plain.querySelector('.empty__icon svg')).toBeTruthy()
    expect(plain.querySelector('.empty__msg').textContent).toBe('No decks yet.')
    expect(plain.querySelector('.empty__hint').textContent).toBe('Create your first deck above.')
    expect(plain.querySelector('.empty__action')).toBeNull()
    expect(withAction.querySelector('.empty__icon')).toBeNull()
    const action = withAction.querySelector('.empty__action')
    expect(action.tagName).toBe('BUTTON')
    expect(action.classList.contains('btn-secondary')).toBe(true)
    // The serif line, at the sheet's size.
    expect(getComputedStyle(plain.querySelector('.empty__msg')).fontWeight).toBe('700')
  })

  it('owns up in the danger register without changing shape', async () => {
    const screen = await mount(
      <div>
        <Empty message="No decks yet." />
        <Empty tone="error" message="That did not work" hint="Check your connection." action={{ label: 'Try again', onClick() {} }} />
      </div>
    )
    const [plain, error] = screen.container.querySelectorAll('.empty')
    expect(error.classList.contains('empty--error')).toBe(true)
    expect(error.getAttribute('role')).toBe('alert')
    expect(getComputedStyle(error).borderTopColor).not.toBe(getComputedStyle(plain).borderTopColor)
    expect(getComputedStyle(error.querySelector('.empty__icon')).color)
      .not.toBe(getComputedStyle(plain.querySelector('.empty__icon')).color)
    // Same box: the padding, the radius and the background do not move.
    for (const prop of ['paddingTop', 'borderTopLeftRadius', 'backgroundColor']) {
      expect(getComputedStyle(error)[prop]).toBe(getComputedStyle(plain)[prop])
    }
  })
})

describe('the boot screen', () => {
  it('stands with no session: the sign over the dots, on the page ground', async () => {
    const screen = await mount(<AppLoading />)
    const root = screen.container.querySelector('.app-loading')
    expect(root.querySelector('.app-loading__sign').textContent).toBe('辻')
    expect(root.querySelectorAll('.loading__dot')).toHaveLength(3)
    expect(getComputedStyle(root).minHeight).toBe(`${window.innerHeight}px`)
    // The note is in the tree from the first paint — a live region
    // that appears with its text is one a screen reader misses.
    const note = root.querySelector('.app-loading__note')
    expect(note.getAttribute('role')).toBe('status')
    expect(note.textContent).toBe('')
  })

  // Two tests rather than one with an unmount in the middle: an explicit
  // unmount() followed by the library's own after-test cleanup leaves
  // the next render() detached from the document.
  it('keeps quiet on the session check, which never waits on the server', async () => {
    const screen = await mount(<AppLoading wakeAfterMs={20} />)
    await settle()
    expect(screen.container.querySelector('.app-loading__note').textContent).toBe('')
  })

  it('owns up to a sleeping server after the wake delay', async () => {
    const screen = await mount(<AppLoading wakesServer wakeAfterMs={20} />)
    await settle()
    const note = screen.container.querySelector('.app-loading__note')
    expect(note.querySelector('.app-loading__note-jp').textContent).toBe('サーバー起動中')
    expect(note.textContent.length).toBeGreaterThan('サーバー起動中'.length)
  })
})

describe('the closed gate', () => {
  it('is opacity 0.45 and nothing else, across the button family', async () => {
    const screen = await render(
      <div>
        <button type="button" className="btn-depart"><span className="btn-depart__jp">出発する</span></button>
        <button type="button" className="btn-depart" disabled><span className="btn-depart__jp">出発する</span></button>
        <button type="button" className="btn-primary" disabled>Go</button>
        <button type="button" className="btn-secondary" disabled>Go</button>
      </div>
    )
    const [open, closed, primary, secondary] = screen.container.querySelectorAll('button')
    for (const btn of [closed, primary, secondary]) {
      const cs = getComputedStyle(btn)
      expect(cs.opacity).toBe('0.45')
      expect(cs.boxShadow).toBe('none')
      expect(cs.transform).toBe('none')
    }
    // The shape and the fill are the open gate's.
    const a = getComputedStyle(open), b = getComputedStyle(closed)
    expect(b.backgroundColor).toBe(a.backgroundColor)
    expect(b.borderTopLeftRadius).toBe(a.borderTopLeftRadius)
    expect(b.paddingTop).toBe(a.paddingTop)
    expect(closed.getBoundingClientRect().height).toBe(open.getBoundingClientRect().height)
  })
})
