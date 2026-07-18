import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { Readings } from '../components/QuizComponents'

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
		<span className="status-badge">
			<span className="status-badge__dot" style={{ '--dot-color': meta.color }} />
			{t?.[`status_${state}`] ?? meta.fallback}
		</span>
	)
}

function TypeBadge({ type, t }) {
	const meta = TYPE_META[type] ?? TYPE_META.kanji
	return (
		<span className="dict-type-pill" style={{ '--pill-color': meta.color }}>
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
		<div className="screen">
			<TopBar onBack={() => navigate('/')} title={t.dictionaryTitle ?? 'Dictionnaire'} />

			<div className="container dict-page">

				{/* Mode tabs */}
				<div className="dict-tab-row">
					{[
						['search',  t.dictModeSearch  ?? 'Recherche'],
						['radical', t.dictModeRadical ?? 'Par radical'],
					].map(([key, label]) => (
						<button
							key={key}
							onClick={() => key === 'radical' ? switchToRadicalMode() : switchToSearchMode()}
							className={`dict-tab-btn${mode === key ? ' dict-tab-btn--active' : ''}`}
						>
							{label}
						</button>
					))}
				</div>

				{/* Search bar + count — hidden while browsing the plain radical grid,
				    shown again once a radical is picked (to narrow further) */}
				{!showingRadicalGrid && (
					<div className="dict-search-row">
						<input
							value={query}
							onChange={onSearch}
							placeholder={
								mode === 'radical'
									? (t.dictionaryPlaceholderRadical ?? 'Filtrer ces résultats...')
									: (t.dictionaryPlaceholder ?? 'Rechercher kanji, kana, ou sens...')
							}
							autoFocus={mode === 'search'}
							className="dict-search-input"
						/>
						{!loading && (
							<div className="dict-search-count">
								{total} {t.dictionaryResults ?? 'résultats'}
							</div>
						)}
					</div>
				)}

				{/* Category filter — only meaningful in plain search mode */}
				{mode === 'search' && (
					<div className="dict-tab-row dict-tab-row--category">
						{[
							['all',   t.dictAll   ?? 'Tout'],
							['kanji', t.dictKanji ?? 'Kanji'],
							['vocab', t.dictVocab ?? 'Vocabulaire'],
						].map(([key, label]) => (
							<button
								key={key}
								onClick={() => switchCategory(key)}
								className={`dict-tab-btn${category === key ? ' dict-tab-btn--active' : ''}`}
							>
								{label}
							</button>
						))}
					</div>
				)}

				{/* Selected-radical header */}
				{mode === 'radical' && selectedRadical != null && (
					<div className="dict-radical-header">
						<button
							onClick={backToRadicalGrid}
							className="dict-radical-back-btn"
						>
							{t.dictBackToRadicals ?? 'Radicaux'}
						</button>
						<div className="dict-radical-char">
							{radicalCharByNumber[selectedRadical] ?? '?'}
						</div>
						<span className="dict-radical-label">
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
			<div className="quiz-loading">
				{t.loadingDictionary ?? 'Chargement...'}
			</div>
		)
	}

	return (
		<div>
			{groups.map(group => (
				<div key={group.stroke_count} className="dict-radical-group">
					<div className="dict-radical-group__label">
						{group.stroke_count} {group.stroke_count > 1
							? (t.dictStrokesPlural ?? 'traits')
							: (t.dictStrokeSingular ?? 'trait')}
					</div>
					<div className="dict-radical-group__list">
						{group.radicals.map(r => (
							<button
								key={r.number}
								onClick={() => onPick(r.number)}
								title={`${r.kanji_count} kanji`}
								className="dict-radical-btn"
							>
								<span className="dict-radical-btn__char">
									{r.char}
								</span>
								<span className="dict-radical-btn__count">
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
				<div className="quiz-loading">
					{t.loadingDictionary ?? 'Chargement...'}
				</div>
			)}

			{!loading && results.length === 0 && (
				<div className="quiz-loading">
					{t.noResults ?? `Aucun résultat pour « ${query} »`}
				</div>
			)}

			{!loading && results.length > 0 && (
				<div className="dict-layout">

					{/* Grid */}
					<div className="dict-results-wrap">
						<div className="dict-results-grid">
							{results.map(entry => (
								<div
									key={entryKey(entry)}
									onClick={() => setSelected(entry)}
									className={`dict-entry-card${selected && entryKey(selected) === entryKey(entry) ? ' dict-entry-card--selected' : ''}`}
								>
									<TypeBadge type={entry.type} t={t} />
									<div className="dict-entry-card__char">
										{entry.kanji || entry.kana}
									</div>
									<div className="dict-entry-card__kana">
										{shortKana(entry.kana, entry.type)}
									</div>
									<div className="dict-entry-card__meaning">
										{shortMeaning(entry.meaning)}
									</div>
									<div className="dict-entry-card__level">
										{entry.level}
									</div>
									<StatusBadge state={entry.status?.state ?? 'new'} t={t} />
								</div>
							))}
						</div>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} className="dict-sentinel">
							{loadingMore && (
								<div className="dict-sentinel__text">
									{t.loadingMore ?? 'Chargement...'}
								</div>
							)}
							{!hasMore && results.length > 0 && (
								<div className="dict-sentinel__text">
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
					className="dict-modal-overlay"
				>
					<div
						onClick={e => e.stopPropagation()}
						className="dict-modal-content"
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
			<div className="dict-detail__badges">
				<TypeBadge type={entry.type} t={t} />
				<StatusBadge state={entry.status?.state ?? 'new'} t={t} />
			</div>

			<div className="dict-detail__header">
				<div className="dict-detail__char">
					{entry.kanji || entry.kana}
				</div>
				<button
					onClick={() => speakJapanese(entry.kana)}
					className="dict-detail__speak-btn"
					title={t.listen ?? 'Écouter'}
				>
					🔊
				</button>
			</div>

			{entry.type === 'kanji'
				? (
					<div className="dict-detail__readings">
						<Readings
							kana={entry.kana}
							onLabel={t.onyomi ?? "Lectures on'yomi (sino-japonaises)"}
							kunLabel={t.kunyomi ?? "Lectures kun'yomi (japonaises)"}
						/>
					</div>
				)
				: <InfoRow label={t.reading ?? 'Lecture'} value={entry.kana} />
			}
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
							className="dict-detail__radical-link"
						>
							#{entry.radical}
						</button>
					}
				/>
			)}

			{entry.type === 'kanji' && entry.svg_url && (
				<div className="dict-detail__stroke-section">
					<div className="dict-detail__stroke-label">
						{t.strokeOrder ?? 'ORDRE DES TRAITS'}
					</div>
					<div className="dict-detail__stroke-frame">
						<img
							src={`${API_BASE}${entry.svg_url}`}
							alt={`Stroke order ${entry.kanji}`}
							className="dict-detail__stroke-img"
							onError={e => {
								e.target.style.display = 'none'
								e.target.nextSibling.style.display = 'block'
							}}
						/>
						<div className="dict-detail__stroke-fallback">
							{t.notAvailable ?? 'Non disponible'}
						</div>
					</div>
				</div>
			)}

			<button
				onClick={onClose}
				className="dict-detail__close-btn"
			>
				{t.close ?? 'Fermer'}
			</button>
		</>
	)
}

// ── Info row ──────────────────────────────────────────────

function InfoRow({ label, value }) {
	return (
		<div className="dict-info-row">
			<span className="dict-info-row__label">
				{label}
			</span>
			<span className="dict-info-row__value">
				{value}
			</span>
		</div>
	)
}