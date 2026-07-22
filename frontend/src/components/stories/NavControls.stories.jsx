import { MuteButton, ThemeToggle, LangSwitcher } from '../NavControls'

// All three read/write real browser state (localStorage + <html
// data-theme>, mute flag, LangContext's switchLang) — clicking here
// has a genuine, persistent effect. This is how TopBar mounts them:
// together, as a row.
export default {
  title: 'Nav/NavControls',
}

export const Row = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <MuteButton />
      <ThemeToggle />
      <LangSwitcher />
    </div>
  ),
}