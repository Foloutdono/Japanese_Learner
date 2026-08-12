import fr from './locales/fr'
import en from './locales/en'

export const translations = { fr, en }

// `flag` used to carry a country-flag emoji per entry — dropped, not
// replaced with an icon, because nothing ever read it (LangSwitcher in
// NavControls.jsx only consumes code/label) and a flag icon implies a
// country, not a language, which isn't a distinction this app makes.
export const LANGUAGES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
]