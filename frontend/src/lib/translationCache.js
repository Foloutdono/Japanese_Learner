const cache = {}

export async function getTranslations(lang) {
    if (cache[lang]) return cache[lang]

    const [kanji, vocab] = await Promise.all([
    fetch(`/api/translations/kanji?lang=${lang}`).then(r => r.json()),
    fetch(`/api/translations/vocab?lang=${lang}`).then(r => r.json()),
    ])

    cache[lang] = { kanji, vocab }
    return cache[lang]
}