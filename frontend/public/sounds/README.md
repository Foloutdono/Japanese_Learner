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
| `kanas/` | `kana` | `playKana(kanaSound(card))` → `/sounds/kanas/<sound>.mp3?v=<KANA_REV>` |

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
*voices*, of which one is chosen. The recipes are
`src/lib/audio/recipes.js`; `voices.js` holds the choice and plays it.
Run the app and open **`/dev/sounds`** to hear them side by side and
pick; the choice is stored in localStorage and the whole app uses it
immediately. "Copy my picks" gives you the block to paste back into
`recipes.js` if a choice should become the shipped default. The first
voice listed for an event is that default today.

The same palette plays outside the app, on a phone, as **the listening
panel**: `scripts/sound-panel.mjs` writes it as one HTML page from the
shipped recipes, with a switch that plays everything through a model of
a phone's speaker, the meter's figures beside each voice, and the
moments where sounds meet (a rating, a stage climbed, boarding) played
together at the app's timings. Published as an Artifact with the `db`
capability it keeps the picks, one document per event in `picks`.

| Event | Where | Voices |
|---|---|---|
| `click` | the generic press | Tick · Wood block · Key tap · Soft pad · Wood tap |
| `toggle` | settings switches, the theme flip | Two step · Latch · Settle · Wood pair |
| `click-menu` / `click-close-menu` | a menu opening, and its mirror | Open/close step · Drawer · Soft |
| `click-mode-selection` | mode, level, theme, tier, filter rows | Pick · Ticket stamp · Two tap · Wood pick |
| `click-screen-selection` | anything that navigates | Departure · Small gate · Turnstile · Departure on bars |
| `correct` | the rating bar | Octave · Rising fifth · Bell · Vibraphone · Marimba fifth · Glass bar |
| `wrong` | the rating bar | Low double · Thud · Slump · Low double, voiced · Wood knock |
| `card-flip` | a flashcard turned over, and back | Click (as now) · Card turn · Karuta · Soft bar |
| `exam-warning` | the mock exam at five minutes left, and one | Silent (as now) · Hall bell · Attention chime |
| `card-transition` | between every card | Paper slip · Flick · Whisk away · Single flap |
| `gate-chime` | 改札, a valid pass | Rising pair · Two pips · Three step · Rising pair, in the hall |
| `door-chime` | 扉, just before the doors part | Falling pair · Single bell · Three fall · Ding-dong · Falling pair, struck |
| `door-slide` | the leaves actually running open | Pneumatic · Soft rush · On rollers |
| `platform-chime` | 到着ホーム, the onboarding arrival | Arpeggio · Open fifth · Wide rise · Arpeggio, struck · Announcement chime |
| `arrival` | 到着, a session finished (Today's run too) | Settle · Long settle · Warm pad · Settle, struck · End of announcement |
| `fare-tick` | XP earned, no level | Coin · One flap · Soft tick |
| `pass-clip` | 改札鋏, the level clipped on the pass | Punch · Snip · Gate press · Punch, voiced · Clip-clip |
| `card-stamp` | 押印, a card climbing a stage | Ticket stamp · Soft press · Stamp, voiced · Hanko |

`card-flip` and `exam-warning` are moments that had no sound of their
own: the flip played the generic click, the exam's last minutes nothing.
Each event's first voice is what it played before, so adding the event
changed nothing until another voice is chosen.

### The meter

`scripts/measure-voices.mjs` renders every voice in Chromium's
OfflineAudioContext, through the same output node and trim the app
plays it through, and prints its peak, its loudness, its loudness
through a phone speaker, how far it sits from its event's default, and
the `level` that would put it there. Run it after writing or changing a
voice (the Chromium the environment ships: `CHROMIUM_PATH=...`).

**Every voice is written at its event's loudness.** A voice picked from
the palette inherits its event's trim, so it was only ever as loud as
the default if its author happened to type the same level -- and most
had not: the wood block sat 17.6dB under the tick it was offered in
place of, the latch 24.8dB under the two step, the soft tick 12.9dB
under the coin. Heard side by side, each lost for being quieter, not
for being worse. Each variant now carries the `level` the meter
measured, and every one lands within half a decibel of its default.

### Heard in a hand

A phone's speaker plays almost nothing under 400Hz, and the levels
below were measured at the bus, as if every learner wore headphones.
Through a model of a phone speaker (fourth order under 400Hz) the
meter found:

| Sound | Lost on a phone |
|---|---|
| `wrong`, Low double (shipping) | 20dB -- under `correct` by as much |
| `card-stamp`, Ticket stamp (shipping) | 22dB |
| `pass-clip`, Punch (shipping) | 12dB |
| `door-slide`, Pneumatic (shipping) | 7dB |
| everything built on 700Hz and up | under 2dB |

On the device most learners hold, the wrong answer was nearly silent
while the right one was full, and a card's stamp and the level-up were
clicks. The `voiced` variants keep each sound's low note for
headphones and add its 2nd to 4th harmonics, from which the ear
rebuilds the note a phone cannot play: the wrong answer loses 7dB
instead of 20, the stamp 5 instead of 22, the punch 5 instead of 12.

### The hall

A station chime is never heard dry. `synth.js` builds a short
concourse (RT60 1.3s, highs dying first) from the same seeded noise as
everything else, and a voice that asks for it (`space`, a send level)
rings in it. Only the station's chimes do; the chrome stays dry, since
a tail on a sound fired dozens of times a screen would smear one tap
into the next. `bar()` strikes the chimes on bars -- a vibraphone's
metal, a marimba's wood, a glockenspiel's glass -- instead of the pure
sines that made them sound like test tones.

### Levels

Every effect is levelled by one table, `BASE_GAIN` in
`src/lib/audio/settings.js`, applied as a gain node the recipe plays
into. Recipes set a sound's *shape*; that table sets how loud the
shape lands. Retuning the mix is one column of numbers, and a variant
picked from the palette inherits its event's level rather than
arriving at whatever loudness its author typed.

The numbers are measured, not guessed: the loudest 42ms window of RMS
at the bus, which is roughly what the ear integrates. Peak alone lies
about short sounds -- a 30ms tick and a 1s melody at the same peak are
nowhere near equally loud.

**It is a hierarchy, not a flat normalisation.** What sets a level is
how often the sound fires. Flattening them would make the chrome nag
and the ceremony fall flat.

| Loudness | Sounds |
|---|---|
| 0.025 | the card turning -- ambient texture, under even the click |
| 0.030 | the chrome: click, toggle, menus, option picks, the card's flip |
| 0.042 | correct / wrong |
| 0.044 | the fare tick |
| 0.045 | a screen change |
| 0.047 | the level-up (the pass's punch, levelled by peak) |
| 0.060 | doors running open, the exam's warning |
| 0.070 | the gate |
| 0.075 | the door chime |
| 0.080 | arriving |
| 0.100 | the platform sign |

Two sounds were previously wrong by more than a little. The **gate
chime** fired on every departure at nearly three times the click and
is down 38%. The **level-up board** was a *third* of a single fare
tick -- the smaller event was louder than the bigger one -- and now
sits above it.

Trims may lift as well as cut. For a recording, gain above 1 is
suspicious; for a synthesised sound there is no reference level, since
a recipe's output is an accident of how many oscillators it stacks and
how hard its filter bites. The ceiling is 4; nothing asks for more
than 3.6, and no shipped sound peaks above 0.47.

### Noise is seeded, not random

`synth.js` generates its noise from a fixed seed rather than
`Math.random()`. This is not fussiness -- it is what makes the levels
above mean anything.

Random noise made every noise-based sound a different loudness in
every session: repeatable within one page load, so it hides from any
single measurement, and drifting far enough between loads that the
same fare-tick trim measured anywhere from 0.025 to 0.067. Normalising
each buffer's peak was not enough on its own, because a tick at Q 14
passes a narrow slice of the spectrum and what survives depends on how
much energy that particular sequence held at 3.2kHz.

So the noise is not random, only irregular. It sounds exactly like
noise because it is noise -- it is simply always the same noise, for
every listener, on every machine.

### The rules the voices keep

These are design constraints, not implementation details, and a new
voice has to keep them:

- **The gate rises, the door falls.** 改札 means "accepted, go"; a door
  chime means "arrived, board". Every variant of both keeps its
  direction. If you generate them separately, generate them as a pair.
- **`wrong` is not a buzzer.** A buzzer is what a gate does when it
  *rejects* you, and getting a card wrong in a study app is not that —
  it is the next card. Low, dull, over quickly -- and heard: low is a
  pitch, not a frequency a phone cannot play (see "Heard in a hand").
- **`correct` sits below the fare tick.** The old `sfx/success.mp3` was
  loud enough to mask the XP landing a beat later; a sound that drowns
  the reward it announces is working against the thing it exists for.
- **The fare and the punch are mechanical, not tonal.** `fare-tick`
  and `pass-clip` are resonant filtered noise, never a melody. A tune
  there would both misdescribe the thing on screen and collide with
  the chimes, which are tones and mean something else. (Punch, voiced
  lets a steel jaw ring for a tenth of a second under the snip; that is
  the metal, not a note.)
- **A voice of an event is as loud as its default.** Write it, run the
  meter, give it the `level` the meter names.
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

Not everything present is played. Nothing asks for `ambiant/home`
(1.7MB; only `selection` loops, from `SelectionScreen`), and of the
announcements `dictionary` and `analyzer` are named in `config/tabs.js`
but no screen calls them, while `stats` and `dictation` are named
nowhere. They cost nothing at run time -- a file is fetched only when
asked for -- but they are candidates for either a caller or the bin.

---

## Format notes

**Provenance.** The announcement clips are synthesized with VOICEVOX
(春日部つむぎ/Kasukabe Tsumugi voice), not recorded. The kana clips are cut
from 波音リツ's UTAU bank, and `kanas/sources.json` names the voice of
each. Before adding or replacing any of them, see `THIRD_PARTY_NOTICES.md`
at the repo root for the required credits and license terms. VOICEVOX's
terms forbid using its audio for machine learning.

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

## かな — the syllable clips

127 files under `kanas/`, one per SOUND the kana deck teaches: every
kana, yōon, long vowel and 外来音 (ファ ティ ヴ…). `kanas/sources.json`
says which voice made each one, as its row id in
`src/domain/attributions.js`.

Every clip is `namine-ritsu`: a real voice, cut from 波音リツ's UTAU
bank 強連続音 Ver1.5.1, its A3 folder (by カノン, plan 121c,
`docs/adr/0020`). The owner chose it by ear from eleven trial reels
across four of his banks. His terms ask for no credit, report or
permission; the app credits him anyway. The set before it was generated
by the voice engine (VOICEVOX Nemo, plan 121), which the owner judged
correct but flat. The engine can still make a set, as a fallback.

To remake the set, download
https://www.canon-voice.com/voice/r73_strong_ren0151.zip and unzip it
under `backend/datas/kana_source/ritsu/strong/`, which is gitignored.
The zip's names are Shift_JIS, which `LC_ALL=C.UTF-8 unzip -O cp932`
decodes. Then:

    cd backend
    python -m scripts.build_kana_audio --check     # missing, stray, off-spec, unsourced
    python -m scripts.build_kana_audio --from-bank datas/kana_source/ritsu/strong \
        --pitch A3 --credit namine-ritsu --force   # the set as it is
    python -m scripts.build_kana_audio --force     # the engine's set instead

`backend/scripts/kana_bank.py` reads a single-syllable bank or a joined
one, like his. In a joined bank, every syllable is taken from where a
recorded string opens on it, and cut before the next sound. Its onset is
found by walking back from the vowel, so the room noise before a string
is never taken as the syllable. Its recipes:

- **Long vowels.** A long vowel is the bank's long tone (あー) where it
  has one. Otherwise it is the vowel's attack joined into the longest
  note he held on that vowel. The join is in phase and at one level.
  Repeating the vowel's steady end is the last resort, because it is
  heard as the vowel said twice.
- **あい and おい** are his own move from one vowel into the other,
  entered from the first vowel's attack. Two samples are butted together
  only where no string makes the move.
- **を** is お.
- **The ヴ row** is his own ヴ. It falls back to the バ row only for a bank
  with no ゔ, and the run says so.

`backend/tests/test_kana_audio.py` holds the folder to the deck:

- every kana has its clip, and no clip is orphaned;
- every file is one the generator made;
- every voice `sources.json` names has its row on the Credits page and its
  section in `THIRD_PARTY_NOTICES.md`. VOICEVOX Nemo's terms make the
  credit a condition. His do not, and the app gives it as provenance. The
  test asks it of every voice, so a set cut from a new one cannot land
  without it.

**A clip is named by sound, not by spelling.**
`content/kana_data.sound_of(entry)` is the romaji, which already files
the twins together (あ/ア, を/ヲ, じ/ぢ...). ウォ is the one exception: its
romaji is を's "wo", but を is said "o" and ウォ "wo", so it has a
`sound` of its own (`wo_foreign`). Cards carry `sound` and the callers
play `kanaSound(card)`.

**What one clip is.** 48 kHz mono, a constant 96 kbps, trimmed to the
syllable with 20 ms of air either side and 5 ms fades, loudness at
`playback.js`'s `TARGET_RMS` with the peak kept at −3 dBFS or below.
A bank cut keeps 0.4 s of the syllable (less if the next sound in its
string comes sooner), or 0.7 s for a long vowel, before the air is added.
His clips come out 0.42–0.47 s, 0.74–0.77 s for a long vowel, and
0.62–0.65 s for あい and おい. An engine clip was 0.26–0.45 s. The
playback correction in `playKana` stays: a file already on target gets
gain ≈ 1 and offset ≈ 0.

**Why synthesis worked, when it was once rejected** (the engine's set,
plan 121). Read as TEXT, a lone mora gives a speech engine nothing to go
on: it reads は as the particle "wa" and a single kana as something like
its letter name. The generator never hands the engine text. It hands it
the kana NOTATION (`ハ'`, `キャ'`), which names the syllable itself and
where the pitch falls, and holds the vowel a little so a syllable on its
own is not clipped. Two spellings are said as the lesson teaches them
rather than letter by letter: えい as ē and おう as ō.

**A remade set is a new `KANA_REV`** in `src/lib/audio/playback.js`.
The service worker keeps `/sounds/` cache-first for a year, and the
revision on the URL is the only way a returning learner hears the new
set.

The set this replaced was 102 recordings of undocumented provenance.
They spread 25.2 dB in loudness, and 40 of them clipped at or above
0 dBFS. 24 of the deck's sounds had no file at all, and ウォ played を's.
