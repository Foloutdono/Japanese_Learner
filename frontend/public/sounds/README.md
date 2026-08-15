# Sound assets

Everything here is loaded by `src/lib/audio/`, decoded once, cached,
and routed through a mixer bus so mute and the per-channel volume
sliders reach it — including while it is already playing.

A missing file is **silence, not an error**: `play()` swallows the
failure deliberately, so the app never breaks over an absent sound. The
cost is that a missing file is also invisible. Hence this list.

## Layout

| Folder | Channel | Loaded by |
|---|---|---|
| `ui/` | `ui` | `playUi(name)` → `/sounds/ui/<name>.mp3` |
| `sfx/` | `sfx` | `playSfx(name)` → `/sounds/sfx/<name>.mp3` |
| `announcements/` | `announcement` | `playAnnouncement(path)` → `/sounds/announcements/<path>.wav` |
| `announcements/jingle.mp3` | `jingle` | played before every announcement |
| `ambiant/` | `ambiance` | `startAmbiance(name)`, looped |
| `kanas/` | `kana` | `playKana(romaji)` |

Channel names come from `SOUND_CATEGORIES` in `src/lib/audio/settings.js`
and each has its own volume slider on the Settings screen.

---

## Missing — referenced by code, no file on disk

These two are the priority, because they are not hypothetical: the code
calls them today, gets nothing, and re-requests them every time
(`getBuffer` deliberately evicts failed fetches so a dropped request can
retry, which for a permanently absent file means a 404 per call).

| File | Called by | Used at | Notes |
|---|---|---|---|
| `ui/click.mp3` | `playClick()` | **31 call sites** | The app's generic button click. Every back button, every rating press, the quick-change drawer, the daruma hall. Currently the single most-used sound in the app and it does not exist. |
| `ui/toggle.mp3` | `playToggle()` | 2 call sites | On/off switches in Settings. Should read as a state change, not a press — a touch drier and shorter than the click. |

Keep both **very** short (40–90ms) and quiet. A click that is even
slightly too long or too present becomes exhausting at 31 call sites.

---

## Wanted — for the ticket gate

`src/lib/audio/gate.js` synthesises this today: two sine blips, B6 then
E7, ~55ms and ~75ms. That is deliberately a placeholder. Drop a real
file in and it is picked up automatically — no code change, the
synthesiser is only the fallback.

| File | Notes |
|---|---|
| `ui/gate-chime.mp3` | The 改札 acknowledgement, played the instant the pass touches the reader (`TicketGate`, at 300ms). Target ~150–250ms total. It fires on **every departure**, so err quiet and bright rather than long and full — this is the one asset where restraint matters most. A rising two-tone reads as "accepted"; a flat single beep gets tiring, and anything buzzer-like reads as *rejected*. |

Optional, only if the gate ever wants more body:

| File | Notes |
|---|---|
| `sfx/gate-open.mp3` | The flaps retracting — a short mechanical shhk, ~200ms, landing at 360ms. Currently silent, and honestly fine that way; add it only if the gate feels thin with the chime alone. |

---

## Present

`ui/click-menu`, `click-close-menu`, `click-mode-selection`,
`click-screen-selection` · `sfx/success`, `failure`, `level-up`,
`card-transition` · `ambiant/home`, `selection` ·
`announcements/` for all eleven sections plus `jingle` · `kanas/`.

---

## Format notes

**mp3 for everything new.** The eleven announcements are `.wav` and
uncompressed — `kanji.wav` alone is 118KB for two seconds. Converting
those to mp3 would save more bandwidth than the entire ticket gate
feature costs, and nothing but the extension needs to change
(`ANNOUNCEMENT()` in `playback.js`).

Mono is fine for everything except the ambiance loops. Normalise to
around −16 LUFS: the mixer applies its own gain per channel, so
material that arrives already loud only removes headroom from the
sliders.
