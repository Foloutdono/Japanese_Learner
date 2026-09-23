# 0019 — The kana are a recorded voice

- **Status**: accepted by the owner. The importer, its tests and the credit
  guard are in; the clips themselves are not yet. They wait on two things:
  the bank (hosted on Google Drive), and the author's written OK for this
  use, because her terms do not plainly cover it (see "The terms").
- **Amends**: [0018](0018-speech-is-synthesized-by-a-self-hosted-voicevox-nemo-engine.md),
  for the kana deck only. The engine keeps every other voice, and a lone
  kana spoken through `/api/tts`.
- **Date**: 2026-09-23
- **Plan**: 113b

## Context

Plan 113 regenerated the kana deck from VOICEVOX Nemo's kana notation.
The set is complete and correct: every sound the deck teaches, は as "ha".
The owner listened and judged it below the standard a course needs. A
synthesized mora is right, and flat. Kana are the first sound a learner
hears in the app, and the one they hear most often.

What was wanted:

- one voice for all 127 sounds, real if possible;
- free or cheap;
- licensable in a paid app.

## Decision

### The voice

**小春音アミ**, by あみたろの声素材工房: her UTAU single-syllable bank
単独音3.00, the G4 folder.

- **A real voice.** It is recorded in a measured booth: noise floor 18.5 dB(A),
  T60 220 ms (her figures).
- **Nearly complete.** It holds every syllable the deck teaches except the ヴ
  row, and real long tones (あー, いー …) recorded to be held.
- **Recommended for exactly this by its author.** Her read-aloud page
  (https://amitaro.net/voice/yomiage_01/) sends anyone who wants the 五十音
  read aloud to this bank: 「「あー」「いー」など日本語五十音読み上げ音声は、
  『UTAU音源・小春音アミ』の「単独音3.0」の「G4(ソ)」…をご利用ください」.

### How it is made

`scripts/build_kana_audio.py --from-bank DIR --pitch G4 --credit amitaro`
uses `scripts/kana_bank.py`, which indexes the bank and cuts every sound
by recipe:

| Sound | From |
|---|---|
| a syllable (か, きゃ, ファ …) | its own sample, cut to 0.4 s from the onset |
| ああ/アー, いい, うう, ええ/えい (ē), おお/おう (ō) | the bank's long tone (あー …), 0.7 s; the vowel's sample if it has none |
| あい, おい | two samples, the second joined in phase with the first |
| を | お's sample: を is said "o" (ウォ is うぉ's) |
| じ/ぢ, ず/づ | じ, ず: the deck files them together already |
| ヴ row | ゔぁ … if the bank has them; else the バ row, which is how most speakers say it. The run reports it. |

The onset is found from the sample itself (the oto offset is only a floor),
so a bank that left its offsets at 0 still cuts right. The join of あい
slides by up to a pitch period to meet the first vowel in phase: blended half
a period apart, two vowels at one pitch cancel into a dip mid-glide.

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
- **The credit is enforced.** `tests/test_kana_audio.py` fails if any voice in
  that file lacks its row on the Credits page or its section in
  `THIRD_PARTY_NOTICES.md`.
- **The bank is never committed.** It lives under `backend/datas/kana_source/`,
  which is gitignored.

## The terms

Three pages apply:

- **The UTAU bank's terms** (https://amitaro.net/utau/licence01.html). For use
  "as general voice material, built into an app", they send you to the
  voice-material terms as well.
- **The voice-material terms in Japanese** (https://amitaro.net/voice/voice_rule/,
  last updated 2026-08-11).
- **The voice-material terms in English** (https://amitaro.net/voice/terms/).

The two voice-material versions differ, and each says which reader it
applies to: the Japanese one only to those who read Japanese without
difficulty, the English one to everyone else.

**Plainly allowed by all three**

- commercial use;
- editing, trimming and pitch changes;
- building the audio into an app;
- ordinary use without asking first.

**Required**

- **The credit, clearly visible.** Either 「あみたろの声素材工房（https://amitaro.net/）」
  or 「小春音アミ」, with a link where possible. Using the audio without it is
  forbidden. It goes on the Credits page and in `THIRD_PARTY_NOTICES.md`.
- **A report.** Using the audio in a company's product or service must be
  reported by email within about a month of launch (the Japanese terms).

**Forbidden**

- selling or distributing the voice files themselves as material;
- hotlinking her server;
- anything unsuitable for children;
- political or religious use;
- registering raw material in Content ID;
- presenting the voice as your own.

**Not plainly covered, which is why the clips wait**

- **Japanese terms.** Their redistribution rules are for her line material
  (セリフ素材) only, and a UTAU bank is not line material. For everything else
  they say 「配信音声・コーパス音声などセリフ素材以外の音声を再配布したい・アプリに
  組み込みたい場合は、お問い合わせください」.
- **English terms.** They allow "Integrating into software or games, where
  voice files cannot be independently extracted by end users" and forbid
  "Bundling voice files in any format where end users can independently
  extract or download them". A web app serves each clip at its own URL, and
  no web app can make audio impossible to extract.
- **Silence is not consent.** The English terms say "Lack of response does not
  constitute approval". All inquiries must be in Japanese.

So the owner asks her, in Japanese, before the clips ship, and keeps her
answer with the release records. The email should say what the use is:

- the syllables are processed and served as MP3s by a paid web and mobile app;
- the credit is on the Credits page.

It should also ask what a paid licence would cost if this use needs one.
She takes paid commissions (有償依頼), which also offers the best version of
this: the 127 sounds *spoken* rather than sung, under a licence written for
the use.

### When the clips land

One commit, once her answer is in hand:

1. **Cut the set** (from `backend/`):

   ```bash
   python -m scripts.build_kana_audio --from-bank datas/kana_source/amitaro --pitch G4 --credit amitaro --force
   python -m scripts.build_kana_audio --check
   ```

   The report should show no gaps, and only the ヴ-row fallback. Listen to
   the set before committing it.
2. **The Credits row**, in `frontend/src/domain/attributions.js`:

   ```js
   { id: 'amitaro', name: 'あみたろの声素材工房 · 小春音アミ', by: 'あみたろ', what: 'kana', license: 'Amitaro terms', url: 'https://amitaro.net/' },
   ```

   - Add `creditsWhat.kana` in both locales: 'Kana voice' and 'Voix des kana'.
   - Drop "the kana" from the `voicevox-nemo` row's comment.
3. **Her section in `THIRD_PARTY_NOTICES.md`**, with:
   - the credit, 「音声素材：あみたろの声素材工房（https://amitaro.net/）」;
   - the three terms URLs;
   - what was done to the audio: cut, joined, loudness-matched, resampled;
   - that the files are not to be redistributed on their own;
   - the date of her answer.

   Take the kana out of the VOICEVOX Nemo section.
4. **The frontend constant.** `KANA_REV = 'ami1'` in `lib/audio/playback.js`.
5. **Docs.** Update the かな section of `frontend/public/sounds/README.md` and
   this ADR's status line.
6. **Tell her.** Report the release to her within the month, as her terms ask.

`tests/test_kana_audio.py` fails until steps 2 and 3 are done.

## Consequences

- **A real voice for the kana**, once cleared.
  - **It is young, bright and high.** She rates her voice's youthfulness 8/10
    (「かなり子供っぽいです」) and the samples are sung at G4 (392 Hz), well
    above the app's speaking voices. The owner accepted that.
  - **Trimming turns a sung note into a spoken-length syllable** but keeps its
    pitch.
- **The kana no longer share the reader's voice.**
  - The dictionary's kana entries play the deck's clips, so every kana still
    sounds the same everywhere.
  - A kanji's one-mora reading goes through `/api/tts` and stays 女声6.
- **The ヴ row is the バ row** until a bank with ゔ is used.
- **The two voices' terms differ on machine learning.** Hers allow training,
  VOICEVOX Nemo's forbid it. `sources.json` says which applies to which clip.
- **A new set means a new `KANA_REV`** in `lib/audio/playback.js`, as before.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the engine's kana (0018) | Complete and correct, but judged not good enough by ear. It remains the fallback. |
| Public-domain recordings on Wikimedia Commons | The cleanest licence, but the set found covers the basic kana only: no yōon, no long vowels, no 外来音. The deck would be two voices. |
| AivisSpeech / Style-Bert-VITS2 models | More natural synthesis, but still synthesis of a lone mora. It needs 2–4 GB of RAM, and each model's licence and training data would have to be checked one by one. |
| A cloud voice (Google Chirp 3 HD, Azure) | Synthesis again, plus a billing account, for 127 clips made once. |
| Another UTAU bank (e.g. 波音リツ) | Permissive terms, but a character's singing voice. 小春音アミ is the one bank whose author recommends it for reading kana aloud. |
| A commissioned recording | The best result: spoken, one voice, under a licence written for this use. It is the natural next step if her answer is a paid one. |
| Research corpora (JSUT, JVS), course audio (MIT OCW) | Licensed for research or non-commercial use, not for a product. |
| Kana clips from other learning sites, found in public repositories | No licence at all. |
