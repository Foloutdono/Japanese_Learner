import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from '../../LangContext'
import { TutorReview, TutorVerdict, Corrected } from './TutorReview'
import { PointTag } from './PracticeCard'

// ── The tutor's review, drawn once for two runs (plan 125) ──
// 翻訳 and 作文 hand these components the same shape
// (study/tutor_review.py). Since plan 184 (the practice card) it is
// drawn in three places: the verdict at the answer's well or leading the
// summary (TutorVerdict), the corrected line with the learner's answer
// (Corrected), and the notes here -- the summary, the fixes numbered with
// their fix, what was right as one line. Whether the point was used is
// the point's tag's (PracticeCard's PointTag). French copy: the lane's
// locale.

function Draw({ review, verdict = false }) {
  const { t } = useLang()
  return <TutorReview review={review} t={t} verdict={verdict} />
}
function Tag({ used }) {
  const { t } = useLang()
  return <PointTag point="〜ながら" label={t.pcardPoint} used={used} />
}
function Verdict({ review }) {
  const { t } = useLang()
  return <TutorVerdict review={review} t={t} />
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

const draw = (over = {}, verdict = false) => render(
  <LangProvider><Draw review={{ ...REVIEW, ...over }} verdict={verdict} /></LangProvider>,
)

describe('the tutor review', () => {
  it('draws the summary, the fixes numbered with their fix, and what was right as one line', async () => {
    const root = (await draw()).container
    expect(root.querySelector('.rvw__summary').textContent).toBe('Une particule à revoir.')
    // No verdict unless asked: on translation it stands at the answer.
    expect(root.querySelector('.rvw__verdict')).toBeNull()
    const fixes = [...root.querySelectorAll('.rvw__fixes > .rvw__row')]
    expect(fixes).toHaveLength(1)
    expect(fixes[0].querySelector('.rvw__n').textContent).toBe('1')
    expect(fixes[0].querySelector('.rvw__item').textContent).toBe('「音楽が」 marque le sujet')
    expect(fixes[0].querySelector('.rvw__to').textContent).toBe('「音楽を」')
    const right = [...root.querySelectorAll('.rvw__right > .rvw__good')]
    expect(right.map(r => r.textContent)).toEqual(['「ながら」 relie les deux actions'])
    // The fixes come before what was right.
    expect(root.querySelector('.rvw__fixes').compareDocumentPosition(root.querySelector('.rvw__right')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leads the summary with the verdict when asked (composition)', async () => {
    const root = (await draw({}, true)).container
    const head = root.querySelector('.rvw__head')
    expect(head.firstElementChild.classList.contains('rvw__verdict')).toBe(true)
    expect(head.querySelector('.rvw__verdict').textContent).toBe('En partie')
    expect(head.querySelector('.rvw__verdict').classList.contains('rvw__verdict--partial')).toBe(true)
  })

  it('reads an unknown verdict as partial rather than drawing nothing', async () => {
    const screen = await render(<LangProvider><Verdict review={{ ...REVIEW, verdict: 'great' }} /></LangProvider>)
    expect(screen.container.querySelector('.rvw__verdict').textContent).toBe('En partie')
  })

  it('draws the corrected line with its readings, the change marked, the romaji under it', async () => {
    const screen = await render(
      <LangProvider><Corrected parts={REVIEW.better_parts} text={REVIEW.better} romaji={REVIEW.better_romaji} /></LangProvider>,
    )
    const root = screen.container
    expect(root.querySelector('.rvw__better rt').textContent).toBe('おんがく')
    expect(root.querySelector('mark.rvw__fixed').textContent).toBe('を')
    expect(root.querySelector('.rvw__corrected .prose__romaji').textContent).toBe('ongaku wo kikinagara benkyou shimasu')
  })
})

describe('the point\'s tag', () => {
  it('says whether the point was used, only when someone said', async () => {
    const used = (await render(<LangProvider><Tag used /></LangProvider>)).container
    expect(used.querySelector('.pcard-tag__jp').textContent).toBe('〜ながら')
    expect(used.querySelector('.pcard-tag__used')).not.toBeNull()
    expect(used.querySelector('.pcard-tag__used--x')).toBeNull()
    expect(used.querySelector('.sr-only').textContent).toBe('utilisé')

    const missed = (await render(<LangProvider><Tag used={false} /></LangProvider>)).container
    expect(missed.querySelector('.pcard-tag__used--x')).not.toBeNull()
    expect(missed.querySelector('.sr-only').textContent).toBe('non utilisé')

    // No claim, no mark: a null is "the model did not say", not "no".
    const unsaid = (await render(<LangProvider><Tag used={null} /></LangProvider>)).container
    expect(unsaid.querySelector('.pcard-tag__used')).toBeNull()
    expect(unsaid.querySelector('.sr-only')).toBeNull()
  })
})
