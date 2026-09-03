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

// ── One word at a time ────────────────────────────────────
// The per-word endpoints (`/api/translation/{kanji,vocab}`, used by
// Kanji/VocabScreen's translateCard when the UI language changes
// under a card already in hand) answer `{ translation: "" }` for a
// word they have no entry for rather than omitting it — 313 of the
// vocab deck's 8405 words have no French gloss, あびる among them.
// A caller that writes that answer straight onto the card replaces a
// real meaning with nothing, and `??` never catches it, because ""
// is not nullish: the card then reveals blank, while the dictionary
// sheet on the same card still shows the English the backend fell
// back to (the BULK map above simply omits the key, so its own
// `?? entry.meaning` works).
//
// So: keep only the words that actually came back with a
// translation. A word that didn't is absent from the map, and the
// caller's `?? cur.meaning` keeps what the card already had.
export function translatedMap(entries) {
    return Object.fromEntries(entries.filter(([, translation]) => translation))
}
