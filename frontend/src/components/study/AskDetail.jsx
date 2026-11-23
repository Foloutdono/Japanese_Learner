import { Fragment } from 'react'
import { useLang } from '../../LangContext'

// ── 問 — the detail of one flagged mistake (plan 330) ─────────────────
// A translation review's Détail button asks the asking for the fuller
// explanation of one item, and the server answers it in parts
// (backend/routes/ask.py, explain_fix) rather than a paragraph, so a
// learner on a narrow panel finds the part they want: what happened, the
// forms side by side, an example or two, a line to remember it by. Each
// part is absent when the model left it out; nothing here supplies one.
// The headings are the app's own words, the parts the tutor's, in the
// learner's language.
export function AskDetail({ detail }) {
  const { t } = useLang()
  if (!detail?.what) return null
  const { what, rule = [], examples = [], memo = '' } = detail
  return (
    <div className="ask-detail">
      <section className="ask-detail__part">
        <h4 className="ask-detail__head">{t.askDetailWhat}</h4>
        <p className="ask-detail__what">{what}</p>
      </section>
      {rule.length > 0 && (
        <section className="ask-detail__part">
          <h4 className="ask-detail__head">{t.askDetailRule}</h4>
          <dl className="ask-detail__rule">
            {rule.map((row, i) => (
              <Fragment key={i}>
                <dt>{row.label}</dt>
                <dd lang="ja">{row.text}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}
      {examples.length > 0 && (
        <section className="ask-detail__part">
          <h4 className="ask-detail__head">{t.askDetailExamples}</h4>
          <ul className="ask-detail__examples">
            {examples.map((ex, i) => (
              <li key={i}>
                <b lang="ja">{ex.jp}</b>
                {ex.tr && <span>{ex.tr}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {memo && <p className="ask-detail__memo">{memo}</p>}
    </div>
  )
}
