"""
What a learner may not post to another (plan 310).

App Store guideline 1.2 asks an app whose users publish to each other
for a way to filter objectionable material before it is posted, beside
the report, the block and a published address. The report is the
library's queue (routes/decks.report_deck, deck_reports) and the duels'
(pvp_reports), read by a person; this is what stands in front of it.
Moderation is still a queue, not a mechanism: the filter refuses a
closed list of words at the door, and everything it lets through can
still be reported and read.

What counts as posted is what another learner reads: a username (the
番付, the duels, under every published deck), a deck's name and its
description, and the text of the cards in a deck someone else can open
(published, or followed since). A private deck is the learner's own
notebook and is never read here.

Two tiers, by where the text stands:

- `refused(text)`: a slur, in any of the app's languages or in
  Japanese. Refused everywhere, a card's text included.
- `refused(text, name=True)`: a slur or a vulgarity. A name is what a
  learner reads before choosing (the handle, a deck's name and its
  line in the library); a card is what they opened, and a card may
  have to say what くそ means. So a card's gloss may be vulgar, never a
  slur.

Precision before recall, because the content is a language. Every
learner writes romaji (shita, mashita, shitamachi), French (en retard,
un bâtard de pain), Spanish (negro, cono) and Japanese (聞き違い,
インドシナ人, ちゃんこ鍋, ガイジン) a looser list would refuse, and a
wrong refusal stops a real learner with no way to know why. So:

- A Latin word is matched whole, after folding (case, accents, the
  digits and signs that spell letters inside a word, a number at its
  end), with a plural's -s. Never inside another word, except the few
  `_PARTS` no word of English, French, Spanish or Hepburn romaji holds
  (tests/test_content_filter.py runs them over every word the app
  teaches and its romaji).
- A Japanese term is matched in the text, so it is chosen for having
  no innocent word around it, and carries its lookalike as a guard
  where one exists (ガイジ but not ガイジン). Never in hiragana: きちがい
  is inside 聞き違い read in kana.

Every rule is pinned in tests/test_content_filter.py with the text it
must refuse and the lookalike it must let through, and the app's own
taught text must pass the whole of it. A rule is added the same way,
never on one sighting.

Nothing it reads is kept, logged or rung: the refusal says which field
was refused, never what in it.
"""
import re
import unicodedata

# What a refusal is called, on the wire and in the screens' tables.
REFUSED = "content_refused"

# ── Slurs: refused everywhere ─────────────────────────────────
#
# Whole words, folded (see _fold). Each one is a slur in every use a
# learner's deck could make of it; a word with an innocent sense in
# one of the app's languages is not here (retard is French for "late",
# negro Spanish for "black", dyke a levee, chink the gloss of 隙), nor
# one a learner writes for another reason (kike is the romaji of 聞け,
# JAP 101 a course's code: ジャップ below is the slur written as one;
# faggot is KANJIDIC2's gloss of 把, a bundle, so it is refused in a
# name alone).
_SLURS = frozenset({
    # English
    "nigger", "nigga", "wetback", "raghead", "towelhead", "gook",
    "tranny",
    # French
    "bougnoule", "youpin", "youpine", "negre", "negresse", "bicot",
    "chinetoque", "niakoue", "pede", "tarlouze",
    # Spanish
    "maricon", "maricona", "sudaca", "negrata",
})

# Inside a word too: no word of English, French, Spanish or Hepburn
# romaji holds it but the two the guards leave alone (snigger,
# niggardly).
_SLUR_PARTS = re.compile(r"(?<!s)nigg(?:er|a(?!rd))")

# Japanese, in the text. Katakana and kanji as written: hiragana is
# where the lookalikes are (聞き違い holds きちがい).
_SLURS_JA = re.compile(
    "ニガー"
    "|チョン公"
    "|(?<!印度)支那人"      # 印度支那人, Indochinese, in the old spelling
    "|(?<!インド)シナ人"    # インドシナ人
    "|チャンコロ"           # never ちゃんこ / チャンコ鍋
    "|ガイジ(?!ン)"         # ガイジン is 外人
    "|キチガイ"
    "|穢多"
    "|ジャップ(?!カサイ)"   # ジャップカサイ, a Thai massage, is JMdict's
    "|クロンボ|黒んぼ"
)

# ── Vulgarity, and a slur a gloss can hold: refused in a name ──
#
# Whole words, folded. "shit" is never matched inside a word: romaji
# holds it in every past tense (mashita) and in shita, shitamachi.
# Nor is nique: every French picnic is a pique-nique.
_VULGAR = frozenset({
    # English
    "shit", "shitty", "bullshit", "shithead", "cunt", "bitch", "bitches",
    "whore", "slut", "asshole", "dickhead", "wanker", "porn", "porno",
    "faggot",
    # French
    "putain", "pute", "salope", "connard", "connasse", "encule", "enculer",
    "couille", "couilles", "branleur",
    # Spanish
    "puta", "puto", "pendejo", "pendeja", "verga", "chingar", "chinga",
    "chingada", "chingado", "culero", "joder", "gilipollas", "hijueputa",
    "malparido",
})

# Inside a word: no word of the app's languages or of romaji holds
# them (Hepburn never writes "ck").
_VULGAR_PARTS = re.compile(r"fuck|cocksuck|faggot")

# Letters a word is spelled with in place of letters, read back only
# inside a word: "5h1t" is a word, "N5" a level, "1945" a year.
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
                       "7": "t", "@": "a", "$": "s"})
# Letters NFD does not take apart.
_LETTERS = str.maketrans({"ß": "ss", "æ": "ae", "œ": "oe", "ø": "o",
                          "ł": "l", "đ": "d"})
_TOKEN = re.compile(r"[a-z0-9@$]+")
_CAMEL = re.compile(r"(?<=[a-z])(?=[A-Z])")


def _fold(text: str) -> str:
    """NFKC (full-width letters and half-width kana made plain), a
    camel-cased name split into its words, case folded, and a Latin
    letter's accent dropped. Only a Latin letter's: NFD would take the
    dakuten off が too."""
    text = _CAMEL.sub(" ", unicodedata.normalize("NFKC", text)).casefold()
    text = text.translate(_LETTERS)
    out = []
    for ch in text:
        base = unicodedata.normalize("NFD", ch)
        out.append(base[0] if base[0].isascii() else ch)
    return "".join(out)


def _words(folded: str) -> list[str]:
    """The Latin words of a folded text, a number at a word's end cut
    off (Tifa2, SwiftRonin1234) and its other digits and signs read as
    the letters they stand for. A number alone is no word."""
    words = []
    for token in _TOKEN.findall(folded):
        token = re.sub(r"\d+$", "", token)
        if token and any(c.isalpha() for c in token):
            words.append(token.translate(_LEET))
    return words


def _in(word: str, listed: frozenset) -> bool:
    return word in listed or (word.endswith("s") and word[:-1] in listed)


def refused(text: str | None, *, name: bool = False) -> bool:
    """True when `text` holds a slur, or with `name`, a vulgarity too.
    See the module's docstring for what each tier is for."""
    if not text:
        return False
    folded = _fold(text)
    if _SLURS_JA.search(folded):
        return True
    words = _words(folded)
    # A handle may be spelled apart to pass (n_i_g_g_e_r, f.u.c.k): its
    # letters run together are read as one word as well. Only a name of
    # one word: two words run together make a third ("Mother Father").
    if name and not any(ch.isspace() for ch in folded):
        squashed = "".join(words)
        if squashed and squashed not in words:
            words.append(squashed)
    for word in words:
        if _in(word, _SLURS) or _SLUR_PARTS.search(word):
            return True
        if name and (_in(word, _VULGAR) or _VULGAR_PARTS.search(word)):
            return True
    return False


def _strings(value) -> list[str]:
    """Every string a card's fields hold, however nested (a kanji card's
    readings are a dict of lists)."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, (list, tuple)):
        return [s for v in value for s in _strings(v)]
    return []


def card_refused(fields: dict | None, notes: str | None = "") -> bool:
    """A written card, as another learner reads it: its fields and its
    notes, each read alone."""
    return any(refused(s) for s in [*_strings(fields or {}), notes or ""])
