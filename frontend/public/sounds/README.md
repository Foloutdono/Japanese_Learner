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

## All synthesised

Nothing in `ui/` or `sfx/` is a file any more, and no file is missing:
every interface and effect sound is generated at the moment it plays,
by `src/lib/audio/voices.js` on the primitives in `synth.js`.

That started as a fallback for `ui/click.mp3`, which was referenced
from **31 call sites** and had never existed — so all 31 were silent
*and* fired a 404 apiece. It is now the whole system, for three
reasons that turned out to matter more than fidelity:

- **The files were not saying different things.** `click-menu`,
  `click-close-menu`, `click-mode-selection` and
  `click-screen-selection` were four names for one byte-identical
  49KB file. Four distinct interactions made one sound.
- **They cost 350KB** to say it, and needed a fetch and a decode
  before the first tap could be heard. A handful of oscillator nodes
  costs nothing and is ready immediately.
- **A generated sound can have alternatives.** Which is the point of
  the palette below.

### The palette

Each sound is an *event* — the moment it belongs to — carrying several
*voices*, of which one is chosen. Run the app and open **`/dev/sounds`**
to hear them side by side and pick; the choice is stored in
localStorage and the whole app uses it immediately. "Copy my picks"
gives you the block to paste back into `voices.js` if a choice should
become the shipped default. The first voice listed for an event is
that default today.

| Event | Where | Voices |
|---|---|---|
| `click` | the generic press, 31 sites | Tick · Wood block · Key tap · Soft pad |
| `toggle` | settings switches, the theme flip | Two step · Latch · Settle |
| `click-menu` / `click-close-menu` | a menu opening, and its mirror | Open/close step · Drawer · Soft |
| `click-mode-selection` | mode, level, theme, tier, filter rows | Pick · Ticket stamp · Two tap |
| `click-screen-selection` | anything that navigates | Departure · Small gate · Turnstile |
| `correct` / `wrong` | the rating bar | Octave · Rising fifth · Bell / Low double · Thud · Slump |
| `card-transition` | between every card | Paper slip · Flick · Whisk away · Single flap |
| `gate-chime` | 改札, a valid pass | Rising pair · Two pips · Three step |
| `door-chime` | 扉, just before the doors part | Falling pair · Single bell · Three fall |
| `door-slide` | the leaves actually running open | Pneumatic · Soft rush · On rollers |
| `platform-chime` | 到着ホーム, the onboarding arrival | Arpeggio · Open fifth · Wide rise |
| `arrival` | 到着, a session finished | Settle · Long settle · Warm pad |
| `station-melody` | 発車メロディ, the pass re-issued | Yo scale rising · Yo scale falling · Two bars |
| `fare-tick` | XP earned, no level | Coin · One flap · Soft tick |
| `flap-clatter` | 進級, the board turning your level over | Full run · Short run · Heavy board |
| `level-up` | a cosmetic unlocked, a daruma eye filled | Ascent · Board then bell · Fanfare · Bloom |

### The rules the voices keep

These are design constraints, not implementation details, and a new
voice has to keep them:

- **The gate rises, the door falls.** 改札 means "accepted, go"; a door
  chime means "arrived, board". Every variant of both keeps its
  direction. If you generate them separately, generate them as a pair.
- **`wrong` is not a buzzer.** A buzzer is what a gate does when it
  *rejects* you, and getting a card wrong in a study app is not that —
  it is the next card. Low, dull, over quickly.
- **`correct` sits below the fare tick.** The old `sfx/success.mp3` was
  loud enough to mask the XP landing a beat later; a sound that drowns
  the reward it announces is working against the thing it exists for.
- **The board is mechanical, not tonal.** `fare-tick` and
  `flap-clatter` are both resonant filtered noise, never oscillators.
  A tone there would both misdescribe the thing on screen and collide
  with the chimes, which are tones and mean something else. The two no
  longer describe the *same* object -- the shipped fare tick is a coin
  into the fare box, the level clatter is the board turning -- which
  is a deliberate choice; `one-flap` is the variant that reunites them
  as one machine at two sizes.
- **Frequent means quiet and short.** The click and the option pick
  fire dozens of times a screen. At those frequencies the gap between
  "present" and "irritating" is about thirty milliseconds and six
  decibels.

### Dropping in a recording

Still supported, and it takes two steps rather than one: add
`/sounds/<channel>/<name>.mp3`, and add `file: '/sounds/...'` to that
event in `voices.js`. From then on the event loads the recording and
its synthesised variants stop being reachable.

The second step is not ceremony. **Probing for a file that is not
there does not 404 — it succeeds.** Vite in dev and `vercel.json` in
production both rewrite every unmatched path to `index.html`, so a
missing sound came back `200` with a page of HTML in it, which then
failed to decode and fell through to the synthesiser. Correct, but one
wasted round trip per event, forever, for a file nobody had added. No
event declares a file today, so nothing is fetched at all.

A recording beats a synthesised sound on fidelity every time. It does
not beat it on being changeable, which is why the default is the
generated one.

---

## Present

`ambiant/home`, `selection` · `announcements/` for all eleven sections
plus `jingle` · `kanas/`. Nothing else — `ui/` and `sfx/` are empty by
design.

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

---

## かな — the syllable recordings

102 files under `kanas/`. Measured across the whole set by decoding
every one of them:

| | |
|---|---|
| loudness spread | **25.2 dB** between quietest and loudest |
| leading silence | up to **294ms** on 47 files (median 38ms) |
| clipping | **40 files** at or above 0dBFS, one at 1.03 |
| format | 48kHz, mixed mono and stereo, 0.29–1.57s |

Two of those three are corrected at playback and need no new audio:
`playKana` analyses each buffer once on decode and plays it from where
the speech actually starts, with a gain pulling it toward a common
loudness. Measured result: **spread 25.2 dB → 0.9 dB**, and the lag
before a syllable sounds is now a fixed 12ms pre-roll instead of up to
294ms.

**The clipping cannot be fixed at playback** — the distortion is baked
into the sample — and it is the reason the set still wants
re-recording rather than only re-mixing.

If you do re-record: one voice, one session, 48kHz mono, peak no
higher than −3 dBFS, trimmed to the syllable with ~20ms of air each
side. The playback correction stays useful — a file already on target
gets gain 1 and offset 0, so a good set simply needs less of it.

Speech synthesis was considered and rejected: a lone mora gives a TTS
engine no prosody to work with, and it reads as a letter name rather
than a sound. The correction above plus a clean set is the better
answer.
