# 0019 — Speech is synthesized by a self-hosted VOICEVOX Nemo engine

- **Status**: accepted. Replaces the engine named by
  [0006](0006-browser-speech-for-study-audio.md) and
  [0009](0009-card-readings-fall-back-to-server-audio.md); their decisions
  (device first, a server clip as the fallback, catalog-only text) stand,
  except that a lone kana now skips the device (below).
- **Amended**: 2026-09-23, plan 121b. The owner chose the voices, and B
  speaks more slowly ("The voices", below). The kana deck is to move to a
  recorded voice: [0020](0020-the-kana-are-a-recorded-voice.md).
- **Date**: 2026-09-23
- **Plan**: 121

## Context

Every voice the server made came from **edge-tts**, a client for Microsoft
Edge's consumer "Read Aloud" endpoint. That covered the exam listening
dialogues, the dictation bank and the `/api/tts` card readings.

- **No licence.** It was free and needed no account, but nothing licenses it
  for server-side use in a product that is sold. Asked whether those voices
  may be used commercially, Microsoft's answer is to use Azure. Its
  `Sec-MS-GEC` token also rotates with Edge releases and has broken the client
  more than once.
- **Two voices.** Only Keita and Nanami were exposed. The exam's "three
  distinct voices" were really two, and assigned by order of appearance, so a
  script without a narrator line gave speaker A the narrator's voice.
- **Uncredited.** Nothing in the app said where the voices came from.

The kana deck had the other half of the problem:

- **Recordings of unknown origin.** It played 102 recordings of undocumented
  provenance, 40 of them clipping.
- **Missing sounds.** 24 of its 126 sounds had no file: the long vowels, and
  ファ, ティ, ヴ and the like.
- **One wrong sound.** ウォ played を's clip.
- **Synthesis had been ruled out.** `frontend/public/sounds/README.md` had
  rejected speech synthesis for kana, because a lone mora "reads as a letter
  name".
- **The same bug outside the deck.** The dictionary's kana entries and the
  single-mora kanji readings were spoken by synthesis anyway, through the
  device or `/api/tts`. Read as text, a lone は is the topic particle "wa", and
  へ is "e".

## Decision

### The engine

- **What it is.** The stock `voicevox/voicevox_nemo_engine` image (0.23.0,
  pinned by digest), run unmodified.
- **Where it runs.** A Render private service beside the backend (`render.yaml`,
  `voicevox-nemo`). It is reachable only over the private network, because the
  engine has no auth of its own. `VV_DISABLE_MUTABLE_API=1` freezes its user
  dictionary and settings endpoints.
- **The client.** `backend/study/voice_engine.py` is the only code that talks to
  it: an HTTP client with timeouts, bounded concurrency and retries on
  connection errors. Every failure becomes `TTSFailed`, which callers already
  handle by skipping the item, dropping the line or answering 503.

### The licence

VOICEVOX Nemo's terms (https://voicevox.hiroshiba.jp/nemo/term/, and the
licence text the image prints at start-up):

- **Commercial use** of the audio is allowed on one condition: the credit
  **"VOICEVOX Nemo"**. It is on the Credits page
  (`frontend/src/domain/attributions.js`) and in `THIRD_PARTY_NOTICES.md`.
- **Prohibited**, among others: using the audio for **machine learning**,
  damaging the image of VOICEVOX or the voice providers, and misattribution.
- **Reverse engineering** the software is also prohibited.
- **Passing the terms on.** Anyone we license the audio to must be bound by
  clauses 3 and 4 of the engine's grant: they must follow the voice library's
  terms, and pass those same obligations on to anyone they license it to. The
  app does not hand out the audio as a product today. If it ever does (a
  download, an export), its terms must carry these clauses.
- **The engine** is LGPL-3.0 (dual-licensed). It is run as a separate
  unmodified service and not redistributed.

### The voices

Nine voices without a persona, recorded by real voice providers: 女声1–6 and
男声1–3. The website writes 女性/男性; `/speakers` says 女声/男声, and the engine
is what counts. Their resource repository was archived in March 2026, so the
voices are frozen: they won't change, and they won't improve.

Voices are chosen per **slot** (`DEFAULT_VOICES`). The owner chose them after
listening to `scripts/audition_voices.py`'s samples (plan 121b):

| Slot | Role | Voice |
|---|---|---|
| 0 | the reader: words, dictation, lone kana | 女声6 |
| 1 | speaker A, a woman | 女声6 |
| 2 | speaker B, a man | 男声1 |
| 3 | the narrator inside an exam dialogue | 女声1 |

`study/exam_tts.voice_slots` maps labels to slots, never by order of
appearance:

- a script with one speaker is the reader's;
- in a dialogue, `narrator`, `A` and `B` take their slots;
- a label starting 女 or 男 takes A's or B's;
- any other label takes the first free slot.

The listening prompt tells the model that A is 女の人 and B is 男の人. The first,
provisional choice was 女声1, 女声2 and 男声1.

**A voice's pace** is `VOICE_TEMPO`. The owner found 男声1 a little fast, so he
speaks at 0.9 of the others' rate. The tempo multiplies a turn's own rate (so
dictation's −10% still applies), and it follows the voice rather than the slot,
so it holds under `TTS_VOICES` too. `audition_voices --tempo VOICE` renders one
line at four speeds, for choosing the value.

### Kana are named, not read

A text that is exactly one kana goes through the engine's kana notation
(`/accent_phrases?is_kana=true`) instead of text analysis. `ハ'` is the syllable
"ha", and nothing is left to guess. The vowel is held a little
(`LONE_KANA_HOLD_S`) so a syllable on its own doesn't sound clipped.

- **The frontend skips the device for a lone kana** and goes straight to the
  server clip. A device voice can only read text. This amends 0009's "device
  first" for that one case.
- **The kana deck is generated** with the same notation by
  `scripts/build_kana_audio.py`:
  - 127 clips, 48 kHz mono, peak ≤ −3 dBFS, loudness at `playback.js`'s target;
  - named by `content/kana_data.sound_of`, the romaji except for ウォ;
  - えい and おう are said as ē and ō, as the lesson teaches them.

  The generated set is committed and replaces the recordings.
- **The dictionary's kana entries play the deck's own clip.**

### The clip store keeps its names

`content_key` is unchanged, byte for byte, because it is an identity: dictation
clip ids live in `dictation_log`, and exam clip URLs live inside `exam_papers`.
Keys are pinned in `tests/test_exam_tts.py`. A new voice therefore cannot mean
new names. It means a new **voice epoch**:

- the store holds a marker with `VOICE_REV`;
- a clip older than that marker was made by an earlier voice;
- such a clip is remade before it is served, or is a 404 if it cannot be
  remade — never served in the old voice;
- `scripts/revoice_audio.py` remakes everything up front and deletes what
  cannot be remade.

The browser's caches (`/api/tts` is immutable for a year; the service worker
keeps clips 30 days and `/sounds/` a year) are handled by a revision on every
clip URL: `v=VOICE_REV`, and `v=KANA_REV` for the kana set.

## Consequences

- **Selling the app is no longer blocked by its voice.** There are nine voices
  instead of two, and the exam's narrator is finally a third voice.
- **Lone kana are right everywhere**: the deck, the dictionary and kanji
  readings. The deck has every sound it teaches.
- **A fixed monthly cost** where there was none. Measured with three voices
  loaded and one CPU thread, as on Render, the engine peaks at 343 MB with the
  owner's voices (女声6, 男声1, 女声1). The first set (女声1, 女声2, 男声1)
  peaked at 376 MB.
  - **Starter** ($7) holds that at 0.5 CPU, but slowly: about 2 s for a word the
    first time, about 10 s for a 6 s dialogue turn.
  - **Standard** ($25) halves both.
  - Every clip is made once and cached, so the wait is paid once per word or
    line. Starter is the default.
- **When the engine is down:**
  - listening sections are skipped, before any model call is paid for (the
    generator asks `ready()` first);
  - dictation and `/api/tts` answer 503;
  - a stale clip is a 404;
  - study cards still speak through the device where it can, as before.
- **The credit is a condition.** Removing the Credits line would breach the
  terms.
- **No generated clip may be published as, or fed into, a training set.** This
  matters if the repository is public: the committed kana clips carry the same
  terms.
- **Changing voices is a code change**: `DEFAULT_VOICES`, `VOICE_TEMPO` and
  `VOICE_REV` together (plus `KANA_REV` if the kana set is remade), then
  `revoice_audio --yes`. `TTS_VOICES` is for local auditions only. Plan 121b
  did exactly this: `VOICE_REV` went from `nemo1` to `nemo2`.
- **VOICEVOX's "medium quality"** is its own description. It is clear and
  correctly accented, but less natural than the best commercial voices.
  `voice_engine.py` speaks the VOICEVOX engine API, so AivisSpeech and the
  character VOICEVOX library are a configuration change away. A commercial
  engine would be a new client behind the same `say()`.

## Alternatives considered

Prices are as of September 2026. At this app's volume (well under 100,000
characters ever, since every clip is cached for good), every cloud option below
would sit inside its free tier.

| Option | Why not |
|---|---|
| Keep edge-tts | No licence for this use. Microsoft's own answer is Azure. |
| **Azure AI Speech** (the licensed product behind edge-tts) | The same voices, licensed, with 500K characters a month free, then about $16 per million. The runner-up for "change nothing audible". Closed, needs an Azure account, and its free tier is at Microsoft's discretion. |
| **Google Cloud Text-to-Speech** | WaveNet has about 4M characters a month free, then about $4 per million, and its `yomigana` phoneme SSML (with `^`/`!` pitch marks) can force readings and pitch accent. The strongest managed option. Closed, and needs a billing account. |
| Amazon Polly | Japanese neural voices and `x-amazon-yomigana`, but the free tier lasts only the first 12 months, then $16 per million. |
| VOICEVOX character voices | Same engine, but a separate set of terms and a credit for every character, and anime personas as the voice of a language course. Kept for the station announcements (春日部つむぎ), where a persona is the point. |
| AivisSpeech / Style-Bert-VITS2 | The most natural open Japanese, but a BERT model and 2–4 GB of RAM, and the licence varies model by model. The client already speaks its API if that trade changes. |
| MeloTTS-Japanese (MIT), Kokoro-82M (Apache-2.0) | Permissive and light. But MeloTTS has one voice, Kokoro's Japanese voices are its weakest, and neither lets a single kana be named rather than read. |
| Qwen3-TTS, CosyVoice, Chatterbox, Magpie | Open weights, but a GPU, LLM-style misreadings with no reading control, and in Magpie's case Japanese spoken by English voices. |
| Fish Speech / OpenAudio, F5-TTS, XTTS-v2 | The weights are licensed for non-commercial use only. |
| Open JTalk with an HTS voice | Correct and tiny, but robotic. |
| Running the engine inside the backend | The backend lives in 512 MB, and the engine alone peaks near 400. |
| Pre-generating everything, no live engine | Impossible for LLM-written listening scripts and the 212k-entry dictionary pool. |
| Device speech only | 0006 and 0009 already show where it fails: the Android WebView has no speech API, and Android Chrome often has no Japanese voice. It still can't do exams or dictation, and it reads a lone kana as a particle. |
| Re-recording the kana with a voice actor | It fixes the deck and nothing else, and every future sound becomes a new session. |
