import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { useGridWalk } from '../../hooks/useGridWalk'
import { relativeDate } from '../../lib/formatDate'
import { Console, ConsoleTop, Chips, Chip, ConsoleIndex } from '../chrome/Console'
import { CrossIcon, TextLinesIcon, CameraIcon, VideoIcon, SongIcon } from '../ui/Icons'
import { Dots } from '../ui/Loading'
import { kindOf, lineOf, keptOf, shelfChips, shelfShows } from './passages'
import { VideoStill } from './VideoStill'

// ── 帳 — the learner's passages (plan 136) ─────────────────
// The analyser's history was a short list beside the intake, headed
// "History", its rows numbered 1 · 2 · 3 for the platform each came
// from. The owner's pick of three drawn directions (C, "les passages
// d'abord") turns the screen round: the passages ARE the page, and the
// intake stands beside them in the desk's column.
//
// On the desk: the one console (DESIGN.md, "The console, one
// everywhere") -- the kinds the shelf holds as chips, a search and the
// count -- over the passages as cards: a video with its still and its
// sentence count, a text or a photo with its first lines. On a phone:
// the chips alone, then a row per passage.
//
// Each entry carries `kind: 'passage' | 'session'` (useAnalyzerSession
// merges two endpoints); a session is the video platform, a passage a
// text or, by its `source`, a photo. Each has its ✕ and its Undo
// (useAnalyzerSession's deleteHistoryEntry). The shelf holds the newest
// thirty of them, kept sentences aside (backend core/history.py).
//
// `pending` is a song being transcribed (plan 317, the owner's board 1):
// its file's name waits at the head of the shelf, a row or a card that
// opens nothing, until the server lists the session it makes. The
// screen's notice is what a reader hears; the row is quiet.

const GLYPH = { text: TextLinesIcon, photo: CameraIcon, video: VideoIcon, song: SongIcon }
const NAME = { text: 'sourceText', photo: 'sourcePhoto', video: 'sourceVideo', song: 'sourceSong' }
const CARD_DOORS = ':scope > .anl-card > .anl-card__open'

export function PassageShelf({ t, entries, onOpen, onDelete, lastDeleted, onUndo, onDismissUndo, pending = null }) {
  const desk = useDesk()
  const { lang } = useLang()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  // The one tab stop of the desk's grid (plan 123): the card last
  // focused, the arrows walking the rest.
  const [stop, setStop] = useState(0)
  const onWalk = useGridWalk(desk, setStop, CARD_DOORS)

  const chips = shelfChips(entries).map(c => ({
    ...c, label: c.key === 'all' ? t.shelfAll : c.key === 'kept' ? t.shelfKept : t[NAME[c.key]],
  }))
  // A filter whose chip has gone (its last passage deleted) is "All".
  const active = chips.some(c => c.key === filter) ? filter : 'all'
  const shown = entries.filter(h => shelfShows(h, active, desk ? query : ''))
  const at = Math.min(stop, Math.max(0, shown.length - 1))

  const chipRow = chips.length > 1 && chips.map(c => (
    <Chip key={c.key} on={active === c.key} onClick={() => { setFilter(c.key); setStop(0) }}>
      {c.label}<span className="chip__n">{c.n}</span>
    </Chip>
  ))

  const undo = lastDeleted && (
    <div className="anl-undo">
      <span className="anl-undo__text">{t.entryDeleted}</span>
      <button type="button" className="btn-secondary anl-undo__btn" onClick={onUndo}>{t.undo}</button>
      <button type="button" className="anl-undo__dismiss" onClick={onDismissUndo} aria-label={t.noticeDismiss}>
        <CrossIcon size={13} />
      </button>
    </div>
  )

  const when = h => (h.createdAt ? relativeDate(h.createdAt, lang, t) : null)
  const waiting = pending && <span className="anl-wait">{t.songTranscribing}<Dots /></span>
  const count = h => (h.kind === 'session' && typeof h.sentenceCount === 'number' ? t.sessionSentenceCount(h.sentenceCount) : null)
  const del = (h, tab) => (
    <button type="button" className={desk ? 'anl-card__delete' : 'anl-row__delete'} onClick={() => onDelete(h)} aria-label={t.delete} title={desk ? t.delete : undefined} tabIndex={tab}>
      <CrossIcon size={13} />
    </button>
  )

  if (desk) {
    return (
      <section className="anl-shelf" aria-label={t.historyTitle}>
        {entries.length > 0 && (
          <Console className="anl-shelf__console">
            {chipRow && <ConsoleTop><Chips label={t.shelfFilter}>{chipRow}</Chips></ConsoleTop>}
            <ConsoleIndex
              value={query}
              onChange={e => { setQuery(e.target.value); setStop(0) }}
              onClear={() => setQuery('')}
              clearLabel={t.cancel}
              placeholder={t.shelfSearch}
              aria-label={t.shelfSearch}
              count={t.passagesCount(shown.length)}
            />
          </Console>
        )}
        {undo}
        {entries.length === 0 && !pending && <p className="anl-shelf__empty">{t.shelfEmpty}</p>}
        {entries.length > 0 && shown.length === 0 && !pending && <p className="hint">{t.shelfNoMatch}</p>}
        {(shown.length > 0 || pending) && (
          <div className="anl-shelf__grid" onKeyDown={onWalk} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End">
            {pending && (
              <div className="anl-card anl-card--song anl-card--wait">
                <div className="anl-card__open">
                  <span className="anl-card__body">
                    <span className="anl-card__src"><SongIcon size={14} />{t.sourceSong}</span>
                    <span className="anl-card__jp">{pending}</span>
                    <span className="anl-card__meta">{waiting}</span>
                  </span>
                </div>
              </div>
            )}
            {shown.map((h, i) => {
              const kind = kindOf(h)
              const Glyph = GLYPH[kind]
              const tab = i === at ? 0 : -1
              return (
                <div key={`${h.kind}:${h.id}`} className={`anl-card anl-card--${kind}`}>
                  <button type="button" className="anl-card__open" onClick={() => onOpen(h)} onFocus={() => setStop(i)} tabIndex={tab}>
                    {kind === 'video' && (
                      <span className="anl-card__still">
                        <VideoStill videoId={h.videoId} className="anl-card__img" fallback={<VideoIcon size={26} />} />
                        {count(h) && <span className="anl-card__count">{count(h)}</span>}
                      </span>
                    )}
                    <span className="anl-card__body">
                      <span className={kind === 'video' ? 'sr-only' : 'anl-card__src'}>
                        {kind !== 'video' && <Glyph size={14} />}
                        {t[NAME[kind]]}
                      </span>
                      <span className={`anl-card__jp${kind === 'video' ? ' anl-card__jp--short' : ''}`} lang="ja">{lineOf(h)}</span>
                      <span className="anl-card__meta">
                        {keptOf(h) && <span className="anl-kept">{t.passageKept}</span>}
                        {when(h) && <span>{when(h)}</span>}
                      </span>
                    </span>
                  </button>
                  {del(h, tab)}
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="anl-shelf" aria-label={t.historyTitle}>
      {chipRow && <div className="anl-shelf__chips" role="group" aria-label={t.shelfFilter}>{chipRow}</div>}
      {undo}
      {entries.length === 0 && !pending && <p className="hint">{t.shelfEmptyPhone}</p>}
      {(shown.length > 0 || pending) && (
        <div className="anl-shelf__rows">
          {pending && (
            <div className="anl-row anl-row--wait">
              <div className="anl-row__open">
                <span className="anl-row__lead" role="img" aria-label={t.sourceSong}>
                  <span className="anl-row__glyph"><SongIcon size={16} /></span>
                </span>
                <span className="anl-row__body">
                  <span className="anl-row__jp">{pending}</span>
                  <span className="anl-row__meta">{waiting}</span>
                </span>
              </div>
            </div>
          )}
          {shown.map(h => {
            const kind = kindOf(h)
            const Glyph = GLYPH[kind]
            return (
              <div key={`${h.kind}:${h.id}`} className="anl-row">
                <button type="button" className="anl-row__open" onClick={() => onOpen(h)}>
                  {/* The lead carries the provenance: a video's still, or
                      the platform's glyph with its name for a reader. */}
                  {kind === 'video'
                    ? (
                      <span className="anl-row__lead anl-row__lead--still" role="img" aria-label={t.sourceVideo}>
                        <VideoStill videoId={h.videoId} className="anl-card__img" fallback={<VideoIcon size={18} />} />
                      </span>
                    )
                    : <span className="anl-row__lead" role="img" aria-label={t[NAME[kind]]}><span className="anl-row__glyph"><Glyph size={16} /></span></span>}
                  <span className="anl-row__body">
                    <span className="anl-row__jp" lang="ja">{lineOf(h)}</span>
                    <span className="anl-row__meta">
                      {keptOf(h) && <span className="anl-kept">{t.passageKept}</span>}
                      {count(h) && <span>{count(h)}</span>}
                      {when(h) && <span>{when(h)}</span>}
                    </span>
                  </span>
                  <span className="anl-row__go" aria-hidden="true">▶</span>
                </button>
                {del(h)}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
