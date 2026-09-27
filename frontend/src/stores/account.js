import { clearAhead } from '../lib/platform'
import { forgetAheadPlan } from './ahead'
import { forgetCredits } from './credits'
import { forgetForecast } from './forecast'
import { forgetShown } from './guide'
import { forgetJourney } from './journey'
import { forgetPracticeRecord } from './practiceRecord'
import { forgetSummary } from './profileSummary'
import { forgetStats } from './stats'
import { forgetToday } from './today'

// ── 改札を出る — what the leaving learner takes with them ─────────
// Signing out does NOT reload the page. Welcome, the sign-in and the
// boarding are rendered instead of the router (App.jsx), in the same
// modules, with the same module state — so every cached answer the
// last account left behind is still sitting there when the next one
// signs in, and each of these stores is per-account:
//
//   the summary   the level and the XP on the HUD, and `guided`,
//                 which is what hooks/useGuide reads to decide
//                 whether a gate has already had its lesson
//   the credits   the balance on the pass
//   today         the queue the tab bar's badge counts
//   the stats     the distance on every line
//   the journey   the standing the pass's back judges (five minutes'
//                 TTL, the longest of them)
//   the record    what was done at each grade of each practice
//                 platform (the desk's Practice gate, plan 130)
//   the guide     which gates opened their lesson THIS page load
//   the day ahead the reminders scheduled on this phone and the
//                 widget's figures (plan 155): both name the leaving
//                 learner's cards, so both are cleared on the device
//
// A learner who signs out of one account and boards a new one in the
// same visit — which is exactly what the settings screen's Sign out
// invites — was being shown the last account's figures until each TTL
// ran out, and could be refused the guide on a gate the PREVIOUS
// account had seen. So the answers go when the learner does.
//
// Called from App's auth listener, the one funnel every sign-out
// passes through (Settings, the boarding's two exits, a 401 in
// lib/api.js). Nothing here is a network call and nothing can throw:
// a sign-out must never fail because a cache would not drop.
export function forgetAccount() {
  forgetSummary()
  forgetCredits()
  forgetToday()
  forgetStats()
  forgetJourney()
  forgetPracticeRecord()
  forgetForecast()
  forgetShown()
  forgetAheadPlan()
  clearAhead()
}
