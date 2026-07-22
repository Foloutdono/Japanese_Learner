import { useMuted, toggleMute, playKana, playXpGain, playLevelUp, speakJapanese } from '../sound'

// playKana/playXpGain/playLevelUp fail silently when their sound file
// is missing — a click that makes no sound means mute is on, or the
// file isn't in /public/sounds/ yet (check the Network tab).
// speakJapanese uses the browser's SpeechSynthesis and needs no setup.
function Panel() {
  const muted = useMuted()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', fontSize: 13, alignItems: 'flex-start' }}>
      <div>muted: {String(muted)}</div>
      <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
      <button onClick={() => playKana('mizu')}>playKana('mizu') — kana review answer</button>
      <button onClick={playXpGain}>playXpGain() — on review recorded</button>
      <button onClick={playLevelUp}>playLevelUp() — on level up</button>
      <button onClick={() => speakJapanese('みず')}>speakJapanese('みず') — kanji/vocab reveal</button>
    </div>
  )
}

export default {
  title: 'Data/sound',
}

export const Playground = { render: () => <Panel /> }