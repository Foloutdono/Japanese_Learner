import fr from './locales/fr'
import en from './locales/en'
import es from './locales/es'

export const translations = { fr, en, es }

// A language's flag is drawn from components/ui/flags.js by its code
// (plan 291, the owner's choice "for clarity"), never as an emoji: Windows
// has none and prints the letters. A flag stands for a country, not a
// language; the label beside it is what names the language.
export const LANGUAGES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
]