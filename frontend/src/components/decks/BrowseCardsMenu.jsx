import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { CrossIcon, CheckIcon } from '../ui/Icons'

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
// `deckType` restricts which of the three tabs are even offered —
// mirrors decks.py's SOURCE_FOR_TYPE (a 'kanji' deck only ever gets
// the kanji tab, 'mixed'/unset gets all three) — the server enforces
// the actual rule regardless, this is just so the picker doesn't
// dangle options that would get rejected anyway.
//
//   <BrowseCardsMenu deckId={deckId} deckType={deck?.type} session={session}
//     onAdded={() => fetchCards()} onClose={() => setShowBrowse(false)} />

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const SEARCH_DEBOUNCE_MS = 300

// A deck has ONE STRUCTURE, and it browses only its own source.
// Second hand-synced copy of decks.py's SOURCE_FOR_TYPE — see
// DeckDetailScreen for the same table and why it is duplicated.
// 'standard' has no app source, so its Browse menu offers nothing.
const SOURCE_FOR_TYPE = { kanji: ['kanji'], vocab: ['vocab'], grammar: ['grammar'] }

function allowedSourcesFor(type) {
  return SOURCE_FOR_TYPE[type] ?? []
}

// A kanji's packed reading ("ド・ト・つち") separates entries with 、
// which at row text-size renders as a barely-there dot easy to miss
// entirely — readings run together instead of reading as a list. Split
// it out and give the separator its own, bigger, bolder styling
// instead of leaning on the raw glyph at the surrounding text's size.
function DottedReadings({ text }) {
  const parts = (text || '').split('・')
  return parts.map((part, i) => (
    <span key={i}>
      {i > 0 && <span className="reading-sep-dot" aria-hidden="true">・</span>}
      {part}
    </span>
  ))
}

export default function BrowseCardsMenu({ deckId, deckType, session, onAdded, onClose }) {
  const { t } = useLang()

  const SOURCE_TABS = [
    { key: 'kanji',   label: t.browseTabKanji },
    { key: 'vocab',   label: t.browseTabVocab },
    { key: 'grammar', label: t.browseTabGrammar },
  ]
  const allowedKeys = allowedSourcesFor(deckType)
  const tabs = SOURCE_TABS.filter(s => allowedKeys.includes(s.key))

  const [source, setSource]     = useState(() => tabs[0]?.key ?? allowedKeys[0] ?? 'kanji')
  const [level, setLevel]       = useState('')
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding]     = useState(false)

  // Selection is per (source, raw_id) — cleared whenever the source
  // tab changes, since raw ids from different sources aren't
  // comparable and a browse switch is a natural "start over" point.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- `selected` can't be moved to a key-remounted child without also threading `results`/`runSearch`/`deckId`/`session`/`onAdded` through it (addSelected and the header/footer both read/write `selected` alongside those), which would restructure this component for one 3-line reset; not a clean split.
  useEffect(() => { setSelected(new Set()) }, [source])

  const debounceRef = useRef(null)

  const runSearch = useCallback(() => {
    if (!source) return
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

  const sourceLabel = SOURCE_TABS.find(s => s.key === source)?.label ?? source

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <div className="import-header__title">{t.browseTitle}</div>
          <button onClick={onClose} className="import-header__close" aria-label={t.close}><CrossIcon size={16} /></button>
        </div>
        <div className="import-subtitle">{t.browseSubtitle}</div>

        {tabs.length > 1 ? (
          <div className="browse-source-tabs">
            {tabs.map(s => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={`browse-source-tab${source === s.key ? ' browse-source-tab--active' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          // A restricted-type deck (Kanji/Vocab/Grammar) has exactly
          // one possible source — nothing to choose, so the tab bar
          // is replaced by a plain note instead of a one-button row.
          <div className="browse-only-note">
            {t.browseOnlyAccepts.replace('{type}', sourceLabel)}
          </div>
        )}

        <div className="study-level-row browse-level-row">
          <button
            onClick={() => setLevel('')}
            className={`study-level-btn${level === '' ? ' study-level-btn--active' : ''}`}>
            {t.browseAllLevels}
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
          placeholder={t.browseSearchPlaceholder}
          className="deckdetail-form__input browse-search-input"
        />

        <div className="import-preview browse-results">
          <div className="import-preview__title">
            {selected.size > 0 ? t.browseSelectedCount.replace('{n}', selected.size) : t.browseResults}
          </div>

          {loading && <div className="import-preview__empty">{t.searching}</div>}

          {!loading && results.length === 0 && (
            <div className="import-preview__empty">{t.noResults}</div>
          )}

          {!loading && results.length > 0 && (
            <div className="import-preview__list browse-results__list">
              {results.map(r => {
                const isSel = selected.has(r.raw_id)
                return (
                  /* An entry, not five columns of flex fighting over the
                     width. The headword and its reading are ONE thing —
                     the reading belongs over/under the word it reads, the
                     way it does everywhere else in the app — so they
                     stack into a single column, and the meaning gets the
                     whole rest of the row instead of whatever a wrapped
                     reading column left it. The chevron that used to sit
                     between them is gone: it separated two things that
                     were already separated, and was the widest piece of
                     nothing in the row. */
                  <div
                    key={r.raw_id}
                    onClick={() => !r.in_deck && toggle(r.raw_id)}
                    className={`browse-result-row${r.in_deck ? ' browse-result-row--in-deck' : ' browse-result-row--selectable'}${isSel ? ' browse-result-row--selected' : ''}`}
                  >
                    <div className={`deckdetail-checkbox${isSel || r.in_deck ? ' deckdetail-checkbox--checked' : ''}`}>
                      {(isSel || r.in_deck) && <span className="deckdetail-checkbox__mark"><CheckIcon size={12} /></span>}
                    </div>

                    <div className="browse-result-row__entry">
                      <span className="browse-result-row__front" lang="ja">{r.front}</span>
                      {r.kana && r.kana !== r.front && (
                        <span className="browse-result-row__kana" lang="ja">
                          <DottedReadings text={r.kana} />
                        </span>
                      )}
                    </div>

                    <div className="browse-result-row__meaning">{r.meaning}</div>

                    {/* The level the entry is filed under — the same
                        thing the level row above filters on, so a result
                        says which of those buckets it came out of
                        instead of leaving "All" ambiguous. */}
                    {r.level && <span className="browse-result-row__level">{r.level}</span>}
                    {r.in_deck && <span className="browse-result-row__tag">{t.alreadyAdded}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="import-footer">
          <button onClick={onClose} className="import-footer__cancel">{t.close}</button>
          <button
            onClick={addSelected}
            disabled={selected.size === 0 || adding}
            className={`import-footer__submit${selected.size > 0 ? ' import-footer__submit--active' : ''}${adding ? ' import-footer__submit--importing' : ''}`}>
            {adding ? t.adding : t.addSelected.replace('{n}', selected.size)}
          </button>
        </div>
      </div>
    </div>
  )
}