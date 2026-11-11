import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { Sheet } from './Sheet'
import { CardIcon, ArrowIcon } from '../ui/Icons'
import '../../index.css'

// ── A sheet's head (plan 277) ───────────────────────────────────
// The owner's pick C5 on the canvas "Titres — options": a small ring
// with the sheet's icon, then its name in words, and a quiet line under
// it where the caption used to sit beside a large name (読み · LES DEUX
// LECTURES, 残高 · BALANCE). These pin its parts and what each is.

const head = () => document.querySelector('.sheet__head')

describe('the sheet head', () => {
  it('rings the icon, names the sheet in words and puts the sub under it', async () => {
    await render(<Sheet open onClose={() => {}} title="Solde" sub="Carte d’abonnement" icon={CardIcon} line="var(--accent2)" />)
    const mark = head().querySelector('.sheet__mark')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(mark.querySelector('svg').getAttribute('width')).toBe('16')
    expect(mark.style.getPropertyValue('--line-color')).toBe('var(--accent2)')
    expect(getComputedStyle(mark).width).toBe('30px')
    const title = head().querySelector('h2.sheet__title')
    expect(title.textContent).toBe('Solde')
    // The name in words, in the display face and not shouted.
    expect(getComputedStyle(title).textTransform).toBe('none')
    expect(head().querySelector('.sheet__sub').textContent).toBe('Carte d’abonnement')
    // The sub sits under the name, not beside it.
    const t = title.getBoundingClientRect()
    const s = head().querySelector('.sheet__sub').getBoundingClientRect()
    expect(s.top).toBeGreaterThanOrEqual(t.bottom - 1)
    // The dialog is named by its title when no label is given.
    expect(document.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Solde')
  })

  it('takes an element where the icon needs a prop of its own', async () => {
    await render(<Sheet open onClose={() => {}} title="Monter à N4 ?" icon={<ArrowIcon direction="up" />} />)
    expect(head().querySelectorAll('.sheet__mark svg')).toHaveLength(1)
  })

  it('draws no ring without an icon', async () => {
    await render(<Sheet open onClose={() => {}} title="Navigateur" />)
    expect(head().querySelector('.sheet__mark')).toBeNull()
    expect(head().querySelector('.sheet__sub')).toBeNull()
  })

  it('draws no head without a title', async () => {
    await render(<Sheet open onClose={() => {}} label="Réglages d’affichage"><p>body</p></Sheet>)
    expect(head()).toBeNull()
  })

  it('keeps the caption’s neutral ink for a sheet of no line', async () => {
    await render(
      <Sheet open onClose={() => {}} title="Signaler" icon={CardIcon}>
        <span className="probe" style={{ color: 'var(--sheet-cap-ink)' }}>ink</span>
      </Sheet>
    )
    const mark = head().querySelector('.sheet__mark')
    expect(mark.style.getPropertyValue('--line-color')).toBe('')
    expect(getComputedStyle(mark).borderTopColor).toBe(getComputedStyle(document.querySelector('.probe')).color)
  })
})
