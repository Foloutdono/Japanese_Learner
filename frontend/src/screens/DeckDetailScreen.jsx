import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import ImportCardsMenu from '../components/decks/ImportCardsMenu'
import BrowseCardsMenu from '../components/decks/BrowseCardsMenu'
import { PlayIcon, ImportIcon, CheckboxIcon, CheckCircleIcon, CrossIcon, CheckIcon, PencilIcon, TrashIcon, CardIcon } from '../components/ui/Icons'

// Mirrors decks.py's SOURCE_FOR_TYPE / _allowed_sources / _allows_custom
// exactly — kept in sync by hand since it's this small. This is only
// ever used to shape the UI (hide/show buttons, restrict the Browse
// tabs); decks.py enforces the real rule server-side regardless of
// what the frontend shows.
const RESTRICTED_SOURCES_BY_TYPE = { kanji: ['kanji'], vocab: ['vocab'], grammar: ['grammar'] }

function allowedSourcesFor(type) {
  if (type in RESTRICTED_SOURCES_BY_TYPE) return RESTRICTED_SOURCES_BY_TYPE[type]
  if (type === 'flashcard') return []
  return ['kanji', 'vocab', 'grammar'] // 'mixed', or a legacy/unknown type
}

function allowsCustomFor(type) {
  return !(type in RESTRICTED_SOURCES_BY_TYPE)
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

  const [cards, setCards]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({ front: '', back: '', hint: '', notes: '' })
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [showBrowse, setShowBrowse] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

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

  function resetForm() { setForm({ front: '', back: '', hint: '', notes: '' }) }

  function startAdd() { resetForm(); setEditing(null); setAdding(true) }

  function startEdit(card) {
    setForm({ front: card.front, back: card.back, hint: card.hint || '', notes: card.notes || '' })
    setEditing(card.id)
    setAdding(true)
  }

  function saveCard() {
    if (!form.front.trim() || !form.back.trim()) return
    if (editing) {
      apiFetch(`/api/decks/${deck_id}/cards/${editing}`, session, {
        method: 'PUT',
        body: JSON.stringify(form),
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
        body: JSON.stringify(form),
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

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }

  async function deleteSelected() {
    if (!confirm(`${t.delete} ${selected.size} ${t.cards}?`)) return
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

        {/* Header row */}
        <div className="deckdetail-header">
          <div className="deckdetail-count">
            {cards.length} {t.cards}
          </div>

          {!selectMode && (
            <div className="deckdetail-actions">
              <button onClick={() => navigate(`/decks/${deck_id}/study`, { state: { deck } })}
                className="deckdetail-btn deckdetail-btn--study">
                <PlayIcon size={14} /> {t.study}
              </button>
              {allowCustom && (
                <button onClick={startAdd} className="deckdetail-btn">
                  {t.addCard}
                </button>
              )}
              {allowedSources.length > 0 && (
                <button onClick={() => setShowBrowse(true)} className="deckdetail-btn">
                  {t.browseBtn}
                </button>
              )}
              {cards.length > 0 && (
                <button onClick={() => setSelectMode(true)} className="deckdetail-btn deckdetail-btn--muted">
                  <CheckboxIcon size={14} /> {t.select}
                </button>
              )}
              {allowCustom && (
                <button onClick={() => setShowImport(true)} className="deckdetail-btn">
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
              <button onClick={toggleSelectAll} className="deckdetail-btn">
                {selected.size === cards.length ? t.deselectAll : t.selectAll}
              </button>
              <button
                onClick={deleteSelected}
                disabled={selected.size === 0}
                className={`deckdetail-btn ${selected.size > 0 ? 'deckdetail-btn--danger' : 'deckdetail-btn--danger-disabled'}`}>
                <TrashIcon size={14} /> {t.delete} ({selected.size})
              </button>
              <button onClick={exitSelectMode} className="deckdetail-btn deckdetail-btn--muted">
                {t.cancel}
              </button>
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
              <input value={form.front} onChange={e => setForm(f => ({ ...f, front: e.target.value }))}
                placeholder={deck?.type === 'kanji' ? t.kanjiFrontPlaceholder : t.frontPlaceholder}
                className="deckdetail-form__input" />
              <input value={form.back} onChange={e => setForm(f => ({ ...f, back: e.target.value }))}
                placeholder={t.backPlaceholder}
                className="deckdetail-form__input" />
              <input value={form.hint} onChange={e => setForm(f => ({ ...f, hint: e.target.value }))}
                placeholder={t.hintPlaceholder}
                className="deckdetail-form__input" />
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t.notesPlaceholder}
                onKeyDown={e => e.key === 'Enter' && saveCard()}
                className="deckdetail-form__input" />
            </div>
            <div className="deckdetail-form__actions">
              <button onClick={saveCard} className="deckdetail-form__save">
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

                  <div className="deckdetail-card-content">
                    <div className="deckdetail-card-fields">
                      <div>
                        <div className="deckdetail-field-label">
                          {t.frontPlaceholder}
                          {/* App-sourced cards (browsed in from kanji/vocab/
                              grammar) carry their own SRS progress shared
                              with the rest of the app — see decks.py's
                              _build_pool — so they're shown read-only here,
                              tagged by source, instead of an editable form. */}
                          {card.origin === 'app' && (
                            <span className="deckdetail-source-badge">
                              {' '}· {{ kanji: t.kanjiType, vocab: t.vocabType, grammar: t.grammarType }[card.source] ?? card.source}{card.level ? ` ${card.level}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="deckdetail-field-value deckdetail-field-value--jp">{card.front}</div>
                      </div>
                      {card.kana && (
                        <div>
                          <div className="deckdetail-field-label">かな</div>
                          <div className="deckdetail-field-value">{card.kana}</div>
                        </div>
                      )}
                      <div>
                        <div className="deckdetail-field-label">{t.backPlaceholder}</div>
                        <div className="deckdetail-field-value">{card.back}</div>
                      </div>
                      {card.hint && (
                        <div>
                          <div className="deckdetail-field-label">{t.hintPlaceholder}</div>
                          <div className="deckdetail-field-value deckdetail-field-value--hint">{card.hint}</div>
                        </div>
                      )}
                      {card.notes && (
                        <div>
                          <div className="deckdetail-field-label">{t.notesPlaceholder}</div>
                          <div className="deckdetail-field-value deckdetail-field-value--notes">{card.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

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