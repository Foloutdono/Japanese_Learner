import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { AnalyzerHistory } from './AnalyzerHistory'
import { LangProvider } from '../../LangContext'
// The component itself doesn't import a stylesheet -- in the real app
// it's pulled in globally via index.css (analysis.css was merged into
// index.css by plan 041 and no longer exists as its own file). The
// target-size assertion below needs the real rule, not the browser's
// unstyled button default, so this test file imports the one merged
// sheet directly.
import '../../index.css'

// Plan 037: an instant, confirmation-free delete through a target under
// WCAG's 24x24 floor, a date the API already sends but never renders,
// and a source stamp with no accessible name. These cases pin the fix.
//
// Plan 040 added the merged passage/session shape: `kind`, `label` and
// `createdAt` replace the raw phrase_history field names the component
// used to read directly.
const T = {
  historyTitle: 'History',
  noHistory: 'No phrases analyzed yet.',
  delete: 'Delete',
  sourceText: 'Text',
  sourcePhoto: 'Photo',
  sourceVideo: 'Video',
  sessionSentenceCount: n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  entryDeleted: 'Removed from your history',
  undo: 'Undo',
  noticeDismiss: 'Dismiss',
  dateToday: 'today',
  dateYesterday: 'yesterday',
  dateDaysAgo: n => `${n} days ago`,
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
  return { kind: 'passage', id: 1, label: 'テスト', source: 'typed', ...overrides }
}

function sessionFixture(overrides = {}) {
  return {
    kind: 'session', id: 1, label: 'clip.srt', source: 'upload',
    sentenceCount: 3, videoId: null, ...overrides,
  }
}

describe('AnalyzerHistory', () => {
  it('renders the date of each entry', async () => {
    const entries = [
      entryFixture({ id: 1, createdAt: '2026-08-20T00:00:00Z' }),
      entryFixture({ id: 2, createdAt: null }),
    ]
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={entries} onOpen={() => {}} onDelete={() => {}} />)
    )
    const whens = screen.container.querySelectorAll('.anl-history__when')
    expect(whens.length).toBe(1)
  })

  it('hands the whole entry to onDelete', async () => {
    const onDelete = vi.fn()
    const entry = entryFixture({ id: 42, label: '猫' })
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
    const deleted = entryFixture({ id: 7, label: '犬' })
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

  // The roundel replaced the 写/動 stamps in the mockup round — same
  // provenance fact, same accessible-name requirement, now drawn as
  // the platform number the cards overhead use.
  it('names the platform roundel of a photo row', async () => {
    const entry = entryFixture({ source: 'image' })
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    const roundel = screen.container.querySelector('.anl-history__no')
    expect(roundel).not.toBeNull()
    expect(roundel.textContent).toBe('2')
    expect(roundel.getAttribute('aria-label')).toBeTruthy()
  })

  // ── Plan 040: video sessions in the merged list ──────────────
  it('renders a session row with its sentence count', async () => {
    const entry = sessionFixture({ sentenceCount: 5 })
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    expect(screen.container.querySelector('.anl-history__count').textContent).toBe('5 sentences')
    const roundel = screen.container.querySelector('.anl-history__no')
    expect(roundel).not.toBeNull()
    expect(roundel.textContent).toBe('3')
    expect(roundel.getAttribute('aria-label')).toBeTruthy()
  })

  it('offers no delete on a session row', async () => {
    const entry = sessionFixture()
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    expect(screen.container.querySelector('.anl-history__delete')).toBeNull()
  })

  it('lists a session with no video', async () => {
    // A transcript-only session (videoId null) is still worth reopening
    // -- the Sentences and their cue times are the study material, and
    // the video was always optional. It must not be hidden.
    const entry = sessionFixture({ videoId: null, label: 'no-video.srt' })
    const screen = await render(
      withLang(<AnalyzerHistory t={T} entries={[entry]} onOpen={() => {}} onDelete={() => {}} />)
    )
    expect(screen.container.querySelector('.anl-history__text').textContent).toBe('no-video.srt')
  })
})
