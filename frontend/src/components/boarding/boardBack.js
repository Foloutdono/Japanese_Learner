import { createContext } from 'react'

// ── 机 — the way back on the floor (plan 140) ────────────────────
// On the desk the boarding draws no head: its track became the line of
// stops down the column (screens/BoardingFlow's DeskLine), and ‹ came
// down to the floor to stand beside Continue, the two ways off a
// question side by side. The boarding provides the step's way back
// here -- the previous question, or out of the flow from the first --
// and every Continue that prints Enter draws it (BoardFrame), so no
// step file needs to know. Nothing else provides one: the Welcome's
// Board and a ride's ends stay as they are, and so does the phone.
export const BoardBack = createContext(null)
