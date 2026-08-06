import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api'

// ── Browse & add existing app cards into a custom deck ─────
//
// Sibling of ImportCardsMenu (same overlay/modal shell, see
// .import-overlay/.import-modal in index.css) but for pulling in
// cards that already exist in the app's own kanji/vocab/grammar
// decks instead of typing new ones. Backed by GET/POST
// /api/decks/{deckId}/browse and /cards/app — see decks.py's SOURCES
// registry for what "source" values are valid; kana and a fuller
// dictionary search are natural next additions there, and nothing
// here should need to change to pick those up once they exist (just
// another tab).
//
//   <BrowseCardsMenu deckId={deckId} session={session}
//     onAdded={() => fetchCards()} onClose={() => setShowBrowse(false)} />

const SOURCE_TABS = [
  { key: 'kanji',   label: '漢字 Kanji' },
  { key: 'vocab',   label: '語彙 Vocabulaire' },
  { key: 'grammar', label: '文法 Grammaire' },
]

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const SEARCH_DEBOUNCE_MS = 300

export default function BrowseCardsMenu({ deckId, session, onAdded, onClose }) {
  const [source, setSource]     = useState('kanji')
  const [level, setLevel]       = useState('')
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding]     = useState(false)

  // Selection is per (source, raw_id) — cleared whenever the source
  // tab changes, since raw ids from different sources aren't
  // comparable and a browse switch is a natural "start over" point.
  useEffect(() => { setSelected(new Set()) }, [source])

  const debounceRef = useRef(null)

  const runSearch = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ source, level, query, limit: '60' })
    apiFetch(`/api/decks/${deckId}/browse?${params.toString()}`, session)
      .then(r => r.json())
      .then(data => setResults(data.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [deckId, session, source, level, query])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runSearch, query ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(debounceRef.current)
  }, [runSearch, query])

  function toggle(rawId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(rawId)) next.delete(rawId)
      else next.add(rawId)
      return next
    })
  }

  async function addSelected() {
    if (selected.size === 0 || adding) return
    setAdding(true)
    const cards = results
      .filter(r => selected.has(r.raw_id))
      .map(r => ({ source: r.source, level: r.level, raw_id: r.raw_id }))
    try {
      await apiFetch(`/api/decks/${deckId}/cards/app`, session, {
        method: 'POST',
        body: JSON.stringify({ cards }),
      })
      onAdded?.()
      setSelected(new Set())
      runSearch() // refresh in_deck flags so added items grey out
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <div className="import-header__title">Parcourir les cartes existantes</div>
          <button onClick={onClose} className="import-header__close">✕</button>
        </div>
        <div className="import-subtitle">
          Ajoutez des kanji, mots ou points de grammaire déjà présents dans l'application à ce deck.
        </div>

        <div className="browse-source-tabs">
          {SOURCE_TABS.map(s => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={`browse-source-tab${source === s.key ? ' browse-source-tab--active' : ''}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="study-level-row browse-level-row">
          <button
            onClick={() => setLevel('')}
            className={`study-level-btn${level === '' ? ' study-level-btn--active' : ''}`}>
            Tous
          </button>
          {LEVELS.map(l => (
            <button key={l}
              onClick={() => setLevel(l)}
              className={`study-level-btn${level === l ? ' study-level-btn--active' : ''}`}>
              {l}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher (kanji, kana, sens...)"
          className="deckdetail-form__input browse-search-input"
        />

        <div className="import-preview browse-results">
          <div className="import-preview__title">
            {selected.size > 0 ? `${selected.size} sélectionné(s)` : 'Résultats'}
          </div>

          {loading && <div className="import-preview__empty">Recherche...</div>}

          {!loading && results.length === 0 && (
            <div className="import-preview__empty">Aucun résultat.</div>
          )}

          {!loading && results.length > 0 && (
            <div className="import-preview__list browse-results__list">
              {results.map(r => {
                const isSel = selected.has(r.raw_id)
                return (
                  <div
                    key={r.raw_id}
                    onClick={() => !r.in_deck && toggle(r.raw_id)}
                    className={`deckdetail-card-row browse-result-row${r.in_deck ? ' browse-result-row--in-deck' : ' deckdetail-card-row--selectable'}${isSel ? ' deckdetail-card-row--selected' : ''}`}
                  >
                    <div className={`deckdetail-checkbox${isSel || r.in_deck ? ' deckdetail-checkbox--checked' : ''}`}>
                      {(isSel || r.in_deck) && <span className="deckdetail-checkbox__mark">✓</span>}
                    </div>
                    <div className="import-preview-row__front">{r.front}</div>
                    {r.kana && r.kana !== r.front && (
                      <div className="import-preview-row__hint">{r.kana}</div>
                    )}
                    <div className="import-preview-row__arrow">→</div>
                    <div className="import-preview-row__back">{r.meaning}</div>
                    {r.in_deck && <div className="browse-result-row__tag">déjà ajouté</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="import-footer">
          <button onClick={onClose} className="import-footer__cancel">Fermer</button>
          <button
            onClick={addSelected}
            disabled={selected.size === 0 || adding}
            className={`import-footer__submit${selected.size > 0 ? ' import-footer__submit--active' : ''}${adding ? ' import-footer__submit--importing' : ''}`}>
            {adding ? 'Ajout...' : `Ajouter (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
