import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { PassageShelf } from './PassageShelf'
import { LangProvider } from '../../LangContext'
// The component itself doesn't import a stylesheet -- in the real app
// it's pulled in globally via index.css -- and the target-size
// assertions below need the real rules, not the browser's unstyled
// button default, so this file imports the one merged sheet directly.
import '../../index.css'

// ── 帳 — the passages under the line (plan 136) ──
// Under the desk the analyser's shelf is a row of chips over a row per
// passage; the desk's cards are analyzer.desktop's. What carried over
// from the history it replaced (plans 037, 040): a delete through a
// real target, the date the API sends, a platform named for a reader,
// and the merged passage/session shape -- `kind`, `label`, `createdAt`.
const T = {
  historyTitle: 'History',
  shelfEmptyPhone: 'Your passages will show here.',
  shelfAll: 'All',
  shelfKept: 'Kept',
  shelfFilter: 'Show',
  passageKept: 'Kept',
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
  passagesCount: n => `${n} ${n === 1 ? 'passage' : 'passages'}`,
}

// PassageShelf calls useLang() (for `shortDate`'s locale), so it needs a
// real LangProvider ancestor. LangProvider fetches translations on
// mount, unrelated to what these tests check, so `fetch` is stubbed.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const passage = (overrides = {}) => ({ kind: 'passage', id: 1, label: 'テスト', source: 'typed', ...overrides })
const session = (overrides = {}) => ({
  kind: 'session', id: 1, label: 'clip.srt', source: 'upload', sentenceCount: 3, videoId: null, ...overrides,
})

async function shelf(entries, props = {}) {
  return render(
    <LangProvider>
      <PassageShelf t={T} entries={entries} onOpen={() => {}} onDelete={() => {}} {...props} />
    </LangProvider>
  )
}

beforeEach(async () => { await page.viewport(414, 900) })

describe('PassageShelf, under the desk', () => {
  it('renders the date of each entry', async () => {
    const screen = await shelf([passage({ createdAt: new Date().toISOString() })])
    expect(screen.container.querySelector('.anl-row__meta').textContent).toContain('today')
  })

  it('hands the whole entry to onDelete', async () => {
    const onDelete = vi.fn()
    const entry = passage({ id: 7 })
    const screen = await shelf([entry], { onDelete })
    screen.container.querySelector('.anl-row__delete').click()
    expect(onDelete).toHaveBeenCalledWith(entry)
  })

  it('offers an undo after a delete', async () => {
    const onUndo = vi.fn()
    const screen = await shelf([], { lastDeleted: passage(), onUndo })
    expect(screen.container.textContent).toContain('Removed from your history')
    screen.container.querySelector('.anl-undo__btn').click()
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('gives the delete and the row targets a thumb can take', async () => {
    const screen = await shelf([passage()])
    const del = screen.container.querySelector('.anl-row__delete').getBoundingClientRect()
    expect(del.width).toBeGreaterThanOrEqual(24)
    expect(del.height).toBeGreaterThanOrEqual(24)
    expect(screen.container.querySelector('.anl-row__open').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })

  it('names the platform of a photo row, and of a video\'s still', async () => {
    const screen = await shelf([passage({ source: 'image' }), session({ id: 2, videoId: 'dQw4w9WgXcQ' })])
    const leads = [...screen.container.querySelectorAll('.anl-row__lead[role="img"]')].map(l => l.getAttribute('aria-label'))
    expect(leads).toEqual(['Photo', 'Video'])
  })

  it('prints a session\'s first sentence and its count, and hands it to onDelete too', async () => {
    const onDelete = vi.fn()
    const entry = session({ firstLine: '駅の前で', label: 'dQw4w9WgXcQ.ja.vtt', sentenceCount: 36 })
    const screen = await shelf([entry], { onDelete })
    expect(screen.container.querySelector('.anl-row__jp').textContent).toBe('駅の前で')
    expect(screen.container.querySelector('.anl-row__meta').textContent).toContain('36 sentences')
    screen.container.querySelector('.anl-row__delete').click()
    expect(onDelete).toHaveBeenCalledWith(entry)
  })

  it('lists a session with no video by its label', async () => {
    const screen = await shelf([session()])
    expect(screen.container.querySelector('.anl-row__jp').textContent).toBe('clip.srt')
    expect(screen.container.querySelector('.anl-row__lead--still svg')).not.toBeNull()
  })

  it('draws chips only for what it holds, and narrows by them', async () => {
    const one = await shelf([passage({ id: 1 }), passage({ id: 2, label: '二' })])
    expect(one.container.querySelector('.anl-shelf__chips')).toBeNull()
    await one.unmount()

    const screen = await shelf([
      passage({ id: 1, label: '一' }),
      passage({ id: 2, label: '二', source: 'image', kept: true }),
      session({ id: 3, label: 'clip.srt' }),
    ])
    const chips = () => [...screen.container.querySelectorAll('.anl-shelf__chips .chip')]
    expect(chips().map(c => c.firstChild.textContent)).toEqual(['All', 'Video', 'Text', 'Photo', 'Kept'])
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true')
    chips()[4].click()
    await expect.poll(() => [...screen.container.querySelectorAll('.anl-row__jp')].map(r => r.textContent)).toEqual(['二'])
    chips()[1].click()
    await expect.poll(() => [...screen.container.querySelectorAll('.anl-row__jp')].map(r => r.textContent)).toEqual(['clip.srt'])
  })

  it('says what it waits for when there is nothing yet', async () => {
    const screen = await shelf([])
    expect(screen.container.textContent).toContain('Your passages will show here.')
    expect(screen.container.querySelector('.anl-shelf__rows, .anl-shelf__chips')).toBeNull()
  })
})
