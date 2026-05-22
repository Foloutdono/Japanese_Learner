import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { apiFetch } from '../api'
import ImportCardsMenu from '../components/ImportCardsMenu'


export default function DeckDetailScreen({ session }) {
    const navigate          = useNavigate()
    const { deck_id }       = useParams()
    const { state }         = useLocation()
    const deck              = state?.deck

    const [cards, setCards]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [adding, setAdding]       = useState(false)
    const [editing, setEditing]     = useState(null) // card id being edited
    const [form, setForm]           = useState({ front: '', back: '', kana: '', hint: '', notes: '' })

    const [showImport, setShowImport]     = useState(false)
    const [importText, setImportText]     = useState('')
    const [termSep, setTermSep]           = useState('tab')
    const [cardSep, setCardSep]           = useState('newline')
    const [customTerm, setCustomTerm]     = useState('')
    const [customCard, setCustomCard]     = useState('')
    const [importPreview, setImportPreview] = useState([])
    const [importing, setImporting]       = useState(false)
    const [importResult, setImportResult] = useState(null)

    useEffect(() => { fetchCards() }, [])

    function fetchCards() {
        apiFetch(`/api/decks/${deck_id}/cards`, session)
        .then(r => r.json())
        .then(data => { setCards(data.cards || []); setLoading(false) })
    }

    function resetForm() {
        setForm({ front: '', back: '', kana: '', hint: '', notes: '' })
    }

    function startAdd() {
        resetForm()
        setEditing(null)
        setAdding(true)
    }

    function startEdit(card) {
        setForm({
        front: card.front, back: card.back,
        kana: card.kana || '', hint: card.hint || '', notes: card.notes || '',
        })
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
            .then(card => {
            setCards(prev => [...prev, card])
            resetForm()
            // keep form open for rapid entry
            })
        }
    }

    function deleteCard(id) {
        if (!confirm('Supprimer cette carte ?')) return
        apiFetch(`/api/decks/${deck_id}/cards/${id}`, session, { method: 'DELETE' })
        .then(() => setCards(prev => prev.filter(c => c.id !== id)))
    }

    function getTermSep() {
    if (termSep === 'tab')    return '\t'
    if (termSep === 'comma')  return ','
    if (termSep === 'custom') return customTerm
    return '\t'
    }

    function getCardSep() {
    if (cardSep === 'newline')    return '\n'
    if (cardSep === 'semicolon')  return ';'
    if (cardSep === 'custom')     return customCard
    return '\n'
    }

    function parseImportText(text) {
    const ts = getTermSep()
    const cs = getCardSep()
    if (!text.trim() || !ts) return []
    return text
        .split(cs)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const parts = line.split(ts)
        return {
            front: parts[0]?.trim() ?? '',
            back:  parts[1]?.trim() ?? '',
            kana:  parts[2]?.trim() ?? '',
            hint:  parts[3]?.trim() ?? '',
        }
        })
        .filter(c => c.front && c.back)
    }

    useEffect(() => {
    setImportPreview(parseImportText(importText))
    }, [importText, termSep, cardSep, customTerm, customCard])

    async function doImport() {
    const cards = parseImportText(importText)
    if (cards.length === 0) return
    setImporting(true)

    let inserted = 0
    for (const card of cards) {
        await apiFetch(`/api/decks/${deck_id}/cards`, session, {
        method: 'POST',
        body: JSON.stringify({
            front: card.front,
            back:  card.back,
            kana:  card.kana  || '',
            hint:  card.hint  || '',
            notes: '',
        }),
        })
        inserted++
    }

    setImporting(false)
    setShowImport(false)
    setImportText('')
    setImportResult({ inserted })
    fetchCards()
    }

    const isVocabOrKanji = deck?.type === 'vocab' || deck?.type === 'kanji'

    return (
        <div style={{ minHeight: '100vh' }}>
            <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? 'Deck'} />

            <div className="container" style={{ padding: '32px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {cards.length} carte{cards.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => navigate(`/decks/${deck_id}/study`, { state: { deck } })}
                            style={{ background: '#6c5ce7', color: '#fff', fontSize: 13 }}>
                            ▶ Étudier
                        </button>
                        <button 
                            onClick={startAdd}
                            style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
                            + Ajouter une carte
                        </button>
                        <button
                            onClick={() => setShowImport(true)}
                            style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
                            📥 Importer
                        </button>
                    </div>
                </div>

                {importResult && (
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px',
                        marginBottom: 16, borderLeft: '4px solid var(--success)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div style={{ color: 'var(--success)', fontSize: 14 }}>
                        ✅ {importResult.inserted} carte{importResult.inserted !== 1 ? 's' : ''} importée{importResult.inserted !== 1 ? 's' : ''}
                        </div>
                        <button onClick={() => setImportResult(null)}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, padding: 0 }}>
                        ✕
                        </button>
                    </div>
                )}

                <details style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 12 }}>
                    <summary style={{ cursor: 'pointer' }}>Format CSV attendu</summary>
                    <pre style={{
                        background: 'var(--bg-card)', padding: 12, borderRadius: 6,
                        marginTop: 8, overflowX: 'auto', fontSize: 11,
                    }}>
                        {deck?.type === 'flashcard'
                        ? 'front,back,hint,notes\n犬,dog,,animal commun\n猫,cat,félin,'
                        : 'front,back,kana,hint,notes\n犬,dog,いぬ,,\n猫,cat,ねこ,,félin'}
                    </pre>
                </details>

                {/* Add / Edit form */}
                {adding && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 16 }}>
                    {editing ? 'Modifier la carte' : 'Nouvelle carte'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input value={form.front} onChange={e => setForm(f => ({ ...f, front: e.target.value }))}
                        placeholder={deck?.type === 'kanji' ? 'Kanji (ex: 日)' : 'Recto'}
                        style={{ padding: '10px 14px', fontSize: 15 }} />
                    <input value={form.back} onChange={e => setForm(f => ({ ...f, back: e.target.value }))}
                        placeholder="Verso / Sens"
                        style={{ padding: '10px 14px', fontSize: 15 }} />
                    {isVocabOrKanji && (
                        <input value={form.kana} onChange={e => setForm(f => ({ ...f, kana: e.target.value }))}
                        placeholder="Lecture en kana (optionnel)"
                        style={{ padding: '10px 14px', fontSize: 15 }} />
                    )}
                    <input value={form.hint} onChange={e => setForm(f => ({ ...f, hint: e.target.value }))}
                        placeholder="Indice (optionnel)"
                        style={{ padding: '10px 14px', fontSize: 15 }} />
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Notes (optionnel)"
                        onKeyDown={e => e.key === 'Enter' && saveCard()}
                        style={{ padding: '10px 14px', fontSize: 15 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={saveCard}
                        style={{ background: '#6c5ce7', color: '#fff', flex: 1 }}>
                        {editing ? '✓ Enregistrer' : '+ Ajouter'}
                    </button>
                    <button onClick={() => { setAdding(false); setEditing(null); resetForm() }}
                        style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', flex: 1 }}>
                        Annuler
                    </button>
                    </div>
                </div>
                )}

                {loading && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
                    Chargement...
                </div>
                )}

                {!loading && cards.length === 0 && !adding && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
                    <div>Aucune carte dans ce deck.</div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>Ajoutez votre première carte ci-dessus.</div>
                </div>
                )}

                {/* Cards list */}
                {!loading && cards.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cards.map(card => (
                    <div key={card.id} className="card" style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                        <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Recto</div>
                            <div style={{ fontSize: 18, fontFamily: 'Yu Gothic, sans-serif' }}>{card.front}</div>
                            </div>
                            <div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Verso</div>
                            <div style={{ fontSize: 15 }}>{card.back}</div>
                            </div>
                            {card.kana && (
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Kana</div>
                                <div style={{ fontSize: 15 }}>{card.kana}</div>
                            </div>
                            )}
                            {card.hint && (
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Indice</div>
                                <div style={{ fontSize: 13, color: 'var(--warning)' }}>{card.hint}</div>
                            </div>
                            )}
                        </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => startEdit(card)}
                            style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13, padding: '6px 12px' }}>
                            ✏️
                        </button>
                        <button onClick={() => deleteCard(card.id)}
                            style={{ background: 'transparent', color: 'var(--danger)', fontSize: 16, padding: '6px 12px' }}>
                            🗑
                        </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </div>
            {showImport && (
                <ImportCardsMenu
                    importText={importText}
                    setImportText={setImportText}
                    termSep={termSep}
                    setTermSep={setTermSep}
                    customTerm={customTerm}
                    setCustomTerm={setCustomTerm}
                    cardSep={cardSep}
                    setCardSep={setCardSep}
                    customCard={customCard}
                    setCustomCard={setCustomCard}
                    importPreview={importPreview}
                    setImportPreview={setImportPreview}
                    importing={importing}
                    setImporting={setImporting}
                    doImport={doImport}
                    setShowImport={setShowImport}
                />
            )}
        </div>
    )
}