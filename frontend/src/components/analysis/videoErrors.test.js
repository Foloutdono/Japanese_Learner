import { describe, it, expect } from 'vitest'
import en from '../../locales/en/index.js'
import fr from '../../locales/fr/index.js'
import { ApiError } from '../../lib/api'
import { videoErrorMessage } from './videoErrors'

// ── 動画 — the server names it, the table says it (plan 210) ─────
// Every code routes/video.py and study/captions.py can send, against
// the real tables: a code that maps to a missing key would render as
// nothing, and a code missing here would fall to the screen's own line
// -- both a learner told less than the server knew. The server's
// English never reaches the result.
const DOOR = {
  not_youtube_url: 'videoNotYoutube',
  link_fetch_disabled: 'videoLinkFetchOff',
  link_allowance_mine: 'videoLinkAllowanceMine',
  link_allowance_app: 'videoLinkAllowanceApp',
  file_too_large: 'subtitleTooLarge',
  not_utf8: 'subtitleNotUtf8',
  end_before_start: 'windowBackwards',
}
const WORKER = {
  no_japanese_subtitles: 'videoNoJapanese',
  subtitles_disabled: 'videoSubtitlesOff',
  subtitles_empty: 'videoSubtitlesEmpty',
  video_unavailable: 'videoUnavailable',
  youtube_refused: 'videoYoutubeRefused',
  youtube_unreachable: 'videoYoutubeUnreachable',
  fetch_failed: 'captionsUnavailable',
  unknown_format: 'subtitleUnknownFormat',
  no_cues: 'subtitleNoCues',
  no_timestamps: 'transcriptNoTimestamps',
  parse_failed: 'subtitleParseFailed',
  transcript_failed: 'videoTranscriptFailed',
  stalled: 'videoStalled',
}

describe('videoErrorMessage', () => {
  it('words a refusal at the door from its code', () => {
    for (const t of [fr, en]) {
      for (const [code, key] of Object.entries(DOOR)) {
        const e = new ApiError(400, { detail: { code, message: 'English for the logs' } }, '/api/video/session')
        expect(t[key], key).toBeTruthy()
        expect(videoErrorMessage(e, t)).toBe(t[key])
      }
    }
  })

  it('words a worker’s failure, off the poll’s body', () => {
    for (const t of [fr, en]) {
      for (const [code, key] of Object.entries(WORKER)) {
        const e = new ApiError(503, { status: 'failed', code, error: 'English for the logs', isYoutube: true }, '/api/video/session/7')
        expect(t[key], key).toBeTruthy()
        expect(videoErrorMessage(e, t)).toBe(t[key])
      }
    }
  })

  // Shift-JIS is the usual reason a Japanese .srt is not UTF-8, and the
  // sentence says so rather than leaving "UTF-8" to be looked up.
  it('names Shift-JIS when a file is not UTF-8', () => {
    expect(fr.subtitleNotUtf8).toContain('Shift-JIS')
    expect(en.subtitleNotUtf8).toContain('Shift-JIS')
  })

  it('falls back to the screen’s own line, never the server’s sentence', () => {
    // A row failed before the codes: its road still decides the line.
    const oldLink = new ApiError(503, { status: 'failed', code: null, error: 'This video is unavailable.', isYoutube: true }, '/x')
    expect(videoErrorMessage(oldLink, fr)).toBe(fr.captionsUnavailable)
    const oldFile = new ApiError(503, { status: 'failed', code: null, error: 'No usable cues found', isYoutube: false }, '/x')
    expect(videoErrorMessage(oldFile, fr)).toBe(fr.analysisFailed)
    // A proxy's own 413, with no JSON behind it.
    expect(videoErrorMessage(new ApiError(413, null, '/api/video/session'), fr)).toBe(fr.subtitleTooLarge)
    // The session gone from under the poll; a dropped connection.
    expect(videoErrorMessage(new ApiError(404, { detail: 'Session not found' }, '/x'), fr)).toBe(fr.analysisFailed)
    expect(videoErrorMessage(new TypeError('Failed to fetch'), fr)).toBe(fr.analysisFailed)
  })
})
