import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { songName } from '../../lib/songAudio'

// ── 歌 — a song's player (plan 317) ──────────────────────────────────
// The analyser plays a song from the learner's own file, kept on their
// device (lib/songStore.js), the way it plays a video from YouTube: this
// is VideoPlayer's contract over an <audio>, so the screen's clock (its
// playhead and the follow on time), the transport and the sung words
// read it without knowing which one it is.
//
//   - the clock polled every POLL_MS, as VideoPlayer's is: the playhead
//     carries it between polls;
//   - `onPlayingChange(playing, moving)`: a stall to load more is
//     playing to the bar (Pause still pauses it), its clock not moving;
//   - `onDurationChange` once the file's length is known;
//   - `volume`/`muted` and `rate` applied whenever they change, and the
//     element's own volume reported back when something other than
//     these props moved it (a phone's hardware buttons do not: there,
//     as with the video, only mute reaches the element);
//   - seekTo, pause, play, currentTime, and title() -- the song's name,
//     which the song's decks and a line's translation are told.
//
// Nothing is drawn: the song has no picture, and the analyser's own
// transport is its only control.
const POLL_MS = 250

export const AudioPlayer = forwardRef(function AudioPlayer({
  src,
  name = '',
  volume = 100,
  muted = false,
  rate = 1,
  onTimeUpdate,
  onPlayingChange,
  onVolumeChange,
  onDurationChange,
}, ref) {
  const audioRef = useRef(null)
  const wantRef = useRef({ volume, muted })
  // The callbacks in a ref refreshed every render, as VideoPlayer keeps
  // them: the poll is installed once per source and must call the
  // current ones (a callback is rebuilt whenever 追従 flips).
  const handlersRef = useRef({ onTimeUpdate, onPlayingChange, onVolumeChange, onDurationChange })
  useEffect(() => {
    handlersRef.current = { onTimeUpdate, onPlayingChange, onVolumeChange, onDurationChange }
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    let told = { playing: false, moving: false }
    const tell = (playing, moving) => {
      if (playing === told.playing && moving === told.moving) return
      told = { playing, moving }
      handlersRef.current.onPlayingChange?.(playing, moving)
    }
    let length = 0
    const readDuration = () => {
      const seconds = Math.floor(audio.duration || 0)
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds === length) return
      length = seconds
      handlersRef.current.onDurationChange?.(seconds)
    }
    const onPlaying = () => tell(true, true)
    const onWaiting = () => { if (!audio.paused) tell(true, false) }
    const onPaused = () => tell(false, false)
    const onVolume = () => {
      const live = { volume: Math.round(audio.volume * 100), muted: audio.muted }
      const want = wantRef.current
      if (live.volume === want.volume && live.muted === want.muted) return
      handlersRef.current.onVolumeChange?.(live)
    }
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('pause', onPaused)
    audio.addEventListener('ended', onPaused)
    audio.addEventListener('durationchange', readDuration)
    audio.addEventListener('loadedmetadata', readDuration)
    audio.addEventListener('volumechange', onVolume)
    const timer = setInterval(() => {
      if (audio.readyState > 0) handlersRef.current.onTimeUpdate?.(audio.currentTime)
    }, POLL_MS)
    return () => {
      clearInterval(timer)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('pause', onPaused)
      audio.removeEventListener('ended', onPaused)
      audio.removeEventListener('durationchange', readDuration)
      audio.removeEventListener('loadedmetadata', readDuration)
      audio.removeEventListener('volumechange', onVolume)
      audio.pause()
    }
  }, [src])

  useEffect(() => {
    wantRef.current = { volume, muted }
    const audio = audioRef.current
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.muted = muted
  }, [volume, muted])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(seconds)) return false
      audio.currentTime = Math.max(0, seconds)
      return true
    },
    pause() {
      audioRef.current?.pause()
    },
    play() {
      // A refused play (no gesture yet, a file the device cannot play)
      // is a pause that stays a pause, never an unhandled rejection.
      audioRef.current?.play()?.catch?.(() => {})
    },
    currentTime() {
      return audioRef.current ? audioRef.current.currentTime : null
    },
    title() {
      return songName(name)
    },
    channel() {
      return ''
    },
  }), [name])

  return <audio ref={audioRef} src={src} preload="auto" />
})
