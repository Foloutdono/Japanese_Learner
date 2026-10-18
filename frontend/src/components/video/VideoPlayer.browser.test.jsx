import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { render } from 'vitest-browser-react'

// ── One fake IFrame player, driven by hand ────────────────
// `new YT.Player` hands back this object and keeps the events it was
// given, so a test can say "ready" and then let the component's own
// 250ms poll run against a player whose volume it can move behind the
// component's back -- which is exactly what the learner does when they
// reach past our transport bar for YouTube's own slider.
const fake = { player: null, events: null }

vi.mock('../../lib/youtubePlayer', () => ({
  loadYouTubeIframeAPI: async () => ({
    Player: function Player(_el, opts) {
      fake.events = opts.events
      return fake.player
    },
  }),
}))

const { VideoPlayer } = await import('./VideoPlayer')

function makePlayer() {
  const live = { volume: 100, muted: false, time: 0, duration: 0, state: -1 }
  return {
    live,
    setVolume: vi.fn(v => { live.volume = v }),
    getVolume: () => live.volume,
    mute: vi.fn(() => { live.muted = true }),
    unMute: vi.fn(() => { live.muted = false }),
    isMuted: () => live.muted,
    getCurrentTime: () => live.time,
    getDuration: () => live.duration,
    getPlayerState: () => live.state,
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    destroy: vi.fn(),
  }
}

// The component polls every 250ms; a "tick" waits out one of them with
// room to spare.
const tick = async (ms = 320) => new Promise(r => setTimeout(r, ms))

async function mount(props) {
  const screen = await render(<VideoPlayer videoId="dQw4w9WgXcQ" onTimeUpdate={() => {}} {...props} />)
  // The API loader is a promise: the player does not exist until it
  // resolves, and onReady is YouTube's to call.
  await tick(30)
  fake.events.onReady()
  return screen
}

beforeEach(() => {
  fake.player = makePlayer()
  fake.events = null
})

describe('VideoPlayer sound', () => {
  it('applies the learner’s saved sound as soon as the player is ready', async () => {
    await mount({ volume: 40, muted: false })
    expect(fake.player.setVolume).toHaveBeenCalledWith(40)
    expect(fake.player.unMute).toHaveBeenCalled()
  })

  // setVolume does NOT lift a mute, so a muted player moved to 80 would
  // otherwise be a silent player reading 80.
  it('mutes and unmutes as the prop changes, carrying the level with it', async () => {
    const screen = await mount({ volume: 40, muted: false })

    await screen.rerender(
      <VideoPlayer videoId="dQw4w9WgXcQ" volume={40} muted onTimeUpdate={() => {}} />
    )
    expect(fake.player.mute).toHaveBeenCalled()

    fake.player.setVolume.mockClear()
    await screen.rerender(
      <VideoPlayer videoId="dQw4w9WgXcQ" volume={70} muted={false} onTimeUpdate={() => {}} />
    )
    expect(fake.player.setVolume).toHaveBeenCalledWith(70)
    expect(fake.player.unMute).toHaveBeenCalled()
  })

  // The iframe's own slider sits under the video; a bar that ignored it
  // would print a number nothing obeys.
  it('reports a change the learner made in the iframe itself', async () => {
    const onVolumeChange = vi.fn()
    await mount({ volume: 100, muted: false, onVolumeChange })
    // One poll to record where the player is...
    await tick()
    // ...then the learner drags YouTube's own slider.
    fake.player.live.volume = 15
    await tick()
    expect(onVolumeChange).toHaveBeenCalledWith({ volume: 15, muted: false })
  })

  // The other half of that bargain: a poll landing between our own
  // setVolume and YouTube applying it must not report the stale reading
  // back up, or the dial snaps back under the learner's finger.
  it('does not report our own writes back as the learner’s', async () => {
    const onVolumeChange = vi.fn()
    const screen = await mount({ volume: 100, muted: false, onVolumeChange })
    await tick()
    await screen.rerender(
      <VideoPlayer videoId="dQw4w9WgXcQ" volume={30} muted={false} onTimeUpdate={() => {}} onVolumeChange={onVolumeChange} />
    )
    await tick()
    await tick()
    expect(onVolumeChange).not.toHaveBeenCalled()
  })

  // ── The stale-callback fix ──
  // The poll is installed once, on the render that built the player. A
  // callback captured THERE is frozen for the player's whole life --
  // and onTimeUpdate is rebuilt every time 追従 flips, so the toggle
  // never reached the poll: the line kept following the clock after the
  // learner had taken the wheel.
  it('polls the current onTimeUpdate, not the one the player was built with', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const screen = await mount({ volume: 100, muted: false, onTimeUpdate: first })
    await tick()
    expect(first).toHaveBeenCalled()

    await screen.rerender(
      <VideoPlayer videoId="dQw4w9WgXcQ" volume={100} muted={false} onTimeUpdate={second} />
    )
    first.mockClear()
    fake.player.live.time = 12
    await tick()

    expect(second).toHaveBeenCalledWith(12)
    expect(first).not.toHaveBeenCalled()
  })
})

// ── 再生 — playing, and a stall on a poor connection ──
// YouTube's states: 1 playing, 3 buffering, 2 paused. A stall to load
// more is the video still playing as far as the learner is concerned --
// the transport offers Pause, not Play -- but its clock is not moving.
describe('VideoPlayer playing', () => {
  it('counts a stall to load more as playing, its clock stopped', async () => {
    const onPlayingChange = vi.fn()
    await mount({ onPlayingChange })
    fake.events.onStateChange({ data: 1 })
    expect(onPlayingChange).toHaveBeenLastCalledWith(true, true)
    fake.events.onStateChange({ data: 3 })
    expect(onPlayingChange).toHaveBeenLastCalledWith(true, false)
    fake.events.onStateChange({ data: 2 })
    expect(onPlayingChange).toHaveBeenLastCalledWith(false, false)
  })

  // The poll reads the state too: a change no event told of (an iframe
  // that reloaded itself, a message never delivered) is caught within a
  // poll, and one already told is not told twice.
  it('reads the state back on the poll', async () => {
    const onPlayingChange = vi.fn()
    await mount({ onPlayingChange })
    await tick()
    fake.player.live.state = 1
    await tick()
    expect(onPlayingChange).toHaveBeenCalledTimes(1)
    expect(onPlayingChange).toHaveBeenLastCalledWith(true, true)
    fake.events.onStateChange({ data: 1 })
    await tick()
    expect(onPlayingChange).toHaveBeenCalledTimes(1)
  })

  // On a slow connection the frame takes a while to be ready, and the
  // learner presses on meanwhile: nothing is asked of a player that
  // cannot answer yet, and a seek not sent says so.
  it('asks nothing of a player that is not ready yet', async () => {
    fake.player = {}
    const ref = createRef()
    await render(<VideoPlayer ref={ref} videoId="dQw4w9WgXcQ" onTimeUpdate={() => {}} />)
    await tick(30)
    expect(ref.current.seekTo(12)).toBe(false)
    expect(() => { ref.current.play(); ref.current.pause() }).not.toThrow()
    expect(ref.current.currentTime()).toBeNull()
  })
})

describe('VideoPlayer length', () => {
  // The analyser's bar runs from 0 to the video's length, so its clock
  // prints what YouTube's own bar does. The player knows it only once
  // it has the video's metadata: nothing is told before that, and each
  // whole second of it is told once.
  it('reports the video’s length once the player knows it', async () => {
    const onDurationChange = vi.fn()
    await mount({ onDurationChange })
    await tick()
    expect(onDurationChange).not.toHaveBeenCalled()
    fake.player.live.duration = 247.35
    await tick()
    await tick()
    expect(onDurationChange).toHaveBeenCalledTimes(1)
    expect(onDurationChange).toHaveBeenCalledWith(247)
  })
})
