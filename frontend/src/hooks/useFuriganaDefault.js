import { useEffect, useRef } from 'react'
import { useCardContents } from '../stores/cardContents'
import { fieldsFor } from '../domain/cardContents'

// ── 札の中身 — furigana on the question (plan 326) ──
/** Furigana chosen for the question (Réglages › Card contents) switches
 *  the run's furigana hint on where the card can show it: the hint's own
 *  pill then stands lit, and the learner can still put it away. Once a
 *  run where the run keeps its hints (`perCard` false), once a card
 *  where it clears them for each card (Today). */
export function useFuriganaDefault(card, setActiveHints, { perCard = false } = {}) {
  const { data: chosen } = useCardContents()
  const wanted = fieldsFor(card, chosen, 'question').includes('furigana')
  const key = perCard ? `${card?.card_id}:${card?.mode}` : 'run'
  const applied = useRef(null)
  useEffect(() => {
    if (!wanted || applied.current === key) return
    applied.current = key
    setActiveHints(prev => {
      if (prev instanceof Set) return prev.has('indice_3') ? prev : new Set([...prev, 'indice_3'])
      return prev.includes('indice_3') ? prev : [...prev, 'indice_3']
    })
  }, [wanted, key, setActiveHints])
}
