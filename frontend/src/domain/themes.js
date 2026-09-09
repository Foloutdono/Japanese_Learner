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

// ── The four levels inside a theme ───────────────────────────
// A theme is cut into four bands by frequency (see
// backend/content/theme_data.py). Ordered easiest-first; this order and
// these keys must match theme_data.LEVELS — the backend rejects anything
// else with a 400.
export const THEME_LEVELS = ['basic', 'medium', 'advanced', 'expert']

// The Japanese half of each name. Here rather than in the locale files
// because it is the same in every language, and a value duplicated
// across two files is a value that will drift.
export const THEME_LEVEL_JP = {
  basic:    '基本',
  medium:   '中級',
  advanced: '上級',
  expert:   '達人',
}

export function themeLevelLabel(t, key) {
  return t['themeLevel' + key.charAt(0).toUpperCase() + key.slice(1)] ?? key
}

export function isThemeLevel(key) {
  return THEME_LEVELS.includes(key)
}
