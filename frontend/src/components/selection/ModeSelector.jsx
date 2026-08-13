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
 * level", "by theme"), whose keys aren't services at all — those get
 * a plain numbered roundel rather than a wrong badge.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 *
 * Props:
 *   modes    — array of { key, label, desc?, color? }
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
                <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
              )}
            </span>

            <span className="choice-row__main">
              <span className="choice-row__title">{m.label}</span>
              {m.desc && <span className="choice-row__desc">{m.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
