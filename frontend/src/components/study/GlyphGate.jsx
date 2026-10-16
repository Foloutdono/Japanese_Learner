import { apiJson } from '../../lib/api'
import { useDesk } from '../../hooks/useDesk'
import { GlyphTour } from './GlyphTour'

// ── The gate before a never-met kana or kanji (plan 216) ──────────
// What a run shows in the card's place the first time a character comes
// up (TodayRun, KanaRun, KanjiRun), as GrammarGate does for a point: its
// tour (components/study/GlyphTour.jsx), carried on the card as
// `glyph_tour` while the server says it is due (`tutorial`).
//
// The terminus records how the character was met (POST /api/glyph/tour:
// the first tour only, never read by the scheduler) and boards the card.
// The record is a courtesy: a failed post never holds the run.
export function GlyphGate({ card, session, onBoard }) {
  const desk = useDesk()
  const board = result => {
    apiJson('/api/glyph/tour', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.card_id, misses: Math.min(result.misses, 999), shown: result.shown }),
    }).catch(() => {})
    onBoard?.()
  }
  return <GlyphTour tour={card.glyph_tour} onBoard={board} desk={desk} />
}

/** Whether `card` opens on its glyph's tour: a kana or kanji card the
    server says is due one, not yet boarded in this session. */
// eslint-disable-next-line react-refresh/only-export-components -- the gate's own condition, read by the three runs that draw it; kept beside the gate so the runs cannot drift from it.
export function glyphGated(card) {
  return Boolean(card && card.tutorial && card.glyph_tour && !card.lesson_seen)
}
