import { useLang } from '../../LangContext'
import { serviceFor, SERVICE_JP } from '../../config/stations'
import { playUi } from '../../lib/audio'

/**
 * ModeSelector — 種別
 *
 * Study modes as service types. On a Japanese line the type tells you
 * how much the train stops for you — 各駅停車 halts everywhere, 特急
 * skips nearly everything — and that is exactly the ladder these
 * modes form: multiple choice puts the answer in front of you,
 * flashcards make you self-assess, writing gives you nothing but a
 * blank pad. The badge is real information rather than a costume, and
 * the mapping lives in config/stations.js.
 *
 * The same component also drives the study-source pickers ("by
 * level", "by theme"), whose keys aren't services at all — those get
 * no badge rather than a wrong one.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead (and,
 * on the rare path with no plate, carries its own heading). A "Choose
 * your training mode" caption on top of a self-explanatory list of
 * rows was spending a full line to repeat the sign above it.
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

            {service ? (
              <span className={`service service--${service}`}>
                <span className="service__jp" lang="ja">{SERVICE_JP[service]}</span>
                <span className="service__latin">{t.serviceLabel?.[service]}</span>
              </span>
            ) : (
              <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
            )}

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
