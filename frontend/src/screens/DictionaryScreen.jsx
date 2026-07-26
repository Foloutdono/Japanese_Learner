import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { Readings } from '../components/QuizComponents'
import { StrokeOrderAnimation } from '../components/StrokeOrderAnimation'

const API_BASE = import.meta.env.VITE_API_URL || ''
const LIMIT = 50

const STATUS_META = {
	new:      { color: 'var(--text-secondary)', fallback: 'À apprendre' },
	learning: { color: 'var(--accent)',         fallback: 'En cours' },
	mastered: { color: 'var(--success)',        fallback: 'Maîtrisé' },
}

// Colours pulled from the app's own palette (ai-iro indigo / rokushou
// verdigris) instead of arbitrary hex, so — like every other colour
// in the app — these correctly flip between the dark and light theme
// rather than staying fixed regardless of `data-theme`.
const TYPE_META = {
	kanji:    { color: 'var(--accent4)', fallback: 'Kanji' },
	vocab:    { color: 'var(--accent6)', fallback: 'Vocabulaire' },
	hiragana: { color: 'var(--accent3)', fallback: 'Hiragana' },
	katakana: { color: 'var(--accent5)', fallback: 'Katakana' },
}

// Both kana types share every bit of detail-panel/card logic that
// differs from kanji/vocab (no translated "meaning", romaji shown
// instead of a reading list, the stroke-order panel), so call sites
// check this instead of repeating the type === 'hiragana' ||
// type === 'katakana' pair everywhere.
function isKanaType(type) {
	return type === 'hiragana' || type === 'katakana'
}

// Kanji, vocab, and kana entries can share the same character (a
// one-kanji word, or a kana that's also a valid word on its own), so
// the character alone isn't a safe React key / selection identity.
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
	const label = type === 'kanji' ? (t?.dictKanji ?? 'Kanji')
		: type === 'hiragana' ? (t?.dictHiragana ?? 'Hiragana')
		: type === 'katakana' ? (t?.dictKatakana ?? 'Katakana')
		: (t?.dictVocab ?? 'Vocabulaire')
	return (
		<span className="dict-type-pill" style={{ '--pill-color': meta.color }}>
			{label}
		</span>
	)
}

// A drawn glyph, not an emoji — 🔊 was the only emoji anywhere in this
// screen or QuizComponents, which otherwise draws its own icons (see
// Loading's spinner). Sits inside the hanko-style stamp button below.
function SpeakIcon() {
	return (
		<svg
			className="dict-detail__speak-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
			<path d="M15.5 8.5a5 5 0 0 1 0 7" />
			<path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
		</svg>
	)
}

// A small magnifier for the search bar — same reasoning as SpeakIcon.
function SearchIcon() {
	return (
		<svg
			className="dict-index-bar__icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
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
	const [category, setCategory]     = useState('kanji') // 'kanji' | 'vocab' | 'hiragana' | 'katakana'
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
		const saved = window.localStorage.getItem('jp-theme')
		if (saved === 'light' || saved === 'dark') {
		document.documentElement.setAttribute('data-theme', saved)
		}
	}, [])

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

	function fetchPage(p, q, cat, rad, autoSelectChar) {
		if (p === 0) setLoading(true)
		else setLoadingMore(true)

		// Hiragana/katakana's basic set is small and fixed (~71 entries
		// including voiced rows) — one page comfortably holds all of it,
		// so the syllabary chart never needs to page or infinite-scroll.
		const limit = (cat === 'hiragana' || cat === 'katakana') ? 100 : LIMIT
		const params = new URLSearchParams({ q, page: p, limit, lang, category: cat })
		if (rad != null) params.set('radical', rad)

		apiFetch(`/api/dictionary?${params.toString()}`, session)
			.then(r => r.json())
			.then(data => {
				const newResults = data.results || []
				if (p === 0) setResults(newResults)
				else setResults(prev => [...prev, ...newResults])
				setTotal(data.total)
				setHasMore(data.has_more)
				setPage(p)
				setLoading(false)
				setLoadingMore(false)
				// Jumping to a specific kanji (see jumpToKanji) needs its
				// detail panel to open automatically once the search
				// this triggers actually resolves — there's no other
				// moment to select it from.
				if (autoSelectChar) {
					const match = newResults.find(e => e.kanji === autoSelectChar)
					if (match) setSelected(match)
				}
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
		// The syllabary categories hide the search box entirely (see
		// isSyllabary) — if a query was left over from kanji/vocab
		// search, keeping it would silently filter the chart down to a
		// handful of cells with no visible input to explain why.
		const isSyl = cat === 'hiragana' || cat === 'katakana'
		if (isSyl) setQuery('')
		// Radical browsing only exists under the kanji tab now (see the
		// sub-toggle below) — leaving it behind a stale mode === 'radical'
		// would otherwise show an empty radical grid under vocab/kana.
		if (cat !== 'kanji' && mode === 'radical') {
			setMode('search')
			setSelectedRadical(null)
		}
		fetchPage(0, isSyl ? '' : query, cat, null)
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
		setCategory('kanji')
		setMode('radical')
		setSelectedRadical(number)
		setSelected(null)
		setQuery('')
		setPage(0)
		setHasMore(true)
		fetchPage(0, '', 'kanji', number)
	}

	// Jump from a vocab word's detail panel to one of the kanji it's
	// made of — switches to the kanji tab, searches for that exact
	// character, and auto-selects it once the search resolves (see
	// fetchPage's autoSelectChar) so its own detail panel opens right
	// away instead of leaving the user to pick it out of a result list.
	function jumpToKanji(char) {
		setCategory('kanji')
		setMode('search')
		setSelectedRadical(null)
		setSelected(null)
		setQuery(char)
		setPage(0)
		setHasMore(true)
		fetchPage(0, char, 'kanji', null, char)
	}

	function loadMore() {
		fetchPage(page + 1, query, category, selectedRadical)
	}

	const showingRadicalGrid = mode === 'radical' && selectedRadical == null
	// Hiragana/katakana get the classic gojūon chart instead of the
	// paginated card grid — both sets are small and fixed (~71 entries
	// each including voiced rows), so there's nothing to page through
	// and a search box over a 71-symbol table adds little.
	const isSyllabary = mode === 'search' && (category === 'hiragana' || category === 'katakana')

	return (
		<div className="screen">
			<TopBar onBack={() => navigate('/')} title={t.dictionaryTitle} />

			<div className="container dict-page">

				<div className="selector-header">
					<div className="selector-header__eyebrow">索引 · Sakuin</div>
					<h1 className="selector-header__title">{t.dictionaryTitle}</h1>
					<p className="selector-header__subtitle">
						{t.dictionarySubtitle}
					</p>
				</div>

				{/* Category tabs — primary navigation */}
				<div className="dict-tab-row dict-tab-row--category">
					{[
						['kanji',    t.dictKanji],
						['vocab',    t.dictVocab],
						['hiragana', t.dictHiragana],
						['katakana', t.dictKatakana],
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

				{/* Search / radical sub-toggle — radical browsing only makes
				    sense for kanji (a word can span several, and kana have
				    no radical at all), so it only appears under that tab. */}
				{category === 'kanji' && (
					<div className="dict-tab-row dict-tab-row--submode">
						{[
							['search',  t.dictModeSearch],
							['radical', t.dictModeRadical],
						].map(([key, label]) => (
							<button
								key={key}
								onClick={() => key === 'radical' ? switchToRadicalMode() : switchToSearchMode()}
								className={`dict-tab-btn dict-tab-btn--sub${mode === key ? ' dict-tab-btn--active' : ''}`}
							>
								{label}
							</button>
						))}
					</div>
				)}

				{/* Search bar + count — hidden while browsing the plain radical grid,
				    shown again once a radical is picked (to narrow further), and hidden
				    for the syllabary categories (nothing to search on a fixed chart) */}
				{!showingRadicalGrid && !isSyllabary && (
					<div className="dict-index-bar">
						<SearchIcon />
						<input
							value={query}
							onChange={onSearch}
							placeholder={
								mode === 'radical'
									? (t.dictionaryPlaceholderRadical)
									: (t.dictionaryPlaceholder)
							}
							autoFocus={mode === 'search'}
							className="dict-index-bar__input"
						/>
						{!loading && (
							<div className="dict-index-bar__count">
								{total} {t.dictionaryResults}
							</div>
						)}
					</div>
				)}

				{/* Selected-radical header */}
				{mode === 'radical' && selectedRadical != null && (
					<div className="dict-radical-header">
						<button
							onClick={backToRadicalGrid}
							className="dict-radical-back-btn"
						>
							← {t.dictBackToRadicals}
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
					isSyllabary ? (
						<SyllabaryGrid
							results={results}
							loading={loading}
							selected={selected}
							setSelected={setSelected}
							isMobile={isMobile}
							onRadicalClick={jumpToRadical}
							onKanjiClick={jumpToKanji}
							accentColor={TYPE_META[category]?.color}
							t={t}
						/>
					) : (
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
							onKanjiClick={jumpToKanji}
							t={t}
						/>
					)
				)}
			</div>
		</div>
	)
}

// ── Radical picker grid ─────────────────────────────────────

// Jumps to a stroke-count sheet without a full page-jump — `block:
// 'start'` plus each sheet's own scroll-margin-top (set in CSS) keeps
// the landed section clear of the sticky search bar above it.
function jumpToStrokeSheet(count) {
	document.getElementById(`stroke-sheet-${count}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The radical lattice sizes itself to content (`width: max-content`),
// not a fixed grid-2/grid-3 like the stats screen, so the number of
// columns isn't known up front — it depends on how much width the
// sheets column actually has (sidebar rail included) and changes on
// resize. Measured here so RadicalFiller below can top up a ragged
// last row with exactly as many tiles as the lattice really has.
// Reads tile size/gap from the CSS custom properties on the ref'd
// node (set in .dict-radical-sheets, see index.css) rather than
// hardcoding numbers here — so PC vs. phone sizing lives in one place
// and can't drift out of sync with what's actually on screen.
//
// A callback ref, not useRef + useEffect(..., []): the grid only
// mounts once `!loading && groups`, so a one-shot mount effect can
// fire before it's in the DOM and never re-run once it appears,
// leaving cols stuck at the initial value forever.
function useRadicalColumns() {
	const [node, setNode] = useState(null)
	const [cols, setCols] = useState(1)
	const ref = useCallback(el => setNode(el), [])

	useEffect(() => {
		if (!node) return
		const measure = () => {
			const width = node.clientWidth
			if (!width) return
			const style = getComputedStyle(node)
			const TILE = parseFloat(style.getPropertyValue('--radical-tile')) || 56
			const GAP = parseFloat(style.getPropertyValue('--radical-gap')) || 1
			setCols(Math.max(1, Math.floor((width + GAP) / (TILE + GAP))))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(node)
		return () => ro.disconnect()
	}, [node])

	return [ref, cols]
}

// Same idea as GridFiller in StatsScreen: a group whose radical count
// isn't a clean multiple of the column count leaves a bare patch of
// lattice background in its last row. A group that doesn't even reach
// one full row (radicals.length <= cols) is deliberately narrower —
// nothing to top up there — so this only fires once a group actually
// wraps.
function RadicalFiller({ count, cols, glyph }) {
	const empty = (cols - (count % cols)) % cols
	if (!empty) return null
	return Array.from({ length: empty }, (_, i) => (
		<div key={`radical-filler-${i}`} className="dict-radical-filler" aria-hidden="true">
			<span className="dict-radical-filler__glyph">{glyph}</span>
		</div>
	))
}

function RadicalGrid({ groups, loading, onPick, t }) {
	const [sheetsRef, cols] = useRadicalColumns()

	if (loading || !groups) {
		return (
			<div className="quiz-loading">
				{t.loadingDictionary}
			</div>
		)
	}

	return (
		<div className="dict-radical-index">
			{/* Thumb index — the stroke-count tabs found on the fore-edge of a
			    printed 部首索引 (radical index), letting you jump straight to
			    a stroke count instead of scrolling past every group. */}
			<nav className="dict-stroke-rail" aria-label={t.dictStrokeIndex}>
				{groups.map(g => (
					<a
						key={g.stroke_count}
						href={`#stroke-sheet-${g.stroke_count}`}
						onClick={e => { e.preventDefault(); jumpToStrokeSheet(g.stroke_count) }}
						className="dict-stroke-rail__tab"
					>
						{g.stroke_count}
					</a>
				))}
			</nav>

			<div className="dict-radical-sheets" ref={sheetsRef}>
				{groups.map(group => (
					<div key={group.stroke_count} id={`stroke-sheet-${group.stroke_count}`} className="dict-radical-group">
						<div className="dict-radical-group__label">
							{group.stroke_count} {group.stroke_count > 1
								? (t.dictStrokesPlural)
								: (t.dictStrokeSingular)}
						</div>
						<div className="dict-radical-group__rule" />
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
							<RadicalFiller count={group.radicals.length} cols={cols} glyph="部" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

// ── Results grid + detail panel (shared by search mode and radical results) ──

function shortMeaning(meaning) {
	return meaning?.split(';')[0] ?? ''
}

function shortKana(kana, type) {
	if (!kana || isKanaType(type)) return ''
	const firstKana = kana.split(';')[0].trim()
	return type === 'vocab' ? firstKana : Array.from(firstKana).slice(0, 3).join('')
}

// Same idea as useRadicalColumns, but the results grid's width can also
// change without a window resize — opening the side detail panel eats
// 320px + gap out of .dict-results-wrap via the flex layout — so this
// watches the container itself instead of just the window.
//
// A callback ref, not useRef + useEffect(..., []): the grid <div> only
// exists once `!loading && results.length > 0`, so a one-shot mount
// effect can fire before it's in the DOM and never re-run once it
// appears, leaving cols stuck at the initial value forever.
function useResultsColumns() {
	const [node, setNode] = useState(null)
	const [cols, setCols] = useState(1)
	const ref = useCallback(el => setNode(el), [])

	useEffect(() => {
		if (!node) return
		const TILE = 180, GAP = 2
		const measure = () => {
			const width = node.clientWidth
			if (!width) return
			setCols(Math.max(1, Math.floor((width + GAP) / (TILE + GAP))))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(node)
		return () => ro.disconnect()
	}, [node])

	return [ref, cols]
}

// Same reasoning as RadicalFiller: a ragged last row of entry cards
// would otherwise leave a bare patch of the lattice background (or,
// worse, a single undivided block of it) instead of reading as more
// index-card slots that just happen to be empty.
function ResultsFiller({ count, cols, glyph }) {
	const empty = (cols - (count % cols)) % cols
	if (!empty) return null
	return Array.from({ length: empty }, (_, i) => (
		<div key={`results-filler-${i}`} className="dict-results-filler" aria-hidden="true">
			<span className="dict-results-filler__glyph">{glyph}</span>
		</div>
	))
}

function ResultsSection({
	loading, loadingMore, hasMore, results, total, query,
	selected, setSelected, isMobile, sentinelRef, onRadicalClick, onKanjiClick, t,
}) {
	const [resultsGridRef, cols] = useResultsColumns()

	return (
		<>
			{loading && (
				<div className="quiz-loading">
					{t.loadingDictionary}
				</div>
			)}

			{!loading && results.length === 0 && (
				<div className="quiz-loading">
					{t.noResults} « {query} »
				</div>
			)}

			{!loading && results.length > 0 && (
				<div className="dict-layout">

					{/* Grid */}
					<div className="dict-results-wrap">
						<div className="dict-results-grid" ref={resultsGridRef}>
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
							<ResultsFiller count={results.length} cols={cols} glyph="語" />
						</div>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} className="dict-sentinel">
							{loadingMore && (
								<div className="dict-sentinel__text">
									{t.loadingMore}
								</div>
							)}
							{!hasMore && results.length > 0 && (
								<div className="dict-sentinel__text">
									{total} {t.displayedKanji}
								</div>
							)}
						</div>
					</div>

					{/* Desktop side panel — hidden on mobile via CSS */}
					{selected && (
						<div className="dict-panel">
							<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} />
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
						<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} />
					</div>
				</div>
			)}
		</>
	)
}

// ── Syllabary chart (hiragana/katakana) ──────────────────
// The classic gojūon table: rows are consonant groups, columns are
// the five vowels a-i-u-e-o. Two stacked tables — the plain gojūon
// (+ ん/ン standalone) and the voiced/semi-voiced (dakuten/handakuten)
// rows — same layout real textbooks use rather than one merged block.
const MAIN_ROWS   = ['vowels', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w']
const VOICED_ROWS = ['g', 'z', 'd', 'b', 'p']
const VOWEL_COLS  = ['a', 'i', 'u', 'e', 'o']

// Column placement comes from the entry's own romaji rather than its
// position within its row-group: y/w rows skip columns for sounds
// that don't exist (no "yi", "ye", "wi", "wu", "we"), so counting
// 0/1/2 within the group would misalign them under the wrong vowel.
function vowelOf(romaji) {
	const last = romaji?.[romaji.length - 1]
	return VOWEL_COLS.includes(last) ? last : null
}

function SyllabaryTable({ rows, title, byGroup, selected, setSelected }) {
	return (
		<div className="syllabary-table-wrap">
			{title && <div className="syllabary-table__title">{title}</div>}
			<div className="syllabary-table">
				<div className="syllabary-cell syllabary-cell--corner" aria-hidden="true" />
				{VOWEL_COLS.map(v => (
					<div key={`h-${v}`} className="syllabary-cell syllabary-cell--col-header">
						{v}
					</div>
				))}
				{rows.map(group => {
					const entries = byGroup[group] ?? []
					return (
						<Fragment key={group}>
							<div className="syllabary-cell syllabary-cell--row-header">
								{group === 'vowels' ? '' : group.toUpperCase()}
							</div>
							{VOWEL_COLS.map(v => {
								const entry = entries.find(e => vowelOf(e.romaji) === v)
								if (!entry) {
									return <div key={v} className="syllabary-cell syllabary-cell--empty" aria-hidden="true" />
								}
								const isSelected = selected && entryKey(selected) === entryKey(entry)
								return (
									<button
										key={v}
										type="button"
										onClick={() => setSelected(entry)}
										className={`syllabary-cell syllabary-cell--kana${isSelected ? ' syllabary-cell--selected' : ''}`}
									>
										<span className="syllabary-cell__char">{entry.kana}</span>
										<span className="syllabary-cell__romaji">{entry.romaji}</span>
									</button>
								)
							})}
						</Fragment>
					)
				})}
			</div>
		</div>
	)
}

function SyllabaryGrid({ results, loading, selected, setSelected, isMobile, onRadicalClick, onKanjiClick, accentColor, t }) {
	const byGroup = useMemo(() => {
		const map = {}
		results.forEach(e => { (map[e.group] ??= []).push(e) })
		return map
	}, [results])

	const nSolo = byGroup.n_solo?.[0] ?? null

	if (loading) {
		return (
			<div className="quiz-loading">
				{t.loadingDictionary}
			</div>
		)
	}

	return (
		<div className="dict-layout">
			<div className="dict-results-wrap">
				<div className="syllabary-chart-group" style={{ '--syl-accent': accentColor }}>
					<SyllabaryTable
						rows={MAIN_ROWS}
						title={t.syllabaryMain}
						byGroup={byGroup}
						selected={selected}
						setSelected={setSelected}
					/>

					{nSolo && (
						<div className="syllabary-nsolo-wrap">
							<div className="syllabary-table__title syllabary-table__title--center">
								{t.syllabaryNSolo}
							</div>
							<button
								type="button"
								onClick={() => setSelected(nSolo)}
								className={`syllabary-cell syllabary-cell--kana syllabary-cell--nsolo${selected && entryKey(selected) === entryKey(nSolo) ? ' syllabary-cell--selected' : ''}`}
							>
								<span className="syllabary-cell__char">{nSolo.kana}</span>
								<span className="syllabary-cell__romaji">{nSolo.romaji}</span>
							</button>
						</div>
					)}

					<SyllabaryTable
						rows={VOICED_ROWS}
						title={t.syllabaryVoiced}
						byGroup={byGroup}
						selected={selected}
						setSelected={setSelected}
					/>
				</div>
			</div>

			{/* Desktop side panel — hidden on mobile via CSS, same as ResultsSection */}
			{selected && (
				<div className="dict-panel">
					<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} />
				</div>
			)}

			{/* Mobile modal */}
			{selected && isMobile && (
				<div onClick={() => setSelected(null)} className="dict-modal-overlay">
					<div onClick={e => e.stopPropagation()} className="dict-modal-content">
						<DetailPanel entry={selected} onClose={() => setSelected(null)} onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} />
					</div>
				</div>
			)}
		</div>
	)
}

// ── Detail panel ──────────────────────────────────────────

function DetailPanel({ entry, onClose, onRadicalClick, onKanjiClick }) {
	const { t, lang, contentMaps } = useLang()
	const map = entry.type === 'vocab' ? contentMaps?.vocab
		: entry.type === 'kanji' ? contentMaps?.kanji
		: null
	// Kana has no semantic "meaning" to translate — its romaji is shown
	// as its own reading row below instead (see the ternary further
	// down), so this stays null and the "Sens" row simply doesn't render.
	const meaning = isKanaType(entry.type)
		? null
		: lang === 'fr'
			? (map?.[entry.kanji || entry.kana] ?? entry.meaning)
			: entry.meaning

	// Every kanji character used in this vocab word, deduplicated and in
	// reading order — each becomes a link that jumps to that kanji's own
	// dictionary entry (see jumpToKanji). Matches CJK Unified Ideographs;
	// a kana-only word (entry.kanji empty) simply yields none.
	const composingKanji = useMemo(() => {
		if (entry.type !== 'vocab' || !entry.kanji) return []
		const chars = entry.kanji.match(/[\u4e00-\u9faf]/g) || []
		return [...new Set(chars)]
	}, [entry.type, entry.kanji])

	const [strokeSvgFailed, setStrokeSvgFailed] = useState(false)
	useEffect(() => { setStrokeSvgFailed(false) }, [entry.svg_url])

	return (
		<>
			<div className="dict-detail__stage">
				<div className="dict-detail__char">
					{entry.kanji || entry.kana}
				</div>
				<div className="dict-detail__stage-actions">
					<button
						onClick={() => speakJapanese(entry.kana)}
						className="dict-detail__speak-btn"
						title={t.listen}
						aria-label={t.listen}
					>
						<SpeakIcon />
					</button>
					{/* Mobile-only (see index.css) — the fullscreen sheet needs
					    an immediate way to dismiss without scrolling all the
					    way down to the "Fermer" button. */}
					<button
						onClick={onClose}
						className="dict-detail__close-x"
						aria-label={t.close}
					>
						×
					</button>
				</div>
			</div>

			<div className="dict-detail__body">
				<div className="dict-detail__badges">
					<TypeBadge type={entry.type} t={t} />
					<StatusBadge state={entry.status?.state ?? 'new'} t={t} />
				</div>

				{entry.type === 'kanji'
					? (
						<div className="dict-detail__readings">
							<Readings
								kana={entry.kana}
								onLabel={t.onyomi}
								kunLabel={t.kunyomi}
							/>
						</div>
					)
					: isKanaType(entry.type)
					? <InfoRow label={t.romaji} value={entry.romaji} />
					: <InfoRow label={t.reading} value={entry.kana} />
				}
				{meaning != null && <InfoRow label={t.meaning}    value={meaning} />}
				<InfoRow label={t.level}  value={entry.level} />
				{entry.stroke_count && (
					<InfoRow label={t.strokes} value={`${entry.stroke_count} ${t.strokes}`} />
				)}
				{entry.type === 'kanji' && entry.radical != null && (
					<InfoRow
						label={t.radical}
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

				{composingKanji.length > 0 && (
					<div className="dict-detail__composing-kanji">
						<div className="dict-detail__composing-kanji-label">
							{t.composingKanji}
						</div>
						<div className="dict-detail__kanji-chips">
							{composingKanji.map(char => (
								<button
									key={char}
									onClick={() => onKanjiClick?.(char)}
									className="dict-detail__kanji-chip"
								>
									{char}
								</button>
							))}
						</div>
					</div>
				)}

				{(entry.type === 'kanji' || isKanaType(entry.type)) && entry.svg_url && (
					<div className="dict-detail__stroke-section">
						<div className="dict-detail__stroke-label">
							{t.strokeOrder}
						</div>
						<div className="dict-detail__stroke-frame">
							{!strokeSvgFailed && (
								<StrokeOrderAnimation
									src={`${API_BASE}${entry.svg_url}`}
									loop
									className="dict-detail__stroke-img"
									onError={() => setStrokeSvgFailed(true)}
								/>
							)}
							{strokeSvgFailed && (
								<div className="dict-detail__stroke-fallback" style={{ display: 'block' }}>
									{t.notAvailable}
								</div>
							)}
						</div>
					</div>
				)}

				<button
					onClick={onClose}
					className="dict-detail__close-btn"
				>
					{t.close}
				</button>
			</div>
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