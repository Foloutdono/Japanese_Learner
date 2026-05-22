import { createContext, useContext, useState } from 'react'
import { translations } from './i18n'

const LangContext = createContext()

export function LangProvider({ children }) {
    const [lang, setLang] = useState(
        localStorage.getItem('lang') || 'fr'
    )

    function switchLang(code) {
        setLang(code)
        localStorage.setItem('lang', code)
    }

    const t = translations[lang] ?? translations.fr

    return (
        <LangContext.Provider value={{ lang, switchLang, t }}>
        {children}
        </LangContext.Provider>
    )
}

export function useLang() {
    return useContext(LangContext)
}