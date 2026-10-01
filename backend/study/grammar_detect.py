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
   gives every point three to five example sentences that use it.
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


# ── A pattern in the other spelling (plan 152) ──────────────────
# The first pass matches the letters the catalogue wrote, and a
# grammatical word has two spellings: 〜にしたがって is に従って in half
# the texts, 〜に比べて is にくらべて, 〜ことができる is 事が出来る in
# older prose, お〜ください お〜下さい. Each pair here is the same word
# read the same way (tests/test_grammar_precision holds every one to
# that), and a spelling that is also another word is left out or
# guarded: を持って is "holding", never 〜をもって (whose spelling is 以て),
# に取って "taking", never 〜にとって; 物 is a thing where もの is 〜ものだ;
# 様 is さま as often as よう; に代わって is also に変わって, "turning into";
# 駅に止まらず is a train not stopping, never 〜にとどまらず. And three
# spellings a review found more often the verb than the point, with no
# sign to tell them apart: に当たって (a ball, a wall, a lottery),
# を巡って (touring), と言っても (彼に何と言っても無駄だ, "whatever you
# say to him"). 所 is a place far more often than ところだ's moment,
# and 事 a matter wherever the construction around it is not fixed.
# Matching by the verb's lemma instead would have been wrong twice over:
# UniDic files 〜をもって's もっ under 持つ and 〜にこたえて's こたえ under
# 答える.
_SPELLINGS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # kana in the catalogue, kanji on the page
    ("でき", ("出来",)), ("くださ", ("下さ",)), ("わけ", ("訳",)),
    ("はず", ("筈",)), ("ため", ("為",)), ("おかげ", ("お陰", "お蔭")), ("ほしい", ("欲しい",)),
    ("すぎ", ("過ぎ",)), ("にしたがっ", ("に従っ",)), ("にわたっ", ("に渡っ", "に亘っ")),
    ("をもって", ("を以て", "を以って")),
    ("にこたえ", ("に応え",)), ("をこめ", ("を込め", "を籠め")), ("にかかわ", ("に関わ", "に拘わ")),
    ("もかかわ", ("も関わ", "も拘わ")), ("にとどまら", ("に留まら",)),
    ("にひきかえ", ("に引き換え", "に引きかえ")), ("にたえ", ("に堪え",)),
    ("につれ", ("に連れ",)), ("といえども", ("と雖も",)), ("といっても過言", ("と言っても過言",)),
    ("といったら", ("と言ったら",)),
    # kanji in the catalogue, kana on the page
    ("に即し", ("にそくし",)), ("を踏まえ", ("をふまえ",)), ("に越し", ("にこし",)),
    ("限っ", ("かぎっ",)), ("限ら", ("かぎら",)), ("に伴っ", ("にともなっ",)), ("に基づい", ("にもとづい",)),
    ("を問わ", ("をとわ",)), ("に応じ", ("におうじ",)), ("に加え", ("にくわえ",)),
    ("に先立っ", ("にさきだっ",)), ("に反し", ("にはんし",)), ("を通じ", ("をつうじ",)),
    ("に際し", ("にさいし",)), ("に沿っ", ("にそっ",)), ("に決まっ", ("にきまっ",)),
    ("に対し", ("にたいし",)), ("に関し", ("にかんし",)), ("に比べ", ("にくらべ",)),
    ("に見え", ("にみえ",)), ("が見え", ("がみえ",)), ("が聞こえ", ("がきこえ",)), ("と思", ("とおも",)),
    ("に行き", ("にいき",)), ("次第", ("しだい",)), ("通り", ("とおり", "どおり")),
)

# A spelling safe in one point only: 時 is とき in 〜とき and じ in
# 七時, and is held to its reading as well (_misread).
_POINT_SPELLINGS: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "〜とき": (("とき", ("時",)),),
    "何か／誰か／どこか": (("何か", ("なにか",)), ("誰か", ("だれか",))),
    # 事 where the construction is fixed around it (事が出来る, 事がある,
    # 事にする): not the bare nominalizer, 〜ことだ or 〜ことに, where
    # 事の次第, よくある事だ are "the matter"
    **{p: (("こと", ("事",)),) for p in (
        "〜ことができます", "〜ことがある", "〜ことにする", "〜ことになる", "〜ことはない", "〜ということだ",
        "〜ことなく", "〜に越したことはない", "〜に限ったことではない", "〜ないことには", "〜ないことはない",
        "〜ことになっている", "〜ことにしている", "〜までのことだ")},
}


# A kanji cut short is still the word (と思, に行き); the same letters in
# kana are the start of others -- とおも of とおもしろい, にいき of
# にいきなり, にいた of 家にいた and にいたします, which is why 〜に至る
# has no kana spelling here at all. Written in kana, these keep their
# endings.
_BARE_KANA = frozenset({"とおも", "にいき"})


def _respelled(pattern: str, needles: tuple[str, ...]) -> tuple[str, ...]:
    """`needles` and each written in the other spelling of every word
    _SPELLINGS knows, in every combination (事が出来ます)."""
    out = list(needles)
    for segment, alternates in (*_SPELLINGS, *_POINT_SPELLINGS.get(pattern, ())):
        out += [n.replace(segment, alt) for n in list(out) if segment in n for alt in alternates]
    return tuple(n for n in dict.fromkeys(out) if n not in _BARE_KANA)


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
        needles = [_respelled(pattern, _needles(p)) for p in pieces if p]
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
                # 行って, never the い音便 of 書いて: ていい is て + いい
                # (しなくていい), no 〜ていく (plan 151)
                forms = [f for f in forms if f != word[:-1] + "い"] + [word[:-1] + "っ"]
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
    if len(full) >= 2 and full[0] in "たて" and not full.startswith(_NEVER_VOICED):
        # The voiced citation is the citation (読んだら, 飲んだり, 読んでも),
        # not a truncation to be held to _distinctive: it was dropped as
        # two hiragana, and 読んだら had no 〜たら (plan 151).
        found.insert(1, ("だ" if full[0] == "た" else "で") + full[1:])
    if full.startswith(_NEVER_VOICED):
        # stems() voices a pattern's first た／て as a verb's past or te
        # ending voices after ん (読んだら, 読んで); the た of ため, たび,
        # たい, たがる is another word, and だめに is 駄目 + に, not
        # 〜ために (plan 151).
        found = [n for n in found if not n.startswith(("だ", "で"))]
    return tuple(dict.fromkeys(found))


# Pattern openings whose た is not the past auxiliary, so never voiced.
_NEVER_VOICED = ("ため", "たび", "たい", "たく", "たがる", "たとえ", "たりとも", "たる")


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
    closes: list[list[tuple[bool, bool, int]]] = [[] for _ in parts]
    for index, sentence in enumerate(examples):
        tokens = morphology.tokenize(sentence)
        if not tokens:
            continue
        starts = {t.start for t in tokens}
        ends_at = {t.end for t in tokens}
        for start, end, pos, _c, spelling, _segments in _hits(sentence, tokens, parts):
            seen[spelling].append((start in starts, pos, _before(start, tokens), _ending(end, tokens), index))
            tails[spelling].append((start in starts, _tail(end, tokens), "", "", index))
            closes[spelling].append((start in starts, end in ends_at, index))

    out = []
    for signatures, ends, closed in zip(seen, tails, closes):
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
            # Whether it always ends where a word ends (plan 151): 〜ておく
            # and 〜たら do in every lesson, and どうしておくれた (どうして +
            # 遅れた) and やられたらしく (た + らしい) stop inside a word.
            bool(closed) and all(c for stood, c, _i in ([x for x in closed if x[0]] or closed)),
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
         if heads else befores, stands, endings, tails, closes)
        for heads, befores, stands, endings, tails, closes in shapes
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
    t = _tail_token(end, tokens)
    if t is None:
        return ""
    # ない is an ending whatever the tokenizer calls it -- an adjective
    # after a く or a は (高くない, ではない), an auxiliary after a verb --
    # and a word only after a noun (遠慮ない, 間違いない).
    if t.lemma in ("無い", "ない"):
        i = tokens.index(t)
        if i == 0 or tokens[i - 1].pos not in ("noun", "pronoun"):
            return "auxiliary"
    return t.pos


def _tail_token(end: int, tokens):
    for t in tokens:
        if t.start < end <= t.end:
            return t
    return None


_FUNCTION = frozenset({"particle", "auxiliary", "symbol"})


def _coarse_kind(pos: str) -> str:
    return "function" if pos in _FUNCTION else "content"


_PREDICATE_NOUNS = ("こと", "もの", "ところ", "予定", "わけ")


@lru_cache(maxsize=None)
def _noun_da(pattern: str) -> bool:
    """Whether the pattern is a noun made a predicate by its copula:
    〜ことだ, 〜ものだ, 〜ところだ, 〜ということだ, 〜予定だ."""
    return any(alt.endswith(tuple(n + "だ" for n in _PREDICATE_NOUNS)) for alt in alternatives(pattern))


@lru_cache(maxsize=None)
def _ends_in_da(pattern: str) -> bool:
    return any(alt.endswith("だ") for alt in alternatives(pattern))


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
    if token.pos == "adnominal" and token.surface in ("そんな", "こんな", "あんな", "その", "この", "あの"):
        # そんなはずがない, そんなわけがない, そのはずです: the reason and
        # the expectation said of what was just said (plan 152)
        at = next((t for t in tokens if t.start == start), None)
        if at is not None and at.surface in ("わけ", "はず", "訳", "筈"):
            return True
    if token.lemma in ("有る", "ある") and "auxiliary" in befores:
        # である is the copula written out: 選手であるといっても is 医者だ
        # といっても (plan 152)
        k = tokens.index(token)
        if k >= 1 and _is_copula(tokens[k - 1]) and tokens[k - 1].surface == "で":
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
        # A point its lessons show opening a sentence opens a clause
        # after a comma too: the あの of もう二度と、あの店には (plan 151).
        return particle_headed or "" in befores
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
        heads, befores, stands, endings, tails, closes = (
            shape[spelling] if spelling < len(shape)
            else (frozenset(), frozenset(), False, frozenset(), frozenset(), False)
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
        if sentence[start] in "だで" and _written_unvoiced(pattern, spelling):
            # A voiced た／て is a verb's ending after ん (読んだら, 飲んでも):
            # the でも of コーヒーでも is で + も, no ending at all.
            prev = _before_token(start, tokens)
            if prev is None or (prev.pos not in ("verb", "auxiliary")
                                and not (prev.pos in _NOMINAL and _voiced_after_noun(level, pattern, spelling)
                                         and not sentence.startswith("でも", start))):
                # (A noun's でも is 〜でも's, whose lesson tells "even"
                # from "or something" -- コーヒーでも飲みませんか.)
                continue
        # A hit that stops inside a word is reading that word's first
        # letters as the point's last ones, which is right only where the
        # point really ends in that kind of word: 〜てしまう in
        # なくしてしまいました ends inside a verb, as its lessons do; the
        # でも of 学校でもらった (で, then もらった) does not, since 〜でも
        # ends on the particle も (plan 150).
        noun_da = _noun_da(pattern)
        if noun_da and not sentence[start:end].endswith(("だ", "です", "でし", "だっ", "である")):
            # ことだ, ものだ, ところだ written short of their copula are the
            # nouns こと, もの, ところ unless the copula follows: ということを
            # is "the fact that", ごう慢なところがある "a side of him" (plan 151).
            after = next((t for t in tokens if t.start == end), None)
            if after is None or not _is_copula(after):
                continue
        if tails and not (_ends_in_da(pattern) and _is_copula(_tail_token(end, tokens) or tokens[0])) and (
                _tail(end, tokens) not in tails if end not in ends
                else _coarse_kind(_tail(end, tokens)) not in {_coarse_kind(k) for k in tails}):
            # (At a word's edge only function against content word: the ない
            # of しかなかった is an adjective to the tokenizer, and the で of
            # おかげで a particle in one sentence and the copula in the next.)
            continue
        if closes and end not in ends:
            # A point its lessons always end on a word's edge stops on one
            # here too -- except in the copula a pattern written with だ
            # ends on, which only conjugates: ものだった is 〜ものだ, and
            # takes its た along. (〜もので + す is not 〜もので.)
            held = next((t for t in tokens if t.start < end < t.end), None)
            if held is None or not _is_copula(held) or not _ends_in_da(pattern):
                continue
            after = next((t for t in tokens if t.start == held.end), None)
            end = after.end if after is not None and after.lemma == "た" else held.end
            _segments = tuple(_segments[:-1]) + ((_segments[-1][0], end),)
            hit = (start, end, pos, contiguous, spelling, _segments)
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


@lru_cache(maxsize=None)
def _voiced_after_noun(level: str, pattern: str, spelling: int) -> bool:
    """Whether the point's own lessons show its voiced form after a noun
    or a な-adjective: 残念でならない is 〜てならない's, and no lesson of
    〜ても writes でも after a noun (plan 151)."""
    entry = _by_name().get((level, pattern))
    if entry is None:
        return False
    _, _, parts, examples = entry
    for sentence in examples:
        tokens = morphology.tokenize(sentence)
        for start, _end, _pos, _c, sp, _segs in _hits(sentence, tokens or [], parts) if tokens else ():
            prev = _before_token(start, tokens)
            if sp == spelling and sentence[start] in "だで" and prev is not None and prev.pos in _NOMINAL:
                return True
    return False


@lru_cache(maxsize=None)
def _written_unvoiced(pattern: str, spelling: int) -> bool:
    """Whether the catalogue writes this spelling's first piece with た／て,
    so a hit opening on だ／で is its voiced form (plan 151)."""
    alts = alternatives(pattern)
    if spelling >= len(alts):
        return False
    first = next((piece for piece in alts[spelling].split("〜") if piece), "")
    return first[:1] in "たて"


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
    return "" if token.reading.translate(_SAID) == token.lemma_reading.translate(_SAID) else _form_head(token.cform)


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


def _stem_before(token, core) -> bool:
    """Whether a tail can stand on `token`: a verb or an adjective, or
    the passive and the causative, which conjugate as verbs do
    (解決されなければならない, 食べさせたい) -- and, for a tail that opens
    on ない, the copula's で, whose negative it is (静かでなければならない,
    学生でなくてもいい) (plan 151)."""
    if token.pos in _INFLECTING_POS:
        return True
    if token.pos != "auxiliary":
        return False
    if token.lemma_reading in _PASSIVE or token.lemma_reading in _CAUSATIVE:
        return True
    return token.surface == "で" and token.lemma == "だ" and bool(core) and core[0][1] == "ない"


def _stem_spans(tokens, core, relaxed: bool = False) -> list[tuple[int, int]]:
    """A stem tail: its tokens, right after a verb or adjective, on a
    token grammaticalised there."""
    out = []
    for i in range(1, len(tokens)):
        if not _stem_before(tokens[i - 1], core) or not _grammaticalised(tokens[i]):
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


# UniDic's reading is the word as said, its lemma's reading as spelled:
# 続ける is read つずけ and spelled つづける, 片づける かたずける (plan 151,
# where both were taken for potentials).
_SAID = str.maketrans("づぢ", "ずじ")


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
            if stem is not None and (stem + "る").translate(_SAID) != t.lemma_reading.translate(_SAID):
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


_NUMERAL_CHARS = frozenset("〇一二三四五六七八九十百千万億兆0123456789０１２３４５６７８９何幾数")
_ONE_TOKEN_COUNTS = frozenset({"一人", "二人", "独り"})
# 何, 幾 and 数 alone count nothing: 何も is "nothing" (も's own lesson).
_NOT_A_COUNT = frozenset({"何", "幾", "数", "なに", "なん"})


def _sentence_after(tokens, end: int):
    out = []
    for t in (t for t in tokens if t.start >= end):
        if t.pos == "symbol" and t.surface in _UTTERANCE_ENDS:
            break
        out.append(t)
    return out


def _is_numeral(t) -> bool:
    """A number, or 何／幾／数 standing for one (何時間, 幾日, 数人)."""
    return t is not None and bool(t.surface) and t.pos in ("noun", "prefix", "pronoun") and all(
        c in _NUMERAL_CHARS for c in t.surface) or (t is not None and t.lemma == "一" and t.surface in ("ひと", "ふた"))


def _counted_before(tokens, i: int):
    """The index where a number and its counter start, when they end
    right before tokens[i] -- 十時間, 三度, 何年間, 十二, だれ一人's 一人,
    ひとつ -- or None."""
    if i < 1:
        return None
    prev = tokens[i - 1]
    if prev.lemma in _ONE_TOKEN_COUNTS or (_is_numeral(prev) and prev.surface not in _NOT_A_COUNT):
        k = i - 1
    elif (prev.pos in ("suffix", "noun") and len(prev.surface) <= 2 and i >= 2
          and _is_numeral(tokens[i - 2]) and not _is_numeral(prev)):
        k = i - 2
    else:
        return None
    while k >= 1 and _is_numeral(tokens[k - 1]):
        k -= 1
    return k


# The counters the lesson names: its three, and the three its careful
# step adds (本 for long things, 冊 for books, 匹 for small animals).
_TAUGHT_COUNTERS = frozenset({"つ", "人", "枚", "本", "冊", "匹"})


def _counter_spans(tokens):
    """A counter the lesson teaches, after a number: 三本's 本 is no
    "book", nor 二冊's 冊 a word of its own (plan 151). 一人 and 二人
    are one token each."""
    out = []
    for i, t in enumerate(tokens):
        if t.lemma in _ONE_TOKEN_COUNTS and not t.surface.startswith("独"):
            # (独り is "alone", no count; 二人三脚 is a word, where
            # 二人とも is "both of them" and counts)
            if not (i + 1 < len(tokens) and tokens[i + 1].pos == "noun"):
                out.append((t.start, t.end))
        elif (t.surface in _TAUGHT_COUNTERS and t.pos in ("suffix", "noun") and i >= 1
              and _is_numeral(tokens[i - 1])):
            out.append((t.start, t.end))
    return out


def _emphatic_mo_spans(tokens):
    """〜も（強調）: a number and its counter, then も -- 十時間も, 三度も,
    一人も来なかった -- the amount stressed, no "also". Not もの after a
    number (五十種類もの), which the tokenizer reads as a noun."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos != "particle" or t.surface != "も":
            continue
        k = _counted_before(tokens, i)
        if k is not None:
            out.append((tokens[k].start, t.end))
    return out


def _must_at(tokens, i: int):
    """The index of the negative closing a "must" that opens at
    tokens[i]: なくてはいけない, and the halves its lesson says are mixed
    -- なくてはならない, なければいけない -- or None."""
    t = tokens[i]
    if not (t.lemma == "ない" and t.pos == "auxiliary") and not (
            # after the copula and an adjective, the negative is 無い
            # (静かでなければ, 高くなくては), never after a noun's が
            t.lemma == "無い" and i >= 1 and (_is_copula(tokens[i - 1])
                                             or (tokens[i - 1].pos == "adjective"
                                                 and tokens[i - 1].cform.startswith("連用形")))):
        return None
    if t.surface == "なく":
        j = i + 1
        if not (j + 1 < len(tokens) and tokens[j].surface == "て" and tokens[j + 1].surface == "は"):
            return None
        j += 2
    elif t.surface == "なけれ":
        j = i + 1
        if not (j < len(tokens) and tokens[j].surface == "ば"):
            return None
        j += 1
    else:
        return None
    if j >= len(tokens) or tokens[j].pos != "verb" or tokens[j].surface not in ("いけ", "なら", "なり"):
        return None
    if t.surface == "なけれ" and tokens[j].surface != "いけ":
        return None                     # なければならない is 〜なければなりません's
    k = j + 1
    if k < len(tokens) and tokens[k].lemma == "ない":
        return k
    if k + 1 < len(tokens) and tokens[k].lemma == "ます" and tokens[k + 1].lemma == "ず":
        return k + 1
    return None


def _must_spans(tokens):
    """〜なくてはいけない with the halves its lesson names as mixed
    (なくてはならない, なければいけない), which the letters of neither
    must-point cover and which otherwise read as an "if" (〜ば), a
    potential (いけ) and a prohibition (〜てはならない)."""
    out = []
    for i in range(len(tokens)):
        k = _must_at(tokens, i)
        if k is not None:
            out.append((tokens[i].start, tokens[k].end))
    return out


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


# ── The embedded question (plan 152) ──────────────────────────
# 〜か（間接疑問） is written as one か, which the letters can never tell
# from the か that asks: the point is a clause holding a question word,
# closed by か and then handed to a verb of knowing, telling or thinking
# (いつ来るか知っていますか). Read by words, like every rule here, and
# held to the point's own lessons (_confirmed).

# Question words by lemma, adding what _QUESTION_WORDS leaves out: なぜ
# (何故), どんな, どの (何の), 幾つ's いく (幾), いかに, 何者.
_ASKING_LEMMAS = frozenset({"何", "誰", "何時", "何処", "何れ", "何方", "幾ら", "幾", "幾つ", "何故",
                            "どう", "どんな", "何の", "どなた", "如何に", "いかに", "何者"})

# What an embedded question is handed to: knowing, telling, asking,
# deciding, thinking, looking and worrying about which.
_TOLD_TO = frozenset({
    "知る", "分かる", "判る", "解る", "教える", "聞く", "訊く", "尋ねる", "考える", "調べる",
    "決める", "決まる", "覚える", "忘れる", "思い出す", "確かめる", "確認", "知らせる", "説明",
    "答える", "心配", "迷う", "相談", "話し合う", "想像", "予想", "見当", "興味", "気", "注目",
    "言う", "話す", "見る", "見せる", "書く", "理解", "判断", "記録", "数える", "比べる", "伺う",
    "存じる", "分析", "研究", "検討", "議論", "報告", "予測", "推測", "探す", "気付く", "気づく",
    "不明", "謎", "疑問", "ご存じ", "存知", "問う", "問題",
})

# A clause ends at a conjunctive particle, but not at the て of どうして
# nor the ば of どうすればいいか, whose question spans it.
_CLAUSE_JOINS = frozenset({"けど", "けれど", "けれども", "が", "から", "ので", "のに", "ても", "し"})

# The nouns a question is asked about, before は／が: これは何か, 原因は
# 何か, 試験はいつか. A person before は is the one who knows (彼は何か
# 知っている, "he knows something"), and there 何か is "something".
_ASKED_ABOUT = frozenset({
    "これ", "それ", "あれ", "ここ", "そこ", "あそこ", "こちら", "そちら", "の", "ん",
    "原因", "理由", "問題", "目的", "答え", "正解", "正体", "意味", "場所", "時間", "日時", "日付",
    "名前", "犯人", "相手", "誕生日", "締め切り", "締切", "期限", "値段", "住所", "番号", "趣味",
    "職業", "出身", "試験", "会議", "集合", "結果", "真相", "違い", "方法", "やり方", "行き先",
    "目的地", "次", "予定", "犯行", "目標", "中身", "内容", "作者", "持ち主", "首都", "出口",
    "入口", "トイレ", "会場", "故郷", "担当", "担当者", "責任者", "由来", "語源", "定義", "条件",
})

# What a count is handed to when it asks (学生は何人か知っていますか):
# knowing and telling only -- その問題は何度か説明した is "several times".
_KNOW = frozenset({"知る", "分かる", "判る", "解る", "教える", "聞く", "訊く", "尋ねる", "調べる", "確かめる",
                   "確認", "知らせる", "ご存じ", "存じる"})


def _idle_question_word(tokens, j: int) -> bool:
    """Whether the question word at tokens[j] asks nothing: 何か, 誰も,
    いつでも ("something", "nobody", "whenever"), with a counter between
    (いくつか, 何回か, 何度も: "several", "again and again") or a particle
    (誰にも, いつまでも, どこからか), and the set phrases どうしても and
    何となく."""
    k = j + 1
    if k < len(tokens) and tokens[k].pos in ("suffix", "noun") and len(tokens[k].surface) <= 2 \
            and tokens[k].pos != "pronoun" and tokens[j].lemma in ("何", "幾"):
        k += 1                                          # 何回か, 何人も, いくつか
    while k < len(tokens) and tokens[k].pos == "particle" and tokens[k].surface in ("に", "へ", "から", "まで", "と", "で"):
        if tokens[k].surface == "と" and k + 1 < len(tokens) and tokens[k + 1].pos == "verb":
            break                                       # 何と言ったか asks
        k += 1
    if k < len(tokens) and tokens[k].pos == "particle" and tokens[k].surface in ("か", "も", "でも"):
        return True
    words = "".join(t.surface for t in tokens[j:j + 4])
    return words.startswith(("どうしても", "何となく", "なんとなく"))


def _asks_in_clause(tokens, k: int) -> bool:
    """Whether a question word that asks stands in the clause the か at
    tokens[k] closes."""
    for j in range(k - 1, -1, -1):
        t = tokens[j]
        if t.pos == "symbol" or (t.pos == "particle" and (t.surface == "か" or
                                                          (t.conjunctive and t.surface in _CLAUSE_JOINS))):
            return False
        if (t.lemma in _ASKING_LEMMAS or t.surface in _QUESTION_WORDS) and not _idle_question_word(tokens, j):
            return True
    return False


def _handed_on(tokens, k: int, particles: bool) -> bool:
    """Whether what follows the か at tokens[k] takes the question in:
    the first predicate after it is a verb of knowing or telling --
    past a comma, an adverb, a person told (何を買ったか、彼に聞かれた),
    an honorific お (お教えください) -- or, `particles`, a case particle
    makes the question a noun (いつ来るかが問題だ, 何をするかは自由だ)."""
    after = tokens[k + 1:]
    if not after:
        return False
    first = after[0]
    if first.surface == "どう":
        return False                                   # かどうか: its own point
    if particles and first.pos == "particle" and first.surface in ("が", "は", "を", "も", "に", "で", "さえ"):
        if first.surface == "も" and len(after) > 1 and after[1].lemma in ("知れる", "しれる"):
            return False                               # かもしれない
        return True
    if first.pos == "particle" and first.surface in ("な", "ね", "よ", "しら", "と"):
        return False                                   # かな, かね, かと思う
    for t in after[:10]:
        if t.lemma in _TOLD_TO or t.surface in _TOLD_TO:
            return True
        if t.pos == "symbol" and t.surface not in _COMMAS:
            return False
        if t.pos in ("verb", "auxiliary") or (t.pos == "adjective" and not t.cform.startswith("連用形")):
            return False                               # the first predicate says nothing of knowing
    return False


def _asked_about(tokens, i: int) -> bool:
    """Whether the question word at tokens[i] is said of a noun asked
    about before は／が: これは何か, 原因は何か, 試験はいつか, 空が青いの
    はなぜか (plan 152)."""
    return (i >= 2 and tokens[i - 1].pos == "particle" and tokens[i - 1].surface in ("は", "が")
            and (tokens[i - 2].lemma in _ASKED_ABOUT or tokens[i - 2].surface in _ASKED_ABOUT))


def _embedded_question_at(tokens, k: int) -> bool:
    """Whether the か at tokens[k] closes an embedded question: a plain
    clause holding a question word (いつ来るか, 何をしているのか, どうすれば
    いいか, 何を食べようか), or the question word itself said of what is
    asked about (犯人は誰か, 会議は何時からか), then a verb that takes it
    in. Never a polite clause (いつ来ますか知っていますか, which its
    lesson marks wrong), a question at the end (いつ来るか。), 何だか
    ("somehow"), かどうか or かもしれない -- and never a question word
    said of a person (彼は何か知っている is "he knows something")."""
    t = tokens[k]
    if t.pos != "particle" or t.surface != "か" or k == 0:
        return False
    prev = tokens[k - 1]
    if prev.pos in ("verb", "adjective", "auxiliary"):
        if prev.lemma in ("ます", "です", "だ") or not prev.cform.startswith(("終止形", "連体形", "意志推量形")):
            return False
        return _asks_in_clause(tokens, k) and _handed_on(tokens, k, particles=True)
    if prev.pos == "particle" and prev.surface in ("の", "ん") and k >= 2:
        # のか: 何をしているのか, なぜなのか
        before = tokens[k - 2]
        if before.pos in ("verb", "adjective", "auxiliary") or before.surface == "な":
            return _asks_in_clause(tokens, k - 1) and _handed_on(tokens, k, particles=True)
    # The question word itself before か, a counter or a particle between
    # (何時か, 何人か, 何時からか, いつまでか, 誰のか): said of what is
    # asked about, or it is "some-".
    j = k - 1
    if prev.pos == "particle" and prev.surface in ("から", "まで", "の", "へ") and j >= 1:
        j -= 1
    counted = (tokens[j].pos in ("suffix", "noun") and j >= 1 and tokens[j - 1].lemma in ("何", "幾")
               and len(tokens[j].surface) <= 2)
    if counted:
        j -= 1
    head = tokens[j]
    if head.lemma in _ASKING_LEMMAS or head.surface in _QUESTION_WORDS:
        # どこの誰か: two question words asking together
        paired = (j >= 2 and tokens[j - 1].surface == "の"
                  and (tokens[j - 2].lemma in _ASKING_LEMMAS or tokens[j - 2].surface in _QUESTION_WORDS))
        if not (paired or _asked_about(tokens, j)) or not _handed_on(tokens, k, particles=False):
            return False
        if counted:
            told = next((x for x in tokens[k + 1:] if x.lemma in _TOLD_TO or x.surface in _TOLD_TO), None)
            return told is not None and (told.lemma in _KNOW or told.surface in _KNOW)
        return True
    if prev.pos in ("noun", "pronoun", "suffix", "other"):
        # どんな人か知りたい: a noun closing a clause that asks. Only a
        # verb that takes a question in, never a particle (何かが is
        # "something").
        return _asks_in_clause(tokens, k) and _handed_on(tokens, k, particles=False)
    return False


def _nandaka(tokens, i: int) -> bool:
    """なんだか ("somehow", "sort of"): 何 + だ + か to the tokenizer,
    and no question."""
    return i >= 2 and tokens[i - 1].surface == "だ" and tokens[i - 2].lemma == "何"


def _embedded_question_spans(tokens):
    return [(t.start, t.end) for k, t in enumerate(tokens) if _embedded_question_at(tokens, k)]


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


def _soretomo(tokens, i: int) -> bool:
    """Whether tokens[i] is a letter of それとも ("or"), which the
    tokenizer writes as それ + と + も: no "that one", "and" or "also"
    (plan 151)."""
    for k in range(max(0, i - 2), i + 1):
        if (k + 2 < len(tokens) and tokens[k].surface == "それ" and tokens[k + 1].surface == "と"
                and tokens[k + 2].surface == "も" and k <= i <= k + 2):
            return True
    return False


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
    if _soretomo(tokens, i):
        return True                                    # それとも: "or"
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


def _kadouka_spans(tokens):
    """〜かどうか after a noun as after a predicate (本当かどうか, 学生か
    どうか): the lessons show only the second, and the letters were held
    to them (plan 152)."""
    out = []
    for i in range(1, len(tokens) - 2):
        a, b, c = tokens[i], tokens[i + 1], tokens[i + 2]
        if (a.surface == "か" and a.pos == "particle" and b.surface == "どう" and c.surface == "か"
                and tokens[i - 1].pos in ("noun", "pronoun", "suffix", "other", "verb", "adjective", "auxiliary")):
            out.append((a.start, c.end))
    return out


def _in_kadouka(tokens, i: int) -> bool:
    """Whether the か at tokens[i] is one of かどうか's two."""
    return ((i + 2 < len(tokens) and tokens[i + 1].surface == "どう" and tokens[i + 2].surface == "か")
            or (i >= 2 and tokens[i - 1].surface == "どう" and tokens[i - 2].surface == "か"))


def _taishite_spans(tokens):
    """〜に対して in either spelling: に + 対し + て, and に + たいして,
    which the tokenizer reads as the adverb 大して ("(not) very") --
    after に it never is, since 大して leads a negative and takes no
    particle (plan 152)."""
    out = []
    for i in range(len(tokens) - 1):
        a, b = tokens[i], tokens[i + 1]
        if a.surface != "に" or a.pos != "particle":
            continue
        if b.surface == "たいして":
            out.append((a.start, b.end))
        elif (b.lemma == "対する" and b.surface in ("対し", "たいし") and i + 2 < len(tokens)
              and tokens[i + 2].surface == "て"):
            out.append((a.start, tokens[i + 2].end))
    return out


def _plain_before_sou(t) -> bool:
    """Whether the word before a そう is a plain form -- a verb, an
    adjective or an auxiliary in its dictionary or attributive form, or
    an adjective-like suffix (使いやすい, 男らしい, 子供っぽい)."""
    return (t.cform.startswith(("終止形", "連体形"))
            and (t.pos in ("verb", "adjective", "auxiliary") or (t.pos == "suffix" and t.ctype == "形容詞")))


def _tai_stem(tokens, i: int) -> bool:
    """Whether tokens[i], a た before そう, is たい's stem rather than a
    past: after a 五段 verb in its plain 連用形 it must be (飲みたそう,
    会いたそう -- the past is 飲んだ, 会った), save the サ行's (話した)."""
    t = tokens[i]
    if t.surface != "た" or t.pos != "auxiliary" or i == 0:
        return False
    v = tokens[i - 1]
    return (v.pos == "verb" and v.ctype.startswith("五段") and not v.ctype.startswith("五段-サ行")
            and v.cform == "連用形-一般")


# The copula that carries hearsay そう: never past (伝聞 has no そうだった,
# so 食べたそうだった looks like wanting), never な or に (そうな, そうに
# are the looks-like).
_HEARSAY_COPULA = frozenset({"だ", "です", "で", "じゃ"})


def _hearsay_spans(tokens):
    """〜そうだ（伝聞） in every register (plan 152): そう after a plain
    form -- 帰るそうだ, おいしいそうです, 雨だそうで, 来るそうよ,
    帰国するそうである -- with the copula it carries. The pattern is
    written with だ, so its letters never met the polite そうです, and
    〜そうです's rule refuses the same そう after a plain form, rightly:
    three of this point's own four lessons were left unkeyed. Never the
    そう of how a thing looks, which follows a stem (降りそう, おいしそう,
    飲みたそう), nor そうですね ("that's right"), which follows nothing."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.surface == "そう" and t.pos in ("noun", "other", "adverb") and i > 0 and i + 1 < len(tokens)):
            continue
        prev, nxt = tokens[i - 1], tokens[i + 1]
        if not _plain_before_sou(prev) or _tai_stem(tokens, i - 1):
            continue
        if _is_copula(nxt) and nxt.surface in _HEARSAY_COPULA:
            end = nxt.end
            if nxt.surface == "で" and i + 2 < len(tokens) and tokens[i + 2].lemma in ("有る", "ある"):
                end = tokens[i + 2].end                # そうである
            out.append((t.start, end))
        elif nxt.pos == "particle" and nxt.surface in ("よ", "ね", "な") and not _tai_stem(tokens, i - 1):
            out.append((t.start, t.end))               # 来るそうよ
    return out


def _looks_spans(tokens):
    """〜そうです in every register: the そう of how a thing looks (the
    tokenizer's そう-様態, a 形状詞) after a verb's stem, an adjective's
    or a noun -- 降りそうだ, おいしそうなケーキ, 元気そうに -- and after
    たい's stem (飲みたそうだ, 食べたそうな顔, 食べたそうだった: hearsay
    has no past and no そうな), with the copula it carries. The そう of
    hearsay (降るそうだ, after a plain form) is a noun to the tokenizer,
    and 〜そうだ（伝聞）'s; the そう of そうです ("that's right") an
    adverb, and neither."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.surface == "そう" and i > 0):
            continue
        prev = tokens[i - 1]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        wanting = prev.surface == "た" and prev.pos == "auxiliary" and (
            _tai_stem(tokens, i - 1)
            or (nxt is not None and (nxt.surface in ("だっ", "でし") or nxt.surface in ("な", "に"))))
        if t.pos != "other" and not (wanting and t.pos == "noun"):
            continue
        if wanting:
            pass
        elif prev.pos in ("verb", "adjective", "auxiliary"):
            # The stem: 降り, おいし, よさ. After a plain form (行くそうだ,
            # できるそうだ) it is hearsay, whatever the tokenizer tagged
            # the そう -- it reads some of those as the looks-like one.
            if not prev.cform.startswith(("連用形", "語幹")):
                continue
        elif prev.pos == "suffix" and _plain_before_sou(prev):
            continue                                   # 使いやすいそうだ: hearsay
        elif prev.pos not in ("noun", "other", "suffix"):
            continue
        if nxt is not None and nxt.pos == "particle" and nxt.surface in ("を", "が", "は", "へ", "で", "と", "から", "の"):
            continue                                   # かいそうを食べる: 海藻, no look
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


def _negative_part_refused(tokens, start: int, end: int, segments) -> bool:
    """もう〜ない, あまり〜ない and their kin: the negative must be the
    clause's, not the ません of かもしれません (姉はもう帰ったかもしれ
    ません is "already") nor that of a question or a request closed by か
    (もう一度言っていただけませんか)."""
    i = _index_at(tokens, segments[-1][0])
    if i is None:
        return False
    # もう行かなくちゃ、時間がない: the first clause closed on its own
    # predicate, and the ない is the next clause's
    between = [t for t in tokens if segments[0][1] <= t.start and t.end <= segments[-1][0]]
    for k, t in enumerate(between):
        if t.pos == "symbol" and t.surface in _COMMAS and any(
                b.pos in ("verb", "adjective", "auxiliary") for b in between[:k]):
            return True
    last = next((k for k in range(i, len(tokens)) if tokens[k].end >= segments[-1][1]), i)
    if i >= 1 and tokens[i - 1].lemma in ("知れる", "しれる"):
        return True
    rest = [t for t in tokens[last + 1:] if not (t.pos == "auxiliary" and t.lemma in ("ず", "ぬ", "た", "です"))]
    return bool(rest) and rest[0].surface == "か"


def _mo_mo_refused(tokens, start: int, end: int, segments) -> bool:
    """〜も〜も lists two things alike; the も of にもかかわらず, of
    どうしようもない or of a counter (何度も) is another word's."""
    for a, _b in segments:
        i = _index_at(tokens, a)
        if i is None:
            continue
        if i + 1 < len(tokens) and tokens[i + 1].surface.startswith("かかわら"):
            return True
        if i >= 1 and (_counter_after_nan(tokens, i - 1) or tokens[i - 1].surface in ("しよう", "よう")):
            return True
    return False


def _ka_nanika(tokens, start: int, end: int, segments) -> bool:
    return any((i := _index_at(tokens, a)) is not None and i + 2 < len(tokens)
               and tokens[i + 1].lemma == "何" and tokens[i + 2].surface == "か" for a, _b in segments)


# ── What the reviewers found (plan 151) ─────────────────────────
# Eight reviewers read 1,837 hits sampled over every point the detector
# lights -- each hit against its point's own structure, meaning and rule
# -- and flagged 213 as false. The general causes are handled above (a
# hit ends where its lessons end, a voiced ending only after a verb, a
# noun + だ with its copula, a part another construction owns); what is
# left is each point's own homographs, refused here by what stands
# around them. Each rule is pinned in tests/test_grammar_precision.py.

def _tok_at(tokens, start: int):
    i = _index_at(tokens, start)
    return (i, tokens[i]) if i is not None else (None, None)


def _tok_ending(tokens, end: int):
    """The index of the token a hit ends in."""
    for k, t in enumerate(tokens):
        if t.start < end <= t.end:
            return k
    return None


def _next_word(tokens, end: int):
    k = _tok_ending(tokens, end)
    return tokens[k + 1] if k is not None and k + 1 < len(tokens) else None


def _prev_word(tokens, start: int):
    return _before_token(start, tokens)


def _clause_before(tokens, start: int):
    """The tokens of the clause before `start`, back to a comma or the
    sentence's start."""
    out = []
    for t in reversed([t for t in tokens if t.end <= start]):
        if t.pos == "symbol" and (t.surface in _COMMAS or t.surface in _UTTERANCE_ENDS):
            break
        out.append(t)
    return out[::-1]


def _clause_after(tokens, end: int):
    out = []
    for t in (t for t in tokens if t.start >= end):
        if t.pos == "symbol" and (t.surface in _COMMAS or t.surface in _UTTERANCE_ENDS):
            break
        out.append(t)
    return out


def _after_nakute(tokens, start: int) -> bool:
    """Whether the hit at `start` follows なく: なくてはならない and
    なくちゃいけない are "must", the opposite of the prohibitions they
    are spelled with."""
    prev = _prev_word(tokens, start)
    return prev is not None and prev.surface == "なく" and prev.lemma in ("ない", "無い")


_SAYING = frozenset({"言う", "云う", "思う", "考える", "頼む", "勧める", "伝える", "注意", "合図", "命じる", "求める",
                     "祈る", "願う", "指示", "要求", "命令", "忠告", "促す", "書く", "聞く", "あてこむ", "当て込む",
                     "期待", "信じる", "見込む", "予想"})
_AUX_AFTER_TE = frozenset({"居る", "いる", "おる", "居る", "貰う", "もらう", "呉れる", "くれる", "下さる", "ください",
                           "仕舞う", "しまう", "有る", "ある", "頂く", "いただく"})
_SENSATIONS = frozenset({"音", "声", "匂い", "臭い", "におい", "味", "気", "感じ", "寒気", "さむけ", "吐き気", "頭痛",
                         "めまい", "目まい", "気配", "予感", "香り", "かおり", "響き", "物音", "耳鳴り", "痛み"})


def _volitional_refused(tokens, start, end, _g) -> bool:
    """意向形 is "let's, I'll". Not the volitional of 〜ようとする ("try
    to", its own point), of a concession (何が起ころうとも, 誰が何と
    言おうと, 来ようが来まいが) or of 〜ようものなら."""
    nxt = _next_word(tokens, end)
    if nxt is None:
        return False
    if nxt.lemma in ("物", "もの"):
        return True
    if nxt.pos == "particle" and nxt.surface in ("と", "が", "とも"):
        k = _tok_ending(tokens, end) + 2
        after = tokens[k] if k < len(tokens) else None
        if after is not None and after.surface == "も":
            return True
        return not (after is not None and after.lemma in ("思う", "考える", "決める", "決心", "言う", "ばかり"))
    return False


def _mo_refused(tokens, s, e, _g) -> bool:
    """The も of "also" is not the も of a number (一度も〜ない, 一本も:
    〜も（強調） teaches it), of よりも, or of 〜同然."""
    i, _t = _tok_at(tokens, s)
    if i is None:
        return False
    if _in_set_phrase(tokens, s) or _many_mo(tokens, s):
        return True
    prev = tokens[i - 1] if i >= 1 else None
    if _counted_before(tokens, i) is not None:
        return True
    if prev is not None and prev.surface == "より":
        return True
    nxt = tokens[i + 1] if i + 1 < len(tokens) else None
    return nxt is not None and nxt.surface.startswith("同然")


def _kakeru_refused(tokens, s, e, _g) -> bool:
    """〜かける is a verb's stem + かける ("half-done, about to"): not the
    main verb after a particle (眼鏡をかければ, 攻撃をかける) and not a
    word of its own (出かける, 投げかける are one token)."""
    k = _tok_ending(tokens, e)
    t = tokens[k] if k is not None else None
    if t is None or t.start != s:
        return True
    prev = _prev_word(tokens, s)
    return prev is None or prev.pos != "verb" or not prev.cform.startswith("連用形")


def _kotoda_refused(tokens, s, e, _g) -> bool:
    """〜ことだ (advice, "you should") ends a sentence: not ことだから,
    ことだった, ことだと, and not the predicate of a topic (彼の強みは、
    あきらめないことだ is "his strength is not giving up")."""
    nxt = _next_word(tokens, e)
    if nxt is not None and (nxt.lemma == "た" or (nxt.pos == "particle" and nxt.surface in ("から", "けど", "が", "し", "と", "って"))):
        return True
    held = _tok_ending(tokens, e)
    if held is not None and tokens[held].surface.startswith("だっ"):
        return True
    prev = _prev_word(tokens, s)
    if prev is not None and (_is_copula(prev) or prev.pos == "adjective"):
        return True
    if prev is not None and prev.lemma in ("言う", "云う") and prev.surface in ("いう", "言う"):
        return True                                    # ということだ: hearsay or a conclusion, no advice
    for t in _sentence_tokens_before(tokens, s):
        if t.pos == "particle" and t.surface == "は":
            k = tokens.index(t)
            if k >= 1 and (tokens[k - 1].lemma in _DEFINED_BY_KOTO or (tokens[k - 1].surface == "の" and tokens[k - 1].pos != "particle")
                           or (tokens[k - 1].surface == "の" and k >= 2 and tokens[k - 2].pos in ("auxiliary", "adjective"))):
                return True
    return False


# Nouns a sentence defines by a ことだ: 彼の強みは、あきらめないことだ is
# "his strength is not giving up" -- no advice (plan 151).
_DEFINED_BY_KOTO = frozenset({"強み", "弱み", "問題", "目的", "夢", "趣味", "理由", "原因", "特徴", "長所", "短所", "秘訣",
                      "方法", "役目", "役割", "願い", "望み", "楽しみ", "目標", "条件", "仕事", "課題", "欠点", "悩み",
                      "考え", "意味", "狙い", "希望", "喜び", "心配", "問い", "答え", "結論", "本当"})


def _sentence_tokens_before(tokens, start: int):
    out = []
    for t in reversed([t for t in tokens if t.end <= start]):
        if t.pos == "symbol" and t.surface in _UTTERANCE_ENDS:
            break
        out.append(t)
    return out


def _followed_by(tokens, e, *surfaces) -> bool:
    nxt = _next_word(tokens, e)
    return nxt is not None and nxt.surface in surfaces


def _followed_by_copula(tokens, e) -> bool:
    nxt = _next_word(tokens, e)
    return nxt is not None and _is_copula(nxt)


def _koto_wa_ga_refused(tokens, s, e, segments) -> bool:
    """〜ことは〜が repeats one word around ことは (安いことは安いが):
    anything else is こと + は and a が (忠告を与えることは出来るが)."""
    i, _t = _tok_at(tokens, segments[0][0])
    if i is None or i == 0:
        return True
    k = i - 1
    while k > 0 and tokens[k].pos == "auxiliary":
        k -= 1
    before = tokens[k]
    k = _tok_ending(tokens, segments[0][1])
    after = tokens[k + 1] if k is not None and k + 1 < len(tokens) else None
    return after is None or after.lemma != before.lemma


def _niwaka_refused(tokens, s, e, _g) -> bool:
    """〜にします is choosing (コーヒーにします): not 〜ことにします
    (its own point) nor making X into Y, which has an object (市場を…
    バブル状態にしました)."""
    prev = _prev_word(tokens, s)
    if prev is not None and prev.lemma in ("事", "こと"):
        return True
    return any(t.pos == "particle" and t.surface == "を" for t in _clause_before(tokens, s))


# What a quoted volitional or conjecture is handed to.
_THOUGHT = _SAYING | frozenset({"予言", "期待", "予想", "決心", "推測", "見る", "心配", "確信", "判断", "主張",
                                "説明", "話す", "叫ぶ", "答える", "約束", "誓う", "努力", "する", "為る"})


def _to_marker_refused(tokens, s, e, _g) -> bool:
    """と is "and", "with" or a quotation: not the と of 〜となる ("it
    becomes") or 〜とする, nor of 二度と ("never again")."""
    if _in_set_phrase(tokens, s):
        return True
    prev = _prev_word(tokens, s)
    nxt = _next_word(tokens, e)
    if prev is not None and prev.cform.startswith("意志推量形") and not (
            nxt is not None and (nxt.lemma in _THOUGHT or nxt.surface in _THOUGHT)):
        # だれであろうと見下す is the concession ("whoever it is"); 行こう
        # と思う, 来るだろうと思います are what is thought, and quoted
        return True
    if nxt is not None and nxt.lemma in ("成る", "為る") and nxt.pos == "verb":
        # 言うこととすることとは: "saying and doing", two nouns listed
        k = tokens.index(nxt)
        listed = tokens[k + 1:k + 3]
        return not (len(listed) == 2 and listed[0].lemma in ("事", "の") and listed[1].surface == "と")
    prev = _prev_word(tokens, s)
    return prev is not None and prev.surface == "度"


_COMPOUND_VERBS = frozenset({"就く", "付く", "つく", "取る", "対する", "因る", "依る", "関する", "於く", "おく",
                             "渡る", "沿う", "基づく", "従う", "伴う", "先立つ", "代わる", "応じる", "際する",
                             "向ける", "限る", "かける", "掛ける", "当たる", "とる"})


def _compound_ni(tokens, start: int, end: int) -> bool:
    """Whether a hit from `start` to `end` is a compound particle opened
    by に -- について, にとって, に対して, によって -- whose に is its own
    and no moment, place or receiver."""
    i, t = _tok_at(tokens, start)
    if t is None or t.surface != "に" or i + 1 >= len(tokens):
        return False
    verb = tokens[i + 1]
    return verb.pos == "verb" and verb.lemma in _COMPOUND_VERBS and verb.end <= end


def _counter_refused(tokens, s, e, _g) -> bool:
    """A counter follows a number: 野蛮人 and アメリカ人 are no count."""
    i, t = _tok_at(tokens, s)
    if t is not None and t.lemma in _ONE_TOKEN_COUNTS:
        return False
    return not _is_numeral(_prev_word(tokens, s))


def _konosoa_refused(tokens, s, e, _g) -> bool:
    """どれ is "which one": not どれくらい ("how long, how much")."""
    return sentence_like(tokens, e, ("くらい", "ぐらい", "ほど"))


def sentence_like(tokens, e, surfaces) -> bool:
    nxt = _next_word(tokens, e)
    return nxt is not None and nxt.surface in surfaces


def _ya_refused(tokens, s, e, _g) -> bool:
    """や lists nouns: not いまや, nor や否や."""
    prev = _prev_word(tokens, s)
    nxt = _next_word(tokens, e)
    if prev is None or prev.pos not in _NOMINAL or prev.surface in ("いま", "今"):
        return True
    return nxt is not None and nxt.surface.startswith("否")


def _nanika_refused(tokens, s, e, _g) -> bool:
    """何か is "something": 歩くものは何か。 asks "what is it?"."""
    nxt = _next_word(tokens, e)
    return nxt is None or (nxt.pos == "symbol" and nxt.surface in _UTTERANCE_ENDS)


def _nai_form_refused(tokens, s, e, _g) -> bool:
    """ない followed by た is no negative (the past of ない is なかった):
    ないたかと思うと is 泣いた, written in kana."""
    i, t = _tok_at(tokens, s)
    return (t is not None and t.surface == "ない" and i + 1 < len(tokens) and tokens[i + 1].lemma == "た"
            and tokens[i + 1].surface == "た")


def _explanatory_refused(tokens, s, e, _g) -> bool:
    """〜んです／〜のです explains after a predicate: 私のです is "mine"."""
    i, t = _tok_at(tokens, s)
    if t is None or t.surface not in ("の", "ん"):
        return False
    prev = _prev_word(tokens, s)
    return prev is not None and prev.pos in ("noun", "pronoun", "suffix")


def _passive_refused(tokens, s, e, _g) -> bool:
    """おられる is おる's honorific, never a passive."""
    prev = _prev_word(tokens, s)
    return prev is not None and prev.surface == "おら"


def _kotogaaru_refused(tokens, s, e, _g) -> bool:
    """〜ことがある is experience after た (行ったことがある); 粗野なこと
    がある ("there are times when") is not its lesson."""
    prev = _prev_word(tokens, s)
    return prev is None or prev.lemma != "た"


def _after_copula_na(tokens, s, e, _g) -> bool:
    """A noun modified by a な-adjective is that noun (大変なことになる,
    特異なものだった), no construction built on it."""
    prev = _prev_word(tokens, s)
    return prev is not None and (_is_copula(prev) or prev.surface in ("みたいな", "ような"))


def _toiu_refused(tokens, s, e, _g) -> bool:
    """〜という names or quotes before a noun: not といわず〜といわず,
    といえば or といえる, which conjugate いう into other points."""
    text = "".join(t.surface for t in tokens if s <= t.start < e)
    return text.endswith(("いわ", "いえ", "いっ", "言わ", "言え", "言っ"))


def _youni_refused(tokens, s, e, _g) -> bool:
    """〜ように (so that) is not the ように of a reported instruction
    (〜ように言う, its own point), of manner (好きなように), or of a
    likeness (私のように)."""
    nxt = _next_word(tokens, e)
    if nxt is not None and (nxt.lemma in _SAYING or nxt.surface in _SAYING):
        return True
    prev = _prev_word(tokens, s)
    return prev is not None and (_is_copula(prev) or prev.surface == "の")


def _toka_to_refused(tokens, s, e, _g) -> bool:
    """The conditional 〜と is not a quotation (終わるとあてこんでいた)."""
    nxt = _next_word(tokens, e)
    return nxt is not None and (nxt.lemma in _SAYING)


def _te_aux_refused(tokens, s, e, _g) -> bool:
    """A compound particle in て (にあたって, をもって, として) followed
    by an auxiliary verb is the verb itself: 接待にあたっている is "be in
    charge of", 興味をもっている "have an interest"."""
    nxt = _next_word(tokens, e)
    return nxt is not None and nxt.pos == "verb" and (nxt.lemma in _AUX_AFTER_TE or nxt.surface in _AUX_AFTER_TE)


_STEM_ENDINGS = frozenset("いきぎしじちにひびみりえけげせぜてでねへべめれ")


def _o_kudasai_refused(tokens, s, e, segments) -> bool:
    """お〜ください／お〜になる is お + a verb's stem + ください／になる,
    all adjacent: not the お of お名前 or お金."""
    i, t = _tok_at(tokens, segments[0][0])
    if i is None or i + 1 >= len(tokens):
        return True
    stem = tokens[i + 1]
    as_verb = stem.pos == "verb" and (stem.cform.startswith("連用形") or (
        i + 2 < len(tokens) and tokens[i + 2].pos == "auxiliary" and tokens[i + 2].lemma in ("せる", "させる")))
    # お帰り, お声がけ: a verb's stem the tagger files as a noun, ending in
    # the stem's kana -- and not お金, お名前 or お世話, which are nouns
    as_noun = stem.pos == "noun" and stem.surface[-1:] in _STEM_ENDINGS
    if not (as_verb or as_noun):
        return True
    if len(segments) < 2:
        return False
    k = i + 2
    while k < len(tokens) and tokens[k].start < segments[1][0] and tokens[k].pos == "auxiliary" and as_verb:
        k += 1
    return (tokens[k - 1].end if k - 1 > i + 1 else stem.end) != segments[1][0]


def _ga_suru_refused(tokens, s, e, _g) -> bool:
    """〜がする is a perceived sensation (いい匂いがする): おばあちゃんが
    する is "Grandma does it"."""
    prev = _prev_word(tokens, s)
    return prev is None or not (prev.lemma in _SENSATIONS or prev.surface in _SENSATIONS)


def _tarumono_refused(tokens, s, e, _g) -> bool:
    """〜たるもの is a role and its duty (教師たるもの、…べきだ): not a
    タリ-adjective's たる (興味津々たるものがある, 堂々たる), nor 最たる
    and 主たる ("the prime, the main one"), nor たるもの as a predicate
    or a subject of が (…の最たるものだ)."""
    prev = _prev_word(tokens, s)
    if prev is None or prev.pos == "other" or prev.surface.endswith("々") or prev.surface in ("最", "主"):
        return True
    nxt = _next_word(tokens, e)
    return nxt is not None and (nxt.surface in ("が", "の", "だ", "だっ", "です", "でし", "で") or _is_copula(nxt))


def _rashii_typical_refused(tokens, s, e, _g) -> bool:
    """〜らしい（典型） is "typical of" a noun (男らしい人, 春らしい日,
    自分らしく): not らしい after a verb or an adjective, which is only
    ever "apparently", nor a predicate one closing on です, が or けど
    (まだ子犬らしいです, 殺人らしいが), which reads as the conjecture."""
    prev = _prev_word(tokens, s)
    if prev is not None and prev.pos in ("verb", "adjective", "auxiliary"):
        return True
    k = _tok_ending(tokens, e)
    t = tokens[k] if k is not None else None
    if t is None or t.pos == "suffix" or t.surface.startswith(("らしく", "らしさ")):
        return False
    nxt = tokens[k + 1] if k + 1 < len(tokens) else None
    return nxt is None or _is_copula(nxt) or (nxt.pos == "symbol" and nxt.surface in _UTTERANCE_ENDS) or (
        nxt.pos == "particle" and nxt.surface in ("が", "けど", "けれど", "よ", "ね", "と", "し"))


# 連れて行く, 連れて来る: に連れて is 連れる itself there, "taking (someone)
# to", no "as".
_MOTION_VERBS = frozenset({"行く", "来る", "帰る", "戻る", "出る", "入る", "回る", "歩く", "いく", "くる"})


def _toki_refused(tokens, s, e, _g) -> bool:
    """〜とき is "when": a clause or a noun and の, then とき or 時 on
    its way to what happened (学生のとき、; 帰る時に). Not 時 read じ
    (七時), nor the noun "time" -- 時は矢のごとく, 時が止まった, 時を移さず,
    時として ("sometimes"), 旅立ちの時が近づく, もう寝るべき時だ -- which
    opens a sentence, follows a particle other than の, or is a subject,
    an object or a predicate (plan 152)."""
    if _misread(tokens, s, e, "時", ("とき", "どき")):
        return True
    prev = _prev_word(tokens, s)
    if prev is None or prev.pos == "symbol" or (prev.pos == "particle" and prev.surface != "の"):
        return True
    nxt = _next_word(tokens, e)
    return nxt is not None and (nxt.surface in ("が", "を", "として") or _is_copula(nxt))


def _misread(tokens, s, e, kanji: str, readings: tuple[str, ...]) -> bool:
    """Whether the hit is written with `kanji` read otherwise than
    `readings`: 七時's 時 is じ, 研究所's 所 しょ (plan 152)."""
    for t in tokens:
        if s <= t.start < e and kanji in t.surface:
            return morphology.kata_to_hira(t.reading) not in readings
    return False


# What 〜にわたって spans: a stretch of time or place, or a count of
# them (三か月, 十回, 五十年). に渡って after anything else is 渡る
# itself, "crossing over to" (アメリカに渡って).
_SPANS = frozenset({"全国", "全体", "全域", "全土", "各地", "長年", "長期", "長期間", "広範囲", "多岐",
                    "生涯", "一生", "年間", "期間", "世界", "日本中", "世界中", "一日中", "一年中", "数年",
                    "数日", "数ヶ月", "数か月", "数週間", "数時間", "何年", "何日", "何度", "何回", "長時間",
                    "全般", "広域", "両日", "終日", "一晩中", "代々", "歴代", "分野", "方面", "範囲"})

# What a body feels (体に応える, "takes a toll"), where a place is (右に
# 見える, "visible on the right"), and who is honoured (先生が見えた,
# "has come").
_BODY = frozenset({"体", "身", "身体", "骨身", "胃", "腰", "胸", "心身", "肌", "足", "目", "耳"})
_WHERE = frozenset({"右", "左", "前", "後ろ", "遠く", "近く", "向こう", "奥", "上", "下", "正面", "前方",
                    "後方", "眼下", "足元", "窓", "そこ", "ここ", "あそこ", "手前", "横", "隣", "外", "中",
                    "間", "先", "彼方", "東", "西", "南", "北", "空"})
_HONORED = frozenset({"先生", "社長", "部長", "課長", "先輩", "お客", "客", "教授", "会長", "院長", "校長"})


def _literal_kanji(tokens, s, e, kanji: str, literal) -> bool:
    """Whether a hit written with `kanji` (the verb as a verb) reads as
    that verb rather than the point: `literal(tokens, s, e)`."""
    text = "".join(t.surface for t in tokens if s <= t.start < e)
    return kanji in text and literal(tokens, s, e)


def _spans_nothing(tokens, s, e) -> bool:
    """Whether に渡って follows no span: a count (三か月, 十年以上), a
    stretch (全国, 半年, 半世紀) or a range (夏から秋)."""
    prev = _prev_word(tokens, s)
    if prev is None:
        return True
    k = tokens.index(prev)
    if prev.surface in ("以上", "間", "来", "余り", "近く") and k >= 1:
        k -= 1
        prev = tokens[k]
    counted = prev.pos in ("suffix", "noun") and (_is_numeral(prev) or _counted_before(tokens, k + 1) is not None)
    ranged = any(x.surface == "から" and x.pos == "particle" for x in _clause_before(tokens, s))
    return not (counted or ranged or prev.surface.startswith("半") or prev.lemma in _SPANS or prev.surface in _SPANS)


def _pattern_refusals():
    return {
        "意向形 〜(よ)う": _volitional_refused,
        "〜かける": _kakeru_refused,
        "〜ことだ": _kotoda_refused,
        # 〜たところ is "when I did it, (it turned out)": 昨日行ったところは
        # よかった is "the place I went to" (plan 152)
        "〜たところ": lambda t, s, e, g: _followed_by(t, e, "に", "へ", "は", "を", "が", "で", "も", "の")
            or _followed_by_copula(t, e),
        # 〜ところだ is a verb's moment -- about to, in the middle of,
        # just done (出かけるところだ, 書いているところだ, 出たところだ):
        # 静かなところだ is "a quiet place" (plan 152)
        "〜ところだ": lambda t, s, e, g: (p := _prev_word(t, s)) is None or p.pos not in ("verb", "auxiliary")
            or _is_copula(p) or "".join(x.surface for x in t if s <= x.start < e).endswith(("だった", "でした")),
        "〜ことは〜が": _koto_wa_ga_refused,
        "〜という": _toiu_refused,
        "〜ように": _youni_refused,
        "〜にします": _niwaka_refused,
        "〜につき": lambda t, s, e, g: _followed_by(t, e, "まし"),
        "〜たばかり": lambda t, s, e, g: _followed_by(t, e, "に"),
        "〜ばかり": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.surface == "ん",
        "〜たるもの": _tarumono_refused,
        # 飲みたそう, 食べたそうだった: たい's stem before the そう of looks,
        # no past (plan 152)
        "た形 〜た": lambda t, s, e, g: (i := _index_at(t, s)) is not None and i + 1 < len(t)
            and t[i + 1].surface == "そう" and (_tai_stem(t, i) or (i + 2 < len(t) and t[i + 2].surface in ("だっ", "でし", "な", "に"))),
        # どんなに ("however much") and こんなに／そんなに／あんなに (their
        # own point) are adverbs, no な-adjective's adverbial form
        "〜く／〜に（副詞形）": lambda t, s, e, g: (p := _prev_word(t, s)) is not None
            and p.surface in ("どんな", "こんな", "そんな", "あんな"),
        # そう after a plain form is hearsay, whatever the tagger calls
        # it: できるそうです is "I hear it can", no look (plan 152)
        "〜そうです": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and _plain_before_sou(p)
            and not _tai_stem(t, t.index(p)) and not (p.surface == "た" and _followed_by(t, s + 2, "だっ", "でし", "な", "に")),
        # お帰りになる is the honorific (お〜になる), お世話になる a set
        # phrase: neither "becomes"
        "〜くなる／〜になる": lambda t, s, e, g: (i := _index_at(t, s)) is not None and i >= 2
            and t[i - 2].pos == "prefix" and t[i - 2].lemma in ("御", "お", "ご"),
        "〜ことはない": lambda t, s, e, g: ((p := _prev_word(t, s)) is not None and p.lemma == "た")
            or _followed_by(t, e, "だろう", "でしょう", "はず"),
        "〜にしても": lambda t, s, e, g: _followed_by(t, e, "いい", "よい", "かまわ", "構わ")
            or any(x.surface in ("いくら", "どんなに") or (x.surface == "を" and x.pos == "particle")
                   for x in _clause_before(t, s)),
        "〜場合": lambda t, s, e, g: _followed_by(t, e, "で", "じゃ") and (n := _next_word(t, e)) is not None
            and tokens_after(t, n, ("は", "ない")),
        # 〜の中で is "among" before a superlative or a question of which
        # one (四人の中で、わたしがいちばん小さい; かぞくの中で、だれが…):
        # 電車の中でねた is "inside the train"
        "〜の中で": lambda t, s, e, g: not _followed_by(t, e, "も") and not any(
            x.surface in ("いちばん", "一番", "最も", "もっとも", "好き", "すき") or x.surface.startswith("最")
            or x.lemma in _QUESTION_LEMMAS or x.surface in ("だれ", "どれ", "どちら", "どっち", "どこ", "なに", "何")
            for x in _sentence_after(t, e)),
        "〜かねる": lambda t, s, e, g: _followed_by(t, e, "ない", "ませ", "ず", "なかっ"),
        "〜ことに": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.pos == "verb",
        "〜だけに": lambda t, s, e, g: not ((n := _next_word(t, e)) is not None and n.surface in _COMMAS)
            and not ((p := _prev_word(t, s)) is not None and p.pos in ("verb", "adjective", "auxiliary")),
        "〜だって": lambda t, s, e, g: (n := _next_word(t, e)) is None or (n.pos == "symbol" and n.surface in _UTTERANCE_ENDS)
            or n.lemma in _SAYING,
        "〜らしい（典型）": _rashii_typical_refused,
        "〜らしい": lambda t, s, e, g: (k := _tok_ending(t, e)) is not None and (
            t[k].pos == "suffix" or t[k].surface.startswith("らしさ")),
        "〜たら": lambda t, s, e, g: (n := _next_word(t, e)) is None or (n.pos == "symbol" and n.surface in _UTTERANCE_ENDS),
        "〜と": _toka_to_refused,
        # なくては, なくても and なくていい are "must" and "need not";
        # なくちゃ is 〜なきゃ／〜なくちゃ's
        "〜なくて": lambda t, s, e, g: _followed_by(t, e, "は", "も", "いい", "よい", "よく", "良い", "かまわ", "構わ", "結構")
            or not "".join(x.surface for x in t if s <= x.start < e).endswith("て"),
        "〜ば": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (
            p.lemma == "因る" or (p.surface == "なけれ" and _followed_by(t, e, "いけ", "なら", "なり"))),
        "可能形 〜(ら)れる": lambda t, s, e, g: "".join(x.surface for x in t if s <= x.start < e) == "いけ"
            and _followed_by(t, e, "ない", "ませ", "ず", "なかっ", "なく"),
        "お〜ください": _o_kudasai_refused,
        "お〜になる／お〜する": _o_kudasai_refused,
        "それに": lambda t, s, e, g: _followed_by(t, e, "つい", "は", "対し", "よっ", "よる", "関し"),
        "〜ませんか": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.lemma in ("有る", "ある"),
        # この／その／あの／どの stands before its noun: あの、すみません
        # is "um"
        "この／その／あの／どの": lambda t, s, e, g: (n := _next_word(t, e)) is None or n.pos == "symbol",
        "これ／それ／あれ／どれ": lambda t, s, e, g: _konosoa_refused(t, s, e, g)
            or ((i := _index_at(t, s)) is not None and _soretomo(t, i)),
        "や": _ya_refused,
        "助数詞 〜つ／〜人／〜枚": _counter_refused,
        "〜かたわら": lambda t, s, e, g: _followed_by(t, e, "に"),
        "〜なしに": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.lemma in ("有る", "ある"),
        "〜はおろか": lambda t, s, e, g: _followed_by(t, e, "に", "な", "にも", "だ"),
        "〜としたら": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.cform.startswith("意志推量形"),
        "〜にしては": lambda t, s, e, g: _followed_by(t, e, "なら", "いけ", "だめ", "駄目"),
        "〜はもちろん": lambda t, s, e, g: not any(x.surface == "も" and x.pos == "particle"
                                             for x in t if x.start >= e),
        "〜がする": _ga_suru_refused,
        "〜ことがある": _kotogaaru_refused,
        "〜ことになる": _after_copula_na,
        "〜ものだ": _after_copula_na,
        "〜じゃないか": lambda t, s, e, g: _followed_by(t, e, "って", "と"),
        "〜な（禁止）": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (
            p.lemma in ("居る", "いる", "た") or p.surface in ("てる", "でる")),
        "〜のに": lambda t, s, e, g: (n := _next_word(t, e)) is not None and (n.surface.startswith("気") or n.pos == "verb"),
        "〜みたいだ": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.pos == "particle"
            and p.surface in ("が", "を"),
        "〜んです／〜のです": _explanatory_refused,
        "受身形 〜られる": _passive_refused,
        "〜と同じ": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.surface == "度",
        "〜と言います": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.pos == "noun",
        "ない形 〜ない": _nai_form_refused,
        "何か／誰か／どこか": lambda t, s, e, g: _nanika_refused(t, s, e, g) or (
            (k := _tok_ending(t, e)) is not None and _embedded_question_at(t, k)),
        "〜てはならない": lambda t, s, e, g: _after_nakute(t, s),
        "〜てはいけません": lambda t, s, e, g: _after_nakute(t, s),
        "〜ちゃいけない／〜じゃいけない": lambda t, s, e, g: _after_nakute(t, s),
        "〜ないで": lambda t, s, e, g: not "".join(x.surface for x in t if s <= x.start < e).startswith("ないで"),
        "〜なきゃ／〜なくちゃ": lambda t, s, e, g: not "".join(x.surface for x in t if s <= x.start < e).startswith(
            ("なきゃ", "なくちゃ", "なけりゃ", "なくっちゃ")),
        "〜にあたって": _te_aux_refused,
        "〜をもって": _te_aux_refused,
        "〜として": lambda t, s, e, g: _te_aux_refused(t, s, e, g)
            or ((p := _prev_word(t, s)) is not None and p.cform.startswith("意志推量形")),
        "〜をおいて": _te_aux_refused,
        "〜に沿って": _te_aux_refused,
        "〜にわたって": lambda t, s, e, g: _te_aux_refused(t, s, e, g) or _literal_kanji(t, s, e, "渡", _spans_nothing),
        "〜をめぐって": _te_aux_refused,
        # 体に応える is "to take a toll"; 弾を込める is loading a gun
        "〜にこたえて": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.surface in _BODY,
        "〜をこめて": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.surface in ("弾", "弾丸", "銃弾", "火薬", "弾薬"),
        # 政治に関わらずに生きる is "without getting involved"; 事件に関わった
        # is being involved, no "concerning"
        "〜にかかわらず": lambda t, s, e, g: _followed_by(t, e, "に"),
        "〜にかかわる": lambda t, s, e, g: (k := _tok_ending(t, e)) is not None
            and not t[k].cform.startswith(("終止形", "連体形")) and not _followed_by(t, e, "ます", "まし", "ませ"),
        # 枝に留まらずに is a bird not perching (留まる read とまる)
        "〜にとどまらず": lambda t, s, e, g: _followed_by(t, e, "に")
            or _misread(t, s, e, "留", ("とどまら",)),
        # 現金に引き換えてもらった is exchanging, no "in contrast"
        "〜にひきかえ": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.pos in ("auxiliary", "particle")
            and n.surface in ("て", "た", "ます", "まし", "られ", "る"),
        # 右に見える is "visible on the right"
        "〜に見える": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (p.surface in _WHERE or p.surface == "目"),
        # 先生が見えました is the honorific "has come"
        "〜が見える／〜が聞こえる": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (
            p.surface in _HONORED or p.surface.endswith(("様", "さん"))),
        # 駅前の通りにある店 is a street
        "〜通りに": lambda t, s, e, g: _is_numeral(_prev_word(t, s)) or ((n := _next_word(t, e)) is not None
            and n.lemma in ("有る", "ある", "居る", "いる", "面する", "出る", "沿う", "並ぶ", "建つ", "立つ")),
        "〜とき": _toki_refused,
        # 時間を過ぎる, 三時過ぎ: 過ぎる itself, passing a time -- where
        # 親切すぎる and いい人すぎる, the tagger's nouns, are too much
        "〜すぎる": lambda t, s, e, g: (p := _prev_word(t, s)) is None or p.pos in ("symbol", "particle")
            or (p.pos in ("noun", "suffix") and _counted_before(t, t.index(p) + 1) is not None),
        # 子供を公園に連れて出かけた: 連れる itself, a person taken to a
        # place, where 年を取るにつれて follows a verb (plan 152)
        "〜につれて": lambda t, s, e, g: ((n := _next_word(t, e)) is not None and n.pos == "verb"
            and n.lemma in _MOTION_VERBS) or ((p := _prev_word(t, s)) is not None and p.pos in ("noun", "pronoun")
            and any(x.surface == "を" and x.pos == "particle" for x in _clause_before(t, s))),
        "〜ところに": lambda t, s, e, g: not (
            (p := _prev_word(t, s)) is not None and (p.lemma in ("た", "居る", "いる", "おる", "良い", "いい")
                                                     or p.surface in ("いい", "よい"))),
        "〜に加えて": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (
            p.surface.startswith("口") or p.surface == "くち"),
    }


def tokens_after(tokens, t, surfaces) -> bool:
    k = tokens.index(t)
    rest = [x.surface for x in tokens[k + 1:k + 1 + len(surfaces)]]
    return tuple(rest) == tuple(surfaces)


_NEGATIVE_PAIRS = ("もう〜ない", "あまり〜ない", "ぜんぜん〜ない", "ちっとも〜ない", "なかなか〜ない",
                   "何も／誰も〜ない", "別に〜ない")


_REFUSALS = {
    "〜でも": _demo_refused,
    "〜とは": _towa_refused,
    "〜とか": _toka_refused,
    "〜か〜か": lambda tokens, s, e, g: _ka_ka_refused(tokens, s, e, g) or _ka_nanika(tokens, s, e, g),
    "〜も〜も": _mo_mo_refused,
    **{p: _negative_part_refused for p in _NEGATIVE_PAIRS},
    "〜は〜が": _wa_ga_refused,
    "〜て、〜て": lambda tokens, s, e, segments: len(segments) > 1 and _te_te_refused(tokens, s, e, segments),
    "それで": _sorede_refused,
    "と": _to_marker_refused,
    "か": lambda tokens, s, e, _g: _in_set_phrase(tokens, s) or (
        (i := _index_at(tokens, s)) is not None and (_embedded_question_at(tokens, i) or _nandaka(tokens, i)
                                                     or _in_kadouka(tokens, i))),
    "も": _mo_refused,
    "で": lambda tokens, s, e, _g: _in_set_phrase(tokens, s),
}


# A point written exactly on one part of a point in several parts, which
# that point's own lesson explains otherwise (plan 151): the さえ of
# お金さえあれば is 〜さえ〜ば's "as long as", not 〜さえ's "even"; the
# まい of 来ようが来まいが 〜ようが〜まいが's; one なり of 休むなり散歩する
# なり 〜なり〜なり's, not 〜なり's "as soon as".
_PART_OF = {"〜さえ": "〜さえ〜ば", "〜まい": "〜ようが〜まいが", "〜なり": "〜なり〜なり"}


def _parts_owned(found):
    owned = {(h[0], a, b) for h in found if not h[5] for a, b in h[6]}
    return [h for h in found
            if not (h[5] and h[0] in _PART_OF and (_PART_OF[h[0]], h[2], h[3]) in owned)]


_REFUSALS.update({p: r for p, r in _pattern_refusals().items() if p not in _REFUSALS})


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
_RULE_ONLY = frozenset({"た形 〜た", "ない形 〜ない", "〜て／〜ないで（依頼）", "〜も（強調）", "〜か（間接疑問）",
                        # (何でもない's letters are 何でも's: the rule is what tells them apart)
                        "何でも／誰でも／いつでも／どこでも"})


# Rules that stand BESIDE a point's other rules rather than replacing
# them (_CLASS_RULES points skip the stem and te rules).
_EXTRA_RULES = (
    ("〜たり〜たり", _single_tari_spans),
    ("〜かどうか", _kadouka_spans),
    ("〜に対して", _taishite_spans),
    ("〜なくてはいけない", _must_spans),
    ("助数詞 〜つ／〜人／〜枚", _counter_spans),
    ("〜そうだ（伝聞）", _hearsay_spans),
)


# The form points, by the pattern the catalogue files them under. A
# rename here is a rename there (tests/test_grammar_detect holds the
# two together).
_CLASS_RULES = {
    "〜て／〜ないで（依頼）": _casual_request_spans,
    "何でも／誰でも／いつでも／どこでも": _any_spans,
    "〜か（間接疑問）": _embedded_question_spans,
    "〜も（強調）": _emphatic_mo_spans,
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


# Where a compound particle ends: its て (について), its は／も (にかけては,
# にしても), its ず (を問わず), its ば／たら (とすれば, としたら), or the
# verb's own stem (につき, にひきかえ, をはじめ).
_PARTICLE_ENDS = frozenset({"て", "で", "は", "も", "ず", "ば", "たら"})


@lru_cache(maxsize=1)
def compound_particles() -> frozenset[str]:
    """The points built as a particle and a verb that no longer means
    itself: について, にとって, において, として, を問わず, につき (plan
    152). The verb's own card is not the word's meaning there -- について's
    つい is no 着く "to arrive", において's おい no 置く "to put" -- so the
    breakdown gives it none, and its row opens the point. Not a point
    whose verb is its predicate (〜と思います, 〜に行きます, 〜に見える):
    there the verb means itself, and keeps its card."""
    if not morphology.MORPHOLOGY_AVAILABLE:
        return frozenset()
    out = set()
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            pattern = point.get("pattern", "")
            for alt in alternatives(pattern):
                for piece in (p.strip(_TRIM) for p in alt.split("〜")):
                    tokens = morphology.tokenize("本" + piece) if piece else None
                    if not tokens or len(tokens) < 3:
                        continue
                    head, verb, last = tokens[1], tokens[2], tokens[-1]
                    if (head.pos == "particle" and head.surface in ("に", "を", "と") and verb.pos == "verb"
                            and (last.surface in _PARTICLE_ENDS
                                 or (last is verb and verb.cform.startswith("連用形")))):
                        out.add(pattern)
    return frozenset(out)


# The verbs a "must" or a "must not" is built on, negated: いけない is
# "no good", not 行く "to go" unable; ならない is "must", not 成る "to
# become" (plan 160). UniDic files the いけ of いけません under 行く, and
# a fuller dictionary under 行ける; both are here.
NO_GOOD_VERBS = frozenset({"行く", "行ける", "成る"})
_NEGATIONS = frozenset({"ない", "ず", "ぬ"})


@lru_cache(maxsize=1)
def no_good_points() -> frozenset[str]:
    """The points written with a negated いける or なる that no longer
    means itself: 〜てはいけません, 〜ないといけない, 〜なければなりません,
    〜てはならない, 〜にほかならない (plan 160). The verb's card is not the
    word's meaning there -- いけません read "to go" under a sentence
    that forbids talking -- so the breakdown gives it none, as it gives
    none to について's つい (compound_particles), and its row is the
    point's. Read off each pattern as the tokenizer cuts it, never listed
    by hand: a point added to the catalogue joins by being written so.
    Not 〜くなる, whose なる is "to become"."""
    if not morphology.MORPHOLOGY_AVAILABLE:
        return frozenset()
    out = set()
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            pattern = point.get("pattern", "")
            for alt in alternatives(pattern):
                for piece in (p.strip(_TRIM) for p in alt.split("〜")):
                    tokens = morphology.tokenize(piece) if piece else None
                    for k, tok in enumerate(tokens or []):
                        if (tok.pos == "verb" and tok.lemma in NO_GOOD_VERBS
                                and any(t.lemma in _NEGATIONS for t in tokens[k + 1:])):
                            out.add(pattern)
    return frozenset(out)


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
    if "".join(t.surface for t in before[-4:]).endswith("いつの間に"):
        return True                                    # いつの間にか: "before one knew it"
    while len(before) > 1 and before[-1].pos == "particle" and before[-1].surface in ("から", "まで", "に", "へ", "で"):
        before = before[:-1]                           # どこからか, 何度かに's 何度
    last = before[-1]
    if last.surface in _QUESTION_WORDS or last.lemma in _QUESTION_WORDS:
        return True
    if last.pos == "noun" and len(last.surface) <= 2 and len(before) > 1 and before[-2].lemma.startswith(("何", "幾")):
        return True                                    # 何度か, 何曜日か, which the tokenizer cuts as nouns
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
        # (Only a construction that stands: the ちゃいけない of
        # なくちゃいけない, itself refused, excuses nothing inside it.)
        bare = [h for h in found if _refused(tokens, h[0], h[2], h[3], h[6])]
        whole = [(h[2], h[3]) for h in found if h[5] and h not in bare]
        refused = [h for h in bare
                   if not ("〜" in h[0] and any((s, e) != (h[2], h[3]) and s <= h[2] and h[3] <= e
                                                for s, e in whole))]
        # A refused reading takes with it the same point's shorter readings
        # from the same place: てはならな is てはならない cut short, and
        # no less the obligation's (plan 151).
        cut = {(h[0], h[2]) for h in refused if h[5]}
        found = [h for h in found if h not in refused and not (h[5] and (h[0], h[2]) in cut)]
    if tokens:
        found = _parts_owned(found)
    shadowed = _shadowed()
    plain_spans = {(h[2], h[3]) for h in found if not _sense(h[0])}
    found = [h for h in found
             if h[0] not in shadowed and not (_sense(h[0]) and (h[2], h[3]) in plain_spans)]
    # The で of ではない is the copula, not the particle of place or
    # means it is spelled like (plan 149).
    copula_de = {h[2] for h in found if h[0] == "です／だ" and sentence[h[2]:h[2] + 1] == "で" and h[3] - h[2] > 1}
    found = [h for h in found if not (h[0] == "で" and h[2] in copula_de)]
    # The に of について, にとって, によって is the compound particle's,
    # none of the moments, places or receivers に's lesson teaches -- but
    # only where the compound was found, so a に the tagger misreads
    # before 起きる (七時におきます) keeps its key (plan 151).
    if tokens:
        compound = {h[2] for h in found if h[0].startswith("〜に") and _compound_ni(tokens, h[2], h[3])}
        found = [h for h in found if not (h[0] == "に" and h[2] in compound)]
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
