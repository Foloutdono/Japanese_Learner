import { useNavigate } from 'react-router-dom'
import { useDeparture, endDeparture } from '../../stores/departure'
import { stationFor } from '../../config/stations'
import { TicketGate } from './TicketGate'

// ── Where the gate is mounted ─────────────────────────────
// Alongside <Routes/>, never inside it. The gate has to keep playing
// across the navigation it triggers — it wipes the screen, the route
// swaps underneath, and only then does the wipe fade off the
// destination. Rendered by a screen instead, it is unmounted by that
// same navigation and the exit never plays. See stores/departure.
export function DepartureGate() {
  const navigate = useNavigate()
  const section = useDeparture()
  if (!section) return null

  return (
    <TicketGate
      key={section.path}
      section={section}
      station={stationFor(section.path)}
      onNavigate={() => navigate(section.path)}
      onDone={endDeparture}
    />
  )
}
