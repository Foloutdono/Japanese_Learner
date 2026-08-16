# Third-party data notices

This app's dictionary, kanji, and example-sentence data is built on the
following third-party sources. Each is used under its own license, which
requires this attribution as a condition of use — it is included here to
satisfy that condition, not as a statement about the license of this
project's own source code.

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

`backend/datas/kanji/kanji_readings.json`, `kanji_radicals.json`, and
related kanji data are derived from KANJIDIC2 and RADKFILE, also property
of the Electronic Dictionary Research and Development Group (EDRDG), used
under the same license terms as JMdict above.

License: Creative Commons Attribution-ShareAlike 4.0 International (CC
BY-SA 4.0). https://www.edrdg.org/edrdg/licence.html

## Tatoeba

Example sentences served through `backend/routes/reading.py` include
sentences from the Tatoeba Project (https://tatoeba.org), contributed by
its community of volunteers.

License: Creative Commons Attribution 2.0 France (CC BY 2.0 FR).
https://creativecommons.org/licenses/by/2.0/fr/deed.en

---

Because JMdict and KANJIDIC2 are share-alike (CC BY-SA 4.0), any content
that is a direct adaptation of their material (e.g. exposing their
definitions or reading data as part of a generated exercise) inherits that
same license obligation. See the JLPT mock-exam plan
(`backend/study/exam_blueprint.py` and related modules once built) for how
generated content is kept separate from directly-adapted dictionary data
where that distinction matters.
