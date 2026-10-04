import { createContext } from 'react'

// ── 机 — whether a run stands on three panels (plan 126) ──
// True inside a StudyStage laid out on the desk's three panels: a card
// run on the desk with a side column and `records` (components/study/
// StudyStage.jsx's `panels`). The elements that print a key cap on the
// desk read it and print none there -- the run's card panel lists the
// keys instead (components/study/CardPanel.jsx): the head's Esc, the
// hint switch's C, the rating tiles' digits. (The flashcard's "Espace
// pour révéler" stays on the card: the owner asked for it back.) The
// rating bar also reads it to stand its tiles unlit before the reveal
// rather than unseen. False everywhere else, which is
// every phone, every run without a side, and the runs that pass no
// records (a browse, a practice run, a ride).
export const RunPanelsContext = createContext(false)

// ── 上下 — whether a run wears the console on a phone (plan 174) ──
// True inside a StudyStage below the desk that keeps a tally: the run's
// meter under the head and the level on the floor
// (components/study/RunConsole.jsx, the owner's pick "console C
// refined"). The run's own hairline (QuizComponents' DeckProgress,
// Today's) reads it and draws nothing there: the meter is the run's
// progress, and two bars under one head said it twice.
export const RunConsoleContext = createContext(false)
