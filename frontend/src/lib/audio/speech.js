import { getVolume, isMuted, trimFor } from './settings'

// ── Speech synthesis ──────────────────────────────────────
// The one sound the mixer can't touch: the browser speaks it through
// its own output, not through our AudioContext, so its level has to
// be multiplied out by hand at the moment it's spoken and it can't be
// faded. Hence its own tiny module rather than pretending it's part
// of the graph.

export function speakJapanese(text) {
  if (!text || isMuted()) return
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  // Master × category × trim, folded together — the buses that do
  // this for every other sound are downstream of an output this
  // never reaches.
  utterance.volume = getVolume('master') * getVolume('tts') * trimFor('tts', text)
  synth.speak(utterance)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}
