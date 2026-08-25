import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import ImportCardsMenu from '../components/decks/ImportCardsMenu'
import BrowseCardsMenu from '../components/decks/BrowseCardsMenu'
import { deckTypeOf } from '../components/decks/deckTypes'
import { PlayIcon, ImportIcon, CheckboxIcon, CheckCircleIcon, CrossIcon, CheckIcon, PencilIcon, TrashIcon, CardIcon, LightbulbIcon } from '../components/ui/Icons'

// Mirrors decks.py's SOURCE_FOR_TYPE / _allowed_sources / _allows_custom
// exactly — kept in sync by hand since it's this small. This is only
// ever used to shape the UI (hide/show buttons, restrict the Browse
// tabs); decks.py enforces the real rule server-side regardless of
// what the frontend shows.
//
// A deck has ONE STRUCTURE, and it decides both halves: which app cards
// can be browsed in, and which personal cards can be written. `standard`
// is a plain front/back pair with no app source behind it.
const SOURCE_FOR_TYPE = { kanji: ['kanji'], vocab: ['vocab'], grammar: ['grammar'] }
const STRUCTURES = ['standard', 'kanji', 'vocab', 'grammar']

// A browsed-in card is tagged with the pigment of the section it came
// from — the same colours components/decks/deckTypes.js gives the deck
// types, so "this card is from 漢字" reads identically wherever it's
// shown.
const SOURCE_COLOR = {
  kanji: 'var(--line-kanji)',
  vocab: 'var(--line-vocab)',
  grammar: 'var(--line-grammar)',
}

function allowedSourcesFor(type) {
  return SOURCE_FOR_TYPE[type] ?? []
}

// EVERY structure accepts hand-written cards — of its own structure.
// This used to be the inverse: it returned false for kanji/vocab/grammar,
// so "Add card" was hidden on precisely the decks where a personal card
// of that kind belongs. A kanji deck was the one place you could not
// write your own kanji card.
function allowsCustomFor(type) {
  return STRUCTURES.includes(type)
}

// ── The radical field ─────────────────────────────────────────
// A kanji card carries the Kangxi radical NUMBER, and nobody remembers
// that 言 is 149 — so this shows the glyphs and stores the number.
//
// Reuses GET /api/dictionary/radicals, which the dictionary's browse-by-
// radical grid already serves, grouped by stroke count. That endpoint is
// scoped to radicals with at least one kanji in the app's own deck; a
// personal card may well use one outside that subset, so it is asked with
// ?all=true and falls back to whatever it returns.
function RadicalField({ label, value, onChange, session }) {
  const { t } = useLang()
  const [groups, setGroups] = useState(null)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    apiFetch('/api/dictionary/radicals?all=true', session)
      .then(r => r.json())
      .then(d => setGroups(d.groups ?? []))
      .catch(() => setGroups([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chosen = groups
    ?.flatMap(g => g.radicals)
    .find(r => r.number === Number(value))

  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{label} *</div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="deckdetail-form__input deckdetail-form__radical-btn">
        {chosen
          ? <span><span lang="ja">{chosen.char}</span> · {chosen.number}</span>
          : <span className="deckdetail-form__placeholder">{t.pickRadical}</span>}
      </button>
      {open && (
        <div className="radical-picker">
          {(groups ?? []).map(g => (
            <div key={g.stroke_count} className="radical-picker__group">
              <div className="radical-picker__strokes">{g.stroke_count}</div>
              <div className="radical-picker__row">
                {g.radicals.map(r => (
                  <button key={r.number} type="button" lang="ja"
                    title={`${r.number}`}
                    className={`radical-picker__cell${Number(value) === r.number ? ' radical-picker__cell--on' : ''}`}
                    onClick={() => { onChange(r.number); setOpen(false) }}>
                    {r.char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Same combined cap study/structures.py enforces on save (kanji.readings'
// own quiz-side ReadingsInput.jsx carries the identical number for the
// same reason — see that component's comment) — checked here too so the
// form itself stops offering "+" before a save would silently trim the
// overflow instead.
const MAX_READINGS = 15

// ── The readings field (personal kanji cards) ─────────────────
// Two groups the learner grows one row at a time, mirroring
// kanji.readings' own quiz widget (components/study/ReadingsInput.jsx)
// almost exactly — this is the WRITE side of that same shape, so a
// personal kanji card can be studied with kanji.readings the same way
// an app one is: type every on'yomi/kun'yomi you know, submit, see
// what you got. `value` is {on: string[], kun: string[]}; `onChange`
// always receives the whole object back.
function ReadingsField({ label, value, onChange }) {
  const { t } = useLang()
  const on  = value?.on  ?? []
  const kun = value?.kun ?? []
  const total = on.length + kun.length
  const full  = total >= MAX_READINGS

  function setRow(kind, i, v) {
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: rows.map((r, j) => (j === i ? v : r)) })
  }
  function addRow(kind) {
    if (full) return
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: [...rows, ''] })
  }
  function removeRow(kind, i) {
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: rows.filter((_, j) => j !== i) })
  }

  const GROUPS = [
    { kind: 'on',  label: t.readingsOn,  jp: '音読み', rows: on },
    { kind: 'kun', label: t.readingsKun, jp: '訓読み', rows: kun },
  ]

  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{label} *</div>
      {GROUPS.map(g => (
        <div key={g.kind} className="readings-field__group">
          <div className="readings-field__label">
            <span lang="ja">{g.jp}</span> <span>{g.label}</span>
          </div>
          {g.rows.map((v, i) => (
            <div key={i} className="readings-field__row">
              <input
                value={v}
                onChange={e => setRow(g.kind, i, e.target.value)}
                placeholder={t.readingsPlaceholder}
                className="deckdetail-form__input"
                lang="ja"
              />
              <button
                type="button"
                onClick={() => removeRow(g.kind, i)}
                className="readings-field__remove"
                aria-label={t.delete}
                title={t.delete}
              >
                <CrossIcon size={12} />
              </button>
            </div>
          ))}
          {!full && (
            <button type="button" onClick={() => addRow(g.kind)} className="deckdetail-form__addline">
              + {g.label}
            </button>
          )}
        </div>
      ))}
      {full && <div className="readings-field__cap">{t.readingsCap}</div>}
    </div>
  )
}

export default function DeckDetailScreen({ session }) {
  const navigate        = useNavigate()
  const { deck_id }     = useParams()
  const { state }       = useLocation()
  const { t }           = useLang()

  // Falls back to fetching the deck when opened without router state
  // (a refresh, a direct link) — needed now that a deck's `type`
  // actually restricts what can be added to it, so the UI has to know
  // it reliably rather than silently defaulting to "allow everything"
  // whenever state happens to be missing.
  const [deck, setDeck] = useState(state?.deck ?? null)

  useEffect(() => {
    if (deck) return
    apiFetch(`/api/decks/${deck_id}`, session)
      .then(r => r.json())
      .then(d => { if (!d?.error) setDeck(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  const allowedSources = allowedSourcesFor(deck?.type)
  const allowCustom    = allowsCustomFor(deck?.type)
  const dt             = deckTypeOf(deck?.type, t)

  const [cards, setCards]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({})
  const [notes, setNotes]           = useState('')
  // The card shapes, fetched rather than duplicated: the add-card form is
  // GENERATED from the same spec the API validates against, so a field
  // added on the backend appears here without a matching edit. See
  // study/structures.py and GET /api/decks/structures.
  const [structures, setStructures] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [showBrowse, setShowBrowse] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)


  useEffect(() => { fetchCards() }, [])

  function fetchCards() {
    apiFetch(`/api/decks/${deck_id}/cards`, session)
      .then(r => r.json())
      .then(data => { setCards(data.cards || []); setLoading(false) })
      // Same fix as DecksScreen's fetchDecks — a failed request used
      // to leave `loading` true forever instead of settling into the
      // (empty) card list / EmptyState.
      .catch(() => setLoading(false))
  }

  // Custom cards are keyed by their own numeric id; app-sourced cards
  // (added via Browse) have no id of their own — they're identified
  // by (source, raw_id) instead — so every card in the combined list
  // needs one stable key regardless of where it came from.
  function cardKey(card) {
    return card.origin === 'app' ? `app:${card.source}:${card.raw_id}` : `custom:${card.id}`
  }

  function deleteCard(card) {
    if (card.origin === 'app') {
      const params = new URLSearchParams({ source: card.source, raw_id: card.raw_id })
      return apiFetch(`/api/decks/${deck_id}/cards/app?${params.toString()}`, session, { method: 'DELETE' })
    }
    return apiFetch(`/api/decks/${deck_id}/cards/${card.id}`, session, { method: 'DELETE' })
  }

  // The spec for THIS deck, or null until it arrives. A deck holds one
  // structure, so there is nothing for the learner to pick.
  const structure = structures?.find(x => x.key === (deck?.type ?? 'standard'))
    ?? structures?.find(x => x.key === 'standard')
    ?? null

  useEffect(() => {
    apiFetch('/api/decks/structures', session)
      .then(r => r.json())
      .then(d => setStructures(d.structures ?? []))
      .catch(() => setStructures([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function blankForm(spec) {
    const out = {}
    for (const f of spec?.fields ?? []) {
      if (f.kind === 'lines') out[f.key] = ['']
      else if (f.kind === 'readings') out[f.key] = { on: [''], kun: [''] }
      else out[f.key] = ''
    }
    return out
  }

  function resetForm() { setForm(blankForm(structure)); setNotes('') }

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function setLine(key, i, value) {
    setForm(f => ({ ...f, [key]: (f[key] ?? []).map((v, j) => (j === i ? value : v)) }))
  }

  function addLine(key) { setForm(f => ({ ...f, [key]: [...(f[key] ?? []), ''] })) }

  /** Whether every required field carries something — mirrors
   *  structures.missing_required, which is what actually enforces it. */
  function formComplete() {
    return (structure?.fields ?? []).every(f => {
      if (!f.required) return true
      const v = form[f.key]
      if (f.kind === 'readings') {
        return (v?.on ?? []).some(x => x.trim()) || (v?.kun ?? []).some(x => x.trim())
      }
      return Array.isArray(v) ? v.some(x => x.trim()) : String(v ?? '').trim()
    })
  }

  function startAdd() { resetForm(); setEditing(null); setAdding(true) }

  function startEdit(card) {
    setForm({ ...blankForm(structure), ...(card.fields ?? {}) })
    setNotes(card.notes || '')
    setEditing(card.id)
    setAdding(true)
  }

  function saveCard() {
    if (!formComplete()) return
    const body = JSON.stringify({ fields: form, notes })
    if (editing) {
      apiFetch(`/api/decks/${deck_id}/cards/${editing}`, session, {
        method: 'PUT',
        body,
      })
        .then(r => r.json())
        .then(updated => {
          setCards(prev => prev.map(c => (c.origin === 'custom' && c.id === editing) ? { ...updated, origin: 'custom' } : c))
          setAdding(false)
          setEditing(null)
          resetForm()
        })
    } else {
      apiFetch(`/api/decks/${deck_id}/cards`, session, {
        method: 'POST',
        body,
      })
        .then(r => r.json())
        .then(card => { setCards(prev => [...prev, card]); resetForm() })
    }
  }

  function toggleSelect(key) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(selected.size === cards.length ? new Set() : new Set(cards.map(cardKey)))
  }

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); setConfirmingDelete(false) }

  async function deleteSelected() {
    // Asked inline in the toolbar (see confirmingDelete) rather than
    // through the browser's confirm() dialog, which was the last
    // OS-native surface in the app.
    playUi('click-screen-selection')
    setConfirmingDelete(false)
    for (const card of cards) {
      if (!selected.has(cardKey(card))) continue
      await deleteCard(card)
    }
    setCards(prev => prev.filter(c => !selected.has(cardKey(c))))
    exitSelectMode()
  }

  async function handleImport(cards) {
    for (const card of cards) {
      await apiFetch(`/api/decks/${deck_id}/cards`, session, {
        method: 'POST',
        body: JSON.stringify({ front: card.front, back: card.back, hint: card.hint || '', notes: '' }),
      })
    }
    setImportResult({ inserted: cards.length })
    setShowImport(false)
    fetchCards()
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? t.deckFallbackTitle} autoHide />

      <div className="container page-pad">
        {/* Same plate every other screen in the app opens with — this
            was one of the last two 教材 screens still starting on a bare
            container, which is exactly what made them read as a
            different app. It names the STATION; the identity block
            below it names the deck. */}
        <StationHeader />

        {/* The deck, named on its own page. The name used to live only
            in the TopBar — which auto-hides on scroll — and the type
            wasn't shown at all, so a deck that was clearly "Kanji" in
            the grid became anonymous the moment you opened it. Same
            roundel, glyph and pigment as its card in DecksScreen. */}
        <div className="deckdetail-identity" style={{ '--rail': dt.color }}>
          <span className="platform-card__no deckdetail-identity__glyph" lang="ja" aria-hidden="true">{dt.glyph}</span>
          <span className="deckdetail-identity__text">
            <span className="deckdetail-identity__name">{deck?.name ?? t.deckFallbackTitle}</span>
            <span className="deckdetail-identity__meta">
              <span className="deckdetail-identity__type">{dt.label}</span>
              {' · '}{cards.length} {t.cards}
            </span>
          </span>
        </div>

        {/* Header row */}
        <div className="deckdetail-header">
          {!selectMode && (
            <div className="deckdetail-actions">
              <button onClick={() => { playUi('click-screen-selection'); navigate(`/decks/${deck_id}/study`, { state: { deck } }) }}
                className="deckdetail-btn deckdetail-btn--study">
                <PlayIcon size={14} /> {t.study}
              </button>
              {allowCustom && (
                <button onClick={() => { playUi('click-mode-selection'); startAdd() }} className="deckdetail-btn">
                  {t.addCard}
                </button>
              )}
              {allowedSources.length > 0 && (
                <button onClick={() => { playUi('click-mode-selection'); setShowBrowse(true) }} className="deckdetail-btn">
                  {t.browseBtn}
                </button>
              )}
              {cards.length > 0 && (
                <button onClick={() => { playUi('click-mode-selection'); setSelectMode(true) }} className="deckdetail-btn deckdetail-btn--muted">
                  <CheckboxIcon size={14} /> {t.select}
                </button>
              )}
              {allowCustom && (
                <button onClick={() => { playUi('click-mode-selection'); setShowImport(true) }} className="deckdetail-btn">
                  <ImportIcon size={14} /> {t.import}
                </button>
              )}
            </div>
          )}

          {selectMode && (
            <div className="deckdetail-actions deckdetail-actions--select">
              <span className="deckdetail-select-count">
                {selected.size} {t.cards}
              </span>
              <button onClick={() => { playUi('click-mode-selection'); toggleSelectAll() }} className="deckdetail-btn">
                {selected.size === cards.length ? t.deselectAll : t.selectAll}
              </button>
              {confirmingDelete ? (
                <>
                  <span className="deckdetail-confirm-q">{t.deleteCardsConfirm}</span>
                  <button onClick={deleteSelected} className="deckdetail-btn deckdetail-btn--danger">
                    <TrashIcon size={14} /> {t.delete} ({selected.size})
                  </button>
                  <button onClick={() => { playUi('click-mode-selection'); setConfirmingDelete(false) }} className="deckdetail-btn deckdetail-btn--muted">
                    {t.cancel}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { playUi('click-mode-selection'); setConfirmingDelete(true) }}
                    disabled={selected.size === 0}
                    className={`deckdetail-btn ${selected.size > 0 ? 'deckdetail-btn--danger' : 'deckdetail-btn--danger-disabled'}`}>
                    <TrashIcon size={14} /> {t.delete} ({selected.size})
                  </button>
                  <button onClick={() => { playUi('click-mode-selection'); exitSelectMode() }} className="deckdetail-btn deckdetail-btn--muted">
                    {t.cancel}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Import success banner */}
        {importResult && (
          <div className="deckdetail-import-banner">
            <div className="deckdetail-import-banner__text">
              <CheckCircleIcon size={15} /> {importResult.inserted} {t.cards}
            </div>
            <button onClick={() => setImportResult(null)} className="deckdetail-import-banner__close" aria-label={t.close}>
              <CrossIcon size={14} />
            </button>
          </div>
        )}

        {/* Add / Edit form */}
        {adding && (
          <div className="card deckdetail-form">
            <div className="deckdetail-form__title">
              {editing ? t.editCard : t.newCard}
            </div>
            <div className="deckdetail-form__fields">
              {/* One input per field the structure declares. A kanji card
                  asks for four things and a standard card for two, from
                  one definition rather than a branch per deck type. */}
              {(structure?.fields ?? []).map(f => {
                const label = t[`field_${f.key}`] ?? f.key
                if (f.kind === 'lines') {
                  const rows = form[f.key] ?? ['']
                  return (
                    <div key={f.key} className="deckdetail-form__group">
                      <div className="deckdetail-form__label">{label}</div>
                      {rows.map((v, i) => (
                        <input key={i} value={v}
                          onChange={e => setLine(f.key, i, e.target.value)}
                          placeholder={label}
                          className="deckdetail-form__input" />
                      ))}
                      <button type="button" onClick={() => addLine(f.key)}
                        className="deckdetail-form__addline">+ {label}</button>
                    </div>
                  )
                }
                if (f.picker === 'radical') {
                  return (
                    <RadicalField key={f.key} label={label} session={session}
                      value={form[f.key]} onChange={v => setField(f.key, v)} />
                  )
                }
                if (f.kind === 'readings') {
                  return (
                    <ReadingsField key={f.key} label={label}
                      value={form[f.key]} onChange={v => setField(f.key, v)} />
                  )
                }
                return (
                  <input key={f.key} value={form[f.key] ?? ''}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.required ? `${label} *` : label}
                    className="deckdetail-form__input" />
                )
              })}
              {/* notes is on every structure and never shown during a
                  card — unlike the `hint` it replaces, which appeared
                  mid-quiz as help nobody asked for. */}
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
                onKeyDown={e => e.key === 'Enter' && saveCard()}
                className="deckdetail-form__input" />
            </div>
            <div className="deckdetail-form__actions">
              <button onClick={saveCard} disabled={!formComplete()}
                className="deckdetail-form__save">
                {editing ? t.save : t.addCard}
              </button>
              <button onClick={() => { setAdding(false); setEditing(null); resetForm() }}
                className="deckdetail-form__cancel">
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {loading && <Loading />}

        {!loading && cards.length === 0 && !adding && (
          <EmptyState icon={<CardIcon size={40} />} message={t.noCards} hint={t.addFirstCard} />
        )}

        {/* Cards list */}
        {!loading && cards.length > 0 && (
          <div className="deckdetail-list">
            {cards.map(card => {
              const key   = cardKey(card)
              const isSel = selected.has(key)
              return (
                <div
                  key={key}
                  className={`card deckdetail-card-row${selectMode ? ' deckdetail-card-row--selectable' : ''}${isSel ? ' deckdetail-card-row--selected' : ''}`}
                  onClick={selectMode ? () => toggleSelect(key) : undefined}
                >
                  {selectMode && (
                    <div className={`deckdetail-checkbox${isSel ? ' deckdetail-checkbox--checked' : ''}`}>
                      {isSel && <span className="deckdetail-checkbox__mark"><CheckIcon size={12} /></span>}
                    </div>
                  )}

                  {/* A card, not a database row. This was five
                      "Label / value" pairs laid out side by side —
                      "Front", "Back / Meaning", "かな", "Hint",
                      "Notes" — repeated down the page, so the labels
                      outnumbered the Japanese and every entry read as
                      a record rather than something to study. The
                      front is now the entry, at the size the app shows
                      Japanese everywhere else; the reading sits under
                      it the way furigana does; the meaning follows;
                      and hint/notes are quiet annotations at the end.
                      Only the two optional ones still name themselves,
                      because those genuinely aren't self-evident. */}
                  <div className="deckdetail-card-content">
                    <div className="deckdetail-entry">
                      <span className="deckdetail-entry__front" lang="ja">{card.front}</span>
                      {card.kana && <span className="deckdetail-entry__kana" lang="ja">{card.kana}</span>}
                    </div>
                    <div className="deckdetail-entry__back">{card.back}</div>
                    {(card.hint || card.notes) && (
                      <div className="deckdetail-entry__notes">
                        {card.hint && (
                          <span className="deckdetail-entry__note">
                            <LightbulbIcon size={12} /> {card.hint}
                          </span>
                        )}
                        {card.notes && (
                          <span className="deckdetail-entry__note deckdetail-entry__note--muted">{card.notes}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* App-sourced cards (browsed in from kanji/vocab/
                      grammar) carry their own SRS progress shared with
                      the rest of the app — see decks.py's _build_pool —
                      so they're read-only here, tagged by where they
                      came from. The tag wears that section's own
                      pigment, same as the deck-type roundel. */}
                  {card.origin === 'app' && (
                    <span
                      className="deckdetail-source-badge"
                      style={{ '--rail': SOURCE_COLOR[card.source] ?? 'var(--text-secondary)' }}
                    >
                      {{ kanji: t.kanjiType, vocab: t.vocabType, grammar: t.grammarType }[card.source] ?? card.source}
                      {card.level ? ` · ${card.level}` : ''}
                    </span>
                  )}

                  {!selectMode && card.origin === 'custom' && (
                    <button onClick={() => startEdit(card)} className="deckdetail-edit-btn" aria-label={t.edit} title={t.edit}>
                      <PencilIcon size={15} />
                    </button>
                  )}
                  {!selectMode && card.origin === 'app' && (
                    <button onClick={() => deleteCard(card).then(fetchCards)} className="deckdetail-edit-btn" aria-label={t.delete} title={t.delete}>
                      <TrashIcon size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showImport && (
        <ImportCardsMenu onImport={handleImport} onClose={() => setShowImport(false)} />
      )}

      {showBrowse && (
        <BrowseCardsMenu
          deckId={deck_id}
          deckType={deck?.type}
          session={session}
          onAdded={fetchCards}
          onClose={() => setShowBrowse(false)}
        />
      )}
    </div>
  )
}