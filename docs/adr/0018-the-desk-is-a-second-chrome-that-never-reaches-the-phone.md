# 0018 — The desk is a second chrome, and it never reaches the phone

- **Status**: accepted
- **Date**: 2026-09-22
- **Supersedes**: plan 068's "One chrome at every width" (DESIGN.md, Structure)

## Context

Plan 068 gave Tsuji one chrome at every width: the HUD across the top, five
gates across the bottom, the screen between them. Above 768px the same phone
frame was drawn as a centred column of `--board-w`. That was a deliberate
answer to the app that preceded it, which had a burger drawer, an auto-hiding
top bar and a concourse home on wide screens, and so was two apps that drifted
apart.

On a computer the answer cost too much. A laptop showed a phone floating in
empty space: a five-gate tab bar a hand's width below the content, icons with
one caption among them (the rule that exists because five French words do not
fit in 390px), the plates a single column of thousand-pixel slabs, and a
keyboard that already rated, answered and flipped with nothing on screen to
say so. The owner asked for two systems, one for mobile and one for a
computer, on one condition: **the mobile design must never break.**

## Decision

At **1100px and up** the app draws a second chrome, the **desk (机)**. Below
that width every screen renders exactly what it rendered before the desk
existed.

- **One line.** `hooks/useDesk.js`'s `DESK_QUERY` is `(min-width: 1100px)`,
  the width where the dictionary's dock and the analyzer's rail already split,
  so the three splits are one. It is a width test alone, with no pointer
  test. A phone never reaches it and a tablet held upright never does. A
  large tablet held sideways does, and a rail with captioned gates suits a
  thumb as well as a pointer. A window narrowed below 1100 gets the phone's
  chrome back.
- **The rail.** The Shell draws `components/chrome/DeskRail.jsx` instead of
  the HUD and the tab bar. It is one sumi column down the left edge:
  - 辻 at its head;
  - the five gates, each captioned, with Today first;
  - the lit gate's stations hung on a drawn line;
  - the HUD's three instruments at its foot.

  It carries no line pigment, because the rail is chrome.
- **The screens.** Only where the width earns it:
  - the plates go two by two;
  - Today and the profile go into two columns;
  - Settings sets the list beside the open page;
  - a sheet is a centred dialog;
  - a run prints its keys.

  A run still leaves the chrome.

The promise that the phone never breaks is carried by structure, not by care:

1. **JavaScript decides the DOM.** The desk is drawn only when `useDesk()`
   says so. It is not a hidden copy kept in the page for a media query to
   uncover. Below the line there is no rail, no `.phone--desk`, no key cap:
   nothing for a phone to pay for or a screen reader to find.
2. **The swap is slot by slot.** The Shell's children keep their indices:
   the HUD's slot holds the rail, the tab bar's holds nothing, and the
   screen's container is the same element throughout. A window dragged
   across 1100 changes the chrome and keeps the screen and its state
   (`Shell.desk.browser.test.jsx`).
3. **The stylesheet has one door.** Every desk rule is in one media block,
   the last section of `index.css`, under names written nowhere else
   (`.desk-*`, `.phone--desk`). `src/desk.css.test.js` fails if:
   - the section is not the file's tail;
   - a statement in it is under any query other than `DESK_QUERY`;
   - a desk name appears outside it;
   - it uses `!important`;
   - the width is written anywhere in the JavaScript but `useDesk.js`.
4. **The phone's tests do not move.** No existing phone, tablet or touch
   case was edited. The phone lane gains "draws no desk". The desk has two
   lanes of its own: `desktop` at 1100×800, the tightest, and `wide` at
   1440×900.

## Consequences

- There are two chromes to keep in step. What keeps them from drifting the
  way the pre-068 desktop did is that they share every part but the frame:
  - the rail's gates and stations are `config/tabs.js`'s registry;
  - its instruments are the HUD's own components (`HudInstruments`), so the
    guide's anchors and the fare's animation are the same objects;
  - the screens are the same screens.

  A section added to the registry is on both. A new screen needs no desk
  work unless the width earns it.
- DESIGN.md's rules about a fixed row become the phone's:
  - "only the lit gate is captioned";
  - the sideways flick between gates.

  The rail captions every gate, and it has no flick: it is a column in its
  own order, so there is no row to walk.
- The profile and Settings render different trees on each side of the line.
  Crossing 1100 remounts those screens' blocks, so an unsaved username edit
  is lost on a resize. This is accepted: nothing is lost on a phone or a
  desk that stays what it is.
- `--desk-rail-w` (256px) is declared in the main `:root`, because
  `design-system.browser.test` resolves every `:root` token at the 414px
  lane. It is the one new value, and nothing below 1100 reads it.
- Plan 114 (wave 25) laid more of the screens out for the width under the
  same four guarantees — a second column beside a gate, a station, the
  statistics, a run and a deck; the way up in place of the pill — and
  added two values beside the rail's, `--desk-board-w` (1240px, the
  canvas) and `--desk-side-w` (360px, a second column: a phone's content
  width, so what is set in it is drawn at the width it was designed at).
  Its phone side is `src/deskfree.phone.test.jsx`. DESIGN.md, "The desk",
  lists what it changed.
- Plan 115 (wave 26) took the desk's remaining second screens and sheets
  into the page under the same guarantees — a door opens in the column it
  was pressed in, the stations' second screens fold into their splits, the
  mock exam and comprehension are sat beside their text, a run fits a
  laptop's window, and a session needs no pointer — and added no value to
  `:root`. It also fixed five bugs the audit found on the phone too
  (a cloze blank never lit, Back re-sitting a finished paper, run keys
  firing under a dialog, leaving a run pushing history, out-of-order
  dictionary pages), each in its own commit with its own phone test: the
  only differences below 1100 the branch-against-base identity pass
  allows. Its phone side is further blocks of `src/deskfree.phone.test.jsx`.
- Plan 120 went through every dialog the desk still opened and moved the
  ones that do not interrupt into their page's column (a deck's More, a
  gate lesson's rival, the grab's walkthrough, a kanji's readings, the iOS
  install steps), under the same guarantees and with no value added to
  `:root`. The ones kept, and why, are listed in
  `docs/design/desk/README.md`, "Dialogs on the desk".
- Plans 122 and 123 (wave 27) drew first contact for the desk and made
  the workspace answer a keyboard and a pointer one way everywhere, under
  the same guarantees. First contact is a run's frame with no rail: the
  sign-in beside Board on the Welcome, the journey being built beside the
  boarding's questions, the card's entry beside the first ride. The
  workspace work covered:
  - Esc's owner: the innermost door that holds it (`stores/escHold.js`);
  - the list, grid and radio walks (`hooks/useListWalk.js`,
    `useGridWalk.js`, `useRadioWalk.js`);
  - places as links, doors that own their focus, and kept dialogs drawn
    for a desk;
  - a run's foot following its content;
  - on a wide window, the run's workspace centred by
    `--desk-run-inset`. That value is declared inside the 机 block on
    `:root:has(.desk-run)`, not in the main `:root`, so the 414px lane's
    token check never meets it.

  Ten bugs the audit found on the phone too were fixed, each in its own
  commit with its own phone test. They are the only differences below
  1100 that the branch-against-base identity pass allows:
  - a skip key reaching the card under a cutscene;
  - an input method's Enter submitting;
  - run keys taking browser chords;
  - the dictionary's and the analyser's keys acting under a dialog;
  - the ＋'s outcome carried to the next entry;
  - Esc on the offer closing the sheet under it;
  - a new deck hidden by the shelf's filter;
  - Browse's rows out of the keyboard's reach;
  - the analyser's result ring;
  - Back leaving the boarding.

  An eleventh, Building's line-up running off a phone in French, was
  wrapped. The phone's visible design otherwise stayed as it was, by the
  owner's decision: a phone change the audit proposed is recorded for the
  owner instead (`docs/design/desk/README.md`, "Left for the owner"). The
  phone side is further blocks of `src/deskfree.phone.test.jsx`, and
  `frontdoor.phone`, `ride.phone` and `practiceKeys.phone`.
