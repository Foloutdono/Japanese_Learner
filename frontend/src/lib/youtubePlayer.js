// ── YouTube IFrame Player API loader ──────────────────────────────
// Playback stays entirely in the OFFICIAL player (docs/adr/0003): the
// view counts, ads serve, and nothing is ever downloaded. This module
// only loads the iframe_api script once and hands back window.YT once
// it's ready -- no video/audio fetching of any kind happens here or
// anywhere in this app.
let apiPromise = null

export function loadYouTubeIframeAPI() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiPromise
}
