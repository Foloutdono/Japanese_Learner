import { useLang } from '../LangContext'
import { getSections } from '../config/tabs'
import { HOME_STATION } from '../config/stations'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { Bar } from '../components/chrome/Bar'

// ── 実践 — the Practice gate: four platforms (plan 068) ───────
// Reading practice, reading comprehension, translation, the mock
// exam — the sentence-level sections, which schedule words rather
// than levels and so have no line on the map. The gate's own bar over
// one platform card per section, each in its own pigment; boarding one
// announces it and departs through the gate, like any other section.
// The pass tags the canvas draws on these cards stay out until a
// purchase flow exists (plan 069, HAS_STORE).
//
// Each title carried the section's own 読書 理解 翻訳 模試 after it, in a
// smaller face. It was the second name of a thing already named, and at
// phone width the pair ran past the card: 理解 broke between its two
// characters, one to a line. The Japanese is still on the roundel of
// every station these cards open, and on the gate the departure passes
// through — this row is the one place it was a caption. Owner's call.
//
// The bar is the concourse's, not a line's: the home roundel and the
// gold, exactly as the Learn gate wears them. It was the `register`
// variant — no roundel, a grey hairline — on the reasoning that
// Practice is not a place on a line, and that reading was right about
// the map and wrong about the screen: it made the one gate of five
// that carries no roundel and no pigment, which reads as unfinished
// rather than as different.
export default function PracticeScreen() {
  const { t } = useLang()
  const platforms = getSections('practice', t)

  function depart(section) {
    playAnnouncement(section.clip)
    beginDeparture(section)
  }

  return (
    <main id="main-content" className="practice">
      <Bar code={HOME_STATION.code} title={t.tabPractice} sub={t.practiceSub} color="var(--accent2)" />
      <div className="platform-grid">
        {platforms.map((section, i) => (
          <button
            key={section.path}
            type="button"
            className="platform-card platform-card--line"
            style={{ '--line-color': section.color }}
            onClick={() => depart(section)}
          >
            <span className="platform-card__lead">
              <span className="platform-card__no">{i + 1}</span>
            </span>
            <span className="platform-card__body">
              <span className="platform-card__title">{section.title}</span>
              <span className="platform-card__desc">{(section.desc ?? '').split('\n')[0]}</span>
            </span>
            <span className="platform-card__go" aria-hidden="true">▶</span>
          </button>
        ))}
      </div>
    </main>
  )
}
