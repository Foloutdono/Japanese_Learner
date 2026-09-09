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

// The catalogue card's stage: the SRS status folded onto the three
// stages the card can draw. A due card is still in progress; an unknown
// status draws no stage at all, and the card's edge stays its own
// hairline (index.css, .dict-entry-card::after).
function stageOf(status) {
	if (status === 'mastered') return 'mastered'
	if (status === 'learning' || status === 'due') return 'learning'
	if (status === 'new') return 'new'
	return null
}
import { LEVEL_COLORS } from '../components/dictionary/levelColors'
import { FuriganaParts } from '../components/study/Readings'
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
// The whole of one syllabary, in one page. See fetchPage.
const SYLLABARY_LIMIT = 200

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

		// A syllabary is small and fixed — 113 hiragana and 125 katakana,
		// counting the voiced rows, the yōon, the long vowels and (in
		// katakana) the borrowed sounds — so one page holds all of it and
		// the chart never has to page or infinite-scroll. 200 is the most
		// the endpoint will serve (routes/dictionary.py), and it is the
		// number here so that adding a set to kana_data.py cannot quietly
		// truncate the chart the way raising it past 100 once did.
		const limit = (cat === 'hiragana' || cat === 'katakana') ? SYLLABARY_LIMIT : LIMIT
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
						{/* 3画 · 3 TRAITS · 12 — the term, its twin, then how
						    many radicals are in the group. The twin is the
						    unit spelled out: 画 is the one word on this
						    screen a beginner cannot guess. */}
						<BlockMark
							jp={`${group.stroke_count}画`}
							name={`${group.stroke_count} ${group.stroke_count === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}`}
							tally={group.radicals.length}
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

// ── The reading rides on the headword ────────────────────
// The card printed its reading as a line ABOVE the word, which put a
// second register over every tile — and over a kana-only entry it
// printed the word twice (テープレコーダー over テープレコーダー). It is
// furigana now, on the characters it belongs to:
//
//   a word   the backend's own per-kanji alignment (study/furigana.py,
//            already on every catalogue row as `furigana`) — the same
//            parts the entry's plate sets over its headword
//   a kanji  its first two readings over the character, the pair
//            shortKana already picks for this card
//   kana     nothing: a reading over its own spelling says nothing
//
// Owner's call; the plate downstairs is unchanged.
function cardFurigana(entry) {
	if (entry.type === 'kanji') {
		const reading = shortKana(entry.kana, entry.type)
		return reading ? [{ text: entry.kanji, reading }] : null
	}
	return entry.furigana?.some(part => part.reading) ? entry.furigana : null
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
					    the order it carries them — with the level in its corner
					    and the stage along the card's bottom edge. */}
					<div className="dict-results-wrap">
						<div className="dict-grid">
							{results.map(entry => {
								const stage = stageOf(entry.status?.status)
								const furigana = cardFurigana(entry)
								return (
									<button
										key={entryKey(entry)}
										type="button"
										onClick={() => { playUi('click-menu'); setSelected(entry) }}
										// --len is how many characters the headword has: the
										// tile divides its own width by it and sets the word to
										// fit on one line (index.css, .dict-entry-card__char).
										style={{
											'--level-color': LEVEL_COLORS[entry.level] ?? 'var(--text-secondary)',
											'--len': [...(entry.kanji || entry.kana || ' ')].length,
										}}
										className={[
											'dict-entry-card',
											stage ? `dict-entry-card--${stage}` : '',
											selected && entryKey(selected) === entryKey(entry) ? 'dict-entry-card--selected' : '',
										].filter(Boolean).join(' ')}
									>
										<LevelBadge level={entry.level} />
										{/* The stage is the card's bottom edge now (index.css,
										    .dict-entry-card::after) — but an edge is a colour, and
										    a colour is not a word: the tile keeps the word where a
										    screen reader can still read it. The dictionary's own
										    plate prints it in full. */}
										{stage && <span className="sr-only">{t[stage]}</span>}
										<span className="dict-entry-card__char" lang="ja">
											{furigana
												? <FuriganaParts parts={furigana} />
												: (entry.kanji || entry.kana)}
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
// The station sign, at the size a block gets: the Japanese term set
// large in the collection's own ink, its plain-language twin tracked
// out beside it, a rule under both, and the tally riding the far end as
// data. For the two blocks in here that used to carry a SectionHeader —
// the syllabary charts and the radical index's stroke groups.
//
// The rule the heading broke was its bulk, not its second language:
// 五十音 alone tells a learner nothing they can act on, and the charts
// under these marks no longer name their own rows. So the twin is
// printed, not only read out. It is one line either way.
function BlockMark({ jp, name, tally }) {
	return (
		<div className="dict-mark">
			<span className="dict-mark__jp" lang="ja">{jp}</span>
			{name && <span className="dict-mark__name">{name}</span>}
			{tally != null && <span className="dict-mark__tally">{tally}</span>}
		</div>
	)
}

// ── Syllabary chart (hiragana/katakana) ──────────────────
// The classic gojūon table: rows are consonant groups, columns are
// the five vowels a-i-u-e-o. Separate tables rather than one merged
// block, the layout real textbooks use: 五十音, 濁音, 拗音, 長音, and
// for katakana 外来音.
//
// The rows and columns are not labelled. They were — あ行 か行 さ行 down
// the side, あ い う え お with their romaji across the top — and the
// labels said what the first cell of each row and column already says,
// in a second column and a second row of type wrapped around every
// chart. The grid IS the label: か行 is the row that starts か. Owner's
// call, this session.
const MAIN_ROWS    = ['vowels', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w']
const VOICED_ROWS  = ['g', 'z', 'd', 'b', 'p']
// 拗音 — a full-size kana with a small や/ゆ/よ after it. Unvoiced rows
// first, then the voiced ones, the same order 五十音 and 濁音 are in.
const YOON_ROWS    = ['k_combo', 's_combo', 't_combo', 'n_combo', 'h_combo',
                      'm_combo', 'r_combo', 'g_combo', 'z_combo', 'b_combo', 'p_combo']
// 外来音 — katakana only, one row per base kana (backend/content/
// kana_data.py groups them that way so they do not collide here).
const FOREIGN_ROWS = ['f_foreign', 'ti_foreign', 'tu_foreign', 'di_foreign',
                      'du_foreign', 'w_foreign', 'v_foreign']
// 長音 in hiragana: a vowel held by a second kana. Row is the first,
// column the second — えい is え's い. Most of that matrix does not
// occur, and the holes are the lesson.
const LONG_ROWS    = ['a_long', 'i_long', 'u_long', 'e_long', 'o_long']
const VOWEL_COLS   = ['a', 'i', 'u', 'e', 'o']
// The yōon chart is three columns, not five: や ゆ よ are the only kana
// that follow, so there is no い or え column to leave empty.
const YOON_COLS    = ['a', 'u', 'o']

// Column placement comes from the entry's own romaji rather than its
// position within its row-group: y/w rows skip columns for sounds
// that don't exist (no "yi", "ye", "wi", "wu", "we"), so counting
// 0/1/2 within the group would misalign them under the wrong vowel.
function vowelOf(romaji) {
	const last = romaji?.[romaji.length - 1]
	return VOWEL_COLS.includes(last) ? last : null
}

function SyllabaryTable({ rows, cols, jp, title, byGroup, narrow = false, tail, selected, setSelected }) {
	return (
		<div className="syllabary-table-wrap">
			{/* The chart's mark, then the chart. The mark names it in both
			    languages; the grid carries the same name for a screen
			    reader, which reads the group rather than the sign. */}
			<BlockMark jp={jp} name={title} />
			<div
				className={`syllabary-table${narrow ? ' syllabary-table--narrow' : ''}`}
				role="group"
				aria-label={title}
			>
				{rows.map(group => {
					const entries = byGroup[group] ?? []
					return (
						<Fragment key={group}>
							{cols.map(v => {
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
				    it sits alone on a last row of its own rather than
				    floating underneath the table as an orphan. */}
				{tail && (
					<button
						type="button"
						onClick={() => setSelected(tail)}
						className={`syllabary-cell syllabary-cell--kana${selected && entryKey(selected) === entryKey(tail) ? ' syllabary-cell--selected' : ''}`}
					>
						<span className="syllabary-cell__char">{tail.kana}</span>
						<span className="syllabary-cell__romaji">{tail.romaji}</span>
					</button>
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

	// 長音 is one chart in hiragana and a different one in katakana,
	// because the two spell it differently. Hiragana holds the vowel
	// with a second kana — えい, おう, ああ — so it needs the whole
	// あ→お matrix and the holes in it. Katakana writes one bar however
	// long the vowel and whatever it is (アー イー ウー エー オー), so it
	// is a single row, and a row that is the whole chart needs no head.
	const kataLong = Boolean(byGroup.long)
	const longRows = kataLong ? ['long'] : LONG_ROWS
	const hasYoon    = YOON_ROWS.some(g => byGroup[g]?.length)
	const hasForeign = FOREIGN_ROWS.some(g => byGroup[g]?.length)
	const hasLong    = longRows.some(g => byGroup[g]?.length)

	if (loading) return <Loading />

	return (
		<div className="dict-layout">
			<div className="dict-results-wrap">
				{/* Two columns of charts, side by side once there is room. A
				    五十音 table is five columns wide and no wider — stacked,
				    it left two thirds of a desktop empty and pushed 濁音
				    below the fold, when the two are meant to be read
				    against each other.

				    Which chart goes in which column is settled by the order
				    they stack in on a phone, where there is only one column
				    and the order IS the teaching order: 五十音, then the
				    long vowels it makes, then 濁音, 拗音 and the borrowed
				    sounds that build on those. Hiragana comes out of that
				    at sixteen rows a side; katakana's second column runs
				    on past the first, because 外来音 is its alone and it
				    has to sit after 拗音 rather than before it. Balancing
				    that would mean two orders — one for the columns, one
				    for the stack — and the phone's is the one that has to
				    be right. */}
				<div className="syllabary-chart-group" style={{ '--syl-accent': accentColor }}>
					<div className="syllabary-col">
						<SyllabaryTable
							rows={MAIN_ROWS}
							cols={VOWEL_COLS}
							jp="五十音"
							title={t.syllabaryMain}
							byGroup={byGroup}
							tail={nSolo}
							selected={selected}
							setSelected={setSelected}
						/>

						{hasLong && (
							<SyllabaryTable
								rows={longRows}
								cols={VOWEL_COLS}
								jp="長音"
								title={t.syllabaryLong}
								byGroup={byGroup}
								selected={selected}
								setSelected={setSelected}
							/>
						)}
					</div>

					<div className="syllabary-col">
						<SyllabaryTable
							rows={VOICED_ROWS}
							cols={VOWEL_COLS}
							jp="濁音"
							title={t.syllabaryVoiced}
							byGroup={byGroup}
							selected={selected}
							setSelected={setSelected}
						/>

						{hasYoon && (
							<SyllabaryTable
								rows={YOON_ROWS}
								cols={YOON_COLS}
								narrow
								jp="拗音"
								title={t.syllabaryYoon}
								byGroup={byGroup}
								selected={selected}
								setSelected={setSelected}
							/>
						)}

						{hasForeign && (
							<SyllabaryTable
								rows={FOREIGN_ROWS}
								cols={VOWEL_COLS}
								jp="外来音"
								title={t.syllabaryForeign}
								byGroup={byGroup}
								selected={selected}
								setSelected={setSelected}
							/>
						)}
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