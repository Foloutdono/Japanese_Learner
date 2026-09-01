import { useLang } from '../../LangContext'
import { serviceFor } from '../../config/stations'
import { playUi } from '../../lib/audio'
import { useReportPlatformCount } from './platformCount'

/**
 * ModeSelector — のりば案内
 *
 * The choices at a station, drawn as the signs at the head of each
 * platform: a coloured rail carrying either the 番線 platform number
 * or the 種別 service type, then the destination and what it is.
 *
 * ── Why cards and not rows ──
 * This used to be full-width rows, borrowed from the home departure
 * board. That board carries eleven services with a remark on each and
 * earns its 1040px. These screens mostly carry two to five short
 * options, and the same row at the same width put a six-character
 * title at one end and a five-character specimen at the other with
 * five hundred pixels of nothing between them. A grid fills width by
 * multiplying columns instead of stretching one row, so two options
 * and thirty options both look deliberate.
 *
 * ── The ladder ──
 * On a Japanese line the service type says how often the train stops
 * for you, and studying has exactly that axis: how much the mode
 * holds your hand. The ladder and the reasoning behind each rung live
 * in config/stations.js. The pips are the part that makes it legible
 * — "快速" means nothing to somebody learning their first hundred
 * kanji, and neither does the English "RAPID". Four dots against one
 * needs no glossary: more stops, more help.
 *
 * The same component drives the study-source pickers ("by level", "by
 * theme"), whose keys aren't services at all — those get the board's
 * own 番線 platform number rather than a wrong badge.
 *
 * No header of its own — every caller renders inside <SelectionScreen>,
 * which already names the section on the station plate overhead.
 *
 * Props:
 *   modes    — array of { key, label, desc?, sample?, color?, action? }
 *     sample — optional Japanese specimen line (the characters a set
 *       actually contains, say), set in the Japanese face. It is the
 *       停車駅 strip under a destination: what this one actually stops
 *       at.
 *     action — optional { label, title?, onClick } secondary action for
 *       this one card. Rendered as a SIBLING of the card button, not
 *       inside it: the card is a <button>, and a button inside a button
 *       is invalid HTML that browsers resolve by dropping one of them.
 *       The wrapper below exists only to position the two.
 *   onSelect(key) — called when a card is chosen
 *   unit — whether the 番線 unit prints under the platform number on
 *     a numbered (non-service) card. Default true. The analyser's
 *     source picker turns it off: its navigation is deliberately
 *     plain-language-first, and 番線 was the one Japanese word left
 *     captioning a roundel that reads fine from the ring alone.
 *     jp     — optional Japanese name set as a quiet accent beside the
 *       title (the analyser's cards lead with the plain-language name
 *       and keep 文字/写真/動画 as the secondary register).
 *     aside  — optional node for a right-hand column behind a
 *       hairline. DESIGN.md's density contract: a card wider than
 *       ~440px must EARN its width with a right-hand column (meta, a
 *       figure, a status) — this is that column. The analyser puts
 *       the learner's own record on each platform there.
 */
export default function ModeSelector({ modes, onSelect, unit = true }) {
  const { t } = useLang()
  useReportPlatformCount(modes.length)

  return (
    <div className="platform-grid">
      {modes.map((m, i) => {
        const service = serviceFor(m.key)
        const card = (
          <button
            type="button"
            onClick={() => { playUi('click-mode-selection'); onSelect(m.key) }}
            className={`platform-card${service ? ` platform-card--${service.key}` : ''}`}
            style={m.color ? { '--row-color': m.color } : undefined}
            title={service ? t.serviceLabel?.[service.key] : undefined}
          >
            <span className="platform-card__lead">
              {service ? (
                <>
                  <span className="platform-card__service" lang="ja">{service.jp}</span>
                  {service.stops > 0 && (
                    <span className="platform-card__stops" aria-hidden="true">
                      {[1, 2, 3, 4].map(n => (
                        <span
                          key={n}
                          className={`platform-card__pip${n <= service.stops ? ' platform-card__pip--on' : ''}`}
                        />
                      ))}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="platform-card__no">{i + 1}</span>
                  {unit && <span className="platform-card__unit" lang="ja">番線</span>}
                </>
              )}
            </span>

            <span className="platform-card__body">
              <span className="platform-card__titlerow">
                <span className="platform-card__title">{m.label}</span>
                {m.jp && <span className="platform-card__titlejp" lang="ja">{m.jp}</span>}
              </span>
              {m.desc && <span className="platform-card__desc">{m.desc}</span>}
              {m.sample && (
                <span className="platform-card__sample" lang="ja" aria-hidden="true">{m.sample}</span>
              )}
            </span>

            {m.aside && <span className="platform-card__aside">{m.aside}</span>}

            <span className="platform-card__go" aria-hidden="true">▶</span>
          </button>
        )
        if (!m.action) return <div className="platform-slot" key={m.key}>{card}</div>
        return (
          <div className="platform-slot" key={m.key}>
            {card}
            <button
              type="button"
              className="platform-slot__action"
              title={m.action.title}
              onClick={() => { playUi('click-mode-selection'); m.action.onClick() }}
            >
              {m.action.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
