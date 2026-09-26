import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'

// ── 見本 — what each stop of a line holds (plan 136) ────────────────
// /api/station/{source}/samples: per stop, the first things it teaches
// (printed under the stop's name in the desk's station split) and one
// card (the platforms' specimens draw from it). Static content, the
// same for every learner, so it is asked once per line and language
// for the life of the page, and kept.
//
// Read on the desk only: a phone never passes `enabled`, so it never
// asks. The answer is keyed on the path, so a change of language asks
// again rather than showing the other language's glosses.
const answers = new Map()
const asked = new Set()
const listeners = new Set()

function ask(path) {
  if (asked.has(path)) return
  asked.add(path)
  supabase.auth.getSession()
    .then(({ data }) => (data?.session ? apiFetch(path, data.session) : Promise.reject()))
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(body => {
      answers.set(path, body?.stops ?? {})
      listeners.forEach(fn => fn())
    })
    // Quiet: the samples dress a screen that works without them. The
    // next mount asks again.
    .catch(() => { asked.delete(path) })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** {stopKey: {sample: [...], card: {...}}} for a line, or null while it
 *  is on its way (or when `enabled` is false). */
export function useStationSamples(source, enabled = true) {
  const { lang } = useLang()
  const path = `/api/station/${source}/samples?lang=${encodeURIComponent(lang)}`
  useEffect(() => { if (enabled) ask(path) }, [enabled, path])
  const stops = useSyncExternalStore(subscribe, () => answers.get(path) ?? null)
  return enabled ? stops : null
}
