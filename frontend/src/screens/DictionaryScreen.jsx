import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { StationHeader } from '../components/station/StationHeader'
import { TopBar } from '../components/ui/TopBar'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { splitReadingTokens } from '../components/study/Readings'
import { firstGloss } from '../components/study/gloss'
import {
	TYPE_META, isKanaType, entryKey,
	SearchIcon, DictionaryDetail, LevelBadge,
} from '../components/dictionary/DictionaryDetail'
import { LEVEL_COLORS } from '../components/dictionary/levelColors'
import { SectionHeader } from '../components/ui/SectionHeader'
import { StageBadge } from '../components/study/StageBadge'
import { ChevronIcon } from '../components/ui/Icons'

const LIMIT = 50

export default function DictionaryScreen({ session }) {
	const { t, lang } = useLang()
	const navigate            = useNavigate()

	const [mode, setMode]             = useState('search') // 'search' | 'radical'
	const [query, setQuery]           = useState('')
	const [category, setCategory]     = useState('kanji') // 'kanji' | 'vocab' | 'hiragana' | 'katakana' | 'jmdict'
	const [results, setResults]       = useState([])
	const [loading, setLoading]       = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [page, setPage]             = useState(0)
	const [hasMore, setHasMore]       = useState(true)
	const [total, setTotal]           = useState(0)
	const [selected, setSelected]     = useState(null)

	// Radical browsing
	const [radicalGroups, setRadicalGroups]     = useState(null)
	const [loadingRadicals, setLoadingRadicals] = useState(false)
	const [selectedRadical, setSelectedRadical] = useState(null) // number | null

	const debounceRef = useRef(null)
	const observerRef = useRef(null)
	const sentinelRef = useRef(null)
	const searchRef   = useRef(null)

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

	// ── Keyboard ──
	// "/" jumps to the field from anywhere on the page and Escape
	// closes the open entry — the two things you do constantly in a
	// dictionary and previously had to reach for the mouse to do.
	// Guarded on the event target so "/" typed into the field itself
	// (or any other input on the page) still types a slash.
	useEffect(() => {
		function onKey(e) {
			const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable
			if (e.key === '/' && !typing) {
				e.preventDefault()
				searchRef.current?.focus()
				searchRef.current?.select()
			} else if (e.key === 'Escape') {
				if (typing && e.target === searchRef.current) e.target.blur()
				else setSelected(null)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
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

	// Jump from a kanji's detail panel to one of the vocab words it
	// appears in (see entry.vocab_examples) — the mirror image of
	// jumpToKanji above: switches to the vocab tab, searches for that
	// exact word, and auto-selects it once the search resolves.
	function jumpToVocab(kanji) {
		setCategory('vocab')
		setMode('search')
		setSelectedRadical(null)
		setSelected(null)
		setQuery(kanji)
		setPage(0)
		setHasMore(true)
		fetchPage(0, kanji, 'vocab', null, kanji)
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
				<StationHeader />

				{/* No heading block here: TopBar above already names the
				    screen, and a subtitle explaining that a dictionary is
				    for looking things up only pushes the category tabs —
				    the actual first thing you use — further down the page. */}

				{/* Category tabs — primary navigation. "jmdict" is the full
				    JMdict pool beyond the app's own curated deck (see
				    vocab_jmdict_data.py on the backend) — a separate tab
				    rather than folded into "vocab" so the default, curated
				    ~8k-word search experience doesn't get swamped by ~293k
				    largely obscure entries; someone who wants the full
				    dictionary asks for it explicitly. */}
				{/* ── 索引台 — the index console ──
				    Category, mode and query were three control rows stacked
				    down the page, so the first four things on a dictionary
				    were four bands of chrome. They are one instrument now:
				    collections along the top edge, the mode opposite them,
				    the field itself across the bottom. Same card material as
				    everything else, so the console reads as a piece of the
				    station's furniture rather than a toolbar. */}
				<div className="dict-console">
				<div className="dict-console__top">
				<div className="dict-tab-row dict-tab-row--category">
					{[
						['kanji',    t.dictKanji,                '漢', 'var(--line-kanji)'],
						['vocab',    t.dictVocab,                '語', 'var(--line-vocab)'],
						['hiragana', t.dictHiragana,             'あ', 'var(--line-kana)'],
						['katakana', t.dictKatakana,             'ア', 'var(--line-rikai)'],
						['jmdict',   t.dictJMdict ?? 'JMdict',   '辞', 'var(--line-jisho)'],
					].map(([key, label, glyph, color]) => (
						<button
							key={key}
							onClick={() => switchCategory(key)}
							style={{ '--tab-color': color }}
							className={`dict-tab-btn${category === key ? ' dict-tab-btn--active' : ''}`}
						>
							{/* Each collection gets the roundel the rest of the app
							    selects things with, in its own line colour — five
							    words with an underline said nothing about which
							    collection you were standing in. */}
							<span className="dict-tab-glyph" lang="ja" aria-hidden="true">{glyph}</span>
							{label}
						</button>
					))}
				</div>

				{/* Search / radical sub-toggle — radical browsing only makes
				    sense for kanji (a word can span several, and kana have
				    no radical at all), so it only appears under that tab.
				    Opposite the collections rather than on a row of its
				    own: it is a property of the kanji collection, not a
				    third navigation level. */}
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
				</div>

				{/* Search bar + count — hidden while browsing the plain radical grid,
				    shown again once a radical is picked (to narrow further), and hidden
				    for the syllabary categories (nothing to search on a fixed chart) */}
				{!showingRadicalGrid && !isSyllabary && (
					<div className="dict-index-bar">
						<SearchIcon />
						<input
							ref={searchRef}
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
						{/* The key that focuses this field, printed on it. A
						    reference tool you use all day should tell you how
						    to reach it without the mouse. */}
						<kbd className="dict-index-bar__key" aria-hidden="true">/</kbd>
						{!loading && (
							<div className="dict-index-bar__count">
								{t.dictionaryResults(total)}
							</div>
						)}
					</div>
				)}
				</div>

				{/* Selected-radical header */}
				{mode === 'radical' && selectedRadical != null && (
					<div className="dict-radical-header">
						<button
							onClick={backToRadicalGrid}
							className="dict-radical-back-btn"
						>
							<ChevronIcon direction="left" size={14} /> {t.dictBackToRadicals}
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
							onRadicalClick={jumpToRadical}
							onKanjiClick={jumpToKanji}
							onVocabClick={jumpToVocab}
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
							sentinelRef={sentinelRef}
							onRadicalClick={jumpToRadical}
							onKanjiClick={jumpToKanji}
							onVocabClick={jumpToVocab}
							t={t}
						/>
					)
				)}
			</div>
		</div>
	)
}

// ── Radical picker grid ─────────────────────────────────────

// ── 部首索引 — the radical index ──────────────────────────
// A printed radical index has a thumb rail down the fore-edge so you
// can land on a stroke count without turning every page. This is that
// rail, laid across the top where it can be reached with one hand and
// stay in view: 一画, 二画, 三画 …
//
// It also tracks where you are. An index that only jumps is half an
// index — the other half is telling you which section you are looking
// at, which an IntersectionObserver answers for free.
function StrokeRail({ groups, active, onJump, t }) {
	return (
		<nav className="stroke-rail" aria-label={t.dictStrokeIndex}>
			{groups.map(g => (
				<button
					key={g.stroke_count}
					type="button"
					onClick={() => onJump(g.stroke_count)}
					aria-current={active === g.stroke_count ? 'true' : undefined}
					className={`stroke-rail__tab${active === g.stroke_count ? ' stroke-rail__tab--active' : ''}`}
				>
					<span className="stroke-rail__n">{g.stroke_count}</span>
					<span className="stroke-rail__unit" lang="ja">画</span>
				</button>
			))}
		</nav>
	)
}

function RadicalGrid({ groups, loading, onPick, t }) {
	const [active, setActive] = useState(null)
	const sheetRefs = useRef(new Map())

	// Which stroke group is currently under the rail. rootMargin pulls
	// the observation band up to just below the sticky rail so the
	// section you are actually reading is the one that lights up, not
	// the one scrolled off behind it.
	useEffect(() => {
		if (!groups?.length) return
		const io = new IntersectionObserver(
			entries => {
				const visible = entries
					.filter(e => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
				if (visible) setActive(Number(visible.target.dataset.stroke))
			},
			{ rootMargin: '-140px 0px -60% 0px', threshold: 0 },
		)
		sheetRefs.current.forEach(el => el && io.observe(el))
		return () => io.disconnect()
	}, [groups])

	function jump(count) {
		sheetRefs.current.get(count)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		setActive(count)
	}

	if (loading || !groups) {
		return <div className="quiz-loading">{t.loadingDictionary}</div>
	}

	return (
		<div className="dict-radical-index">
			<StrokeRail groups={groups} active={active ?? groups[0]?.stroke_count} onJump={jump} t={t} />

			<div className="dict-radical-sheets">
				{groups.map(group => (
					<section
						key={group.stroke_count}
						data-stroke={group.stroke_count}
						ref={el => { sheetRefs.current.set(group.stroke_count, el) }}
						className="radical-sheet"
					>
						<SectionHeader
							jp={`${group.stroke_count}画`}
							title={`${group.stroke_count} ${group.stroke_count > 1 ? t.dictStrokesPlural : t.dictStrokeSingular}`}
							count={group.radicals.length}
						/>
						<div className="radical-sheet__list">
							{group.radicals.map(r => (
								<button
									key={r.number}
									onClick={() => onPick(r.number)}
									title={`${r.kanji_count} kanji`}
									className="radical-tile"
								>
									<span className="radical-tile__char" lang="ja">{r.char}</span>
									<span className="radical-tile__count">{r.kanji_count}</span>
								</button>
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	)
}

// ── Results grid + detail panel (shared by search mode and radical results) ──

// Cards get one gloss, not the whole list. This used to split on ';'
// alone, which meant a vocab entry (comma-separated — see splitGlosses)
// never matched and the card printed the entire packed string:
// "to appear,to leave" rather than "To appear".
function shortMeaning(meaning) {
	return firstGloss(meaning)
}

function shortKana(kana, type) {
	if (!kana || isKanaType(type)) return ''
	if (type === 'vocab') return kana.split(';')[0].trim()
	// Kanji: whole reading tokens, never a raw character slice. Cutting
	// at a fixed character count used to sever a reading mid-token and
	// leave the separator dangling — 山 showed "サン・", 語 showed
	// "ゴ・か" — because '・' and the following reading's first
	// character both count as characters like any other. Splitting on
	// the readings themselves (the same helper <Readings> uses, so the
	// two can't disagree about what a token is) and taking the first two
	// gives a card the on'yomi and kun'yomi whole: "サン・セン".
	//
	// The '.'/'~' okurigana markers KANJIDIC2 carries (かた.る — the る
	// is a suffix, not part of the kanji's own reading) are dropped for
	// the card: it's a glance at how the character sounds, and the
	// detail panel's own reading list keeps them for anyone who wants
	// the precise form.
	return splitReadingTokens(kana)
		.slice(0, 2)
		.map(token => token.replace(/[.~]/g, ''))
		.join('・')
}

// ── The detail dock ──────────────────────────────────────
// One node, two presentations. On a wide screen it is a sticky column
// standing beside the catalogue — you scan and read at the same time,
// which is the whole point of a reference tool and something a modal
// structurally cannot do. Below 1100px the same node reflows into the
// centred sheet it has always been.
//
// It carries its own scroll (see .dict-dock), which is precisely what
// the original side panel got wrong and why it was replaced by a
// modal: a panel pinned to the viewport cannot hold an entry with a
// dozen senses and a page of examples. Sticky + its own overflow can.
function DetailDock({ entry, onClose, onRadicalClick, onKanjiClick, onVocabClick }) {
	return (
		<>
			{/* Only painted in sheet mode — on a desktop nothing is
			    covered, so there is nothing to dim. */}
			<div className="dict-dock__scrim" onClick={onClose} aria-hidden="true" />
			<aside className="dict-dock">
				<DictionaryDetail
					entry={entry}
					onClose={onClose}
					onRadicalClick={onRadicalClick}
					onKanjiClick={onKanjiClick}
					onVocabClick={onVocabClick}
				/>
			</aside>
		</>
	)
}

function ResultsSection({
	loading, loadingMore, hasMore, results, total, query,
	selected, setSelected, sentinelRef, onRadicalClick, onKanjiClick, onVocabClick, t,
}) {

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
						<div className="dict-results-grid">
							{results.map(entry => (
								<div
									key={entryKey(entry)}
									onClick={() => setSelected(entry)}
									style={{ '--level-color': LEVEL_COLORS[entry.level] ?? 'var(--text-secondary)' }}
									className={`dict-entry-card${selected && entryKey(selected) === entryKey(entry) ? ' dict-entry-card--selected' : ''}`}
								>
									{/* Reading above, headword large, meaning below — the
									    three registers a 駅名標 carries, in the order it
									    carries them. A kanji is a name with a reading and a
									    meaning, which is exactly what a station plate is
									    for, so the catalogue is a wall of them. */}
									<div className="dict-entry-card__kana">
										{shortKana(entry.kana, entry.type)}
									</div>
									<div className="dict-entry-card__char">
										{entry.kanji || entry.kana}
									</div>
									<div className="dict-entry-card__meaning">
										{shortMeaning(entry.meaning)}
									</div>
									<LevelBadge level={entry.level} />
									<StageBadge stage={entry.status?.status ?? 'new'} />
								</div>
							))}
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

					{selected && (
						<DetailDock
							entry={selected} onClose={() => setSelected(null)}
							onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} onVocabClick={onVocabClick}
						/>
					)}
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

function SyllabaryTable({ rows, jp, title, byGroup, selected, setSelected }) {
	return (
		<div className="syllabary-table-wrap">
			{title && <SectionHeader jp={jp} title={title} />}
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

function SyllabaryGrid({ results, loading, selected, setSelected, onRadicalClick, onKanjiClick, onVocabClick, accentColor, t }) {
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
				{/* Two charts, side by side once there is room. A 五十音 table
				    is five columns wide and no wider — stacked, it left two
				    thirds of a desktop empty and pushed 濁音 below the fold,
				    when the two are meant to be read against each other. */}
				<div className="syllabary-chart-group" style={{ '--syl-accent': accentColor }}>
					<div className="syllabary-col">
						<SyllabaryTable
							rows={MAIN_ROWS}
							jp="五十音"
							title={t.syllabaryMain}
							byGroup={byGroup}
							selected={selected}
							setSelected={setSelected}
						/>

						{/* ん belongs to the gojūon chart — it is the one kana
						    that sits in no vowel column — so it stays with it
						    rather than drifting between the two tables. */}
						{nSolo && (
							<div className="syllabary-nsolo-wrap">
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
					</div>

					<div className="syllabary-col">
						<SyllabaryTable
							rows={VOICED_ROWS}
							jp="濁音"
							title={t.syllabaryVoiced}
							byGroup={byGroup}
							selected={selected}
							setSelected={setSelected}
						/>
					</div>
				</div>
			</div>

			{selected && (
				<DetailDock
					entry={selected} onClose={() => setSelected(null)}
					onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} onVocabClick={onVocabClick}
				/>
			)}
		</div>
	)
}