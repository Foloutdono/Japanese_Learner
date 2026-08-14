// ── Section header ────────────────────────────────────────
// Every other label in this app is a pair: the station plate sets
// かな over 仮名 over KANA, the departure board sets 発車標 beside
// DEPARTURES, a platform card sets 番線 under its number. The section
// headings were the one place still doing something else — a lone
// serif line with a red tick under it — which is exactly why they read
// as imported from another design.
//
// So they take the same pair. `jp` is the term in Japanese, `title`
// the plain-language one; the rule underneath picks up whatever line
// colour the screen is on.
//
// `jp` is optional and the header falls back to the old single-line
// form without it, because eighteen call sites use this and not all of
// them have a Japanese word worth inventing.
//
// `count` is an optional tally set to the right — "3 of 6" over a badge
// grid. A separate slot rather than glued onto `title`, so it can be
// typeset as data (tracked, tabular) while the title stays a heading.
export function SectionHeader({ jp, title, count }) {
  return (
    <div className={`section-header${jp ? ' section-header--paired' : ''}`}>
      <div className="section-header__mark">
        {jp && <span className="section-header__jp" lang="ja">{jp}</span>}
        <span className="section-header__title">{title}</span>
      </div>
      {count != null && <div className="section-header__count">{count}</div>}
      <div className="section-header__rule" />
    </div>
  )
}
