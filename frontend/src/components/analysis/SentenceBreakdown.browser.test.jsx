import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SentenceBreakdown } from './SentenceBreakdown'
import { StatusBadge } from './StatusBadge'
import { LangProvider } from '../../LangContext'

// Fixture shape matches study/analysis.py's Token dict: surface,
// reading, pos, vocab_match (with stats once attach_user_state has
// run) | null, kanji_matches, and an optional `meaning` -- present only
// once the deep tier has been bought (see docs/adr/0001), absent is the
// normal/default case now.
function tokenFixture(overrides = {}) {
  return {
    surface: '学生', start: 0, end: 2, reading: 'がくせい', pos: 'noun',
    furigana: [{ text: '学生', reading: 'がくせい' }],
    vocab_match: {
      level: 'N5', raw_id: 'vocab_N5_学生_がくせい',
      entry: { word: '学生', meaning: 'student' },
      stats: { status: 'not_started', due: false },
    },
    kanji_matches: [],
    ...overrides,
  }
}

function particleFixture() {
  return {
    surface: 'は', start: 2, end: 3, reading: 'は', pos: 'particle',
    furigana: [{ text: 'は' }],
    vocab_match: null,
    kanji_matches: [],
  }
}

const T = { clickForDetails: 'Click for details' }

// CardTransition (used by the stepper layout) renders StageBadge, which
// calls useLang() -- so every render needs a real LangProvider ancestor,
// not just the tests that exercise the stepper layout directly.
function withLang(children) {
  return <LangProvider>{children}</LangProvider>
}

describe('SentenceBreakdown', () => {
  it('list layout renders one card per token', async () => {
    const analysis = { tokens: [tokenFixture(), particleFixture()], explanation: '' }
    const screen = await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    // Both surfaces should appear somewhere in the rendered list of cards.
    expect(screen.getByText('学生').elements().length).toBeGreaterThan(0)
    expect(screen.getByText('は').elements().length).toBeGreaterThan(0)
  })

  it('stepper layout renders exactly one card and jumps on word click', async () => {
    const tokens = [tokenFixture({ surface: '大学' }), tokenFixture({ surface: '行く' })]
    const analysis = { tokens, explanation: '' }
    const setIndex = vi.fn()
    await render(withLang(
      <SentenceBreakdown
        analysis={analysis}
        t={T}
        layout="stepper"
        index={0}
        setIndex={setIndex}
        onTokenClick={() => {}}
        onKanjiClick={() => {}}
      />
    ))

    // Only one card counter should be present ("1 / 2"), proving the
    // stepper shows one Token at a time, not a scrolling list.
    expect(document.body.textContent).toContain('1 / 2')

    // The jump line's second word chip should call setIndex(1) when clicked.
    const chips = document.querySelectorAll('.rdg-breakdown-line__word')
    expect(chips.length).toBe(2)
    chips[1].click()
    expect(setIndex).toHaveBeenCalledWith(1)
  })

  it('a token with no meaning renders without the string "undefined"', async () => {
    const analysis = { tokens: [tokenFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={() => {}} onKanjiClick={() => {}} />
    ))
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('StatusBadge renders the translated label, not hardcoded English', async () => {
    const t = { status_mastered: 'TRANSLATED_LABEL' }
    await render(<StatusBadge status="mastered" t={t} />)
    expect(document.body.textContent).toContain('TRANSLATED_LABEL')
    expect(document.body.textContent).not.toContain('Mastered')
  })

  it('clicking a token card with a vocab_match calls onTokenClick', async () => {
    // Targets TokenCard's own surface-wrap specifically (not the
    // phrase-line span above it, which also renders the same text and
    // is unconditionally clickable, matching the original behaviour) --
    // TokenCard is the element this guard was added to.
    const onTokenClick = vi.fn()
    const analysis = { tokens: [tokenFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={onTokenClick} onKanjiClick={() => {}} />
    ))
    document.querySelector('.phrase-word-card__surface-wrap').click()
    expect(onTokenClick).toHaveBeenCalledTimes(1)
  })

  it('clicking a token card with no vocab_match does not call onTokenClick', async () => {
    const onTokenClick = vi.fn()
    const analysis = { tokens: [particleFixture()], explanation: '' }
    await render(withLang(
      <SentenceBreakdown analysis={analysis} t={T} layout="list" onTokenClick={onTokenClick} onKanjiClick={() => {}} />
    ))
    document.querySelector('.phrase-word-card__surface-wrap').click()
    expect(onTokenClick).not.toHaveBeenCalled()
  })
})
