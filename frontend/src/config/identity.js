// ── 定期券 — the pass, which is not a station ──────────────
// /profile and /settings were given plates, line codes and readings
// when every screen in the app was being brought onto the network. It
// was the wrong object, and the profile screen showed exactly how
// wrong: it drew a 駅名標 announcing your arrival at "定期券 station",
// and then, directly underneath, drew your actual 定期券. You do not
// travel to yourself.
//
// A pass is the other half of the same design system — the thing you
// carry rather than a place you go. Every station in the app has a
// code, a reading and a line colour because those are what get you
// *somewhere*; a pass has none of them, and deliberately so. What it
// has instead is the contactless mark, a holder, and a card.
//
// So these two routes are modelled here rather than in stations.js,
// and the separation is the whole point of the file: a route is in one
// registry or the other, never both, and nothing has to remember which
// kind of masthead to draw.
//
// 設定 belongs with the pass rather than beside it: preferences are
// the card's own settings — sound, theme, language, the account the
// pass is issued to — not a destination of their own.
const ROUTES = ['/profile', '/settings']

export function isIdentityRoute(path) {
  return ROUTES.includes(path)
}

/**
 * The identity routes, keyed by path. `glyph`/`title` name the screen;
 * there is no code, no kana and no line colour, because a pass has
 * none of those. Returns null for anything that is not one of them.
 */
export function identityFor(path, t) {
  if (!isIdentityRoute(path)) return null
  return path === '/profile'
    ? { path, glyph: '定期券', title: t.profileTitle, sub: t.passLabel }
    : { path, glyph: '設定',   title: t.settings,     sub: t.preferences }
}
