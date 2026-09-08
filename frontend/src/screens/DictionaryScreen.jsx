import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { splitReadingTokens } from '../components/study/Readings'
import { firstGloss } from '../components/study/gloss'
import {
	TYPE_META, isKanaType, entryKey,
	DictionaryDetail, LevelBadge,
} from '../components/dictionary/DictionaryDetail'

// The catalogue card's stage word: the SRS status folded onto the three
// stages the mark knows. A due card is still in progress; an unknown
// status prints nothing (StageMark returns null for it).
function stageOf(status) {
	if (status === 'mastered') return 'mastered'
	if (status === 'learning' || status === 'due') return 'learning'
	if (status === 'new') return 'new'
	return null
}
import { LEVEL_COLORS } from '../components/dictionary/levelColors'
import { StageMark } from '../components/study/StageMark'
import { Bar, Leave } from '../components/chrome/Bar'
import { Console, ConsoleTop, Chips, Chip, ConsoleIndex } from '../components/chrome/Console'
import { stationFor } from '../config/stations'
import { SOURCES } from '../components/analysis/sources'
import { TextLinesIcon, CameraIcon, VideoIcon } from '../components/ui/Icons'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'

const DICTIONARY_COLOR = 'var(--line-jisho)'
const ANALYZER_COLOR = 'var(--line-kaiseki)'
// A platform's glyph on the analyzer's door, keyed by the registry
// (components/analysis/sources.js) so a fourth intake cannot get a
// door with nothing drawn on it.
const INTAKE_GLYPHS = { text: TextLinesIcon, photo: CameraIcon, video: VideoIcon }

const LIMIT = 50

// The five collections, in their own line colours (canvas Dictionary).
// "jmdict" is the full JMdict pool beyond the app's own curated deck
// (see vocab_jmdict_data.py on the backend) — a separate collection
// rather than folded into "vocab" so the default, curated ~8k-word
// search experience doesn't get swamped by ~293k largely obscure
// entries; someone who wants the full dictionary asks for it.
function categoriesFor(t) {
	return [
		['kanji',    t.dictKanji,    'var(--line-kanji)'],
		['vocab',    t.dictVocab,    'var(--line-vocab)'],
		['hiragana', t.dictHiragana, 'var(--line-kana)'],
		['katakana', t.dictKatakana, 'var(--line-rikai)'],
		['jmdict',   t.dictJMdict,   'var(--line-jisho)'],
	]
}

// Route: /dictionary — under the shell (plan 073: the canvas's
// Dictionary). The bar, the analyzer's door, the console with the
// collections and the field, then the catalogue: a grid of entry
// cards, the radical index, or the syllabary charts. An entry opens
// in the dock (a full-screen plate on a phone, a column beside the
// catalogue on a wide screen — see .dict-dock).
export default function DictionaryScreen({ session }) {
	const { t, lang } = useLang()
	const navigate = useNavigate()
	const station = stationFor('/dictionary')
	const analyzerStation = stationFor('/dictionary/analyzer')

	// The door, and its three intakes. `?intake=` is the analyzer's own
	// deep link (screens/AnalyzerScreen.jsx reads it once, on mount):
	// the platform is a mode of one screen, not a page of its own, so it
	// travels as a query rather than a path.
	function openAnalyzer(intake = null) {
		playUi('click-screen-selection')
		navigate(intake ? `/dictionary/analyzer?intake=${intake}` : '/dictionary/analyzer')
	}
	const CATEGORIES = categoriesFor(t)

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

	// Below 1100px the dock is not a dock at all — it becomes a centred
	// modal, and full-screen below 700px (see .dict-dock's own media
	// queries). Preselecting there would drop a sheet over the chart the
	// moment the tab opened, so the learner would have to dismiss the
	// panel before they could see what it was a panel ABOUT. There is no
	// empty space to fill at those widths either, which is the only
	// reason the preselect exists.
	function hasSideDock() {
		return typeof window !== 'undefined'
			&& window.matchMedia('(min-width: 1100px)').matches
	}

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
				} else if (p === 0 && (cat === 'hiragana' || cat === 'katakana')
				           && newResults.length && hasSideDock()) {
					// The syllabary charts are five columns wide and no wider,
					// so beside them the reading dock opened onto empty space
					// until something was clicked. A chart of 71 fixed cells
					// has an obvious first cell — あ / ア — so it starts there
					// and the panel is doing its job from the first frame.
					// Only the FIRST page, and only when nothing else asked
					// for a selection, so it can never steal one the learner
					// already made.
					setSelected(newResults[0])
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
		// Same sound the study screens use for choosing a mode — this
		// is the same kind of act, so it should not have its own.
		playUi('click-mode-selection')
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
		<main id="main-content" className="dictionary" style={{ '--line-color': DICTIONARY_COLOR }}>
			<Bar code={station.code} color={DICTIONARY_COLOR} title={t.dictionaryTitle} />

			{/* The analyzer, behind its door (canvas Dictionary): one row
			    naming the section and its three intakes. The pass tag the
			    canvas draws on it stays out until a purchase flow exists
			    (plan 069, HAS_STORE). */}
			<div className="anl-door">
				<button type="button" className="anl-door__open" onClick={() => openAnalyzer()}>
					<span className="wmap-roundel anl-door__roundel" style={{ '--line-color': ANALYZER_COLOR }} aria-hidden="true">{analyzerStation.code}</span>
					<span className="anl-door__names">
						<span className="anl-door__title">{t.analyzerTitle}</span>
						<span className="anl-door__desc">{t.analyzerDoorSub}</span>
					</span>
				</button>
				{/* The three intakes are the doors they draw: a tap on the
				    camera opens the analyzer standing on 写真, not on 文字
				    with the camera one more tap away. Siblings of the
				    door's own button, never inside it — a button in a
				    button is invalid HTML, and browsers resolve it by
				    dropping one of the two. */}
				<span className="anl-door__intakes">
					{SOURCES.map(source => {
						const Glyph = INTAKE_GLYPHS[source.key]
						return (
							<button
								key={source.key}
								type="button"
								className="anl-door__intake"
								data-intake={source.key}
								aria-label={t[source.label]}
								onClick={() => openAnalyzer(source.key)}
							>
								<Glyph className="svg" />
							</button>
						)
					})}
				</span>
			</div>

			{/* ── The console (canvas) ──
			    The five collections as chips in their own line colours, the
			    radical index as a sixth chip that only exists under the kanji
			    collection (a word can span several, and kana have no radical
			    at all), and the field itself across the bottom with the
			    count in its slot — the dots stand in for the figure until
			    it exists (plan 067). */}
			<Console>
				<ConsoleTop>
					<Chips label={t.dictCollections}>
						{CATEGORIES.map(([key, label, color]) => (
							<Chip key={key} on={category === key} color={color} onClick={() => switchCategory(key)}>
								{label}
							</Chip>
						))}
						{category === 'kanji' && (
							<Chip
								on={mode === 'radical'}
								glyph="部"
								color={DICTIONARY_COLOR}
								onClick={() => (mode === 'radical' ? switchToSearchMode() : switchToRadicalMode())}
							>
								{t.dictModeRadical}
							</Chip>
						)}
					</Chips>
				</ConsoleTop>
				{/* Hidden while browsing the plain radical grid, shown again
				    once a radical is picked (to narrow further), and hidden for
				    the syllabary categories (nothing to search on a fixed chart). */}
				{!showingRadicalGrid && !isSyllabary && (
					<ConsoleIndex
						inputRef={searchRef}
						value={query}
						onChange={onSearch}
						onClear={() => onSearch({ target: { value: '' } })}
						placeholder={mode === 'radical' ? t.dictionaryPlaceholderRadical : t.dictionaryPlaceholder}
						autoFocus={mode === 'search'}
						clearLabel={t.close}
						count={loading ? <Loading inline /> : t.dictionaryResults(total)}
					/>
				)}
			</Console>

			{/* Selected-radical header */}
			{mode === 'radical' && selectedRadical != null && (
				<div className="dict-radical-header">
					<Leave onClick={backToRadicalGrid}>{t.dictBackToRadicals}</Leave>
					<div className="dict-radical-char" lang="ja">
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
		</main>
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
		return <Loading />
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
						<BlockMark jp={`${group.stroke_count}画`} tally={group.radicals.length} />
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
			{loading && <Loading />}

			{!loading && results.length === 0 && (
				<Empty icon={null} message={`${t.noResults} « ${query} »`} />
			)}

			{!loading && results.length > 0 && (
				<div className="dict-layout">

					{/* The catalogue (canvas): reading above, headword large,
					    meaning below — the three registers a 駅名標 carries, in
					    the order it carries them — with the level in one corner
					    and the stage word in the other. */}
					<div className="dict-results-wrap">
						<div className="dict-grid">
							{results.map(entry => {
								const stage = stageOf(entry.status?.status)
								return (
									<button
										key={entryKey(entry)}
										type="button"
										onClick={() => { playUi('click-menu'); setSelected(entry) }}
										style={{ '--level-color': LEVEL_COLORS[entry.level] ?? 'var(--text-secondary)' }}
										className={`dict-entry-card${selected && entryKey(selected) === entryKey(entry) ? ' dict-entry-card--selected' : ''}`}
									>
										<LevelBadge level={entry.level} />
										{stage && <StageMark stage={stage} />}
										<span className="dict-entry-card__kana" lang="ja">
											{shortKana(entry.kana, entry.type)}
										</span>
										<span className="dict-entry-card__char" lang="ja">
											{entry.kanji || entry.kana}
										</span>
										<span className="dict-entry-card__meaning">
											{shortMeaning(entry.meaning)}
										</span>
									</button>
								)
							})}
						</div>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} className="dict-sentinel">
							{loadingMore && (
								<div className="dict-sentinel__text">
									<Loading inline />
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
							entry={selected} onClose={() => { playUi('click-close-menu'); setSelected(null) }}
							onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} onVocabClick={onVocabClick}
						/>
					)}
				</div>
			)}
		</>
	)
}

// ── A block's own mark ────────────────────────────────────
// The stamp book's 九月 in its margin, for the two blocks in here that
// used to carry a SectionHeader: the syllabary charts and the radical
// index's stroke groups. Both had a paired h2 — the Japanese term, its
// French twin, a rule — over an object that already says what it is:
// a 五十音表 whose rows read あ行 か行 さ行, and a stroke group under a
// rail that names every stroke count and lights the one you are
// reading. A block that needs a heading to be legible is not finished
// (DESIGN.md, Say less); these two were finished. What is left is the
// mark and the hairline: the name in Japanese, the tally as data.
function BlockMark({ jp, tally }) {
	return (
		<div className="dict-mark">
			<span className="dict-mark__jp" lang="ja">{jp}</span>
			{tally != null && <span className="dict-mark__tally">{tally}</span>}
		</div>
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

function SyllabaryTable({ rows, jp, title, byGroup, vowelHeads, tail, selected, setSelected }) {
	return (
		<div className="syllabary-table-wrap">
			{/* The chart's mark, then the chart. The plain-language name
			    stays as the grid's accessible label — read out, not
			    printed, since the mark and the row heads say it. */}
			<BlockMark jp={jp} />
			<div className="syllabary-table" role="group" aria-label={title}>
				<div className="syllabary-gap" aria-hidden="true" />

				{/* Columns are headed by the vowel *kana*, not by "a i u e o".
				    They are the five sounds the chart is built on and the
				    learner is here to read them — printing their romaji
				    instead taught the wrong alphabet at the top of a chart
				    about the right one. The romaji stays underneath, small,
				    the way every cell below does it. */}
				{VOWEL_COLS.map(v => {
					const head = vowelHeads[v]
					return (
						<div key={`h-${v}`} className="syllabary-head syllabary-head--col">
							<span className="syllabary-head__kana" lang="ja">{head ?? ''}</span>
							<span className="syllabary-head__romaji">{v}</span>
						</div>
					)
				})}

				{rows.map(group => {
					const entries = byGroup[group] ?? []
					// 行 (gyō) — the row's name in Japanese is its own first
					// kana plus 行: か行, さ行, た行. Derived from the data
					// rather than a lookup table, so it is right for every
					// row including や行 and わ行, which skip columns.
					const lead = entries.find(e => vowelOf(e.romaji) === 'a')?.kana
					return (
						<Fragment key={group}>
							<div className="syllabary-head syllabary-head--row">
								{lead && <span className="syllabary-head__kana" lang="ja">{lead}行</span>}
							</div>
							{VOWEL_COLS.map(v => {
								const entry = entries.find(e => vowelOf(e.romaji) === v)
								// A sound that does not exist (yi, ye, wi, wu, we)
								// gets nothing at all. It used to get a dash,
								// which is a mark saying "look here" over the one
								// thing on the chart there is nothing to see.
								if (!entry) {
									return <div key={v} className="syllabary-gap" aria-hidden="true" />
								}
								const isSelected = selected && entryKey(selected) === entryKey(entry)
								return (
									<button
										key={v}
										type="button"
										onClick={() => { playUi('click-menu'); setSelected(entry) }}
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

				{/* 撥音 — ん belongs to this chart and to no vowel column, so
				    it gets its own labelled row at the foot of the table
				    rather than floating underneath it as an orphan. */}
				{tail && (
					<>
						<div className="syllabary-head syllabary-head--row">
							<span className="syllabary-head__kana" lang="ja">撥音</span>
						</div>
						<button
							type="button"
							onClick={() => setSelected(tail)}
							className={`syllabary-cell syllabary-cell--kana${selected && entryKey(selected) === entryKey(tail) ? ' syllabary-cell--selected' : ''}`}
						>
							<span className="syllabary-cell__char">{tail.kana}</span>
							<span className="syllabary-cell__romaji">{tail.romaji}</span>
						</button>
					</>
				)}
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

	// あ い う え お for the column heads, taken from the chart's own
	// vowel row rather than written down a second time.
	const vowelHeads = useMemo(() => {
		const out = {}
		;(byGroup.vowels ?? []).forEach(e => {
			const v = vowelOf(e.romaji)
			if (v) out[v] = e.kana
		})
		return out
	}, [byGroup])

	if (loading) return <Loading />

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
							vowelHeads={vowelHeads}
							tail={nSolo}
							selected={selected}
							setSelected={setSelected}
						/>
					</div>

					<div className="syllabary-col">
						<SyllabaryTable
							rows={VOICED_ROWS}
							jp="濁音"
							title={t.syllabaryVoiced}
							byGroup={byGroup}
							vowelHeads={vowelHeads}
							selected={selected}
							setSelected={setSelected}
						/>
					</div>
				</div>
			</div>

			{selected && (
				<DetailDock
					entry={selected} onClose={() => { playUi('click-close-menu'); setSelected(null) }}
					onRadicalClick={onRadicalClick} onKanjiClick={onKanjiClick} onVocabClick={onVocabClick}
				/>
			)}
		</div>
	)
}