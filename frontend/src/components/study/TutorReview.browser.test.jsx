import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from '../../LangContext'
import { TutorReview } from './TutorReview'

// ── The tutor's review, drawn once for two runs (plan 124) ──
// 翻訳 and 作文 hand this component the same shape
// (study/tutor_review.py) and it draws the same rows; these pin what
// the move out of TranslationRun.jsx must not have changed, and the one
// line it added -- what the sentence says -- drawn only when a review
// carries it. French copy: the lane's locale.

function Draw({ review, grammar }) {
  const { t } = useLang()
  return <TutorReview review={review} grammar={grammar} t={t} />
}

const REVIEW = {
  verdict: 'partial',
  summary: 'Une particule à revoir.',
  meaning: '',
  good: ['「ながら」 relie les deux actions'],
  fix: [{ issue: '「音楽が」 marque le sujet', fix: '「音楽を」' }],
  grammar_used: true,
  better: '音楽を聞きながら勉強します。',
  better_parts: [
    { text: '音楽', reading: 'おんがく' },
    { text: 'を', highlight: true },
    { text: '聞きながら勉強します。' },
  ],
  better_romaji: 'ongaku wo kikinagara benkyou shimasu',
}

const draw = (over = {}, grammar) => render(
  <LangProvider><Draw review={{ ...REVIEW, ...over }} grammar={grammar} /></LangProvider>,
)

describe('the tutor review', () => {
  it('draws the verdict, the rows and the corrected sentence', async () => {
    const screen = await draw()
    const root = screen.container
    expect(root.querySelector('.rvw__verdict').textContent).toBe('En partie')
    expect(root.querySelector('.rvw__verdict').classList.contains('rvw__verdict--partial')).toBe(true)
    expect(root.querySelector('.rvw__summary').textContent).toBe('Une particule à revoir.')
    expect(root.querySelectorAll('.rvw__row')).toHaveLength(2)
    expect(root.querySelectorAll('.rvw__mark--ok')).toHaveLength(1)
    expect(root.querySelectorAll('.rvw__mark--x')).toHaveLength(1)
    expect(root.querySelector('.rvw__fix').textContent).toBe('「音楽を」')
    // The correction: furigana over the kanji, the changed span marked,
    // the romaji under the line.
    expect(root.querySelector('.rvw__better rt').textContent).toBe('おんがく')
    expect(root.querySelector('mark.rvw__fixed').textContent).toBe('を')
    expect(root.querySelector('.rvw__corrected .prose__romaji').textContent).toBe('ongaku wo kikinagara benkyou shimasu')
  })

  it('names the point and whether it was used, only when the review says', async () => {
    const used = await draw({}, '〜ながら')
    const badges = [...used.container.querySelectorAll('.type-badge')]
    expect(badges).toHaveLength(2)
    expect(badges[1].textContent).toContain('〜ながら')
    expect(badges[1].textContent).toContain('utilisé')

    const missed = await draw({ grammar_used: false }, '〜ながら')
    expect(missed.container.querySelectorAll('.type-badge')[1].textContent).toContain('non utilisé')

    // No claim, no badge: a null is "the model did not say", not "no".
    const unsaid = await draw({ grammar_used: null }, '〜ながら')
    expect(unsaid.container.querySelectorAll('.type-badge')).toHaveLength(1)
    const noPoint = await draw()
    expect(noPoint.container.querySelectorAll('.type-badge')).toHaveLength(1)
  })

  it('prints what the sentence says only when the review carries it', async () => {
    const silent = await draw()
    expect(silent.container.textContent).not.toContain('Ce que ça dit')
    expect(silent.container.querySelector('.rvw .prose__en')).toBeNull()

    const said = await draw({ meaning: "J'étudie en écoutant de la musique." })
    const labels = [...said.container.querySelectorAll('.prose__label')].map(l => l.textContent)
    expect(labels[0]).toBe('Ce que ça dit')
    expect(said.container.querySelector('.rvw .prose__en').textContent).toBe("J'étudie en écoutant de la musique.")
    // Still last: the correction closes the review.
    expect(labels[labels.length - 1]).toBe('Version corrigée')
  })

  it('reads an unknown verdict as partial rather than drawing nothing', async () => {
    const screen = await draw({ verdict: 'great' })
    expect(screen.container.querySelector('.rvw__verdict').textContent).toBe('En partie')
  })
})
