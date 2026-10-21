import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'

// The same 250ms the YouTube player is polled at (VideoPlayer.jsx).
const POLL_MS = 250

// ── The player for a recording (plan 265) ─────────────────────────
// VideoPlayer's twin for what is not on YouTube: a file on the
// learner's device (an object URL, this visit only), a podcast's
// episode, a page's own media file -- played by the browser's own
// <video>, which plays a sound file as readily as a film (the frame
// stays dark, and the title says what is playing). Same props, same
// handle (seekTo, pause, play, currentTime, title, channel), so the
// analyser drives either without knowing which it holds.
//
// Unlike the iframe, the element tells of every change itself, so the
// poll only carries the clock; the state, the sound and the length are
// read from the element's own events.
//
// `cover` (the owner's pick C of the canvas "Tsuji analyser — new ways
// in"): a recording with no picture -- a podcast's episode, a sound
// file -- left the frame dark. Given { image, title, show, note }, the
// frame shows the episode's picture (or the sound's mark where it has
// none), its title, its podcast, and the note that it was heard by a
// recogniser; the element still plays underneath, driven by the
// analyser's own bar, and its controls go.
const JAPANESE = /[\u3040-\u30ff\u4e00-\u9fff]/
const ja = text => (JAPANESE.test(text ?? '') ? 'ja' : undefined)

export const MediaPlayer = forwardRef(function MediaPlayer({
  src,
  title = '',
  cover = null,
  volume = 100,
  muted = false,
  rate = 1,
  onTimeUpdate,
  onPlayingChange,
  onVolumeChange,
  onDurationChange,
}, ref) {
  const mediaRef = useRef(null)
  const wantRef = useRef({ volume, muted })
  // Read through a ref refreshed every render, as VideoPlayer's are:
  // the listeners are installed once a source.
  const handlersRef = useRef({ onTimeUpdate, onPlayingChange, onVolumeChange, onDurationChange })
  useEffect(() => {
    handlersRef.current = { onTimeUpdate, onPlayingChange, onVolumeChange, onDurationChange }
  })

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return undefined
    let told = { playing: false, moving: false }
    const tellState = () => {
      const playing = !el.paused && !el.ended
      // A stall to load more is still the recording playing; its clock
      // is not moving (VideoPlayer's BUFFERING).
      const moving = playing && !el.seeking && el.readyState >= 3
      if (playing === told.playing && moving === told.moving) return
      told = { playing, moving }
      handlersRef.current.onPlayingChange?.(playing, moving)
    }
    let length = 0
    const readDuration = () => {
      const seconds = Number.isFinite(el.duration) ? Math.floor(el.duration) : 0
      if (seconds <= 0 || seconds === length) return
      length = seconds
      handlersRef.current.onDurationChange?.(seconds)
    }
    // The element's own controls can change the sound: told upward when
    // it is not what was asked for, as the iframe's slider is.
    const readSound = () => {
      const live = { volume: Math.round(el.volume * 100), muted: el.muted }
      const want = wantRef.current
      if (live.volume === want.volume && live.muted === want.muted) return
      wantRef.current = live
      handlersRef.current.onVolumeChange?.(live)
    }
    const stateEvents = ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'canplay']
    stateEvents.forEach(name => el.addEventListener(name, tellState))
    el.addEventListener('loadedmetadata', readDuration)
    el.addEventListener('durationchange', readDuration)
    el.addEventListener('volumechange', readSound)
    const timer = setInterval(() => {
      handlersRef.current.onTimeUpdate?.(el.currentTime)
    }, POLL_MS)
    return () => {
      clearInterval(timer)
      stateEvents.forEach(name => el.removeEventListener(name, tellState))
      el.removeEventListener('loadedmetadata', readDuration)
      el.removeEventListener('durationchange', readDuration)
      el.removeEventListener('volumechange', readSound)
    }
  }, [src])

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    wantRef.current = { volume, muted }
    el.volume = Math.max(0, Math.min(1, volume / 100))
    el.muted = muted
  }, [volume, muted, src])

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = rate
  }, [rate, src])

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const el = mediaRef.current
      if (!el || el.readyState < 1) return false
      el.currentTime = seconds
      return true
    },
    pause() {
      mediaRef.current?.pause()
    },
    play() {
      // A play() the browser refuses (no gesture yet) is the learner's
      // next press, not an error.
      mediaRef.current?.play()?.catch?.(() => {})
    },
    currentTime() {
      return mediaRef.current ? mediaRef.current.currentTime : null
    },
    title() {
      return title
    },
    channel() {
      return ''
    },
  }), [title])

  // A picture that will not load is the sound's mark instead.
  const [broken, setBroken] = useState(null)
  const art = cover?.image && broken !== cover.image ? cover.image : null

  return (
    <div className={`video-player__frame${cover ? ' video-player__frame--cover' : ''}`}>
      <video
        ref={mediaRef}
        className="video-player__media"
        src={src}
        controls={!cover}
        playsInline
        preload="metadata"
        aria-label={title || undefined}
      />
      {cover && (
        <div className="video-player__cover">
          {art ? (
            <img
              className="video-player__art"
              src={art}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBroken(art)}
            />
          ) : (
            <span className="video-player__art video-player__art--mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
              </svg>
            </span>
          )}
          <span className="video-player__about">
            {cover.title && <span className="video-player__title" lang={ja(cover.title)}>{cover.title}</span>}
            {cover.show && <span className="video-player__show" lang={ja(cover.show)}>{cover.show}</span>}
            {cover.note && <span className="video-player__note">{cover.note}</span>}
          </span>
        </div>
      )}
    </div>
  )
})
