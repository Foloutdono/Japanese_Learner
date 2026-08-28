import { useSyncExternalStore } from 'react'

// ── Is there a voice that can read this? ──────────────────
// docs/adr/0006 chose the browser's own SpeechSynthesis for study
// audio, and named the price: "some Linux browsers ship no Japanese
// voice at all. The control must detect voice availability and hide or
// disable itself rather than failing silently."
//
// getVoices() is the trap. Chrome returns [] on the first call and
// populates asynchronously, firing `voiceschanged` -- so a hook that
// reads it once at mount reports "no voice" on every fresh page load
// and the control never appears. Subscribing to that event is the
// whole reason this is a hook rather than a constant.
//
// useSyncExternalStore, matching hooks/useMediaQuery.js: the first
// render already has an answer instead of rendering wrong and
// correcting itself.

function hasJapaneseVoice(synth) {
  return synth.getVoices().some(v => v.lang?.toLowerCase().startsWith('ja'))
}

export function useJapaneseVoice() {
  return useSyncExternalStore(
    callback => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return () => {}
      const synth = window.speechSynthesis
      synth.addEventListener('voiceschanged', callback)
      return () => synth.removeEventListener('voiceschanged', callback)
    },
    () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return false
      // The snapshot must be a stable boolean, never the voices array
      // itself, or useSyncExternalStore treats every render as a fresh
      // value and loops.
      return hasJapaneseVoice(window.speechSynthesis)
    },
    // Server snapshot: no window, so no voice. This app never
    // server-renders, but getServerSnapshot is required.
    () => false,
  )
}
