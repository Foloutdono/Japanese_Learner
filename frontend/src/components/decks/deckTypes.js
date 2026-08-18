// ── Deck types, and what each one looks like ──────────────────
// Shared by DecksScreen (the grid + the create form) and
// DeckDetailScreen (its header), so a deck wears the same colour and
// the same glyph on both screens. They used to disagree: the list gave
// a deck a type colour, the detail screen showed no type at all.
//
// A type takes the pigment of the section it actually draws its cards
// from — a kanji deck is 漢字's own wisteria, a vocab deck 単語's
// indigo, a grammar deck 文法's pine. Before, these were picked from
// whatever was spare in the accent palette, so a "Kanji" deck was
// rust-red while the 漢字 station it pulls from was wisteria: the same
// thing named twice in two colours. config/navLinks.js documents that
// exact mistake as the reason the --line-* family exists.
//
// `standard` has no section behind it, so it takes the neutral rail
// .platform-card--local and --review already use for "no service type".
//
// `glyph` is the type's name in one character, for the card roundel —
// the same way every section in navLinks.js is identified by its kanji
// rather than an icon. Deck types are data, not copy, so the glyph and
// colour live here while the label/description stay in the locales.
//
// ── A deck has ONE STRUCTURE ──
// 'mixed' is gone. A mixed deck had to union two sources' study modes and
// then answer what a kanji-only mode means for a grammar card sitting
// beside it — a question one structure per deck removes rather than
// answers. 'flashcard' is renamed 'standard', matching what the study-mode
// registry calls the same thing (domain/studyModes.js).
//
// The structure now decides what a deck can hold BOTH ways: app cards
// browsed in from its source, and personal cards written in its shape. The
// old model had that backwards for personal cards — a kanji deck accepted
// app kanji and no hand-written cards at all, making it the one place a
// personal kanji card could not go.
export function deckTypes(t) {
  return [
    { value: 'standard', label: t.standardType, desc: t.standardDesc,     glyph: '札', color: 'var(--text-secondary)' },
    { value: 'vocab',    label: t.vocabType,    desc: t.deckVocabDesc,    glyph: '単', color: 'var(--line-vocab)' },
    { value: 'kanji',    label: t.kanjiType,    desc: t.deckKanjiDesc,    glyph: '漢', color: 'var(--line-kanji)' },
    { value: 'grammar',  label: t.grammarType,  desc: t.deckGrammarDesc,  glyph: '文', color: 'var(--line-grammar)' },
  ]
}

export function deckTypeOf(type, t) {
  return deckTypes(t).find(d => d.value === type)
    ?? { value: type, label: type, glyph: '教', color: 'var(--line-decks)' }
}
