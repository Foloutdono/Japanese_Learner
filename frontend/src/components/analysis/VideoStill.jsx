import { useState } from 'react'
import { thumbnailUrl } from '../../lib/youtube'

// ── A video's still (plan 136) ─────────────────────────────
// The frame YouTube serves for a video id, fetched by the learner's
// browser. An id YouTube no longer knows, or a network that cannot
// reach its image host, answers with an error -- and a broken image is
// the one thing this must never draw, so it gives way to `fallback`
// (the shelf's video glyph; nothing at all in the intake). `frame` is a
// class to wrap the image in, gone with it.
export function VideoStill({ videoId, className, frame, fallback = null }) {
  const [failed, setFailed] = useState(null)
  const src = thumbnailUrl(videoId)
  if (!src || failed === videoId) return fallback
  const img = (
    <img className={className} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(videoId)} />
  )
  return frame ? <span className={frame}>{img}</span> : img
}
