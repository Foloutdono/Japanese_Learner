import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'

// ── 194 — Construire's answer, held by the run ──────────────────
// The card's hole shows what is typed as it is typed, and the entry that
// takes it stands under the card, as the practice runs' does
// (GrammarPlate's BuildEntry, in the stage's foot): two places, one
// answer, so the run holds it and hands it to both.

/** What is typed in each hole and the server's verdict on it; null for a
 *  card that is not a Construire. Started afresh for each card, each
 *  sentence and each `resetKey`. */
export function useBuild(card, { session, lang, onDone, resetKey } = {}) {
  const build = card?.build
  const key = build ? `${card.card_id}:${build.key}:${resetKey ?? ''}` : null
  const fresh = () => ({ key, values: (build?.pieces ?? []).filter(p => p.gap != null).map(() => ''), verdict: null, focus: 0, pending: false })
  const [state, setState] = useState(fresh)
  const live = useRef(key)
  useEffect(() => { live.current = key })
  if (state.key !== key) setState(fresh())
  if (!build) return null
  const st = state.key === key ? state : fresh()
  const gaps = build.pieces.filter(p => p.gap != null)
  const empty = st.values.every(v => !v.trim())
  function check(e) {
    e?.preventDefault?.()
    if (st.pending || st.verdict || empty) return
    playClick()
    setState(s => ({ ...s, pending: true }))
    const settle = v => {
      if (live.current !== key) return
      setState(s => ({ ...s, pending: false, verdict: v }))
      onDone?.()
    }
    apiJson(`/api/grammar/build/check?lang=${lang ?? 'fr'}`, session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.raw_id ?? card.card_id, key: build.key, answers: st.values }),
    })
      .then(settle)
      .catch(() => settle({ verdict: null, gaps: [] }))
  }
  return {
    key,
    gaps,
    values: st.values,
    focus: st.focus,
    verdict: st.verdict,
    pending: st.pending,
    empty,
    setValue: (n, v) => setState(s => ({ ...s, values: s.values.map((x, j) => (j === n ? v : x)) })),
    setFocus: n => setState(s => (s.focus === n ? s : { ...s, focus: n })),
    check,
  }
}
