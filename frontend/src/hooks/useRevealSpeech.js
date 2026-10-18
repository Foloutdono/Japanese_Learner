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
//
// `card` names the card in hand, for a run that resets its reveal in an
// effect (GrammarRun, TodayRun): the next card is drawn one render
// before that reset lands, still under the last card's reveal, and its
// sentence said then -- Choisir's with the hole filled, Écrire's model
// -- would be its answer, given before it is asked. A reveal counts
// only for the card last seen with its answer hidden.
export function useRevealSpeech(text, revealed, card = null) {
  const said = useRef(null)
  const hidden = useRef(card)
  useEffect(() => {
    if (!revealed) {
      said.current = null
      hidden.current = card
      return
    }
    if (hidden.current !== card || !text || said.current === text) return
    said.current = text
    if (isSpeakOnReveal()) speakSentence(text)
  }, [text, revealed, card])
}
