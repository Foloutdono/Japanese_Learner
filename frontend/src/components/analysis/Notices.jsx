// ── 案内表示 — the notices under the intake ────────────────
// Four hand-rolled status banners used to live in AnalyzerScreen's own
// render: busy, failed, window-capped, and Passage-truncated. Two of
// them wore --danger for a fact rather than a failure -- a learner who
// pasted a long page was told, in the failure colour, that the paste
// worked. The busy one said "Analyzing the subtitles…" over a typed
// Sentence, because a 動画-only string was rendered for all three
// platforms. And none of the four sat in a live region, so pressing
// Analyze told a screen-reader user nothing: not that work started, not
// that it finished, not that it failed. The wave-5 retrospective named
// this directly: "four near-identical status banners are hand-rolled in
// the render where a notices model belongs." This is that model.
//
// Two tones, and the distinction is the whole point:
//   'info'   a true fact about the Passage (the Window was capped, only
//            the first N Sentences were analysed). Nothing failed.
//   'bad'    something did not work and the learner has to act.
// A reviewer should reject any notice that reports a successful outcome
// in 'bad'.
//
// The live region is HERE and nowhere else. One polite region per
// screen: two regions racing each other is how a screen reader ends up
// announcing neither. Callers that need to announce something without
// drawing a banner pass it as `announcement`. It exists in the DOM from
// first render, empty or not -- a region injected at the same moment
// its text appears is frequently not announced by assistive tech; it
// has to exist first and change later.

// `t` is accepted for future callers (plan 037's dismiss control); every
// notice already arrives with its text resolved, so the screen stays
// the one place that maps state to copy.
// eslint-disable-next-line no-unused-vars
export function Notices({ notices = [], announcement, t }) {
  return (
    <>
      {notices.map(n => (
        <div
          key={n.id}
          className={`anl-panel anl-notice-line anl-notice-line--${n.tone}`}
        >
          {n.text}
        </div>
      ))}
      <p className="anl-sr-only" role="status" aria-live="polite">{announcement ?? ''}</p>
    </>
  )
}
