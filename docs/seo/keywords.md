# Keywords for the landing page (plan 167)

What the public page at `/` should rank for, and where each term goes on
it. Researched 2026-09-29 for plan 167, the landing page.

## Method, and what it cannot tell you

No keyword-volume tool (Keyword Planner, Semrush, Ahrefs) was reachable
from the research session, so demand is **tiered, not counted**: read off
what each query's first page is made of (who ranks, which page types,
how many products versus guides) and off the "best app" round-ups that
the commercial queries return. Before the page ships, confirm the tiers
in Google Keyword Planner for FR, BE, CH and CA; after it ships, Search
Console's queries report replaces this file's guesses with real ones.

The market is **French first**. The app says so everywhere a crawler
looks (`index.html` is `lang="fr"`, the manifest's name is "Tsuji —
Apprendre le japonais", every vocabulary card carries a French gloss),
so the page's default is French at `/`, with English at `/en/` and
`hreflang` between them.

## What one page can win

A product page ranks where the first page of results is made of product
pages. For the commercial queries ("application pour apprendre le
japonais") Google shows round-ups (ling-app, lingopie, voyagejapon,
htpratique, generationvoyage) and store listings; for the informational
heads ("hiragana", "kanji", "grammaire japonaise") it shows guides and
lists. So:

- **The landing page** targets the commercial terms, the brand, and the
  mid-tail where Tsuji is one of few products (the JLPT mock exam, the
  sentence analyser, dictation).
- **The round-ups** are won off the page: getting Tsuji into the
  French "meilleures applications pour apprendre le japonais" lists is
  worth more than any on-page change for that query.
- **The informational heads** are won by pages the app already has the
  content for (see "After the landing"), not by the homepage.

## The map (French, at `/`)

Tier: demand, highest first (very high, high, medium, low). Competition:
how hard page one is for a new domain.

### Primary — the title, the H1 and the description

| Query | Intent | Tier | Competition |
|---|---|---|---|
| apprendre le japonais | mixed | very high | very high |
| application pour apprendre le japonais | commercial | high | high (round-ups, stores) |
| appli japonais / application japonais | commercial | medium | high |
| apprendre le japonais gratuitement | commercial | medium | high |

### Secondary — one section each, its H2 carrying the term

| Query | Intent | Tier | Competition | Section |
|---|---|---|---|---|
| apprendre les hiragana et katakana, alphabet japonais | informational | very high | high | Kana |
| vocabulaire japonais JLPT, vocabulaire JLPT N5 | informational | medium | medium | Vocabulary |
| apprendre les kanji, kanji JLPT | informational | high | high | Kanji |
| grammaire japonaise, grammaire JLPT N5 | informational | high | medium | Grammar |
| répétition espacée, flashcards japonais, Anki japonais | commercial | medium | medium | The method |
| préparer le JLPT, examen blanc JLPT, test JLPT en ligne | commercial | medium | **medium: few French products** | Mock exam |
| analyser une phrase japonaise, traduire mot à mot | tool | low | **low** | Analyser |
| apprendre le japonais avec YouTube / les animés | informational | medium | medium | Analyser |
| dictée japonais, compréhension orale japonais | practice | low | **low** | Practice |
| dictionnaire japonais français | tool | very high | high (Lexilogos, Freelang, Jisho) | Tools, in passing |

The three in bold are the page's best chances in its first months: the
query is specific, the searcher wants a product, and page one is mostly
courses, videos and English sites.

"Gratuit" is a keyword only while it is true. Today it is: the app is
free during early access, and the kana line is free for good
(`README.md`, "Free during early access"). The page says exactly that and no more, and the
FAQ's answer changes the day the pass goes on sale.

### Long tail — the FAQ, one question each

- Quelle est la meilleure application pour apprendre le japonais ?
- Par où commencer : hiragana, katakana ou kanji ?
- Peut-on apprendre le japonais seul ?
- Combien de temps faut-il pour atteindre le JLPT N5 ?
- Tsuji est-il gratuit ?
- Qu'est-ce que la répétition espacée ?
- Tsuji remplace-t-il Anki ?

Google no longer shows FAQ rich results for sites like this one (it
limited them to government and health sites in 2023), so the FAQ is
there for the queries and for answer engines, not for a snippet. Mark it
up anyway; it costs nothing and describes the page.

### The brand

`Tsuji` alone collides with a common surname and other brands (the
Tsuji culinary school among them), so the brand is never the title's only
anchor: "Tsuji" always travels with the category ("Tsuji, l'application
pour apprendre le japonais"). `Tsuji app`, `Tsuji japonais` and `辻` must
return the page first; the `Organization` markup and the store listings
naming the same site are what make that stick.

## English, at `/en/`

The English pages of results are far more crowded (Duolingo, WaniKani,
Bunpro, Renshuu, and round-ups on Class Central and Clozemaster), so the
English page leans harder on the specific terms:

| Query | Section |
|---|---|
| learn Japanese app | title, H1 |
| JLPT mock test, JLPT practice test N5 | Mock exam |
| Japanese sentence analyzer, learn Japanese from YouTube | Analyser |
| learn hiragana and katakana | Kana |
| Japanese grammar by JLPT level | Grammar |
| spaced repetition Japanese, Anki alternative for Japanese | The method |
| Japanese dictation practice, Japanese reading practice by level | Practice |

## The title and the description

```
FR  <title>Apprendre le japonais : kana, kanji, JLPT N5 à N1 | Tsuji</title>          (57)
    <meta name="description" content="L'application pour apprendre le japonais un
    peu chaque jour : kana, vocabulaire, kanji et grammaire revus au bon moment,
    dictées et examens blancs du JLPT.">                                             (155)

EN  <title>Learn Japanese: kana, kanji and JLPT N5 to N1 | Tsuji</title>
    <meta name="description" content="The app to learn Japanese a little every day:
    kana, vocabulary, kanji and grammar reviewed at the right moment, with dictation
    and JLPT mock exams.">
```

## The store listings (ASO)

The store search is a second search engine, and the listing pages rank
in Google too. The same map, cut to the stores' fields:

| Field | Limit | Proposal |
|---|---|---|
| App Store name | 30 | `Tsuji : apprendre le japonais` (29) |
| App Store subtitle | 30 | `Kana, kanji, JLPT N5 à N1` (25) |
| App Store keywords | 100 | `hiragana,katakana,kanji,jlpt,vocabulaire,grammaire,flashcards,srs,anki,dictionnaire,japon` |
| Play title | 30 | `Tsuji : apprendre le japonais` |
| Play short description | 80 | `Kana, vocabulaire, kanji et grammaire du JLPT, revus au bon moment.` |

## After the landing: the pages that win the heads

The informational heads above ("hiragana", "kanji JLPT N5", "grammaire
japonaise", "dictionnaire japonais français") are where the volume is,
and the app already holds the content that answers them: the kana deck
with its audio, the vocabulary deck by JLPT level with French glosses,
KANJIDIC2 with KanjiVG stroke order, and a grammar catalogue with a lesson
per point in French and English. Static pages generated from `backend/content/`
at build time (a kana chart, a list per JLPT level, a page per kanji and
per grammar point), each ending on the store buttons, are the follow-up
that turns the landing page into a site. That is its own plan.
