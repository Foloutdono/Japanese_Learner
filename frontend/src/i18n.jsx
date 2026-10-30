import fr from './locales/fr'
import en from './locales/en'
import es from './locales/es'

export const translations = { fr, en, es }

// `flag` used to carry a country-flag emoji per entry — dropped, not
// replaced with an icon, because nothing ever read it (Settings › Display in
// NavControls.jsx only consumes code/label) and a flag icon implies a
// country, not a language, which isn't a distinction this app makes.
export const LANGUAGES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
]