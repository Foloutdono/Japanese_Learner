import { useMuted, toggleMute, playKana, playSfx, playXpGain, playLevelUp, speakJapanese } from '../sound'

// ── sound.js — playback debug panel ────────────────────────
// playKana/playSfx/playXpGain/playLevelUp all fail silently
// (.catch(() => {})) when their file is missing, so a click here that
// makes no sound almost always means one of two things: mute is on,
// or /public/sounds/... doesn't have that file yet — check the
// Network tab, not this file, to tell those apart. speakJapanese is
// the one exception: it uses the browser's own SpeechSynthesis, so it
// should work audibly with zero setup.
function Panel() {
  const muted = useMuted()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', fontSize: 13, alignItems: 'flex-start' }}>
      <div>muted: {String(muted)}</div>
      <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
      <button onClick={() => playKana('a')}>playKana('a')</button>
      <button onClick={() => playSfx('xp-gain')}>playSfx('xp-gain')</button>
      <button onClick={playXpGain}>playXpGain()</button>
      <button onClick={playLevelUp}>playLevelUp()</button>
      <button onClick={() => speakJapanese('こんにちは')}>speakJapanese('こんにちは')</button>
    </div>
  )
}

export default {
  title: 'Data/sound',
}

export const Playground = { render: () => <Panel /> }