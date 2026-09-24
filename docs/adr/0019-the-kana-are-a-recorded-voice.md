# 0019 — The kana are a recorded voice

- **Status**: accepted by the owner, and done.
  - **2026-09-24:** changed to 波音リツ, after 小春音アミ was set aside for
    her terms ("Why not 小春音アミ", below).
  - **2026-09-24, done:** the 127 clips are cut from his 強連続音 Ver1.5.1
    bank, its A3 folder, which the owner chose by ear from eleven trial
    reels. The owner's verdict was "good for now": a better kana voice is
    a known follow-up ("Follow-up", below).
- **Amends**: [0018](0018-speech-is-synthesized-by-a-self-hosted-voicevox-nemo-engine.md),
  for the kana deck only. The engine keeps every other voice, and a lone
  kana spoken through `/api/tts`.
- **Date**: 2026-09-23, revised 2026-09-24
- **Plan**: 113b, 113c

## Context

Plan 113 regenerated the kana deck from VOICEVOX Nemo's kana notation.
The set is complete and correct: every sound the deck teaches, は as "ha".
The owner listened and judged it below the standard a course needs. A
synthesized mora is right, and flat. Kana are the first sound a learner
hears in the app, and the one they hear most often.

What was wanted:

- one voice for all 127 sounds, real if possible;
- free or cheap;
- licensable in a paid app, with as few conditions as possible.

## Decision

### The voice

**波音リツ**, by カノン: an UTAU voicebank, a real voice recorded for
singing. His terms ask for nothing (below). The set is cut from his
**強連続音 Ver1.5.1** bank, **A3** folder (220 Hz), which covers every sound
the deck teaches, the ヴ row included.

He publishes six UTAU banks (https://www.canon-voice.com/voicebanks/). All
six were downloaded and read with the importer's own rules:

| Bank | Pitch folders | Result |
|---|---|---|
| 強連続音 Ver1.5.1, his original "strong" bank | A3, F4 | Chosen, at A3 (reel 01). F4 was reel 02. |
| 連続音 Ver1.5.1, "normal, i.e. soft", sung the slowest | 通常, ↓, ↑ | Complete. Reels 03–05. Its room noise exposed the onset fault (below). |
| キレ音源 Ver1.0 | A3, D4, G4, C5 | Complete. Reels 06–07 (A3, D4). |
| 何かがキレ音源 Ver0.1.1, his newest remake of キレ | 12, from A3 to Db5, some with a soft (弱) or strong (強) take | Complete but for ヴ, where the バ row stands in. Reels 08–11 (A3 and Db4, each plain and soft). |
| Eve | A3, Eb4, A4 | Out. Most of its bare vowels run into the next sound in their string after 94–165 ms (A3: あ 96 ms, お 111 ms, え 112 ms), too short for a syllable on its own. |
| 眩 and 麗 | A3, Eb4, A4 each | Out, for the same reason, and worse: お and じゃ get 28–36 ms at some pitches. |

Every reel played the same 27 sounds (あいうえお, かきくけこ, さしつ, はふんを,
きゃ, しょ, が, ぱ, ファ, ティ, ヴ, ああ, えい, あい), cut as the import would cut
them.

The owner picked reel 01 and heard one fault: the two-vowel sounds. ああ and
えい sounded like the vowel said twice, and あい like あ followed by い. Both
recipes were replaced by his own recordings, as the table below describes.
The owner then approved the set.

### How it is made

`scripts/build_kana_audio.py --from-bank DIR --pitch A3 --credit namine-ritsu`
uses `scripts/kana_bank.py`. The script indexes the bank, then cuts every
sound by recipe:

| Sound | From |
|---|---|
| a syllable (か, きゃ, ファ …) | the sample that opens a recorded string (`- か`), cut to 0.4 s from the onset and never past the next sound in the string |
| ああ/アー, いい, うう, ええ/えい (ē), おお/おう (ō) | the bank's long tone where it has one (a single-syllable bank may). Otherwise the vowel's word-initial attack, 0.25 s, is joined into the longest note he held on that vowel, to 0.7 s in all. Repeating the vowel's steady end is the last resort, for a bank with neither, because it is heard as the vowel said twice |
| あい, おい | his own move from one vowel into the other (`a い`, `o い`), from whichever string sings it. It is entered 0.15 s before the second vowel is heard, and joined to the first vowel's word-initial attack. Two samples are butted together only where no string makes the move, because that is heard as あ, then い |
| を | お's sample: を is said "o" (ウォ is うぉ's) |
| じ/ぢ, ず/づ | じ, ず: the deck files them together already |
| ヴ row | his own ゔ samples. The バ row only for a bank without them, and the run reports it |

What 強 A3 gave:

- **Held notes.** His longest note on each vowel runs 978–1518 ms.
  - ああ joins into `n あ`.
  - いい joins into `o い`.
  - うう joins into `n う`.
  - ええ and えい join into `i え`.
  - おお and おう join into `o お`.
- **Moves.**
  - あい is `a い`, 649 ms of い after the move.
  - おい is `o い`, 1056 ms of い after the move.
- **Continuity.** The pitch runs unbroken through every join (ああ 218 → 217
  Hz), and no 10 ms step in level exceeds 2.4 dB.
- **Lengths.**
  - A syllable is 0.42–0.47 s.
  - A long vowel is 0.74–0.77 s.
  - あい and おい are 0.62–0.65 s.

**How a bank is read**

- **Single-syllable banks (単独音).** One syllable a file, named by it or by
  its oto.ini alias. A file the oto.ini does not name is read by its own
  name.
- **Joined banks (連続音, his).** They record strings such as
  `_かかきかくかけかこ.wav`. Their oto.ini names every sound in each one.
  - `- か` opens the string, from silence. `a か` is a か sung after a
    vowel.
  - A syllable on its own is taken only from a `- ` sound, because that is
    what a learner hears.
  - The next sound in the string ends the syllable, at its offset plus its
    preutterance, which is where it is heard.
  - The last sound in a file ends at the oto cutoff, by UTAU's rule: a
    positive cutoff counts from the file's end, a negative one from the
    offset.
  - Every two-token alias is a move (`a い` is い sung straight out of あ),
    from anywhere in the bank. The longest one on each vowel is that
    vowel's held note. A file's last sound is measured with the file's
    length, read from its WAV header.
- **Aliases** are read by `parse_alias`:
  - a pitch (`A3`, `_G4`) is not part of the syllable;
  - a variant (`か↑`, `あR`) loses to the plain sample;
  - ヴ is read as ゔ and ン as ん.
- **Pitch folders.**
  - A bank with one folder per pitch must be given `--pitch`. Without it,
    the best sample of each syllable would sing the set in several keys.
  - The tag names one folder exactly: 何かがキレ keeps A4, A4弱 and A4強 side
    by side, and `--pitch A4` is not A4弱.
  - A tag that matches no folder lists the bank's folders, and a set drawn
    from more than one folder is refused.
- **Onsets** are found from the sound, not the oto offset.
  - **Why.** His 通常 bank opens every `- ` region about 300 ms before the
    syllable, over room noise louder than a soft consonant. Taking the
    first loud sample cut 13–29 syllables a folder from inside that noise,
    and they lost their ends: ゆ kept 140 ms of itself.
  - **How.** The onset is where the vowel arrives on a 20 ms envelope,
    walked back through the sound that runs unbroken into it. The walk
    stops at silence, at a gate 6 dB above the room's noise (the median of
    what precedes the vowel), or 0.35 s before the vowel.
  - **Result.** Across the eleven reel folders, every cut starts within
    100 ms of its voice (a quiet は's breath at 130 ms).
- **Every join is in phase and at one level.**
  - **Phase.** A join slides by up to a pitch period to meet what it
    follows. Blended half a period apart, two sounds at one pitch cancel
    into an audible dip.
  - **Level.** The tail's first 40 ms is matched to the head's last 40 ms,
    by at most 6 dB, because two takes of one vowel are seldom at one level.

The same `finish()` as the engine's clips does the rest, and LAME resamples
the bank's 44.1 kHz. The output spec is unchanged (48 kHz mono, CBR 96 kbps,
peak ≤ −3 dBFS, loudness at `playback.js`'s target), so nothing downstream
changes but `KANA_REV`, now `ritsu1`.

The engine mode stays: `build_kana_audio` without `--from-bank`.

### Provenance and credit

The engine's clips and the bank's carry different terms: different credits,
and different rules on machine learning.

- **Where each clip comes from.** `frontend/public/sounds/kanas/sources.json`
  records which voice made each clip, as its row id in
  `frontend/src/domain/attributions.js`. All 127 are `namine-ritsu`.
- **Every voice is credited.** `tests/test_kana_audio.py` fails if any voice in
  that file lacks its row on the Credits page ("Kana voice", "Voix des
  kana") or its section in `THIRD_PARTY_NOTICES.md`.
  - His terms do not require a credit. The app credits him anyway, as
    provenance.
- **The bank stays out of the repository.** It lives under
  `backend/datas/kana_source/`, which is gitignored; nothing needs it there.

### Remaking the set

1. **Download the bank.** It is
   https://www.canon-voice.com/voice/r73_strong_ren0151.zip. Unzip it under
   `backend/datas/kana_source/ritsu/strong/`. Its names are Shift_JIS,
   which `LC_ALL=C.UTF-8 unzip -O cp932` decodes. The environment must
   allow `www.canon-voice.com`.
2. **Cut the set, then check it:**

   ```bash
   python -m scripts.build_kana_audio --from-bank datas/kana_source/ritsu/strong \
       --pitch A3 --credit namine-ritsu --force
   python -m scripts.build_kana_audio --check
   ```

3. **Bump `KANA_REV`** in `frontend/src/lib/audio/playback.js`.

A trial set for listening goes elsewhere with `--out
datas/kana_source/trial-<bank>-<pitch>`, and leaves the deck alone.

## The terms

These are his terms (https://www.canon-voice.com/terms/). They were read on
the site on 2026-09-24, when the bank was downloaded. They say what the
2026-08-15 snapshot this decision was first made on said.

**The summary.** The page says to read only this, and that it takes
precedence over the terms bundled with an UTAU bank:

- 「商用利用可です。」: commercial use is allowed;
- 「音源の転載、再配布可」: the bank may be reposted and redistributed;
- 「原音を加工しての転載、再配布可」: the processed recordings may be too;
- 「クレジット表記不要」: no credit is required.

**The formal text below it**

- **Article 6-1** grants a free, non-exclusive licence for commercial and
  non-commercial use.
- **Article 8-2.** He may ask for a work he judges inappropriate to be taken
  down, and the app would comply. The summary says the same. The engine's
  set remains a working fallback.
- **Article 6-2 is narrower than the summary.** It is older and reads
  「個人使用の範囲でのデータの加工、改変を行う事は配布をしない限り問題ありません」
  (modification is fine within personal use, so long as it is not
  distributed).
  - The page says to go by the summary.
  - Article 7-1 lets him settle any doubt over interpretation.
  - The page's Q&A answers 「○○してもいいですか？」 with 「いいです。」 (yes).
  - An email to confirm (canon7373@gmail.com, on the page) is optional
    reassurance, not a condition.

**Other points**

- **The bank's own readme.** Its `旧readme.txt` (2011) forbids
  redistributing the bank's files. Its current `readme.txt` points to the
  site's terms, and those take precedence for UTAU banks.
- **Other software.** Use through other software follows that software's
  terms. None applies here: the importer reads his WAVs directly. The
  VOICEVOX credit his page asks for applies to VOICEVOX's 波音リツ voice,
  which is not used.
- **Machine learning.** Nothing in his terms forbids it. VOICEVOX Nemo's
  clips still forbid it, and `sources.json` says which applies to which clip.

### Why not 小春音アミ

Her UTAU single-syllable bank (あみたろの声素材工房) was the first choice. It
is a real voice, complete but for the ヴ row, and the one her author
recommends for reading the 五十音 aloud. Her terms turned out to ask for three
things:

- **A credit**, clearly visible.
- **A report** within a month of use in a company's product.
- **Her written OK.** Neither version of her terms plainly covers a web app
  serving the clips:
  - the Japanese terms say 「セリフ素材以外の音声を…アプリに組み込みたい場合は、
    お問い合わせください」 (ask before building non-line audio into an app);
  - the English terms forbid "Bundling voice files in any format where end
    users can independently extract or download them";
  - the English terms also say that "Lack of response does not constitute
    approval".

The owner asked for a bank with fewer conditions. The importer still reads
hers.

## Consequences

- **A real voice for the kana.**
  - **It is sung, and a character's.** 波音リツ is a known UTAU character.
    The samples hold a steady sung pitch (A3). Trimming turns a note into a
    syllable of spoken length, but keeps its pitch. The owner accepted that.
  - **The two-vowel sounds are his own recordings.** Long vowels are his
    held notes, and あい and おい are his moves. The first recipes, a loop
    and two takes butted together, were heard as seams.
- **The kana no longer share the reader's voice.**
  - The dictionary's kana entries play the deck's clips, so every kana still
    sounds the same everywhere.
  - A kanji's one-mora reading goes through `/api/tts` and stays 女声6.
- **A takedown request** under Article 8-2 would mean going back to the
  engine's set, which the script still makes.
- **The two voices' terms differ on machine learning** (see "The terms").
- **A new set means a new `KANA_REV`** in `lib/audio/playback.js`, as before.

## Follow-up

The owner accepted the set as "good for now", and said it will need
improving later. No fault was named beyond the two-vowel sounds, which are
fixed. The options, from cheapest to most expensive:

- **Another folder or bank, with the same importer.** Candidates are F4, or
  キレ or 何かがキレ at another pitch. A trial set is one command
  (`--out …`), and a swap is a new `KANA_REV`.
- **A commissioned spoken recording.** This gives the best result, for a
  one-off fee (see "Alternatives considered"). Delivered as one syllable a
  file, named by its kana, it is a single-syllable bank, so it goes through
  the same script.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the engine's kana (0018) | Complete and correct, but judged not good enough by ear. It remains the fallback. |
| 小春音アミ's single-syllable bank | The first choice. See "Why not 小春音アミ": a credit, a report and her written OK. |
| His other banks and pitches | See the table under "The voice". Eve and 眩/麗 cut their vowels too short. The owner chose 強 A3 over the rest by ear. |
| A commissioned recording | Spoken, one voice, under a licence written for this use: the best result, for a one-off fee. There are two routes. A ココナラ/Upwork seller with the rights transferred costs about ¥10k–40k. あみたろ's paid recording, licensed without a credit, costs ¥34,750. This is the "Follow-up" option. |
| Public-domain recordings on Wikimedia Commons (Hakatanoshio117117) | No conditions at all, and one spoken voice. But they cover 69 of the 127 sounds: the basic kana and dakuten, with no yōon, long vowels or 外来音. The deck would be two voices. |
| Japanese free sound-effect sites | None has a complete kana set, and several count a tap-to-play sound app as redistribution of their files. |
| AivisSpeech / Style-Bert-VITS2, cloud voices, VOICEVOX's own 波音リツ | Synthesis, which the owner rejected by ear. |
| Research corpora (JSUT, JVS), course audio (MIT OCW) | Licensed for research or non-commercial use, not for a product. |
| Kana clips from other learning sites, found in public repositories | No licence at all. |
