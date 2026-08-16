// ── Paper kinds, named in the reader's language ───────────────
// The four generators behind /api/exams (backend/study/exam_*_gen.py).
// Shared by the picker (ExamScreen) and the two screens that only ever
// hold a paper, never the catalog entry that named it (ExamRunner,
// ExamResult) — those used to fall back to the paper's own English
// `section.label`, so a French user picked "Vocabulaire" and then sat
// an exam titled "Vocabulary".
export const KIND_ORDER = ['vocab', 'grammar', 'reading', 'listening']

export function kindMeta(t) {
  return {
    vocab:     { label: t.examKindVocab,     jp: '語彙' },
    grammar:   { label: t.examKindGrammar,   jp: '文法' },
    reading:   { label: t.examKindReading,   jp: '読解' },
    listening: { label: t.examKindListening, jp: '聴解' },
  }
}

// A materialized paper carries no `kind` of its own — only its one
// section's id, which each generator sets to a stable, kind-specific
// string (see the `sections: [{ id: ... }]` literal at the bottom of
// each exam_*_gen.py). That's the reliable bridge back to a localized
// name without threading the catalog entry through every screen or
// re-parsing the "{level}-{kind}-01" exam id.
const KIND_BY_SECTION_ID = {
  vocabulary: 'vocab',
  grammar: 'grammar',
  reading: 'reading',
  listening: 'listening',
}

/** Localized "N5 Vocabulaire" for a fetched paper, for the TopBar. */
export function paperTitle(exam, t) {
  const kind = KIND_BY_SECTION_ID[exam?.sections?.[0]?.id]
  const label = kind ? kindMeta(t)[kind].label : exam?.sections?.[0]?.label
  return [exam?.level, label].filter(Boolean).join(' ')
}
