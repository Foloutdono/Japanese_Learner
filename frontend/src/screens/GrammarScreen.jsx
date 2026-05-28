import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, api } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, DoneMessage, Loading } from '../components/QuizComponents'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const MODES = [
	{ key: 'flashcard', label: 'Flashcard',      desc: 'Voir la règle, révéler le sens' },
	{ key: 'mcq',       label: 'QCM',            desc: 'Choisir le bon sens parmi 4' },
	{ key: 'fill',      label: 'Compléter',       desc: 'Compléter la phrase avec la règle' },
]

export default function GrammarScreen({ session }) {
	const navigate      = useNavigate()
	const { t, lang }   = useLang()

	const [level, setLevel]           = useState(null)
	const [mode, setMode]             = useState(null)
	const [card, setCard]             = useState(null)
	const [loading, setLoading]       = useState(false)
	const [done, setDone]             = useState(false)
	const [flipped, setFlipped]       = useState(false)
	const [answered, setAnswered]     = useState(false)
	const [selected, setSelected]     = useState(null)
	const [showRating, setShowRating] = useState(false)
	const [showEx, setShowEx]         = useState(false)

	function fetchCard(lvl, m) {
		setLoading(true)
		setFlipped(false)
		setAnswered(false)
		setSelected(null)
		setShowRating(false)
		setShowEx(false)

		apiFetch(api(`/api/grammar/card?level=${lvl}&mode=${m}&lang=${lang}`), session)
			.then(r => r.json())
			.then(data => {
				if (data.done) { setDone(true); setCard(null) }
				else { setCard(data); setDone(false) }
				setLoading(false)
			})
	}

	function startSession(lvl, m) {
		setLevel(lvl)
		setMode(m)
		setDone(false)
		fetchCard(lvl, m)
	}

	function postReview(quality) {
		apiFetch(api('/api/grammar/review'), session, {
			method: 'POST',
			body: JSON.stringify({ card_id: card.card_id, mode, quality }),
		}).then(() => fetchCard(level, mode))
	}

	function onMCQAnswer(choice) {
		if (answered) return
		setSelected(choice)
		setAnswered(true)
		setShowRating(true)
	}

	function onFlashcardReveal() {
		setFlipped(true)
		setShowRating(true)
	}

	// ── Level selection ──
	if (!level) {
		return (
			<div style={{ minHeight: '100vh' }}>
				<TopBar onBack={() => navigate('/')} title="Grammaire JLPT" />
				<div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
					<div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
						Choisissez un niveau
					</div>
					<div className="grid-5" style={{ maxWidth: 600, margin: '0 auto' }}>
						{LEVELS.map(l => (
							<button key={l} onClick={() => setLevel(l)}
								style={{ background: 'var(--accent)', color: '#fff', fontSize: 20, fontWeight: 'bold', padding: '24px 0', width: '100%' }}>
								{l}
							</button>
						))}
					</div>
				</div>
			</div>
		)
	}

	// ── Mode selection ──
	if (!mode) {
		return (
			<div style={{ minHeight: '100vh' }}>
				<TopBar onBack={() => setLevel(null)} title={`Grammaire ${level}`} />
				<div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
					<div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
						Choisissez un mode
					</div>
					<div className="grid-3" style={{ maxWidth: 700, margin: '0 auto' }}>
						{MODES.map(m => (
							<button key={m.key} onClick={() => startSession(level, m.key)}
								style={{
									background: 'var(--bg-card)', color: 'var(--text-primary)',
									padding: '28px 20px', display: 'flex',
									flexDirection: 'column', alignItems: 'center', gap: 8,
								}}>
								<div style={{ fontSize: 16, fontWeight: 'bold' }}>{m.label}</div>
								<div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.desc}</div>
							</button>
						))}
					</div>
				</div>
			</div>
		)
	}

	// ── Quiz ──
	return (
		<div style={{ minHeight: '100vh' }}>
			<TopBar onBack={() => setMode(null)} title={`Grammaire ${level} — ${MODES.find(m => m.key === mode)?.label}`} />

			<div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
				{loading && <Loading />}
				{done    && <DoneMessage onBack={() => setMode(null)} />}

				{card && !loading && (
					<>
						{/* Grammar point card */}
						<div style={{
							background: 'var(--bg-card)', borderRadius: 12,
							padding: '40px 24px', marginBottom: 24,
						}}>
							<div style={{
								fontSize: 40, fontFamily: 'Yu Gothic, sans-serif',
								color: 'var(--accent)', marginBottom: 8,
							}}>
								{card.grammar}
							</div>

							{/* Flashcard mode — show meaning on flip */}
							{mode === 'flashcard' && !flipped && (
								<div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
									Quel est le sens de cette règle ?
								</div>
							)}
							{mode === 'flashcard' && flipped && (
								<div style={{ fontSize: 20, color: 'var(--success)', marginTop: 12 }}>
									{card.meaning}
								</div>
							)}

							{/* MCQ / Fill — always show grammar, hide meaning */}
							{mode !== 'flashcard' && (
								<div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
									{mode === 'mcq' ? 'Quel est le sens ?' : 'Complétez la phrase ci-dessous'}
								</div>
							)}
						</div>

						{/* Fill mode */}
						{mode === 'fill' && card.fill_example && (
							<div style={{
								background: 'var(--bg-card)', borderRadius: 10,
								padding: '20px 24px', marginBottom: 20, textAlign: 'left',
							}}>
								<div style={{ fontSize: 20, fontFamily: 'Yu Gothic, sans-serif', marginBottom: 8 }}>
									{answered ? card.fill_example.jp_full : card.fill_example.jp_blanked}
								</div>
								<div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
									{card.fill_example.en}
								</div>
								{answered && (
									<div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
										{card.fill_example.romaji}
									</div>
								)}
							</div>
						)}

						{/* Flashcard reveal button */}
						{mode === 'flashcard' && !flipped && (
							<button onClick={onFlashcardReveal}
								style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', width: '100%', fontSize: 16, padding: '16px' }}>
								Révéler le sens
							</button>
						)}

						{/* MCQ */}
						{mode === 'mcq' && (
							<MCQGrid
								choices={card.choices}
								correct={card.meaning}
								selected={selected}
								answered={answered}
								onAnswer={onMCQAnswer}
							/>
						)}

						{/* Fill reveal button */}
						{mode === 'fill' && !answered && (
							<button onClick={() => { setAnswered(true); setShowRating(true) }}
								style={{ background: 'var(--accent)', color: '#fff', width: '100%', fontSize: 15, padding: '14px' }}>
								Révéler la réponse
							</button>
						)}

						{/* Examples toggle */}
						{(flipped || answered) && card.examples?.length > 0 && (
							<div style={{ marginTop: 16 }}>
								<button onClick={() => setShowEx(e => !e)}
									style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 13 }}>
									{showEx ? '▲ Masquer les exemples' : '▼ Voir les exemples'}
								</button>
								{showEx && (
									<div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
										{card.examples.slice(0, 3).map((ex, i) => (
											<div key={i} style={{
												background: 'var(--bg-card)', borderRadius: 8,
												padding: '12px 16px', textAlign: 'left',
											}}>
												<div style={{ fontSize: 16, fontFamily: 'Yu Gothic, sans-serif', marginBottom: 4 }}>
													{ex.jp}
												</div>
												<div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
													{ex.romaji}
												</div>
												<div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
													{ex.en}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						<RatingBar active={showRating} onRate={postReview} />
					</>
				)}
			</div>
		</div>
	)
}