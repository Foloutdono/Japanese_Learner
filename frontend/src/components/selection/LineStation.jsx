// ── 机 — a line's station: the line over its cars (plan 251) ─────────
// The owner's pick C of the canvas "Tsuji — the learning modes on the
// desk", for a kana set or a JLPT level of vocab, kanji or grammar. The
// station split (plan 137) stood the stops in a column beside the
// platforms, and the platforms were rows each holding its card in a
// small well: eleven rows of words and two narrow columns of air. The
// line now runs across the top of the page, the way a line map hangs
// over a platform -- each stop under its marker, its code and name and
// its figure, the open one lit -- and the open stop's exercises stand
// under it as the cars of its train (LinePlatforms), each with the card
// it asks.
//
// The stops are the route the split listed (RouteStops `across`): links
// that replace the page, one tab stop walked with ←/→, the learner's
// own marked. Rendered only on the desk, by the screen that owns the
// line; the phone keeps its two screens.
export function LineStation({ label, line, children }) {
  return (
    <div className="desk-station">
      <nav className="desk-station__line" aria-label={label}>{line}</nav>
      {children}
    </div>
  )
}
