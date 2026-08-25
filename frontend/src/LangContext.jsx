import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'
import { getTranslations } from './lib/translationCache'

const LangContext = createContext()

export function LangProvider({ children }) {
    const [lang, setLang]         = useState(localStorage.getItem('lang') || 'fr')
    const [contentMaps, setContentMaps] = useState({ kanji: {}, vocab: {} })

    useEffect(() => {
        getTranslations(lang).then(setContentMaps)
    }, [lang])

    function switchLang(code) {
        setLang(code)
        localStorage.setItem('lang', code)
    }

    // <html lang> drives which voice a screen reader uses. It has to
    // follow the UI language, not sit at the index.html default.
    useEffect(() => {
        document.documentElement.lang = lang
    }, [lang])

    const t = translations[lang] ?? translations.fr

    return (
    <LangContext.Provider value={{ lang, switchLang, t, contentMaps }}>
        {children}
    </LangContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- useLang is the standard companion hook for this Context; splitting it into its own file would ripple across every importer for no behavioral benefit.
export function useLang() {
    return useContext(LangContext)
}