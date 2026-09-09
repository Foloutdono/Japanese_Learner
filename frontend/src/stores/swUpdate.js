import { useSyncExternalStore } from 'react'

// ── ダイヤ改正 — a new build has arrived ─────────────────────
// The new worker installs and takes over on its own (pwa.workbox.js);
// what is left to choose is the reload that puts this page on the build
// that worker is now serving. main.jsx offers that as a function, and
// this store carries the one fact — "there is one" — to whoever draws
// the notice. Nothing reloads on its own: a mid-exam reload would race
// the exam draft, and a learner in a run should be the one to decide
// when the timetable changes.
let offer = null            // () => void, activates the waiting worker
const listeners = new Set()

function emit() { listeners.forEach(fn => fn()) }

export const swUpdate = {
  offer(apply) {
    offer = apply
    emit()
  },
  dismiss() {
    offer = null
    emit()
  },
  apply() {
    const fn = offer
    offer = null
    emit()
    fn?.()
  },
}

export function useSwUpdate() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => offer !== null,
    () => false,
  )
}
