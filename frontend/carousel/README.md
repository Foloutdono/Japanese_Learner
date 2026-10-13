# The carousel studio (plans 200, 200b)

A tool for social posts: what the app teaches, drawn as a photo carousel
for TikTok or Instagram, in Tsuji's own visual language, from what the app
itself knows. It is a static page outside `src/`, as `frontend/landing/`
is: none of it ships with the app.

## Where a carousel starts

Each source is one of the app's own lines, and wears its pigment:

| | Source | One carousel is | Its slides |
| --- | --- | --- | --- |
| 読書 | Read a sentence | a sentence of the reading bank | the hook, word by word, the point at work in it, two particles that work together, watch out, the answer, a kanji to write, rate yourself |
| 翻訳 | Translate | the same sentence, asked from its translation | the translation, the words, the point, the answer; "your turn" asks for it in the comments |
| 文法 | Grammar lesson | a catalogue point | the rule shown in one of its sentences, its examples, the tour's scene and a "what do you say?", another use, watch out, your turn |
| 単語 | Word | a deck word | the reading, its kanji one by one, its sentences, its strokes |
| 漢字 | Kanji | a kanji of the deck | its readings (on, kun), words with it, its strokes |
| かな | Kana | one kana | its strokes, the kana it is mistaken for, its twin in the other script, words with it |
| 理解 | Comprehension | a comprehension passage | the passage page by page, then its questions and their answers |

The practice modes a photo cannot hold (dictation needs sound) are left
out; composition is the "your turn" slide, an invitation to write in the
comments.

## Explaining a point in its own sentence

The catalogue says what a point means in general ("で: location of an
action, or means/method"). A slide says it with the sentence's own words
(`explain.js`):

- **A particle** is shown with the word it marks and what it ties it to,
  and named by the one sense the sentence uses: 駅で is the place where
  会います is done, 電車で the way you travel, 七時に a point in time,
  机の上に where something is, 友だちに the person on the other end. The
  sense is read from short hand-written tables of words and verbs; a word
  not in them keeps the general line, which is never wrong, where a guess
  could be. A row that also carries a pattern of its own (人にしたら) keeps
  it too.
- **A form** is built from its dictionary form: 読む → 読んでください.
- **A pattern in pieces** (ので, より…のほうが) is shown as its pieces, the
  word before them and a gap where the sentence runs on between them.
- **Two particles together** (には, では, への, からも …) get a slide of their
  own: what each does, then what the pair does here. には is read by what
  it marks: a place where something is (日本の田舎には…がある), a time, a
  destination, or a person over an adjective or a verb of ability
  (私には難しい: "for me").

`src/carousel.test.js` pins each sense with the sentence that must find it
and the one that must not (a passive's agent, なる, 決まる, 一年に及ぶ).

## What a slide draws from

Every slide is drawn from the app's own data, written once into
`bank/` by `backend/scripts/carousel_bank.py`:

| File | Holds | From |
| --- | --- | --- |
| `N5.json … N1.json` | the reading bank's sentences, word by word: reading, romaji, gloss, type, the points each word carries; the points' rule, form, careful, compare and twists | `content/reading_sentences.py`, `study/analysis.analyze_local` (grouped as `components/analysis/rows.js` groups), the deck's glosses, the catalogue |
| `grammar-N*.json` | each catalogue point: its rule, examples, twists, scene and quiz, every sentence split into words with the point lit | `content/grammar/*.json`, the tours |
| `words-N*.json` | each deck word: reading, romaji, glosses, its sentences in the bank | the deck |
| `kanji-N*.json`, `kanji-index.json` | readings, meanings, strokes (KanjiVG) and words of each kanji | KANJIDIC2, `backend/kanjivg/` |
| `kana.json` | each kana: romaji, strokes, its twin, words written with it | the kana sets |
| `comprehension.json` | the passages and their questions | `content/comprehension/*.json` |

A word wears the vocabulary line's pigment, a particle or an ending the
grammar line's, a kanji the kanji line's: DESIGN.md's "one line, one
colour", so a colour on a post means what it means in the app. The gold is
the action (the metal), and nothing else.

A question is one only understanding answers: its right answer is the
catalogue's (a scene's, a quiz's, a comprehension question's), never a
particle blanked out of a sentence, where a second particle could be
right too.

## The four directions

| | Direction | The app's idiom |
| --- | --- | --- |
| 駅名標 | Station plates | each word a hanging plate, its number in a ring, its line's stripe along its foot |
| 発車標 | Departure board | a sumi board: the words as departures, the number in gold, the type in a ring |
| 札 | Study card | the card and its back, ending on the rating bar: "how did you do?" |
| 模試 | Mock exam | もんだい as the JLPT prints it: the question first, four answers in a hairline lattice, then the teacher's circle and the 正解 seal |

"All four" draws the same item in every direction side by side, to
choose from; "One direction" keeps one and exports it. Each source lists
the slides it may leave out, as toggles.

## Formats

- **4:5 post** (1080 × 1350), for a feed that shows the whole image.
- **9:16 full screen** (1080 × 1920), its content kept out of the band a
  feed lays its own chrome over (`FORMATS[...].safe` in `draw.js`;
  "Show the feed's overlays" tints that band on the previews, never on
  the exported image).

Two grounds (washi and sumi, the app's two themes), two languages (the
slides' Latin text in English or French, French punctuation welded), and
the Japanese as written, with furigana, or in kana.

## The code

| File | Does |
| --- | --- |
| `sources.js` | a slide plan per source: what each slide says, in which language |
| `explain.js` | a point explained in its own sentence, stacked particles, lookalike kana |
| `slides.js` | the slide kinds, drawn once, and the four directions' surfaces |
| `draw.js` | the canvas primitives, the app's tokens at slide scale, the formats |
| `strings.js` | every label a slide prints, in English and French |
| `studio.js` | the page: the pickers, the previews, the export |

## Running it

Serve `frontend/` (the studio imports `landing/tokens.mjs` and the mark
from `src/`) and open `/carousel/`:

```bash
cd frontend && python3 -m http.server 8123   # then http://localhost:8123/carousel/
```

It draws on canvas, so the preview is the PNG: "Download (.zip)" writes
every slide of the chosen direction and `caption.txt` (the item, its
romaji and translation, hashtags), and a slide opened full size can be
saved alone. Published as a claude.ai artifact, the download goes through
the viewer's `downloads` capability; anywhere else it is a plain link.

## When the bank changes

```bash
cd backend
python -m scripts.carousel_bank            # rewrite bank/*.json
python -m scripts.carousel_bank --check    # exit 1 when a file is stale
```

Run it after a change to the reading bank, the deck, the kanji, the kana,
the catalogue, the tours, the comprehension seeds or the analyser, and
commit the files. `src/carousel.test.js` holds the files to what a slide
needs: every sentence spelled back by its words, every item of every
source drawn, a quiz that never deals its answer twice.
