import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { Bar } from '../chrome/Bar'
import { startAmbiance, stopAmbiance } from '../../lib/audio'

/**
 * SelectionScreen — a station page's frame (plan 071).
 *
 * Every level, set, tier, theme and mode picker renders inside it:
 * the section's bar (roundel, pigment, the title, a sub for where
 * you are on the line, an aside for the way out or the other way
 * in), then the choice under it, on the page the Learn gate gives
 * its screens. The station plate, the platform count and the clock
 * this used to hang retired with the chrome (docs/design/mobile):
 * the bar names the place now.
 *
 * The section is derived from the URL rather than passed in: every
 * selection screen lives at its own section's path or under it (see
 * sectionFor/stationFor, which fall back to the longest matching
 * prefix). Its pigment becomes the line colour for everything below
 * the bar — the roundels, the rails, the route diagram.
 *
 * Also owns the 'selection' ambiance track for as long as it is
 * mounted, so this is the one place that needs the start/stop effect.
 */
export default function SelectionScreen({ title, sub, aside, children }) {
  const { t } = useLang()
  const { pathname } = useLocation()

  useEffect(() => {
    startAmbiance('selection')
    return () => stopAmbiance()
  }, [])

  const section = sectionFor(pathname, t)
  const station = section ? stationFor(section.path) : null
  const style = section
    ? { '--row-color': section.color, '--line-color': section.color }
    : undefined

  return (
    <main id="main-content" className="learn" style={style}>
      <Bar code={station?.code} color={section?.color} title={title ?? section?.title} sub={sub} aside={aside} />
      {children}
    </main>
  )
}
