// ── What a file picker of the analyser takes (plan 265) ───────────
// One list for every picker that hands a file to /api/video/session
// (the intake's button, the phone's entry line, a lyrics import, a
// file dropped on the desk's page), so a format the server learns to
// read is offered everywhere at once. The MIME types sit beside the
// extensions on purpose: Android's picker matches by MIME, and most of
// these map to none (see components/analysis/IntakeVideo.jsx).
//
// What the server reads (backend/study/captions.parse_track): SRT, VTT,
// ASS/SSA, srv3, LRC, TXT, and since plan 265 TTML/DFXP (the streaming
// services' and broadcasters' exports, often saved as .xml), SBV
// (YouTube Studio's) and json3 (YouTube's timed text as .json).
const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'ass', 'ssa', 'lrc', 'txt', 'ttml', 'dfxp', 'xml', 'sbv', 'json']
const SUBTITLE_TYPES = [
  'text/vtt', 'text/plain', 'text/*', 'application/ttml+xml', 'application/xml', 'text/xml',
  'application/json', 'application/octet-stream',
]
export const SUBTITLE_ACCEPT = [...SUBTITLE_EXTENSIONS.map(e => `.${e}`), ...SUBTITLE_TYPES].join(',')

// A recording to be transcribed (plan 265, lib/mediaAudio.js): any
// sound or film the browser can decode. The extensions are for the
// pickers that match on them; a file is told by its type first.
const MEDIA_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'mp4', 'm4v', 'mov', 'webm', 'mkv']
export const MEDIA_ACCEPT = ['audio/*', 'video/*', ...MEDIA_EXTENSIONS.map(e => `.${e}`)].join(',')

const extension = name => (name ?? '').toLowerCase().split('.').pop()

export function isSubtitleFile(file) {
  if (!file) return false
  if (file.type === 'text/vtt' || file.type === 'application/ttml+xml') return true
  return SUBTITLE_EXTENSIONS.includes(extension(file.name)) && !isMediaFile(file)
}

export function isMediaFile(file) {
  if (!file) return false
  if (file.type?.startsWith('audio/') || file.type?.startsWith('video/')) return true
  return MEDIA_EXTENSIONS.includes(extension(file.name))
}
