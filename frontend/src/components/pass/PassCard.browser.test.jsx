import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import { PassCard, CardFace } from './PassCard'
import { PassBack } from './PassBack'
import '../../index.css'

// ── 定期券 — the learner's card (plan 173) ──────────────────────────
// One card in three materials, face up and turned by a touch to its
// back, where the old passes' figures are printed and their doors kept.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))

const BACK = {
  from: { code: 'N5', name: 'Débutant' },
  to: { code: 'N3', name: 'Intermédiaire' },
  valid: '12 mars 2027',
  service: '10 / jour',
  hour: '08:00',
  lines: ['vocab', 'kanji', 'grammar'],
  level: 12,
  into: 640,
  span: 1000,
  share: 0.64,
  balance: 12,
  unlimited: false,
  cap: 50,
  unit: '/ 50 crédits',
  note: 'Prochain crédit à 15:48',
  status: { status: 'ahead', word: 'En avance', drift: '3 j d’avance', days: 3 },
  name: 'Aiko',
  since: 'mars 2026',
}

// Where the router stands, printed where the test can read it.
function Where() {
  return <output className="where">{useLocation().pathname}</output>
}

function Card({ tier = 'free', initial = 'face', back = BACK, doors = {} }) {
  const [side, setSide] = useState(initial)
  const turn = () => setSide(s => (s === 'face' ? 'back' : 'face'))
  return (
    <div style={{ width: 340 }}>
      <PassCard
        tier={tier}
        name="Aiko"
        level={12}
        share={0.64}
        side={side}
        onTurn={turn}
        label="Carte d'abonnement"
        back={<PassBack tier={tier} data={back} doors={doors} onTurn={turn} />}
      />
    </div>
  )
}

async function mount(props) {
  document.body.innerHTML = ''
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="*" element={<><Where /><Card {...props} /></>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await new Promise(r => setTimeout(r, 50))
}

const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const face = () => $('.pcard__side--face')
const back = () => $('.pcard__side--back')

describe('the card (plan 173)', () => {
  it('is drawn at the card’s proportions, scaled to its slot', async () => {
    await mount()
    const box = $('.pcard').getBoundingClientRect()
    expect(box.width).toBe(340)
    expect(box.height).toBeCloseTo(340 * 172 / 272, 0)
    expect(Number($('.pcard').style.getPropertyValue('--pcard-kf'))).toBeCloseTo(340 / 272, 3)
  })

  it('turns its face to its back with one touch, and the hidden side cannot be reached', async () => {
    await mount()
    expect($('.pcard').dataset.side).toBe('face')
    expect(face().inert).toBe(false)
    expect(back().inert).toBe(true)
    const turn = $('.pcard__turn')
    expect(turn.getAttribute('aria-label')).toContain('Retourner la carte')
    turn.click()
    await new Promise(r => setTimeout(r, 30))
    expect($('.pcard').dataset.side).toBe('back')
    expect($('.pcard').classList.contains('pcard--turned')).toBe(true)
    expect(face().inert).toBe(true)
    expect(back().inert).toBe(false)
  })

  it('has its depth only in the air, so the print is flat and crisp at rest', async () => {
    // A perspective on the card, however far, put the print on a 3D
    // layer the browser resampled: every glyph read soft. At rest the
    // card is flat; turning, it has its depth for the flip.
    await mount({ initial: 'back' })
    expect(getComputedStyle($('.pcard')).perspective).toBe('none')
    $('.pcb__print').click()
    await new Promise(r => setTimeout(r, 30))
    expect($('.pcard').classList.contains('pcard--turning')).toBe(true)
    expect(getComputedStyle($('.pcard')).perspective).toBe('1600px')
    await new Promise(r => setTimeout(r, 900))
    expect($('.pcard').classList.contains('pcard--turning')).toBe(false)
    expect(getComputedStyle($('.pcard')).perspective).toBe('none')
  })

  it('rings a door the keys reach inside it, in the card\'s ink', async () => {
    await mount({ initial: 'back', doors: { settings: null, onBalance: () => {} } })
    const door = $('.pcb__meter--balance')
    door.focus({ focusVisible: true })
    await new Promise(r => setTimeout(r, 30))
    expect(getComputedStyle(door).outlineStyle).toBe('none')
    const ring = getComputedStyle(door, '::after')
    expect(ring.boxShadow).toMatch(/inset/)
    expect(ring.borderTopLeftRadius).not.toBe('0px')
  })

  it('turns back over from a touch off its doors, and not from a door', async () => {
    const onBalance = vi.fn()
    await mount({ initial: 'back', doors: { onBalance } })
    $('.pcb__meter--balance').click()
    await new Promise(r => setTimeout(r, 30))
    expect(onBalance).toHaveBeenCalledTimes(1)
    expect($('.pcard').dataset.side).toBe('back')
    $('.pcb__print').click()
    await new Promise(r => setTimeout(r, 30))
    expect($('.pcard').dataset.side).toBe('face')
  })

  it('is cut from its plan’s material: the white plastic’s band, the charcoal, the platinum’s etched 辻', async () => {
    await mount({ tier: 'free' })
    expect($('.pcs--free .pcs__band')).not.toBeNull()
    expect($('.pcf__class').textContent).toBe('Free')
    await mount({ tier: 'pro' })
    expect($('.pcs--pro')).not.toBeNull()
    expect($('.pcs__band')).toBeNull()
    expect($('.pcf__seal').classList.contains('ofr-mark--etched')).toBe(false)
    await mount({ tier: 'max' })
    expect($('.pcs--max')).not.toBeNull()
    expect($('.pcf__seal').classList.contains('ofr-mark--etched')).toBe(true)
  })

  it('fills the struck 辻’s road to the climb', async () => {
    await mount()
    expect($('.pcf__seal').style.getPropertyValue('--ofr-xp')).toBe('0.64')
  })
})

describe('the back (plan 173)', () => {
  it('prints the route, the contract, the climb, the balance, the journey and the signature', async () => {
    await mount({ initial: 'back' })
    expect($$('.pcb__code').map(n => n.textContent)).toEqual(['N5', 'N3'])
    expect($('.pcb__valid').textContent).toContain('12 mars 2027')
    expect($$('.pcb__line').map(n => n.textContent)).toEqual(['単語', '漢字', '文法'])
    expect($('.pcb__meter').style.getPropertyValue('--pcb-xp')).toBe('0.64')
    expect($('.pcb__meter--balance .pcb__fig').textContent).toContain('12')
    expect($('.pcb__meter--balance em').textContent).toBe('Prochain crédit à 15:48')
    expect($('.pcb__lamp--ahead')).not.toBeNull()
    expect($('.pcb__sign').textContent).toBe('Aiko')
    expect($('.pcb__month').textContent).toContain('mars 2026')
  })

  it('draws ∞ on a plan without a ceiling, and a dash before the balance is known', async () => {
    await mount({ initial: 'back', tier: 'max', back: { ...BACK, balance: null, unlimited: true, note: null } })
    expect($('.pcb__fig--inf .pinf')).not.toBeNull()
    await mount({ initial: 'back', back: { ...BACK, balance: null, unlimited: false } })
    expect($('.pcb__fig--inf')).toBeNull()
    expect($('.pcb__meter--balance .pcb__fig').textContent).toBe('—')
  })

  it('opens no page where the caller gives none (the boarding)', async () => {
    await mount({ initial: 'back' })
    expect($$('.pcb__door')).toHaveLength(0)
  })

  it('opens Settings’ pages from the print where the caller allows it', async () => {
    await mount({ initial: 'back', doors: { settings: null } })
    expect($$('.pcb__door[data-page]').map(n => n.dataset.page)).toEqual(['level', 'destination', 'service', 'hour', 'lines'])
    $('.pcb__door[data-page="hour"]').click()
    await new Promise(r => setTimeout(r, 30))
    expect($('output.where').textContent).toBe('/profile/settings/hour')
  })

  it('marks the page open beside the column on the desk, its doors links', async () => {
    await mount({ initial: 'back', doors: { settings: 'service' } })
    const on = $('.pcb__door--on')
    expect(on.dataset.page).toBe('service')
    expect(on.tagName).toBe('A')
    expect(on.getAttribute('aria-current')).toBe('page')
  })
})

describe('the face alone (plan 173)', () => {
  it('is a picture with no door, the level-up’s figure in the level’s place', async () => {
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <div style={{ width: 300 }}>
          <CardFace tier="pro" name="Aiko" level={12} share={0.3} levelSlot={<b className="slot">13</b>} />
        </div>
      </LangProvider>
    )
    await new Promise(r => setTimeout(r, 30))
    expect($('.pcard').getAttribute('aria-hidden')).toBe('true')
    expect($$('.pcard button')).toHaveLength(0)
    expect($('.pcf__lvl .slot').textContent).toBe('13')
  })
})
