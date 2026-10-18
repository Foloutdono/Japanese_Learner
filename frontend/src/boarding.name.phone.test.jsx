import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 名前 — the name on its own screen (plan 255) ─────────────────
// Flow C printed the name as one more field of the card and learners
// walked past it, so the name is asked before the card, as the canvas's
// 2B drew it: the plate, its count, the pole to the question's hub and
// the road on to the card. Pinned at 390×844: the field takes the focus
// as the screen arrives, the gate waits for a name and the quiet way
// goes on without one, the name rides to the card's signature and its
// row, and Back from the card comes back to it with the name kept. The
// card then asks to be checked before it is issued.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BoardingFlow } = await import('./screens/BoardingFlow')

const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()
// French sets a narrow space before ? and ! as it renders.
const plain = s => s.replace(/[\u202f\u00a0]/g, ' ')
const live = screen => screen.container.querySelector('.brd__car:not(.brd__car--out)')
const $ = (screen, sel) => live(screen).querySelector(sel)
async function click(screen, sel) {
  await vi.waitFor(() => expect($(screen, sel), sel).toBeTruthy(), { timeout: 2000 })
  $(screen, sel).click()
  await settle(20)
}
async function arrived(screen, step) {
  await vi.waitFor(() => {
    expect(screen.container.querySelector('.brd').dataset.step).toBe(step)
    expect(screen.container.querySelector('.brd__car--out')).toBeNull()
  }, { timeout: 3000 })
}

async function mountFlow() {
  const screen = await render(
    <LangProvider>
      <BoardingFlow session={{ access_token: 'tok' }} onComplete={() => {}} guest dryRun />
    </LangProvider>
  )
  await settle(60)
  return screen
}

// A beginner: the kana, its reveal, then the name.
async function toName(screen) {
  await click(screen, '[data-kana="none"]')
  await arrived(screen, 'reveal')
  await click(screen, '[data-action="continue"]')
  await arrived(screen, 'name')
}

describe('the name at 390×844', () => {
  it('asks the name on its own screen, its field focused and its gate waiting', async () => {
    const screen = await mountFlow()
    await toName(screen)
    expect(plain($(screen, '.brd__q').textContent)).toBe('Comment tu t’appelles ?')
    const field = $(screen, '.brd-plate__field')
    expect(document.activeElement).toBe(field)
    expect(field.value).toBe('')
    expect($(screen, '.brd-plate__count').textContent).toBe('0 / 24')
    expect($(screen, '[data-action="continue"]').disabled).toBe(true)
    expect($(screen, '[data-action="name-skip"]').textContent).toBe('Plus tard')
    // Its place on the line: the kana, the name, the card.
    const track = $(screen, '.brd__track') ?? screen.container.querySelector('.brd__track')
    expect(track.getAttribute('aria-valuenow')).toBe('2')
    expect(track.getAttribute('aria-valuemax')).toBe('3')
    expect($(screen, '.brd-name__hub').textContent).toBe('02')
    expect($(screen, '.brd-name__lab').textContent).toBe('Carte')
    // Whole on the phone, nothing past either edge.
    const body = $(screen, '.brd__body')
    expect(body.scrollHeight).toBe(body.clientHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    expect(rect($(screen, '.brd-plate')).right).toBeLessThanOrEqual(390)
  })

  it('opens the gate on a name, counts it, and refuses one past 24 characters', async () => {
    const screen = await mountFlow()
    await toName(screen)
    const field = $(screen, '.brd-plate__field')
    await userEvent.fill(field, 'Camille')
    expect($(screen, '.brd-plate__count').textContent).toBe('7 / 24')
    expect($(screen, '[data-action="continue"]').disabled).toBe(false)
    // Any script, counted as the server counts it.
    await userEvent.fill(field, '山田花子')
    expect($(screen, '.brd-plate__count').textContent).toBe('4 / 24')
    await userEvent.fill(field, 'x'.repeat(25))
    expect($(screen, '[role="alert"]').textContent).toBe('24 caractères au plus.')
    expect($(screen, '[data-action="continue"]').disabled).toBe(true)
    // Blank is no name.
    await userEvent.fill(field, '   ')
    expect($(screen, '[data-action="continue"]').disabled).toBe(true)
  })

  it('signs the card with the name, cleaned, and asks for the card to be checked', async () => {
    const screen = await mountFlow()
    await toName(screen)
    await userEvent.fill($(screen, '.brd-plate__field'), '  Camille   Dupont ')
    await click(screen, '[data-action="continue"]')
    await arrived(screen, 'card')
    expect($(screen, '.brd__q').textContent).toBe('Vérifie ta carte.')
    expect($(screen, '.brd__hint').textContent).toContain('Tout est juste')
    expect($(screen, '.pcb__sign-name').textContent).toBe('Camille Dupont')
    expect($(screen, '.pcb__sign-name').classList.contains('pcb__sign-name--empty')).toBe(false)
    expect($(screen, '[data-row="name"] .brd-row__val').textContent).toBe('Camille Dupont')
  })

  it('goes on without a name by its quiet way, the card keeping its placeholder', async () => {
    const screen = await mountFlow()
    await toName(screen)
    await userEvent.fill($(screen, '.brd-plate__field'), 'Cam')
    await click(screen, '[data-action="name-skip"]')
    await arrived(screen, 'card')
    expect($(screen, '.pcb__sign-name').classList.contains('pcb__sign-name--empty')).toBe(true)
    expect($(screen, '[data-row="name"] .brd-row__val').textContent).toBe('Ton prénom')
  })

  it('goes on by Enter in the field, and comes back to it from the card with the name kept', async () => {
    const screen = await mountFlow()
    await toName(screen)
    await userEvent.fill($(screen, '.brd-plate__field'), 'Camille')
    await userEvent.keyboard('{Enter}')
    await arrived(screen, 'card')
    // The card is an arrival with no head: the phone's Back is the way.
    window.history.back()
    await arrived(screen, 'name')
    expect($(screen, '.brd-plate__field').value).toBe('Camille')
    expect($(screen, '[data-action="continue"]').disabled).toBe(false)
  })

  it('asks a reader the name after the level, third on the line', async () => {
    const screen = await mountFlow()
    await click(screen, '[data-kana="both"]')
    await arrived(screen, 'level')
    await click(screen, '[data-level="N4"]')
    await click(screen, '[data-action="continue"]')
    await arrived(screen, 'name')
    expect($(screen, '.brd-name__hub').textContent).toBe('03')
    expect(screen.container.querySelector('.brd__track').getAttribute('aria-valuemax')).toBe('4')
  })
})
