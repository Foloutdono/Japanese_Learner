import { useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { api } from '../lib/api'
import { PlayIcon, PauseIcon, UndoIcon, SpeakerOffIcon } from '../components/ui/Icons'

// ── Exam audio player ────────────────────────────────────────
// The listening section's only real control, so it can't be the
// browser's default `<audio controls>` — that renders a light-grey
// Chrome bar that ignores the app's theme entirely (glaring in dark
// mode), looks different in every browser, and can't say the one thing
// a practice player should: how many times you've replayed the clip.
//
// So: a real <audio> element doing the work, hidden, with the app's own
// chrome on top. Every colour is a token, so this flips with the theme
// like everything else.
//
// Replay is allowed on purpose. The real JLPT plays each clip exactly
// once, but these papers are for practice — the second listen is where
// the learning happens, and the play count is there so a learner can
// see honestly how much help they took.

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src }) {
  const { t } = useLang()
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [plays, setPlays] = useState(0)

  // Moving to the next question must stop the current clip. The native
  // player didn't: `CardTransition` swaps the question, React keeps the
  // <audio> node alive across the crossfade, and the previous
  // question's dialogue carries on talking over the new one.
  useEffect(() => {
    const el = audioRef.current
    return () => {
      if (el) el.pause()
    }
  }, [src])

  if (!src) {
    return (
      <div className="exam-audio-bar exam-audio-bar--pending">
        <SpeakerOffIcon size={16} />
        <span>{t.examAudioPending}</span>
      </div>
    )
  }

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      // Counted on the transition into playing, not on the button, so
      // pausing and resuming mid-clip isn't scored as a second listen.
      // `ended` matters as much as currentTime === 0: a clip played to
      // the end sits at its duration, and pressing play there is the
      // commonest way to take a second listen — checking position alone
      // missed exactly that one and left the badge under-reporting.
      if (el.currentTime === 0 || el.ended) setPlays(n => n + 1)
      el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
    }
  }

  function replay() {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    setPlays(n => n + 1)
    el.play().catch(() => setPlaying(false))
  }

  function scrub(e) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Number(e.target.value)
    setElapsed(el.currentTime)
  }

  return (
    <div className="exam-audio-player">
      {/* src is backend-relative ("/exam-audio/<hash>.mp3", see
          study/exam_tts.py) — served same-origin like every other
          backend path: the Vite proxy carries it in dev, vercel.json's
          rewrite in prod. */}
      <audio
        ref={audioRef}
        src={api(src)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={e => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
      />

      <button
        type="button"
        className="exam-audio-player__play"
        onClick={toggle}
        aria-label={playing ? t.examAudioPause : t.examAudioPlay}
      >
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>

      <div className="exam-audio-player__track">
        <input
          type="range"
          className="dial exam-audio-player__range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(elapsed, duration || 0)}
          onChange={scrub}
          aria-label={t.examAudioProgress}
          // The visible clock below is the readable version of this
          // slider's value; without it a screen reader announces a bare
          // number of seconds.
          aria-valuetext={`${formatClock(elapsed)} / ${formatClock(duration)}`}
        />
        <span className="exam-audio-player__clock">
          {formatClock(elapsed)} / {formatClock(duration)}
        </span>
      </div>

      <button
        type="button"
        className="exam-audio-player__replay"
        onClick={replay}
        aria-label={t.examAudioReplay}
        title={t.examAudioReplay}
      >
        <UndoIcon size={16} />
        {plays > 1 && <span className="exam-audio-player__plays">{plays}</span>}
      </button>
    </div>
  )
}
