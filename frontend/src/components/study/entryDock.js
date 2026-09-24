import { createContext } from 'react'

// ── 机 — whether a run docks the revealed card's entry (plan 114) ──
// True inside a StudyStage that stands a side column beside the card on
// the desk (components/study/StudyStage.jsx's `side`). A reveal inside
// it docks its dictionary entry there (stores/deskEntry.js) instead of
// offering the 🔍 that opens it in a sheet. False everywhere else,
// which is every phone.
export const EntryDockContext = createContext(false)
