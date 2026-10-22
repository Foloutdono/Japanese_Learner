import { createContext, useContext, useState, useEffect } from 'react'
import { track } from './lib/track'
import { translations } from './i18n'
import { getTranslations } from './lib/translationCache'
import { pickInitialLang } from './lib/locale'
import { savedLang, rememberLang, subscribeLang } from './lib/langChoice'

const LangContext = createContext()

export function LangProvider({ children }) {
    // The device's language, never asked: a first launch reads
    // navigator.language and the saved choice (Settings) wins after
    // that. The choice lives on the account too (lib/langChoice.js), so
    // a cleared browser or a second device reads it back. See
    // lib/locale.js for the rule.
    const [lang, setLang]         = useState(() => pickInitialLang(savedLang(), navigator.language))
    const [contentMaps, setContentMaps] = useState({ kanji: {}, vocab: {} })

    // The account's answer arrives after the first paint (App.jsx's
    // boot calls syncLang): follow it.
    useEffect(() => subscribeLang(() => {
        setLang(pickInitialLang(savedLang(), navigator.language))
    }), [])

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
        if (code !== lang) track('setting_change', { setting: 'lang', value: code })   // plan 218
        setLang(code)
        // Local at once, and up to the account when there is a session.
        rememberLang(code, import('./lib/session').then(m => m.currentSession()).catch(() => null))
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