import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'

const API_BASE = import.meta.env.VITE_API_URL || ''
const LIMIT = 50

const STATUS_META = {
	new:      { color: 'var(--text-secondary)', fallback: 'À apprendre' },
	learning: { color: 'var(--accent)',         fallback: 'En cours' },
	mastered: { color: 'var(--success)',        fallback: 'Maîtrisé' },
}

const TYPE_META = {
	kanji: { color: '#3B82F6', fallback: 'Kanji' },
	vocab: { color: '#10B981', fallback: 'Vocabulaire' },
}

// Kanji and vocab entries can share the same character (a one-kanji word),
// so the character alone isn't a safe React key / selection identity.
function entryKey(entry) {
	return `${entry.type}:${entry.level}:${entry.kanji || entry.kana}`
}

function StatusBadge({ state, t }) {
	const meta = STATUS_META[state] ?? STATUS_META.new
	return (
		<span style={{
			display: 'inline-flex', alignItems: 'center', gap: 4,
			fontSize: 11, color: 'var(--text-secondary)',
		}}>
			<span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
			{t?.[`status_${state}`] ?? meta.fallback}
		</span>
	)
}

function TypeBadge({ type, t }) {
	const meta = TYPE_META[type] ?? TYPE_META.kanji
	return (
		<span style={{
			display: 'inline-flex', alignItems: 'center',
			padding: '2px 8px', borderRadius: 999,
			background: meta.color, color: '#fff',
			fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
			textTransform: 'uppercase',
		}}>
			{type === 'kanji' ? (t?.dictKanji ?? 'Kanji') : (t?.dictVocab ?? 'Vocabulaire')}
		</span>
	)
}

function speakJapanese(text) {
	if (!text) return
	window.speechSynthesis.cancel()
	const u = new SpeechSynthesisUtterance(text)
	u.lang = 'ja-JP'
	u.rate = 0.8
	window.speechSynthesis.speak(u)
}

export default function DictionaryScreen({ session }) {
	const { t, lang } = useLang()
	const navigate            = useNavigate()

	const [mode, setMode]             = useState('search') // 'search' | 'radical'
	const [query, setQuery]           = useState('')
	const [category, setCategory]     = useState('all') // 'all' | 'kanji' | 'vocab'
	const [results, setResults]       = useState([])
	const [loading, setLoading]       = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [page, setPage]             = useState(0)
	const [hasMore, setHasMore]       = useState(true)
	const [total, setTotal]           = useState(0)
	const [selected, setSelected]     = useState(null)
	const [isMobile, setIsMobile]     = useState(window.innerWidth <= 768)

	// Radical browsing
	const [radicalGroups, setRadicalGroups]     = useState(null)
	const [loadingRadicals, setLoadingRadicals] = useState(false)
	const [selectedRadical, setSelectedRadical] = useState(null) // number | null

	const debounceRef = useRef(null)
	const observerRef = useRef(null)
	const sentinelRef = useRef(null)

	const radicalCharByNumber = useMemo(() => {
		const map = {}
		;(radicalGroups || []).forEach(g => g.radicals.forEach(r => { map[r.number] = r.char }))
		return map
	}, [radicalGroups])

	useEffect(() => {
		fetchPage(0, '', category, null)
		loadRadicalGrid()
	}, [])

	useEffect(() => {
		if (observerRef.current) observerRef.current.disconnect()
		observerRef.current = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
				loadMore()
			}
		}, { threshold: 0.1 })
		if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
		return () => observerRef.current?.disconnect()
	}, [hasMore, loadingMore, loading, page, query, category, selectedRadical])

	useEffect(() => {
		const handler = () => setIsMobile(window.innerWidth <= 768)
		handler()
		window.addEventListener('resize', handler)
		return () => window.removeEventListener('resize', handler)
	}, [])

	function fetchPage(p, q, cat, rad) {
		if (p === 0) setLoading(true)
		else setLoadingMore(true)

		const params = new URLSearchParams({ q, page: p, limit: LIMIT, lang, category: cat })
		if (rad != null) params.set('radical', rad)

		apiFetch(`/api/dictionary?${params.toString()}`, session)
			.then(r => r.json())
			.then(data => {
				if (p === 0) setResults(data.results || [])
				else setResults(prev => [...prev, ...(data.results || [])])
				setTotal(data.total)
				setHasMore(data.has_more)
				setPage(p)
				setLoading(false)
				setLoadingMore(false)
			})
	}

	function loadRadicalGrid() {
		setLoadingRadicals(true)
		apiFetch('/api/dictionary/radicals', session)
			.then(r => r.json())
			.then(data => { setRadicalGroups(data.groups || []); setLoadingRadicals(false) })
			.catch(() => setLoadingRadicals(false))
	}

	function onSearch(e) {
		const q = e.target.value
		setQuery(q)
		setSelected(null)
		setPage(0)
		setHasMore(true)
		clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			if (mode === 'radical') {
				if (selectedRadical != null) fetchPage(0, q, 'kanji', selectedRadical)
			} else {
				fetchPage(0, q, category, null)
			}
		}, 300)
	}

	function switchCategory(cat) {
		if (cat === category) return
		setCategory(cat)
		setSelected(null)
		setPage(0)
		setHasMore(true)
		fetchPage(0, query, cat, null)
	}

	function switchToSearchMode() {
		if (mode === 'search') return
		setMode('search')
		setSelectedRadical(null)
		setSelected(null)
		setQuery('')
		setPage(0)
		setHasMore(true)
		fetchPage(0, '', category, null)
	}

	function switchToRadicalMode() {
		if (mode === 'radical') return
		setMode('radical')
		setSelectedRadical(null)
		setSelected(null)
		setResults([])
		if (!radicalGroups) loadRadicalGrid()
	}

	function pickRadical(number) {
		setSelectedRadical(number)
		setSelected(null)
		setQuery('')
		setPage(0)
		setHasMore(true)
		fetchPage(0, '', 'kanji', number)
	}

	function backToRadicalGrid() {
		setSelectedRadical(null)
		setSelected(null)
		setResults([])
	}

	// Jump straight to a radical's results from the detail panel, even if
	// the picker grid itself was never opened this session.
	function jumpToRadical(number) {
		setMode('radical')
		setSelectedRadical(number)
		setSelected(null)
		setQuery('')
		setPage(0)
		setHasMore(true)
		fetchPage(0, '', 'kanji', number)
	}

	function loadMore() {
		fetchPage(page + 1, query, category, selectedRadical)
	}

	const showingRadicalGrid = mode === 'radical' && selectedRadical == null

	return (
		<div style={{ minHeight: '100vh' }}>
			<TopBar onBack={() => navigate('/')} title={t.dictionaryTitle ?? 'Dictionnaire'} />

			<div className="container" style={{ padding: '24px' }}>

				{/* Mode tabs */}
				<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
					{[
						['search',  t.dictModeSearch  ?? 'Recherche'],
						['radical', t.dictModeRadical ?? 'Par radical'],
					].map(([key, label]) => (
						<button
							key={key}
							onClick={() => key === 'radical' ? switchToRadicalMode() : switchToSearchMode()}
							style={{
								background: mode === key ? 'var(--accent)' : 'var(--bg-card)',
								color: 'var(--text-primary)',
								fontSize: 13,
								padding: '8px 16px',
							}}
						>
							{label}
						</button>
					))}
				</div>

				{/* Search bar + count — hidden while browsing the plain radical grid,
				    shown again once a radical is picked (to narrow further) */}
				{!showingRadicalGrid && (
					<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
						<input
							value={query}
							onChange={onSearch}
							placeholder={
								mode === 'radical'
									? (t.dictionaryPlaceholderRadical ?? 'Filtrer ces résultats...')
									: (t.dictionaryPlaceholder ?? 'Rechercher kanji, kana, ou sens...')
							}
							autoFocus={mode === 'search'}
							style={{ flex: 1, padding: '14px 20px', fontSize: 16 }}
						/>
						{!loading && (
							<div style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
								{total} {t.dictionaryResults ?? 'résultats'}
							</div>
						)}
					</div>
				)}

				{/* Category filter — only meaningful in plain search mode */}
				{mode === 'search' && (
					<div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
						{[
							['all',   t.dictAll   ?? 'Tout'],
							['kanji', t.dictKanji ?? 'Kanji'],
							['vocab', t.dictVocab ?? 'Vocabulaire'],
						].map(([key, label]) => (
							<button
								key={key}
								onClick={() => switchCategory(key)}
								style={{
									background: category === key ? 'var(--accent)' : 'var(--bg-card)',
									color: 'var(--text-primary)',
									fontSize: 13,
									padding: '8px 16px',
								}}
							>
								{label}
							</button>
						))}
					</div>
				)}

				{/* Selected-radical header */}
				{mode === 'radical' && selectedRadical != null && (
					<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
						<button
							onClick={backToRadicalGrid}
							style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 14px' }}
						>
							← {t.dictBackToRadicals ?? 'Radicaux'}
						</button>
						<div style={{
							fontSize: 28, fontFamily: 'Yu Gothic, sans-serif', color: '#fff',
							background: 'var(--bg-card)', borderRadius: 8, padding: '4px 14px',
						}}>
							{radicalCharByNumber[selectedRadical] ?? '?'}
						</div>
						<span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
							{t.dictRadicalNumber ? t.dictRadicalNumber(selectedRadical) : `radical #${selectedRadical}`}
						</span>
					</div>
				)}

				{/* Radical picker grid */}
				{showingRadicalGrid && (
					<RadicalGrid
						groups={radicalGroups}
						loading={loadingRadicals}
						onPick={pickRadical}
						t={t}
					/>
				)}

				{/* Results (search mode, or a radical's kanji) */}
				{!showingRadicalGrid && (
					<ResultsSection
						loading={loading}
						loadingMore={loadingMore}
						hasMore={hasMore}
						results={results}
						total={total}
						query={query}
						selected={selected}
						setSelected={setSelected}
						isMobile={isMobile}
						sentinelRef={sentinelRef}
						onRadicalClick={jumpToRadical}
						t={t}
					/>
				)}
			</div>
		</div>
	)
}

// ── Radical picker grid ─────────────────────────────────────

function RadicalGrid({ groups, loading, onPick, t }) {
	if (loading || !groups) {
		return (
			<div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
				{t.loadingDictionary ?? 'Chargement...'}
			</div>
		)
	}

	return (
		<div>
			{groups.map(group => (
				<div key={group.stroke_count} style={{ marginBottom: 24 }}>
					<div style={{
						fontSize: 12, color: 'var(--text-secondary)', fontWeight: 'bold',
						marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase',
					}}>
						{group.stroke_count} {group.stroke_count > 1
							? (t.dictStrokesPlural ?? 'traits')
							: (t.dictStrokeSingular ?? 'trait')}
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
						{group.radicals.map(r => (
							<button
								key={r.number}
								onClick={() => onPick(r.number)}
								title={`${r.kanji_count} kanji`}
								style={{
									width: 56, height: 56, padding: 0,
									background: 'var(--bg-card)', color: '#fff',
									border: '1px solid var(--border)', borderRadius: 10,
									display: 'flex', flexDirection: 'column',
									alignItems: 'center', justifyContent: 'center',
									cursor: 'pointer',
								}}
							>
								<span style={{ fontSize: 26, fontFamily: 'Yu Gothic, sans-serif', lineHeight: 1 }}>
									{r.char}
								</span>
								<span style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 3 }}>
									{r.kanji_count}
								</span>
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

// ── Results grid + detail panel (shared by search mode and radical results) ──

function shortMeaning(meaning) {
	return meaning?.split(';')[0] ?? ''
}

function shortKana(kana, type) {
	if (!kana) return ''
	const firstKana = kana.split(';')[0].trim()
	return type === 'vocab' ? firstKana : Array.from(firstKana).slice(0, 3).join('')
}

function ResultsSection({
	loading, loadingMore, hasMore, results, total, query,
	selected, setSelected, isMobile, sentinelRef, onRadicalClick, t,
}) {
	return (
		<>
			{loading && (
				<div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
					{t.loadingDictionary ?? 'Chargement...'}
				</div>
			)}

			{!loading && results.length === 0 && (
				<div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
					{t.noResults ?? `Aucun résultat pour « ${query} »`}
				</div>
			)}

			{!loading && results.length > 0 && (
				<div className="dict-layout">

					{/* Grid */}
					<div style={{ flex: 1 }}>
						<div style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
							gap: 12,
						}}>
							{results.map(entry => (
								<div
									key={entryKey(entry)}
									onClick={() => setSelected(entry)}
									style={{
										background: selected && entryKey(selected) === entryKey(entry) ? 'var(--bg-panel)' : 'var(--bg-card)',
										borderRadius: 10,
										padding: '16px 10px',
										textAlign: 'center',
										cursor: 'pointer',
										border: selected && entryKey(selected) === entryKey(entry)
											? '1px solid var(--accent)'
											: '1px solid var(--border)',
										transition: 'background 0.15s',
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: 4,
									}}
									onMouseEnter={e => {
										if (!(selected && entryKey(selected) === entryKey(entry)))
											e.currentTarget.style.background = 'var(--bg-panel)'
									}}
									onMouseLeave={e => {
										if (!(selected && entryKey(selected) === entryKey(entry)))
											e.currentTarget.style.background = 'var(--bg-card)'
									}}
								>
									<TypeBadge type={entry.type} t={t} />
									<div style={{ fontSize: 40, fontFamily: 'Yu Gothic, sans-serif', color: '#fff', lineHeight: 1, marginTop: 4 }}>
										{entry.kanji || entry.kana}
									</div>
									<div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
										{shortKana(entry.kana, entry.type)}
									</div>
									<div style={{ fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
										{shortMeaning(entry.meaning)}
									</div>
									<div style={{ fontSize: 15, color: 'var(--accent2)', fontWeight: 'bold' }}>
										{entry.level}
									</div>
									<StatusBadge state={entry.status?.state ?? 'new'} t={t} />
								</div>
							))}
						</div>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							{loadingMore && (
								<div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
									{t.loadingMore ?? 'Chargement...'}
								</div>
							)}
							{!hasMore && results.length > 0 && (
								<div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
									{t.displayedKanji ?? `${total} résultats affichés`}
								</div>
							)}
						</div>
					</div>

					{/* Desktop side panel — hidden on mobile via CSS */}
					{selected && (
						<div className="dict-panel">
							<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} />
						</div>
					)}
				</div>
			)}

			{/* Mobile modal */}
			{selected && isMobile && (
				<div
					onClick={() => setSelected(null)}
					style={{
						position: 'fixed', inset: 0, zIndex: 200,
						background: 'rgba(0,0,0,0.6)',
						display: 'flex', alignItems: 'center', justifyContent: 'center',
						padding: 24,
					}}
				>
					<div
						onClick={e => e.stopPropagation()}
						style={{
							background: 'var(--bg-card)', borderRadius: 16,
							width: '100%', maxWidth: 400,
							maxHeight: '85vh', overflowY: 'auto',
							padding: 24,
						}}
					>
						<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} />
					</div>
				</div>
			)}
		</>
	)
}

// ── Detail panel ──────────────────────────────────────────

function DetailPanel({ entry, onClose, onRadicalClick }) {
	const { t, lang, contentMaps } = useLang()
	const map = entry.type === 'vocab' ? contentMaps?.vocab : contentMaps?.kanji
	const meaning = lang === 'fr'
		? (map?.[entry.kanji || entry.kana] ?? entry.meaning)
		: entry.meaning

	return (
		<>
			<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
				<TypeBadge type={entry.type} t={t} />
				<StatusBadge state={entry.status?.state ?? 'new'} t={t} />
			</div>

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
				<div style={{ fontSize: 80, fontFamily: 'Yu Gothic, sans-serif', color: '#fff', lineHeight: 1 }}>
					{entry.kanji || entry.kana}
				</div>
				<button
					onClick={() => speakJapanese(entry.kana)}
					style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 24, padding: '12px 16px', borderRadius: 10 }}
					title={t.listen ?? 'Écouter'}
				>
					🔊
				</button>
			</div>

			<InfoRow label={t.reading ?? 'Lecture'} value={entry.kana} />
			<InfoRow label={t.meaning  ?? 'Sens'}    value={meaning} />
			<InfoRow label={t.level    ?? 'Niveau'}  value={entry.level} />
			{entry.stroke_count && (
				<InfoRow label={t.strokes ?? 'Traits'} value={`${entry.stroke_count} ${t.strokes ?? 'traits'}`} />
			)}
			{entry.type === 'kanji' && entry.radical != null && (
				<InfoRow
					label={t.radical ?? 'Radical'}
					value={
						<button
							onClick={() => onRadicalClick?.(entry.radical)}
							style={{
								background: 'transparent', color: 'var(--accent)',
								padding: 0, fontSize: 14, textDecoration: 'underline',
							}}
						>
							#{entry.radical}
						</button>
					}
				/>
			)}

			{entry.type === 'kanji' && entry.svg_url && (
				<div style={{ marginTop: 20 }}>
					<div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 'bold', letterSpacing: 1 }}>
						{t.strokeOrder ?? 'ORDRE DES TRAITS'}
					</div>
					<div style={{ background: '#fff', borderRadius: 8, padding: 8, width: '100%' }}>
						<img
							src={`${API_BASE}${entry.svg_url}`}
							alt={`Stroke order ${entry.kanji}`}
							style={{ width: '100%', display: 'block' }}
							onError={e => {
								e.target.style.display = 'none'
								e.target.nextSibling.style.display = 'block'
							}}
						/>
						<div style={{ display: 'none', color: '#999', fontSize: 12, textAlign: 'center', padding: 8 }}>
							{t.notAvailable ?? 'Non disponible'}
						</div>
					</div>
				</div>
			)}

			<button
				onClick={onClose}
				style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', width: '100%', marginTop: 16, fontSize: 13 }}
			>
				{t.close ?? 'Fermer'}
			</button>
		</>
	)
}

// ── Info row ──────────────────────────────────────────────

function InfoRow({ label, value }) {
	return (
		<div style={{
			display: 'flex', justifyContent: 'space-between',
			alignItems: 'flex-start',
			padding: '8px 0',
			borderBottom: '1px solid var(--border)',
			gap: 12,
		}}>
			<span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
				{label}
			</span>
			<span style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'right' }}>
				{value}
			</span>
		</div>
	)
}