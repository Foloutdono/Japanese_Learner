import { createContext } from 'react'

// ── 試乗 — who is told when a card's 🔍 opens its entry (plan 132) ──
// The first ride on a phone makes the learner open the dictionary from
// the revealed card before they grade it: the entry is a door every
// card carries, and a door nobody is shown is a door nobody finds. The
// ride has to know when the sheet opens and closes, and the 🔍 is deep
// inside CardPrompt's many faces (components/study/QuizComponents.jsx's
// RevealActionsPanel), so it is told through this context rather than a
// prop threaded through all of them: `(open) => void`, called true when
// the sheet opens and false when it closes. Null everywhere but the
// ride, where nothing listens.
export const LookupWatchContext = createContext(null)
