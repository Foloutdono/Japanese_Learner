import { ChevronIcon } from '../ui/Icons'

// ── A hall on the profile screen ──────────────────────────
// The profile used to be a list of one-off blocks: a thin link row to
// the stats screen, a bespoke daruma preview, nothing at all for the
// storehouse. Three different shapes for three doorways that do the
// same job. This is the one shape they share.
//
// Deliberately a *frame*, not a template: the chrome is fixed (pigment
// rule, glyph plate, title, live note, count, chevron) and the body is
// whatever that hall wants to show of itself — today's dolls, the
// equipped loadout, three running figures. A doorway that shows real
// state is worth walking through; one that shows an icon is a menu
// item. Adding a fourth hall is a `scope: 'profile'` entry in
// config/navLinks.js and a preview case in ProfileScreen — no new
// layout, no new CSS.
//
// `note` is the one line of live text under the title (how many
// darumas are waiting, how much of the storehouse is filled). It falls
// back to the section's own description, so a hall whose data hasn't
// loaded — or that simply has nothing to report — still reads as a
// finished card rather than a gap.
export function HallCard({ hall, note, badge = 0, children, onOpen }) {
  return (
    <button
      type="button"
      className="hall-card"
      style={{ '--hall-color': hall.color }}
      onClick={onOpen}
    >
      <span className="hall-card__rule" aria-hidden="true" />

      <span className="hall-card__head">
        <span className="hall-card__glyph" lang="ja" aria-hidden="true">{hall.icon}</span>
        <span className="hall-card__heading">
          <span className="hall-card__title">{hall.title}</span>
          <span className="hall-card__note">{note || hall.desc}</span>
        </span>
        {badge > 0 && <span className="hall-card__badge">{badge}</span>}
        <ChevronIcon direction="right" size={15} className="hall-card__arrow" />
      </span>

      {children && <span className="hall-card__preview">{children}</span>}
    </button>
  )
}
