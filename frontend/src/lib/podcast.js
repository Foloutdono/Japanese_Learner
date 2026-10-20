// ── A podcast, by its feed (plan 265) ─────────────────────────────
// The feed is read by the server (backend/study/podcast.py), which
// guards the one URL a learner types that it fetches. An episode's
// audio is wanted here, in the browser, which keeps its sound for the
// recogniser (lib/mediaAudio.js): asked of the episode's own address
// first, which costs the server nothing, and of the server's relay
// when the host sends no CORS headers, which is most of them. Playing
// the episode beside its lines needs neither: a media element plays a
// cross-origin file without CORS.
import { apiJson, apiFetch, ApiError } from './api'

/** A feed URL's title, picture and episodes ({title, published,
 *  duration, audioUrl, image}), newest first; ApiError with a code. */
export function readFeed(session, url) {
  return apiJson(`/api/video/podcast?url=${encodeURIComponent(url.trim())}`, session)
}

/** An episode's audio, as a Blob. */
export async function episodeAudio(session, audioUrl, { signal } = {}) {
  try {
    const direct = await fetch(audioUrl, { mode: 'cors', credentials: 'omit', signal })
    if (direct.ok) return await direct.blob()
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    // A CORS refusal is a TypeError with nothing to read: the relay.
  }
  const path = `/api/video/podcast/audio?url=${encodeURIComponent(audioUrl)}`
  const relayed = await apiFetch(path, session, { signal })
  if (!relayed.ok) {
    let body = null
    try { body = await relayed.json() } catch { /* a body that is no JSON */ }
    throw new ApiError(relayed.status, body, path)
  }
  return await relayed.blob()
}

/** Whether `text` is a web address that is not a YouTube link: what the
 *  intake offers to read as a podcast's feed. */
export function feedAddress(text, isYoutube) {
  const s = (text ?? '').trim()
  return /^https?:\/\/\S+\.\S+$/.test(s) && !isYoutube(s) ? s : null
}
