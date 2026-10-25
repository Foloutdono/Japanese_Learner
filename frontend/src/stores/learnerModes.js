import { createRemoteStore } from './remote'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { refreshToday } from './today'
import { refreshSummary } from './profileSummary'

// ── 主 — the mode each line is ridden in, and the modes added (plan 273) ──
// GET /api/profile/modes: { main: {line: mode}, extra: {line: [mode]},
// choices: { main: {line: [mode]}, extra: {line: [mode]} } }, every
// line answered (backend study/main_modes.py). Asked only where it is
// drawn -- Réglages › Modes principaux and Today's services, opened --
// never at boot (CLAUDE.md, "the boot asks for the screen first").
// A change writes through PATCH /api/profile/learning and asks Today
// again: the lanes and the ration move with the modes.
const store = createRemoteStore('/api/profile/modes', { ttlMs: 5 * 60_000 })

/** { data, failed } -- data null until the first answer. */
export function useLearnerModes() {
  return store.use()
}

/** The lines whose modes are chosen, in the gate's order. */
export const MODE_LINES = ['kana', 'vocab', 'kanji']

// One save at a time, in the order pressed, so two quick taps cannot
// land as the first.
let saving = Promise.resolve()

function save(patch, session, setting) {
  track('setting_change', { setting, value: 'changed' })   // plan 218
  const saved = saving.then(() => apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }))
  saving = saved.catch(() => {})
  return saved.then(res => {
    const now = store.peek()
    if (res?.modes && now) store.seed({ ...now, ...res.modes })
    else store.refresh()
    refreshToday()
    refreshSummary()
    return res
  })
}

/** Ride `line` in `mode` from now on: carrying what the old mode
 *  mastered across (`carry`, the default) or starting from zero.
 *  Resolves to the server's answer, whose `mainSwitch` says what was
 *  marked known in the new mode. */
export function setMainMode(line, mode, session, carry = true) {
  return save({ mainModes: { [line]: mode }, carryKnown: carry }, session, 'main_mode')
}

/** The modes added to `line` in Today, the whole list for that line. */
export function setExtraModes(line, modes, session) {
  return save({ extraModes: { [line]: modes } }, session, 'today_mode')
}

/** The learner these modes belong to has signed out (stores/account). */
export function forgetModes() {
  store.forget()
}
