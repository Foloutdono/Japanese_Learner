import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { AnalyzerHistory } from './AnalyzerHistory'
import { LangProvider } from '../../LangContext'
// The component itself doesn't import its own stylesheet -- it's pulled
// in globally via index.css in the real app. The target-size assertion
// below needs the real rule, not the browser's unstyled button default,
// so this test file imports it directly.
import './analysis.css'

// Plan 037: an instant, confirmation-free delete through a target under
// WCAG's 24x24 floor, a date the API already sends but never renders,
// and a source stamp with no accessible name. These cases pin the fix.
const T = {
  historyTitle: 'Recent',
  noHistory: 'No phrases analyzed yet.',
  delete: 'Delete',
  sourcePhoto: 'Photo',
  entryDeleted: 'Removed from your history',
  undo: 'Undo',
  noticeDismiss: 'Dismiss',
}

// AnalyzerHistory calls useLang() (for `shortDate`'s locale), so it
// needs a real LangProvider ancestor -- same pattern as
// SentenceBreakdown.browser.test.jsx. LangProvider fetches
// /api/translations/{kanji,vocab} on mount, unrelated to what these
// tests check, so `fetch` is stubbed module-wide to keep them offline.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
})

function withLang(children) {
  return <LangProvider>{children}</LangProvider>
}

function entryFixture(overrides = {}) {
  return { id: 1, phrase: 'テスト', source: 'typed', ...overrides }
}

describe('AnalyzerHistory', () => {
  it('renders the date of each entry', async () => {
    const entries = [
      entryFixture({ id: 1, created_at: '2026-08-20T00:00:00Z' }),
      entryFixture({ id: 2, created_at: null }),
    ]
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={entries} onOpen={() => {}} onDelete={() => {}} />)
    )
    const whens = screen.container.querySelectorAll('.anl-history__when')
    expect(whens.length).toBe(1)
  })

  it('hands the whole entry to onDelete', async () => {
    const onDelete = vi.fn()
    const entry = entryFixture({ id: 42, phrase: '猫' })
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={onDelete} />)
    )
    screen.container.querySelector('.anl-history__delete').click()
    expect(onDelete).toHaveBeenCalledWith(entry)
    // Regression guard: the old signature passed the bare id.
    expect(onDelete).not.toHaveBeenCalledWith(42)
  })

  it('offers an undo after a delete', async () => {
    const onUndo = vi.fn()
    const deleted = entryFixture({ id: 7, phrase: '犬' })
    const screen = await render(withLang(
      <AnalyzerHistory
        t={T}
        entries={[]}
        onOpen={() => {}}
        onDelete={() => {}}
        lastDeleted={deleted}
        onUndo={onUndo}
        onDismissUndo={() => {}}
      />
    ))
    const undoBar = screen.container.querySelector('.anl-undo')
    expect(undoBar).not.toBeNull()
    screen.container.querySelector('.anl-undo button').click()
    expect(onUndo).toHaveBeenCalled()
  })

  it('gives the delete control a target of at least 24px', async () => {
    const entry = entryFixture()
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    const rect = screen.container.querySelector('.anl-history__delete').getBoundingClientRect()
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it('names the photo stamp', async () => {
    const entry = entryFixture({ source: 'image' })
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    const stamp = screen.container.querySelector('.anl-history__source')
    expect(stamp).not.toBeNull()
    expect(stamp.getAttribute('aria-label')).toBeTruthy()
  })
})
