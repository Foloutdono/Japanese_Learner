import { useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import RadicalSelector from './RadicalSelector'
import { LineDoors } from './LineDoors'
import { FrequencyPlate, SourcePlate } from './VocabSources'

// ── 机 — the kanji's sources: the doors over two plates (plan 267) ────
// The owner's pick C1 of the canvas "Tsuji — the sources and the line,
// redrawn". Plan 137's pick B had stood JLPT over the tiers in one
// column beside the radicals' plate, which on a real window held a page
// of six tiles under a stroke rail cut at its eleventh count. JLPT is
// now the page's head, its five levels as doors and the gate that
// resumes the learner's own as the line's last (LineDoors, as the
// vocabulary's sources have it), and under it two plates:
//
//   Frequency    the size in the plate's head, the tiers as rows, each
//                its number, its range, a bar of the kanji met and how
//                many
//   Radicals     the stroke rail in the plate's head, every count in
//                view, the page's tiles packed from the top left
//
// Every door, row and tile is a link that pushes: a stop is a place
// left for, and Back comes back here. The tier size and the radicals'
// stroke page ride in this page's URL, so Back lands on the page that
// was left.
const BASE = '/learn/kanji'

export default function KanjiSources({ session }) {
  const { t } = useLang()
  const [sp, setSp] = useSearchParams()
  const stroke = Number(sp.get('stroke')) || null
  const onStroke = n => {
    playUi('click-mode-selection')
    setSp(prev => {
      const next = new URLSearchParams(prev)
      next.set('stroke', String(n))
      return next
    }, { replace: true })
  }
  return (
    <div className="desk-sources desk-sources--doors desk-sources--kanji">
      <LineDoors source="kanji" base={BASE} />
      <div className="desk-sources__lower">
        <FrequencyPlate
          t={t}
          session={session}
          source="kanji"
          base={BASE}
          pools={false}
          title={t.byFrequencyKanji}
        />
        <SourcePlate id="desk-source-radicals" title={t.byRadical} className="desk-source--radicals">
          <div className="desk-source__tiles">
            <RadicalSelector
              session={session}
              onSelect={() => {}}
              stroke={stroke}
              onStroke={onStroke}
              linkTo={n => `${BASE}/radical/${n}`}
              push
            />
          </div>
        </SourcePlate>
      </div>
    </div>
  )
}
