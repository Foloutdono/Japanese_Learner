import { createContext } from 'react'

// ── 机 — a settings page opened beside the list (plan 112) ──────
// On the desk the settings list and the open page share the screen
// (screens/SettingsScreen.jsx), so a page is not a place of its own
// there: it is a pane under the list's one heading, with no way back
// because the list it would go back to is beside it. True while a page
// is rendered in that pane; components/settings/SettingsPage.jsx reads
// it. In its own module because a component file may export components
// alone (react-refresh).
export const SettingsPaneContext = createContext(false)
