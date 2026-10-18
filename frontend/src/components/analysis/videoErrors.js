// ── 動画 — why a video did not open, in the learner's own words ──
// A video session can be refused at the door (POST /api/video/session:
// a link this server cannot fetch, a file that is not UTF-8, the day's
// link allowance) or fail in the worker after it (no Japanese track, a
// file that would not parse), which the poll reports as a 503 carrying
// the stored failure. Both used to be printed as the server wrote them:
// an English sentence, on an app whose learners read French first.
//
// The server now names each one with a stable snake_case `code` (plan
// 210; routes/video.py, study/captions.py) and keeps its English for the
// logs. This is the one table that words them, so the door's refusal
// and the worker's failure cannot say the same thing two ways.
//
// A code this table does not know -- a row failed before the codes, a
// refusal added later -- gets the screen's own line, never the server's
// sentence.
const NAMED = {
  // At the door.
  not_youtube_url: t => t.videoNotYoutube,
  link_fetch_disabled: t => t.videoLinkFetchOff,
  link_allowance_mine: t => t.videoLinkAllowanceMine,
  link_allowance_app: t => t.videoLinkAllowanceApp,
  file_too_large: t => t.subtitleTooLarge,
  transcript_too_long: t => t.transcriptTooLong,
  session_preparing: t => t.videoStillPreparing,
  not_utf8: t => t.subtitleNotUtf8,
  end_before_start: t => t.windowBackwards,
  // In the worker: the link's road.
  no_japanese_subtitles: t => t.videoNoJapanese,
  subtitles_disabled: t => t.videoSubtitlesOff,
  subtitles_empty: t => t.videoSubtitlesEmpty,
  video_unavailable: t => t.videoUnavailable,
  youtube_refused: t => t.videoYoutubeRefused,
  youtube_unreachable: t => t.videoYoutubeUnreachable,
  fetch_failed: t => t.captionsUnavailable,
  // In the worker: a file or a paste.
  unknown_format: t => t.subtitleUnknownFormat,
  no_cues: t => t.subtitleNoCues,
  no_timestamps: t => t.transcriptNoTimestamps,
  parse_failed: t => t.subtitleParseFailed,
  transcript_failed: t => t.videoTranscriptFailed,
  // The poll: a worker lost on the way.
  stalled: t => t.videoStalled,
}

/**
 * The sentence for a failed video session, from whatever the request
 * threw: an ApiError whose `code` came off the refusal's detail, or the
 * poll's ApiError whose body is the stored failure ({ code, isYoutube }).
 */
export function videoErrorMessage(e, t) {
  const code = e?.code ?? e?.body?.code ?? null
  const named = NAMED[code]
  if (named) return named(t)
  // Without a code: a session failed before codes were stored, which
  // still says which road it took, or a refusal no JSON came back with
  // (a proxy's own 413 in front of the API).
  if (e?.body?.isYoutube) return t.captionsUnavailable
  if (e?.status === 413) return t.subtitleTooLarge
  return t.analysisFailed
}
