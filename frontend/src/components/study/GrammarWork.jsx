import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { FuriganaParts } from './Readings'

// ── 梯子 — the grammar ladder's exercises (plan 187e) ──────────────
// A grammar card on the ladder (`grammar.ladder`) is asked in the
// exercise its rung calls for, read from its progress on the server
// (study/grammar_ladder.py): fill_in and contrast, drawn as they always
// were, and the two drawn here -- build (組立) and write (書く). Each is
// also a platform of its own. Both end in the reveal the run already
// has (onDone), and the learner rates themselves on the run's bar
// (ADR 0013): the exercise says what happened, never the grade.

/** The card's four rungs: filled up to the one it stands on, the one
 *  whose exercise it is asked named. The two part where a point cannot
 *  be asked on its own rung and falls back (plan 190): a particle on
 *  Choose with no sentence to blank is filled to Choose and names
 *  Recognise, the flashcard it is shown, rather than lighting a rung
 *  the card does not ask. */
export function LadderStrip({ rung, asked = rung }) {
  const { t } = useLang()
  return (
    <ol className="lad-strip" aria-label={t.ladAria}>
      {t.ladRungs.map((name, i) => (
        <li key={name} className={`lad-strip__rung${i < rung ? ' lad-strip__rung--passed' : ''}${i === rung ? ' lad-strip__rung--at' : ''}${i === asked ? ' lad-strip__rung--here' : ''}`}
            aria-current={i === asked ? 'step' : undefined}>
          <span className="lad-strip__bar" aria-hidden="true" />
          <span className="lad-strip__name">{name}</span>
        </li>
      ))}
    </ol>
  )
}

/** 組立 — the sentence as tiles, the point and its word missing. A tile
 *  picked from the tray drops into the first empty gap; a filled gap
 *  tapped gives its tile back. The last gap filled is the answer. */
export function GrammarBuild({ card, answered, onDone }) {
  const { t } = useLang()
  const build = card.build
  const slots = build.answer.length
  const [placed, setPlaced] = useState(() => Array(slots).fill(null))
  const next = placed.indexOf(null)
  const byId = Object.fromEntries(build.tray.map(tile => [tile.id, tile]))
  const right = answered && placed.every((id, i) => id === build.answer[i])

  function put(id) {
    if (answered || next < 0) return
    playClick()
    const filled = placed.map((p, i) => (i === next ? id : p))
    setPlaced(filled)
    if (!filled.includes(null)) onDone?.()
  }

  function takeBack(i) {
    if (answered || placed[i] == null) return
    setPlaced(placed.map((p, j) => (j === i ? null : p)))
  }

  return (
    <div className="bld">
      <p className="bld-cue">
        <span className="bld-cue__ask">{t.bldAsk}</span>
        <span className="bld-cue__tr">{build.tr}</span>
      </p>
      <p className="bld-sentence" lang="ja">
        {build.tiles.map((tile, k) => {
          if (tile.slot == null) {
            return <span key={k} className="bld-tile bld-tile--fixed"><FuriganaParts parts={tile.furigana} /></span>
          }
          const id = placed[tile.slot]
          const state = !answered ? (tile.slot === next ? ' bld-slot--next' : '')
            : id === build.answer[tile.slot] ? ' bld-slot--ok' : ' bld-slot--no'
          return (
            <button key={k} type="button" className={`bld-slot${id == null ? ' bld-slot--empty' : ''}${state}`}
                    aria-label={t.bldSlot(tile.slot + 1)} disabled={answered || id == null}
                    onClick={() => takeBack(tile.slot)} data-slot={tile.slot}>
              {id != null && <FuriganaParts parts={byId[id].furigana} />}
            </button>
          )
        })}
        {build.tail && <span className="bld-tile bld-tile--fixed">{build.tail}</span>}
      </p>
      <div className="bld-tray" role="group" aria-label={t.bldTray}>
        {build.tray.map(tile => (
          <button key={tile.id} type="button" className="bld-piece" lang="ja"
                  disabled={answered || placed.includes(tile.id)}
                  onClick={() => put(tile.id)} data-piece={tile.id}>
            <FuriganaParts parts={tile.furigana} />
          </button>
        ))}
      </div>
      {answered && (
        <div className={`bld-said bld-said--${right ? 'ok' : 'no'}`}>
          <p className="bld-said__head">{right ? t.bldRight : t.bldWrong}</p>
          {!right && <ExampleSentence ex={{ jp: build.jp, segments: build.furigana }} showTr={false} />}
        </div>
      )}
    </div>
  )
}

/** 書く — a situation to say in Japanese with the point, two of its
 *  sentence's words to say it with. Check asks composition's own check
 *  (free, local, nothing written) whether the point is there, and the
 *  sentence the situation came from is shown as one way to say it. */
export function GrammarWrite({ card, answered, onDone, session }) {
  const { t } = useLang()
  const write = card.write
  const [text, setText] = useState('')
  const [said, setSaid] = useState(null)

  function check(e) {
    e.preventDefault()
    const sentence = text.trim()
    if (!sentence || answered) return
    setSaid({ sentence, found: null, kana: null })
    onDone?.()
    apiJson('/api/composition/check', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.raw_id ?? card.card_id, sentence }),
    })
      .then(d => setSaid({ sentence, found: typeof d.found === 'boolean' ? d.found : null, kana: d.japanese ?? null }))
      .catch(() => {})
  }

  return (
    <div className="wrt">
      <p className="wrt-cue">
        <span className="wrt-cue__ask">{t.wrtAsk}</span>
        <span className="wrt-cue__situation">{write.situation}</span>
      </p>
      <div className="wrt-with">
        <span className="wrt-with__label">{t.wrtWith}</span>
        <span className="wrt-with__point" lang="ja"><FuriganaParts parts={card.grammar_furigana?.length ? card.grammar_furigana : [{ text: card.grammar }]} /></span>
      </div>
      {write.helpers.length > 0 && (
        <div className="wrt-with">
          <span className="wrt-with__label">{t.wrtWords}</span>
          {write.helpers.map(h => (
            <span key={h.text} className="wrt-word" lang="ja">
              {h.reading ? <ruby>{h.text}<rt>{h.reading}</rt></ruby> : h.text}
            </span>
          ))}
        </div>
      )}
      {!answered ? (
        <form className="wrt-form" onSubmit={check}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label={t.wrtField}
            placeholder={t.wrtHint}
            className="field"
            lang="ja"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          <button type="submit" className="btn-primary" disabled={!text.trim()}>{t.wrtCheck}</button>
        </form>
      ) : (
        <div className="wrt-said">
          <p className="wrt-said__mine" lang="ja">{said?.kana ?? said?.sentence}</p>
          {said?.found != null && (
            <p className={`wrt-said__found wrt-said__found--${said.found ? 'ok' : 'no'}`}>
              {said.found ? t.wrtFound : t.wrtMissing}
            </p>
          )}
          <p className="wrt-said__label">{t.wrtModel}</p>
          <ExampleSentence ex={{ jp: write.model.jp, tr: write.model.tr, segments: write.model.furigana }} />
        </div>
      )}
    </div>
  )
}
