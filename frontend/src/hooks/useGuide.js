import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { supabase } from '../lib/supabase'
import { refreshSummary, useProfileSummary } from '../stores/profileSummary'
import { holdGuide, markShown, useGuideHeld, wasShown } from '../stores/guide'
import { GUIDE_CHAIN } from '../components/guide/guides'
import { TAB_IDS } from '../config/tabs'

// ── 案内 — when a gate's guide opens (plan 100) ────────────────────
// Once per gate, the first time it is opened with its blocks painted:
// the profile's `guided` map says which gates have had theirs, the
// screen says when it is `ready` (its async data has landed -- /today
// after the lanes, /learn after the plates), and the 改札 cutscene
// holds every guide until it lifts (stores/guide).
//
// Ending posts the stamp (POST /api/onboarding/guided/{gate}) and asks
// the profile store to catch up; a stamp that could not land is noted
// in localStorage for this device, keyed by user id in exactly
// stores/onboarded.js's shape -- a mirror so a bad network cannot make
// the guide nag on every launch, never an authority. A profile the
// store has not answered yet opens nothing: a lesson is never shown at
// the cost of a door, and never twice for want of an answer.
const KEY = 'jp-guided'
const KEEP = 8

function noted(userId) {
  try {
    const raw = window.localStorage.getItem(KEY)
    const map = raw ? JSON.parse(raw) : {}
    return new Set(Array.isArray(map[userId]) ? map[userId] : [])
  } catch {
    return new Set()
  }
}

function note(userId, gate) {
  if (!userId) return
  try {
    const raw = window.localStorage.getItem(KEY)
    const map = raw ? JSON.parse(raw) : {}
    const gates = Array.from(new Set([...(map[userId] ?? []), gate]))
    const next = { [userId]: gates, ...Object.fromEntries(Object.entries(map).filter(([k]) => k !== userId).slice(0, KEEP - 1)) }
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* not persisted */ }
}

/** Forget every note on this device: Settings' "show the guide again". */
export function forgetGuidedHere() {
  try { window.localStorage.removeItem(KEY) } catch { /* not persisted */ }
}

export function useGuide(gate, ready = true) {
  const summary = useProfileSummary()
  const held = useGuideHeld()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    let live = true
    supabase.auth.getSession().then(({ data }) => { if (live) setUserId(data?.session?.user?.id ?? null) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    // The profile must have ANSWERED: a summary without a `guided` map
    // (a fixture, a store seeded by hand, an older server) is not a
    // learner who has seen nothing, and a lesson is never shown on a
    // guess.
    if (open || held || !ready || !summary?.guided || !TAB_IDS.includes(gate)) return
    if (wasShown(gate) || summary.guided[gate]) return
    if (userId && noted(userId).has(gate)) return
    markShown(gate)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the decision reads four sources that all arrive asynchronously; there is no render-time value to derive it from.
    setOpen(true)
  }, [open, held, ready, summary, gate, userId])

  function onEnd(skipped) {
    setOpen(false)
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session
      if (!session) return
      return apiJson(`/api/onboarding/guided/${gate}`, session, { method: 'POST' })
        .then(() => refreshSummary())
        .catch(() => note(session.user?.id ?? null, gate))
    }).catch(() => {})
    if (GUIDE_CHAIN && !skipped) {
      const i = TAB_IDS.indexOf(gate)
      const nextGate = TAB_IDS[i + 1]
      if (nextGate) navigate(`/${nextGate}`)
    }
  }

  return { open, onEnd }
}

export { holdGuide }
