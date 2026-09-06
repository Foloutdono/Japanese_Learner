// ── Themes — a theme key's name, in the UI's language ────────
// /api/themes returns keys ("body_parts") with no label attached: themes
// are backend data, not copy. The label is the locale's `themeBodyParts`
// when it exists, and a readable fallback ("Body parts") until every
// language file has caught up with a newly built theme. Shared by the
// theme picker and the run's head, so a theme is named the same way in
// both places.
export function themeLabelFor(t, key) {
  const camel = 'theme' + key.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  return t[camel] ?? key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}
