# Sources the deck is measured against (plan 109)

Two external lists, kept verbatim so `scripts/placement_report.py` and
`tests/test_placement_report.py` measure the same thing on every run.
Neither is served to a learner; both only ever *propose* — a candidate
they raise goes through the content audit's evidence bar
(`docs/content-audit/PLAYBOOK.md`) before it becomes a card or moves one.

## `opensubtitles_ja_50k.txt` — a frequency ranking

The 50,000 most frequent tokens of the Japanese OpenSubtitles 2016 corpus,
one `token count` per line, from
[hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(`content/2016/ja/ja_50k.txt`). The lists are released under
**CC BY-SA 4.0** (the repository's code under MIT); the corpus is
OpenSubtitles (Lison & Tiedemann, 2016). Attribution: Hermit Dave,
FrequencyWords, from the OpenSubtitles corpus.

It is a *spoken* register — subtitles — which is closer to what a
learner meets in N5–N3 than a newspaper ranking is (`vocab_jmdict.sqlite3`'s
`freq_rank` is one; its top five are 委員会, 移植, 円高, 加盟, 会長).
Its tokens are surfaces, not words: 言, 知, 出 are verb stems, ジョン
and サム are cast lists. `placement_report.py` runs every token through
the tokenizer (`study/morphology`) and sums the counts per
(lemma, reading), which turns it into a ranking of ~35,000 words; 8,400
multi-morpheme surfaces are dropped. The derived order of the deck's own
keys is what `datas/vocab/vocab_frequency.json` holds (rebuilt with
`--rebuild-order`); as a derivative of a CC BY-SA list, that file carries
the same licence and this attribution.

## `jlpt_tanos.json` — the community JLPT lists

`{level: [[expression, reading], …]}`, 7,972 entries, trimmed from
[elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) `src/n?.csv`
(MIT), which took them from jamsinclair/open-anki-jlpt-decks and
chyyran/jlpt-anki-decks, which are Jonathan Waller's lists at
[tanos.co.uk](https://www.tanos.co.uk/jlpt/) (**CC BY**). Attribution:
Jonathan Waller, JLPT Resources.

The deck is, in all likelihood, a descendant of the same lists — the
sizes per level match to within a few dozen — so this is a check on
where the deck has *drifted* from its source (455 words the lists put at
N3 the deck holds at N2), not an independent judge of level. There is no
official JLPT vocabulary list since 2010; every list is an estimate.

## What is deliberately not here

The NINJAL BCCWJ short-unit list (the corpus `unidic-lite` is trained on)
and the Leeds internet-corpus list were the review's first choices and
are not reachable from the build environment; either would slot in
beside these with the same script, and the ranking half should be
re-based on BCCWJ if it is ever fetched.
