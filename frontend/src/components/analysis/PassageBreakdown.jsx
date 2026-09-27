import { useState } from 'react'
import { ChevronIcon } from '../ui/Icons'
import { SentenceLine, WordRows } from './SentenceBreakdown'
import { GrammarPoints } from './GrammarPoints'
import { pointKey } from './grammarSpans'

// ── 一文ずつ — the passage, sentence by sentence (plan 084) ────
// The comprehension result's breakdown: every sentence of the text in
// order, each over its translation, and ONE of them open at a time on
// its word rows, its grammar and its note. Closed, a sentence is the
// overview -- where in the text a wrong answer came from; open, it is
// the rows layout SentenceBreakdown draws for one sentence, composed
// here so the ruby line can replace the plain sentence in place rather
// than print under it a second time.
//
// The head is a row, not a button: the open sentence's line holds
// word buttons, and a button cannot hold a button. The chevron is the
// control -- a real <button> with aria-expanded, so Enter and Space
// toggle and focus has somewhere to stay -- and it carries no handler
// of its own: its click bubbles to the head, which is where a tap
// anywhere on the sentence lands too. A tap on a word opening its
// entry must not close the sentence, so the head ignores clicks that
// came through a door.
//
// A sentence with nothing to open (no analysis and no note -- the
// fallback for a backend that has not shipped the analysis yet) is
// the two lines and nothing else: no chevron that opens nothing.
//
// `onGrammarOpen` makes a sentence's grammar chips doors to their
// dictionary entries (see GrammarChips); the chip stops its own click,
// so opening an entry never closes the sentence it sits in.
//
// The light (plan 095, SentenceBreakdown's useLight in its own words):
// a chip or a marker row hovered or focused lights the words its point
// is written on in the open sentence's line, and the last one pressed
// stays lit after its sheet closes. Both are remembered with the
// sentence they were made in and forgotten when it closes, so another
// sentence opens dark and a chip that unmounted under the pointer
// cannot light words in the one that replaced it.
export function PassageBreakdown({ sentences, t, openIndex, setOpenIndex, onTokenClick, onGrammarOpen }) {
  const [hover, setHover] = useState(null)
  const [pick, setPick] = useState(null)
  if (!sentences?.length) return null
  const here = held => (held && held.index === openIndex ? held.point : null)
  const lit = here(hover) ?? here(pick)
  const litKey = pointKey(lit)
  return (
    <div className="bkd-passage">
      {sentences.map((sentence, i) => {
        const expandable = !!sentence.analysis?.available || !!sentence.note
        const open = expandable && openIndex === i
        const bodyId = `bkd-passage-body-${i}`
        const toggle = e => {
          if (e.target.closest('.bkd-tok--door')) return
          setHover(null)
          setPick(null)
          setOpenIndex(open ? null : i)
        }
        const openGrammar = onGrammarOpen ? point => { setPick({ index: i, point }); onGrammarOpen(point) } : undefined
        const light = point => setHover(point ? { index: i, point } : null)
        return (
          <div key={i} className={`bkd-passage__item${open ? ' bkd-passage__item--open' : ''}`}>
            <div
              className={`bkd-passage__head${expandable ? ' bkd-passage__head--door' : ''}`}
              onClick={expandable ? toggle : undefined}
            >
              <div className="bkd-passage__text">
                {open
                  ? <SentenceLine analysis={sentence.analysis} text={sentence.jp} t={t} onTokenClick={onTokenClick} lit={lit} numbered />
                  : <span className="prose__jp" lang="ja">{sentence.jp}</span>}
                {sentence.translation && <span className="bkd__en">{sentence.translation}</span>}
              </div>
              {expandable && (
                <button
                  type="button"
                  className="bkd-passage__chev"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  aria-label={open ? t.closeSentence : t.openSentence}
                >
                  <ChevronIcon direction={open ? 'up' : 'down'} size={14} />
                </button>
              )}
            </div>
            {open && (
              <div id={bodyId} className="bkd-passage__body">
                {sentence.analysis?.available && (
                  <>
                    <WordRows analysis={sentence.analysis} t={t} onTokenClick={onTokenClick} />
                    <GrammarPoints analysis={sentence.analysis} t={t} lit={litKey} onLight={light} onOpen={openGrammar} />
                  </>
                )}
                {sentence.note && <span className="prose__ai">{sentence.note}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
