import { Fragment, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiJson, ApiError } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { firstGloss } from '../study/gloss'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { DictionaryLookupSheet } from '../dictionary/DictionaryDetail'
import { BlockMark } from '../dictionary/RadicalIndex'

/**
 * RadicalLesson — one radical, taught before it is drilled (plan 086).
 *
 * The plate first: the glyph drawn stroke by stroke (KanjiVG, the
 * dictionary's own sheet), and beside it what a 漢和辞典 would say on
 * its first line — the Japanese names a teacher uses (みず, then
 * さんずい for the squeezed form), the meaning in the learner's
 * language, the number and the stroke count, the forms it takes in
 * other characters, and where it usually sits. Then the platforms:
 * the same five drills the JLPT line offers, over this family alone.
 * Then the family itself — every kanji of the course filed under the
 * radical, by level, each in its own stage ink, and each a door to
 * its dictionary entry.
 *
 * The platforms come BEFORE the family on purpose. 氵 files 123
 * characters; on a phone that is a screen and a half of tiles, and a
 * learner coming back for the third time should not have to scroll
 * past all of them to board. The plate already carries the figure
 * that summarises the family (learned / total), and its last line
 * says the kanji are below.
 *
 * No heading of its own. The bar overhead names the station; the
 * blocks name themselves — the plate by being one, each level of the
 * family by its BlockMark (DESIGN.md, "a body that names itself").
 *
 * Props:
 *   number    — the Kangxi number from the URL
 *   session   — forwarded to the API
 *   platforms — the ModeSelector, rendered between plate and family
 *   back      — where an unknown number is sent (the index)
 *   onLoaded(radical) — the station reads the glyph for its sub
 */
export default function RadicalLesson({ number, session, platforms, back, onLoaded }) {
  const { t, lang } = useLang()
  const [radical, setRadical] = useState(null)
  const [error, setError] = useState(null)
  const [lookup, setLookup] = useState(null)
  const [drawFailed, setDrawFailed] = useState(false)

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

  return (
    <div className="rad">
      <section className="rad-plate" aria-label={t.radLesson}>
        <div className="rad-plate__glyph" lang="ja" aria-hidden="true">
          {radical.svg_url && !drawFailed
            ? <StrokeOrderAnimation src={radical.svg_url} loop className="rad-plate__strokes" onError={() => setDrawFailed(true)} />
            : <span className="rad-plate__char">{radical.glyph}</span>}
        </div>
        <div className="rad-plate__body">
          <div className="rad-plate__names" lang="ja">{radical.names_ja.join(' · ')}</div>
          <div className="rad-plate__meaning">{radical.meaning}</div>
          <div className="rad-plate__meta">
            <span>{t.dictRadicalNumber(radical.number)}</span>
            <span>{radical.stroke_count} {radical.stroke_count === 1 ? t.dictStrokeSingular : t.dictStrokesPlural}</span>
          </div>
          {radical.forms.length > 1 && (
            <div className="rad-plate__forms" aria-label={t.radForms}>
              {radical.forms.map(f => <span key={f} className="rad-plate__form" lang="ja">{f}</span>)}
            </div>
          )}
          <p className="rad-plate__note">
            {where
              ? <>{t.radPositionNote(where)} <span lang="ja" className="rad-plate__pos">{positionJp}</span>.</>
              : t.radNoPositionNote}
            {' '}
            {radical.total > 0 ? t.radFamilyNote(radical.total) : t.radNoKanji}
          </p>
          {radical.total > 0 && (
            <div className="rad-plate__fig">
              <span className="rad-plate__learned"><b>{radical.learned}</b>/ {radical.total}</span>
              {startedNote && <span className="rad-plate__started">{startedNote}</span>}
            </div>
          )}
        </div>
      </section>

      {radical.total > 0 && platforms}

      {radical.total > 0 && (
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
      )}

      {lookup && (
        <DictionaryLookupSheet
          key={lookup.card_id}
          term={lookup.kanji}
          category="kanji"
          session={session}
          onClose={() => setLookup(null)}
        />
      )}
    </div>
  )
}
