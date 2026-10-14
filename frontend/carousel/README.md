# The carousel studio (plans 210–210n, 212)

A tool for social posts: what the app teaches, drawn as a photo carousel
for TikTok or Instagram, in Tsuji's own visual language, from what the app
itself knows. It is a static page outside `src/`, as `frontend/landing/`
is: none of it ships with the app.

## Where a carousel starts

Each source is one of the app's own lines, and wears its pigment:

| | Source | One carousel is | Its slides |
| --- | --- | --- | --- |
| 読書 | Read a sentence | a sentence of the reading bank | the hook, word by word, the point at work in it, two particles that work together, watch out, the answer, a kanji to write, how did you do? (four numbered answers to comment, from "on my own" to "not yet"; never the app's own rating bar) |
| 翻訳 | Translate | the same sentence, asked from its translation | the translation, the words, the point, the answer; "your turn" asks for it in the comments |
| 文法 | Grammar lesson | a catalogue point | the rule shown in one of its sentences, its examples, the tour's scene and a "what do you say?", another use, watch out, your turn |
| 単語 | Word | a deck word | the reading, its kanji one by one, its sentences, its strokes |
| 漢字 | Kanji | a kanji of the deck | its readings (on, kun), words with it, its strokes |
| かな | Kana | one kana | its strokes, the kana it is mistaken for, its twin in the other script, words with it |
| 理解 | Comprehension | a comprehension passage | the passage page by page, then its questions and their answers |
| 単語帳 | Theme words | a post of a theme of the app's theme decks (fruits, the body, jobs …): its pictured words, easiest first, cut evenly into posts of four to eight (Fruits (1), (2), (3)) | each word with a picture (an emoji, `content/emoji.json`), its reading over it, its romaji, its meaning, then all of them on one slide |
| 似た字 | Lookalike kanji | one of 63 sets of kanji that look alike (大 太 犬 天 夫, 晴 清 情 精 請, `content/lookalikes.json`) | each kanji with its readings, its meaning, what sets it apart and a word it writes, then the set side by side, then "which kanji means this?" |
| 返事 | Your reply | one of 36 conversations of three turns, N5 to N1, from a birthday to a business call (`content/dialogues.json`) | what they say, three replies to choose from, then the reply said and why; every line with its furigana, and at N5 and N4 its romaji under every word, for a beginner |
| 落とし穴 | Traps | a catalogue tour's trap: a sentence that reads one way to the eye and means another | the sentence and what it says (three readings, its translation never printed over it), the answer and why, the two forms side by side, watch out |

The four of plan 210m stop at the station the app teaches them on (a
theme's words at 単語, lookalike kanji at 漢字, a reply and a trap at
文法). A theme, a set and a conversation are one list each, picked
without a level; a trap is picked by its point's level.

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
| 表記 | Kanji spelling | the word and up to four words of its level that share a kanji with it, each heard in kana and asked how it is written (among spellings that are no word), then the sheet | a word with a kanji spelling to ask |
| 仲間外れ | Find the impostor | three rounds of six words: five of the theme and one from another theme no word of it could be mistaken for (fruits and vegetables, birds and insects), each asked, then answered with every word's meaning and the impostor circled | a theme |

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
| Sentence | ★ word order (first, before any slide shows the sentence whole), 読み (reading of its word), 表記 (its word in kana: which spelling), its word's meaning, what its point expresses, which translation |
| Translation | which sentence says it, the reading of its word, what its point expresses (unless the translation prints it) |
| Lesson | the scene's "what do you say?", the tour's questions (up to four), what the point means, ★ word order |
| Word | its reading, its meaning (or which word means this, where its meaning cannot be asked), the reading of up to two words that share its kanji, which of these words is written with its kanji (a word of its kin no other question asks); its spelling is the 表記 type's |
| Kanji | its on'yomi and its kun'yomi, the reading of up to three of its words, which of these words is written with it (up to two: a word's meaning among words written without it, never the word that only says the kanji's own meaning), its meaning, its stroke count |
| Kana | its sound, which kana a sound is, its twin in the other script |
| Comprehension | every question the seed writes (understanding, inference, vocabulary, grammar: eight to twelve a passage), then the reading of its words |

No question is answered before it is asked (plan 210l). A mock exam
shows each answer on the slide after its question, and that answer
leaves out what a later question asks: the reading's answer prints no
meaning when the meaning is asked next, and nothing an answer prints is
a later question's right answer (`quizzes.withoutGiveaways`). A question
whose answer an earlier slide prints is not asked at all (a translation
that says "student" asks no meaning of 学生), and two questions that
answer each other are not set together (★ word order and "which
sentence says it"). A word's kin are each asked once, and a kanji
reading an earlier answer showed is read the same in every choice, so
the choice turns on what was not shown. `src/carousel.test.js` holds it
over every mock exam of every source.

A question has one right answer, the content's own. A wrong answer is
dealt only where it cannot be right too: a reading that is not the
word's, a spelling that is no word (`carousel_bank.orthography` checks
each against the deck and JMdict), a meaning that shares no word with the
right one (`quizzes.overlaps`), a translation of another sentence. ★ word
order is asked only over a pattern's own pieces after the word it takes
(話す・こと・が・できます), whose order the grammar fixes, never over a
sentence's phrases, which can be said in more than one order. Nothing is
asked by blanking a particle out of a sentence.

Plan 210l's review closed the ways a right answer still slipped in as a
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

The breakdown ("Stop by stop") names a particle the same way, in a word:
駅で is "place", 七時に "time", and a particle the table has no sense for
keeps its role ("topic", "object"). The role is said only after a noun:
after a verb から is "because" and と "if", so there the catalogue's line
stays. A number and its counter are one word, read and glossed as one
(三十分 さんじゅっぷん, "30 minutes"; 何度も, "many times"):
`carousel_bank.rows_of` joins them where the tokenizer cuts them apart,
except for a counter the number leaves open (三日, the third or three
days).

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
| `themes.json` | each theme's name, its word for itself, its words easiest first, each with its picture where it has one | `content/theme_data.py`, `frontend/carousel/content/emoji.json`, the app's theme names |
| `lookalikes.json` | each set's kanji: readings, meanings, what sets it apart, a deck word it writes | `frontend/carousel/content/lookalikes.json`, KANJIDIC2, the deck |
| `dialogues.json` | each conversation's turns, every line split into words with its furigana and romaji (お and ご joined to their word) | `frontend/carousel/content/dialogues.json` |
| `traps.json` | every tour twist of kind "trap": its sentence, question, three readings, why, the pair, the point's "careful" step | `content/grammar/*.json` |
| `index.json` | the figures the last slide quotes: sentences, points, words, kanji, kana, passages, themes, traps | all of the above |

`frontend/carousel/content/` is the studio's own hand-written content:
the picture for each theme word (keyed by the theme's English gloss), the
lookalike sets with what tells each kanji apart, and the conversations,
each turn's right reply first (the studio deals them in a seeded order).
They teach, so they are held as the catalogue is: a reply is wrong only
where it cannot be right too (a particle, a tense, a counter, humble
speech used of the other person), its why says what makes it wrong, and
a picture names the one word it shows, never two words of a theme. A
set's kanji may carry the sense it is about (`m`) where the dictionary's
first is another (校 is “exam” before “school”). The conversations' lines
are cut into words by the analyser; where it misreads one (船便 as せんびん,
御社 as ご＋社, 担当の方 as ほう), `carousel_bank._DIALOGUE_READINGS` sets it
right, and the tests hold it. Check every new line's furigana before
committing it.

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
toggles. The departure board and the study card of plan 210
were styles, not types, and plan 210c retired them.

## Nothing leaves the frame

A slide never sets text outside the format's safe area, over other text,
or below the smallest size a feed shows legibly: every block that could
be long (a sentence, a choice, a bubble, a label, a station's name) is
fitted, from its largest size down, to the room the others leave, and
what can give way (a sense, a note, the romaji) gives way first; a
sentence's translation is never cut. Plan 210d
checked this by drawing every slide of a sample of every source, as
every type and every ending, in both formats, languages and grounds,
with the real fonts, and measuring every line of text set; every
issue it found was fixed. Since plan 210l the check also reads the
pixels: nothing at all, a shape as much as a word, is drawn in the
margin outside the safe area (the "Your turn" slide's cue, once an
arrow pointing off the frame, is a speech bubble under the prompt,
drawn only where it fits). The same review fitted what still could
run long: a long handle on the terminus, the station plate and the route
map steps down a size (onto a line of its own under the mark, or, on the
map, off the slide rather than cut), a sentence answer is measured in
the script it is drawn in (kana runs longer), the answer sheet's labels
keep clear of its circles, and a carousel asks six questions at most, so
a mock exam keeps under a feed's twenty slides and its cover and sheet
a readable row each.

Plan 210m's slides are held the same way, and the check ran over every
theme post, set and conversation and forty traps. A conversation's line
carries its furigana (and at N5 and N4 its romaji), which do not shrink
below their rung: on a long turn the call to comment gives way first,
then their line's romaji (the replies keep theirs), then the "what do
you say?"; on the answer, a long why steps the lines down, then their
line (read on the question) gives way, its translation first, before
the why is ever cut, and at the least the why takes the 正解 stamp's
room. A reply is written to keep to one line, a place's name to fit a
title. A gloss on a picture is never broken inside a word, and a word
too long beside its picture has the picture step down. Plan 210n added
a check the measure above does not make: no text set ends cut with
“…” (a translation that ends in one on purpose aside).

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

## The promo stories (plan 212)

宣伝, the last source, draws the app itself rather than what it teaches:
five 9:16 stories, picked by the segments over the list (`promo.js`).
Each frame is drawn with the app's own parts (`app.js`): the review card
with its stage and band, the rating bar's four keys, a question's choice
rows, the white pass, the Depart button, the analyser's boxed sentence
and its point cards, and Today on the print of the hour.

| Story | Picked from | Its frames |
| --- | --- | --- |
| The pitch | (one) | Today on its print, the four lines with their figures, how long to N5 at ten minutes a day, the gate |
| One card | a word of the N5 deck | the card's face, its back with the rating bar and each rating's next review, Today, the gate |
| The analyser | a sentence of the N5 reading bank | the sentence pasted, then cut word by word with its numbered points, the gate |
| Could you pass N5? | an N5 sentence with a kanji-reading question | the question with its four readings, the answer folded as a run folds it, the N5 exam in figures, the gate |
| Your pass | (one) | the pass with a name to write, what is free, the gate |

**The parts are measured, not imagined.** Every figure in `app.js` is a
CSS pixel of the running app on a 400px phone (the review card, the
rating keys, the choice rows, the pass, the Depart button, the
analyser), times `u`, the slide's pixels per CSS pixel. When the app
redraws one of them, measure it again in the app and follow it: the
colours come through `palette` and `APP_INKS`, which
`src/carousel.test.js` holds to `index.css`.

**Today's print is the app's own file.** `app.loadPrint` reads
`public/today/print/<rev>/<hour>-phone.json`, its grain and its paper,
and draws the layers still, as the app draws them with motion reduced
(index.css's `.tpr-` rules and its reduced-motion block go into each
layer): the train halfway across, the clouds at rest. The studio's
"Today's print" picks the hour (曙 dawn, 帰帆 day, 落雁 dusk, 秋月 night).
So the studio needs `public/today/print/`, `src/index.css` and the
print's `print.json` beside it when it is served or published.

**A story promises what the app does today.** Its figures are the
bank's (`index.json`: the decks by level, the kana deck, the N5 exam,
counted as the landing page counts them, and a test holds the two
equal); its words are the app's where the app says them (the ratings,
the stages, "due", Depart, a test holds them to `locales/`). It says
"start free", the kana line free for good, no ads and no trackers; it
never prices a mode nor says "early access", and a test fails if it does.

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
| `promo.js` | the promo stories: their plans from the bank, their frames (plan 212) |
| `app.js` | the app's own parts, drawn at its measures, and Today's print (plan 212) |
| `studio.js` | the page: the pickers, the previews, the export |

## Running it

Serve `frontend/` (the studio imports `landing/tokens.mjs` and the mark
from `src/`) and open `/carousel/`:

```bash
cd frontend && python3 -m http.server 8123   # then http://localhost:8123/carousel/
```

It draws on canvas, so the preview is the PNG: "Download (.zip)" writes
every slide of the chosen direction, `title.txt` and `caption.txt` (the
item, its romaji and translation, hashtags), and a slide opened full size
can be saved alone. The title (plan 210l, `sources.titleOf`) is the hook a
feed asks for over the caption, 90 characters at most (TikTok's limit):
one per source and type, in the post's language, naming the item and its
level ("JLPT N5 mock exam: 3 questions on で. Your score?"); where it would
run long, the item's own text is cut, never the hook. Both are edited in
the studio before they are copied. Published as a claude.ai artifact, the download goes through
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
