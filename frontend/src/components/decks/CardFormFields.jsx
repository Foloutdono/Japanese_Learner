import { useLang } from '../../LangContext'
import { Chip } from '../chrome/Console'
import { CrossIcon } from '../ui/Icons'

// ── The written card's fields, beyond a line of text ──────────────
// The kinds study/structures.py declares for a grammar card's lesson:
// a paragraph (the rule explained, its uses, its trap), a choice (the
// register) and a repeatable pair (a sentence over its translation, a
// rival rule beside what tells it apart). Each is drawn from the spec
// the add-card form is generated from, like the readings and the
// radical picker in DeckDetailScreen.

// Mirrors structures.MAX_ROWS: the form stops offering "+" before a
// save would trim the overflow.
const MAX_ROWS = 20

const label = (t, key, part) => (part ? t[`field_${key}_${part}`] : null) ?? t[`field_${key}`] ?? key

/** A paragraph. "- " lines make a list, **…** bold, as in a lesson. */
export function LongField({ field, value, onChange }) {
  const { t } = useLang()
  const name = label(t, field.key)
  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{name}</div>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={t[`fieldHint_${field.key}`] ?? name}
        aria-label={name}
        rows={3}
        className="field field--multi deckdetail-form__input deckdetail-form__long"
      />
    </div>
  )
}

/** One of the field's options, or none: the chosen chip, pressed again, clears it. */
export function ChoiceField({ field, value, onChange }) {
  const { t } = useLang()
  const name = label(t, field.key)
  const words = field.key === 'register' ? t.glRegister : null
  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label" id={`card-field-${field.key}`}>{name}</div>
      <div className="deckdetail-form__choice" role="group" aria-labelledby={`card-field-${field.key}`}>
        {field.options.map(opt => (
          <Chip key={opt} on={value === opt} onClick={() => onChange(value === opt ? '' : opt)}>
            {words?.[opt] ?? opt}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/** Rows of two parts, the first the one a row needs. */
export function PairsField({ field, value, onChange }) {
  const { t } = useLang()
  const [first, second] = field.parts
  const rows = value?.length ? value : [{ [first]: '', [second]: '' }]
  const set = (i, part, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [part]: v } : r)))
  const add = () => onChange([...rows, { [first]: '', [second]: '' }])
  const remove = i => onChange(rows.filter((_, j) => j !== i))
  const name = label(t, field.key)
  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{t[`field_${field.key}_group`] ?? name}</div>
      {rows.map((r, i) => (
        <div key={i} className="pairs-field__row">
          <div className="pairs-field__parts">
            <input
              value={r[first] ?? ''}
              onChange={e => set(i, first, e.target.value)}
              placeholder={label(t, field.key, first)}
              aria-label={`${label(t, field.key, first)} ${i + 1}`}
              lang="ja"
              className="field deckdetail-form__input"
            />
            <input
              value={r[second] ?? ''}
              onChange={e => set(i, second, e.target.value)}
              placeholder={label(t, field.key, second)}
              aria-label={`${label(t, field.key, second)} ${i + 1}`}
              className="field deckdetail-form__input pairs-field__second"
            />
          </div>
          {rows.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="readings-field__remove"
                    aria-label={t.delete} title={t.delete}>
              <CrossIcon size={12} />
            </button>
          )}
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <button type="button" onClick={add} className="deckdetail-form__addline">+ {name}</button>
      )}
    </div>
  )
}
