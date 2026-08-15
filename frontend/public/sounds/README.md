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

## Wanted — the station's own sounds

`src/lib/audio/chimes.js` synthesises all five today, and that is
deliberately a placeholder. Each looks for its file first and only
falls back to generating it — drop the file in and it is used
automatically, with no code change.

The two chimes are written as mirror images and should stay that way:
the gate **rises** ("accepted, go"), the door **falls** ("arrived,
board"). If you generate them separately, generate them as a pair.

| File | Notes |
|---|---|
| `ui/gate-chime.mp3` | 改札, the instant the pass touches the reader (`TicketGate`, 420ms in). ~150–250ms. Fires on **every departure**, so err quiet and bright. A rising two-tone reads as "accepted"; anything buzzer-like reads as *rejected*. Synthesised now as B6 → E7. |
| `ui/door-chime.mp3` | ピンポーン, just before the train doors part (`TrainDoor`, 170ms in). ~400–600ms — heard standing still rather than mid-stride, so softer and rounder than the gate's. Synthesised now as E6 → B5. |
| `ui/fare-tick.mp3` | XP earned, no level (`XpToast`, fare tier). The most frequent sound in the app after the click — fires on nearly every review, so it has to be **very** short and quiet: ~80–140ms, one soft blip. It must not be confusable with the gate chime, which already means "your pass was read". Synthesised now as a single D6. |
| `ui/flap-clatter.mp3` | 進級, the board turning your level over (`XpToast`, level tier). ~250–350ms. **Not a tone** — a split-flap drum is plastic hitting a stop, so this wants a run of short mechanical ticks that bunch up as the drum settles. Synthesised now as eight bandpassed noise bursts falling from 2.6kHz. |
| `ui/station-melody.mp3` | 発車メロディ, the pass re-issued (`XpToast`, rank tier). This one fires **four times in the whole progression**, so it is the only sound here that can afford ~1.5s and a real tune. A short pentatonic figure that rises and settles. Synthesised now as D5-E5-A5-B5-G5 in the yo scale. |

Optional, only if either cutscene wants more body:

| File | Notes |
|---|---|
| `sfx/gate-open.mp3` | The gate flaps retracting — a short mechanical shhk, ~200ms, landing at 500ms. |
| `sfx/door-slide.mp3` | The train doors running open — a longer pneumatic slide, ~700ms, landing at 350ms and running under the whole opening. Most likely of these to be worth it: the doors currently move in silence for three quarters of a second. |

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
