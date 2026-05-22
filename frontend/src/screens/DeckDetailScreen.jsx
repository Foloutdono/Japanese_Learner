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
	const [editing, setEditing]     = useState(null)
	const [form, setForm]           = useState({ front: '', back: '', hint: '', notes: '' })

	const [showImport, setShowImport]     = useState(false)
	const [importResult, setImportResult] = useState(null)

	const [selectMode, setSelectMode] = useState(false)
	const [selected, setSelected]     = useState(new Set())

	useEffect(() => { fetchCards() }, [])

	function fetchCards() {
		apiFetch(`/api/decks/${deck_id}/cards`, session)
			.then(r => r.json())
			.then(data => { setCards(data.cards || []); setLoading(false) })
	}

	function resetForm() {
		setForm({ front: '', back: '', hint: '', notes: '' })
	}

	function startAdd() {
		resetForm()
		setEditing(null)
		setAdding(true)
	}

	function startEdit(card) {
		setForm({
			front: card.front, back: card.back,
			hint: card.hint || '', notes: card.notes || '',
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
				})
		}
	}

	// ── Selection ─────────────────────────────────────────

	function toggleSelect(id) {
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	function toggleSelectAll() {
		if (selected.size === cards.length) setSelected(new Set())
		else setSelected(new Set(cards.map(c => c.id)))
	}

	function exitSelectMode() {
		setSelectMode(false)
		setSelected(new Set())
	}

	async function deleteSelected() {
		if (!confirm(`Supprimer ${selected.size} carte${selected.size !== 1 ? 's' : ''} ?`)) return
		for (const id of selected) {
			await apiFetch(`/api/decks/${deck_id}/cards/${id}`, session, { method: 'DELETE' })
		}
		setCards(prev => prev.filter(c => !selected.has(c.id)))
		exitSelectMode()
	}

	// ── Import ────────────────────────────────────────────

	async function handleImport(cards) {
		for (const card of cards) {
			await apiFetch(`/api/decks/${deck_id}/cards`, session, {
				method: 'POST',
				body: JSON.stringify({
					front: card.front,
					back:  card.back,
					hint:  card.hint  || '',
					notes: '',
				}),
			})
		}
		setImportResult({ inserted: cards.length })
		setShowImport(false)
		fetchCards()
	}

	return (
		<div style={{ minHeight: '100vh' }}>
			<TopBar onBack={() => navigate('/decks')} title={deck?.name ?? 'Deck'} />

			<div className="container" style={{ padding: '32px 24px' }}>

				{/* Header */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
					<div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
						{cards.length} carte{cards.length !== 1 ? 's' : ''}
					</div>

					{/* Normal mode buttons */}
					{!selectMode && (
						<div style={{ display: 'flex', gap: 8 }}>
							<button
								onClick={() => navigate(`/decks/${deck_id}/study`, { state: { deck } })}
								style={{ background: '#6c5ce7', color: '#fff', fontSize: 13 }}>
								▶ Étudier
							</button>
							<button
								onClick={startAdd}
								style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
								+ Ajouter
							</button>
                            {cards.length > 0 && (
								<button
									onClick={() => setSelectMode(true)}
									style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 13 }}>
									☑ Sélectionner
								</button>
							)}
							<button
								onClick={() => setShowImport(true)}
								style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
								📥 Importer
							</button>
						</div>
					)}

					{/* Selection mode buttons */}
					{selectMode && (
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
								{selected.size} sélectionnée{selected.size !== 1 ? 's' : ''}
							</span>
							<button
								onClick={toggleSelectAll}
								style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13 }}>
								{selected.size === cards.length ? 'Tout désélectionner' : 'Tout sélectionner'}
							</button>
							<button
								onClick={deleteSelected}
								disabled={selected.size === 0}
								style={{
									background: selected.size > 0 ? 'var(--danger)' : 'var(--bg-panel)',
									color: selected.size > 0 ? '#fff' : 'var(--text-secondary)',
									fontSize: 13,
									opacity: selected.size === 0 ? 0.5 : 1,
								}}>
								🗑 Supprimer ({selected.size})
							</button>
							<button
								onClick={exitSelectMode}
								style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 13 }}>
								✕ Annuler
							</button>
						</div>
					)}
				</div>

				{/* Import result */}
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
						{cards.map(card => {
							const isSelected = selected.has(card.id)
							return (
								<div
									key={card.id}
									className="card"
									onClick={selectMode ? () => toggleSelect(card.id) : undefined}
									style={{
										display: 'flex', alignItems: 'center', gap: 16,
										cursor: selectMode ? 'pointer' : 'default',
										borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
										background: isSelected ? 'var(--bg-panel)' : 'var(--bg-card)',
										transition: 'background 0.15s, border-color 0.15s',
									}}
								>
									{/* Checkbox */}
									{selectMode && (
										<div style={{
											width: 20, height: 20, borderRadius: 4, flexShrink: 0,
											border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
											background: isSelected ? 'var(--accent)' : 'transparent',
											display: 'flex', alignItems: 'center', justifyContent: 'center',
										}}>
											{isSelected && (
												<span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>
											)}
										</div>
									)}

									{/* Card content */}
									<div style={{ flex: 1 }}>
										<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
											<div>
												<div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 2 }}>Recto</div>
												<div style={{ fontSize: 20, fontFamily: 'Yu Gothic, sans-serif' }}>{card.front}</div>
											</div>
											<div>
												<div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 2 }}>Verso</div>
												<div style={{ fontSize: 20 }}>{card.back}</div>
											</div>
											{card.hint && (
												<div>
													<div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 2 }}>Indice</div>
													<div style={{ fontSize: 20, color: 'var(--warning)' }}>{card.hint}</div>
												</div>
											)}
											{card.notes && (
												<div>
													<div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 2 }}>Notes</div>
													<div style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{card.notes}</div>
												</div>
											)}
										</div>
									</div>

									{/* Edit button — hidden in select mode */}
									{!selectMode && (
										<button
											onClick={() => startEdit(card)}
											style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 13, padding: '6px 12px', flexShrink: 0 }}>
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
				<ImportCardsMenu
					onImport={handleImport}
					onClose={() => setShowImport(false)}
				/>
			)}
		</div>
	)
}