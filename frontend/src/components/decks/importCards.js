// ── 取込 — pasted rows into a deck's own cards ─────────────────
// The import dialog's reading of a paste, kept pure so it can be held by
// node tests. It used to split every line into front/back/hint/notes and
// post that to any deck, which a structured deck refused row by row
// (a grammar card has no `front`) while the dialog reported success.
//
// Now the columns are the DECK's (GET /api/decks/structures):
//
//   * without a header, in the structure's own order: its one-cell
//     fields as declared, then the notes, then its first repeatable
//     field as many times as the row goes on. For a grammar deck that
//     is rule, meaning, formation, register, explanation, uses,
//     pitfalls, notes, then sentence, translation, sentence,
//     translation... (columnsFor)
//   * with a header row -- recognised by its names, in either language
//     (readHeader) -- in whatever order the sheet has them, so a
//     spreadsheet with "Règle | Sens | Exemple | Traduction | Exemple |
//     Traduction | Comparer | Différence" lands whole.
//
// A cell may be quoted, as a spreadsheet writes it: "…" holds a
// separator or a line break, "" is a quote (splitRows).

/** Rows of cells. Quotes hold a separator or a line break. */
export function splitRows(text, termSep, cardSep) {
  if (!text || !termSep || !cardSep) return []
  let src = text
  if (cardSep === '\n') src = src.replace(/\r\n?/g, '\n')
  const rows = []
  let row = []
  let cell = ''
  let i = 0
  let atStart = true
  const endCell = () => { row.push(cell.trim()); cell = ''; atStart = true }
  const endRow = () => {
    endCell()
    if (row.some(c => c !== '')) rows.push(row)
    row = []
  }
  while (i < src.length) {
    if (atStart) {
      // Spaces before a quote do not stop it being one ("a", "b").
      let j = i
      while (src[j] === ' ') j++
      if (src[j] === '"') {
        const close = closingQuote(src, j + 1)
        if (close !== -1) {
          cell += src.slice(j + 1, close).replace(/""/g, '"')
          i = close + 1
          atStart = false
          continue
        }
      }
    }
    if (src.startsWith(cardSep, i)) { endRow(); i += cardSep.length; continue }
    if (src.startsWith(termSep, i)) { endCell(); i += termSep.length; continue }
    cell += src[i]
    atStart = false
    i++
  }
  endRow()
  return rows
}

function closingQuote(src, from) {
  for (let i = from; i < src.length; i++) {
    if (src[i] !== '"') continue
    if (src[i + 1] === '"') { i++; continue }
    return i
  }
  return -1
}

const REPEATS = new Set(['lines', 'pairs'])

/**
 * The structure's columns without a header: [{key, part?}] for the cells
 * read once, and `repeat` for the field the rest of the row fills.
 */
export function columnsFor(structure) {
  const fields = structure?.fields ?? []
  // A field declared `positional: false` (a grammar card's reading) is
  // left out: it came after cards were pasted this way, and would move
  // every column behind it. A header still names it.
  const once = fields.filter(f => !REPEATS.has(f.kind) && f.positional !== false).map(f => ({ key: f.key }))
  once.push({ key: 'notes' })
  const rep = fields.find(f => REPEATS.has(f.kind)) ?? null
  const repeat = rep
    ? (rep.kind === 'pairs' ? rep.parts.map(part => ({ key: rep.key, part })) : [{ key: rep.key }])
    : []
  return { once, repeat }
}

// Header names, per field (and per part of a pair), beside each field's
// label in the learner's language (t.field_*). Compared folded: lower
// case, no accents, no digits (Exemple 2), no punctuation.
const ALIASES = {
  front: ['front', 'recto', 'question', 'term', 'terme'],
  back: ['back', 'verso', 'answer', 'reponse', 'definition'],
  kana: ['kana'],
  romaji: ['romaji', 'romanization', 'romanisation'],
  kanji: ['kanji', 'character', 'caractere'],
  meaning: ['meaning', 'meanings', 'sens', 'signification', 'definition', 'gloss', 'traduction du mot'],
  readings: ['readings', 'reading', 'lectures', 'lecture', 'yomi'],
  reading: ['reading', 'lecture', 'kana', 'furigana', 'yomi'],
  radical: ['radical', 'cle'],
  word: ['word', 'mot', 'vocab', 'vocabulary', 'vocabulaire', 'expression'],
  rule: ['rule', 'regle', 'regle de grammaire', 'grammar rule', 'pattern', 'grammar', 'grammaire', 'point'],
  rule_reading: ['reading', 'lecture', 'furigana', 'yomi', 'kana', 'reading of the rule', 'lecture de la regle'],
  structure: ['structure', 'formation', 'form', 'forme', 'construction', 'conjugaison'],
  register: ['register', 'registre', 'niveau de langue', 'politesse'],
  explanation: ['explanation', 'explication', 'description', 'lesson', 'lecon'],
  usage: ['usage', 'usages', 'use', 'uses', 'emploi', 'emplois', 'utilisation'],
  careful: ['careful', 'caution', 'warning', 'pitfall', 'pitfalls', 'attention', 'piege', 'pieges', 'watch out'],
  'sentences.jp': ['sentence', 'sentences', 'example', 'examples', 'exemple', 'exemples', 'phrase', 'phrases',
    'phrase d exemple', 'example sentence', 'jp', 'japanese', 'japonais'],
  'sentences.tr': ['translation', 'traduction', 'tr', 'en', 'fr'],
  'compare.pattern': ['compare', 'comparer', 'rival', 'contrast', 'contraste', 'similar rule', 'regle voisine', 'voisine'],
  'compare.text': ['difference', 'distinction', 'nuance', 'compare note', 'ce qui les distingue', 'what sets them apart'],
  notes: ['notes', 'note', 'remarque', 'remarques', 'comment', 'comments', 'commentaire'],
}

export function fold(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[*’'"()[\]:#.\d_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every column a header cell may name in this structure, as [name, column]. */
function headerNames(structure, t) {
  const names = []
  const add = (col, words) => { for (const w of words) if (w) names.push([fold(w), col]) }
  for (const f of structure?.fields ?? []) {
    if (f.kind === 'pairs') {
      for (const part of f.parts) {
        const col = { key: f.key, part }
        add(col, ALIASES[`${f.key}.${part}`] ?? [])
        add(col, [t?.[`field_${f.key}_${part}`]])
      }
      // The field's own label names its first part (Phrase d'exemple).
      add({ key: f.key, part: f.parts[0] }, [t?.[`field_${f.key}`]])
    } else {
      add({ key: f.key }, [...(ALIASES[f.key] ?? []), t?.[`field_${f.key}`]])
    }
  }
  add({ key: 'notes' }, [...ALIASES.notes, t?.field_notes])
  return names
}

/**
 * The header row's columns, or null when the row is not a header: it is
 * one when at least two of its cells, the card's front among them, are
 * names this structure knows. Earlier names win a clash, so a field's
 * own words beat a neighbour's.
 */
export function readHeader(row, structure, t) {
  if (!structure) return null
  const names = headerNames(structure, t)
  const cols = row.map(cell => {
    const f = fold(cell)
    if (!f) return null
    return names.find(([name]) => name === f)?.[1] ?? null
  })
  const found = cols.filter(Boolean)
  if (found.length < 2 || !found.some(c => c.key === structure.front_key)) return null
  return cols
}

// A register cell in either language's words, or the key itself.
const REGISTER_WORDS = {
  neutral: ['neutral', 'neutre'],
  polite: ['polite', 'poli', 'polie', 'politesse', 'teinei', '丁寧'],
  casual: ['casual', 'familier', 'familiere', 'informal', 'informel'],
  formal: ['formal', 'formel', 'soutenu', 'keigo', '敬語'],
  written: ['written', 'ecrit', 'ecrite', 'litteraire'],
}

function choiceValue(field, cell, t) {
  const f = fold(cell) || String(cell ?? '').trim()
  if (!f) return ''
  for (const key of field.options ?? []) {
    const words = [key, ...(REGISTER_WORDS[key] ?? []), t?.glRegister?.[key]].map(fold)
    if (words.includes(f) || (REGISTER_WORDS[key] ?? []).includes(cell.trim())) return key
  }
  return ''
}

function blankFields(structure) {
  const out = {}
  for (const f of structure?.fields ?? []) {
    if (f.kind === 'lines' || f.kind === 'pairs') out[f.key] = []
    else out[f.key] = ''
  }
  return out
}

function place(card, col, cell, structure, t) {
  if (!cell) return
  if (col.key === 'notes') {
    card.notes = card.notes ? `${card.notes}\n${cell}` : cell
    return
  }
  const field = structure.fields.find(f => f.key === col.key)
  if (!field) return
  const value = card.fields
  if (field.kind === 'pairs') {
    const [first, second] = field.parts
    const rows = value[field.key]
    const last = rows[rows.length - 1]
    if (col.part === first || !last || last[second]) rows.push({ [first]: col.part === first ? cell : '', [second]: col.part === second ? cell : '' })
    else last[second] = cell
  } else if (field.kind === 'lines') {
    value[field.key].push(cell)
  } else if (field.kind === 'choice') {
    value[field.key] = choiceValue(field, cell, t)
  } else {
    value[field.key] = value[field.key] ? `${value[field.key]}\n${cell}` : cell
  }
}

/** The required fields a card has nothing in. */
export function missingFields(structure, fields) {
  return (structure?.fields ?? [])
    .filter(f => f.required)
    .filter(f => {
      const v = fields[f.key]
      if (Array.isArray(v)) return !v.some(x => (typeof x === 'object' ? Object.values(x)[0] : x))
      return !String(v ?? '').trim()
    })
    .map(f => f.key)
}

/**
 * The paste as cards: {cards: [{fields, notes, missing}], header, columns,
 * ignored}. `columns` is what was read, for the dialog to name; `ignored`
 * the header cells no field answers to.
 */
export function readCards(text, termSep, cardSep, structure, t) {
  const rows = splitRows(text, termSep, cardSep)
  if (!structure || rows.length === 0) return { cards: [], header: false, columns: null, ignored: [] }
  const header = readHeader(rows[0], structure, t)
  const body = header ? rows.slice(1) : rows
  const { once, repeat } = columnsFor(structure)
  const cards = body.map(row => {
    const card = { fields: blankFields(structure), notes: '' }
    row.forEach((cell, i) => {
      let col
      if (header) col = header[i]
      else if (i < once.length) col = once[i]
      else if (repeat.length) col = repeat[(i - once.length) % repeat.length]
      if (col) place(card, col, cell, structure, t)
    })
    // A sentence with no Japanese is nothing to show; the server drops it too.
    for (const f of structure.fields) {
      if (f.kind === 'pairs') card.fields[f.key] = card.fields[f.key].filter(p => p[f.parts[0]])
    }
    return { ...card, missing: missingFields(structure, card.fields) }
  })
  return {
    cards,
    header: Boolean(header),
    columns: header ? header.filter(Boolean) : [...once, ...repeat],
    ignored: header ? rows[0].filter((cell, i) => cell && !header[i]) : [],
  }
}

/** A header row and one card, in this structure's columns, for the "example" button. */
export function exampleText(structure, termSep, t, lang = 'fr') {
  const sample = SAMPLES[structure?.key] ?? SAMPLES.standard
  const cols = sample.map(([col]) => col)
  const label = col => {
    if (col.key === 'notes') return t?.field_notes ?? 'Notes'
    return (col.part ? t?.[`field_${col.key}_${col.part}`] : null) ?? t?.[`field_${col.key}`] ?? col.key
  }
  const quote = cell => (cell.includes(termSep) || cell.includes('\n') || cell.includes('"')
    ? `"${cell.replace(/"/g, '""')}"` : cell)
  const pick = lang === 'en' ? 1 : 0
  return [
    cols.map(label).map(quote).join(termSep),
    sample.map(([, value]) => quote(Array.isArray(value) ? value[pick] : value)).join(termSep),
  ].join('\n')
}

const SAMPLES = {
  standard: [[{ key: 'front' }, '水'], [{ key: 'back' }, ['eau', 'water']]],
  kana: [[{ key: 'kana' }, 'ヴ'], [{ key: 'romaji' }, 'vu']],
  vocab: [[{ key: 'word' }, '水'], [{ key: 'meaning' }, ['eau', 'water']], [{ key: 'reading' }, 'みず']],
  kanji: [[{ key: 'kanji' }, '水'], [{ key: 'meaning' }, ['eau', 'water']], [{ key: 'readings' }, 'スイ・みず'], [{ key: 'radical' }, '85']],
  grammar: [
    [{ key: 'rule' }, '〜てください'],
    [{ key: 'meaning' }, ['faites…, s’il vous plaît', 'please do']],
    [{ key: 'structure' }, ['verbe forme て + ください', 'verb て-form + ください']],
    [{ key: 'register' }, ['poli', 'polite']],
    [{ key: 'explanation' }, ['**forme en て + ください** demande poliment de faire quelque chose.',
      '**て-form + ください** asks someone to do something politely.']],
    [{ key: 'usage' }, ['- Consignes : ここに名前を書いてください\n- Invitations : どうぞ入ってください',
      '- Instructions: ここに名前を書いてください\n- Invitations: どうぞ入ってください']],
    [{ key: 'careful' }, ['Cela reste un ordre : à un supérieur, préfère 〜ていただけませんか.',
      'It is still an instruction: to a superior, 〜ていただけませんか is safer.']],
    [{ key: 'sentences', part: 'jp' }, 'この本を読んでください。'],
    [{ key: 'sentences', part: 'tr' }, ['Lisez ce livre, s’il vous plaît.', 'Please read this book.']],
    [{ key: 'sentences', part: 'jp' }, 'ちょっとまってください。'],
    [{ key: 'sentences', part: 'tr' }, ['Attendez un instant, s’il vous plaît.', 'Please wait a moment.']],
    [{ key: 'compare', part: 'pattern' }, '〜ないでください'],
    [{ key: 'compare', part: 'text' }, ['demande de ne pas faire', 'asks someone not to do']],
  ],
}

/**
 * A stored pairs value as rows. A grammar card written before its
 * sentences carried translations holds bare strings; they open as a
 * sentence with an empty translation, and save back as pairs.
 */
export function pairRows(value, parts) {
  const [first, second] = parts
  return (Array.isArray(value) ? value : [])
    .map(v => (v && typeof v === 'object' ? { [first]: v[first] ?? '', [second]: v[second] ?? '' } : { [first]: String(v ?? ''), [second]: '' }))
}
