import { speakJapanese } from '../../lib/audio'
import { useJapaneseVoice } from '../../hooks/useJapaneseVoice'

// ── 音声 — hear it ────────────────────────────────────────
// docs/adr/0006 decided the analyser would pronounce a Sentence or a
// Token on demand, through the browser's own SpeechSynthesis rather
// than a backend TTS endpoint (disk, latency, and an unbounded proxy
// to a consumer service were the three reasons). It was never built.
// This is it.
//
// It renders NOTHING when the browser has no Japanese voice, which the
// ADR requires: "The control must detect voice availability and hide or
// disable itself rather than failing silently." Hidden, not disabled --
// a permanently greyed control on a platform that will never have a
// voice is a promise the app cannot keep.
//
// It does not track "speaking" state. SpeechSynthesis cancels the
// previous utterance on every call (see lib/audio/speech.js), so
// pressing twice restarts rather than overlapping, and a spinner on a
// two-second utterance is noise.

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" />
      <path d="M16 8a5 5 0 0 1 0 8" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

export function SpeakButton({ text, label, size = 'md', t }) {
  const hasVoice = useJapaneseVoice()
  if (!text || !hasVoice) return null

  return (
    <button
      type="button"
      className={`anl-speak anl-speak--${size}`}
      aria-label={label ?? t.hearThis}
      onClick={e => {
        e.stopPropagation()
        speakJapanese(text)
      }}
    >
      <SpeakerIcon />
    </button>
  )
}
