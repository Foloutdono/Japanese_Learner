import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'

// ── 見本 — what each stop of a line holds (plan 137) ────────────────
// /api/station/{source}/samples: per stop, the first things it teaches
// (printed under the stop's name in the desk's station split) and one
// card (the platforms' specimens draw from it). Static content, the
// same for every learner, so it is asked once per line and language
// for the life of the page, and kept.
//
// Read on the desk, and on a phone by the Practice gate's sheet alone
// (plan 290: the page in view and its neighbours, `enabled` while they
// are), never by the gate under it. The answer is keyed on the path, so
// a change of language asks again rather than showing the other
// language's glosses.
const answers = new Map()
const asked = new Set()
const listeners = new Set()
const samplesPath = (source, lang) => `/api/station/${source}/samples?lang=${encodeURIComponent(lang)}`

function ask(path) {
  if (asked.has(path)) return Promise.resolve()
  asked.add(path)
  return supabase.auth.getSession()
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

/** A line's samples asked ahead of the desk's Practice gate (lib/warm.js). */
export function warmStationSamples(source, lang) {
  return ask(samplesPath(source, lang))
}

function subscribe(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** {stopKey: {sample: [...], card: {...}}} for a line, or null while it
 *  is on its way (or when `enabled` is false). */
export function useStationSamples(source, enabled = true) {
  const { lang } = useLang()
  const path = samplesPath(source, lang)
  useEffect(() => { if (enabled) ask(path) }, [enabled, path])
  const stops = useSyncExternalStore(subscribe, () => answers.get(path) ?? null)
  return enabled ? stops : null
}
