// Client-side twin of study/captions.py's _YOUTUBE_URL_RES.
//
// The BACKEND remains the authority on whether a URL is acceptable when
// one is submitted with a session -- this never gates submission, so the
// two drifting apart costs a missing player, not a rejected video.
//
// It lives here rather than inside the video intake because the ANALYZER
// needs the same answer: a learner who uploads a file first and pastes
// the link afterwards has already created a session with no video_id,
// and re-uploading just to attach a link would be absurd. The player
// only ever needed an id, and the client can read one itself.
const YOUTUBE_ID_RES = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
]

/** The 11-character video id in a YouTube URL, or null. */
export function parseVideoId(url) {
  if (!url) return null
  for (const re of YOUTUBE_ID_RES) {
    const m = re.exec(url)
    if (m) return m[1]
  }
  return null
}
