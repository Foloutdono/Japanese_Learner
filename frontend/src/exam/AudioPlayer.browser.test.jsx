import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
import AudioPlayer from './AudioPlayer'
import '../index.css'

// ── A clip the server cannot serve ──────────────────────────────
// The listening section's audio is written to a directory that is not
// guaranteed to outlive a deploy, while the URL naming it is stored in
// the paper forever (backend/study/exam_audio_repair.py re-synthesizes
// what it can, and cannot always). So "the src is fine, the clip is
// gone" is a state a real learner reaches mid-exam, and the player used
// to render it as a perfectly normal-looking player whose play button
// did nothing and whose clock sat at 0:00 — indistinguishable from a
// bug in the app, and impossible to act on.
//
// The lane runs in French (vite.config.js), so the copy asserted here is
// the French table's.

// Nothing is mounted at /exam-audio in this lane: the request 404s, and
// the <audio> element fires `error` — the same event a missing clip
// fires in production.
const MISSING = `/exam-audio/${'0'.repeat(24)}.mp3`
// Real files under public/, so the recovery below is a genuine load and
// the question swap after it a genuine second one.
const PLAYABLE = '/sounds/kanas/a.mp3'
const OTHER = '/sounds/kanas/i.mp3'

function player(src) {
  return render(<LangProvider><AudioPlayer src={src} /></LangProvider>)
}

const bar = (screen) => screen.container.querySelector('.exam-audio-bar--pending')
const chrome = (screen) => screen.container.querySelector('.exam-audio-player')

describe('AudioPlayer', () => {
  it('says a clip could not be loaded instead of showing a dead player', async () => {
    const screen = await player(MISSING)
    await vi.waitFor(() => {
      expect(bar(screen)?.textContent).toContain('impossible à charger')
    })
    expect(chrome(screen)).toBeNull()
  })

  it('distinguishes a clip that failed from one that was never made', async () => {
    const failed = await player(MISSING)
    await vi.waitFor(() => expect(bar(failed)).not.toBeNull())
    const never = await player(null)

    expect(bar(never).textContent).toContain('pas encore généré')
    expect(bar(failed).textContent).not.toBe(bar(never).textContent)
  })

  it('gives the next question its own chance', async () => {
    // A failure is a fact about one clip. Carrying it across the
    // question swap would blank the player for the rest of the section.
    const screen = await player(MISSING)
    await vi.waitFor(() => expect(bar(screen)).not.toBeNull())

    await screen.rerender(<LangProvider><AudioPlayer src={PLAYABLE} /></LangProvider>)

    await vi.waitFor(() => expect(chrome(screen)).not.toBeNull())
    expect(bar(screen)).toBeNull()
  })

  it('counts the replays of one clip, not of the section', async () => {
    // The badge says how much help was taken on THIS question. The
    // player is not remounted between questions -- only `src` changes --
    // so a count left standing across the swap accuses the learner of
    // replays they made on the previous clip.
    const screen = await player(PLAYABLE)
    await vi.waitFor(() => expect(chrome(screen)).not.toBeNull())

    const replay = () => screen.container.querySelector('.exam-audio-player__replay')
    const badge = () => screen.container.querySelector('.exam-audio-player__plays')

    replay().click()
    replay().click()
    await vi.waitFor(() => expect(badge()?.textContent).toBe('2'))

    await screen.rerender(<LangProvider><AudioPlayer src={OTHER} /></LangProvider>)

    expect(badge()).toBeNull()
  })
})
