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

## All synthesised today

Nothing in this list is a blocker: every sound below is generated in
`src/lib/audio/chimes.js` and works right now. Each one looks for its
file first, so dropping a real recording in replaces the synthesised
version automatically with no code change.

`ui/click.mp3` was the urgent one and is no longer urgent. It is
referenced from **31 call sites** — the back button, the rating bar,
the quiz rows, the storehouse, the daruma hall — and had never
existed, so all 31 were silent *and* fired a 404 apiece (getBuffer
evicts failed fetches so a retry stays possible, which for a
permanently absent file means one request per tap). It now falls back
to a synthesised tick.

| File | Where | Notes |
|---|---|---|
| `ui/click.mp3` | 31 sites | The generic press. Keep it **very** short and quiet — 30–60ms. At this frequency the gap between "present" and "irritating" is about thirty milliseconds. Synthesised now as a single G6. |
| `ui/toggle.mp3` | settings switches | A state change, not a press: two steps, drier and lower than the click. Synthesised now as B5 → E6. |

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
| `ui/fare-tick.mp3` | XP earned, no level (`XpToast`, fare tier). The most frequent sound in the app after the click — fires on nearly every review, so it has to be **very** short and quiet: ~80–140ms. **Not a tone**: the fare tick shows a split-flap board, so this is one drum turning — the same material as the clatter below, one tick instead of eight. A tone here both misdescribed the thing on screen and collided with the gate chime. Synthesised now as a single bandpassed noise tick. |
| `ui/flap-clatter.mp3` | 進級, the board turning your level over (`XpToast`, level tier). ~250–350ms. **Not a tone** — a split-flap drum is plastic hitting a stop, so this wants a run of short mechanical ticks that bunch up as the drum settles. Synthesised now as eight bandpassed noise bursts falling from 2.6kHz. |
| `ui/arrival.mp3` | 到着, a study session finished (`DoneMessage`). ~700–900ms. This is the end of a journey rather than a victory, so it steps **down** and settles — deliberately the inverse of the departure melody below. Synthesised now as G5 → D5. |
| `ui/station-melody.mp3` | 発車メロディ, the pass re-issued (`XpToast`, rank tier). This one fires **four times in the whole progression**, so it is the only sound here that can afford ~1.5s and a real tune. A short pentatonic figure that rises and settles. Synthesised now as D5-E5-A5-B5-G5 in the yo scale. |

Optional:

| File | Notes |
|---|---|
| `sfx/gate-open.mp3` | The gate flaps retracting — a short mechanical shhk, ~200ms, landing at 500ms. Still genuinely silent, unlike the door slide below. |
| `sfx/door-slide.mp3` | The train doors running open (`TrainDoor`, from 350ms). ~600–700ms. Broadband rush rather than any pitch, opening up as the leaves gather speed and closing as they reach the stop, with a soft thump at the end of the travel. **No longer optional or silent** — it is wired and synthesised; a recording would simply be better. |

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
