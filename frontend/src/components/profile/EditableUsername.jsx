import { useState } from 'react'
import { apiFetch } from '../../lib/api'
import { CARD_NAME_MAX, cardNameLength, cleanCardName } from '../../domain/passCard'
import { PencilIcon, CrossIcon } from '../ui/Icons'

// Must match backend/routes/profile.py's USERNAME_RE — the backend is
// the authority; this only saves a round trip for obvious rejects.
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

// Click the name (or the pencil) to edit it in place — save/cancel via
// Enter/Escape or the two small buttons, no separate modal/page for
// what's a one-field change.
//
// Lifted verbatim from ProfileScreen (which imports it back) when the
// onboarding welcome step needed the same control — the name on your
// pass is the first thing 窓口 offers to fix.
//
// `field` is which name the card's signature is (plan 247): the
// username, for an account boarded before the card asked for a first
// name, or `cardName` -- any script, up to CARD_NAME_MAX, and nothing at
// all an answer (the card then prints its placeholder in the quiet ink).
export function EditableUsername({ username, session, onChange, t, ground = 'panel', field = 'username' }) {
  const card = field === 'cardName'
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(username)
  const [error, setError]     = useState(null)
  const [saving, setSaving]   = useState(false)

  function startEdit() {
    setValue(username)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  function save() {
    const next = card ? cleanCardName(value) : value
    if (card ? cardNameLength(value) > CARD_NAME_MAX : !USERNAME_RE.test(value)) {
      setError(card ? t.cardNameTooLong(CARD_NAME_MAX) : t.usernameInvalid)
      return
    }
    if (next === username) { setEditing(false); return }

    setSaving(true)
    setError(null)
    // Only a sentence from the table reaches the field. A dropped
    // connection rejects with the browser's own English ("Failed to
    // fetch", "Load failed"), which used to be printed as it stood
    // (plan 215): the refusal is decided here, and anything else is
    // the generic line.
    let refused = t.genericError
    apiFetch('/api/profile', session, { method: 'PATCH', body: JSON.stringify({ [field]: next }) })
      .then(r => {
        if (r.status === 409) refused = t.usernameTaken
        if (!r.ok) throw new Error(`profile ${r.status}`)
        return r.json()
      })
      .then(data => {
        onChange(card ? (data.cardName ?? next) : data.username)
        setEditing(false)
      })
      .catch(() => setError(refused))
      .finally(() => setSaving(false))
  }

  if (!editing) {
    return (
      <button type="button" className="profile-card__name profile-card__name--editable" onClick={startEdit}>
        {/* The name is its own element so it can be the thing that
            shortens: a pass prints its holder on one line, and a
            20-character name on a 360px card would otherwise wrap
            under the pencil and grow the card. */}
        <span className={`profile-card__name-text${username ? '' : ' profile-card__name-text--empty'}`}>{username || t.brdNamePlaceholder}</span>
        <PencilIcon size={13} className="profile-card__edit-glyph" />
      </button>
    )
  }

  return (
    <div className="profile-card__name-edit">
      <input
        autoFocus
        value={value}
        maxLength={card ? CARD_NAME_MAX * 2 : 20}
        placeholder={card ? t.brdNamePlaceholder : undefined}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className={`field ${ground === 'panel' ? 'field--panel ' : ''}profile-card__name-input`}
        disabled={saving}
      />
      <button type="button" onClick={save} disabled={saving} className="profile-card__name-save">
        {t.save}
      </button>
      <button type="button" onClick={cancel} disabled={saving} className="profile-card__name-cancel" aria-label={t.cancel}>
        <CrossIcon size={13} />
      </button>
      {error && <div className="profile-card__name-error">{error}</div>}
    </div>
  )
}
