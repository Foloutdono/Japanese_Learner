import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { apiFetch } from '../api'

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
            <button onClick={startAdd}
              style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
              + Ajouter une carte
            </button>
          </div>
        </div>

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
    </div>
  )
}