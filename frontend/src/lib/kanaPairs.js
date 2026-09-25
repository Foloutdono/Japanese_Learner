// ── 対照 — both scripts in the kana charts (plan 129) ─────────────
// On the desk the dictionary's kana charts can print each kana's twin
// in the other script under it (あ over ア), a toggle beside the
// collections. The choice survives the visit: localStorage, the way the
// theme and the video's sound keep theirs. Storage can be unavailable
// (private mode, some policies); the toggle then holds for the visit.
const KEY = 'jp-kana-pairs'

export function readKanaPairs() {
  try { return window.localStorage.getItem(KEY) === '1' } catch { return false }
}

export function saveKanaPairs(on) {
  try { window.localStorage.setItem(KEY, on ? '1' : '0') } catch { /* not persisted */ }
}
