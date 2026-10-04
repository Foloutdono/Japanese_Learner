import { useCallback, useRef, useState } from 'react'
import { apiJson, apiFetch } from '../lib/api'
import { explainSentence } from '../lib/explainSentence'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { Loading } from '../components/ui/Loading'

// ── A sat question, made something to study ──
// Under each question the review opens: the question's sentence with
// the answer in its place, that sentence and every choice in the
// learner's language, the passage or the script translated for a
// reading or listening question, and the sentence's breakdown -- the
// practice runs' own (SentenceBreakdown in its rows, the local tier
// fetched free, Explain buying the deep tier, plan 095).
//
// Bought on a press, not on opening the question: the first learner to
// ask for a question pays its translation (GET .../study, cached by
// content for everyone after, backend/study/exam_study.py), and the
// desk opens a question on arrival and on every ←/→.
export default function ExamStudy({ session, examId, revision, question }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [study, setStudy] = useState(null)
  const [failed, setFailed] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  // The sentence the breakdown on screen belongs to: an answer that
  // arrives after the learner moved on is dropped.
  const sentenceRef = useRef(null)

  const load = useCallback(() => {
    setFailed(false)
    setStudy(null)
    apiJson(
      `/api/exams/${encodeURIComponent(examId)}/revisions/${revision}/questions/${encodeURIComponent(question.id)}/study?lang=${lang}`,
      session,
    )
      .then(s => {
        setStudy(s)
        sentenceRef.current = s.sentence
        if (!s.sentence) return
        // The local tier: free, no model (routes/phrase.py), the
        // exercise taken whole however many 。 it holds.
        apiFetch('/api/phrase/analyze', session, {
          method: 'POST',
          body: JSON.stringify({ phrase: s.sentence, save: false, whole: true, lang }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (sentenceRef.current === s.sentence) setAnalysis(d) })
          .catch(() => {})
      })
      .catch(() => setFailed(true))
  }, [examId, revision, question.id, lang, session])

  function toggle() {
    playUi('click-mode-selection')
    if (!open && !study) load()
    setOpen(v => !v)
  }

  function explain() {
    const key = sentenceRef.current
    if (!key || explaining) return
    setExplaining(true)
    setExplainError(null)
    explainSentence(session, key, lang)
      .then(d => { if (sentenceRef.current === key) setAnalysis(d) })
      .catch(e => {
        if (sentenceRef.current === key) setExplainError(e?.message === '503' ? t.explainUnavailable : t.explainFailed)
      })
      .finally(() => { if (sentenceRef.current === key) setExplaining(false) })
  }

  const choices = question.choices ?? []
  const translated = Object.fromEntries((study?.choices ?? []).map(c => [c.id, c.translation]))

  return (
    <div className="exam-study">
      <button
        type="button"
        className="btn-secondary exam-study__toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? t.examStudyHide : t.examStudyOpen}
      </button>

      {open && (
        failed ? (
          <div className="exam-study__failed">
            <span className="hint">{t.examStudyFailed}</span>
            <button type="button" className="btn-secondary" onClick={load}>{t.examStudyRetry}</button>
          </div>
        ) : !study ? (
          <Loading />
        ) : (
          <div className="exam-study__body">
            {study.context && (
              <section className="exam-study__part" aria-label={t.examStudyPassage}>
                <span className="cap">{t.examStudyPassage}</span>
                <p className="exam-study__context">{study.contextTranslation}</p>
              </section>
            )}

            {choices.length > 0 && (
              <section className="exam-study__part" aria-label={t.examStudyChoices}>
                <span className="cap">{t.examStudyChoices}</span>
                <ol className="exam-study__choices">
                  {choices.map((c, i) => (
                    <li
                      key={c.id}
                      className={c.id === question.answer ? 'exam-study__choice exam-study__choice--right' : 'exam-study__choice'}
                    >
                      <span className="exam-study__no" aria-hidden="true">{i + 1}</span>
                      <span className="exam-study__jp" lang="ja">{c.textJp}</span>
                      <span className="exam-study__en">{translated[c.id] || t.examStudyNoWord}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="exam-study__part" aria-label={t.examStudySentence}>
              <span className="cap">{t.examStudySentence}</span>
              {analysis ? (
                <SentenceBreakdown
                  analysis={analysis}
                  layout="rows"
                  translation={study.translation}
                  sentenceText={study.sentence}
                  t={t}
                  onTokenClick={w => setLookup(vocabLookup(w))}
                  onGrammarOpen={g => setLookup(grammarLookup(g))}
                  onExplain={explain}
                  explaining={explaining}
                  explainError={explainError}
                />
              ) : (
                <>
                  <p className="exam-study__sentence" lang="ja">{study.sentence}</p>
                  <span className="bkd__en">{study.translation}</span>
                </>
              )}
            </section>
          </div>
        )
      )}

      {lookup && (
        <DictionaryLookupSheet key={lookupKey(lookup)} {...lookup} session={session} onClose={closeLookup} />
      )}
    </div>
  )
}
