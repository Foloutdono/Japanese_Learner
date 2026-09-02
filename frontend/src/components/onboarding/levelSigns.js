// ── 駅名 — the levels as station signage (plan 063) ──────────────
// The five JLPT levels drawn as places on the line: a serif station
// name each, and one sentence a learner AT that level can read — the
// boarding step's whole placement heuristic ("board at the last
// station whose sign you can read"). Content, not copy: the sentences
// are Japanese on purpose, identical in every UI language, and the
// names pair with the Latin level codes under the app's pairing rule.
// Phase E's destination chips read the same table.

export const LEVEL_JP = {
  N5: '入門',
  N4: '基礎',
  N3: '日常',
  N2: '実務',
  N1: '終着',
}

// One line per level, difficulty-true: everyday copula → volitional
// weather → embedded conjecture → keigo instructions → literary 慣用句.
export const LEVEL_SAMPLE = {
  N5: 'これはペンです。',
  N4: '雨が降りそうです。',
  N3: '彼は来ないかもしれないと思っていた。',
  N2: 'ご確認のうえ、お手続きください。',
  N1: '彼の発言は物議を醸した。',
}
