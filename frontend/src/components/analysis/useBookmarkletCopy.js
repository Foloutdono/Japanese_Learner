import { useState, useRef, useCallback } from 'react'
import { parseVideoId } from '../../lib/youtube'
import { buildBookmarklet } from '../../lib/captionGrab'

// ── 字幕取り — the grab's two shared pieces ─────────────────────────
// IntakeVideo's panel and the walkthrough (GrabTutorial) both copy the
// bookmarklet and both link the video's watch page. On a phone the
// walkthrough is the panel's own dialog; on the desk it stands in the
// intake's column (plan 117) and the screen holds the state, so both
// copy buttons — on screen at once there — confirm together.

// The watch page a pasted link names, or null: where the grab runs.
export function watchUrlFor(url) {
  const id = parseVideoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

// Copy, not drag: React (rightly) refuses javascript: hrefs, and on
// a phone there is nothing to drag to anyway — copy → new bookmark
// → paste is the flow that works everywhere. `copied` confirms it for
// a moment. One state for every copy button that is the same act: the
// panel's and the walkthrough's.
export function useBookmarkletCopy() {
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(null)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildBookmarklet(window.location.origin))
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2400)
    } catch {
      // Clipboard refused (permissions, insecure context) — the
      // button simply doesn't confirm, and the file path remains.
    }
  }, [])
  return { copied, copy }
}
