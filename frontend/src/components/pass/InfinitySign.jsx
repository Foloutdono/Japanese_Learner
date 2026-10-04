// ∞, drawn rather than set (plan 172): the fonts' sign is a thin glyph
// half the figures' height, so an unlimited balance read as a smudge
// beside a counted one. A stroke at the figures' weight, sized by its
// caller's em.
export function InfinitySign({ label, className = '' }) {
  return (
    <svg
      className={`pinf ${className}`.trim()}
      viewBox="0 0 28 14"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <path d="M14 7C11 2.6 8.6 1.6 6.6 1.6a5.4 5.4 0 0 0 0 10.8c2 0 4.4-1 7.4-5.4s5.4-5.4 7.4-5.4a5.4 5.4 0 0 1 0 10.8c-2 0-4.4-1-7.4-5.4z" />
    </svg>
  )
}
