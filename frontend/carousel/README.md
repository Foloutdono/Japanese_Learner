# The carousel studio (plan 200)

A tool for social posts: a sentence of the reading bank
(`backend/content/reading_sentences.py`) drawn as a photo carousel for
TikTok or Instagram, in Tsuji's own visual language, from what the app
itself knows about the sentence. It is a static page outside `src/`, as
`frontend/landing/` is: none of it ships with the app.

## What a carousel says

Every slide is drawn from the app's own data, written once into
`bank/N5.json … N1.json` by `backend/scripts/carousel_bank.py`:

| Slide | Says | From |
| --- | --- | --- |
| The hook | the sentence, a prompt, the level | the bank row |
| Word by word | each word: reading, romaji, gloss, type | `study/analysis.analyze_local`, grouped as the breakdown's rows are (`components/analysis/rows.js`), the deck's glosses in en/fr |
| The grammar point | the pattern, its meaning, its form, the rule, the sentence with the point lit | the grammar catalogue (`content/grammar/*.json`) |
| The answer | the sentence with furigana, its romaji, its translation | the bank row, the furigana |
| Bonus: write it | a kanji of the sentence, its strokes in order, numbered | KanjiVG (`backend/kanjivg/`), KANJIDIC2 |
| Bonus: twist | a pair of forms and why they differ | the grammar tour's twists |
| Rate yourself | the rating bar's four verdicts (study card only) | `domain/ratingScales.js` |
| The mark | 辻, the name, the landing page's line, a handle | `components/ui/markPaths.js` |

A word wears the vocabulary line's pigment, a particle or an ending the
grammar line's, a kanji the kanji line's, the sentence the reading line's:
DESIGN.md's "one line, one colour", so a colour on a post means what it
means in the app. The gold is the action (the metal), and nothing else.

## The four directions

| | Direction | The app's idiom |
| --- | --- | --- |
| 駅名標 | Station plates | each word a hanging plate, its number in a ring, its line's stripe along its foot |
| 発車標 | Departure board | a sumi board: the words as departures, the number in gold, the type in a ring |
| 札 | Study card | the card and its back, ending on the rating bar: "how did you do?" |
| 模試 | Mock exam | もんだい as the JLPT prints it: the word underlined (or the particle's gap), four answers in a hairline lattice, then the teacher's circle and the 正解 seal |

"All four" draws the same sentence in every direction side by side, to
choose from; "One direction" keeps one and exports it.

## Formats

- **4:5 post** (1080 × 1350), for a feed that shows the whole image.
- **9:16 full screen** (1080 × 1920), its content kept out of the band a
  feed lays its own chrome over (`FORMATS[...].safe` in `slides.js`;
  "Show the feed's overlays" tints that band on the previews, never on
  the exported image).

Two grounds (washi and sumi, the app's two themes), two languages (the
slides' Latin text in English or French, French punctuation welded), and
the Japanese as written, with furigana, or in kana.

## Running it

Serve `frontend/` (the studio imports `landing/tokens.mjs` and the mark
from `src/`) and open `/carousel/`:

```bash
cd frontend && python3 -m http.server 8123   # then http://localhost:8123/carousel/
```

It draws on canvas, so the preview is the PNG: "Download (.zip)" writes
every slide of the chosen direction and `caption.txt` (the sentence,
its romaji and translation, hashtags), and a slide opened full size can be
saved alone. Published as a claude.ai artifact, the download goes through
the viewer's `downloads` capability; anywhere else it is a plain link.

## When the bank changes

```bash
cd backend
python -m scripts.carousel_bank            # rewrite bank/*.json
python -m scripts.carousel_bank --check    # exit 1 when a file is stale
```

Run it after a change to the reading bank, the deck, the catalogue or the
analyser, and commit the files. `src/carousel.test.js` holds the files to
what a slide needs: every sentence spelled back by its words, every
sentence's point present, a quiz that never deals its answer twice.
