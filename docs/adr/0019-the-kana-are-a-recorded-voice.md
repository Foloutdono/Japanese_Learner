# 0019 — The kana are a recorded voice

- **Status**: accepted by the owner.
  - **2026-09-24:** changed to 波音リツ, after 小春音アミ was set aside for
    her terms ("Why not 小春音アミ", below).
  - **What is in:** the importer and its tests.
  - **What the clips wait on:**
    - the bank's download host, canon-voice.com, which the build environment
      blocks until it is allowed;
    - the owner's choice of bank and pitch, by ear.
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

**波音リツ**, by カノン: an UTAU voicebank. There are five on
https://www.canon-voice.com/voicebanks/: 強, 通常 (弱), キレ, Eve and 眩＆麗.

- **The bank known in detail** is 強連続音 Ver1.5.1. It is a joined bank (see
  below) at two pitches: A3 (220 Hz) and F4 (349 Hz).
- **The owner picks** the bank and the pitch by ear, from trial sets.
- **A real voice,** recorded for singing.
- **Complete.** It covers every sound the deck teaches. That includes the ヴ
  row, which his bank records as ヴ, ヴぁ, ヴぃ, ヴぇ and ヴぉ, and ウィ, ウェ,
  ウォ. This comes from a third-party parser of the bank; the import confirms
  it.
- **Terms that ask for nothing** (below).

### How it is made

`scripts/build_kana_audio.py --from-bank DIR --pitch A3 --credit namine-ritsu`
uses `scripts/kana_bank.py`, which indexes the bank and cuts every sound by
recipe:

| Sound | From |
|---|---|
| a syllable (か, きゃ, ファ …) | the sample that opens a recorded string (`- か`), cut to 0.4 s from the onset and never past the next sound in the string |
| ああ/アー, いい, うう, ええ/えい (ē), おお/おう (ō) | the bank's long tone where it has one (a single-syllable bank may). Otherwise the vowel is held: its steady end is repeated past the end of its recording, each repeat joined in phase, to 0.7 s |
| あい, おい | the glide the singer made, where a string goes from one vowel to the other (`- あ` then `a い`), with his first vowel shortened to 0.28 s. Otherwise two samples joined in phase |
| を | お's sample: を is said "o" (ウォ is うぉ's) |
| じ/ぢ, ず/づ | じ, ず: the deck files them together already |
| ヴ row | his own ゔ samples. The バ row only for a bank without them, and the run reports it |

**How a bank is read**

- **Single-syllable banks (単独音).** One syllable a file, named by it or by
  its oto.ini alias.
- **Joined banks (連続音, his).** They record strings such as
  `_かかきかくかけかこ.wav`. Their oto.ini names every sound in each one.
  - `- か` opens the string, from silence. `a か` is a か sung after a
    vowel.
  - Only the `- ` sounds are taken: that is a syllable on its own, which is
    what a learner hears.
  - The next sound in the string ends the syllable, at its offset plus its
    preutterance, which is where it is heard.
  - The last sound in a file ends at the oto cutoff, by UTAU's rule: a
    positive cutoff counts from the file's end, a negative one from the
    offset.
- **Aliases** are read by `parse_alias`:
  - a pitch (`A3`, `_G4`) is not part of the syllable;
  - a variant (`か↑`, `あR`) loses to the plain sample;
  - ヴ is read as ゔ and ン as ん.
- **Pitch folders.** A bank with one folder per pitch must be given
  `--pitch`. Otherwise the best sample of each syllable would sing the set in
  several keys.
- **Onsets** are found from the sound itself, searching from the oto offset
  onwards.
- **Phase.** Every join slides by up to a pitch period to meet what it follows
  in phase. Blended half a period apart, two sounds at one pitch cancel into
  an audible dip.

The same `finish()` as the engine's clips does the rest, and LAME resamples
the bank's 44.1 kHz. The output spec is unchanged (48 kHz mono, CBR 96 kbps,
peak ≤ −3 dBFS, loudness at `playback.js`'s target), so nothing downstream
changes but `KANA_REV`.

The engine mode stays: `build_kana_audio` without `--from-bank`.

### Provenance and credit

The engine's clips and the bank's carry different terms: different credits,
and different rules on machine learning.

- **Where each clip comes from.** `frontend/public/sounds/kanas/sources.json`
  records which voice made each clip, as its row id in
  `frontend/src/domain/attributions.js`.
- **Every voice is credited.** `tests/test_kana_audio.py` fails if any voice in
  that file lacks its row on the Credits page or its section in
  `THIRD_PARTY_NOTICES.md`.
  - His terms do not require a credit. The app credits him anyway, as
    provenance.
- **The bank stays out of the repository.** It lives under
  `backend/datas/kana_source/`, which is gitignored; nothing needs it there.

## The terms

These are his terms (https://www.canon-voice.com/terms/). They were read from a
verbatim snapshot of 2026-08-15, because the site is blocked in the build
environment. Read them again from the site when the bank is downloaded.

**The summary.** The page says to read only this, and that it takes
precedence over the terms bundled with the bank:

- 「商用利用可です。」: commercial use is allowed;
- 「音源の転載、再配布可」: the bank may be reposted and redistributed;
- 「原音を加工しての転載、再配布可」: the processed recordings may be too;
- 「クレジット表記不要」: no credit is required.

**The formal text below it**

- **Article 6-1** grants a free, non-exclusive licence for commercial and
  non-commercial use.
- **Article 8-2.** He may ask for a work he judges inappropriate to be taken
  down, and the app would comply. The engine's set remains a working fallback.
- **Article 6-2 is narrower than the summary.** It is older and reads
  「個人使用の範囲でのデータの加工、改変を行う事は配布をしない限り問題ありません」
  (modification is fine within personal use, so long as it is not
  distributed). The page says to read the summary, and Article 7-1 lets him
  settle any doubt. The page's Q&A answers 「○○してもいいですか？」 with
  「いいです。」 (yes). An email to confirm (canon7373@gmail.com, on the page)
  is optional reassurance, not a condition.

**Other points**

- **Other software.** Use through other software follows that software's
  terms. None applies here: the importer reads his WAVs directly.
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

### When the clips land

One commit:

1. **Download the bank.** Allow `www.canon-voice.com` and `canon-voice.com` in
   the environment's network settings. Download the banks into
   `backend/datas/kana_source/ritsu/`.
2. **Trial sets for the owner,** one per bank and pitch:

   ```bash
   python -m scripts.build_kana_audio --from-bank datas/kana_source/ritsu/<bank> --pitch A3 \
       --credit namine-ritsu --out datas/kana_source/trial-<bank>-A3
   ```

3. **Cut the chosen set:** the same command with `--force` and no `--out`,
   then `--check`.
4. **The Credits row,** in `frontend/src/domain/attributions.js`:

   ```js
   { id: 'namine-ritsu', name: '波音リツ', by: 'カノン', what: 'kana', license: '波音リツ terms', url: 'https://www.canon-voice.com/' },
   ```

   - Add `creditsWhat.kana` in both locales: 'Kana voice' and 'Voix des kana'.
   - Drop "the kana" from the `voicevox-nemo` row's comment.
5. **His section in `THIRD_PARTY_NOTICES.md`,** with:
   - the terms URL and the date they were read;
   - the quoted summary;
   - Articles 6-1 and 8-2, and the note on 6-2;
   - what was done to the audio: cut, held, joined, loudness-matched and
     resampled;
   - "credit not required; given as provenance".

   Take the kana out of the VOICEVOX Nemo section.
6. **The frontend constant.** `KANA_REV = 'ritsu1'` in `lib/audio/playback.js`.
7. **Docs.** Update the かな section of `frontend/public/sounds/README.md` and
   this ADR's status line.

`tests/test_kana_audio.py` fails until steps 4 and 5 are done.

## Consequences

- **A real voice for the kana,** once imported.
  - **It is sung, and a character's.** 波音リツ is a known UTAU character.
    The samples hold a steady sung pitch (A3 or F4). Trimming turns a note
    into a syllable of spoken length, but keeps its pitch. The owner accepted
    that.
  - **The long vowels are held by repetition.** A joined bank records no long
    tones.
- **The kana no longer share the reader's voice.**
  - The dictionary's kana entries play the deck's clips, so every kana still
    sounds the same everywhere.
  - A kanji's one-mora reading goes through `/api/tts` and stays 女声6.
- **A takedown request** under Article 8-2 would mean going back to the
  engine's set, which the script still makes.
- **The two voices' terms differ on machine learning** (see "The terms").
- **A new set means a new `KANA_REV`** in `lib/audio/playback.js`, as before.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the engine's kana (0018) | Complete and correct, but judged not good enough by ear. It remains the fallback. |
| 小春音アミ's single-syllable bank | The first choice. See "Why not 小春音アミ": a credit, a report and her written OK. |
| A commissioned recording | Spoken, one voice, under a licence written for this use: the best result, for a one-off fee. Two routes: a ココナラ/Upwork seller with the rights transferred, about ¥10k–40k; or あみたろ's paid recording, ¥34,750, licensed without a credit. The next step if a sung voice does not serve. |
| Public-domain recordings on Wikimedia Commons (Hakatanoshio117117) | No conditions at all, and one spoken voice. But it covers 69 of the 127 sounds: the basic kana and dakuten, with no yōon, long vowels or 外来音. The deck would be two voices. |
| Japanese free sound-effect sites | None has a complete kana set, and several count a tap-to-play sound app as redistribution of their files. |
| AivisSpeech / Style-Bert-VITS2, cloud voices, VOICEVOX's own 波音リツ | Synthesis, which the owner rejected by ear. |
| Research corpora (JSUT, JVS), course audio (MIT OCW) | Licensed for research or non-commercial use, not for a product. |
| Kana clips from other learning sites, found in public repositories | No licence at all. |
