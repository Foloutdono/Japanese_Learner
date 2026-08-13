import { useLang } from '../../LangContext'
import { serviceFor } from '../../config/stations'
import { playUi } from '../../lib/audio'

/**
 * ModeSelector — 種別
 *
 * Study modes as service types. On a Japanese line the type says how
 * often the train stops for you, and studying has exactly that axis:
 * how much the mode holds your hand. The ladder and the reasoning
 * behind each rung live in config/stations.js.
 *
 * The pips are the important part. "快速" means nothing to somebody
 * learning their first hundred kanji, and neither does the English
 * "RAPID" this used to print underneath it — that is railway
 * vocabulary, not study vocabulary, which is why the badges read as
 * arbitrary. Four dots against one is legible immediately and needs
 * no glossary: more stops, more help.
 *
 * The same component also drives the study-source pickers ("by
 * level", "by theme"), whose keys aren't services at all. Those get
 * the board's own 番線 platform number rather than a wrong badge —
 * previously a roundel reading "01…04", which is the one piece of
 * furniture on these screens that looked like it came from a generic
 * list rather than from a station. The home board says 「1 番線」 for
 * the track a service leaves from; a selection screen is where you
 * pick which one to board, so it says the same thing in the same
 * type. Nothing new to learn, and the two screens stop being cousins.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 *
 * Props:
 *   modes    — array of { key, label, desc?, sample?, color? }
 *     sample — optional Japanese specimen line (the characters a set
 *       actually contains, say). Set in the Japanese face and spaced
 *       like the 停車駅 strip under a destination, because it is the
 *       same kind of information: what this row actually stops at.
 *   onSelect(key) — called when a row is chosen
 */
export default function ModeSelector({ modes, onSelect }) {
  const { t } = useLang()

  return (
    <div className="choice-list">
      {modes.map((m, i) => {
        const service = serviceFor(m.key)
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => { playUi('click-mode-selection'); onSelect(m.key) }}
            className="choice-row"
            style={m.color ? { '--row-color': m.color } : undefined}
          >
            <span className="choice-row__accent" aria-hidden="true" />

            <span className="choice-row__lead">
              {service ? (
                <span
                  className={`service service--${service.key}`}
                  title={t.serviceLabel?.[service.key]}
                >
                  <span className="service__jp" lang="ja">{service.jp}</span>
                  {service.stops > 0 && (
                    <span className="service__stops" aria-hidden="true">
                      {[1, 2, 3, 4].map(n => (
                        <span
                          key={n}
                          className={`service__pip${n <= service.stops ? ' service__pip--on' : ''}`}
                        />
                      ))}
                    </span>
                  )}
                </span>
              ) : (
                <span className="choice-row__platform">
                  <span className="choice-row__no">{i + 1}</span>
                  <span className="choice-row__no-unit" lang="ja">番線</span>
                </span>
              )}
            </span>

            {/* Title left, 備考 right — the departure board's own row,
                and the one LevelSelector's route stops already used.
                Stacked under the title instead, the description left
                the right two-thirds of every row empty on any screen
                wider than a tablet. Below 640px they stack. */}
            <span className="choice-row__main">
              <span className="choice-row__title">{m.label}</span>
              {(m.desc || m.sample) && (
                <>
                  <span className="choice-leader" aria-hidden="true" />
                  <span className="choice-row__note">
                    {m.desc && <span className="choice-row__desc">{m.desc}</span>}
                    {m.sample && (
                      <span className="choice-row__sample" lang="ja" aria-hidden="true">{m.sample}</span>
                    )}
                  </span>
                </>
              )}
            </span>

            {/* The same mark the board puts at the end of every
                service, appearing on hover. A selection row led
                somewhere and said so with nothing at all. */}
            <span className="choice-row__go" aria-hidden="true">▶</span>
          </button>
        )
      })}
    </div>
  )
}
