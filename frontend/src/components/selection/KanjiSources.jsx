import { useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import RadicalSelector from './RadicalSelector'
import { FrequencyPlate, JlptPlate, SourcePlate } from './VocabSources'

// ── 机 — the kanji's three sources as plates ─────────────────────────
// The owner's pick B of three drawn directions (2026-09-26): on the desk
// /learn/kanji was three cards across the top of an empty window, as the
// vocabulary's sources were before plan 137. It takes the vocabulary's
// plates, laid for what the kanji have: the two LINES in one column --
// JLPT's five levels at their own height over the frequency tiers under
// their size -- and the radicals, which are chosen by their shape, as
// the glyph tiles of the index (RadicalSelector) on the wide plate
// beside them, a page per stroke count.
//
// Every row and tile is a link that pushes: a stop is a place left for,
// and Back comes back here. The tier size and the radicals' stroke page
// ride in this page's URL, so Back lands on the page that was left.
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
    <div className="desk-sources desk-sources--kanji">
      <div className="desk-sources__col">
        <JlptPlate t={t} source="kanji" base={BASE} compact />
        <FrequencyPlate
          t={t}
          session={session}
          source="kanji"
          base={BASE}
          pools={false}
          title={t.byFrequencyKanji}
          desc={t.byFrequencyKanjiDesc}
        />
      </div>
      <SourcePlate id="desk-source-radicals" title={t.byRadical} desc={t.byRadicalDesc} className="desk-source--radicals">
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
  )
}
