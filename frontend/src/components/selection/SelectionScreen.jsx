import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { getNavLinks } from '../../config/navLinks'
import { stationFor, HOME_STATION } from '../../config/stations'
import { StationSign } from '../station/StationSign'
import { startAmbiance, stopAmbiance } from '../../lib/audio'

/**
 * SelectionScreen
 * Layout shell shared by every level/phase/mode selection screen.
 *
 * ── The station plate ──
 * Home is a platform in 日本語駅 and every section is a service
 * leaving it (see config/stations.js). This is where you get off: the
 * same 駅名標 the home screen hangs over its own platform, now naming
 * the station you have just arrived at, with an arrow back to
 * にほんご. One component, two ends of the same journey — which is
 * what makes the app read as a line rather than a set of screens.
 *
 * The plate is derived from the URL rather than passed in: every
 * selection screen lives at its own section's path, so nothing has to
 * be threaded through eleven callers, and a path with no station
 * (a custom deck's study setup, say) simply doesn't get one.
 *
 * Props:
 *   eyebrow, heading, subtitle — optional page header, rendered under
 *     the plate. Callers that supply their own copy (the exam screens
 *     name a specific paper) keep working exactly as before.
 *   maxWidth — max-width for the content column (default 720).
 *
 * Also owns the 'selection' ambiance track for as long as it's
 * mounted — every level/mode/tier/theme picker renders inside this
 * shell, so this is the one place that needs the start/stop effect.
 */
export default function SelectionScreen({
  children,
  eyebrow,
  heading,
  subtitle,
  maxWidth = 720,
}) {
  const { t } = useLang()

  useEffect(() => {
    startAmbiance('selection')
    return () => stopAmbiance()
    // Mount/unmount only. Without the dependency array this
    // effect re-ran on every render, tearing the loop down and
    // starting it again from zero each time.
  }, [])

  const innerStyle =
    maxWidth !== 720 ? { '--content-max-w': `${maxWidth}px` } : undefined

  // From the router rather than window.location: the two agree under
  // BrowserRouter, but only one of them is the app's actual source of
  // truth for where you are, and only one survives being rendered
  // under a MemoryRouter (tests, previews) without silently deciding
  // it's on some other page.
  const { pathname } = useLocation()
  const section = getNavLinks(t).find(link => link.path === pathname)
  const station = stationFor(pathname)

  // The section's pigment becomes the line colour for everything
  // below the plate — the numbering roundels, the row accents, the
  // route diagram. One line, one colour, from the departure board all
  // the way to the last choice before you start studying.
  const lineStyle = section
    ? { ...innerStyle, '--row-color': section.color, '--line-color': section.color }
    : innerStyle

  return (
    <div className={`container selection-screen${section ? ' selection-screen--station' : ''}`}>
      <div className="selection-screen__inner" style={lineStyle}>
        {section && (
          <StationSign
            station={station}
            name={section.icon}
            color={section.color}
            prev={HOME_STATION.kana}
            size="sm"
          />
        )}

        {(eyebrow || heading || subtitle) && (
          <div className="selector-header">
            {eyebrow && <div className="selector-header__eyebrow">{eyebrow}</div>}
            {heading && <div className="selector-header__title">{heading}</div>}
            {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
