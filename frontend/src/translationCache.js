const cache = {}

export async function getTranslations(lang) {
    if (cache[lang]) return cache[lang]

    const [kanji, vocab] = await Promise.all([
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/translations/kanji?lang=${lang}`).then(r => r.json()),
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/translations/vocab?lang=${lang}`).then(r => r.json()),
    ])

    cache[lang] = { kanji, vocab }
    return cache[lang]
}