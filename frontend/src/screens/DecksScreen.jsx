import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { apiFetch } from '../api'

const DECK_TYPES = [
  { value: 'flashcard', label: 'Flashcard',  desc: 'Recto / Verso — toute langue', color: '#6c5ce7' },
  { value: 'vocab',     label: 'Vocabulaire', desc: 'Compatible mode JLPT',        color: '#4cc9f0' },
  { value: 'kanji',     label: 'Kanji',       desc: 'Avec ordre des traits',        color: '#e94560' },
]

function typeColor(type) {
  return DECK_TYPES.find(t => t.value === type)?.color ?? '#6c5ce7'
}

function typeLabel(type) {
  return DECK_TYPES.find(t => t.value === type)?.label ?? type
}

export default function DecksScreen({ session }) {
  const navigate = useNavigate()
  const [decks, setDecks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newType, setNewType]     = useState('flashcard')
  const [error, setError]         = useState(null)

  useEffect(() => { fetchDecks() }, [])

  function fetchDecks() {
    setLoading(true)
    apiFetch('/api/decks', session)
      .then(r => r.json())
      .then(data => { setDecks(data.decks || []); setLoading(false) })
  }

  function createDeck() {
    if (!newName.trim()) return
    apiFetch('/api/decks', session, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    })
      .then(r => r.json())
      .then(deck => {
        setDecks(prev => [{ ...deck, card_count: 0 }, ...prev])
        setNewName('')
        setCreating(false)
      })
  }

  function deleteDeck(id, name) {
    if (!confirm(`Supprimer le deck « ${name} » ? Cette action est irréversible.`)) return
    apiFetch(`/api/decks/${id}`, session, { method: 'DELETE' })
      .then(() => setDecks(prev => prev.filter(d => d.id !== id)))
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => navigate('/')} title="Mes Decks" />

      <div className="container" style={{ padding: '32px 24px' }}>

        {/* Create button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <button
            onClick={() => setCreating(c => !c)}
            style={{ background: '#6c5ce7', color: '#fff', fontSize: 14 }}
          >
            {creating ? '✕ Annuler' : '+ Nouveau deck'}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 16 }}>
              Nouveau deck
            </div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createDeck()}
              placeholder="Nom du deck..."
              autoFocus
              style={{ width: '100%', padding: '10px 14px', fontSize: 15, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {DECK_TYPES.map(t => (
                <button key={t.value} onClick={() => setNewType(t.value)}
                  style={{
                    background: newType === t.value ? t.color : 'var(--bg-panel)',
                    color: newType === t.value ? '#fff' : 'var(--text-secondary)',
                    fontSize: 13, padding: '8px 16px',
                  }}>
                  {t.label}
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{t.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={createDeck}
              style={{ background: '#6c5ce7', color: '#fff', width: '100%' }}>
              Créer
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
            Chargement...
          </div>
        )}

        {!loading && decks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div>Aucun deck pour l'instant.</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Créez votre premier deck ci-dessus.</div>
          </div>
        )}

        {/* Deck grid */}
        {!loading && decks.length > 0 && (
          <div className="grid-3">
            {decks.map(deck => (
              <div key={deck.id} className="card" style={{
                borderLeft: `4px solid ${typeColor(deck.type)}`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 'bold' }}>{deck.name}</div>
                    <div style={{ fontSize: 11, color: typeColor(deck.type), marginTop: 2 }}>
                      {typeLabel(deck.type)}
                    </div>
                  </div>
                  <button onClick={() => deleteDeck(deck.id, deck.name)}
                    style={{ background: 'transparent', color: 'var(--danger)', fontSize: 16, padding: '4px 8px' }}>
                    🗑
                  </button>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {deck.card_count} carte{deck.card_count !== 1 ? 's' : ''}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    onClick={() => navigate(`/decks/${deck.id}`, { state: { deck } })}
                    style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', flex: 1, fontSize: 13 }}>
                    ✏️ Éditer
                  </button>
                  <button
                    onClick={() => navigate(`/decks/${deck.id}/study`, { state: { deck } })}
                    style={{ background: typeColor(deck.type), color: '#fff', flex: 1, fontSize: 13 }}>
                    ▶ Étudier
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