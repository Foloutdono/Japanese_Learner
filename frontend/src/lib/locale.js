// ── The UI language on first launch ──────────────────────────
// The device's language, never asked: the boarding does not have a
// language question and the mobile canvas's rule is that the interface
// speaks the learner's own language while Japanese stays content. A
// choice made in Settings is saved under localStorage 'lang' and always
// wins; before any choice, an English-speaking device gets English and
// everything else gets French — the app's home language and its default
// since the first build, so no existing learner sees a change.
export const SUPPORTED_LANGS = ['fr', 'en']

export function pickInitialLang(saved, deviceLang) {
  if (SUPPORTED_LANGS.includes(saved)) return saved
  const device = String(deviceLang || '').toLowerCase()
  return device.startsWith('en') ? 'en' : 'fr'
}
