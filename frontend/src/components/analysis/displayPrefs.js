// ── 表示 — what the phone's stage prints around its line (plan 263) ──
// The Affichage sheet's three settings: the readings over the words
// (the desk's furigana dial: all, the ones the SRS says the learner
// still needs, none), the rōmaji under them, and the line's
// translation. A convenience of this browser, not of the account: kept
// where the grab's flag is (localStorage), and a private window that
// refuses it is shown the defaults -- readings where needed, no rōmaji,
// the translation.

const KEY = 'tsuji.anlDisplay'
export const FURIGANA = ['all', 'unknown', 'none']
export const DEFAULT_DISPLAY = { furigana: 'unknown', romaji: false, translation: true }

export function readDisplay() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    if (!saved || typeof saved !== 'object') return DEFAULT_DISPLAY
    return {
      furigana: FURIGANA.includes(saved.furigana) ? saved.furigana : DEFAULT_DISPLAY.furigana,
      romaji: typeof saved.romaji === 'boolean' ? saved.romaji : DEFAULT_DISPLAY.romaji,
      translation: typeof saved.translation === 'boolean' ? saved.translation : DEFAULT_DISPLAY.translation,
    }
  } catch {
    return DEFAULT_DISPLAY
  }
}

export function saveDisplay(display) {
  try { window.localStorage.setItem(KEY, JSON.stringify(display)) } catch { /* private mode: this visit keeps it */ }
}
