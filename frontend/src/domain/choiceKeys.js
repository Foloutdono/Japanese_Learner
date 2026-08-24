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
