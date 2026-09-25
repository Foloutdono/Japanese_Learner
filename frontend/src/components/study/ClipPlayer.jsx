import { useContext, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { api } from '../../lib/api'
import { voicedUrl } from '../../lib/audio'
import { runKey } from '../../lib/keyGuards'
import { PlayIcon, PauseIcon, SpeakerOffIcon } from '../ui/Icons'
import { RunPanelsContext } from './runPanels'

// ── 書取 — the clip, played a fixed number of times ───────────
// Not exam/AudioPlayer with a counter bolted on. That player is built
// for a mode where replay is unlimited and the count is only a record
// of how much help you took; this one is built for a mode whose whole
// exercise is that the audio runs out. Three of its parts are wrong
// here, and each of them is wrong in the same direction:
//
//   the scrubber   a listen you can drag back to 0:00 is not a listen,
//                  it is unlimited replay wearing a limit. The rule
//                  and a seek bar cannot both exist, so this has none.
//   the replay     same argument, one button further along.
//   the clock      "0:04 / 0:07" tells a learner how much of the
//                  sentence is left to come, which is a hint the ear
//                  is supposed to earn. The bar under the button says
//                  the clip is running; it does not say how long it is.
//
// What replaces them is the one fact this mode has and the exam does
// not: how many listens are left. They are drawn as marks that are
// spent rather than as a number counting up — a ticket being punched,
// which is what the station does with a fixed number of journeys.
//
// The count belongs to the caller, not to this component: it is
// submitted with the answer (routes/dictation.py records it) and reset
// when the next clip arrives, so the run owns it and this reports the
// press. A listen is spent on the transition INTO playing, never on
// the button — pausing to think and resuming is one listen, the same
// rule exam/AudioPlayer's own comment argues for.
//
// No colour prop: the pigment is injected once, by the screen shell
// (StudyStage sets --line-color on .stage), and everything under it
// reads var(--line-color). DESIGN.md, "The pigment is injected once".
//
// `keyHint` is the desk's (plan 123): Space plays and pauses, as it
// does the exam's clip one gate over, under the same spent-listen rule
// -- it presses the button, so it can do nothing the button cannot.
export default function ClipPlayer({ src, plays, maxPlays, onPlay, keyHint = false }) {
  const { t } = useLang()
  const panels = useContext(RunPanelsContext)
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  // Mirrors atStart(audioRef.current) as state, since the disabled prop
  // below is computed at render time and a ref cannot be read there.
  const [start, setStart] = useState(true)
  // WHICH src failed, not a bare "it failed": the next clip carries a
  // different one, so this resets itself on the swap with no effect to
  // keep in step. (Same reasoning as exam/AudioPlayer's failedSrc.)
  const [failedSrc, setFailedSrc] = useState(null)
  const failed = Boolean(src) && failedSrc === src

  const spent = plays >= maxPlays

  // Leaving must stop the clip. React removes the <audio> node on
  // unmount but does not promise it stops first, and a sentence talking
  // over the next one is worse here than anywhere else in the app — the
  // learner is transcribing.
  //
  // Nothing is RESET here, because nothing needs to be: the run keys
  // this component on the src, so a new clip is a new player and the
  // progress rail starts where a fresh mount starts it.
  useEffect(() => {
    const el = audioRef.current
    return () => { if (el) el.pause() }
  }, [])

  // Space from nowhere in particular: not from the field (romaji has
  // spaces) nor from a button or a link, whose own Space it is.
  const playRef = useRef(null)
  useEffect(() => {
    if (!keyHint) return undefined
    const onKey = e => {
      if (e.key !== ' ' || !runKey(e)) return
      if (/^(BUTTON|A)$/.test(e.target?.tagName ?? '')) return
      const button = playRef.current
      if (!button || button.disabled) return
      e.preventDefault()
      button.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyHint])

  if (!src || failed) {
    return (
      <div className="clip-player clip-player--dead">
        <SpeakerOffIcon size={16} />
        <span>{failed ? t.examAudioUnavailable : t.examAudioPending}</span>
      </div>
    )
  }

  // A clip played to the end sits at its duration rather than at 0, and
  // pressing play there is the commonest way to take the next listen —
  // checking currentTime alone misses exactly that one. Paused anywhere
  // else in between is a listen still in progress, not a fresh one: the
  // button must stay usable there even once `spent` is true, or the last
  // allowed listen can never be resumed after a pause to think.
  function atStart(el) {
    return !el || el.currentTime === 0 || el.ended
  }

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      return
    }
    if (atStart(el)) {
      if (spent) return
      el.currentTime = 0
      onPlay()
    }
    setStart(false)
    el.play().catch(() => setPlaying(false))
  }

  const left = Math.max(0, maxPlays - plays)
  return (
    <div className="clip-player">
      {/* src is backend-relative ("/exam-audio/<key>.mp3", see
          study/dictation.py) — served same-origin like every other
          backend path: the Vite proxy in dev, vercel.json's rewrite in
          production. The voice revision rides on it, as in
          exam/AudioPlayer: a remade clip keeps its name. */}
      <audio
        ref={audioRef}
        src={api(voicedUrl(src))}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(1); setStart(true) }}
        onTimeUpdate={e => {
          const el = e.currentTarget
          setProgress(el.duration ? el.currentTime / el.duration : 0)
        }}
        onError={() => setFailedSrc(src)}
      />

      <button
        ref={playRef}
        type="button"
        className="clip-player__play"
        onClick={toggle}
        disabled={spent && !playing && start}
        aria-label={playing ? t.examAudioPause : t.dictationListen}
        aria-keyshortcuts={keyHint ? 'Space' : undefined}
      >
        {playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
      </button>

      <div className="clip-player__body">
        <span className="clip-player__rail" aria-hidden="true">
          <span className="clip-player__fill" style={{ transform: `scaleX(${progress})` }} />
        </span>
        <span className="clip-player__tickets">
          {/* The marks are decoration for a screen reader — the count
              beside them is the same fact in words, and two lists of it
              is one too many. */}
          <span className="clip-player__marks" aria-hidden="true">
            {Array.from({ length: maxPlays }, (_, i) => (
              <span key={i} className={`clip-player__mark${i < plays ? ' clip-player__mark--spent' : ''}`} />
            ))}
          </span>
          <span className="clip-player__left" role="status">{t.dictationListensLeft(left)}</span>
          {/* Not on a run's panels (plan 128): the run's lines list Space. */}
          {keyHint && !panels && <kbd className="desk-kbd" aria-hidden="true">{t.keySpace}</kbd>}
        </span>
      </div>
    </div>
  )
}
