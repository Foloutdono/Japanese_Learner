import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { saveBlob } from '../lib/platform'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { track } from '../lib/track'
import { Bar, Leave } from '../components/chrome/Bar'
import { Chip } from '../components/chrome/Console'
import { Sheet } from '../components/chrome/Sheet'
import { useTodaySummary } from '../stores/today'
import { dueByDeck } from '../domain/lanes'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import ImportCardsMenu from '../components/decks/ImportCardsMenu'
import BrowseCardsMenu from '../components/decks/BrowseCardsMenu'
import { deckTypeOf } from '../components/decks/deckTypes'
import { ImportIcon, ExportIcon, CheckCircleIcon, CrossIcon, CheckIcon, ChevronIcon, TrashIcon, CardIcon, LightbulbIcon, PlusIcon, SearchIcon, BooksIcon } from '../components/ui/Icons'

// The name the export endpoint chose, out of its Content-Disposition.
// Two forms arrive (RFC 6266): `filename*=UTF-8''...` percent-encoded,
// and a plain ASCII `filename="..."` fallback. The encoded one is
// preferred because a Japanese deck name survives only there — the
// fallback deliberately degrades to the deck id. Returns null rather
// than guessing, so the caller can name the file itself.
function filenameFromDisposition(header) {
  if (!header) return null
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim())
    } catch {
      // A malformed percent-sequence should not lose the download; fall
      // through to the ASCII parameter, which is always well-formed.
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(header)
  return plain ? plain[1] : null
}

// Mirrors decks.py's SOURCE_FOR_TYPE / _allowed_sources / _allows_custom
// exactly — kept in sync by hand since it's this small. This is only
// ever used to shape the UI (hide/show buttons, restrict the Browse
// tabs); decks.py enforces the real rule server-side regardless of
// what the frontend shows.
//
// A deck has ONE STRUCTURE, and it decides both halves: which app cards
// can be browsed in, and which personal cards can be written. `standard`
// is a plain front/back pair with no app source behind it.
const SOURCE_FOR_TYPE = { kanji: ['kanji'], vocab: ['vocab'], grammar: ['grammar'] }
const STRUCTURES = ['standard', 'kanji', 'vocab', 'grammar']

// A browsed-in card is tagged with the pigment of the section it came
// from — the same colours components/decks/deckTypes.js gives the deck
// types, so "this card is from 漢字" reads identically wherever it's
// shown.
const SOURCE_COLOR = {
  kanji: 'var(--line-kanji)',
  vocab: 'var(--line-vocab)',
  grammar: 'var(--line-grammar)',
}

function allowedSourcesFor(type) {
  return SOURCE_FOR_TYPE[type] ?? []
}

// EVERY structure accepts hand-written cards — of its own structure.
// This used to be the inverse: it returned false for kanji/vocab/grammar,
// so "Add card" was hidden on precisely the decks where a personal card
// of that kind belongs. A kanji deck was the one place you could not
// write your own kanji card.
function allowsCustomFor(type) {
  return STRUCTURES.includes(type)
}

// ── The radical field ─────────────────────────────────────────
// A kanji card carries the Kangxi radical NUMBER, and nobody remembers
// that 言 is 149 — so this shows the glyphs and stores the number.
//
// Reuses GET /api/dictionary/radicals, which the dictionary's browse-by-
// radical grid already serves, grouped by stroke count. That endpoint is
// scoped to radicals with at least one kanji in the app's own deck; a
// personal card may well use one outside that subset, so it is asked with
// ?all=true and falls back to whatever it returns.
function RadicalField({ label, value, onChange, session }) {
  const { t } = useLang()
  const [groups, setGroups] = useState(null)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    apiFetch('/api/dictionary/radicals?all=true', session)
      .then(r => r.json())
      .then(d => setGroups(d.groups ?? []))
      .catch(() => setGroups([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chosen = groups
    ?.flatMap(g => g.radicals)
    .find(r => r.number === Number(value))

  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{label} *</div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="field deckdetail-form__input deckdetail-form__radical-btn">
        {chosen
          ? <span><span lang="ja">{chosen.char}</span> · {chosen.number}</span>
          : <span className="deckdetail-form__placeholder">{t.pickRadical}</span>}
      </button>
      {open && (
        <div className="radical-picker">
          {(groups ?? []).map(g => (
            <div key={g.stroke_count} className="radical-picker__group">
              <div className="radical-picker__strokes">{g.stroke_count}</div>
              <div className="radical-picker__row">
                {g.radicals.map(r => (
                  <button key={r.number} type="button" lang="ja"
                    title={`${r.number}`}
                    className={`radical-picker__cell${Number(value) === r.number ? ' radical-picker__cell--on' : ''}`}
                    onClick={() => { onChange(r.number); setOpen(false) }}>
                    {r.char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Same combined cap study/structures.py enforces on save (kanji.readings'
// own quiz-side ReadingsInput.jsx carries the identical number for the
// same reason — see that component's comment) — checked here too so the
// form itself stops offering "+" before a save would silently trim the
// overflow instead.
const MAX_READINGS = 15

// ── The readings field (personal kanji cards) ─────────────────
// Two groups the learner grows one row at a time, mirroring
// kanji.readings' own quiz widget (components/study/ReadingsInput.jsx)
// almost exactly — this is the WRITE side of that same shape, so a
// personal kanji card can be studied with kanji.readings the same way
// an app one is: type every on'yomi/kun'yomi you know, submit, see
// what you got. `value` is {on: string[], kun: string[]}; `onChange`
// always receives the whole object back.
function ReadingsField({ label, value, onChange }) {
  const { t } = useLang()
  const on  = value?.on  ?? []
  const kun = value?.kun ?? []
  const total = on.length + kun.length
  const full  = total >= MAX_READINGS

  function setRow(kind, i, v) {
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: rows.map((r, j) => (j === i ? v : r)) })
  }
  function addRow(kind) {
    if (full) return
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: [...rows, ''] })
  }
  function removeRow(kind, i) {
    const rows = kind === 'on' ? on : kun
    onChange({ on, kun, [kind]: rows.filter((_, j) => j !== i) })
  }

  const GROUPS = [
    { kind: 'on',  label: t.readingsOn,  jp: '音読み', rows: on },
    { kind: 'kun', label: t.readingsKun, jp: '訓読み', rows: kun },
  ]

  return (
    <div className="deckdetail-form__group">
      <div className="deckdetail-form__label">{label} *</div>
      {GROUPS.map(g => (
        <div key={g.kind} className="readings-field__group">
          <div className="readings-field__label">
            <span lang="ja">{g.jp}</span> <span>{g.label}</span>
          </div>
          {g.rows.map((v, i) => (
            <div key={i} className="readings-field__row">
              <input
                value={v}
                onChange={e => setRow(g.kind, i, e.target.value)}
                placeholder={t.readingsPlaceholder}
                className="field deckdetail-form__input"
                lang="ja"
              />
              <button
                type="button"
                onClick={() => removeRow(g.kind, i)}
                className="readings-field__remove"
                aria-label={t.delete}
                title={t.delete}
              >
                <CrossIcon size={12} />
              </button>
            </div>
          ))}
          {!full && (
            <button type="button" onClick={() => addRow(g.kind)} className="deckdetail-form__addline">
              + {g.label}
            </button>
          )}
        </div>
      ))}
      {full && <div className="readings-field__cap">{t.readingsCap}</div>}
    </div>
  )
}

export default function DeckDetailScreen({ session }) {
  const navigate        = useNavigate()
  const { deck_id }     = useParams()
  const { state }       = useLocation()
  const { t, lang }     = useLang()

  // Falls back to fetching the deck when opened without router state
  // (a refresh, a direct link) — needed now that a deck's `type`
  // actually restricts what can be added to it, so the UI has to know
  // it reliably rather than silently defaulting to "allow everything"
  // whenever state happens to be missing.
  const [deck, setDeck] = useState(state?.deck ?? null)

  const loadDeck = useCallback(() => {
    apiFetch(`/api/decks/${deck_id}`, session)
      .then(r => r.json())
      .then(d => { if (!d?.error) setDeck(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  useEffect(() => {
    // Keyed on deck_id, and it has to CLEAR before it loads.
    //
    // This screen does not unmount when one deck id becomes another —
    // same route, different param — so whatever was in state stays on
    // screen under the new id until the fetch lands. Nothing used to
    // navigate deck-to-deck, so nothing noticed; "make it mine" does it
    // on every use, and showed the followed deck's author, its
    // withdrawn warning and its follower chips over the fresh copy.
    //
    // The router state is trusted only when it is about THIS deck and
    // carries a role: the shelf passes the row it already has (no
    // flash, no round trip), a refresh or a direct link passes nothing.
    const carried = state?.deck
    const usable = carried && String(carried.id) === String(deck_id) && carried.role
      ? carried
      : null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting or clearing the deck IS the synchronisation with the route param, not a derived-state reset.
    setDeck(usable)
    if (!usable) loadDeck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  // A followed deck is READ-ONLY here. The server enforces it (403 on
  // every write), and the screen must not offer what the server will
  // refuse — "Make it mine" is the door, and it is the one thing the
  // chip row offers instead.
  const isFollower = deck?.role === 'follower'
  const withdrawn  = Boolean(deck?.withdrawn)

  const allowedSources = isFollower ? [] : allowedSourcesFor(deck?.type)
  const allowCustom    = !isFollower && allowsCustomFor(deck?.type)
  const dt             = deckTypeOf(deck?.type, t)

  const [cards, setCards]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({})
  const [notes, setNotes]           = useState('')
  // The card shapes, fetched rather than duplicated: the add-card form is
  // GENERATED from the same spec the API validates against, so a field
  // added on the backend appears here without a matching edit. See
  // study/structures.py and GET /api/decks/structures.
  const [structures, setStructures] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [showBrowse, setShowBrowse] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // The More sheet (plan 071): import, export and the deck's own
  // deletion, which used to sit on the shelf's card.
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmingDeck, setConfirmingDeck] = useState(false)
  // The follower's two irreversibles, each behind its own ask.
  const [confirmingUnfollow, setConfirmingUnfollow] = useState(false)
  const [confirmingMine, setConfirmingMine] = useState(false)
  // The hand-written card a remove is waiting on — see askRemove.
  const [confirmingCard, setConfirmingCard] = useState(null)
  const today = useTodaySummary().data
  const dueToday = dueByDeck(today).get(String(deck_id)) ?? 0

  function deleteDeck() {
    playUi('click-screen-selection')
    apiFetch(`/api/decks/${deck_id}`, session, { method: 'DELETE' })
      .then(() => navigate('/learn/decks'))
      .catch(() => setConfirmingDeck(false))
  }

  // ── The library, from the deck's own page ───────────────────
  const [busy, setBusy] = useState(false)

  function publish(on) {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiFetch(`/api/decks/${deck_id}/publish`, session, { method: on ? 'POST' : 'DELETE' })
      .then(r => r.json())
      .then(body => {
        track(on ? 'deck_publish' : 'deck_unpublish', on
          ? { structure: deck?.type, cards: cards.length }
          : { structure: deck?.type, followers: body?.followers ?? 0 })
        setMoreOpen(false)
        setBusy(false)
        loadDeck()
      })
      .catch(() => { setBusy(false); setMoreOpen(false) })
  }

  function unfollow() {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiFetch(`/api/decks/${deck_id}/subscribe`, session, { method: 'DELETE' })
      .then(() => navigate('/learn/decks'))
      .catch(() => { setBusy(false); setConfirmingUnfollow(false) })
  }

  function makeItMine() {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiFetch(`/api/decks/${deck_id}/detach`, session, { method: 'POST' })
      .then(r => r.json())
      .then(copy => {
        if (!copy?.id) throw new Error('detach failed')
        track('deck_detach', {
          structure: deck?.type, cards: cards.length, withdrawn,
        })
        navigate(`/learn/decks/${copy.id}`, { replace: true, state: { deck: copy } })
      })
      .catch(() => { setBusy(false); setConfirmingMine(false) })
  }

  // Everything transient, cleared when one deck id becomes another.
  //
  // The deck and its cards are reloaded above; this is the rest of the
  // screen — which sheet is open, what is selected, whether a request
  // is in flight. None of it ever mattered before, because nothing
  // navigated from one deck to another without unmounting. "Make it
  // mine" does, and it left `busy` true and its own confirm sheet
  // standing over the fresh copy: the next action on that screen —
  // publishing it — returned at `if (busy)` and looked like a dead
  // button.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- this IS the route param's synchronisation; see the deck effect above. */
    setBusy(false)
    setMoreOpen(false)
    setConfirmingDeck(false)
    setConfirmingMine(false)
    setConfirmingUnfollow(false)
    setConfirmingCard(null)
    setConfirmingDelete(false)
    setSelectMode(false)
    setSelected(new Set())
    setAdding(false)
    setEditing(null)
    setImportResult(null)
    setExportError(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [deck_id])


  // [deck_id], not []: see the deck effect above — the cards belong to
  // a deck id, and this screen outlives a change of one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCards() }, [deck_id])

  // Stable identities so ImportCardsMenu/BrowseCardsMenu's useDialog
  // doesn't re-run its focus-on-open effect (and steal focus) on every
  // re-render of this screen while one of them is open.
  const closeImport = useCallback(() => setShowImport(false), [])
  const closeBrowse = useCallback(() => setShowBrowse(false), [])

  // Fetched rather than linked: the endpoint needs the bearer token, and
  // a bare <a href> to /api/... sends no Authorization header, so it
  // would 401 — or, with DEV_USER_ID set locally, quietly succeed as the
  // dev user and look like it worked everywhere it doesn't.
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  async function exportDeck() {
    playUi('click-mode-selection')
    setExportError(false)
    setExporting(true)
    try {
      const res = await apiFetch(`/api/decks/${deck_id}/export?lang=${lang}`, session)
      if (!res.ok) throw new Error(`export failed: ${res.status}`)
      const blob = await res.blob()
      // The server already sanitised this — a deck name is user-authored
      // and frequently Japanese, so it arrives percent-encoded. A
      // download on the web, the share sheet in the shell (plan 076;
      // lib/platform.js keeps Safari's next-tick revoke).
      const filename = filenameFromDisposition(res.headers.get('Content-Disposition'))
        || `deck-${deck_id}.csv`
      await saveBlob(blob, filename)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  function fetchCards() {
    apiFetch(`/api/decks/${deck_id}/cards`, session)
      .then(r => r.json())
      .then(data => { setCards(data.cards || []); setLoading(false) })
      // Same fix as DecksScreen's fetchDecks — a failed request used
      // to leave `loading` true forever instead of settling into the
      // (empty) card list / Empty.
      .catch(() => setLoading(false))
  }

  // Custom cards are keyed by their own numeric id; app-sourced cards
  // (added via Browse) have no id of their own — they're identified
  // by (source, raw_id) instead — so every card in the combined list
  // needs one stable key regardless of where it came from.
  function cardKey(card) {
    return card.origin === 'app' ? `app:${card.source}:${card.raw_id}` : `custom:${card.id}`
  }

  function deleteCard(card) {
    if (card.origin === 'app') {
      const params = new URLSearchParams({ source: card.source, raw_id: card.raw_id })
      return apiFetch(`/api/decks/${deck_id}/cards/app?${params.toString()}`, session, { method: 'DELETE' })
    }
    return apiFetch(`/api/decks/${deck_id}/cards/${card.id}`, session, { method: 'DELETE' })
  }

  // The row's own remove. The editor cannot outlive the card it edits:
  // deleting the row you have open would leave the form saving to an
  // id the server no longer knows.
  function removeCard(card) {
    playUi('click-screen-selection')
    setConfirmingCard(null)
    if (card.origin === 'custom' && editing === card.id) {
      setAdding(false)
      setEditing(null)
      resetForm()
    }
    return deleteCard(card).then(fetchCards)
  }

  // What the trash does, and it depends on what the card is. A
  // browsed-in card is a LINK: removing it loses nothing the app does
  // not still hold, and Browse puts it back in two taps. A hand-written
  // one is the learner's own text and there is no undo, so it asks
  // first — in the sheet, named, the way the deck's own deletion asks
  // eight lines below.
  function askRemove(card) {
    playUi('click-mode-selection')
    if (card.origin === 'custom') setConfirmingCard(card)
    else removeCard(card)
  }

  // The spec for THIS deck, or null until it arrives. A deck holds one
  // structure, so there is nothing for the learner to pick.
  const structure = structures?.find(x => x.key === (deck?.type ?? 'standard'))
    ?? structures?.find(x => x.key === 'standard')
    ?? null

  useEffect(() => {
    apiFetch('/api/decks/structures', session)
      .then(r => r.json())
      .then(d => setStructures(d.structures ?? []))
      .catch(() => setStructures([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function blankForm(spec) {
    const out = {}
    for (const f of spec?.fields ?? []) {
      if (f.kind === 'lines') out[f.key] = ['']
      else if (f.kind === 'readings') out[f.key] = { on: [''], kun: [''] }
      else out[f.key] = ''
    }
    return out
  }

  function resetForm() { setForm(blankForm(structure)); setNotes('') }

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function setLine(key, i, value) {
    setForm(f => ({ ...f, [key]: (f[key] ?? []).map((v, j) => (j === i ? value : v)) }))
  }

  function addLine(key) { setForm(f => ({ ...f, [key]: [...(f[key] ?? []), ''] })) }

  /** Whether every required field carries something — mirrors
   *  structures.missing_required, which is what actually enforces it. */
  function formComplete() {
    return (structure?.fields ?? []).every(f => {
      if (!f.required) return true
      const v = form[f.key]
      if (f.kind === 'readings') {
        return (v?.on ?? []).some(x => x.trim()) || (v?.kun ?? []).some(x => x.trim())
      }
      return Array.isArray(v) ? v.some(x => x.trim()) : String(v ?? '').trim()
    })
  }

  function startAdd() { resetForm(); setEditing(null); setAdding(true) }

  function startEdit(card) {
    setForm({ ...blankForm(structure), ...(card.fields ?? {}) })
    setNotes(card.notes || '')
    setEditing(card.id)
    setAdding(true)
  }

  function saveCard() {
    if (!formComplete()) return
    const body = JSON.stringify({ fields: form, notes })
    if (editing) {
      apiFetch(`/api/decks/${deck_id}/cards/${editing}`, session, {
        method: 'PUT',
        body,
      })
        .then(r => r.json())
        .then(updated => {
          setCards(prev => prev.map(c => (c.origin === 'custom' && c.id === editing) ? { ...updated, origin: 'custom' } : c))
          setAdding(false)
          setEditing(null)
          resetForm()
        })
    } else {
      apiFetch(`/api/decks/${deck_id}/cards`, session, {
        method: 'POST',
        body,
      })
        .then(r => r.json())
        .then(card => { setCards(prev => [...prev, card]); resetForm() })
    }
  }

  function toggleSelect(key) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // `cards.length > 0` guards the empty deck, where "none selected" and
  // "all selected" are the same number and the tick would open on.
  const allSelected = cards.length > 0 && selected.size === cards.length

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(cards.map(cardKey)))
  }

  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); setConfirmingDelete(false) }

  async function deleteSelected() {
    // Asked in the app's own sheet (see confirmingDelete), the same one
    // a single card and the deck itself are asked in — never the
    // browser's confirm(), which was the last OS-native surface here.
    playUi('click-screen-selection')
    setConfirmingDelete(false)
    for (const card of cards) {
      if (!selected.has(cardKey(card))) continue
      await deleteCard(card)
    }
    setCards(prev => prev.filter(c => !selected.has(cardKey(c))))
    exitSelectMode()
  }

  async function handleImport(cards) {
    for (const card of cards) {
      await apiFetch(`/api/decks/${deck_id}/cards`, session, {
        method: 'POST',
        body: JSON.stringify({ front: card.front, back: card.back, hint: card.hint || '', notes: '' }),
      })
    }
    setImportResult({ inserted: cards.length })
    setShowImport(false)
    fetchCards()
  }

  const addLabel = String(t.addCard).replace(/^\+\s*/, '')

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      <Bar
        code="KZ"
        color="var(--line-decks)"
        title={t.decks}
        aside={<Leave onClick={() => navigate('/learn/decks')}>{t.leaveDecks}</Leave>}
      />

      {/* The deck, named on its own page: the same roundel, glyph and
          pigment as its card on the shelf, the figures, and the one
          filled action. */}
      <div className="deck-identity" style={{ '--rail': dt.color }}>
        <span className="wmap-roundel deck-identity__roundel" lang="ja" aria-hidden="true" style={{ '--line-color': dt.color }}>{dt.glyph}</span>
        <span className="deck-identity__names">
          <h2 className="deck-identity__name">{deck?.name ?? t.deckFallbackTitle}</h2>
          <span className="deck-identity__meta">
            {dt.label} · {t.cardsCount(cards.length)}
            {/* Whose deck this is, on the page you study it from and not
                only on the card you found it by. A followed deck's
                content is someone else's, and that is worth saying
                where its cards are. */}
            {deck?.author && <> · <span className="lib-card__author">{t.libraryBy(deck.author)}</span></>}
            {dueToday > 0 && <> · <span className="deck-identity__due">{t.todayDue(dueToday)}</span></>}
          </span>
        </span>
        <button
          type="button"
          className="btn-primary deck-identity__study"
          onClick={() => { playUi('click-screen-selection'); navigate(`/learn/decks/${deck_id}/study`, { state: { deck } }) }}
        >
          ▶ {t.study}
        </button>
      </div>

      {/* Warn, then vanish. The author has deleted this deck; it is
          still here only so the people following it can take a copy
          before it is collected. Study still works — that is the whole
          point of the grace period. */}
      {withdrawn && (
        <p className="lib-warning" role="status">
          <span className="lib-warning__lead">{t.libraryWithdrawn}</span>
          {t.libraryWithdrawnHint}
        </p>
      )}

      {/* The chip row: what you can do to the deck. Select swaps it
          for the selection's own console (below). */}
      {!selectMode && isFollower && (
        <div className="chip-row">
          <Chip onClick={() => { playUi('click-mode-selection'); setConfirmingMine(true) }}
            aria-haspopup="dialog" disabled={busy}>
            <PlusIcon size={14} />{t.libraryMakeMine}
          </Chip>
          <Chip onClick={() => { playUi('click-mode-selection'); setConfirmingUnfollow(true) }}
            aria-haspopup="dialog" disabled={busy}>
            <CrossIcon size={14} />{withdrawn ? t.libraryRemove : t.libraryUnfollow}
          </Chip>
          {cards.length > 0 && (
            <Chip onClick={() => { playUi('click-mode-selection'); exportDeck() }} disabled={exporting}>
              <ExportIcon size={14} />{t.export}
            </Chip>
          )}
        </div>
      )}

      {!selectMode && !isFollower && (
        <div className="chip-row">
          {allowCustom && (
            <Chip onClick={() => { playUi('click-mode-selection'); startAdd() }}><PlusIcon size={14} />{addLabel}</Chip>
          )}
          {allowedSources.length > 0 && (
            <Chip onClick={() => { playUi('click-mode-selection'); setShowBrowse(true) }}><SearchIcon size={14} />{t.browseBtn}</Chip>
          )}
          {cards.length > 0 && (
            <Chip onClick={() => { playUi('click-mode-selection'); setSelectMode(true) }}><CheckIcon size={14} />{t.select}</Chip>
          )}
          <Chip onClick={() => { playUi('click-mode-selection'); setMoreOpen(true) }} aria-haspopup="dialog">
            <span className="chip__dots" aria-hidden="true">···</span>{t.deckMore}
          </Chip>
        </div>
      )}

      {/* ── The selection console ──────────────────────────────
          The four controls used to be a bare .chip-row: a caption, a
          chip, a filled Delete and a Cancel, all four different
          shapes, wrapping into a ragged two lines on a phone with the
          destructive one the largest object on the screen — and a
          second FILLED button on a screen that already has ▶ Study,
          which DESIGN.md allows exactly one of.

          It is the console's own grammar instead (Decks, Dictionary,
          Today): one panel, two rows on a hairline. Row 1 is the
          choice — the tick that takes all of them, and how many are
          held, pinned right as a figure. Row 2 is what you can do
          with them, two chips sharing the width. The tick is the same
          mark the rows below carry, so "all of them" and "this one"
          are visibly the same act.

          Delete is a ghost here and fills only in the sheet that asks
          — the same escalation the deck's own deletion uses, and now
          the same sheet-shaped question for all three of them. */}
      {selectMode && (
        <div className="select-console" role="group" aria-label={t.select}>
          <div className="select-console__top">
            <button
              type="button"
              className="select-console__all"
              aria-pressed={allSelected}
              onClick={() => { playUi('click-mode-selection'); toggleSelectAll() }}
            >
              <span className={`card-row__tick${allSelected ? ' card-row__tick--on' : ''}`} aria-hidden="true">
                {allSelected && <CheckIcon size={11} />}
              </span>
              {allSelected ? t.deselectAll : t.selectAll}
            </button>
            <span className="select-console__count">
              <span className="select-console__fig">{selected.size}</span>
              <span className="select-console__total">/ {cards.length}</span>
            </span>
          </div>
          <div className="select-console__acts">
            <Chip
              className="chip--danger"
              disabled={selected.size === 0}
              onClick={() => { playUi('click-mode-selection'); setConfirmingDelete(true) }}
            >
              <TrashIcon size={14} />{t.delete}
            </Chip>
            <Chip onClick={() => { playUi('click-mode-selection'); exitSelectMode() }}>
              <CrossIcon size={14} />{t.cancel}
            </Chip>
          </div>
        </div>
      )}

      {/* Import success banner */}
      {importResult && (
        <div className="deckdetail-import-banner">
          <div className="deckdetail-import-banner__text">
            <CheckCircleIcon size={15} /> {importResult.inserted} {t.cards}
          </div>
          <button onClick={() => setImportResult(null)} className="deckdetail-import-banner__close" aria-label={t.close}>
            <CrossIcon size={14} />
          </button>
        </div>
      )}

      {/* A failed export is otherwise completely silent — the browser
          simply never offers a file, which reads as a dead button. */}
      {exportError && (
        <div className="deckdetail-import-banner deckdetail-import-banner--error">
          <div className="deckdetail-import-banner__text">
            <CrossIcon size={15} /> {t.exportFailed}
          </div>
          <button onClick={() => setExportError(false)} className="deckdetail-import-banner__close" aria-label={t.close}>
            <CrossIcon size={14} />
          </button>
        </div>
      )}

        {/* Add / Edit form — one input per field the structure
            declares (GET /api/decks/structures), on the canvas's form. */}
        {adding && (
          <div className="form deckdetail-form">
            <span className="form__label">
              {editing ? t.editCard : t.newCard}
            </span>
            <div className="deckdetail-form__fields">
              {/* One input per field the structure declares. A kanji card
                  asks for four things and a standard card for two, from
                  one definition rather than a branch per deck type. */}
              {(structure?.fields ?? []).map(f => {
                const label = t[`field_${f.key}`] ?? f.key
                if (f.kind === 'lines') {
                  const rows = form[f.key] ?? ['']
                  return (
                    <div key={f.key} className="deckdetail-form__group">
                      <div className="deckdetail-form__label">{label}</div>
                      {rows.map((v, i) => (
                        <input key={i} value={v}
                          onChange={e => setLine(f.key, i, e.target.value)}
                          placeholder={label}
                          className="field deckdetail-form__input" />
                      ))}
                      <button type="button" onClick={() => addLine(f.key)}
                        className="deckdetail-form__addline">+ {label}</button>
                    </div>
                  )
                }
                if (f.picker === 'radical') {
                  return (
                    <RadicalField key={f.key} label={label} session={session}
                      value={form[f.key]} onChange={v => setField(f.key, v)} />
                  )
                }
                if (f.kind === 'readings') {
                  return (
                    <ReadingsField key={f.key} label={label}
                      value={form[f.key]} onChange={v => setField(f.key, v)} />
                  )
                }
                return (
                  <input key={f.key} value={form[f.key] ?? ''}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.required ? `${label} *` : label}
                    className="field deckdetail-form__input" />
                )
              })}
              {/* notes is on every structure and never shown during a
                  card — unlike the `hint` it replaces, which appeared
                  mid-quiz as help nobody asked for. */}
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
                onKeyDown={e => e.key === 'Enter' && saveCard()}
                className="field deckdetail-form__input" />
            </div>
            <div className="form__row">
              {/* Cancel first, Save last: the row is right-aligned now
                  (see .deckdetail-form__actions), so the confirming
                  action sits at the edge the eye and the thumb both end
                  on, and the order matches DeckDetail.dc.html:144-147.
                  Neither carries a class of its own any more — 052 left
                  them one for `flex: 1`, and dropping the stretch left
                  nothing this file needs to say about them. */}
              <button onClick={() => { setAdding(false); setEditing(null); resetForm() }}
                className="btn-secondary">
                {t.cancel}
              </button>
              <button onClick={saveCard} disabled={!formComplete()}
                className="btn-primary">
                {editing ? t.save : t.addCard}
              </button>
            </div>
          </div>
        )}

        {loading && <Loading />}

        {!loading && cards.length === 0 && !adding && (
          <Empty icon={<CardIcon size={40} />} message={t.noCards} hint={t.addFirstCard} />
        )}

        {/* The cards as rows: the entry at the size the app shows
            Japanese everywhere else, the reading under it, the meaning
            beside. A hand-written card opens its editor; a browsed-in
            one is read-only here (its SRS progress is shared with the
            rest of the app) and wears the level it was filed under.
            Either can be taken out of the deck from its own row. */}
        {!loading && cards.length > 0 && (
          <div className="card-list">
            {cards.map(card => {
              const key   = cardKey(card)
              const isSel = selected.has(key)
              // The row's BODY is what you press — its own tick in
              // select mode, a hand-written card's editor otherwise —
              // and the remove sits beside it rather than inside it,
              // because a button cannot nest in a button.
              // A followed deck's rows open nothing: the editor behind
              // them writes to the author's card, which the server
              // refuses. Offering it and then failing is worse than not
              // offering it.
              const opens = !isFollower && (selectMode || card.origin === 'custom')
              const Body = opens ? 'button' : 'div'
              const bodyProps = opens
                ? {
                  type: 'button',
                  onClick: selectMode ? () => toggleSelect(key) : () => startEdit(card),
                  'aria-pressed': selectMode ? isSel : undefined,
                }
                : {}
              return (
                <div key={key} className={`card-row${isSel ? ' card-row--selected' : ''}`}>
                  <Body className="card-row__body" {...bodyProps}>
                    {selectMode && (
                      <span className={`card-row__tick${isSel ? ' card-row__tick--on' : ''}`} aria-hidden="true">
                        {isSel && <CheckIcon size={11} />}
                      </span>
                    )}
                    <span className="card-row__front">
                      <span className="card-row__jp" lang="ja">{card.front}</span>
                      {card.kana && <span className="card-row__kana" lang="ja">{card.kana}</span>}
                    </span>
                    <span className="card-row__back">
                      {card.back}
                      {(card.hint || card.notes) && (
                        <span className="card-row__note">
                          {card.hint && <><LightbulbIcon size={11} /> {card.hint}</>}
                          {card.hint && card.notes ? ' · ' : ''}
                          {card.notes}
                        </span>
                      )}
                    </span>
                    {/* The level alone. The source was printed beside it
                        ("VOCABULARY · N5") until the badge was costing a
                        third of the row on a phone — and saying what the
                        deck's own type already says, in a deck that only
                        accepts one source. The pigment still names it. */}
                    {card.origin === 'app' && (
                      <span
                        className="card-row__badge"
                        style={{ '--rail': SOURCE_COLOR[card.source] ?? 'var(--text-secondary)' }}
                      >
                        {card.level
                          || ({ kanji: t.kanjiType, vocab: t.vocabType, grammar: t.grammarType }[card.source] ?? card.source)}
                      </span>
                    )}
                    {!selectMode && card.origin === 'custom' && (
                      <ChevronIcon direction="right" size={14} className="card-row__go" />
                    )}
                  </Body>
                  {/* Every row, not just the browsed-in ones: taking one
                      hand-written card out used to mean Select → tick →
                      Delete → confirm, four steps for one row, and nothing
                      on the row itself said it could go. */}
                  {!selectMode && !isFollower && (
                    <button
                      type="button"
                      onClick={() => askRemove(card)}
                      className="card-row__remove"
                      aria-label={t.delete}
                      title={t.delete}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* The More sheet: what the shelf's card used to carry. */}
      <Sheet open={confirmingMine} onClose={() => setConfirmingMine(false)}
        jp={deck?.name ?? t.deckFallbackTitle} cap={t.libraryMakeMine}>
        <span className="sheet__q">{t.libraryMakeMineConfirm}</span>
        <button type="button" className="btn-primary" disabled={busy} onClick={makeItMine}>
          {t.libraryMakeMine}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmingMine(false)}>
          {t.cancel}
        </button>
      </Sheet>

      <Sheet open={confirmingUnfollow} onClose={() => setConfirmingUnfollow(false)}
        jp={deck?.name ?? t.deckFallbackTitle}
        cap={withdrawn ? t.libraryRemove : t.libraryUnfollow}>
        <span className="sheet__q">
          {withdrawn ? t.libraryRemoveConfirm : t.libraryUnfollowConfirm}
        </span>
        <button type="button" className="btn-primary btn-primary--danger" disabled={busy}
          onClick={unfollow}>
          {withdrawn ? t.libraryRemove : t.libraryUnfollow}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmingUnfollow(false)}>
          {t.cancel}
        </button>
      </Sheet>

      <Sheet open={moreOpen} onClose={() => { setMoreOpen(false); setConfirmingDeck(false) }} jp={deck?.name ?? t.deckFallbackTitle} cap={t.deckMore}>
        {allowCustom && (
          <button type="button" className="btn-secondary" onClick={() => { setMoreOpen(false); setShowImport(true) }}>
            <ImportIcon size={14} /> {t.import}
          </button>
        )}
        {cards.length > 0 && (
          <button type="button" className="btn-secondary" disabled={exporting} onClick={() => { setMoreOpen(false); exportDeck() }}>
            <ExportIcon size={14} /> {t.export}
          </button>
        )}
        {/* The library, from the deck that goes into it. Publishing is
            not an action on the shelf card — the card is one whole
            button into the deck — and it is not a chip either: the chip
            row is what you do to the CARDS. */}
        {cards.length > 0 && deck?.visibility !== 'public' && (
          <button type="button" className="btn-secondary" disabled={busy}
            onClick={() => publish(true)}>
            <BooksIcon size={14} /> {t.libraryPublish}
          </button>
        )}
        {deck?.visibility === 'public' && (
          <>
            {/* A statement, not a question: .sheet__q is what the
                sheet ASKS, and there is nothing to answer here. */}
            <span className="lib-note">{t.libraryPublished}</span>
            <button type="button" className="btn-secondary" disabled={busy}
              onClick={() => publish(false)}>
              <CrossIcon size={14} /> {t.libraryUnpublish}
            </button>
          </>
        )}
        {confirmingDeck ? (
          <>
            <span className="sheet__q">
              {deck?.followers > 0
                ? t.libraryDeleteFollowed(deck.followers)
                : t.deleteDeckConfirm}
            </span>
            <button type="button" className="btn-primary btn-primary--danger" onClick={deleteDeck}>
              <TrashIcon size={14} /> {t.delete}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmingDeck(false)}>{t.cancel}</button>
          </>
        ) : (
          /* The sheet's own one action, so it is filled — the ghost it
             was set raw --danger as TEXT, which is 2.11:1 on this
             ground in dark and read as a warning label rather than a
             button. Import and Export beside it stay ghosts; the
             screen's filled ▶ Study is behind the scrim. */
          <button type="button" className="btn-primary btn-primary--danger" onClick={() => setConfirmingDeck(true)}>
            <TrashIcon size={14} /> {t.deleteDeck}
          </button>
        )}
      </Sheet>

      {/* One card's deletion, asked the same way the deck's is: the
          card named at the head of the sheet, so "this card" is not a
          pronoun with nothing to point at. */}
      <Sheet
        open={confirmingCard != null}
        onClose={() => setConfirmingCard(null)}
        jp={confirmingCard?.front}
        cap={t.delete}
      >
        <span className="sheet__q">{t.deleteCardConfirm}</span>
        <button type="button" className="btn-primary btn-primary--danger" onClick={() => removeCard(confirmingCard)}>
          <TrashIcon size={14} /> {t.delete}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmingCard(null)}>{t.cancel}</button>
      </Sheet>

      {/* The selection's deletion, asked in the same sheet — the count
          stands where one card puts its own front, because that is
          what is about to go. It was a question squeezed into the
          toolbar between two chips, which is the one deletion of the
          three the app asked a different way. */}
      <Sheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        jp={t.cardsCount(selected.size)}
        cap={t.delete}
      >
        <span className="sheet__q">{t.deleteCardsConfirm}</span>
        <button type="button" className="btn-primary btn-primary--danger" onClick={deleteSelected}>
          <TrashIcon size={14} /> {t.delete}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setConfirmingDelete(false)}>{t.cancel}</button>
      </Sheet>

      {showImport && (
        <ImportCardsMenu onImport={handleImport} onClose={closeImport} />
      )}

      {showBrowse && (
        <BrowseCardsMenu
          deckId={deck_id}
          deckType={deck?.type}
          session={session}
          onAdded={fetchCards}
          onClose={closeBrowse}
        />
      )}
    </main>
  )
}