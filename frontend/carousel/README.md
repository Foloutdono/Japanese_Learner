# The carousel studio (plans 200–200l)

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

## The types of carousel

A type is what the carousel does, not how it looks: every type is drawn
in the same station-plate language, and an item offers the types it has
the content for (the studio greys out the others).

| | Type | What it does | From |
| --- | --- | --- | --- |
| 駅名標 | Station plates | the guided walk: the item stop by stop | every source |
| 模試 | Mock exam | a cover (its sections, a name to fill in), the questions picked, each answered on the next slide, then the answer sheet with every right answer filled in | every source with a question |
| 乗換 | This or that | two things a learner mixes up side by side, each in a sentence, what tells them apart, then a question on it | a point with a rival in the catalogue, a kana with lookalikes |
| 組立 | Build it | the translation to build, then the sentence put together piece by piece (at most six steps), each piece's words with what they do | a sentence, a translation, a lesson's first example |
| 一覧 | Top five | a list worth saving, one item a slide, then the list whole | a kanji's words, a word's family, a kana's words, a point's sentences, a passage's words |
| 会話 | Conversation | the tour's scene line by line, then "what do you say?" | a lesson with a scene |

## The last slide

Every type ends on the source's own station, what its line teaches in
figures counted from the content (`bank/index.json`), and a call to
action fitted to the type ("How many out of 3?" after an exam). How it
says so is picked in the studio, from six endings drawn side by side
under the deck (終点, "Last slide"). The mark is the default:

| Ending | Draws |
| --- | --- |
| The mark | 辻 large, its name, what the app is, today's stop on a plate (its line's rail, its code in the line's roundel, its name over its reading), the post's ask, and the metal to the website ("Start on tsuji.app"), the studio's handle under it when it has one |
| Route map (路線図) | the app's two lines out of 辻, 学習 and 実践, every station on them in its pigment, the source's ringed and marked "you are here" |
| Commuter pass (定期券) | a pass from 辻 to the source's station, in its line's colour: valid N5 → N1, the line, the holder (the handle) |
| Call to action | the type's ask large, then save, send, follow, each with its icon |
| Terminus (終点) | the train's last word, 終点です。ご乗車ありがとうございました。, on a dark panel |
| Station plate | the source's 駅名標: its reading, its code, the stations either side |

## The questions

`quizzes.js` writes every question an item can be asked, in the JLPT's
forms and the app's own drills, and the studio's chips pick which the
mock exam asks (three by default; the walk ends on them too where
"The questions picked" is on):

| Source | Questions |
| --- | --- |
| Sentence | 読み (reading of its word), 表記 (its word in kana: which spelling), its word's meaning, what its point expresses, ★ word order, which translation |
| Translation | which sentence says it, ★ word order, what its point expresses, a word's meaning |
| Lesson | the scene's "what do you say?", the tour's questions (up to four), what the point means, ★ word order |
| Word | its reading, its spelling, its meaning |
| Kanji | its reading, its meaning, which kanji means this, a word's reading, its stroke count |
| Kana | its sound, which kana a sound is, its twin in the other script |
| Comprehension | every question the seed writes (understanding, inference, vocabulary, grammar: eight to twelve a passage), then the reading of its words |

A question has one right answer, the content's own. A wrong answer is
dealt only where it cannot be right too: a reading that is not the
word's, a spelling that is no word (`carousel_bank.orthography` checks
each against the deck and JMdict), a meaning that shares no word with the
right one (`quizzes.overlaps`), a translation of another sentence. ★ word
order is asked only over a pattern's own pieces after the word it takes
(話す・こと・が・できます), whose order the grammar fixes, never over a
sentence's phrases, which can be said in more than one order. Nothing is
asked by blanking a particle out of a sentence.

Plan 200l's review closed the ways a right answer still slipped in as a
wrong one, or the answer showed through the question: a reading
question never deals another reading of a one-kanji word (店 てん beside
みせ) nor a reading the deck gives the same written word (行く いく,
ゆく); it prints bare every word that shares a kanji with the one asked
(入院 over 退院), whose furigana would give it away; and a meaning
question in French deals only words with a French gloss, so no English
choice stands among French ones. A word the deck spells twice opens by
its spelling and reading (上（じょう）, 上（かみ）).

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

A pair that only looks like two particles gets no such slide: 今にも
("at any moment"), とも after a word that is not a person (往復とも, "both
ways") and と before 言う or 思う, which quotes (専門家とは言わない). Nor
does a への or での whose noun is itself described (住民への事前の説明):
which noun the pair describes is the reader's call. どこにも and 誰にも
before a negative verb are named for what they mean, "nowhere" and
"nobody".

`src/carousel.test.js` pins each sense with the sentence that must find it
and the one that must not (a passive's agent, なる, 決まる, 一年に及ぶ).

## What a slide draws from

Every slide is drawn from the app's own data, written once into
`bank/` by `backend/scripts/carousel_bank.py`:

| File | Holds | From |
| --- | --- | --- |
| `N5.json … N1.json` | the reading bank's sentences, word by word: reading, romaji, gloss, type, the points each word carries, the 表記 question's wrong spellings of its word; the points' rule, form, careful, compare (with the rival's meaning and an example) and twists | `content/reading_sentences.py`, `study/analysis.analyze_local` (grouped as `components/analysis/rows.js` groups), the deck's glosses, the catalogue |
| `grammar-N*.json` | each catalogue point: its rule, examples, twists, scene and quiz, its rival, every sentence split into words with the point lit | `content/grammar/*.json`, the tours |
| `words-N*.json` | each deck word: reading, romaji, glosses, its sentences in the bank, its wrong spellings | the deck, JMdict |
| `kanji-N*.json`, `kanji-index.json` | readings, meanings, strokes (KanjiVG) and words of each kanji | KANJIDIC2, `backend/kanjivg/` |
| `kana.json` | each kana: romaji, strokes, its twin, words written with it | the kana sets |
| `comprehension.json` | the passages, their questions and the words worth learning first | `content/comprehension/*.json` |
| `index.json` | the figures the last slide quotes: sentences, points, words, kanji, kana, passages | all of the above |

A word wears the vocabulary line's pigment, a particle or an ending the
grammar line's, a kanji the kanji line's: DESIGN.md's "one line, one
colour", so a colour on a post means what it means in the app. The gold is
the action (the metal), and nothing else.

A question is one only understanding answers: its right answer is the
catalogue's (a scene's, a quiz's, a comprehension question's), never a
particle blanked out of a sentence, where a second particle could be
right too.

"All types" draws the same item as every type it can be, side by side,
to choose from; "One type" keeps one and exports it. Each source lists
the station plates' slides it may leave out, and each type its own
options (the exam's cover and answer sheet, the list's recap), as
toggles. The departure board and the study card of plan 200
were styles, not types, and plan 200c retired them.

## Nothing leaves the frame

A slide never sets text outside the format's safe area, over other text,
or below the smallest size a feed shows legibly: every block that could
be long (a sentence, a choice, a bubble, a label, a station's name) is
fitted, from its largest size down, to the room the others leave, and
what can give way (a sense, a note, the romaji) gives way first; a
sentence's translation is never cut. Plan 200d
checked this by drawing every slide of a sample of every source, as
every type and every ending, in both formats, languages and grounds,
with the real fonts, and measuring every line of text set; every
issue it found was fixed. Since plan 200l the check also reads the
pixels: nothing at all, a shape as much as a word, is drawn in the
margin outside the safe area (the "Your turn" slide's cue, once an
arrow pointing off the frame, is a speech bubble under the prompt,
drawn only where it fits).

## Easy to read

Every line of prose (a meaning, a translation, an explanation) is set at
the body rung or larger wherever the slide has the room, about 15pt on a
phone, and never under the sm rung (13pt) unless a slide is full; a
label (a gloss under a word, a caption) holds the sm rung where it can.
A slide's text takes the room it has rather than its first size that
fits: the examples, a scene, a caution and its rival, a point and how it
works in the sentence are set at the largest scale the slide holds (the
examples and the point then centred in what is left). What gives way,
and in which order:

- **A question's answers keep their room first.** Each written answer
  is set whole, on as many lines as it needs (three at most), its row as
  tall as it needs when the answers stand one under the other; the
  question's sentence takes what they leave. Before the answers shrink,
  the answer's explanation, its gloss and the sentence's translation
  give way, then the sentence steps down; on the answer slide, whose
  answers were read on the slide before, they sit closer first. A
  Japanese answer stays on one line a rung smaller rather than breaking
  between its kana; a long question steps down a rung for long answers.
- **A point's line in its sentence** is set at the lead rung where the
  point's meaning can step down for it.
- **A scene's translations** are chosen first, the Japanese over them as
  large as it then fits and never smaller; its note gives way before
  they step down, and its bubbles take the whole width first.
- **Nothing is cut**: a sentence's translation, an answer, a meaning.
- English text quotes in “ ” (the catalogue's « » are French), so an
  opening mark never ends a line alone.

`readcheck` (the layout checker run for prose sizes) measured the change
over a sample of every source as every type: slides with a line of prose
under the body rung went from 1,257 of 4,811 to 352, nearly all of them
at the sm rung on slides that are full.

## Furigana and line breaks

The Japanese is set as the app sets it (`ExampleSentence.jsx` and its
rules in `index.css`; `layoutSentence` in `draw.js`):

- **One word, one reading.** The bank's readings come a kanji at a time;
  a word's are joined, てつどう over 鉄道, so the word is not spread
  into 鉄 道 and the reading does not read as two words.
- **A wide reading leans on kana.** A reading wider than its kanji leans
  half a reading character into the kana on both sides (お願い), and
  only where there is kana on both: beside a kanji or the word's edge it
  widens its kanji instead. A lone kana between two readings is leant
  on by one only.
- **Two words' readings never run together**: a space is kept between
  them.
- **Never under the caption rung**, the app's own floor, where ご reads
  as こ.
- **Over the kanji only.** A word set alone (a list's row, a word's own
  slide) is read like a sentence's word: ふ over 降 in 降る, not ふる over
  the whole of it. The deck's words carry their readings cut to their
  kanji; the kanji bank's are cut on the kana the word writes itself
  (`furiganaOf` in `common.js`: 降り出す read ふりだす is 降 ふ, り, 出 だ,
  す).
- **The JLPT level is a tag**, in the app's quiet frame for a row's
  level (`.browse-result-row__level`): N5 in a hairline box after the
  romaji, context rather than a colour, never a stray line under the
  meaning.
- **A line breaks between phrases (文節)**, as the app's
  `word-break: auto-phrase` breaks it: never before a particle, the
  copula, an ending, the verb a て-form leans on (おくれて いる) or the
  second noun of a compound (鉄道 会社). A phrase is kept whole at a
  size a little under the largest rather than broken at the largest,
  and the lines are evened out (the app's `text-wrap: balance`), so ね。
  is never left alone on the last line.
- Within that, Japanese wraps by its own rules (no small kana, closing
  bracket or prolonged mark at a line's start, no opening bracket at its
  end), and a word too long for a line is split rather than run off it.

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
| `sources.js` | a plan per source: the walk's slides, and what each other type needs, in which language |
| `quizzes.js` | every question an item can be asked, with its safe wrong answers |
| `explain.js` | a point explained in its own sentence, stacked particles, lookalike kana |
| `common.js` | seeded order, dealt choices, romaji, glosses, near-miss readings |
| `slides.js` | the slide kinds, drawn once, the types and their decks |
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
source drawn as every type it can be, a question that never deals its
answer twice nor a wrong answer that could be right, ★ only where the
order is fixed, the figures the bank's own.
