"""Which catalogue grammar points a sentence actually uses.

Detection, not gating. study/difficulty.grammar_over_level asks "is this
sentence too hard for N4", and may answer conservatively -- a point it
misses only lets a sentence through. Here every hit becomes a chip a
learner can press and a row that opens a grammar card, so a miss is a
rule left untaught and a false hit is a lesson about something that is
not in the sentence. Both cost, in opposite directions, which is why
this is its own module with its own rules rather than a flag on the
gate's.

What this knows that a substring test cannot
--------------------------------------------
The old detector was `sentence.find(stem)` over the catalogue's
patterns, guarded by a blunt rule -- a two-character all-hiragana stem
was thrown away as not distinctive enough to trust. That rule cost more
than it bought: it took out 〜から, 〜とき, 〜だけ, 〜など, 〜ごろ, 〜たら
and their like (201 of 486 misses over the catalogue's own example
sentences), while still letting through 天気がいいです as 〜気がする,
because 「気が」 really is a substring of 天気が.

Three things replace it, all of them things morphology.tokenize and the
catalogue already know:

1. **A hit must land on word boundaries.** It ends where a token ends,
   and begins where one begins -- or inside an INFLECTING token, since a
   pattern attaches to a conjugated stem: 大きくて is one token 大きく
   plus て, and 〜くて begins in the middle of it. A noun is not
   inflecting, so 天気 is never half of a grammar point.

2. **Every part of a multi-part pattern must be there.** から〜まで needs
   まで as well as から; もう〜ました needs もう. The old matcher kept the
   longest piece and dropped the rest, so もう〜ました fired on every
   sentence in the catalogue that ends in ました -- 137 of them.

3. **A point looks the way its own examples look.** Plan 087's catalogue
   gives every point three to five hand-written sentences that use it.
   Tokenize those and you learn what part of speech the point is
   realized by: 〜なり is a particle なり, so the verb なり in
   先生になりました is not it; 〜とき is the noun とき, and finding that
   noun IS the point. The catalogue teaches the matcher, which means a
   point written next year comes with its own detection rules attached
   and nothing here has to be updated.

A point whose own examples do not show it to this matcher keeps the old
behaviour (a distinctive stem, matched as before), so nothing that used
to be found is lost while those lessons are written.

The second pass: by dictionary form (plan 095)
----------------------------------------------
What a substring cannot see, the tokenizer already knows: すぎ in
食べすぎました is the verb すぎる, み in 見てみます is the verb みる,
られ in 褒められました is the auxiliary られる, and 読める is the verb
読む conjugating as 下一段 -- which is what the potential IS. So a
pattern's tail is also looked for as the dictionary form of a token
rather than as letters, and every conjugation of it is found at once.
Two shapes of tail, read off the pattern itself:

- **stem**: 〜すぎる, 〜たいです, 〜やすい, 〜始める. The tail's own
  tokens, by dictionary form, on a token that stands right after a verb
  or adjective stem and is grammaticalised there (an auxiliary, a
  suffix, or a verb UniDic marks 非自立可能). 三時を過ぎました is not
  〜すぎる: 過ぎ follows a particle, not a stem.
- **te**: 〜てみる, 〜ておく, 〜ていく. The conjunctive て／で, then the
  tail's verb by dictionary form. 映画を見ます is not 〜てみる.

And a table for the FORM points, whose surface is a conjugation the
tokenizer names rather than a string: the passive and causative
auxiliaries, the potential (a verb conjugating as 下一段 whose
dictionary form is not), the volitional and the imperative (the form's
own name on the token). For a る-verb the passive and the potential are
one shape (食べられる), and both are reported on it: the catalogue says
so itself, in each lesson's row about the other, and a span cannot
choose between two points written the same way (see _detect).

Every rule is held to the point's own lessons, as rule 3 above is: a
rule that cannot find its point in at least one of the point's example
sentences is not trusted on anyone else's. The examples are read only
once a rule has a candidate in hand, so the first analysis after a boot
still tokenizes nothing it does not need.

Measured over the catalogue's own 2,169 example sentences: the point a
sentence was written for is found in 92% of them (90% before the second
pass, 78% for the substring matcher before that), and 517 of the 541
points are found in at least one of their own lessons (510 before).

Plan 149: every key a sentence holds
------------------------------------
Measured on 4,000 of JMdict's example sentences -- real Japanese, not
the catalogue's own -- only 71% of the particles and auxiliaries were
covered by any point. Now 96%, and the catalogue's own examples 98%
(from 83%), with recall on the lessons up from 92% to 94%. What changed:

- **What a point attaches to, by kind of word** (_attaches): a lesson
  that shows a noun admits a pronoun, a suffix, a 形状詞, and for a
  particle a phrase closed by a case particle (彼は, 私たちは, では); a
  lesson that shows a verb admits an auxiliary after one.
- **The final word's own conjugations** (_conjugations) replace the
  cuts that dropped ない, なる, ある, する and いる: 〜になる in なった,
  〜気がする in 気がした, 〜はずがない as はずがありません.
- **Rules by what the tokenizer names**: the copula's forms (だった,
  ではない, 高いです), 〜んだ in every register, 〜に行きます with 来る
  and 帰る, a lone linking て, から and まで alone, な-adjectives and an
  い-adjective's forms, the spoken short forms (てる, ちゃう, とく), and
  the two points plan 149 added to N5: た形 〜た and ない形 〜ない.
- **Senses the lessons show apart are taught** (_shadowed, _joins): the
  に of しずかに is the adverbial form, the が of 雨だが the "but" --
  told by part of speech and by whether the particle is conjunctive.
- **Guards**: a multi-part point stays in one clause (_one_clause), the
  で of である is the copula's, a question word's か is "some", and the
  letters of a word the catalogue files whole (何か, でも) are its own.

Plan 150: no false key
----------------------
A key it misses is a rule left untaught; one it invents is a lesson the
learner believes. Read over the same 6,900 sentences (the lessons, the
reading and dictation banks, 4,000 of JMdict's), plan 150 took out 355
hits that were not the point they named and moved 121 spans onto the
words they belong to, with coverage unchanged (96% of JMdict's
particles and auxiliaries, 98% of the lessons'). Every rule is in
tests/test_grammar_precision.py, with a gold set held exactly:

- **The kind of word a hit ends in** (_tail): a hit that stops inside a
  word must end on the kind of word its lessons end on. The でも of
  学校でもらった is で and the first letter of もらった; the たところで
  of 終わったところです, the にしては of 口にしてはばからない and the
  そうにない of 失いそうになった went the same way.
- **Particles the tokenizer cannot tell apart** (_REFUSALS): でも, とは
  and とか are two particles each wherever they stand. 〜でも is not
  after a question word (誰でも is "anyone", the N4 point 何でも／誰でも
  ／いつでも／どこでも added for it), a place (ここでも), before the
  copula's ある／ない (外交官でもあった) or opening a sentence ("but");
  〜とは is surprise after a clause only with what says so (驚いた, a
  PAST 思わなかった) and a definition after a noun only where the
  sentence says what the thing is (彼とは is "with him"); 〜とか and the
  particles of 何とか and 何とも are a word's letters.
- **A point in several parts**: each short part a word of its own, never
  letters of one (the が of さわがない, the て of 立てて); the tightest
  reading, each part used once (コーヒー[か]紅茶[か], not the question's
  か); 〜は〜が never on the "but" が or across a closed clause; every て
  of 〜て、〜て but the last a link _te_link_spans would light alone.
- **Forms by what the tokenizer names**: the plain 〜そうだ of how a thing
  looks, told from hearsay by the stem in front of it; a construction
  ending in its negative (かもしれない, てはいけない) takes in its ない;
  a point its lessons show opening a sentence opens the next one too.

What it still cannot see
------------------------
Four kinds of point, all of them refusals rather than misses:

- A point that names a CLASS with no conjugation to read: い形容詞／な形容詞,
  自動詞／他動詞. There is no string to look for and no form to name,
  and "this sentence contains an adjective" is not a lesson anyone
  needs pointed out.
- A point the catalogue itself marks as a SENSE: 〜を（移動）is を with a
  verb of movement and 〜そうだ（伝聞）is そうだ meaning "I hear that".
  Each has a plain sibling written identically, and the parenthesis is
  the catalogue saying the difference is one of meaning. The plain
  sibling is reported; the qualified one waits for a reader that
  understands the sentence.
- A point whose surface is an ordinary word (AMBIGUOUS, below): 〜上に
  is 上 + に, and so is 山の上に.
- A particle the tokenizer calls the copula's (plan 150): 平和に is "for
  peace" before 役立つ and "peacefully" before 暮らす, and to the
  tokenizer both are だ's に. Neither is lit.

Without morphology (fugashi/unidic-lite absent -- see
morphology.MORPHOLOGY_AVAILABLE) none of the rules is possible, and the
module falls back to exactly the old substring rule. Detection
degrades; it does not vanish.
"""
import logging
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from study import morphology
from study.grammar_match import alternatives, stems

logger = logging.getLogger(__name__)

LEVELS = ("N5", "N4", "N3", "N2", "N1")

# Points whose surface is a common word in its own right, where no
# amount of tokenizing separates the point from the word: 〜上に is
# 上(noun) + に(particle) and so is 山の上に, 〜ものを is 買いものを,
# 別に〜ない reduces to 別に which 特別に contains. The distinction is
# semantic, so it is not drawn rather than drawn wrongly. difficulty.py
# imports this list for its own gate -- one list, not two.
AMBIGUOUS: frozenset[str] = frozenset({
    "〜にして", "〜あまり", "〜上で", "〜出す", "〜直す", "〜にあって",
    "〜上に", "〜ものを", "別に〜ない",
})

# A pattern attaches to a word that conjugates, so a hit may begin
# inside one of these -- 〜くて inside 大きく, 〜てしまう inside 食べ.
# It may never begin inside anything else: a noun, a pronoun or an
# adverb is a word, not a stem with a grammar point growing off it.
_INFLECTING = frozenset({"verb", "adjective", "auxiliary"})

# Punctuation and spacing a pattern is written with but a sentence does
# not have to match on: 〜て、〜て is two て, the comma is typography.
_TRIM = "、。，・ 　　"


def _parts(pattern: str) -> list[tuple[tuple[str, ...], ...]]:
    """One entry per way the pattern may be written; each entry is the
    sequence of parts that must ALL appear, in order, each part given as
    the surfaces it may take.

    〜てください  -> [(("てください", "でください", "てくださ", …),)]
    から〜まで    -> [(("から", …), ("まで", …))]
    〜てあげる／〜てくれる -> one entry per alternative.
    """
    out = []
    for alt in alternatives(pattern):
        pieces = [p.strip(_TRIM) for p in alt.split("〜")]
        # stems() stops at two characters, where a substring stops being
        # evidence on its own. A one-character PATTERN is not a
        # substring guess though -- 「は」 is a point in the catalogue,
        # and on a tokenized sentence it is a particle token or it is
        # nothing -- so it keeps itself as its own needle.
        needles = [_needles(p) for p in pieces if p]
        if needles and all(needles):
            out.append(tuple(needles))
    return out


def _sense(pattern: str) -> bool:
    """Whether the pattern names a sense in a full-width parenthesis
    (〜を（移動）, 〜な（禁止）) -- not an optional letter in an ASCII one
    (可能形 〜(ら)れる, 〜なくして(は)), which _qualified also counts."""
    return "（" in pattern


def _qualified(pattern: str) -> bool:
    """Whether the pattern names a SENSE rather than a surface: 〜を（移動）
    is を with a verb of movement, 〜そうだ（伝聞） is そうだ meaning "I
    hear that". The parenthesis is the catalogue telling us the
    distinction is one of meaning — and every one of these has a plain
    sibling written the same way (を, 〜そうです), which is why the
    qualifier is there at all."""
    return "（" in pattern or "(" in pattern


# 連用形: the form a verb takes before ます, and the one a pattern
# written in the dictionary form actually appears in half the time --
# 〜くなる is 大きくなりました, まいる is まいります. A truncation
# (なる -> な) would match those too, and match everything else with it.
_RENYOKEI = {"う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち",
             "ぬ": "に", "ぶ": "び", "む": "み", "る": "り"}


# ── The final word's own conjugations (plan 149) ────────────────
# stems() finds a conjugated pattern by cutting its letters: the final
# う-row mora (ことになる -> ことにな) and whole trailing words it takes
# for politeness (ます, です). It also cuts ない, なる, ある, する and いる
# as if they were politeness, and for a pattern those words ARE the
# meaning: 〜ことはない became ことは (言いたいことは), 〜ことがある ことが,
# 〜気がする 気が (気がついたら), 〜ことになる ことに. And a cut keeps what
# is left of the word, so the forms a cut cannot reach went unseen:
# 〜になる in なった (なっ), 〜気がする in 気がした (し), 〜に行きます in
# 行った. The final word is conjugated instead, by its class as the
# tokenizer names it, and the cuts that drop a whole meaning word go.
_GODAN = {  # row -> 連用形, 音便, 未然形, 仮定形/命令形, 意志 (…う)
    "カ行": ("き", "い", "か", "け", "こ"), "ガ行": ("ぎ", "い", "が", "げ", "ご"),
    "サ行": ("し", "し", "さ", "せ", "そ"), "タ行": ("ち", "っ", "た", "て", "と"),
    "ナ行": ("に", "ん", "な", "ね", "の"), "バ行": ("び", "ん", "ば", "べ", "ぼ"),
    "マ行": ("み", "ん", "ま", "め", "も"), "ラ行": ("り", "っ", "ら", "れ", "ろ"),
    "ワア行": ("い", "っ", "わ", "え", "お"),
}
_MEANING_WORDS = frozenset({"ない", "なる", "ある", "する", "いる"})


@lru_cache(maxsize=4096)
def _conjugations(piece: str) -> tuple[str, ...]:
    """The piece with its final verb or adjective in each of its other
    forms (なる -> なり, なっ, なら, なれ, なろ), or () where the piece does
    not end in one in its dictionary form. 行く is the one 五段-カ行 verb
    whose て-form is 行って."""
    if not morphology.MORPHOLOGY_AVAILABLE or not piece:
        return ()
    # A piece that begins inside a word (くなる grows out of 大きく) is read
    # behind a stand-in for that word, or alone it tokenizes as nonsense.
    for stand_in in ("", "本", "大き", _DUMMY_STEM):
        tokens = morphology.tokenize(stand_in + piece)
        if not tokens:
            continue
        last = tokens[-1]
        word = last.surface
        if (last.cform.startswith("終止形") and piece.endswith(word)
                and last.pos in ("verb", "adjective", "auxiliary")):
            break
    else:
        return ()
    head, ctype = piece[: len(piece) - len(word)], last.ctype
    forms: list[str] = []
    if ctype.startswith("五段") and "-" in ctype:
        endings = _GODAN.get(ctype.split("-", 1)[1])
        if endings:
            forms = [word[:-1] + e for e in endings]
            if last.lemma == "行く":
                forms.append(word[:-1] + "っ")
    elif ctype.startswith(("上一段", "下一段")):
        forms = [word[:-1], word[:-1] + "れ", word[:-1] + "ろ"]
    elif ctype == "サ行変格" and word.endswith("する"):
        forms = [word[:-2] + e for e in ("し", "さ", "せ")]
    elif ctype == "カ行変格":
        forms = [word[:-1]] if word.endswith("来る") else [word[:-2] + e for e in ("き", "こ")]
    elif ctype == "形容詞" or ctype.startswith(("助動詞-ナイ", "助動詞-タイ")):
        forms = [word[:-1] + e for e in ("く", "かっ", "けれ")]
    out = [head + f for f in forms]
    if word == "ない":
        out += _polite_negative(tokens, head, ctype)
    if piece[:1] in "てた":
        # Voiced after ん and い音便 (読んで, 死んだ), as stems() voices.
        out += [("で" if piece[0] == "て" else "だ") + f[1:] for f in out]
    return tuple(dict.fromkeys(out))


def _polite_negative(tokens, head: str, ctype: str) -> list[str]:
    """A pattern ending in ない, as polite speech says it: ない after a
    noun or a particle is ありません (〜はずがありません, 〜に違いありません),
    and after a verb it is the verb's 連用形 + ません (〜ないといけません is
    いけ + ません, 〜てはならない なり + ません). The cut that used to find
    these took the ない off, and with it the negation (plan 149)."""
    if not head:
        # ない as a part on its own (〜しか〜ない's second half): after a
        # noun ありません, after a verb ません (水しか飲みません).
        return ["ありません", "ありませ", "ません"]
    if not ctype.startswith("助動詞-ナイ"):
        return [head + "ありません", head + "ありませ"]
    if len(tokens) < 2 or tokens[-2].pos != "verb":
        return []
    verb = tokens[-2]
    if not head.endswith(verb.surface):
        return []
    stem = head[: len(head) - len(verb.surface)]
    vtype = verb.ctype
    if vtype.startswith(("上一段", "下一段")) or vtype == "サ行変格":
        renyo = verb.surface
    elif vtype.startswith("五段") and "-" in vtype and vtype.split("-", 1)[1] in _GODAN:
        row = _GODAN[vtype.split("-", 1)[1]]
        if not verb.surface.endswith(row[2]):
            return []
        renyo = verb.surface[:-1] + row[0]
    else:
        return []
    # And ありません beside it: さしつかえない is 差し支える + ない to the
    # tokenizer and 差し支え + ない to a writer (さしつかえありません), as
    # is 違いない (違いありません).
    return [stem + renyo + "ません", stem + renyo + "ませ", head + "ありません", head + "ありませ"]


def _drops_meaning(full: str, cut: str) -> bool:
    """Whether a cut of `full` removed a whole word the pattern means --
    ない, なる, ある, する or いる -- rather than politeness or the copula."""
    return full.startswith(cut) and full[len(cut):] in _MEANING_WORDS


def _needles(piece: str) -> tuple[str, ...]:
    """The surfaces one part of a pattern may take.

    stems() gives the citation form and the truncations that survive
    inflection (〜てしまう -> てしまう, てしま). A TRUNCATION has to stay
    distinctive to be worth matching: もうす truncates to もう, which is
    the adverb in もう暗くなった and nothing to do with the humble verb;
    います truncates to いま, which is inside しまいました. The citation
    form itself is never held to that -- 「は」 and 「〜し」 are patterns
    two characters long and one character long, and a sentence writes
    them exactly as the catalogue does.
    """
    full = piece.strip()
    found = [full] if full else []
    if len(full) >= 3 and full[-1] in _RENYOKEI:
        found.append(full[:-1] + _RENYOKEI[full[-1]])
    found += [c for c in _conjugations(full) if _distinctive(c)]
    found += [n for n in stems(piece) if n != full and _distinctive(n) and not _drops_meaning(full, n)]
    return tuple(dict.fromkeys(found))


@lru_cache(maxsize=1)
def _catalogue() -> tuple[tuple[str, str, tuple, tuple], ...]:
    """(level, pattern, parts, examples) for every point worth looking
    for. Built once from the catalogue; `examples` rides along so a
    point's own sentences can teach the matcher what it looks like.

    A sense-qualified point written with a plainer point's surface
    (〜を（移動） and を are both を) is kept since plan 149, and yields
    to the plain one wherever both land on the same span (_shadowed):
    nothing in the text says which を is meant, and claiming both puts
    two chips on one particle, one of them a guess. Where the lessons
    show the two apart -- the に of しずかに is the copula's adverbial
    form and the plain に a particle after a noun; the "but" が follows a
    clause and the subject が a noun -- only one of them can match, and
    the sense the sentence shows is taught. Until plan 149 the
    qualified point was dropped outright, and しずかに had no rule."""
    entries = []
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            pattern = point.get("pattern", "")
            if not pattern or pattern in AMBIGUOUS:
                continue
            parts = _parts(pattern)
            if not parts:
                continue
            examples = tuple(
                ex.get("jp", "") for ex in point.get("examples", []) if ex.get("jp")
            )
            entries.append((level, pattern, tuple(parts), examples))

    return tuple(entries)


def _needle_set(parts) -> set[str]:
    return {n for alt in parts for part in alt for n in part}


def _apart(q_shape, p_shape) -> bool:
    """Whether two points' lessons show them as different words: every
    pair of their spellings differs in what the point is (heads) or in
    the kind of word it follows. A shape with nothing learned shows
    nothing apart."""
    if not q_shape or not p_shape:
        return False
    for q_heads, q_befores, *_q in q_shape:
        for p_heads, p_befores, *_p in p_shape:
            if not q_heads or not p_heads:
                return False
            if q_heads & p_heads and _befores_kinds(q_befores) & _befores_kinds(p_befores):
                return False
    return True


def _joined_apart(q_level: str, q: str, p_level: str, p: str) -> bool:
    """Whether every spelling of one is a conjunctive particle and every
    spelling of the other a case particle (_joins)."""
    qj, pj = set(_joins(q_level, q)), set(_joins(p_level, p))
    return (qj == {"conj"} and pj == {"case"}) or (qj == {"case"} and pj == {"conj"})


def _befores_kinds(befores) -> set[str]:
    return {"nominal" if b in _NOMINAL else "predicate" if b in ("verb", "adjective", "auxiliary") else b
            for b in befores} - {""}


@lru_cache(maxsize=1)
def _shadowed() -> frozenset[str]:
    """The sense-qualified points written with a plainer point's surface
    whose lessons do not show them apart from it (see _catalogue): 〜を
    （移動） and を, 〜で（理由） and で, 〜て（理由） and 〜て、〜て. Each
    is never reported, as before plan 149. A qualified point its lessons
    DO show apart (〜く／〜に（副詞形）, 〜が（逆接）) is kept, and yields
    only on a span a plain point holds too."""
    entries = _catalogue()
    # A sibling shares the sense point's surface: a point written in one
    # piece with a spelling in common, or one in several pieces that are
    # all the sense point's own (〜て、〜て is て twice). 〜は〜が is not
    # 〜が（逆接）'s: its は is no part of that point.
    plain = [(level, pattern, parts) for level, pattern, parts, _ex in entries if not _qualified(pattern)]
    out = set()
    for level, pattern, parts, _ex in entries:
        if not _sense(pattern) or pattern in _RULE_ONLY:
            # (A point read by its rule alone is never a guess at letters.)
            continue
        needles = _needle_set(parts)

        def sibling(p_parts) -> bool:
            if all(len(alt) == 1 for alt in p_parts):
                return bool(_needle_set(p_parts) & needles)
            return all(set(part) & needles for alt in p_parts for part in alt)

        siblings = [(lv, p) for lv, p, pp in plain if sibling(pp)]
        if any(not _apart(_shape(level, pattern), _shape(lv, p)) and not _joined_apart(level, pattern, lv, p)
               for lv, p in siblings):
            out.add(pattern)
    return frozenset(out)


def _distinctive(needle: str) -> bool:
    """The old rule, kept for the points whose own examples cannot teach
    this matcher anything: a two-character all-hiragana needle is not
    evidence on its own. 〜なり reduces to なり, which is inside every
    ...になりました."""
    return len(needle) >= 3 or any(not ("぀" <= c <= "ゟ") for c in needle)


def _find_all(text: str, needle: str) -> list[int]:
    out, at = [], text.find(needle)
    while at != -1:
        out.append(at)
        at = text.find(needle, at + 1)
    return out


def _anchored(start: int, end: int, starts: set[int], ends: set[int],
              inside: dict[int, str], word_start: dict[int, int]) -> bool:
    """Whether a span sits on word boundaries — rule 1 above.

    Either end of a hit may fall inside an INFLECTING word, and only
    inside one: a pattern is written in a citation form that a real
    sentence conjugates at both ends. 〜くて begins inside 大きく;
    〜てしまう ends inside しまい (なくしてしまいました); 〜くなる does
    both at once (大きくなりました). A noun is not inflecting, which is
    what makes 天気がいい not 〜気がする.

    The one thing a hit may never be is the FRONT OF A SINGLE WORD --
    starting where a word starts and stopping inside that same word. It
    would be reading half a word and calling it a pattern: the で of
    です is not the で of 〜くて／〜で, and です is not two things.
    """
    if start not in starts and inside.get(start, "") not in _INFLECTING:
        return False
    if end in ends:
        return True
    if inside.get(end, "") not in _INFLECTING:
        return False
    return word_start.get(end, -1) > start


@lru_cache(maxsize=4096)
def _shape(level: str, pattern: str) -> tuple[tuple[frozenset[str], frozenset[str], bool, frozenset[str], frozenset[str]], ...]:
    """What the point looks like in its own example sentences — rule 3.

    One entry per spelling the point may be written in (〜くなる／〜になる
    is two), because a point's spellings do not behave alike: 〜になる
    stands on its own に and attaches to a noun, while the 〜くなる
    beside it grows out of the adjective in front of it. Each entry is
    (the parts of speech the spelling is realized BY, the parts of
    speech it attaches TO, whether it always stands on a word of its
    own, the meaning-bearing forms the word it ends in is seen in --
    "" for plain inflection -- and the parts of speech of the word it
    ends in, plan 150).

    The first two are sets rather than the pairs they were read from:
    four example sentences cannot enumerate every context a point occurs
    in, and a pair not among them would be a miss rather than a
    judgement. Each half on its own is what the catalogue's `structure`
    line says in prose — 「noun + の + noun」 is the possessive の,
    attached to a noun; 「verb dictionary form + の」 is the nominalizer,
    attached to a verb. Same particle, and the word in front of it is
    the difference, which is exactly what separates わたしのかさ from
    走るのが好き.

    An entry of empty sets means "nothing to check against" — no
    morphology when the lessons were read, or a lesson whose sentences
    conjugate past what this matcher can follow — not "nothing
    allowed"; see _shaped.
    """
    entry = _by_name().get((level, pattern))
    if entry is None:
        return ()
    _, _, parts, examples = entry

    # Read without a shape to check against — there is none yet; this is
    # where one comes from — so an example can hand back a second,
    # accidental hit beside the one it was written for.
    seen: list[list[tuple[bool, str, str, str, int]]] = [[] for _ in parts]
    tails: list[list[tuple[bool, str, str, str, int]]] = [[] for _ in parts]
    for index, sentence in enumerate(examples):
        tokens = morphology.tokenize(sentence)
        if not tokens:
            continue
        starts = {t.start for t in tokens}
        for start, end, pos, _c, spelling, _segments in _hits(sentence, tokens, parts):
            seen[spelling].append((start in starts, pos, _before(start, tokens), _ending(end, tokens), index))
            tails[spelling].append((start in starts, _tail(end, tokens), "", "", index))

    out = []
    for signatures, ends in zip(seen, tails):
        # When the lessons show a spelling standing on a word of its
        # own, that is what it is, and whatever the same needle also hit
        # inside some other word is that sentence's coincidence: the し
        # of なくして is not the 〜し that lists reasons.
        standing = [sig for sig in signatures if sig[0]]
        kept = standing or signatures
        # Every signature they show, not the ones they agree on: a
        # pattern that attaches to a noun in one sentence and a verb in
        # the next is not in disagreement with itself. Holding them to a
        # majority was measured against the catalogue and cost six
        # points of recall to shave a twentieth off the false hits — the
        # wrong way round for a breakdown, where a missing rule is a
        # rule left untaught. The one exception is a coincidence that
        # stands on a word of its own (_without_coincidences).
        out.append((
            _without_coincidences(kept),
            frozenset(before for _s, _h, before, _e, _i in kept),
            bool(kept) and all(stood for stood, _h, _b, _e, _i in kept),
            # The form the word the hit ends in is in, where that form
            # means something: 〜てください ends in ください, the
            # imperative, in every lesson, and 教えてくださいました
            # ends in the same verb in the 連用形 -- the honorific,
            # which is 〜てくださる's lesson and not this one's.
            frozenset(ending for _s, _h, _b, ending, _i in kept),
            # The kind of word it ends in (plan 150): the lessons of
            # 〜でも end on も, a particle, and the でも of 学校でもらった
            # ends inside もらった, a verb -- で, and the first letter of
            # the next word.
            _without_coincidences([e for e in ends if e[0]] or ends),
        ))
    return tuple(_pooled(out))


@lru_cache(maxsize=4096)
def _joins(level: str, pattern: str) -> tuple[str, ...]:
    """Per spelling, what kind of particle the point is when its lessons
    show it as one (plan 149): "conj" where every lesson has it as a
    conjunctive particle (接続助詞: the "but" が of 雨だが, the
    conditional と, the "because" から), "case" where none does (the
    subject が, "and" と, "from" から), "" where it is no particle or the
    lessons show both. The tokenizer tells the two apart, and they are
    different words spelled alike."""
    entry = _by_name().get((level, pattern))
    if entry is None:
        return ()
    _, _, parts, examples = entry
    seen: list[list[tuple[bool, int, str]]] = [[] for _ in parts]
    for index, sentence in enumerate(examples):
        tokens = morphology.tokenize(sentence)
        if not tokens:
            continue
        first = {t.start: t for t in tokens}
        for start, _end, pos, _c, spelling, _segments in _hits(sentence, tokens, parts):
            token = first.get(start)
            if pos == "particle" and token is not None:
                seen[spelling].append((True, token.conjunctive, index))
    # A reading one lesson shows only beside the other is that
    # sentence's coincidence, as _without_coincidences rules for parts
    # of speech: 行きたいですが、お金がありません has a subject が too.
    out = []
    for signatures in seen:
        kinds = _without_coincidences([(s, str(conj), "", "", i) for s, conj, i in signatures])
        out.append("conj" if kinds == {"True"} else "case" if kinds == {"False"} else "")
    return tuple(out)


def _pooled(shapes):
    """Each spelling's shape, with the words it may attach to shared
    among the spellings that are the same kind of word.

    です／だ is one point in two registers, and its lessons show the
    polite spelling four times and the plain one once -- after しずか.
    Read apart, だ learned that it follows a na-adjective and nothing
    else, and 夜だ, 学生だ, every plain sentence ending in a noun, had no
    copula. Where two spellings are realized by the same parts of speech
    and stand the same way, they are the same word written two ways, and
    what one attaches to the other may too. Spellings that are different
    kinds of word keep their own: 〜になる stands on its own に after a
    noun, while 〜くなる grows out of the adjective in front of it.
    """
    return [
        (heads, befores.union(*(b for h, b, s, *_r in shapes if h == heads and s == stands))
         if heads else befores, stands, endings, tails)
        for heads, befores, stands, endings, tails in shapes
    ]


def _without_coincidences(kept) -> frozenset[str]:
    """The parts of speech a spelling is realized by, less the ones a
    lesson shows only by accident.

    安いし、近いし、この店にします。 shows 〜し as the particle it is
    twice, and once more as the し of します -- a verb, standing on a
    token of its own, so the rule above does not catch it. Learned, it
    taught the matcher that 〜し may be the し of any する, and
    食べようとしました was listing reasons. A reading seen in one lesson
    only, and there only beside another reading of the same point, is
    that sentence's coincidence: the sentence was written to show the
    point, and it shows it in the other reading. A reading seen in two
    lessons, or alone in one, is the point's -- which keeps a point
    that really is realized two ways (a particle in one sentence, an
    auxiliary in the next), and costs nothing measured over the
    catalogue.
    """
    sentences_of: dict[str, set[int]] = {}
    readings_in: dict[int, set[str]] = {}
    for _stood, pos, _before, _ending, index in kept:
        sentences_of.setdefault(pos, set()).add(index)
        readings_in.setdefault(index, set()).add(pos)
    return frozenset(
        pos for pos, sentences in sentences_of.items()
        if len(sentences) >= 2 or any(readings_in[i] == {pos} for i in sentences)
    )


@lru_cache(maxsize=1)
def _by_name() -> dict[tuple[str, str], tuple]:
    return {(e[0], e[1]): e for e in _catalogue()}


def _ending(end: int, tokens) -> str:
    """The form of the word a hit ends in, where the form carries a
    meaning of its own (_MEANING_FORMS): the imperative, the
    volitional. "" for any other, which is inflection."""
    for t in tokens:
        if t.start < end <= t.end:
            head = _form_head(t.cform)
            return head if head in _MEANING_FORMS else ""
    return ""


def _tail(end: int, tokens) -> str:
    """The part of speech of the word a hit ends in: the token holding
    its last letter."""
    for t in tokens:
        if t.start < end <= t.end:
            return t.pos
    return ""


_OPENERS = frozenset("「『（(【〈《")


def _before_token(start: int, tokens):
    """The word a hit attaches to — the last token ending at or before
    it starts, looking past a closing quote or bracket (「犯人」が is a
    noun and が, the 」 is typography) — or None at a sentence's start."""
    found = None
    for t in tokens:
        if t.end > start:
            break
        if t.pos == "symbol" and t.surface in _CLOSERS:
            continue
        found = t
    return found


def _before(start: int, tokens) -> str:
    """The part of speech of the word a hit attaches to (_before_token).

    "" when there is no such word, which is a sentence beginning rather
    than a context: 「食べようとしました」 as a fragment has nothing in
    front of 食べよう, and the point is no less present for it. The
    caller reads "" as "nothing to check" rather than as a shape of its
    own, or a lesson's four examples — all of them whole sentences with
    a subject — would rule out the fragment a learner actually typed.
    """
    token = _before_token(start, tokens)
    return token.pos if token is not None else ""


# ── What a point attaches to, by kind of word (plan 149) ─────────
# A lesson's four or five sentences name the parts of speech a point
# was SEEN after, and until plan 149 that list was the whole of what it
# could attach to: は had been seen after a noun, so 彼は (a pronoun),
# 私たちは (たち is a suffix) and では (a particle) had no は. Measured
# over 4,000 of JMdict's example sentences, the basic particles lost
# ~1,900 occurrences that way, the commonest miss after the plain past.
# A lesson that shows a noun shows a KIND of word, and the kind is what
# is checked now -- a noun, a pronoun, a suffix (たち, さん, 年) and a
# 形状詞 (a な-adjective's stem, "other" to morphology) are one kind.
#
# Two more readings, each narrower than the kind it opens:
#
#   * a phrase closed by a case particle is a noun phrase to a point
#     that is itself a particle -- 東京からの, 学校では, だけを -- and to
#     nothing else: 天気は次第に is not 〜次第だ.
#   * a lesson that shows a verb admits an auxiliary after one (食べたの,
#     施行されます, 行かれれば). Never the other way: 〜ことがある's
#     lessons show it after た, and 助けあうことが is not it.
#
# What stays exact: an adjective (近いところ is a place, not
# 〜ところだ), and a conjunctive particle, which ends a verb phrase a
# point after it is usually its own construction's (てから, ても). A
# sentence-final particle may follow another (よね, かな).
_NOMINAL = frozenset({"noun", "pronoun", "suffix", "other"})
_FINAL_PARTICLES = frozenset({"よ", "ね", "な", "わ", "さ", "ぞ", "ぜ"})
_CLOSERS = frozenset("」』）)】〉》\"'”’")
_COMMAS = frozenset("、，,")


def _is_final_hit(start: int, tokens) -> bool:
    """Whether the particle at `start` is one of the sentence-final set
    and nothing but more particles and marks follows it."""
    after = False
    for t in tokens:
        if t.start == start:
            if t.surface not in _FINAL_PARTICLES:
                return False
            after = True
            continue
        if after and t.pos not in ("particle", "symbol"):
            return False
    return after


def _attaches(start: int, tokens, befores, heads, exact: bool = False) -> bool:
    """Whether the word a hit attaches to is one its lessons allow (see
    above). `heads` is what the point itself begins with.

    A lesson that shows nothing in front (every example opens with the
    point) holds a conjunction to the start of a clause -- ところで,
    それから -- but not a pronoun, which is a word wherever it stands
    (何か, 誰も). A comma in front of a particle says nothing either
    way: the quotation's と comes after one (…だ、と言った).

    `exact` is for a point the catalogue marks as a sense (_qualified):
    〜な（禁止） is な after a verb's dictionary form, and the な of
    だろうな or よな is not it -- such a point keeps the very words its
    lessons show."""
    token = _before_token(start, tokens)
    if token is None or token.pos in befores:
        return True
    if "" in befores and token.pos == "symbol" and (token.surface in _SENTENCE_ENDS or token.surface in _OPENERS):
        # A point its lessons show opening a sentence opens the next one
        # too: the second もう of もう食べました。もう寝ました。, the その
        # of 「その本は…」 (plan 150). Not a point its lessons show only
        # AFTER a 。 -- それに, "moreover" -- which the text a 。 closes
        # has taught to stand there and nowhere else.
        return True
    if exact:
        # A な-adjective-like suffix (的) is a 形状詞 to a sense point too:
        # 全社的に is しずかに's に.
        return token.pos == "suffix" and "other" in befores
    particle_headed = heads <= {"particle", "auxiliary"}
    final = particle_headed and _is_final_hit(start, tokens)
    if final and (token.pos in ("verb", "adjective", "auxiliary") or token.pos == "particle"):
        # A sentence-final particle closes whatever predicate is in front
        # of it -- plain or polite (すぎるよ, いいね, 丸出しだぞ) -- or
        # follows another (よね, からね, てね).
        return bool(set(befores) & {"verb", "adjective", "auxiliary", "particle"})
    if token.pos == "symbol" and token.surface in _COMMAS:
        return particle_headed
    shown = set(befores) - {""}
    if not shown:
        return heads <= {"pronoun"}
    if token.pos in _NOMINAL:
        return bool(shown & _NOMINAL)
    if token.pos == "auxiliary":
        return "verb" in shown
    if token.pos == "particle" and particle_headed:
        if token.surface in _FINAL_PARTICLES:
            return bool(shown & {"verb", "auxiliary", "adjective"})
        if not token.conjunctive:
            return bool(shown & _NOMINAL)
    return False


def _hits(sentence: str, tokens, parts):
    """Every (start, end, pos-of-first-covered-token, contiguous,
    spelling, segments) at which `parts` are all present, in order, on
    word boundaries. `segments` is one (start, end) per part -- the
    pieces of the sentence the point is actually written on, which for
    から〜まで are から and まで and not the clause between them (see
    hits()). The shape test is the caller's (see _shaped): a point's
    own examples are read only when the point has actually matched
    something, which is what keeps the first analysis after a boot
    from tokenizing the whole catalogue."""
    starts = {t.start for t in tokens}
    ends = {t.end for t in tokens}
    # The part of speech of whatever token a position falls inside, and
    # where that token began, so a hit that starts or stops mid-word can
    # be judged on the word it is inside.
    inside = {}
    word_start = {}
    for t in tokens:
        for i in range(t.start, t.end):
            inside[i] = t.pos
            word_start[i] = t.start

    out = []
    for index, alt in enumerate(parts):
        # Each part in turn, each one starting after the last one ended;
        # a chain is the parts it has matched so far, as their spans.
        chains = [((), 0)]
        for needles in alt:
            nxt = []
            for segments, cursor in chains:
                for needle in needles:
                    for at in _find_all(sentence, needle):
                        if at < cursor:
                            continue
                        end = at + len(needle)
                        if not _anchored(at, end, starts, ends, inside, word_start):
                            continue
                        nxt.append((segments + ((at, end),), end))
            chains = nxt
            if not chains:
                break
        for segments, _cursor in chains:
            first, last = segments[0][0], segments[-1][1]
            # Contiguous when the pattern is written in one piece: a
            # multi-part one (もう〜ました) spans from its first part to
            # its last with a whole clause in between that it does not
            # own, which is why it never explains what it encloses.
            out.append((first, last, inside.get(first, ""), len(alt) == 1, index, segments))
    return out


def _shaped(sentence, tokens, level, pattern, parts):
    """`_hits`, then each hit held to the shape its own lessons show for
    the spelling it matched.

    A spelling whose examples taught nothing — no morphology when they
    were read, or a lesson whose sentences conjugate past what this
    matcher can follow — keeps the rule it had before: a distinctive
    needle, on word boundaries all the same. So a point can only gain by
    being written; it never loses what it already had.
    """
    found = _hits(sentence, tokens, parts)
    if not found:
        return []
    shape = _shape(level, pattern)
    starts = {t.start for t in tokens}
    ends = {t.end for t in tokens}

    exact = _sense(pattern)
    out = []
    for hit in found:
        start, end, pos, contiguous, spelling, _segments = hit
        if not contiguous and not _one_clause(sentence, _segments, pattern):
            continue
        if not contiguous and not all(_whole_function_word(tokens, a, b) for a, b in _segments
                                      if _short_kana(sentence[a:b])):
            # A part written in one or two kana is a particle or an
            # ending standing on its own, never letters of a word: the
            # て of たてなおした, 割り当て or 立てて is no link of
            # 〜て、〜て, the か of つかれる no choice of 〜か〜か (plan
            # 149).
            continue
        heads, befores, stands, endings, tails = (
            shape[spelling] if spelling < len(shape)
            else (frozenset(), frozenset(), False, frozenset(), frozenset())
        )
        if not heads and not befores:
            # Nothing to check a shape against, so the old rule stands —
            # but per HIT, on the text it actually matched. Held per
            # point instead, it passed まいる／もうす／いたす on the もう
            # of もう暗くなった, because another needle of the same point
            # was distinctive enough.
            if contiguous and not _distinctive(sentence[start:end]):
                continue
            out.append(hit)
            continue
        # A spelling its lessons always show on a word of its own is not
        # half a word here either: the し of なくして is not the 〜し
        # that lists reasons.
        if stands and start not in starts:
            continue
        if pos not in heads:
            continue
        # A hit that stops inside a word is reading that word's first
        # letters as the point's last ones, which is right only where the
        # point really ends in that kind of word: 〜てしまう in
        # なくしてしまいました ends inside a verb, as its lessons do; the
        # でも of 学校でもらった (で, then もらった) does not, since 〜でも
        # ends on the particle も (plan 150).
        if end not in ends and tails and _tail(end, tokens) not in tails:
            continue
        if "である" not in pattern and _ends_on_de_aru(tokens, end):
            # The で of である is the copula, not 〜ので's or 〜一方で's
            # (神髄なのである, 募る一方である).
            continue
        joins = _joins(level, pattern)
        join = joins[spelling] if spelling < len(joins) else ""
        if join and pos == "particle":
            token = next((t for t in tokens if t.start == start), None)
            if token is not None and token.conjunctive != (join == "conj"):
                continue
        if not _attaches(start, tokens, befores, heads, exact):
            continue
        if _ending(end, tokens) not in endings:
            continue
        out.append(hit)
    return out


_SENTENCE_ENDS = frozenset("。！？!?")
_CONTENT_POS = frozenset({"verb", "noun", "adjective", "pronoun"})


def _short_kana(text: str) -> bool:
    return 0 < len(text) <= 2 and all("\u3041" <= c <= "\u309f" for c in text)


def _whole_function_word(tokens, start: int, end: int) -> bool:
    """Whether start..end is whole words, each a function word: a
    particle, an ending, an adverb (もう, まだ) -- or the ない the
    tokenizer calls an adjective after one (高くない)."""
    inside = [t for t in tokens if start <= t.start and t.end <= end]
    if not inside or inside[0].start != start or inside[-1].end != end:
        return False
    return all(t.pos not in _CONTENT_POS or t.lemma in ("無い", "ない") for t in inside)


def _ends_on_de_aru(tokens, end: int) -> bool:
    for i, t in enumerate(tokens):
        if t.end == end:
            return _de_aru(tokens, i)
    return False


def _one_clause(sentence: str, segments, pattern: str) -> bool:
    """Whether a multi-part hit's parts stand in one clause: no sentence
    end between them, and no comma unless the pattern is written with
    one (〜て、〜て) or is made of particles alone, which a comma often
    separates (弟は今、漢字が読めます; 海もあれば、山もある). もう〜ない
    does not reach from もう始まっている。 to the next sentence's
    観られない, nor 〜に〜回 from に、 across the clause after it
    (plan 149)."""
    commas_ok = "、" in pattern or all(
        len(piece) <= 2 and all("\u3041" <= c <= "\u309f" for c in piece)
        for alt in alternatives(pattern) for piece in alt.split("〜") if piece
    )
    for (_s, a), (b, _e) in zip(segments, segments[1:]):
        between = sentence[a:b]
        if any(c in _SENTENCE_ENDS for c in between):
            return False
        if not commas_ok and any(c in _COMMAS for c in between):
            return False
    return True


def _legacy(sentence: str) -> list[tuple[str, str, int, int]]:
    """What this module did before it could tokenize: a distinctive
    substring, anywhere in the sentence. The fallback when morphology is
    unavailable, and the guard for a point whose examples teach nothing.
    """
    hits = []
    for level, pattern, parts, _examples in _catalogue():
        if pattern in _RULE_ONLY:
            continue
        for alt in parts:
            if len(alt) != 1:
                continue  # a multi-part pattern is never guessed at
            for needle in alt[0]:
                if not _distinctive(needle):
                    continue
                for at in _find_all(sentence, needle):
                    hits.append((pattern, level, at, at + len(needle)))
    return hits


# ── The second pass: by dictionary form (plan 095) ──────────────
# See the module docstring. Every rule here answers one question about
# a token the first pass cannot ask: what word is this, and in what
# form. Nothing here reads letters.

# Trailing politeness and tense a tail may or may not be written with
# (〜たいです is たい; 〜ました is ます + た), and the auxiliaries a tail
# may not consist of alone: a rule made of nothing but ます and た would
# claim 〜ました on every 食べます.
_TAIL_TRIM = frozenset({"です", "ます", "だ", "た", "ぬ", "ず"})
_TAIL_PURE = _TAIL_TRIM | frozenset({"ん"})
# A tail written in its dictionary form (〜すぎる, 〜たいです, 〜てみる) is
# found in any plain inflection -- that is what reading by dictionary
# form is for. A tail written in some other form is that form exactly:
# 〜べきだ, 〜べく and 〜べからず are one word べし in three forms and
# three lessons; 〜てください is ください, the imperative of くださる,
# and 〜てくださる the verb itself; 〜ましょうか is ましょう and not every
# ますか. The two forms that carry a meaning of their own are never
# "plain": a dictionary-form tail does not match a verb in the
# imperative or the volitional.
_MEANING_FORMS = frozenset({"命令形", "意志推量形"})
# Politeness and tense that force the word before them into the 連用形:
# い in ています is only 連用形 because ます follows. A tail's last word
# before one of these is found in any plain form.
_FORCES_RENYOKEI = frozenset({"ます", "た"})
# What a tail's first token may be for a stem rule to read it: a word
# that attaches to a stem. A noun (〜ことがある), a particle (〜ながら) or
# a 形状詞 (〜そうです) is the first pass's business.
_TAIL_POS = frozenset({"verb", "adjective", "auxiliary", "suffix"})
_INFLECTING_POS = frozenset({"verb", "adjective"})
_PASSIVE = frozenset({"れる", "られる"})
_CAUSATIVE = frozenset({"せる", "させる"})


# The stem a tail is read on. A tail tokenized on its own is read as a
# word: たい alone is the fish, やすい the adjective "cheap". On a stem
# it is what the pattern means it to be.
_DUMMY_STEM = "食べ"


def _form_head(cform: str) -> str:
    """UniDic's form without its variant: 連用形-イ音便 is 連用形."""
    return cform.split("-", 1)[0]


def _form_required(token) -> str:
    """What a sentence token's form must be for this tail token: "" for
    any plain inflection when the tail is written as its own dictionary
    form (すぎる, たい, みる -- or a word that does not conjugate), the
    form itself otherwise (べき is not べし, ください is not くださる).
    Judged on the reading rather than on UniDic's form name: a verb
    ending a bare fragment is tagged 連体形, and 食べる's 終止形 and
    連体形 are the same word either way."""
    return "" if token.reading == token.lemma_reading else _form_head(token.cform)


def _form_fits(token, required: str, relaxed: bool = False) -> bool:
    """Whether a sentence token's form fits what a tail asks of it. A
    dictionary-form tail ("") takes any plain inflection, and with
    `relaxed` the imperative and the volitional too (_form_hits decides
    when that reading stands)."""
    head = _form_head(token.cform)
    if required == "":
        return relaxed or head not in _MEANING_FORMS
    return head == required


def _tail_core(tail: str) -> tuple[tuple[str, str, str], ...] | None:
    """A tail as (pos, dictionary reading, required form) per token
    (_form_required), its trailing politeness and tense dropped -- or
    None where no stem rule may read it: a tail that does not start
    with a word that attaches to a stem, or one made of nothing but
    ます／です／た."""
    tokens = morphology.tokenize(_DUMMY_STEM + tail)
    if not tokens or tokens[0].surface != _DUMMY_STEM:
        tokens = morphology.tokenize(tail)
        if not tokens:
            return None
    else:
        tokens = tokens[1:]
    trimmed = None
    while tokens and tokens[-1].lemma_reading in _TAIL_TRIM and _form_head(tokens[-1].cform) not in _MEANING_FORMS:
        trimmed = tokens.pop().lemma_reading
    if not tokens or tokens[0].pos not in _TAIL_POS:
        return None
    required = [_form_required(t) for t in tokens]
    if trimmed in _FORCES_RENYOKEI and _form_head(tokens[-1].cform) not in _MEANING_FORMS:
        required[-1] = ""
    core = tuple((t.pos, t.lemma_reading, req) for t, req in zip(tokens, required))
    if all(reading in _TAIL_PURE and not req for _pos, reading, req in core):
        return None
    return core


@lru_cache(maxsize=1)
def _form_rules() -> dict[str, list[tuple[str, str, str, tuple[tuple[str, str, str], ...]]]]:
    """The stem and te rules, indexed by the dictionary reading a
    sentence must contain for the rule to have a candidate at all:
    reading -> [(level, pattern, "stem" | "te", core)]. Built once from
    the catalogue, which already leaves out the AMBIGUOUS points (see
    _catalogue); a sense-qualified point _shadowed() hides is dropped by
    _detect whichever pass found it."""
    index: dict[str, list] = {}
    for level, pattern, _parts, _examples in _catalogue():
        if pattern in _CLASS_RULES:
            continue
        for alt in alternatives(pattern):
            if "〜" in alt:
                continue  # a two-part pattern is the first pass's
            te = len(alt) > 1 and alt[0] in "てで"
            core = _tail_core(alt[1:] if te else alt)
            if core is None or (te and core[0][0] != "verb"):
                continue
            index.setdefault(core[0][1], []).append((level, pattern, "te" if te else "stem", core))
    return index


def _grammaticalised(token) -> bool:
    return token.pos in ("auxiliary", "suffix") or token.auxiliary_use


def _matches_core(tokens, i: int, core, relaxed: bool = False) -> int | None:
    """The end offset of the core's tokens standing at tokens[i], in
    order, each by dictionary reading -- or None."""
    if i + len(core) > len(tokens):
        return None
    for k, (_pos, reading, required) in enumerate(core):
        token = tokens[i + k]
        if token.lemma_reading != reading or not _form_fits(token, required, relaxed):
            return None
    return tokens[i + len(core) - 1].end


def _stem_spans(tokens, core, relaxed: bool = False) -> list[tuple[int, int]]:
    """A stem tail: its tokens, right after a verb or adjective, on a
    token grammaticalised there."""
    out = []
    for i in range(1, len(tokens)):
        if tokens[i - 1].pos not in _INFLECTING_POS or not _grammaticalised(tokens[i]):
            continue
        end = _matches_core(tokens, i, core, relaxed)
        if end is not None:
            out.append((tokens[i].start, end))
    return out


def _te_spans(tokens, core, relaxed: bool = False) -> list[tuple[int, int]]:
    """A te tail: the conjunctive て／で, then the tail's tokens."""
    out = []
    for i in range(1, len(tokens) - 1):
        te = tokens[i]
        if not (te.conjunctive and te.surface in ("て", "で")):
            continue
        end = _matches_core(tokens, i + 1, core, relaxed)
        if end is not None:
            out.append((te.start, end))
    return out


def _after_verb(tokens, i: int) -> bool:
    return i > 0 and tokens[i - 1].pos == "verb"


def _passive_spans(tokens):
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "auxiliary" and t.lemma_reading in _PASSIVE and _after_verb(tokens, i)]


def _causative_spans(tokens):
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "auxiliary" and t.lemma_reading in _CAUSATIVE and _after_verb(tokens, i)]


def _causative_passive_spans(tokens):
    return [(a.start, b.end) for a, b in zip(tokens, tokens[1:])
            if a.pos == "auxiliary" and a.lemma_reading in _CAUSATIVE
            and b.pos == "auxiliary" and b.lemma_reading in _PASSIVE]


def _ichidan_stem(reading: str, cform: str) -> str | None:
    """The stem of a 下一段 token from its reading and the form UniDic
    says it is in, or None for a form this does not follow."""
    if cform.startswith(("終止形", "連体形")):
        return reading[:-1] if reading.endswith("る") else None
    if cform.startswith(("連用形", "未然形")):
        return reading
    if cform.startswith("仮定形"):
        return reading[:-1] if reading.endswith("れ") else None
    if cform.startswith("命令形"):
        return reading[:-1] if reading[-1:] in ("ろ", "よ") else None
    if cform.startswith("意志推量形"):
        return reading[:-2] if reading.endswith("よう") else None
    return None


def _potential_spans(tokens):
    """The potential: a verb conjugating as 下一段 whose dictionary
    form is not (読める is 読む, 書けます is 書く, 帰れる is 帰る) -- and
    られる after a る-verb, which is the potential and the passive both,
    reported as both (module docstring). 見える is 見える, and stays a
    verb that means something is in view."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos == "verb" and t.ctype.startswith("下一段"):
            stem = _ichidan_stem(t.reading, t.cform)
            if stem is not None and stem + "る" != t.lemma_reading:
                out.append((t.start, t.end))
        elif t.pos == "auxiliary" and t.lemma_reading == "られる" and _after_verb(tokens, i):
            out.append((t.start, t.end))
    return out


def _volitional_spans(tokens):
    """帰ろう, 食べよう: the verb itself in the volitional form. ましょう
    and でしょう are auxiliaries in that form, and are not it."""
    return [(t.start, t.end) for t in tokens if t.pos == "verb" and t.cform.startswith("意志推量形")]


def _imperative_spans(tokens):
    """起きろ, 待て: a verb in the imperative that ends its clause. Not
    ください or なさい, imperatives of the verbs they are but the polite
    request and 〜なさい as points; and not a verb the tagger reads as an
    imperative on its way to an auxiliary (習わせられた)."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos != "verb" or not t.cform.startswith("命令形") or t.auxiliary_use:
            continue
        if i + 1 < len(tokens) and tokens[i + 1].pos in ("auxiliary", "verb"):
            continue
        out.append((t.start, t.end))
    return out


# ── Rules by what the tokenizer names (plan 149) ────────────────
# Each reads words, never letters, and each is held to its point's own
# lessons like every rule here (_confirmed).

def _prev_kind(tokens, i: int) -> str:
    """"nominal", "predicate" or "" for the word before tokens[i]."""
    if i == 0:
        return ""
    t = tokens[i - 1]
    if t.pos in _NOMINAL:
        return "nominal"
    if t.pos in ("verb", "adjective", "auxiliary"):
        return "predicate"
    return ""


def _is_copula(t) -> bool:
    return t.pos == "auxiliary" and t.lemma in ("だ", "です")


def _copula_spans(tokens):
    """です／だ in the forms its lesson teaches and the letters です and
    だ never showed: the past (だった, でした), the plain and polite
    negatives (じゃない, ではない, ではありません), and です after an
    い-adjective (高いです). Not the forms other points own: だろう and
    でしょう (〜だろう, 〜でしょう), なら (〜なら), the な of しずかな
    (い形容詞／な形容詞) and the に of しずかに (〜く／〜に（副詞形））."""
    out = []
    for i, t in enumerate(tokens):
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if _is_copula(t) and not (i > 0 and tokens[i - 1].pos == "auxiliary" and tokens[i - 1].lemma == "ず"):
            # (the でし of ませんでした is 〜ませんでした's)
            head = _form_head(t.cform)
            if head == "終止形" or t.cform in ("連用形-促音便", "連用形-融合") or (
                    t.lemma == "です" and head == "連用形"):
                # だった and でした are the copula's past, one word to its
                # lesson: the た goes with them.
                past = nxt is not None and nxt.lemma == "た" and head == "連用形"
                out.append((t.start, nxt.end if past else t.end))
            elif _de_aru(tokens, i):
                out.append((t.start, nxt.end))            # である, the written copula
        if ((t.pos == "particle" and t.surface == "で" or _is_copula(t) and t.cform == "連用形-一般")
              and _prev_kind(tokens, i) == "nominal"
              and nxt is not None and nxt.surface in ("は", "も") and i + 2 < len(tokens)):
            neg = tokens[i + 2]
            if neg.lemma in ("無い", "ない") or (neg.lemma in ("有る", "ある") and (
                    nxt.surface == "も" and not _question_word_before(tokens, i)
                    or i + 3 < len(tokens) and tokens[i + 3].lemma == "ます")):
                # ではない, ではありません, and でもある: 外交官でもあった
                # is "was a diplomat too" (plan 150). ある after で + も
                # is the copula's -- a thing that exists somewhere is に
                # + も + ある -- except after a question word: いくらでも
                # ある is "there is any amount".
                out.append((t.start, neg.end))
    return out


def _de_aru(tokens, i: int) -> bool:
    """Whether tokens[i] is the copula's で of である: its 連用形 with ある
    straight after it."""
    return (i + 1 < len(tokens) and _is_copula(tokens[i]) and tokens[i].cform == "連用形-一般"
            and tokens[i + 1].lemma in ("有る", "ある"))


def _explanatory_spans(tokens):
    """〜んです／〜のです in every register: の or ん after a verb, an
    adjective or an auxiliary, then the copula in any form -- 行くんだ,
    どうしたんだ, しずかなんです, 行くんでしょう, 行くんじゃない. The
    lesson writes the polite spelling, and the plain one is the one a
    subtitle writes."""
    out = []
    for i, t in enumerate(tokens[:-1]):
        if t.pos == "particle" and t.lemma == "の" and _prev_kind(tokens, i) == "predicate":
            nxt = tokens[i + 1]
            # The な of 安全なのです / 好きなんだ is the copula meeting の,
            # and part of the construction after a noun.
            prev = tokens[i - 1]
            begin = prev.start if _is_copula(prev) and _form_head(prev.cform) == "連体形" else t.start
            # The copula's finite forms only: の + で (its 連用形) is how
            # the tokenizer sometimes cuts ので, "because" (〜ので), and
            # の + なら is 〜なら's.
            if _is_copula(nxt) and (_form_head(nxt.cform) in ("終止形", "意志推量形")
                                    or nxt.cform in ("連用形-促音便", "連用形-融合")
                                    or (nxt.lemma == "です" and _form_head(nxt.cform) == "連用形")):
                out.append((begin, nxt.end))
            elif _de_aru(tokens, i + 1):
                out.append((begin, tokens[i + 2].end))    # のである, the written register
    return out


_MOTION = frozenset({"いく", "くる", "かえる", "もどる", "でかける"})


def _purpose_spans(tokens):
    """〜に行きます in any form and with the verbs its lesson names
    beside 行く (来ます, 帰ります): a verb's 連用形, に, then the verb of
    going -- 会いに来て, 買いに行った, 取りに帰る."""
    out = []
    for i in range(1, len(tokens) - 1):
        stem, ni, go = tokens[i - 1], tokens[i], tokens[i + 1]
        if (stem.pos == "verb" and stem.cform.startswith("連用形") and not stem.auxiliary_use
                and ni.pos == "particle" and ni.surface == "に"
                and go.pos == "verb" and go.lemma_reading in _MOTION):
            out.append((ni.start, go.end))
    return out


def _te_link_spans(tokens):
    """〜て、〜て with one て: a verb or an auxiliary's て that joins its
    clause to one that follows (辿って会いに…, 食べて出ます). Not a て a
    word hangs off in its auxiliary use (ている, てみる, てください --
    those constructions' own), a て a particle follows (ては, ても,
    てから), or a て that ends the sentence (待って！, the request)."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.conjunctive and t.surface in ("て", "で")) or i == 0:
            continue
        if tokens[i - 1].pos not in ("verb", "auxiliary"):
            continue
        rest = []
        for u in tokens[i + 1:]:
            if u.pos == "symbol" and u.surface in _SENTENCE_ENDS:
                break
            rest.append(u)
        words = [u for u in rest if u.pos != "symbol"]
        # A word hanging straight off the て in its auxiliary use is a
        # construction (ている); across a comma it is the next clause's
        # verb (ふって、行けません).
        comma = bool(rest) and rest[0].pos == "symbol"
        if not words or words[0].pos == "particle" or (words[0].auxiliary_use and not comma):
            continue
        if comma and words[-1].pos == "particle" and words[-1].conjunctive and words[-1].surface in ("から", "ので", "し"):
            # 待って、すぐ行くから: a request and the reason given for
            # it, not two actions in a row -- and nothing in the letters
            # says which, so no key rather than a wrong one (plan 150).
            continue
        if any(u.pos in ("verb", "adjective", "auxiliary") for u in words):
            out.append((t.start, t.end))
    return out


def _from_until_spans(tokens):
    """から〜まで with one of its two ends: から after a noun is "from"
    and まで after a noun "until", the two halves of the one lesson
    (から after a clause is 〜から, "because"). With both present the
    two-part hit is the one reported (_detect's dedupe)."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "particle" and t.surface in ("から", "まで") and not t.conjunctive
            and _prev_kind(tokens, i) == "nominal"]


def _adjective_spans(tokens):
    """い形容詞／な形容詞 where its lesson's forms are written: the な a
    な-adjective takes before a noun (しずかな店), and an い-adjective's
    own negative and past (高くない, 高かった). The dictionary form in
    front of a noun is the word and nothing to point at."""
    out = []
    for i, t in enumerate(tokens):
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if (_is_copula(t) and t.lemma == "だ" and _form_head(t.cform) == "連体形"
                and i > 0 and tokens[i - 1].pos in ("other", "noun", "suffix")
                and nxt is not None and nxt.pos in ("noun", "pronoun")):
            # Before a noun: the な of しずかなのだ is the copula before
            # の (〜んです／〜のです), not an attribute.
            out.append((t.start, t.end))
        elif t.pos == "adjective" and t.lemma not in ("無い", "ない") and nxt is not None:
            if t.cform == "連用形-促音便" and nxt.lemma == "た" and not nxt.cform.startswith("仮定形"):
                out.append((t.start, nxt.end))       # (安かったら is 〜たら's)
            elif t.cform.startswith("連用形") and t.surface.endswith("く") and nxt.lemma in ("無い", "ない"):
                out.append((t.start, nxt.end))
    return out


def _plain_past_spans(tokens):
    """た形 〜た: the past auxiliary た (だ after ん or い音便: 読んだ) on
    a verb or on an auxiliary other than the polite ます and です, whose
    pasts are 〜ました and でした. An い-adjective's かった is
    い形容詞／な形容詞's, which encloses it."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos != "auxiliary" or t.lemma != "た" or i == 0 or t.cform.startswith("仮定形"):
            continue  # たら is 〜たら's
        prev = tokens[i - 1]
        if (prev.pos == "verb" or (prev.pos == "auxiliary" and prev.lemma not in ("ます", "です"))
                or (prev.pos == "adjective" and prev.lemma in ("無い", "ない"))):
            out.append((t.start, t.end))
    return out


def _plain_negative_spans(tokens):
    """ない形 〜ない: the negative auxiliary ない in any of its forms
    (ない, なかっ, なく, なけれ) on a verb or on an auxiliary (食べられない,
    行かせない), and ない standing for ある after が, は or も (お金がない),
    as the lesson says ある becomes. Not じゃない or ではない, the
    copula's negative (です／だ)."""
    out = []
    for i, t in enumerate(tokens):
        if i == 0:
            continue
        prev = tokens[i - 1]
        if t.pos == "auxiliary" and t.lemma == "ない" and prev.pos in ("verb", "auxiliary"):
            # The ならない / いけない that closes an obligation
            # (〜なければなりません, 〜てはいけません, 〜ないといけない) is
            # that construction's, whose span can stop short of it.
            obliged = (prev.lemma in ("成る", "行ける", "いける") and i >= 2
                       and tokens[i - 2].pos == "particle" and tokens[i - 2].surface in ("ば", "は", "と", "ちゃ", "じゃ"))
            if not obliged:
                out.append((t.start, t.end))
        elif (t.pos == "adjective" and t.lemma in ("無い", "ない") and prev.pos == "particle"
              and prev.surface in ("が", "は", "も") and not (i >= 2 and tokens[i - 2].surface == "で")):
            out.append((t.start, t.end))
    return out


# ── A request that ends the sentence (plan 150) ─────────────────
_UTTERANCE_ENDS = frozenset("。！？!?」』")
_SOFTENERS = frozenset({"ね", "よ", "な", "ねえ", "よね"})


def _sentence_final(tokens, i: int) -> bool:
    """Whether tokens[i] ends its sentence: nothing after it but a
    softening particle (ね, よ) before 。！？, a closing quote, or the end
    of the text. A trailing-off …, a comma, or any word says the
    sentence goes on (or was left hanging, お腹が空いて…)."""
    for u in tokens[i + 1:]:
        if u.pos == "symbol":
            return u.surface in _UTTERANCE_ENDS
        if u.pos == "particle" and u.surface in _SOFTENERS:
            continue
        return False
    return True


def _sentence_start(tokens, i: int) -> int:
    for k in range(i - 1, -1, -1):
        if tokens[k].pos == "symbol" and tokens[k].surface in _UTTERANCE_ENDS | frozenset("「『"):
            return k + 1
    return 0


def _casual_request_spans(tokens):
    """〜て／〜ないで（依頼）: a verb's て, or ないで, that ends the
    sentence -- 待って, 会いにきて, 見てね, 行かないで. Not one the
    sentence goes on after (a link, or ないで's "without doing"), and not
    one whose sentence has a subject marked by が: 電車が遅れて。 answers
    "why?" (the train was late), it asks nobody for anything."""
    out = []
    for i, t in enumerate(tokens):
        if i == 0 or not (t.conjunctive and t.surface in ("て", "で")):
            continue
        prev = tokens[i - 1]
        negative = prev.pos == "auxiliary" and prev.lemma == "ない"
        if not (prev.pos == "verb" or negative) or not _sentence_final(tokens, i):
            continue
        if any(u.pos == "particle" and u.surface == "が" and not u.conjunctive
               for u in tokens[_sentence_start(tokens, i):i]):
            continue
        out.append((prev.start if negative else t.start, t.end))
    return out


# Points that are a clause joined to another: where nothing follows,
# the letters are something else. 行かないで！ asks "don't go" (the
# request above), and is not 〜ないで's "without doing" (plan 150).
_NEEDS_A_CLAUSE = frozenset({"〜ないで", "〜て、〜て"})


def _ends_its_sentence(tokens, end: int) -> bool:
    for i, t in enumerate(tokens):
        if t.end == end:
            return _sentence_final(tokens, i)
    return False


# ── Particles a lesson reads one way and a sentence another (plan 150) ──
# でも, とは and とか are two particles each to the tokenizer wherever
# they stand (で + も, と + は, と + か), so it cannot say which of their
# meanings a sentence has. Each point below is held to the shapes its
# own lesson teaches, and refused elsewhere: a key left unlit is a rule
# the learner can still look up, a wrong one is a rule they learn.

_PLACE_PRONOUNS = frozenset({"ここ", "そこ", "あそこ", "こちら", "そちら", "あちら", "こっち", "そっち", "あっち"})
# A question word by its dictionary form, which the kana spellings share
# (だれ is 誰, なん is 何, いつ is 何時, どこ is 何処).
_QUESTION_LEMMAS = frozenset({"何", "誰", "何時", "何処", "何れ", "何方", "幾ら", "どう"})


def _index_at(tokens, start: int):
    for i, t in enumerate(tokens):
        if t.start == start:
            return i
    return None


def _is_question_word(t) -> bool:
    return t.lemma in _QUESTION_LEMMAS or t.surface in _QUESTION_WORDS


def _counter_after_nan(tokens, i: int) -> bool:
    """Whether tokens[i] is the counter of a 何 before it: 何人, 何度,
    何回, 何時 -- one character, which the tokenizer calls a suffix or a
    noun."""
    t = tokens[i]
    return (i >= 1 and tokens[i - 1].lemma == "何" and t.pos in ("suffix", "noun")
            and len(t.surface) == 1 and not ("\u3040" <= t.surface <= "\u30ff"))


def _question_word_before(tokens, i: int) -> bool:
    """Whether tokens[i] follows a question word -- 誰でも, 何とか -- or a
    question word and its counter (何人でも, 何度でも)."""
    if i < 1:
        return False
    return _is_question_word(tokens[i - 1]) or (_counter_after_nan(tokens, i - 1))


def _negated(token) -> bool:
    return token.lemma in ("無い", "ない")


def _negative_at(tokens, k: int) -> bool:
    """ない, or ありません, at tokens[k]."""
    if k >= len(tokens):
        return False
    return _negated(tokens[k]) or (tokens[k].lemma in ("有る", "ある") and k + 1 < len(tokens)
                                   and tokens[k + 1].surface.startswith("ませ"))


def _copula_follows(tokens, k: int) -> bool:
    """Whether the word after tokens[k] (a も or は) makes it the
    copula's -- でもない, でもありません, でもあった: 外交官でもあった is
    "was a diplomat too", で the copula's and not the particle of
    place."""
    if k + 1 >= len(tokens):
        return False
    after = tokens[k + 1]
    return _negated(after) or after.lemma in ("有る", "ある")


def _any_spans(tokens):
    """何でも／誰でも／いつでも／どこでも: a question word, then でも --
    in kana too (だれでも, なんでも), with a counter (何度でも) or a case
    particle between (誰にでも, どこにでも, 誰とでも). Not いつまでも
    ("for ever"), which has no で; not 何でもない, the set phrase "it's
    nothing", whose でもない is the copula's; not 何でも、 opening a
    sentence, which is "apparently" and no "anything"."""
    out = []
    for i, _t in enumerate(tokens):
        found = _any_at(tokens, i)
        if found is not None and not _any_refused(tokens, i, found):
            out.append((tokens[i].start, tokens[found].end))
    return out


def _any_at(tokens, i: int):
    """The index of the も closing a question word + でも that starts at
    tokens[i], or None."""
    t = tokens[i]
    if not _is_question_word(t):
        return None
    j = i + 1
    if j < len(tokens) and _counter_after_nan(tokens, j):
        j += 1
    if j < len(tokens) and tokens[j].pos == "particle" and tokens[j].surface in ("に", "と", "から", "へ"):
        j += 1
    if (j + 1 < len(tokens) and tokens[j].surface == "で" and tokens[j + 1].surface == "も"
            and tokens[j + 1].pos == "particle"):
        return j + 1
    return None


def _any_refused(tokens, i: int, k: int) -> bool:
    """何でもない (the copula's でもない: "it's nothing"), and 何でも、
    opening a sentence ("apparently")."""
    if _negative_at(tokens, k + 1):
        return True
    return (tokens[i].lemma == "何" and _sentence_start(tokens, i) == i and k + 1 < len(tokens)
            and tokens[k + 1].surface in _COMMAS)


def _demo_refused(tokens, start: int, end: int, _segments) -> bool:
    """〜でも is a noun + でも: an example offered (お茶でも), or "even"
    (子どもでも). Not opening a sentence, where でも is "but"; not after
    a question word (誰でも is "anyone", its own
    point above), not after a place (ここでも is here + too: で of
    place, も "also"), and not before ある or ない, where で is the
    copula's (外交官でもあった, 学生でもない)."""
    i = _index_at(tokens, start)
    if i is None or i + 1 >= len(tokens):
        return False
    if _opens_sentence(tokens, i):
        return True                  # でも、…: "but", which its lesson says it is not
    if _question_word_before(tokens, i):
        return True
    if i >= 1 and tokens[i - 1].surface in _PLACE_PRONOUNS:
        return True
    return _copula_follows(tokens, i + 1)


def _opens_sentence(tokens, i: int) -> bool:
    prev = _before_token(tokens[i].start, tokens)
    return prev is None or (prev.pos == "symbol" and (prev.surface in _SENTENCE_ENDS or prev.surface in _OPENERS))


# Words after which a clause + とは is surprise ("to think that...!"):
# 驚いた, 意外だ, 夢にも思わなかった (_surprised).
_SURPRISE = frozenset({"驚く", "びっくり", "意外", "夢", "まさか"})
# Words that make it surprise only in the negative: 思わなかった,
# 知らなかった, 信じられない -- 行くとは思う is "I do think I'll go",
# a quotation's と and a contrasting は.
_UNEXPECTED = frozenset({"思う", "知る", "信じる", "信ずる", "考える", "想像", "予想", "思い"})
_DEFINED = frozenset({"事", "こと", "物", "もの", "意味"})


def _sentence_rest(tokens, k: int):
    """The words after tokens[k] up to the end of its sentence, less
    marks and softeners."""
    rest = []
    for u in tokens[k + 1:]:
        if u.pos == "symbol" and u.surface in _UTTERANCE_ENDS:
            break
        if u.pos == "symbol" or (u.pos == "particle" and u.surface in _SOFTENERS):
            continue
        rest.append(u)
    return rest


def _surprised(rest) -> bool:
    """Whether the words after a clause + とは say it was a surprise:
    驚いた, 夢にも思わなかった, 信じられない, 信じがたい, or a verb of
    thinking in the PAST negative -- 思わなかった, 知らなかった,
    想像できませんでした. In the present it is an opinion, and と + は
    a quotation and its contrast: 勝ちたいとは思わない is "I don't think
    I want to win", 知らない "I don't know that"."""
    head = rest[0]
    if head.lemma in _SURPRISE or head.surface in _SURPRISE:
        return True
    if not (head.lemma in _UNEXPECTED or head.surface in _UNEXPECTED):
        return False
    window = rest[1:6]
    for n, u in enumerate(window):
        if head.lemma in ("信じる", "信ずる") and (_negated(u) or u.lemma == "難い"):
            return True                                    # 信じられない, 信じがたい
        if _negated(u) or (u.lemma == "ます" and u.surface.startswith("ませ")):
            return any(w.lemma == "た" or w.surface == "でし" for w in window[n + 1:n + 3])
    return False


def _towa_refused(tokens, start: int, end: int, _segments) -> bool:
    """〜とは is surprise after a clause (先生になるとは、思わなかった;
    まさか彼が犯人だとは。) or a definition after a noun (友情とは、
    助け合うことだ; 愛とは何か). Everywhere else と + は is two
    particles: 彼とは十年来の知り合いだ ("with him"), 東京とは違う
    ("from Tokyo"), 行くとは言っていない (a quotation, and は
    contrasting it)."""
    i = _index_at(tokens, start)
    if i is None or i + 1 >= len(tokens) or tokens[i + 1].surface != "は":
        return False
    k = i + 1
    prev = _before_token(start, tokens)
    if prev is None or prev.pos == "pronoun":
        return True
    rest = _sentence_rest(tokens, k)
    if rest and rest[0].lemma in ("限る", "言う"):
        return True                                    # とは、限らない: 〜とは限らない's
    nxt = tokens[k + 1] if k + 1 < len(tokens) else None
    comma = nxt is not None and nxt.pos == "symbol" and nxt.surface in _COMMAS
    if prev.pos in ("verb", "adjective", "auxiliary"):
        # とは。, とは…, とはね。, とは、驚いた: the exclamation.
        return not (comma or not rest or _sentence_final(tokens, k)
                    or (nxt is not None and nxt.surface in "…‥") or _surprised(rest))
    # A noun: a definition, which closes its sentence on what the thing
    # IS -- こと／もの／意味 + the copula, 何 + か／だ, 〜をいう／〜を指す --
    # or, set off by a comma, on a noun and the copula (日本語とは、
    # 日本人の言葉です). 田中さんとは、昨日会った is "with Tanaka".
    if not rest:
        return False                                   # 愛とは。
    last = rest[-1]
    if last.lemma in _QUESTION_LEMMAS:
        return False                                   # 愛とは何？
    if len(rest) >= 2:
        before_last = rest[-2]
        if before_last.lemma in _QUESTION_LEMMAS and (last.surface == "か" or _is_copula(last)):
            return False                               # 愛とは何か / 何だろう
        if before_last.surface == "を" and last.lemma in ("言う", "指す"):
            return False                               # 〜をいう
        if _is_copula(last) and before_last.lemma in _DEFINED:
            return False                               # 〜ことだ／ものです
        if (last.lemma in ("有る", "ある") and len(rest) >= 3 and _is_copula(before_last)
                and rest[-3].lemma in _DEFINED):
            return False                               # 〜ことである
        if comma and ((_is_copula(last) and before_last.pos in _NOMINAL)
                      or (len(rest) >= 3 and rest[-3].lemma == "他" and before_last.lemma == "成る"
                          and _negated(last))):
            return False                               # 〜とは、〜の言葉です／〜にほかならない
    return True


def _toka_refused(tokens, start: int, end: int, _segments) -> bool:
    """〜とか lists loose examples or quotes vaguely; 何とか is a word
    of its own, "somehow"."""
    i = _index_at(tokens, start)
    return i is not None and _question_word_before(tokens, i)


def _ka_ka_refused(tokens, start: int, end: int, segments) -> bool:
    """〜か〜か offers a choice of two (コーヒーか水か, 行くか行かないか).
    Each か must be the particle, standing alone -- not the last letter
    of a verb (つかれる, which the tokenizer can cut as つか + れる) --
    and none of them another point's: the か that closes a とか
    (りんごとかバナナとか), the か of a question word (何か食べましょうか
    is "something", then a question), the か of かもしれない, and the
    か that closes an embedded question (いつ来るか知っていますか is
    〜か（間接疑問）, then a question)."""
    for a, b in segments:
        i = _index_at(tokens, a)
        if i is None or tokens[i].end != b or tokens[i].pos != "particle":
            return True
        if i >= 1 and tokens[i - 1].surface == "と" and tokens[i - 1].pos == "particle":
            return True
        if _indefinite_ka(tokens, a):
            return True
        if i + 2 < len(tokens) and tokens[i + 1].surface == "も" and tokens[i + 2].lemma in ("知れる", "しれる"):
            return True
    first = _index_at(tokens, segments[0][0])
    begin = first
    while begin > 0 and not (tokens[begin - 1].pos == "symbol"
                             and tokens[begin - 1].surface in _COMMAS | _UTTERANCE_ENDS | frozenset("「『")):
        begin -= 1
    return any(_is_question_word(u) for u in tokens[begin:first])


def _in_set_phrase(tokens, start: int) -> bool:
    """Whether the particle at `start` is a letter of a word the
    tokenizer writes as a question word and particles: 何とか and 何とも
    ("somehow", "not at all"), whose と is no "and" or "with" and whose
    か is no question, and a question word + でも (誰でも, 何でもない),
    whose で is no particle of place and whose も is no "also"."""
    i = _index_at(tokens, start)
    if i is None:
        return False
    t = tokens[i]
    if t.surface == "と":
        return (i >= 1 and tokens[i - 1].lemma == "何" and i + 1 < len(tokens)
                and tokens[i + 1].surface in ("か", "も"))
    if t.surface in ("か", "も") and i >= 2 and tokens[i - 1].surface == "と" and tokens[i - 2].lemma == "何":
        return True
    if t.surface in ("で", "も"):
        if t.surface == "で" and i + 1 < len(tokens) and tokens[i + 1].surface == "も" and _opens_sentence(tokens, i):
            return True                                # でも、…: "but"
        if t.surface == "も" and i >= 1 and tokens[i - 1].surface == "で" and _opens_sentence(tokens, i - 1):
            return True
        return any(_any_at(tokens, b) in (i, i + 1) for b in range(max(0, i - 4), i))
    return False


def _sorede_refused(tokens, start: int, end: int, _segments) -> bool:
    """それで ("and so") is not the それで of それでも ("even so")."""
    i = _index_at(tokens, start)
    if i is None:
        return False
    k = next((n for n in range(i, len(tokens)) if tokens[n].end == end), None)
    return k is not None and k + 1 < len(tokens) and tokens[k + 1].surface == "も"


def _looks_spans(tokens):
    """〜そうです in every register: the そう of how a thing looks (the
    tokenizer's そう-様態, a 形状詞) after a verb's stem, an adjective's
    or a noun -- 降りそうだ, おいしそうなケーキ, 元気そうに -- with the
    copula it carries. The そう of hearsay (降るそうだ, after a plain
    form) is a noun to the tokenizer, and 〜そうだ（伝聞）'s; the そう of
    そうです ("that's right") an adverb, and neither."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.surface == "そう" and t.pos == "other" and i > 0):
            continue
        prev = tokens[i - 1]
        if prev.pos in ("verb", "adjective", "auxiliary"):
            # The stem: 降り, おいし, よさ, 食べた(い). After a plain form
            # (行くそうだ, できるそうだ) it is hearsay, whatever the
            # tokenizer tagged the そう -- it reads some of those as the
            # looks-like one.
            if not prev.cform.startswith(("連用形", "語幹")):
                continue
        elif prev.pos not in ("noun", "other", "suffix"):
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        out.append((t.start, nxt.end if nxt is not None and _is_copula(nxt) else t.end))
    return out


def _many_mo(tokens, start: int) -> bool:
    """The も of 何度も, 何人も ("time after time", "as many as"): no
    "also", and not the も of 何も〜ない either."""
    i = _index_at(tokens, start)
    return i is not None and i >= 2 and _counter_after_nan(tokens, i - 1)


def _wa_ga_refused(tokens, start: int, end: int, segments) -> bool:
    """〜は〜が is a topic, then the subject of what is said about it
    (象は鼻が長い). Its が is the subject's, never the "but" が of
    話せることは話せるが; and no clause closes between the two --
    彼女はいないし、女性に手が早い is two clauses, the は in the first.
    A clause inside the subject is the subject's (わたしは中国語を話す
    ことができます), and one joined by て goes on to the same topic
    (彼はプロだけあって、説明が分かりやすい)."""
    first = _index_at(tokens, segments[0][0])
    last = _index_at(tokens, segments[-1][0])
    if first is None or last is None:
        return False
    if tokens[last].conjunctive:
        return True
    return any(u.pos == "particle" and u.conjunctive and u.surface not in ("て", "で")
               for u in tokens[first + 1:last])


def _te_te_refused(tokens, start: int, end: int, segments) -> bool:
    """〜て、〜て joins a clause to the next: every て but the last must
    be one _te_link_spans would light on its own -- not the て of
    についての, which a particle follows, nor one a construction hangs
    off (ている)."""
    links = set(_te_link_spans(tokens))
    return any((a, b) not in links for a, b in segments[:-1])


_REFUSALS = {
    "〜でも": _demo_refused,
    "〜とは": _towa_refused,
    "〜とか": _toka_refused,
    "〜か〜か": _ka_ka_refused,
    "〜は〜が": _wa_ga_refused,
    "〜て、〜て": lambda tokens, s, e, segments: len(segments) > 1 and _te_te_refused(tokens, s, e, segments),
    "それで": _sorede_refused,
    "と": lambda tokens, s, e, _g: _in_set_phrase(tokens, s),
    "か": lambda tokens, s, e, _g: _in_set_phrase(tokens, s),
    "も": lambda tokens, s, e, _g: _in_set_phrase(tokens, s) or _many_mo(tokens, s),
    "で": lambda tokens, s, e, _g: _in_set_phrase(tokens, s),
}


def _refused(tokens, pattern: str, start: int, end: int, segments) -> bool:
    rule = _REFUSALS.get(pattern)
    return rule is not None and rule(tokens, start, end, segments)


@lru_cache(maxsize=None)
def _ends_negative(pattern: str) -> bool:
    return any(alt.endswith(("ません", "ない")) for alt in alternatives(pattern))


def _through_negative(tokens, hit):
    """A point that ends in its negative (〜かもしれません, 〜てはいけません,
    〜なければなりません), found by letters cut short of it -- かもしれ,
    てはいけ -- takes in the plain ない that follows: the ない of
    かもしれない is the construction's, and no plain negative of its own
    (plan 150)."""
    pattern, level, start, end, kind, contiguous, segments = hit
    if not contiguous or not _ends_negative(pattern):
        return hit
    last = next((t for t in tokens if t.start < end <= t.end), None)
    after = next((t for t in tokens if t.start == end), None)
    if (last is None or last.end != end or last.pos != "verb"
            or after is None or after.pos != "auxiliary" or after.lemma != "ない"):
        return hit
    return (pattern, level, start, after.end, kind, contiguous, ((start, after.end),))


_CONTRACTED = {"てる": "〜ています", "ちゃう": "〜てしまう", "とく": "〜ておく"}


def _contraction_spans(tokens):
    """(pattern, start, end) for the spoken short forms of three て
    constructions, which the tokenizer reads as auxiliaries of their
    own: してる / 飲んでる / 見てた is 〜ています, 食べちゃった /
    読んじゃう 〜てしまう (its lesson names both), 買っとく 〜ておく. A
    subtitle writes these far more often than the long forms."""
    return [(_CONTRACTED[t.lemma], t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "auxiliary" and t.lemma in _CONTRACTED
            and tokens[i - 1].pos in ("verb", "auxiliary")]


def _single_tari_spans(tokens):
    """〜たり〜たり with one たり: サボったりしたら, "skipping and the
    like" -- one example named, the rest implied. With two, the
    two-part hit is the one reported (_detect's dedupe)."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "particle" and t.lemma in ("たり", "だり")
            and tokens[i - 1].pos in ("verb", "adjective", "auxiliary")]


# Points a rule reads only IN PART (plan 149): い形容詞／な形容詞 is lit
# where its lesson's forms are written (しずかな, 高くない, 高かった) and
# not on every adjective in its dictionary form, which is a word rather
# than something to point at. A breakdown gains the key; 作文 must not
# hear "not found" from it (can_find), since この犬は大きいです uses the
# point and shows none of those forms.
_PARTIAL = frozenset({"い形容詞／な形容詞"})

# Points read by their rule alone, never by letters: a pattern that is a
# bare ending (た, ない) matches every た and every ない there is, and
# the letters' conjugations reach ません, which the ない-form's own
# lesson names as a different point.
_RULE_ONLY = frozenset({"た形 〜た", "ない形 〜ない", "〜て／〜ないで（依頼）",
                        # (何でもない's letters are 何でも's: the rule is what tells them apart)
                        "何でも／誰でも／いつでも／どこでも"})


# Rules that stand BESIDE a point's other rules rather than replacing
# them (_CLASS_RULES points skip the stem and te rules).
_EXTRA_RULES = (
    ("〜たり〜たり", _single_tari_spans),
)


# The form points, by the pattern the catalogue files them under. A
# rename here is a rename there (tests/test_grammar_detect holds the
# two together).
_CLASS_RULES = {
    "〜て／〜ないで（依頼）": _casual_request_spans,
    "何でも／誰でも／いつでも／どこでも": _any_spans,
    "〜そうです": _looks_spans,
    "た形 〜た": _plain_past_spans,
    "ない形 〜ない": _plain_negative_spans,
    "です／だ": _copula_spans,
    "〜んです／〜のです": _explanatory_spans,
    "〜に行きます": _purpose_spans,
    "〜て、〜て": _te_link_spans,
    "から〜まで": _from_until_spans,
    "い形容詞／な形容詞": _adjective_spans,
    "受身形 〜られる": _passive_spans,
    "可能形 〜(ら)れる": _potential_spans,
    "使役形 〜させる": _causative_spans,
    "使役受身形 〜させられる": _causative_passive_spans,
    "意向形 〜(よ)う": _volitional_spans,
    "命令形 〜ろ／〜え": _imperative_spans,
}


@lru_cache(maxsize=None)
def _confirmed(level: str, pattern: str) -> bool:
    """Whether the point's own lessons show its rule working: the rule
    finds the point in at least one of the point's example sentences.
    Read once per point, and only once a sentence has given the rule a
    candidate."""
    found = find(pattern)
    if found is None or found[0] != level:
        return False
    for example in found[1].get("examples", []):
        tokens = morphology.tokenize(example.get("jp", ""))
        if tokens and any(p == pattern for p, _l, _s, _e in _form_hits(tokens, confirm=False)):
            return True
    return False


def _form_hits(tokens, confirm: bool = True) -> list[tuple[str, str, int, int]]:
    """(pattern, level, start, end) for every point the second pass
    finds, each held to its own lessons unless `confirm` is off (which
    is how the lessons themselves are read)."""
    out = []
    index = _form_rules()
    # A tail in its dictionary form also stands in the imperative and the
    # volitional (plan 149): やめてくれ is 〜てくれる told, 見てみよう is
    # 〜てみる proposed. Except where a point is written in exactly that
    # form and claims the same words -- 書いてください is 〜てください and
    # not the honorific くださる behind 〜てくださる.
    in_form: set[tuple[int, int]] = set()
    relaxed_hits = []
    for reading in {t.lemma_reading for t in tokens} & index.keys():
        for level, pattern, shape, core in index[reading]:
            read = _te_spans if shape == "te" else _stem_spans
            spans = read(tokens, core)
            ok = None
            if spans:
                ok = not confirm or _confirmed(level, pattern)
                if ok:
                    out.extend((pattern, level, s, e) for s, e in spans)
                    if core[-1][2] in _MEANING_FORMS:
                        in_form.update(spans)
            if core[-1][2] == "":
                extra = set(read(tokens, core, relaxed=True)) - set(spans)
                if extra and (ok if ok is not None else (not confirm or _confirmed(level, pattern))):
                    relaxed_hits.extend((pattern, level, s, e) for s, e in extra)
    out.extend(h for h in relaxed_hits if (h[2], h[3]) not in in_form)
    for pattern, rule in (*_CLASS_RULES.items(), *_EXTRA_RULES):
        spans = rule(tokens)
        if not spans:
            continue
        found = find(pattern)
        if found is None:
            continue
        level = found[0]
        if not confirm or _confirmed(level, pattern):
            out.extend((pattern, level, s, e) for s, e in spans)
    for pattern, s, e in _contraction_spans(tokens):
        found = find(pattern)
        if found is not None and (not confirm or _confirmed(found[0], pattern)):
            out.append((pattern, found[0], s, e))
    return out


# A point that IS one grammatical word -- a particle, the copula -- as
# opposed to one built around a word: 「は」 and です／だ against
# 〜ます／〜ません and から〜まで. The catalogue writes the difference
# already (a construction is written with 〜, marking where the rest of
# the sentence goes), and the screens use it: a marker belongs on the
# row of the very particle it is, a construction over the sentence it
# shapes. Both are cards, and both open.
_MARKER_POS = frozenset({"particle", "auxiliary"})


def _kind(pattern: str, token) -> str:
    if "〜" in pattern or token is None or token.pos not in _MARKER_POS:
        return "pattern"
    return "marker"


def hits(sentence: str, tokens=None) -> list[dict]:
    """Every point `sentence` visibly uses, in full: {pattern, level,
    start, end, kind, segments}.

    `start`..`end` is the whole stretch the hit reaches over; `segments`
    is the list of (start, end) pieces it is actually written on, one
    per part of the pattern. For a point written in one piece the two
    are the same span. For から〜まで they are から and まで, and the
    clause between them is not in either: a screen that draws where a
    rule sits on the sentence lights those two words and not the whole
    line (plan 095), and a token between them is not one the point
    covers (study/analysis._attach_grammar). detect and points_in are
    the same list in the tuple forms their callers already read.
    """
    return [
        {"pattern": p, "level": lv, "start": s, "end": e, "kind": k, "segments": list(segs)}
        for p, lv, s, e, k, segs in _detect(sentence, tokens)
    ]


def detect(sentence: str, tokens=None) -> list[tuple[str, str, int, int, str]]:
    """(pattern, level, start, end, kind) — points_in, plus what shape of
    point each hit is (see _kind). The full form; points_in is the same
    list with the kind dropped for the callers that predate it, and
    hits() the same list with the pieces each hit is written on."""
    return [(p, lv, s, e, k) for p, lv, s, e, k, _segs in _detect(sentence, tokens)]


def points_in(sentence: str, tokens=None) -> list[tuple[str, str, int, int]]:
    """(pattern, level, start, end) for every catalogue point `sentence`
    visibly uses, at any level.

    `tokens` is morphology.tokenize's output when the caller already has
    it (study/analysis.py does — it tokenizes the sentence for the
    word rows), so a breakdown tokenizes once rather than twice.

    Sorted by start, then widest first, and deduplicated to one hit per
    (pattern, level) per position it covers: a point's needles include a
    form and its truncated stems, which nest — 「ています」 and 「ていま」
    start at the same place and are one occurrence, not two chips with
    the same card behind them. A second, non-overlapping occurrence of
    the same point later in a longer sentence is a real second hit and
    stays.
    """
    return [(p, lv, s, e) for p, lv, s, e, _kind, _segs in _detect(sentence, tokens)]


@lru_cache(maxsize=None)
def can_find(pattern: str) -> bool:
    """Whether the detector may say a sentence does NOT use `pattern`
    (plan 125): true when it finds the point in at least one of the
    point's own catalogue examples.

    A "not found" is evidence only where the matcher has proved itself
    on the point. It never sees some two dozen of the 541 -- the
    sense-qualified and AMBIGUOUS points _catalogue() drops (〜が（逆接）,
    〜上に) and the class labels and shapes no rule reads (い形容詞／な形容詞,
    〜しか〜ない) -- and for those the honest answer to "is it in this
    sentence" is no answer. 作文 asks here before printing its found /
    not-found hint, and prints nothing when the answer is False. Read
    once per point, like _confirmed, and only when asked. A point a
    rule reads only in part (_PARTIAL) is not trusted either, however
    often its lessons are found."""
    if pattern in _PARTIAL:
        return False
    found = find(pattern)
    if found is None:
        return False
    level, entry = found
    return any(
        (hit["pattern"], hit["level"]) == (pattern, level)
        for example in entry.get("examples", [])
        if example.get("jp")
        for hit in hits(example["jp"])
    )


def _all_particles(tokens, start: int, end: int) -> bool:
    inside = [t for t in tokens or () if start <= t.start and t.end <= end]
    return len(inside) > 1 and all(t.pos == "particle" for t in inside)


_QUESTION_WORDS = frozenset({
    "何", "なに", "なん", "誰", "だれ", "どこ", "いつ", "いくつ", "幾つ", "いくら", "幾ら",
    "どれ", "どちら", "どっち", "どう", "どなた", "なぜ",
})


def _indefinite_ka(tokens, start: int) -> bool:
    """Whether the か at `start` makes a question word indefinite --
    いくつか, 何匹か, 誰か: "some", not a question. A counter may stand
    between (何匹, 何人)."""
    before = [t for t in tokens or () if t.end <= start]
    if not before:
        return False
    last = before[-1]
    if last.surface in _QUESTION_WORDS or last.lemma in _QUESTION_WORDS:
        return True
    if last.pos == "suffix" and len(before) > 1:
        head = before[-2]
        # 何 + 匹, and いく + つ, which the tokenizer cuts out of いくつ.
        return (head.surface in _QUESTION_WORDS or head.lemma in _QUESTION_WORDS
                or head.surface + last.surface in _QUESTION_WORDS)
    return False


def _detect(sentence: str, tokens) -> list[tuple[str, str, int, int, str, tuple[tuple[int, int], ...]]]:
    if not sentence:
        return []
    if tokens is None:
        tokens = morphology.tokenize(sentence)

    if not tokens:
        # Nothing can be called a marker without a tokenizer to say what
        # part of speech the hit landed on, and the containment rule
        # below needs to know a contiguous hit from a two-part one:
        # _legacy only ever reports contiguous ones, so each is written
        # on the one piece it spans.
        found = [(p, lv, s, e, "pattern", True, ((s, e),)) for p, lv, s, e in _legacy(sentence)]
    else:
        spans = {(t.start, t.end): t for t in tokens}
        firsts = {t.start: t for t in tokens}
        found = []
        for level, pattern, parts, _examples in _catalogue():
            if pattern in _RULE_ONLY:
                continue
            for start, end, _pos, contiguous, _spelling, segments in _shaped(sentence, tokens, level, pattern, parts):
                found.append((pattern, level, start, end,
                              _kind(pattern, spans.get((start, end))), contiguous, segments))
        # The second pass, on the same footing: a hit the first pass
        # also made is one hit (the dedupe below), a wider reading of
        # the same point wins, and a form inside a longer construction
        # is that one's (the containment rule below) -- the られ of
        # 食べさせられた is the causative-passive's, not a passive.
        for pattern, level, start, end in _form_hits(tokens):
            # A word-point's span may take in the ending it carries (the
            # copula's だった, ではない) and is still the word it starts on.
            token = spans.get((start, end)) or ((firsts.get(start)) if "〜" not in pattern else None)
            found.append((pattern, level, start, end, _kind(pattern, token), True, ((start, end),)))

    if tokens:
        found = [_through_negative(tokens, h) for h in found]
        found = [h for h in found if not (h[0] in _NEEDS_A_CLAUSE and _ends_its_sentence(tokens, h[3]))]
        # (A construction inside a longer one is that one's to explain --
        # the とは of とはいえ -- and the containment rule below settles it.)
        whole = [(h[2], h[3]) for h in found if h[5]]
        found = [h for h in found
                 if not (_refused(tokens, h[0], h[2], h[3], h[6])
                         and not ("〜" in h[0] and any((s, e) != (h[2], h[3]) and s <= h[2] and h[3] <= e
                                                       for s, e in whole)))]
    shadowed = _shadowed()
    plain_spans = {(h[2], h[3]) for h in found if not _sense(h[0])}
    found = [h for h in found
             if h[0] not in shadowed and not (_sense(h[0]) and (h[2], h[3]) in plain_spans)]
    # The で of ではない is the copula, not the particle of place or
    # means it is spelled like (plan 149).
    copula_de = {h[2] for h in found if h[0] == "です／だ" and sentence[h[2]:h[2] + 1] == "で" and h[3] - h[2] > 1}
    found = [h for h in found if not (h[0] == "で" and h[2] in copula_de)]
    # A point in several parts is read on its TIGHTEST parts, each part
    # used once: コーヒーか紅茶か、どちらがいいですか is コーヒー[か]紅茶[か]
    # and not the first か and the question's -- the widest reading won
    # before plan 150, and it lit a か that is no part of the choice.
    kept: list = []
    used: dict[tuple[str, str], list[tuple[int, int]]] = {}
    for h in sorted((h for h in found if not h[5]), key=lambda h: (h[3] - h[2], h[2])):
        taken = used.setdefault((h[0], h[1]), [])
        if any(a < d and c < b for a, b in h[6] for c, d in taken):
            continue
        taken.extend(h[6])
        kept.append(h)
    found = [h for h in found if h[5]] + kept
    found.sort(key=lambda h: (h[2], -(h[3] - h[2])))
    deduped: list[tuple[str, str, int, int, str, bool, tuple[tuple[int, int], ...]]] = []
    covered: dict[tuple[str, str], list[tuple[int, int]]] = {}
    for pattern, level, start, end, kind, contiguous, segments in found:
        seen = covered.setdefault((pattern, level), [])
        if any(s <= start and end <= e for s, e in seen):
            continue
        seen.append((start, end))
        deduped.append((pattern, level, start, end, kind, contiguous, segments))

    # A point wholly inside a longer CONTIGUOUS one is that one's own
    # machinery, not a second rule: the と of 食べようとした is
    # 〜ようとする's と and never the conditional 〜と, and the ます inside
    # ました is the ました. A multi-part point explains nothing it
    # encloses -- もう〜ました reaches from もう to the end of the
    # sentence, and everything the learner is actually reading lies
    # between the two. Equal spans are left alone: two points really can
    # be written the same way, and a span cannot choose between them
    # (see _catalogue on the sense-qualified ones).
    #
    # A MARKER is kept whatever encloses it (plan 095): the が of
    # ことができます is the subject が, and the row that particle stands
    # on is where a learner asks what it is doing -- a row with nothing
    # to open was the one kind that went nowhere. The construction is
    # still reported over it, and a screen lists the construction's
    # parts beside its name.
    #
    # Except inside a WORD the catalogue files as a point of its own --
    # one written without 〜, 何か／誰か／どこか, だから, それから -- whose
    # letters are that word's: the か of 何か is not the question's か
    # (plan 149).
    #
    # And inside a construction made of particles alone (〜でも is で + も):
    # 誰でも's で is no particle of place, its も no "also".
    words = [(s, e) for p, _l, s, e, _k, whole, _segs in deduped if whole and "〜" not in p]
    words += [(s, e) for p, _l, s, e, k, whole, _segs in deduped
              if whole and k != "marker" and _all_particles(tokens, s, e)]
    deduped = [h for h in deduped if not (h[0] == "か" and _indefinite_ka(tokens, h[2]))]
    return [
        (pattern, level, start, end, kind, segments)
        for pattern, level, start, end, kind, _c, segments in deduped
        if (kind == "marker" and not any((s, e) != (start, end) and s <= start and end <= e for s, e in words))
        or (kind != "marker" and not any(
            whole and (s, e) != (start, end) and s <= start and end <= e
            for _p, _l, s, e, _k, whole, _segs in deduped
        ))
    ]
