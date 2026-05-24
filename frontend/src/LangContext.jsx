import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'
import { getTranslations } from './translationCache'

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

    const t = translations[lang] ?? translations.fr

    return (
    <LangContext.Provider value={{ lang, switchLang, t, contentMaps }}>
        {children}
    </LangContext.Provider>
    )
}

export function useLang() {
    return useContext(LangContext)
}