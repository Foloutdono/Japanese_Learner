import { Fragment, useEffect, useId, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiJson, ApiError } from '../../lib/api'
import { api } from '../../lib/origin'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { firstGloss } from '../study/gloss'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { ChevronIcon } from '../ui/Icons'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { DictionaryLookupSheet } from '../dictionary/DictionaryDetail'
import { BlockMark } from '../dictionary/RadicalIndex'

/**
 * RadicalLesson — one radical, taught before it is drilled (plan 086).
 *
 * Three blocks, in the order a learner meets them a second time: the
 * plate, the door onto its family, the platforms.
 *
 * THE PLATE IS A LESSON, AND A LESSON IS READ ONCE. So it arrives
 * shut — the glyph, the meaning, the number and the stroke count, the
 * line a dictionary's index prints — and opens on a tap into what a
 * 漢和辞典 gives on its first line: the glyph drawn stroke by stroke
 * in the plate's own ink (KanjiVG, undressed of the numerals it wears
 * on the dictionary's washi sheet), the Japanese names a teacher uses
 * (みず, then さんずい for the squeezed form), the forms it takes
 * in other characters, and where it usually sits. A learner who has
 * come back to board has read all of that; a learner who has not is
 * one tap from it, above everything else on the screen.
 *
 * THE FAMILY IS A DOOR, not a tail under the screen. It was listed in
 * full below the platforms until 氵 showed what that costs: 123 tiles
 * is a screen and a half of scrolling past on the way to everything
 * else. The door carries the figure the route stop prints for a level
 * (learned over total, started while the two disagree) and opens the
 * family as its own view (`browse`), where each kanji is itself a door
 * to its dictionary entry. It sits OUTSIDE the plate, so shutting the
 * lesson does not put the kanji behind two taps.
 *
 * No heading of its own. The bar overhead names the station; the
 * blocks name themselves — the plate by being one, each level of the
 * family by its BlockMark (DESIGN.md, "a body that names itself").
 *
 * Props:
 *   number    — the Kangxi number from the URL
 *   session   — forwarded to the API
 *   platforms — the ModeSelector, rendered under the door
 *   browse    — show the family instead of the lesson (?family=1)
 *   onBrowse  — open that view; the bar's aside is the way back
 *   back      — where an unknown number is sent (the index)
 *   onLoaded(radical) — the station reads the glyph for its sub
 */
export default function RadicalLesson({ number, session, platforms, browse, onBrowse, back, onLoaded }) {
  const { t, lang } = useLang()
  const [radical, setRadical] = useState(null)
  const [error, setError] = useState(null)
  const [lookup, setLookup] = useState(null)
  const [drawFailed, setDrawFailed] = useState(false)
  // Shut on arrival, every time: see the plate below.
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset that must land with the fetch it announces; not an id-keyed reset.
    setRadical(null)
    setError(null)
    setDrawFailed(false)
    apiJson(`/api/kanji/radical/${number}?lang=${lang}`, session)
      .then(data => { if (!cancelled) { setRadical(data); onLoaded?.(data) } })
      .catch(err => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, session, lang])

  // A number the index does not know is a 404 (routes/kanji.py's
  // _require_radical): back to the index rather than an empty lesson.
  if (error instanceof ApiError && error.status === 404) return <Navigate replace to={back} />
  if (error) return <Empty message={t.loadError} />
  if (!radical) return <Loading />

  const position = radical.position
  const where = position ? t.radPosition?.[position] : null
  const positionJp = position ? t.radPositionJp?.[position] : null
  const startedNote = radical.started > radical.learned ? t.startedNote(radical.started) : null

  // The family, by level: the browse view's whole body, and the sheet
  // a tile opens over it.
  const family = (
    <section className="rad-family" aria-label={t.radFamily}>
      {radical.levels.map(lv => (
        <Fragment key={lv.level}>
          <BlockMark jp={lv.level} name={t[`levelHint${lv.level}`]} tally={lv.kanji.length} />
          <div className="rad-family__grid">
            {lv.kanji.map(k => (
              <button
                key={k.card_id}
                type="button"
                className={`rad-kanji rad-kanji--${k.stage}`}
                title={k.meaning}
                onClick={() => { playUi('click-mode-selection'); setLookup(k) }}
              >
                <span className="rad-kanji__char" lang="ja">{k.kanji}</span>
                <span className="rad-kanji__meaning">{firstGloss(k.meaning)}</span>
              </button>
            ))}
          </div>
        </Fragment>
      ))}
    </section>
  )

  const sheet = lookup && (
    <DictionaryLookupSheet
      key={lookup.card_id}
      term={lookup.kanji}
      category="kanji"
      session={session}
      onClose={() => setLookup(null)}
    />
  )

  // ── The family, on its own ──
  // Deep-linked at ?family=1 on a radical the course builds nothing
  // on, this says so rather than drawing an empty screen.
  if (browse) {
    return (
      <div className="rad">
        {radical.total > 0 ? family : <Empty message={t.radNoKanji} />}
        {sheet}
      </div>
    )
  }

  return (
    <div className="rad">
      {/* The lesson is read once. A learner who has come back to board
          knows what 水 is, so the plate arrives SHUT — the glyph, the
          meaning, the number and the count, which is the line a
          dictionary's index prints — and the teaching (the strokes
          drawing, the 部首名, the forms, where it sits) is one tap
          under it. */}
      <section className="rad-plate" aria-label={t.radLesson}>
        <button
          type="button"
          className="rad-plate__head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => { playUi('click-mode-selection'); setOpen(v => !v) }}
        >
          <span className="rad-plate__id" lang="ja">{radical.glyph}</span>
          <span className="rad-plate__titles">
            <span className="rad-plate__meaning">{radical.meaning}</span>
            <span className="rad-plate__meta">
              <span>{t.dictRadicalNumber(radical.number)}</span>
              <span>{radical.stroke_count} {radical.stroke_count === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}</span>
            </span>
          </span>
          <span className="rad-plate__chev" aria-hidden="true">
            <ChevronIcon direction={open ? 'up' : 'down'} size={16} />
          </span>
        </button>
        {open && (
          <div className="rad-plate__open" id={bodyId}>
            {/* `bare`: the strokes drawing in the plate's own ink, with
                KanjiVG's numerals off — no washi sheet under it and no
                caption over it, the glyph itself is the legend.

                api(), not the bare path the API hands back: a WebView's
                own origin serves the bundle and nothing else, so in the
                native shell a relative /kanjivg fetch 404s and the plate
                fell back to the character as type — the strokes were
                missing on a phone and drawn on the web (ADR 0008). */}
            <div className="rad-plate__glyph" lang="ja" aria-hidden="true">
              {radical.svg_url && !drawFailed
                ? <StrokeOrderAnimation src={api(radical.svg_url)} loop bare className="rad-plate__strokes" onError={() => setDrawFailed(true)} />
                : <span className="rad-plate__char">{radical.glyph}</span>}
            </div>
            <div className="rad-plate__body">
              <div className="rad-plate__names" lang="ja">{radical.names_ja.join(' · ')}</div>
              {radical.forms.length > 1 && (
                <div className="rad-plate__forms" aria-label={t.radForms}>
                  {radical.forms.map(f => <span key={f} className="rad-plate__form" lang="ja">{f}</span>)}
                </div>
              )}
              <p className="rad-plate__note">
                {where
                  ? <>{t.radPositionNote(where)} <span lang="ja" className="rad-plate__pos">{positionJp}</span>.</>
                  : t.radNoPositionNote}
                {radical.total === 0 && <> {t.radNoKanji}</>}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* The family as a record that opens: the two figures the route
          stop prints — learned over total, and started while the two
          disagree — are the door's own value. Outside the plate, so a
          learner who has shut the lesson still reaches its kanji in
          one tap, beside the platforms rather than behind them. */}
      {radical.total > 0 && (
        <button type="button" className="rad-door" onClick={() => { playUi('click-screen-selection'); onBrowse?.() }}>
          <span className="rad-door__body">
            <span className="rad-door__head">
              <span className="rad-door__fig"><b>{radical.learned}</b>/ {radical.total}</span>
              {startedNote && <span className="rad-door__started">{startedNote}</span>}
            </span>
            <span className="rad-door__label">{t.radFamilyShort}</span>
          </span>
          <ChevronIcon direction="right" size={16} className="rad-door__chev" />
        </button>
      )}

      {radical.total > 0 && platforms}
    </div>
  )
}
