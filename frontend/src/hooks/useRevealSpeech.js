import { useEffect, useRef } from 'react'
import { isSpeakOnReveal, speakSentence } from '../lib/audio'

// ── The sentence, said once it is revealed ──────────────────────
// A grammar, reading or translation card says its sentence the moment
// its answer is out, as a kana or vocab card says its word, unless the
// speak-on-reveal switch is off (components/study/SpeakToggle.jsx).
//
// Once per reveal: the sentence is said when `revealed` turns true, or
// when the sentence arrives after it (Construire's comes back with the
// verdict), and not again on a re-render. Hiding the answer again (the
// next card) lets the next reveal speak, even of the same sentence.
export function useRevealSpeech(text, revealed) {
  const said = useRef(null)
  useEffect(() => {
    if (!revealed) {
      said.current = null
      return
    }
    if (!text || said.current === text) return
    said.current = text
    if (isSpeakOnReveal()) speakSentence(text)
  }, [text, revealed])
}
