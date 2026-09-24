// ── Digit-row shortcuts for a four-choice question ───────────
// Shared by the study quiz (components/study/QuizComponents.jsx) and
// the mock exam (screens/ExamRunner.jsx) — the two places in the app
// where somebody answers multiple-choice questions in a run and should
// not have to reach for the mouse on every one.
//
// On an AZERTY keyboard the unshifted number row types &é"' rather
// than 1234, so both sets map to the same indices: whichever layout
// someone is on, the physical top-row keys 1-4 answer choices 1-4.
//
// Lives in domain/ rather than being exported from QuizComponents
// because a file that exports components may only export components —
// a shared constant alongside them breaks React Fast Refresh for the
// whole module (react-refresh/only-export-components).
export const CHOICE_KEY_INDEX = { '1': 0, '2': 1, '3': 2, '4': 3, '&': 0, 'é': 1, '"': 2, "'": 3 }

// A comprehension question's options are lettered A–D (the canvas,
// screens/ComprehensionRun.jsx), so its letters answer as well as its
// digits. `e.key` is the character typed, so an AZERTY keyboard's A key
// sends 'a' like any other; compare lower-cased.
export const LETTER_KEY_INDEX = { a: 0, b: 1, c: 2, d: 3 }

// The boarding's picks on the desk (plan 122), as the digit each stands
// for: 0-6 on the number row, and the same physical keys unshifted on a
// French AZERTY row (à & é " ' ( -) and a Belgian one (§ for 6). A
// question names its picks by these digits (aria-keyshortcuts), so the
// level list can name each level by its own number -- N5 on 5, N1 on 1,
// the novice on 0 -- where a position would put N2 on the 5 key of a
// list that prints N5.
export const PICK_KEY_DIGIT = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  'à': '0', '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', '-': '6', '§': '6',
}
