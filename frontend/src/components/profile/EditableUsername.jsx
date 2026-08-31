import { useState } from 'react'
import { apiFetch } from '../../lib/api'
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
export function EditableUsername({ username, session, onChange, t }) {
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
    if (!USERNAME_RE.test(value)) {
      setError(t.usernameInvalid)
      return
    }
    if (value === username) { setEditing(false); return }

    setSaving(true)
    setError(null)
    apiFetch('/api/profile', session, { method: 'PATCH', body: JSON.stringify({ username: value }) })
      .then(r => {
        if (r.status === 409) throw new Error(t.usernameTaken)
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => {
        onChange(data.username)
        setEditing(false)
      })
      .catch(err => setError(err.message || (t.genericError)))
      .finally(() => setSaving(false))
  }

  if (!editing) {
    return (
      <button type="button" className="profile-card__name profile-card__name--editable" onClick={startEdit}>
        {username}
        <PencilIcon size={13} className="profile-card__edit-glyph" />
      </button>
    )
  }

  return (
    <div className="profile-card__name-edit">
      <input
        autoFocus
        value={value}
        maxLength={20}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className="field field--panel profile-card__name-input"
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
