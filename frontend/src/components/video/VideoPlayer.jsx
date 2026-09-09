import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { loadYouTubeIframeAPI } from '../../lib/youtubePlayer'

// Frame accuracy is not attempted -- 250ms is plenty to keep the
// subtitle overlay in sync with a human reading pace (see plan 019
// Step 5).
const POLL_MS = 250

// The IFrame API grows its methods on the player object when the frame
// is ready, not when `new YT.Player` returns -- so every call has to be
// guarded, and the sound is applied again from onReady.
function applySound(player, { volume, muted }) {
  if (!player || typeof player.setVolume !== 'function') return
  player.setVolume(volume)
  // setVolume does NOT lift a mute: a muted player moved to 80 is a
  // silent player that reads 80. Both halves, every time.
  if (muted) player.mute()
  else player.unMute()
}

// Thin wrapper around the official YouTube IFrame Player. Exposes
// seekTo/pause/play imperatively (AnalyzerScreen drives these -- e.g.
// pausing when the learner taps a word) and reports the current
// playback time upward via onTimeUpdate, polled rather than push-driven
// since the IFrame API has no time-update event of its own.
// `onPlayingChange` (optional) reports whether the video is actually
// playing -- the IFrame's own truth, not a guess kept beside it. The
// analyser's transport bar needs it: a play/pause control that tracks
// its own boolean drifts the moment the learner uses the iframe's
// native controls instead.
//
// `volume` (0-100) and `muted` are the same bargain for sound: they are
// applied to the player whenever they change, and `onVolumeChange`
// reports the iframe's own value back whenever the learner reaches
// past our bar for YouTube's own slider. Note that a phone browser (iOS
// especially) hands playback volume to the hardware buttons alone and
// ignores setVolume; mute still lands there, which is why the two are
// separate controls rather than one slider whose zero means silence.
export const VideoPlayer = forwardRef(function VideoPlayer({
  videoId,
  volume = 100,
  muted = false,
  onTimeUpdate,
  onPlayingChange,
  onVolumeChange,
}, ref) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const intervalRef = useRef(null)
  // What we last ASKED the player for, readable from the poll and from
  // onReady without re-running the effect that builds the iframe.
  const wantRef = useRef({ volume, muted })
  // What the player last REPORTED. The pair is what makes the read-back
  // below race-free -- see readSound.
  const liveRef = useRef(null)

  // ── Why the callbacks live in a ref ──
  // The poll and the state listener are installed ONCE (the effect
  // below depends on videoId alone, or the player would be torn down
  // and rebuilt on every parent render), so they outlive the render
  // that installed them -- and a prop captured there is frozen for the
  // life of the player. onTimeUpdate is rebuilt whenever 追従 flips,
  // which means the toggle never reached the poll: the line went on
  // following the clock after the learner had taken the wheel. Read
  // through a ref refreshed every render, the poll always calls the
  // current one.
  const handlersRef = useRef({ onTimeUpdate, onPlayingChange, onVolumeChange })
  // Refreshed in an effect rather than during render: a render React
  // throws away must not be able to leave its callbacks behind.
  useEffect(() => {
    handlersRef.current = { onTimeUpdate, onPlayingChange, onVolumeChange }
  })

  useEffect(() => {
    let cancelled = false

    // The iframe's own volume slider is right there under the video, so
    // the bar reads the player rather than trusting its own state --
    // the same bargain onPlayingChange strikes for play/pause.
    //
    // Two conditions, and the pair is what keeps our own writes from
    // fighting the read-back. A poll can land in the gap between
    // setVolume() and YouTube applying it, and reporting THAT reading
    // upward would snap the dial back under the learner's finger. But
    // in that gap the player still reads its OLD value -- unchanged
    // since the previous poll -- so requiring the reading to have MOVED
    // since the last poll excludes it, and requiring it to disagree
    // with what we asked for excludes our own settled writes.
    function readSound(player) {
      const report = handlersRef.current.onVolumeChange
      if (!report || typeof player.getVolume !== 'function') return
      const live = { volume: Math.round(player.getVolume()), muted: player.isMuted() === true }
      const prev = liveRef.current
      liveRef.current = live
      if (!prev || (live.volume === prev.volume && live.muted === prev.muted)) return
      const want = wantRef.current
      if (live.volume === want.volume && live.muted === want.muted) return
      report(live)
    }

    loadYouTubeIframeAPI().then(YT => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0 },
        events: {
          onReady: () => {
            // The learner's saved sound, applied before the first frame
            // plays rather than a beat into it.
            applySound(playerRef.current, wantRef.current)
            intervalRef.current = setInterval(() => {
              const player = playerRef.current
              if (!player || typeof player.getCurrentTime !== 'function') return
              handlersRef.current.onTimeUpdate(player.getCurrentTime())
              readSound(player)
            }, POLL_MS)
          },
          // YT.PlayerState.PLAYING is 1; everything else (paused,
          // buffering, cued, ended) reads as "not playing", which is
          // exactly what a play/pause toggle wants to display.
          onStateChange: e => handlersRef.current.onPlayingChange?.(e.data === 1),
        },
      })
    })
    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (playerRef.current?.destroy) playerRef.current.destroy()
      playerRef.current = null
    }
    // videoId only -- see the handlersRef note above for how the poll
    // reaches the current callbacks without rebuilding the player.
  }, [videoId])

  useEffect(() => {
    wantRef.current = { volume, muted }
    applySound(playerRef.current, wantRef.current)
  }, [volume, muted])

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
