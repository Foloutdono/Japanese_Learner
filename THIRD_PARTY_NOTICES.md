# Third-party data notices

This app's dictionary, kanji, stroke-order and example-sentence data, its
synthesized Japanese speech and station-announcement audio, and its
typefaces, are built on the following third-party sources. The app prints the same list on its
Credits page (Settings › Credits, `frontend/src/domain/attributions.js`);
keep the two in step. Each is used
under its own license, which requires this attribution as a condition of
use — it is included here to satisfy that condition, not as a statement
about the license of this project's own source code.

## JMdict / JMnedict

`backend/datas/vocab/vocab_jmdict.sqlite3` and related vocabulary data are
derived from the JMdict dictionary file, property of the Electronic
Dictionary Research and Development Group (EDRDG), and are used in
conformance with the Group's license.

> This publication has included material from the JMdict (EDICT, etc.)
> dictionary files in accordance with the license provisions of the
> Electronic Dictionaries Research Group. See http://www.edrdg.org/

License: Creative Commons Attribution-ShareAlike 4.0 International (CC
BY-SA 4.0). https://www.edrdg.org/edrdg/licence.html

## KANJIDIC2 / RADKFILE

`backend/datas/kanji/kanji.sqlite3` — the whole 13,108-character
KANJIDIC2 dump, readings, meanings, radicals, stroke counts and dictionary
index numbers, built by `backend/scripts/build_kanji_db.py` — along with
`radicals.json` and `kanji_frequency.json` beside it, is derived from
KANJIDIC2 and RADKFILE, also property of the Electronic Dictionary
Research and Development Group (EDRDG), used under the same license terms
as JMdict above. (It replaced a set of per-topic JSON files —
`kanji_readings.json`, `kanji_radicals.json` and the rest — which the
database now carries in full.)

License: Creative Commons Attribution-ShareAlike 4.0 International (CC
BY-SA 4.0). https://www.edrdg.org/edrdg/licence.html

## KanjiVG

The stroke-order diagrams served from `backend/kanjivg/` (mounted at
`/kanjivg`, drawn by `frontend/src/components/study/DrawingCanvas.jsx`
and the dictionary's kanji plate) are the KanjiVG data by Ulrich Apel.

License: Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA
3.0). https://kanjivg.tagaini.net/

## Tatoeba

Example sentences served through `backend/routes/reading.py` include
sentences from the Tatoeba Project (https://tatoeba.org), contributed by
its community of volunteers.

License: Creative Commons Attribution 2.0 France (CC BY 2.0 FR).
https://creativecommons.org/licenses/by/2.0/fr/deed.en

## VOICEVOX — 春日部つむぎ (Kasukabe Tsumugi)

The station-announcement clips in `frontend/public/sounds/announcements/`
(played by `playAnnouncement`, see `frontend/public/sounds/README.md`) are
synthesized with the VOICEVOX voice synthesis engine, using the 春日部つむぎ
(Kasukabe Tsumugi) voice library. VOICEVOX permits commercial use of
generated audio conditional on a credit indicating VOICEVOX was used, and
each character voice carries its own additional terms — see the citations
below.

> VOICEVOX:春日部つむぎ

License (engine): see https://voicevox.hiroshiba.jp/term/
License (character voice — 春日部つむぎ 利用規約):
https://tsumugi-official.studio.site/rule

## VOICEVOX Nemo

Every Japanese voice the app plays apart from the station announcements
is synthesized with VOICEVOX Nemo:

- the exam listening dialogues;
- the dictation (書取) clips;
- the card readings served by `/api/tts`.

It also made the kana deck's syllables until plan 121c, when they were cut
from a recorded voice instead (波音リツ, below).

The engine runs as a self-hosted service; see `backend/study/voice_engine.py`
and `docs/adr/0019-speech-is-synthesized-by-a-self-hosted-voicevox-nemo-engine.md`.

VOICEVOX Nemo permits commercial and non-commercial use of the audio it
generates on the condition of this credit:

> VOICEVOX Nemo

License (voice library — VOICEVOX Nemo 利用規約):
https://voicevox.hiroshiba.jp/nemo/term/

Among other things, the terms prohibit using the generated audio **for
machine learning**. No clip in this repository or produced by this app may
be used to train, fine-tune or evaluate a model, or be published as a
dataset. They also prohibit uses that damage the image of VOICEVOX or of
the voice providers, and misattribution.

The engine's own grant (the licence text the image prints when it starts)
also requires that anyone to whom the generated audio is licensed be bound
to follow the voice library's terms, and to pass the same obligation on.

Engine: VOICEVOX Nemo ENGINE, `voicevox/voicevox_nemo_engine` 0.23.0, run
unmodified from the published image and not redistributed. It is
dual-licensed; the open-source licence is LGPL-3.0, and its source is at
https://github.com/VOICEVOX/voicevox_nemo_engine.

## 波音リツ (Namine Ritsu): the kana syllables

The kana deck's syllables, `frontend/public/sounds/kanas/`, are cut from
the UTAU voicebank 波音リツ強連続音 Ver1.5.1 (its A3 folder), recorded by
カノン and distributed at https://www.canon-voice.com/voicebanks/.
`backend/scripts/build_kana_audio.py --from-bank`, with
`backend/scripts/kana_bank.py`, did the following:

- took each syllable from where a recorded string opens on it, and cut it
  before the next sound;
- made each long vowel by joining the vowel's attack to a note he held on
  that vowel;
- took あい and おい from his own move from one vowel into the other;
- trimmed every clip, matched its loudness and resampled it to 48 kHz.

`kanas/sources.json` names the voice of every clip. The bank itself is not
in this repository.

His terms are at https://www.canon-voice.com/terms/ (read 2026-09-24). The
page says to go by its summary, and that the summary takes precedence over
the terms bundled with an UTAU bank:

> 商用利用可です。
> 音源の転載、再配布可
> 原音を加工しての転載、再配布可
> クレジット表記不要

In short: commercial use is allowed, the bank and processed recordings from
it may be redistributed, and no credit is required. The app credits him on
its Credits page anyway, as provenance.

The formal articles below the summary say more:

- **第6条1** grants a free, non-exclusive licence for commercial and
  non-commercial use.
- **第8条2** lets him ask for a work he judges inappropriate to be taken
  down. The app would comply.
- **第6条2 is narrower than the summary.** It allows modification within
  personal use, so long as the result is not distributed. The page tells
  users to go by the summary, and 第7条1 lets him settle any doubt over
  interpretation.

The bank's bundled `旧readme.txt` (2011) forbids redistributing its files.
The current `readme.txt` points to the site's terms, and those take
precedence for UTAU banks.

## LAME (via lameenc)

The backend encodes that speech to MP3 with LAME, through the `lameenc`
Python package, which bundles it.

License: GNU Lesser General Public License, version 3 or later (LGPL-3.0-or-later).
https://github.com/chrisstaite/lameenc

## Typefaces

Noto Sans JP and Noto Serif JP (Google) and Space Grotesk (Florian
Karsten), bundled through `@fontsource/*`, are used under the SIL Open
Font License 1.1. https://openfontlicense.org/

---

Because JMdict and KANJIDIC2 are share-alike (CC BY-SA 4.0), any content
that is a direct adaptation of their material (e.g. exposing their
definitions or reading data as part of a generated exercise) inherits that
same license obligation. See the JLPT mock-exam plan
(`backend/study/exam_blueprint.py` and related modules once built) for how
generated content is kept separate from directly-adapted dictionary data
where that distinction matters.
