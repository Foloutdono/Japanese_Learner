// ── 番線 — every feature the reel can play (plan 210) ──────────────────
// One module per feature of the app. Each says where in the app it
// stands (route), what must be drawn before it may be filmed (ready),
// what it sets up out of sight before the phone comes up (before), and
// how a learner uses it (play). script.mjs's APPS lists the same names.

import { analyzer } from './analyzer'

export const APPS = {
  analyzer,
}
