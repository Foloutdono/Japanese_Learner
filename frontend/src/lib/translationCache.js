import { HINTS } from '../domain/studyModes'

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

// Rewrites a card's meaning, and its MCQ options' meanings, from a
// map built by translatedMap. `keyOf` says how a card or an option is
// looked up in that map — Vocab keys by wordForm (kanji, falling back
// to kana for a kana-only entry), Kanji by the character itself,
// exactly as each screen keys the fetch it just made.
//
// The options live under `hints.indice_1` and always have: the
// backend builds that list as three distractors plus the right answer,
// shuffled (routes/vocab.py, study/mcq.py). `choices` — what this used
// to write to — has not been on a card payload for as long as the
// hints have existed, so switching language mid-card left the prompt
// in the new language and the options it is answered from in the old
// one, having fetched their translations and dropped them on the
// floor.
//
// Prompt and options are rewritten from the SAME map, which is what
// keeps grading intact: MCQGrid compares the picked option's meaning
// against the card's own, and both sides of that comparison come out
// of one lookup on one key. An option the map doesn't cover is
// returned untouched rather than rebuilt with an empty meaning — see
// translatedMap — so a radical card's options (which carry a `char`
// and no meaning at all) pass through as they are.
export function applyTranslations(card, keyOf, map) {
    const options = card.hints?.[HINTS.CHOICES]
    const translated = { ...card, meaning: map[keyOf(card)] ?? card.meaning }
    if (!Array.isArray(options)) return translated
    return {
        ...translated,
        hints: {
            ...card.hints,
            [HINTS.CHOICES]: options.map(option => {
                const meaning = map[keyOf(option)]
                return meaning ? { ...option, meaning } : option
            }),
        },
    }
}

// The picked option, rewritten alongside the options themselves.
// MCQGrid identifies a row by its TEXT — `selected` is the string the
// learner clicked, and MCQButton marks a row wrong only while that
// string still matches one of the options (everything else collapses
// as a filler once answered). So rewriting the options under an
// already-answered card without rewriting the pick would quietly
// un-mark the row the learner chose. `options` is the list as it was
// BEFORE the rewrite, which is what `selected` was drawn from.
//
// A pick that isn't one of the option meanings is returned untouched:
// in the meaning->word direction the rows are Japanese words, which no
// translation touches.
export function retranslateSelection(selected, options, keyOf, map) {
    if (!selected || !Array.isArray(options)) return selected
    const picked = options.find(option => option.meaning === selected)
    return (picked && map[keyOf(picked)]) || selected
}
