import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { StationSign } from './StationSign'
import { useStationClock } from './useStationClock'

// ── The masthead, for screens that aren't selection screens ──
// <SelectionScreen> has hung a 駅名標 over every level/mode picker for
// a while; everywhere else — the profile, the stats, the decks, the
// dictionary, the settings — opened with a TopBar and then a bare
// container. Those were exactly the
// screens that still read as a different app, because the one object
// this app uses to say *where you are* was missing from them.
//
// Same component, same plate, same rule: name the station, then begin.
//
// Everything is derived from the path, so a screen renders
// <StationHeader /> and nothing else. A path with no station entry
// renders nothing at all rather than an empty plate.
export function StationHeader({ aside }) {
  const { t } = useLang()
  const { pathname } = useLocation()
  const now = useStationClock()

  const section = sectionFor(pathname, t)
  if (!section) return null

  const station = stationFor(pathname)
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div className="station-header" style={{ '--line-color': section.color, '--row-color': section.color }}>
      <StationSign
        station={station}
        name={section.icon}
        latin={section.title}
        color={section.color}
        size="sm"
        aside={
          <>
            {aside}
            <span className="board-clock station-sign__clock" aria-label={`${hh}:${mm}`}>
              {hh}<span className="board-clock__colon" aria-hidden="true">:</span>{mm}
            </span>
          </>
        }
      />
    </div>
  )
}
