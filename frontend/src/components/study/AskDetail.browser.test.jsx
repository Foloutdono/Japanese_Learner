import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { AskDetail } from './AskDetail'

// ── 問 — the detail of one flagged mistake, in parts (plan 330) ──
// What the server answers a review's Détail with (routes/ask.py,
// explain_fix): what happened, the forms side by side, examples, a line
// to remember it by. Each part is drawn only where the model gave it,
// and the headings are the app's own words in the learner's language.

const DETAIL = {
  what: 'Tu as mis «でした» après 飲んで.',
  rule: [{ label: 'Verbe', text: '飲む → 飲みます → 飲みました' }, { label: 'Nom', text: '学生です → 学生でした' }],
  examples: [{ jp: 'コーヒーを飲みました。', tr: 'J’ai bu du café.' }, { jp: '昨日は雨でした。', tr: '' }],
  memo: 'Verbe → ます, ました.',
}
const draw = detail => render(<LangProvider><AskDetail detail={detail} /></LangProvider>)

describe('AskDetail', () => {
  it('draws each part under its heading, the Japanese marked as such', async () => {
    const root = (await draw(DETAIL)).container
    expect([...root.querySelectorAll('.ask-detail__head')].map(h => h.textContent))
      .toEqual(['Ce qui s’est passé', 'La règle', 'Exemples'])
    expect(root.querySelector('.ask-detail__what').textContent).toBe(DETAIL.what)
    expect([...root.querySelectorAll('.ask-detail__rule dt')].map(d => d.textContent)).toEqual(['Verbe', 'Nom'])
    const forms = [...root.querySelectorAll('.ask-detail__rule dd')]
    expect(forms.map(d => d.textContent)).toEqual(['飲む → 飲みます → 飲みました', '学生です → 学生でした'])
    expect(forms.every(d => d.getAttribute('lang') === 'ja')).toBe(true)
    const examples = [...root.querySelectorAll('.ask-detail__examples li')]
    expect(examples[0].querySelector('b').getAttribute('lang')).toBe('ja')
    // An example with no translation prints none, never an empty line.
    expect(examples[1].querySelector('span')).toBeNull()
    expect(root.querySelector('.ask-detail__memo').textContent).toBe(DETAIL.memo)
  })

  it('leaves out a part the model left out, and the whole of an empty detail', async () => {
    const partial = (await draw({ what: 'Seulement ceci.', rule: [], examples: [], memo: '' })).container
    expect(partial.querySelectorAll('.ask-detail__part')).toHaveLength(1)
    expect(partial.querySelector('.ask-detail__memo')).toBeNull()
    const none = (await draw({})).container
    expect(none.querySelector('.ask-detail')).toBeNull()
  })
})
