import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useStats } from '../../stores/stats'
import { useProfileSummary } from '../../stores/profileSummary'
import { board } from '../../stores/boarding'
import { deckItems } from '../../domain/lineProgress'
import { offeredModes } from '../../domain/studyModes'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { GateButton } from '../ui/GateButton'
import LevelSelector from './LevelSelector'

// ── 机 — a source page's head: JLPT's five doors and the gate (plan 267) ──
// The owner's picks C1 (kanji) and C3 (vocabulary) of the canvas "Tsuji —
// the sources and the line, redrawn". The sources opened on a strip of
// what the learner had started over a JLPT plate that said the same
// level again (the vocabulary), or on a JLPT plate in a column beside
// the others (the kanji). The JLPT line is now the page's head, drawn as
// the line over a level's station is (RouteStops `across`, the doors):
// five doors under the line's stripe, the learner's own captioned, each
// a push to its level's station; and the gate as the line's last door,
// boarding the learner's level on its first platform.
//
// The level the gate boards: the learner's own, else the first they
// have met cards in, else the first -- always somewhere to go on.
//
// Under STACK the page is too narrow for five doors and the gate on one
// row (a 1,100px window leaves it about 800px): the gate takes a row of
// its own under the doors, at the line's far end. Measured, as the
// strip before it was (plan 183): the desk's stylesheet answers one
// width only.
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const STACK = 1000

export function LineDoors({ source, base }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [boxRef, width] = useBoxWidth(true)
  const stacked = width != null && width < STACK
  const stats = useStats().data
  const here = useProfileSummary()?.jlptLevel ?? null
  const levels = LEVELS.map(level => ({ level, ...deckItems(stats, source, level) }))
  const lead = levels.find(l => l.level === here)
    ?? levels.find(l => l.started > 0)
    ?? levels[0]
  const mode = offeredModes(source)[0]
  const depart = () => board(() => navigate(`${base}/${lead.level}/${mode}`))
  return (
    <div ref={boxRef} className={`desk-linedoors${stacked ? ' desk-linedoors--stacked' : ''}`}>
      <nav className="desk-linedoors__line" aria-label={t.stationJlpt}>
        <LevelSelector source={source} linkTo={lvl => `${base}/${lvl}`} across captioned push />
      </nav>
      <div className="desk-linedoors__gate">
        <GateButton label={`${lead.started > 0 ? t.sourcesResume : t.start} ${lead.level}`} onClick={depart} />
        {lead.total > 0 && <span className="desk-source__num">{t.unseenNote(lead.total - lead.started)}</span>}
      </div>
    </div>
  )
}
