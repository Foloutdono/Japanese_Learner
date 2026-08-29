import {
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay, RevealActions,
} from './QuizComponents'
import { FuriganaWord } from './Readings'
import { GrammarRule, GrammarAnswer } from './GrammarPieces'
import { RadicalAnswer } from './RadicalPieces'
import { formatGlossLine } from './gloss'
import PromptCard from './PromptCard'
import { speakJapanese, playKana } from '../../lib/audio'
import { RENDER, HINTS } from '../../domain/studyModes'
import { wordForm, cardShape } from '../../domain/cardShape'

// ── The face of a card, for every source the app has ─────────────
// Extracted from StudyScreen, which had grown the only complete set of
// these, so the daily queue (screens/TodayScreen) could render a mixed
// session without a second copy. A second copy is precisely what let
// routes/frequency.py and routes/theme_vocab.py keep emitting a retired
// payload shape for months after the sections moved on -- the same
// mistake on the other side of the wire.
//
// ONE generalisation was needed to make it serve both: `renderer`,
// `isRadical` and the rest are read off THIS CARD's mode rather than a
// session-level one. A section or deck session is unaffected (every
// card in it carries that session's mode), but the daily queue holds a
// different mode per card, which a session-level variable cannot
// describe.

export default function CardPrompt({
  card,              // already normalized (see normalizeCard)
  t,
  session,
  answered,
  cardNonce,
  activeHints = [],
  onFlashcardReveal,
}) {
  if (!card) return null

  const c = card
  const { structureKey, isF2B, renderer, isFill, isRadical, isWordReading } = cardShape(c)
  const resetKey = `${c.card_id}:${cardNonce}`

  const cardHints = c.hints ?? {}
  const choicesOn = activeHints.includes(HINTS.CHOICES) && Array.isArray(cardHints[HINTS.CHOICES])
  const furiganaOn = activeHints.includes(HINTS.FURIGANA) && Array.isArray(cardHints[HINTS.FURIGANA])
  // fill_in's own reveal is the flip, same as every other mode here —
  // choicesOn is what decides whether the flip is replaced by the
  // options grid instead.
  const showChoices = choicesOn

  /** The vocab word, with furigana when the hint is on and the card has it.
   *  `size` is FuriganaWord's own (unrelated to the specimen scale, see
   *  Readings.jsx); the plain CharDisplay fallback is always the word
   *  rung -- this is only ever called at the specimen's word size. */
  function wordDisplay(size) {
    const parts = furiganaOn ? cardHints[HINTS.FURIGANA] : null
    if (parts?.length) return <FuriganaWord parts={parts} size={size} />
    return <CharDisplay char={wordForm(c)} variant="word" />
  }

  // ── kana ────────────────────────────────────────────────────
  if (structureKey === 'kana') {
    const dictCategory = (c.deck ?? '').startsWith('hiragana') ? 'hiragana' : 'katakana'
    const isB2F = c.direction === 'b2f'
    const prompt = isB2F ? c.romaji : c.kana
    const answer = isB2F ? c.kana : c.romaji
    const romajiPrompt = text => <CharDisplay char={text} size={44} />

    if (renderer === RENDER.TYPE) {
      // write_romaji — the kana is shown, type its reading.
      return (
        <PromptCard>
          <CharDisplay char={c.kana} />
          <RevealActions
            t={t} revealed={answered} resetKey={resetKey}
            dictTerm={c.kana} dictCategory={dictCategory} session={session}
            onReplaySound={() => playKana(c.romaji)}
          />
        </PromptCard>
      )
    }
    if (renderer === RENDER.DRAW) {
      return (
        <PromptCard>
          {romajiPrompt(c.romaji)}
          <RevealActions
            t={t} revealed={answered} resetKey={resetKey}
            dictTerm={c.kana} dictCategory={dictCategory} session={session}
            onReplaySound={() => playKana(c.romaji)}
          />
        </PromptCard>
      )
    }
    return (
      <PromptCard>
        {!showChoices ? (
          <Flashcard
            t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
            front={isB2F ? romajiPrompt(prompt) : <CharDisplay char={prompt} />}
            back={isB2F ? <CharDisplay char={answer} /> : romajiPrompt(answer)}
            dictTerm={c.kana} dictCategory={dictCategory} session={session}
            onReplaySound={() => playKana(c.romaji)}
          />
        ) : (
          <>
            {isB2F ? romajiPrompt(prompt) : <CharDisplay char={prompt} />}
            <RevealActions
              t={t} revealed={answered} resetKey={resetKey}
              dictTerm={c.kana} dictCategory={dictCategory} session={session}
              onReplaySound={() => playKana(c.romaji)}
            />
          </>
        )}
      </PromptCard>
    )
  }

  // ── kanji ───────────────────────────────────────────────────
  if (structureKey === 'kanji') {
    if (renderer === RENDER.TYPE) {
      // readings — the kanji is shown, every reading is typed into
      // ReadingsInput below. No flip: the answer is not one thing to
      // uncover but a set the learner produces.
      return (
        <PromptCard>
          <CharDisplay char={c.kanji} variant="glyph" />
          <RevealActions
            t={t} revealed={answered} resetKey={resetKey}
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        </PromptCard>
      )
    }
    if (isRadical) {
      // radical — the kanji is shown, the radical it is filed under is
      // the answer. Same flip/choices split as the meaning flashcards.
      return (
        <PromptCard>
          {!showChoices && (
            <Flashcard
              t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
              front={<CharDisplay char={c.kanji} variant="glyph" />}
              back={
                /* The kanji stays on the back, dimmed — the answer needs
                   something to be an answer ABOUT, and on the cards
                   where the radical IS the kanji, an unchanged-looking
                   card otherwise. */
                <div className="radical-reveal">
                  <div className="radical-reveal__kanji" lang="ja">{c.kanji}</div>
                  <RadicalAnswer radical={c.radical} t={t} />
                </div>
              }
              dictTerm={c.kanji} dictCategory="kanji" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          )}
          {showChoices && (
            <>
              <CharDisplay char={c.kanji} variant="glyph" />
              {answered && <RadicalAnswer radical={c.radical} t={t} />}
              <RevealActions
                t={t} revealed={answered} resetKey={resetKey}
                dictTerm={c.kanji} dictCategory="kanji" session={session}
                onReplaySound={() => speakJapanese(c.kana)}
              />
            </>
          )}
        </PromptCard>
      )
    }
    if (renderer === RENDER.DRAW) {
      return (
        <PromptCard>
          <MeaningDisplay meaning={c.meaning} size={32} />
          {c.kana && <div className="quiz-subtitle">({c.kana})</div>}
          <RevealActions
            t={t} revealed={answered} resetKey={resetKey}
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        </PromptCard>
      )
    }
    return (
      <PromptCard>
        {!showChoices && (
          <Flashcard
            t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
            front={isF2B ? <CharDisplay char={c.kanji} variant="glyph" /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            back={
              <InlineReveal
                t={t} kana={c.kana} isLarge={isF2B}
                main={isF2B ? <MeaningDisplay meaning={c.meaning} size={28} /> : <CharDisplay char={c.kanji} variant="word" />}
              />
            }
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}
        {showChoices && (
          <>
            <InlineReveal
              t={t} kana={c.kana} revealed={answered}
              main={isF2B ? <CharDisplay char={c.kanji} variant="glyph" /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            />
            <RevealActions
              t={t} revealed={answered} resetKey={resetKey}
              dictTerm={c.kanji} dictCategory="kanji" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          </>
        )}
      </PromptCard>
    )
  }

  // ── vocab ───────────────────────────────────────────────────
  if (structureKey === 'vocab') {
    return (
      <PromptCard>
        {isWordReading && (
          /* word_reading — the written word is shown and the answer is
             how it is read. No meaning on either face: this drill is
             about reading, not knowing. */
          <Flashcard
            t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
            front={<CharDisplay char={c.kanji} variant="word" />}
            back={
              /* Both halves of the answer, and both are needed. The
                 furigana says WHICH kanji takes which part of the
                 reading; the plain kana below is the reading as one
                 word, which is what was actually asked for. */
              <div>
                {c.furigana?.length
                  ? <FuriganaWord parts={c.furigana} size={64} answer />
                  // 56 was the nearest the old numeric scale had; the
                  // word rung (72px) is the closer of the two per plan
                  // 048 (56 sits 16px from word, 48px from glyph).
                  : <CharDisplay char={c.kanji} variant="word" />}
                <div className="flashcard-reading" lang="ja">{c.kana}</div>
              </div>
            }
            dictTerm={wordForm(c)} dictCategory="vocab" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}

        {!isWordReading && !showChoices && (
          <Flashcard
            t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
            front={isF2B ? wordDisplay(72) : <CharDisplay char={formatGlossLine(c.meaning)} variant="word" />}
            back={
              <InlineReveal
                t={t} kana={c.kanji ? c.kana : null} isLarge={isF2B} stacked={isF2B}
                main={isF2B
                  ? <MeaningDisplay meaning={c.meaning} size={28} color="var(--accent2)" />
                  : <CharDisplay char={wordForm(c)} variant="word" />}
              />
            }
            dictTerm={wordForm(c)} dictCategory="vocab" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}

        {!isWordReading && showChoices && (
          <>
            <InlineReveal
              t={t} kana={c.kanji ? c.kana : null} revealed={answered}
              main={isF2B ? <CharDisplay char={wordForm(c)} variant="word" /> : <CharDisplay char={formatGlossLine(c.meaning)} variant="word" />}
            />
            <RevealActions
              t={t} revealed={answered} resetKey={resetKey}
              dictTerm={wordForm(c)} dictCategory="vocab" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          </>
        )}
      </PromptCard>
    )
  }

  // ── grammar ─────────────────────────────────────────────────
  if (structureKey === 'grammar') {
    return (
      <PromptCard className="grammar-prompt">
        {/* Every mode here is the same card with a different front: a
            rule, a meaning, or a sentence. The flip is the reveal in
            all three, and switching the choices on replaces the flip
            rather than sitting beside it — same resolution kanji/vocab
            use for their own indice_1. */}
        {!choicesOn ? (
          <Flashcard
            t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
            front={
              isFill
                ? <div className="grammar-fill-sentence" lang="ja">{c.fill_sentence?.jp}</div>
                : isF2B
                  ? (
                    <>
                      <GrammarRule text={c.grammar} size={52} />
                      {c.structure && <div className="grammar-structure">{c.structure}</div>}
                    </>
                  )
                  : <MeaningDisplay meaning={c.meaning} size={34} />
            }
            back={
              isFill
                ? (
                  /* The sentence stays on the back, dimmed: the answer
                     is which rule is at work IN IT. */
                  <>
                    <div className="grammar-fill-sentence grammar-fill-sentence--echo" lang="ja">
                      {c.fill_sentence?.jp}
                    </div>
                    <GrammarAnswer card={c} size={40} />
                  </>
                )
                : isF2B
                  ? <MeaningDisplay meaning={c.meaning} size={30} color="var(--success)" />
                  : (
                    <>
                      <GrammarRule text={c.grammar} size={44} />
                      {c.structure && <div className="grammar-structure">{c.structure}</div>}
                    </>
                  )
            }
          />
        ) : (
          /* Choices on — the prompt does NOT swap: the answer is
             whichever MCQ row lights up below, not a second face here.
             fill_in is the exception, since its own prompt is the
             sentence and the rule named below is worth seeing spelled
             out next to it. */
          <>
            {isFill
              ? <div className="grammar-fill-sentence" lang="ja">{c.fill_sentence?.jp}</div>
              : isF2B
                ? (
                  <>
                    <GrammarRule text={c.grammar} size={52} />
                    {c.structure && <div className="grammar-structure">{c.structure}</div>}
                  </>
                )
                : <MeaningDisplay meaning={c.meaning} size={34} />}
            {isFill && answered && <GrammarAnswer card={c} size={36} divided />}
          </>
        )}
      </PromptCard>
    )
  }

  // ── standard (a hand-written front/back pair) ────────────────
  return (
    <PromptCard>
      <Flashcard
        t={t} resetKey={resetKey} onReveal={onFlashcardReveal}
        front={
          <div className="study-front-text" style={{ '--front-size': (isF2B ? c.front : c.back)?.length === 1 ? '80px' : '32px' }}>
            {isF2B ? c.front : c.back}
          </div>
        }
        back={
          <div className="study-front-text" style={{ '--front-size': '28px' }}>
            {isF2B ? c.back : c.front}
          </div>
        }
        dictTerm={c.front} dictCategory="vocab" session={session}
      />
    </PromptCard>
  )
}
