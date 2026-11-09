// ── The UI language on first launch ──────────────────────────
// The device's language, never asked: the boarding does not have a
// language question and the mobile canvas's rule is that the interface
// speaks the learner's own language while Japanese stays content. A
// choice made in Settings is saved under localStorage 'lang' and always
// wins (and is kept on the account too, lib/langChoice.js); before any
// choice, a French-speaking device gets French, a Spanish-speaking one
// Spanish (plan 302), and everything else gets English — the default for
// a learner whose device language the app does not speak. The server's
// copy is backend/translations SPOKEN, held equal to this list by
// backend/tests/test_languages.py (plan 312): keep it a literal.
export const SUPPORTED_LANGS = ['fr', 'en', 'es', 'id']

// The languages the app speaks to a few accounts only while their parts
// are written (plan 312, the owner's pick D3): no device starts in one,
// and the picker offers one only to an account the server lists for it
// (the profile's previewLangs, backend translations PREVIEW_LANG_USERS).
// A saved choice of one is honoured, since only the learner's click
// writes it. backend translations PREVIEW is the server's copy.
export const PREVIEW_LANGS = ['id']

// The interface's locales: the languages the app speaks, and Spain's Spanish
// (plan 303), an interface over the one Spanish content (`es`): the
// screens' words Spain says otherwise (locales/es-ES) and Spain's
// figures. What is stored as the choice (localStorage, the account's
// ui_lang) is a locale; what the app asks the server for, and keys its
// content by, is the locale's language (contentLang).
export const UI_LOCALES = ['fr', 'en', 'es', 'id', 'es-ES']

/** The content language a locale reads: es-ES reads Spanish. */
export function contentLang(locale) {
  return UI_LOCALES.includes(locale) ? locale.slice(0, 2) : 'en'
}

/** The locale a first launch speaks: the saved choice, else the
 *  device's, Spain's Spanish on a device set to Spain. */
export function pickInitialLang(saved, deviceLang) {
  if (UI_LOCALES.includes(saved)) return saved
  const device = String(deviceLang || '').toLowerCase()
  if (device.startsWith('es-es')) return 'es-ES'
  const base = device.slice(0, 2)
  return SUPPORTED_LANGS.includes(base) && !PREVIEW_LANGS.includes(base) ? base : 'en'
}

/** The locales the picker offers: every one but a language in preview,
 *  which only an account the server lists for it sees, and the locale
 *  in use, which is always shown so it can be read and left. */
export function offeredLocales(previewLangs = [], current = null) {
  return UI_LOCALES.filter(code => {
    const lang = contentLang(code)
    return !PREVIEW_LANGS.includes(lang) || (previewLangs ?? []).includes(lang) || code === current
  })
}

// ── The locale a number or a date is written in ──────────────
// Each language's own, and English's as the screen asks (a decimal is
// 'en-GB' on a card, 'en-US' on a price). One table, so a third language
// is one line here rather than a ternary at every Intl call. Spanish is
// Latin America's (es-419: 3.5, 12,000), the variety the app writes (plan
// 302), and the breakdown's own figures agree (backend study/figures.py);
// a learner on Spain's Spanish reads Spain's (2.000; 3,5, plan 303). The
// screens pass the content language, so which Spanish is the interface's
// is held here, set by the language context (setInterfaceLocale).
const INTL = { fr: 'fr-FR', es: 'es-419', 'es-ES': 'es-ES', id: 'id-ID' }
let spanish = 'es-419'

export function setInterfaceLocale(locale) {
  spanish = locale === 'es-ES' ? 'es-ES' : 'es-419'
}

export function intlLocale(lang, english = 'en-US') {
  if (lang === 'es') return spanish
  return INTL[lang] ?? english
}

// ── What a language says its own way (plan 312) ──────────────
// What Intl leaves to the sentence: the first of a month ("1er novembre",
// "1 de noviembre", "November 1"). One line a language, so a language the
// app gains says it by a line here, not by a branch at each screen; one
// with no line says it the English way, its own month's name in it.
const FIRST_OF_MONTH = {
  fr: month => `1er ${month}`,
  es: month => `1 de ${month}`,
}

/** The first of `month` (the month's name, as Intl gives it in `lang`). */
export function firstOfMonth(lang, month) {
  return (FIRST_OF_MONTH[lang] ?? (m => `${m} 1`))(month)
}
