"""
What a learner types, and what the catalogue holds.

The dictionary's search was one line, repeated in five places:

    q in entry["kanji"] or q in entry["kana"] or q.lower() in meaning.lower()

which answers only for a reader who can already type Japanese, spells
without accents, in the one language the session happens to be set to,
and never makes a mistake. Everything a beginner actually does — typing
"mizu" because there is no IME on the laptop, typing "eleve" because the
accent is two keys away, typing "water" in a French session because
English is the language they think vocabulary in, typing "recieve" —
found nothing, and finding nothing in a dictionary reads as "the app
does not have this word".

This module is the four answers, and nothing else: it decides what a
query MEANS, never what matches it — the collections keep their own
predicates (routes/dictionary.py, and the two SQLite modules for the
pools), because a 212k-row table answers a query in SQL and an 8k-row
list answers it in Python, and one of those had better not be written as
the other.

    1. ROMAJI.   "mizu" also searches みず and ミズ (`to_kana`). One
       conversion per request, never one per row, which is what lets the
       same forms go into a `kana LIKE ?` against the pool.
    2. ACCENTS.  "eleve" and "élève" are one query (`fold`). This is
       French's problem far more than English's, and the app's first
       language is French.
    3. BOTH LANGUAGES. A term is matched against every gloss the entry
       has, not the one being displayed. See routes/dictionary.py.
    4. TYPOS.    A query that finds NOTHING is retried against the
       nearest word the catalogue actually contains (`corrections`).
       Only then: a typo correction that fires while there are real
       results is not a kindness, it is the search quietly answering a
       different question.

Nothing here is ever displayed. The screen prints the learner's own
typing and the entries as they are; this module's output is a set of
strings to look for.
"""
import re
import unicodedata
from functools import lru_cache

# ── 1. Folding ────────────────────────────────────────────────
# Case and diacritics off, so "élève", "Eleve" and "eleve" are one
# string. NFKD splits a letter from its accent and the comprehension
# drops the accent; NFC would leave é as one indivisible codepoint and
# there would be nothing to strip.
#
# Cached because the HAYSTACK is folded far more often than the needle:
# a page of results folds two glosses per entry over 8,405 entries, on
# every keystroke, and the set of glosses in the app is bounded and
# fixed. After the first search over a collection every fold of it is a
# dict hit, which is cheaper than the `.lower()` this replaced. 64k
# entries is comfortably every gloss in both tables; a few hundred KB.


@lru_cache(maxsize=65536)
def fold(text: str) -> str:
    """Lowercase, accent-stripped, stripped at the ends.

    Latin text only. Japanese passes through unharmed in the sense that
    matters — NFKD leaves kana and kanji alone, and there is nothing to
    lowercase — but the caller should be matching Japanese with `raw`
    rather than through here, because NFKD also unfolds 全角 forms and
    that is a decision for the caller, not for a helper.
    """
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).strip()


# ── 2. Romaji ─────────────────────────────────────────────────
# A table-driven transliterator, longest match first. Deliberately NOT
# pykakasi (study/romaji.py's `to_romaji` runs the other way and costs a
# dictionary lookup per word): this is one pass over a handful of
# characters, and it has to be able to say "that was not romaji at all".
#
# It accepts both romanisations for the sounds they disagree on — shi/si,
# tsu/tu, fu/hu, ji/zi, cha/tya — for the same reason study/romaji.fold
# merges them: none of those is a mistake, and a learner who was taught
# kunrei should not have to know that this app was written in Hepburn.
#
# ん is the one letter with a rule rather than a row: `n` before a vowel
# or `y` is the な row (and matches as "na"/"nya" below, longest-first),
# and `n` before anything else — a consonant, the end of the word — is
# ん. That is what makes "sannen" さんねん and "kanji" かんじ. `nn` is
# deliberately absent from the table so the second n can start ね.
_ROMAJI = {
    "a": "あ", "i": "い", "u": "う", "e": "え", "o": "お",
    "ka": "か", "ki": "き", "ku": "く", "ke": "け", "ko": "こ",
    "ga": "が", "gi": "ぎ", "gu": "ぐ", "ge": "げ", "go": "ご",
    "sa": "さ", "shi": "し", "si": "し", "su": "す", "se": "せ", "so": "そ",
    "za": "ざ", "ji": "じ", "zi": "じ", "zu": "ず", "ze": "ぜ", "zo": "ぞ",
    "ta": "た", "chi": "ち", "ti": "ち", "tsu": "つ", "tu": "つ", "te": "て", "to": "と",
    "da": "だ", "di": "ぢ", "du": "づ", "de": "で", "do": "ど",
    "na": "な", "ni": "に", "nu": "ぬ", "ne": "ね", "no": "の",
    "ha": "は", "hi": "ひ", "fu": "ふ", "hu": "ふ", "he": "へ", "ho": "ほ",
    "ba": "ば", "bi": "び", "bu": "ぶ", "be": "べ", "bo": "ぼ",
    "pa": "ぱ", "pi": "ぴ", "pu": "ぷ", "pe": "ぺ", "po": "ぽ",
    "ma": "ま", "mi": "み", "mu": "む", "me": "め", "mo": "も",
    "ya": "や", "yu": "ゆ", "yo": "よ",
    "ra": "ら", "ri": "り", "ru": "る", "re": "れ", "ro": "ろ",
    "wa": "わ", "wo": "を", "n": "ん",
    "kya": "きゃ", "kyu": "きゅ", "kyo": "きょ",
    "gya": "ぎゃ", "gyu": "ぎゅ", "gyo": "ぎょ",
    "sha": "しゃ", "shu": "しゅ", "sho": "しょ",
    "sya": "しゃ", "syu": "しゅ", "syo": "しょ",
    "ja": "じゃ", "ju": "じゅ", "jo": "じょ",
    "jya": "じゃ", "jyu": "じゅ", "jyo": "じょ",
    "zya": "じゃ", "zyu": "じゅ", "zyo": "じょ",
    "cha": "ちゃ", "chu": "ちゅ", "cho": "ちょ",
    "cya": "ちゃ", "cyu": "ちゅ", "cyo": "ちょ",
    "tya": "ちゃ", "tyu": "ちゅ", "tyo": "ちょ",
    "nya": "にゃ", "nyu": "にゅ", "nyo": "にょ",
    "hya": "ひゃ", "hyu": "ひゅ", "hyo": "ひょ",
    "bya": "びゃ", "byu": "びゅ", "byo": "びょ",
    "pya": "ぴゃ", "pyu": "ぴゅ", "pyo": "ぴょ",
    "mya": "みゃ", "myu": "みゅ", "myo": "みょ",
    "rya": "りゃ", "ryu": "りゅ", "ryo": "りょ",
    # The sounds a borrowed word needs and native Japanese has not got.
    # Only the ones that collide with nothing above: ティ and ディ would
    # have to take "ti" and "di" away from ち and ぢ, and a learner
    # looking up 小さい by typing "tiisai" is the commoner case by far.
    "fa": "ふぁ", "fi": "ふぃ", "fe": "ふぇ", "fo": "ふぉ",
    "she": "しぇ", "che": "ちぇ", "je": "じぇ",
    "vu": "ゔ", "va": "ゔぁ", "vi": "ゔぃ", "ve": "ゔぇ", "vo": "ゔぉ",
}

_VOWELS = "aeiou"
# The whole 促音 rule: a doubled consonant is っ + that consonant. `n`
# is excluded because "nn" is ん + the next syllable, and a vowel
# because "ii" is two い.
_NO_SOKUON = _VOWELS + "n"

# Romaji is long: ō is おう, ī is いい. The macron and the circumflex a
# textbook prints are folded away before we get here (see `fold`), which
# would leave a bare "o" — so the doubled spelling is what this reads,
# and it is the one a learner types anyway.
_KATAKANA_SHIFT = 0x30A1 - 0x3041


def _hira_to_kata(text: str) -> str:
    return "".join(
        chr(ord(c) + _KATAKANA_SHIFT) if "ぁ" <= c <= "ゖ" else c
        for c in text
    )


def to_kana(text: str) -> tuple[str, ...]:
    """The kana a romaji query spells — hiragana AND katakana — or ().

    Both scripts, always: a learner typing "terebi" is looking for テレビ
    and one typing "mizu" for みず, and nothing in the letters says
    which. Two extra forms to match against costs nothing; asking the
    learner to know which script their word is written in defeats the
    point of letting them type letters at all.

    () for anything that is not a complete, plausible romaji word: text
    holding Japanese already, digits, punctuation, a single letter (which
    would turn every "a" in a French gloss into a search for あ), or a
    run of letters the table cannot finish reading.
    """
    s = fold(text)
    if len(s) < 2 or not s.isascii() or not s.isalpha():
        return ()

    out = []
    i = 0
    while i < len(s):
        doubled = i + 1 < len(s) and s[i] == s[i + 1] and s[i] not in _NO_SOKUON
        if doubled:
            out.append("っ")
            i += 1
            continue
        for n in (3, 2, 1):
            chunk = s[i:i + n]
            if chunk in _ROMAJI:
                out.append(_ROMAJI[chunk])
                i += n
                break
        else:
            return ()

    hira = "".join(out)
    return (hira, _hira_to_kata(hira))


# ── 4. Typos ──────────────────────────────────────────────────
# Edit distance, capped: we never need to know that two words are eight
# apart, only whether they are within one or two, and the cap is what
# keeps the row cheap enough to run over a lexicon.
#
# The tolerance is the usual ratchet on length. Three letters and under
# get none at all: at that length one edit reaches a different word
# rather than the same word misspelt ("cat" is one edit from "car",
# "eat", "cut"), and a dictionary that answers a different question is
# worse than one that answers none.
def _tolerance(word: str) -> int:
    n = len(word)
    if n <= 3:
        return 0
    if n <= 6:
        return 1
    return 2


def _distance_within(a: str, b: str, cap: int) -> int | None:
    """Damerau-Levenshtein (optimal string alignment) if <= cap, else None.

    Damerau rather than plain Levenshtein because of the one extra edit
    it counts as one: a TRANSPOSITION. "watre" for "water" and "recieve"
    for "receive" are two substitutions to Levenshtein and one swap to
    Damerau, and at a tolerance of 1 — which is all a five-letter word
    gets, for the reason in `_tolerance` — the commonest typo there is
    would be the one kind this could not correct.

    Three rolling rows rather than a matrix, and a row is abandoned the
    moment every cell in it is over the cap: what makes this affordable
    over thousands of candidates.
    """
    if abs(len(a) - len(b)) > cap:
        return None
    prev2: list[int] = []
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            d = min(
                prev[j] + 1,               # deletion
                cur[j - 1] + 1,            # insertion
                prev[j - 1] + (ca != cb),  # substitution
            )
            if i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                d = min(d, prev2[j - 2] + 1)
            cur.append(d)
        if min(cur) > cap:
            return None
        prev2, prev = prev, cur
    return prev[-1] if prev[-1] <= cap else None


_WORD = re.compile(r"[^\W\d_]+")


def lexicon(glosses) -> tuple[str, ...]:
    """Every distinct word a collection's glosses contain, folded.

    What `corrections` corrects TOWARD. A spell-checker's dictionary
    would be the obvious thing to reach for and would be the wrong one:
    the only correction worth making here is to a word this catalogue
    actually holds, because any other one sends the learner to a second
    empty page. It also means the lexicon is bilingual and free — the
    glosses are already both languages.

    Words of three letters and under are left out: `_tolerance` gives
    them no tolerance, so they could never be corrected to anyway, and
    they are most of the tokens in any gloss list.

    The caller caches this (one `lru_cache` per collection): it is a
    walk of the whole collection, paid once, on the first search that
    finds nothing.
    """
    out = set()
    for gloss in glosses:
        if gloss:
            out.update(w for w in _WORD.findall(fold(gloss)) if len(w) > 3)
    return tuple(out)


def corrections(word: str, lexicon, limit: int = 4) -> list[str]:
    """The words in `lexicon` nearest `word`, nearest first, or [].

    `lexicon` is whatever the collection being searched actually
    contains (routes/dictionary.py builds one per collection, once). A
    correction that is not a word in THIS catalogue is no use: the
    retry would find nothing either, and the learner would have paid
    for two searches to be told the same thing.

    The first letter has to survive. It is a real restriction — it
    misses "hte" for "the" — and it is what turns a scan of every word
    in the catalogue into a scan of a twenty-sixth of it. Transposing
    the first two letters is the one exception worth making, so the
    pair is tried both ways round.
    """
    cap = _tolerance(word)
    if cap == 0:
        return []

    heads = {word[0]}
    if len(word) > 1:
        heads.add(word[1])

    scored = []
    for candidate in lexicon:
        if candidate[0] not in heads or abs(len(candidate) - len(word)) > cap:
            continue
        d = _distance_within(word, candidate, cap)
        if d is not None and d > 0:
            scored.append((d, len(candidate), candidate))

    scored.sort()
    return [c for _, _, c in scored[:limit]]


# ── 5. How strictly ───────────────────────────────────────────
# Leniency 1–4 made the search find what a beginner means; matching
# everything as a SUBSTRING made it find a great deal they did not.
# "sun" found Sunday, sunlight and misunderstanding in the glosses and
# 寸法 through the romaji すん — a prefix of すんぽう — and "fun" found
# funds, function and 雰囲気 (ふんいき), ahead of anything fun. A Latin
# query is ambiguous (English, French or romaji), so a substring of any
# of the three is a very wide net.
#
# So a query now says how strictly it means itself (`match`) and where
# to look (`field`), and the default is the strict reading:
#
#   match "word"  (default) a gloss matches on a WHOLE word ("sun", not
#                 "Sunday"; a plural s/es/x is allowed, "eau" finds
#                 "eaux"), romaji on a WHOLE reading (すん, not すんぽう),
#                 and Japanese typed as Japanese anywhere in the word —
#                 水 is still in 水曜日, which is what looking up a
#                 character is for.
#   match "start" a gloss word, a reading or a written form that STARTS
#                 with the query: "sun" finds sunset, "tabe" たべもの.
#   match "any"   every substring, the old behaviour.
#
#   field "all"      (default) glosses, and readings/written forms.
#   field "japanese" the written forms and readings only — "sun" is
#                    read as すん and nothing else.
#   field "meaning"  the glosses only — "sun" is English/French, never
#                    romaji.
#
# And whatever matches is RANKED: an entry the query names exactly (a
# reading that is the whole romaji, a sense that is the whole word)
# comes before one that starts with it, before one that only contains
# it. Within a rank the collection's own order holds (the deck N5 → N1,
# the pools by frequency).
MATCHES = ("word", "start", "any")
FIELDS = ("all", "japanese", "meaning")

# What separates two readings (or two spellings) in one field: the
# decks pack them with ・ and /, KANJIDIC with ・, and the written form
# of a word is one token.
_READING_SEP = re.compile(r"[・/、,;\s]+")
# KANJIDIC's okurigana dot and affix marks, dropped so a kun reading
# reads as the word it is: た.べる is たべる, みず- is みず.
_READING_MARKS = str.maketrans("", "", ".-~〜")
# A sense boundary in a gloss, and the parenthetical a gloss hangs off a
# sense ("sun (star)"), for the exact rank.
_SENSE_SEP = re.compile(r"[;,/]")
_PAREN = re.compile(r"\([^)]*\)")


@lru_cache(maxsize=65536)
def reading_tokens(field: str) -> tuple[str, ...]:
    """The readings (or spellings) one Japanese field holds, marks off."""
    return tuple(t for t in (x.translate(_READING_MARKS)
                             for x in _READING_SEP.split(field)) if t)


@lru_cache(maxsize=65536)
def _senses(text: str) -> tuple[str, ...]:
    return tuple(s for s in (_PAREN.sub("", x).strip()
                             for x in _SENSE_SEP.split(fold(text))) if s)


@lru_cache(maxsize=1024)
def _latin_pattern(needle: str, match: str):
    # A word character is a letter or digit in any script (folding has
    # already taken the accents off); an apostrophe is a boundary, so
    # "eau" is a word in "l'eau".
    body = re.escape(needle)
    if match == "word":
        return re.compile(rf"(?<![^\W_]){body}(?:s|es|x)?(?![^\W_])")
    return re.compile(rf"(?<![^\W_]){body}")


def text_matches(text: str | None, needle: str, match: str) -> bool:
    """Does a gloss hold `needle` (already folded) as `match` says?"""
    if not text or not needle:
        return False
    hay = fold(text)
    if match == "any" or match not in MATCHES:
        return needle in hay
    return _latin_pattern(needle, match).search(hay) is not None


def reading_matches(field: str | None, form: str, match: str) -> bool:
    """Does a Japanese field hold the reading `form` as `match` says?
    Token by token: "word" is a whole reading, "start" the start of one."""
    if not field or not form:
        return False
    if match == "any" or match not in MATCHES:
        return form in field
    tokens = reading_tokens(field)
    if match == "word":
        return form in tokens
    return any(t.startswith(form) for t in tokens)


def sense_is(text: str | None, needle: str) -> bool:
    """Is one of a gloss's senses exactly `needle` (folded), bar the
    parenthetical? What ranks 太陽 "sun, solar" above 朝日 "morning sun"."""
    return bool(text and needle) and needle in _senses(text)


def sense_starts(text: str | None, needle: str) -> bool:
    return bool(text and needle) and any(
        s.startswith(needle) for s in _senses(text))


# ── The query ─────────────────────────────────────────────────
class Query:
    """One search term, in every form the catalogue might hold it.

    `raw` is what was typed, untouched — the only form Japanese takes,
    because a kanji is not folded, lowercased or transliterated.
    `latin` is that folded (case and accents off), for matching a gloss.
    `jp` is `raw` plus whatever kana the letters spell, which is what a
    Japanese column is matched against.

    `empty` is the browse case — no query at all — and every collection
    short-circuits on it rather than asking this object anything.
    """

    __slots__ = ("raw", "latin", "jp", "original", "match", "field")

    def __init__(self, raw: str, original: str | None = None,
                 match: str = "word", field: str = "all"):
        self.raw = raw
        self.latin = fold(raw)
        # Anything unrecognised is the default: the client narrowed, it
        # did not ask a trick question (the level's rule too).
        self.match = match if match in MATCHES else "word"
        self.field = field if field in FIELDS else "all"
        # What the learner actually typed, when this query is a
        # correction of it — so the answer can say so. None otherwise,
        # which is also what stops a correction being corrected again.
        self.original = original
        forms = [raw] if raw else []
        forms.extend(to_kana(raw))
        self.jp = tuple(dict.fromkeys(forms))

    @property
    def empty(self) -> bool:
        return self.raw == ""

    def respelled(self, alt: str) -> "Query":
        """The same question, asked of a corrected spelling — which keeps
        its strictness and its field, and remembers what was typed."""
        return Query(alt, original=self.raw, match=self.match, field=self.field)

    @property
    def wants_japanese(self) -> bool:
        return self.field != "meaning"

    @property
    def wants_meaning(self) -> bool:
        return self.field != "japanese"

    # ── The two pools' halves of the same question ──
    # The pools take the query as typed and route it by SCRIPT (see each
    # module's `_match`): Latin goes to the gloss column, Japanese to the
    # kanji/kana ones. Both tables were counted for that: ZERO rows carry
    # an ASCII letter in kanji / kana / readings, and zero carry a CJK
    # character in a gloss (two hold a stray 全角 space). So the other
    # pairings can only ever buy a full-table LIKE that cannot match —
    # and these tables are scanned, not indexed, for a `%…%`. That
    # routing is what keeps a romaji query, which searches three forms
    # where an English one searches one, from costing three times the
    # scan.

    @property
    def sql_text(self) -> str:
        """The query as typed, for the pool to route by script itself.

        Not folded: SQLite has no accent folding, so a pool gloss is
        matched on the letters the learner actually wrote. The curated
        decks — where all of this app's own French lives — are filtered
        in Python and do fold (see `hits`).
        """
        return self.raw

    @property
    def sql_kana(self) -> tuple[str, ...]:
        """The kana the query SPELLS, when it is romaji — never the raw.

        The distinction is the whole of it: these are READINGS, so they
        belong against a reading column and nothing else, where the raw
        query may be a kanji and belongs against a kanji column too.
        Collapsing the two cost 水 its entire pool half — every JMdict
        word written with that character, searched for in the readings
        and found nowhere.
        """
        return self.jp[1:]

    @property
    def correctable(self) -> bool:
        """A typo is a single mistyped WORD. A phrase that finds nothing
        usually finds nothing because it is a phrase, not because one of
        its words is wrong, and correcting each word independently is how
        a search starts inventing queries nobody asked."""
        return (
            self.original is None
            and _tolerance(self.latin) > 0
            and self.latin.isascii()
            and self.latin.isalpha()
        )

    def _jp_hit(self, field: str, form: str, spelled: bool) -> bool:
        # Japanese typed AS Japanese is found anywhere in a word at the
        # default strictness — 水 in 水曜日 — while the kana romaji
        # spells must be the whole reading, since the letters were just
        # as likely a gloss (see 5. above).
        if self.match == "word" and not spelled:
            return form in field
        if self.match == "start" and not spelled and field.startswith(form):
            return True
        return reading_matches(field, form, self.match)

    def score(self, jp_fields=(), latin_fields=()) -> int | None:
        """None when the row does not match; else its rank — 0 the query
        names it exactly, 1 a field starts with it, 2 it is only in one.
        The in-memory half of every collection asks this; the SQLite
        halves ask the same question in SQL, built from `sql_text`,
        `sql_kana`, `match` and `field` (see the two pool modules'
        `_match`)."""
        best = None
        if self.wants_japanese:
            for i, form in enumerate(self.jp):
                spelled = i > 0
                for field in jp_fields:
                    if not field or not self._jp_hit(field, form, spelled):
                        continue
                    tokens = reading_tokens(field)
                    if field == form or form in tokens:
                        return 0
                    rank = 1 if (field.startswith(form)
                                 or any(t.startswith(form) for t in tokens)) else 2
                    best = rank if best is None else min(best, rank)
        if self.latin and self.wants_meaning:
            for field in latin_fields:
                if not text_matches(field, self.latin, self.match):
                    continue
                if sense_is(field, self.latin):
                    return 0
                rank = 1 if sense_starts(field, self.latin) else 2
                best = rank if best is None else min(best, rank)
        return best

    def hits(self, jp_fields=(), latin_fields=()) -> bool:
        """Does this query match a row, given its Japanese columns and
        its glosses? `score`, without the rank."""
        return self.score(jp_fields, latin_fields) is not None


def register_sql(conn) -> None:
    """The matchers above as SQLite functions, for the two pools'
    predicates. Each is only ever the second half of an AND after a
    LIKE on the same column, so SQLite calls back into Python for the
    rows the LIKE already found and never for the whole table."""
    conn.create_function(
        "sm_text", 3, lambda text, needle, match: int(text_matches(text, fold(needle or ""), match)),
        deterministic=True)
    conn.create_function(
        "sm_read", 3, lambda field, form, match: int(reading_matches(field, form, match)),
        deterministic=True)
    conn.create_function(
        "sm_sense", 2, lambda text, needle: int(sense_is(text, fold(needle or ""))),
        deterministic=True)


def parse(q: str, match: str = "word", field: str = "all") -> Query:
    return Query(q.strip(), match=match, field=field)


def ranked(query: Query, rows, fields):
    """`rows` that match, best rank first, the rows' own order within a
    rank. `fields(row)` is (jp_fields, latin_fields). The empty query is
    the browse, every row in its order."""
    if query.empty:
        return list(rows)
    scored = []
    for row in rows:
        jp, latin = fields(row)
        rank = query.score(jp, latin)
        if rank is not None:
            scored.append((rank, row))
    scored.sort(key=lambda pair: pair[0])
    return [row for _, row in scored]
