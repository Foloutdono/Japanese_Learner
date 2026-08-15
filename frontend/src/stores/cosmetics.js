import { useEffect } from 'react'
import { useProfileSummary } from './profileSummary'

// ── 蔵 — cosmetics, applied app-wide from one place ────────
// The equipped loadout has to reach the study cards on six different
// screens, the profile ring, and every stage seal in the app. Rather
// than thread a prop through all of them — or teach each screen to
// fetch its own loadout — the whole system is a set of three
// attributes stamped onto <html>:
//
//   <html data-paper="paper_unryu" data-ring="ring_enso" data-seal="seal_kin">
//
// and the CSS keys off those (`:root[data-paper="paper_unryu"]` sets
// the --paper-* custom properties that .prompt-card already reads).
// One mount point, no prop drilling, and a screen that knows nothing
// about cosmetics still renders them correctly.
//
// The loadout rides along on /api/profile (see routes/cosmetics.py's
// summary_for), which useProfileSummary already fetches and caches
// for the level ring — so this costs no extra request.

// Mirrors srs/cosmetics.py's RANKS. Kept in sync by hand, same as
// quizModes.js mirrors quiz_modes.py — the frontend needs the labels
// to render "reach 初段" on a locked item, and shipping the whole
// ladder on every profile fetch to avoid a 20-entry array would be a
// worse trade.
export const RANK_LABELS = [
  '十級', '九級', '八級', '七級', '六級', '五級', '四級', '三級', '二級', '一級',
  '初段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段',
]

// Mirrors srs/cosmetics.py's SLOTS, in the same order: outward from
// the card you're looking at to the room you're sitting in.
export const SLOTS = ['paper', 'ring', 'seal', 'title', 'backdrop', 'flourish', 'brush', 'mcq']

export const DEFAULT_LOADOUT = {
  paper:    'paper_washi',
  ring:     'ring_hosomichi',
  seal:     'seal_shu',
  title:    'title_minarai',
  backdrop: 'backdrop_muji',
  flourish: 'flourish_tsuke',
  brush:    'brush_sumi',
  mcq:      'mcq_hyoji',
}

// Everything except `title`, which is text the profile renders
// directly and so never becomes an attribute. The rest all resolve to
// CSS custom properties keyed off <html>'s attributes — including
// `brush`, whose colour and weight the drawing pad reads back out of
// the computed style rather than keeping its own copy.
const THEMED_SLOTS = ['paper', 'ring', 'seal', 'backdrop', 'flourish', 'brush', 'mcq']

// 祝 — the one part of a cosmetic that can't be CSS: the character
// struck in the middle of the reward. Keyed by id, defaulting to the
// original 気 so an unknown id (a catalogue edit deployed ahead of the
// frontend) degrades to the stock toast instead of a blank.
const FLOURISH_GLYPH = {
  flourish_tsuke:    '気',
  flourish_hanabi:   '華',
  flourish_koban:    '両',
  flourish_sakura:   '桜',
  flourish_kaminari: '雷',
  flourish_kitsune:  '狐',
  flourish_matsuri:  '祭',
  flourish_ryu:      '龍',
  flourish_hoo:      '鳳',
}

export function flourishGlyph(id) {
  return FLOURISH_GLYPH[id] ?? FLOURISH_GLYPH.flourish_tsuke
}

export function applyLoadout(loadout) {
  const root = document.documentElement
  THEMED_SLOTS.forEach(slot => {
    root.setAttribute(`data-${slot}`, loadout?.[slot] ?? DEFAULT_LOADOUT[slot])
  })
}

// Rendered once, near the root (see App.jsx). Renders nothing — it
// exists purely to keep <html>'s cosmetic attributes in step with the
// cached profile summary, including after an equip elsewhere in the
// app pushes a new summary into the shared store.
export function CosmeticTheme() {
  const summary = useProfileSummary()
  const loadout = summary?.cosmetics?.loadout

  useEffect(() => {
    applyLoadout(loadout)
  }, [loadout])

  return null
}

export function useLoadout() {
  const summary = useProfileSummary()
  return summary?.cosmetics?.loadout ?? DEFAULT_LOADOUT
}

// The equipped 称号 if the user picked one, otherwise null — callers
// fall back to levelTitle() (the automatic rank everybody gets) so
// there's always something under the name.
export function equippedTitle(summary) {
  const id = summary?.cosmetics?.loadout?.title
  return !id || id === DEFAULT_LOADOUT.title ? null : id
}

// Renders the "how do I get this" line for a locked item. `t` supplies
// one formatter per metric; anything unmapped falls back to the raw
// numbers rather than rendering "undefined".
export function requirementText(t, req) {
  if (!req) return ''
  const fn = t.cosmeticReq?.[req.metric]
  if (typeof fn !== 'function') return `${req.current} / ${req.target}`
  return fn(req.metric === 'rank_index' ? (RANK_LABELS[req.target] ?? req.target) : req.target)
}

// The counter under a locked item's progress bar. Everything is a
// plain "12 / 50" except rank, where the raw numbers are ladder
// *indices* — "4 / 10" tells a reader nothing, and worse, implies
// they're 40% of the way there when the rungs aren't evenly spaced.
// Rank shows the two rungs by name instead.
export function requirementCount(req) {
  if (!req) return ''
  if (req.metric === 'rank_index') {
    return `${RANK_LABELS[req.current] ?? req.current} → ${RANK_LABELS[req.target] ?? req.target}`
  }
  return `${req.current} / ${req.target}`
}
