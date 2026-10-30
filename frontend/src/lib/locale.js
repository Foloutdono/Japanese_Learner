// ── The UI language on first launch ──────────────────────────
// The device's language, never asked: the boarding does not have a
// language question and the mobile canvas's rule is that the interface
// speaks the learner's own language while Japanese stays content. A
// choice made in Settings is saved under localStorage 'lang' and always
// wins (and is kept on the account too, lib/langChoice.js); before any
// choice, a French-speaking device gets French, a Spanish-speaking one
// Spanish (plan 291), and everything else gets English — the default for
// a learner whose device language the app does not speak.
export const SUPPORTED_LANGS = ['fr', 'en', 'es']

export function pickInitialLang(saved, deviceLang) {
  if (SUPPORTED_LANGS.includes(saved)) return saved
  const device = String(deviceLang || '').toLowerCase().slice(0, 2)
  return SUPPORTED_LANGS.includes(device) ? device : 'en'
}

// ── The locale a number or a date is written in ──────────────
// Each language's own, and English's as the screen asks (a decimal is
// 'en-GB' on a card, 'en-US' on a price). One table, so a third language
// is one line here rather than a ternary at every Intl call.
const INTL = { fr: 'fr-FR', es: 'es-ES' }

export function intlLocale(lang, english = 'en-US') {
  return INTL[lang] ?? english
}
