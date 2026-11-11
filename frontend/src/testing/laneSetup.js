// ── Each file boards the lane's French device ────────────────────────
// Run before every file of every browser lane (vite.config.js,
// browserProject's setupFiles). The lanes are a French device, and the
// files a lane's browser runs one after another share one origin, so one
// localStorage: a language one file chose was read by the next. Which
// file ran next was the scheduler's pick, so the failure moved between
// runs and landed far from its cause -- Frame.phone switched to English
// and never switched back, and ScoreReveal, deckEdit and LearnScreen,
// unchanged, read English (CI, 2026-11-10).
//
// A file that switches the language still takes it out in its afterEach,
// as it always has; this is what holds when one forgets. It removes the
// saved choice and nothing else: the next file starts on the device's own
// language, as a learner who never chose one does. Before the file, not
// before each test, so a language a file sets for all its tests stands.
try { localStorage.removeItem('lang') } catch { /* no storage: nothing kept */ }
