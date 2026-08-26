import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { loadYouTubeIframeAPI } from '../../lib/youtubePlayer'

// Frame accuracy is not attempted -- 250ms is plenty to keep the
// subtitle overlay in sync with a human reading pace (see plan 019
// Step 5).
const POLL_MS = 250

// Thin wrapper around the official YouTube IFrame Player. Exposes
// seekTo/pause/play imperatively (AnalyzerScreen drives these -- e.g.
// pausing when the learner taps a word) and reports the current
// playback time upward via onTimeUpdate, polled rather than push-driven
// since the IFrame API has no time-update event of its own.
export const VideoPlayer = forwardRef(function VideoPlayer({ videoId, onTimeUpdate }, ref) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeIframeAPI().then(YT => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0 },
        events: {
          onReady: () => {
            intervalRef.current = setInterval(() => {
              const player = playerRef.current
              if (player && typeof player.getCurrentTime === 'function') {
                onTimeUpdate(player.getCurrentTime())
              }
            }, POLL_MS)
          },
        },
      })
    })
    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (playerRef.current?.destroy) playerRef.current.destroy()
      playerRef.current = null
    }
    // videoId only -- onTimeUpdate is expected to be referentially
    // stable-enough (a useCallback at the call site); re-running this
    // effect on every parent render would tear down and rebuild the
    // player continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      playerRef.current?.seekTo(seconds, true)
    },
    pause() {
      playerRef.current?.pauseVideo()
    },
    play() {
      playerRef.current?.playVideo()
    },
  }), [])

  return <div className="video-player__frame"><div ref={containerRef} /></div>
})
