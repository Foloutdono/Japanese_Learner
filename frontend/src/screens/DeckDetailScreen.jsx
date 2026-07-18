import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import EmptyState from '../components/EmptyState'
import ImportCardsMenu from '../components/ImportCardsMenu'

export default function DeckDetailScreen({ session }) {
  const navigate        = useNavigate()
  const { deck_id }     = useParams()
  const { state }       = useLocation()
  const { t }           = useLang()
  const deck            = state?.deck

  const [cards, setCards]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({ front: '', back: '', hint: '', notes: '' })
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => { fetchCards() }, [])

  function fetchCards() {
    apiFetch(`/api/decks/${deck_id}/cards`, session)
      .then(r => r.json())
      .then(data => { setCards(data.cards || []); setLoading(false) })
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
          setCards(prev => prev.map(c => c.id === editing ? updated : c))
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

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(selected.size === cards.length ? new Set() : new Set(cards.map(c => c.id)))
  }

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }

  async function deleteSelected() {
    if (!confirm(`${t.delete} ${selected.size} ${t.cards} ?`)) return
    for (const id of selected) {
      await apiFetch(`/api/decks/${deck_id}/cards/${id}`, session, { method: 'DELETE' })
    }
    setCards(prev => prev.filter(c => !selected.has(c.id)))
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
      <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? 'Deck'} />

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
                {t.study}
              </button>
              <button onClick={startAdd} className="deckdetail-btn">
                {t.addCard}
              </button>
              {cards.length > 0 && (
                <button onClick={() => setSelectMode(true)} className="deckdetail-btn deckdetail-btn--muted">
                  {t.select}
                </button>
              )}
              <button onClick={() => setShowImport(true)} className="deckdetail-btn">
                {t.import}
              </button>
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
                {t.delete} ({selected.size})
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
              ✅ {importResult.inserted} {t.cards}
            </div>
            <button onClick={() => setImportResult(null)} className="deckdetail-import-banner__close">
              ✕
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
                placeholder={deck?.type === 'kanji' ? 'Kanji (ex: 日)' : t.frontPlaceholder}
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

        {loading && (
          <div className="loading-block">{t.loading}</div>
        )}

        {!loading && cards.length === 0 && !adding && (
          <EmptyState icon="🃏" message={t.noCards} hint={t.addFirstCard} />
        )}

        {/* Cards list */}
        {!loading && cards.length > 0 && (
          <div className="deckdetail-list">
            {cards.map(card => {
              const isSel = selected.has(card.id)
              return (
                <div
                  key={card.id}
                  className={`card deckdetail-card-row${selectMode ? ' deckdetail-card-row--selectable' : ''}${isSel ? ' deckdetail-card-row--selected' : ''}`}
                  onClick={selectMode ? () => toggleSelect(card.id) : undefined}
                >
                  {selectMode && (
                    <div className={`deckdetail-checkbox${isSel ? ' deckdetail-checkbox--checked' : ''}`}>
                      {isSel && <span className="deckdetail-checkbox__mark">✓</span>}
                    </div>
                  )}

                  <div className="deckdetail-card-content">
                    <div className="deckdetail-card-fields">
                      <div>
                        <div className="deckdetail-field-label">{t.frontPlaceholder}</div>
                        <div className="deckdetail-field-value deckdetail-field-value--jp">{card.front}</div>
                      </div>
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

                  {!selectMode && (
                    <button onClick={() => startEdit(card)} className="deckdetail-edit-btn">
                      ✏️
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
    </div>
  )
}