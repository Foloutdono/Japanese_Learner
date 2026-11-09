import fr from './locales/fr'
import en from './locales/en'
import es from './locales/es'
import id from './locales/id'
import esES from './locales/es-ES'

// Spain's Spanish is the Spanish table with the entries Spain says
// otherwise (plan 303): a group (an object of strings) is merged entry
// by entry, so an override names only what it changes.
function over(base, own) {
    const out = { ...base }
    for (const [k, v] of Object.entries(own)) {
        const b = base[k]
        out[k] = b && typeof b === 'object' && typeof v === 'object' && !Array.isArray(v) ? { ...b, ...v } : v
    }
    return out
}

export const translations = { fr, en, es, id, 'es-ES': over(es, esES) }

// A language's flag is drawn from components/ui/flags.js by its code
// (plan 302, the owner's choice "for clarity"), never as an emoji: Windows
// has none and prints the letters. A flag stands for a country, not a
// language; the label beside it is what names the language.
export const LANGUAGES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español (Latinoamérica)' },
    { code: 'es-ES', label: 'Español (España)' },
    // In preview (plan 312): offered only to the accounts the server
    // lists for it (lib/locale.js, offeredLocales).
    { code: 'id', label: 'Bahasa Indonesia' },
]