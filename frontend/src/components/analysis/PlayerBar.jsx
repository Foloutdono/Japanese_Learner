import { useSyncExternalStore } from 'react'
import { formatTimecode } from '../../lib/timecode'
import {
  FoldVideoIcon, FollowIcon, LoopIcon, PauseEachIcon, PauseIcon, PlayIcon, ReplayIcon,
  SkipIcon, SpeakerIcon, SpeakerOffIcon,
} from '../ui/Icons'

// ── 操作 — the desk's transport bar (plan 134) ────────────────────
// One row under the subtitle, as the owner drew it: the sentence before,
// play, the sentence after | the sentence again, on a loop, a stop at
// each sentence's end | one plain track scaled to the Passage's window
// (no step per sentence -- the owner's cut) and its clock | the speed,
// the sound, the line following the clock, and the video folded away.
// The keys stay live and are not printed (owner-directed).
//
// The track and its clock are the video's own, 0 to its length (`span`,
// VideoPlayer's onDurationChange), the figures YouTube's bar prints
// beside the picture (owner-directed, 2026-09-27). They were the
// Passage's window, the first cue to the last, and read 3:32 / 2:56 on
// a song the video's own bar had at 3:48 / 4:07. They read the
// playhead's poll themselves, so the poll renders this bar and not the
// screen around it.
//
// `stage` is the phone's (plan 219, the owner's pick D; it replaces plan
// 134's `compact` row under the picture): the transport alone, in the
// thumb dock at the screen's foot -- on a loop, the sentence before,
// play at the size of a thumb, the sentence after, the sentence again --
// the track laid along the picture's foot instead (PlayerTrack).
//
// State is the screen's (AnalyzerScreen): this draws it and reports
// presses, nothing more.
export function PlayerBar({
  stage = false, video = true, t, playing, onToggle, onPrev, onNext, canPrev, canNext, onReplay, canReplay,
  loop, onLoop, pauseEach, onPauseEach, playhead, span, onSeek,
  rate, onRate, silent, onMute, follow, onFollow, folded, onFold,
}) {
  const at = usePolled(playhead)
  const trackPct = span > 0 ? Math.max(0, Math.min(100, (100 * at) / span)) : 0
  const btn = (extra = '') => `anl-player__btn${extra}`
  const track = (
    <div className="anl-pbar__track" onClick={span > 0 ? onSeek : undefined} aria-hidden="true">
      <span className="anl-pbar__fill" style={{ width: `${trackPct}%` }} />
      <span className="anl-pbar__knob" style={{ left: `${trackPct}%` }} />
    </div>
  )
  if (stage && !video) {
    // A typed or photographed Passage: no clock, the stops alone.
    return (
      <div className="anl-pbar anl-pbar--stage">
        <button type="button" className={btn()} onClick={onPrev} disabled={!canPrev} aria-label={t.prevSentence}>
          <SkipIcon direction="prev" size={22} />
        </button>
        <button type="button" className={btn()} onClick={onNext} disabled={!canNext} aria-label={t.nextSentence}>
          <SkipIcon direction="next" size={22} />
        </button>
      </div>
    )
  }
  if (stage) {
    return (
      <div className="anl-pbar anl-pbar--stage">
        <button type="button" className={btn(loop ? ' anl-player__btn--on' : ' anl-player__btn--bare')} onClick={onLoop} aria-pressed={loop} aria-label={t.loopSentence}>
          <LoopIcon size={18} />
        </button>
        <button type="button" className={btn(' anl-player__btn--bare')} onClick={onPrev} disabled={!canPrev} aria-label={t.prevSentence}>
          <SkipIcon direction="prev" size={22} />
        </button>
        <button type="button" className={btn(' anl-player__btn--main')} onClick={onToggle} aria-label={playing ? t.pauseVideo : t.playVideo}>
          {playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>
        <button type="button" className={btn(' anl-player__btn--bare')} onClick={onNext} disabled={!canNext} aria-label={t.nextSentence}>
          <SkipIcon direction="next" size={22} />
        </button>
        <button type="button" className={btn(' anl-player__btn--bare')} onClick={onReplay} disabled={!canReplay} aria-label={t.replaySentence}>
          <ReplayIcon size={18} />
        </button>
      </div>
    )
  }
  return (
    <div className="anl-pbar">
      <button type="button" className={btn(' anl-player__btn--bare')} onClick={onPrev} disabled={!canPrev} aria-label={t.prevSentence}>
        <SkipIcon direction="prev" />
      </button>
      <button
        type="button"
        className={btn(' anl-player__btn--main')}
        onClick={onToggle}
        aria-label={playing ? t.pauseVideo : t.playVideo}
        aria-keyshortcuts="Space"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className={btn(' anl-player__btn--bare')} onClick={onNext} disabled={!canNext} aria-label={t.nextSentence}>
        <SkipIcon direction="next" />
      </button>
      <span className="anl-pbar__sep" aria-hidden="true" />
      <button type="button" className={btn()} onClick={onReplay} disabled={!canReplay} aria-label={t.replaySentence} title={t.replaySentence}>
        <ReplayIcon size={14} />
      </button>
      <button type="button" className={btn(loop ? ' anl-player__btn--on' : '')} onClick={onLoop} aria-pressed={loop} aria-label={t.loopSentence} title={t.loopSentence}>
        <LoopIcon size={14} />
      </button>
      <button type="button" className={btn(pauseEach ? ' anl-player__btn--on' : '')} onClick={onPauseEach} aria-pressed={pauseEach} aria-label={t.pauseEachSentence} title={t.pauseEachSentence}>
        <PauseEachIcon size={14} />
      </button>
      <span className="anl-pbar__sep" aria-hidden="true" />
      {/* A mouse convenience only, as on the phone: the route line is the
          accessible seek, stop by named stop. */}
      {track}
      {span > 0 && <span className="anl-player__time">{`${formatTimecode(Math.min(at, span))} / ${formatTimecode(span)}`}</span>}
      <span className="anl-pbar__sep" aria-hidden="true" />
      <button type="button" className="anl-pbar__rate" onClick={onRate} aria-label={t.playbackSpeed(rate)} title={t.playbackSpeed(rate)}>
        {t.playbackRate(rate)}
      </button>
      <button
        type="button"
        className={btn(' anl-player__btn--bare')}
        aria-pressed={silent}
        aria-label={silent ? t.unmuteVideo : t.muteVideo}
        title={silent ? t.unmuteVideo : t.muteVideo}
        onClick={onMute}
      >
        {silent ? <SpeakerOffIcon size={16} /> : <SpeakerIcon size={16} />}
      </button>
      <button type="button" className={btn(follow ? ' anl-player__btn--on' : '')} onClick={onFollow} aria-pressed={follow} aria-label={t.followPlayback} title={t.followPlayback}>
        <FollowIcon size={16} />
      </button>
      <button
        type="button"
        className={btn(' anl-player__btn--bare')}
        onClick={onFold}
        aria-expanded={!folded}
        aria-label={folded ? t.showVideo : t.hideVideo}
        title={folded ? t.showVideo : t.hideVideo}
      >
        <FoldVideoIcon size={16} />
      </button>
    </div>
  )
}

// The video's track alone, laid along the foot of the picture on a
// phone's stage (plan 219). A mouse and finger convenience, as on the
// bars: the stops are the accessible seek.
export function PlayerTrack({ playhead, span, onSeek }) {
  const at = usePolled(playhead)
  const pct = span > 0 ? Math.max(0, Math.min(100, (100 * at) / span)) : 0
  return (
    <div className="anl-pbar__track anl-ptrack" onClick={span > 0 ? onSeek : undefined} aria-hidden="true">
      <span className="anl-pbar__fill" style={{ width: `${pct}%` }} />
      <span className="anl-pbar__knob" style={{ left: `${pct}%` }} />
    </div>
  )
}

// The player's last poll (components/analysis/playhead), 0 with no player.
const NO_SUBSCRIBE = () => () => {}
function usePolled(playhead) {
  return useSyncExternalStore(playhead ? playhead.subscribe : NO_SUBSCRIBE, playhead ? playhead.polled : () => 0)
}
