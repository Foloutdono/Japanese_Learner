import { useLang } from '../../LangContext'

// ── 見本 — the exercise as the run will ask it, drawn in the page (plan 159) ──
// The Learn stations print, in a small well on each platform, the card
// it will ask (plan 137, LinePlatforms' Specimen). A practice station
// has one platform a stop, so its page gives the well the room a card
// row would have had: the sentence the run would show, at the size the
// run shows it, over the field the answer goes in -- the paper the
// run's card lies on, seen from the station (the owner's pick A of the
// canvas "Practice screens — layout options").
//
// Every word in it is the stop's own (/api/station/{platform}/samples:
// the grade bank's first sentence, the grade's first text and its first
// question, the grade's first point), never an illustration; a stop
// that has no fixed sentence -- a frequency tier, the learner's own
// cards -- draws the words the run will build from, or says what it
// builds from. Decorative for a screen reader, as plan 137's is: the
// page's description already says what the well shows.

// A clip's waveform, drawn once: the bars of a spoken line, not of any
// particular one.
const WAVE = [30, 55, 80, 45, 65, 95, 60, 35, 70, 50, 85, 40, 25, 55, 75, 45, 30, 60]

const PLACEHOLDER = {
  reading: 'romajiPlaceholder',
  translation: 'japanesePlaceholder',
  dictation: 'dictationPlaceholder',
  composition: 'japanesePlaceholder',
}

function Field({ platform }) {
  const { t } = useLang()
  const key = PLACEHOLDER[platform]
  if (!key) return null
  return (
    <span className="prc-spec__field">
      <span className="prc-spec__ghost">{t[key]}</span>
      <kbd className="desk-kbd">{t.keyEnter}</kbd>
    </span>
  )
}

export function Audio({ listens = null }) {
  return (
    <span className="prc-spec__audio">
      <span className="prc-spec__play">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l10 6-10 6z" /></svg>
      </span>
      <span className="prc-spec__wave">
        {WAVE.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
      </span>
      {listens && <span className="prc-spec__listens">{listens}</span>}
    </span>
  )
}

/**
 * platform — reading | translation | comprehension | dictation | composition
 * card     — the stop's card from the samples, or null while it is on its way
 * tag      — the caption in the well's corner ("Une phrase du grade")
 * words    — a frequency tier's first words, in place of a card
 * note     — a line saying what the run builds from, in place of a card
 */
export function PracticeSpecimen({ platform, card = null, tag, words = null, note = null }) {
  const { t } = useLang()
  const two = platform === 'comprehension' && card && !words && !note
  return (
    <div className={two ? 'prc-spec prc-spec--two' : 'prc-spec'} aria-hidden="true">
      {tag && <span className="prc-spec__tag">{tag}</span>}
      {face(platform, card, words, note, t)}
    </div>
  )
}

function face(platform, card, words, note, t) {
  if (words) {
    return (
      <>
        <p className="prc-spec__words" lang="ja">{words.join('　')}</p>
        <Field platform={platform} />
      </>
    )
  }
  if (note) {
    return (
      <>
        <p className="prc-spec__note">{note}</p>
        <Field platform={platform} />
      </>
    )
  }
  if (!card) return null
  switch (platform) {
    case 'reading':
      return (
        <>
          <span className="prc-spec__clock"><i /></span>
          <p className="prc-spec__jp" lang="ja">{card.jp}</p>
          <Field platform={platform} />
        </>
      )
    case 'translation':
      // The bank carries its sentences in English only, and the run
      // prompts with them for every learner (routes/reading.py's
      // translation_lang), so the well says so too.
      return (
        <>
          <p className="prc-spec__prompt" lang="en">{card.en}</p>
          <span className="prc-spec__to">↓</span>
          <Field platform={platform} />
        </>
      )
    case 'dictation':
      return (
        <>
          <Audio listens={t.dictationListensLeft(2)} />
          <Field platform={platform} />
        </>
      )
    case 'composition':
      return (
        <>
          <p className="prc-spec__jp" lang="ja">{card.jp}</p>
          {card.meaning && <p className="prc-spec__gloss">{card.meaning}</p>}
          <Field platform={platform} />
        </>
      )
    case 'comprehension':
      return (
        <>
          <span className="prc-spec__text">
            <span className="prc-spec__title" lang="ja">{card.title}</span>
            <span className="prc-spec__body" lang="ja">{card.text}</span>
          </span>
          <span className="prc-spec__ask">
            <span className="prc-spec__q">{card.question}</span>
            <span className="prc-spec__opts">
              {(card.options ?? []).map((o, i) => (
                <span key={o} className="prc-spec__opt"><b>{i + 1}</b>{o}</span>
              ))}
            </span>
          </span>
        </>
      )
    default:
      return null
  }
}
