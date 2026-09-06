import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'
import { getTranslations } from './lib/translationCache'
import { pickInitialLang } from './lib/locale'

const LangContext = createContext()

function readSavedLang() {
    // localStorage throws in private-mode/blocked-cookie contexts — the
    // same case index.html's theme script guards against.
    try { return localStorage.getItem('lang') } catch { return null }
}

export function LangProvider({ children }) {
    // The device's language, never asked: a first launch reads
    // navigator.language and the saved choice (Settings) wins after
    // that. See lib/locale.js for the rule.
    const [lang, setLang]         = useState(() => pickInitialLang(readSavedLang(), navigator.language))
    const [contentMaps, setContentMaps] = useState({ kanji: {}, vocab: {} })

    useEffect(() => {
        // Swallowed on failure, deliberately: the content maps are an
        // enhancement over the built-in strings, and a dropped network
        // (or a fetch aborted by unmount — the browser test lane's
        // teardown does exactly that, and the unhandled rejection
        // flaked whole CI runs) must degrade to the empty maps, never
        // throw past the component.
        let live = true
        getTranslations(lang)
            .then(maps => { if (live) setContentMaps(maps) })
            .catch(() => {})
        return () => { live = false }
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