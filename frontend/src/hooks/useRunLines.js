import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { explainSentence } from '../lib/explainSentence'
import { useLang } from '../LangContext'
import { useDesk } from './useDesk'
import { composing } from '../lib/keyGuards'
import { dialogOpen } from '../lib/dialogOpen'
import { holdEsc } from '../stores/escHold'

// ── 机 — the run's lines (plan 129) ───────────────────────────────────
// A sentence run on the desk lists its sentences in its left column
// (components/study/RunLines.jsx), each with the grade it got, and any
// one of them reopens its breakdown in the right column: on a phone, and
// on the desk before this, a sentence was gone the moment Next was
// pressed. The owner's pick of three drawn candidates for the panel.
//
// A line is committed when the run moves on (`commit`, from the run's
// next()): it is rated by then -- Next only stands once the grade is in
// -- and its breakdown is whatever the run holds by then, explained or
// not. The sentence on the stage is not a line yet: the run draws it as
// the list's last row itself.
//
//   lines      committed, oldest first: { key, jp, translation, quality,
//              analysis }
//   opened     the line whose breakdown stands in the side, or null --
//              the side is then the run's own (sealed, or the breakdown
//              of the sentence on the stage)
//   open(key)  another line (or the same one, which closes it)
//   close()    back to the sentence on the stage
//   explain()  the opened line's explanation, bought as the run buys it
//
// An opened line whose breakdown never landed (the learner moved on
// first) is fetched then, the local tier only -- free, and cached by the
// server (routes/phrase.py). Esc closes it before it leaves the run --
// unless a door opened in it holds the key first (`held`: the run's
// lookup, which SideLookup closes on the same Esc). The phone reads
// nothing here: nothing opens a line there, and the list is the desk's.
const KEEP = 60

export function useRunLines(session, { held = false } = {}) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const [lines, setLines] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)
  const asked = useRef(new Set())

  const patch = useCallback((key, fields) => {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...fields } : l)))
  }, [])

  const commit = useCallback(line => {
    if (!line || line.key == null) return
    setLines(ls => [...ls.filter(l => l.key !== line.key), line].slice(-KEEP))
    setOpenKey(null)
  }, [])

  const open = useCallback(key => {
    setOpenKey(k => (k === key ? null : key))
    setExplaining(false)
    setExplainError(null)
  }, [])

  const close = useCallback(() => setOpenKey(null), [])

  const reset = useCallback(() => {
    setLines([])
    setOpenKey(null)
    asked.current = new Set()
  }, [])

  const opened = lines.find(l => l.key === openKey) ?? null

  // The breakdown the run never had, for a line opened now.
  useEffect(() => {
    if (!opened || opened.analysis || asked.current.has(opened.key)) return
    const { key, jp } = opened
    asked.current.add(key)
    patch(key, { loading: true })
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: jp, save: false, deep: false, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => patch(key, { analysis: d, loading: false }))
      .catch(() => patch(key, { loading: false }))
  }, [opened, patch, session, lang])

  const explain = useCallback(() => {
    if (!opened || explaining) return
    const { key, jp } = opened
    setExplaining(true)
    setExplainError(null)
    explainSentence(session, jp, lang)
      .then(d => patch(key, { analysis: d }))
      .catch(e => setExplainError(e?.message === '503' ? t.explainUnavailable : t.explainFailed))
      .finally(() => setExplaining(false))
  }, [opened, explaining, session, lang, patch, t])

  // Esc steps back to the sentence on the stage (plan 123's rule: the
  // innermost thing that holds the key spends it).
  const isOpen = Boolean(opened)
  useEffect(() => (desk && isOpen && !held ? holdEsc() : undefined), [desk, isOpen, held])
  useEffect(() => {
    if (!desk || !isOpen || held) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || composing(e) || dialogOpen()) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      e.preventDefault()
      setOpenKey(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, isOpen, held])

  return { lines, opened, open, close, commit, reset, explain, explaining, explainError }
}
