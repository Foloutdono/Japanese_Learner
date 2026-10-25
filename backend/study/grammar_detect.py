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

Plan 188: what the tours found
------------------------------
Plan 187g wrote a twist and a scene for every point, and its drafters
met forms of a point this could not find, and a few it found where they
were not, and wrote around them. A learner's sentence does not, so each
one the tokenizer can name is read now (tests/test_grammar_precision.py's
TourTests, a case and its counter-case each):

- **What the structure line names** (_structure): a point's lessons
  show it after the kinds of word they happen to use; its `structure`
  line says what it attaches to. 「plain form + くせに」 admits 若いくせに,
  which no lesson wrote -- predicates only, never a noun, which a sense
  sibling's lessons may hold (〜らしい（典型）). And the one verb form the
  line asks: a point written on the stem is no point after a dictionary
  form (乗るっこない, 見るに行きます), one written on a plain form none
  after a bare stem (読みこと).
- **The other register and the spoken contractions** (_registered):
  〜はずです in はずだ, 〜わけだ in わけです, ところでした, なんでしょう;
  じゃ for では, てる for ている -- not where the other spelling is
  another point's (〜そうです／〜そうだ（伝聞）), nor 〜ことだ and 〜ものだ,
  whose polite noun + です defines more often than it advises.
- **A compound's second half** (_COMPOUNDS): 乗り込む, 助け合う, 書き直す,
  見通す, 遣り甲斐, 泥塗れ, 葱抜き, 買い方 are one token each, and 降り +
  出す two verbs; read by lemma on a verb's stem or a noun, less the
  compounds a lesson sets apart (思い出す) and the lexical ones (話しかける).
  〜こむ, 〜あう, 〜直す, 〜通す, 〜出す and 〜かける are read by this alone:
  as letters each is a full verb (混む, 会う, 時計を直す).
- **The volitional**, read as one word (乗ろう, かけよう) or as a stem and
  the noun よう, opening 〜ようとする, 〜ようがない, 〜ようにも〜ない and
  〜ようが〜まいが; and 〜ものを, 〜か〜か with one か, お〜する in the polite
  form, 〜と相まって across its two things, ばそれまでだ across its comma.
- **The tokenizer's misreadings named**: an imperative before a suffix
  is a stem (乗りおくれかねない), なき before a verb is 泣き, the copula's
  に opens 〜に決まっている, a quotation is a noun (「のりかえ」というのは),
  ありません ends as ない does, a count the tagger calls an adverb (十分).

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
from functools import lru_cache, partial

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from study import morphology
from study.grammar_match import alternatives, stems

logger = logging.getLogger(__name__)

LEVELS = ("N5", "N4", "N3", "N2", "N1")

# Points whose surface is a common word in its own right, where no
# amount of tokenizing separates the point from the word: 〜上に is
# 上(noun) + に(particle) and so is 山の上に, 〜ものを is 買いものを,
# 別に〜ない reduces to 別に which 特別に contains. The distinction is
# semantic, so it is not drawn by letters rather than drawn wrongly.
# difficulty.py imports this list for its own gate -- one list, not two.
# Three of them a rule reads by what the tokenizer names, never by
# letters (plan 188): 〜出す and 〜直す as a compound's second half
# (_COMPOUNDS), 〜ものを on its lessons' shape (_if_only_spans).
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


# ── A pattern in the other register (plan 188) ──────────────────
# The catalogue writes a point in one register and a sentence uses the
# other: 〜はずです is はずだ in a plain sentence, 〜わけだ is わけです in
# a polite one, 〜ところだった ところでした, 〜でなくてなんだろう
# なんでしょう; and speech contracts では to じゃ (どころじゃない,
# じゃあるまいし) and ている to てる (決まってる). Each is the same point.
# Not where the other register's spelling is another point's own --
# 〜そうです looks, 〜そうだ（伝聞） hears -- and not the copula point です
# ／だ itself, nor a だ that is no copula (〜あいだ's 間). And not 〜ことだ
# or 〜ものだ, whose noun + です in polite speech says what a thing is far
# more often than it advises or remembers (就労を拒否することです,
# 管理職を対象としたものです). A contraction is of the catalogue's own
# では, never of a voiced ては: あそんじゃいけない is 〜ちゃいけない／〜じゃ
# いけない's.
_ONE_REGISTER = frozenset({"〜ことだ", "〜ものだ"})
_REGISTERS = (("です", ("だ", "だっ")), ("でし", ("だっ",)), ("だ", ("です", "でし")), ("だっ", ("でし",)),
              ("だった", ("でした",)), ("だろう", ("でしょう",)))
_CONTRACTIONS = (("では", "じゃ"), ("ている", "てる"))

# The words a lesson names as its point's own short form or its point
# with a particle inside: 〜までのことだ's までだ (当然のことをしたまでだ),
# 〜に至る's には／にも (大事には至らない).
_SHORT_FORMS: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "〜までのことだ": (("までのことだ", ("までだ",)),),
    "〜に至る": (("に至", ("には至", "にも至")),),
    # 最中 as the predicate: 食事の最中だった, 会議の最中です
    "〜最中に": (("最中に", ("最中だ", "最中です", "最中でし", "最中だっ")),),
    # (plan 272) said without its も, or with よい: しなくていい, 任せていい,
    # 賜ってよい, 出せばよい; and もの said もん: やれるもんなら
    "〜てもいいです": (("てもいい", ("ていい", "てもよい", "てよい", "てもよろし", "てよろし")),
                    ("でもいい", ("でいい", "でもよい", "でよい", "でもよろし", "でよろし"))),
    "〜なくてもいいです": (("なくてもいい", ("なくていい", "なくてもよい", "なくてよい")),),
    "〜といい／〜たらいい／〜ばいい": (("ばいい", ("ばよい",)), ("たらいい", ("たらよい",)), ("だらいい", ("だらよい",))),
    "〜ものなら": (("ものなら", ("もんなら",)),),
    # (the written negative: 信用してはならぬ, plan 272)
    "〜てはならない": (("てはならない", ("てはならぬ", "てはならず")), ("ではならない", ("ではならぬ", "ではならず"))),
    # (plan 272, the fourth review: 発展に伴い、; 値段の割には; 汲んだもんじゃ;
    # 負けるはずがなかろう; 優しくなれる)
    "〜に伴って": (("に伴って", ("に伴い", "にともない")), ("にともなって", ("にともない",))),
    "〜わりに": (("わりに", ("割に", "わりには", "割には")),),
    "〜ものだ": (("ものだ", ("もんだ", "もんじゃ", "ものじゃ", "もんです")),),
    "〜はずがない": (("はずがない", ("はずがなかろう", "はずはなかろう", "はずもない", "はずがありません")),),
    "〜くなる／〜になる": (("くなる", ("くなれ",)), ("になる", ("になれ",))),
    # (ご + a する-noun, as the lesson's own 足元にご注意ください; and the
    # old imperative, おやめくだされ, plan 272)
    "お〜ください": (("お", ("ご", "御")), ("ください", ("くだされ", "下され"))),
    # (plan 272, the fifth review: 不手際により; 未開封のものに限り; 約束どおり;
    # ご命令とあらば; 申すではないか; 出たことはありますか)
    "〜によって": (("によって", ("により", "による")),),
    "〜に限って": (("に限って", ("に限り", "にかぎり")),),
    "〜通りに": (("どおりに", ("どおり",)),),
    "〜とあれば": (("とあれば", ("とあらば",)),),
    "〜じゃないか": (("じゃないか", ("ではないか", "じゃありませんか", "ではありませんか")),),
    "〜ことがある": (("ことがあ", ("ことはあ", "こともあ")), ("事があ", ("事はあ", "事もあ"))),
    # (old speech: なりませぬ, 叱られまするぞ; the west's じゃろう and
    # てまう, plan 272)
    "〜ます／〜ません": (("ません", ("ませぬ",)), ("ます", ("まする",))),
    "〜だろう": (("だろう", ("じゃろう",)),),
    # (drawn out: 待ってるよー, 行くね〜)
    "よ": (("よ", ("よー", "よ〜", "よぉ", "よっ")),),
    "ね": (("ね", ("ねー", "ね〜", "ねぇ", "ねっ")),),
    "〜てしまう": (("てしまう", ("てまう",)), ("でしまう", ("でまう",))),
    # (the plain register, まだ食べていない, まだたたんでない)
    "まだ〜ていません": (("ていません", ("ていない", "てない", "ていなかった")), ("でいません", ("でいない", "でない"))),
}


@lru_cache(maxsize=1)
def _surfaces() -> frozenset[str]:
    """Every point's pieces as written, senses dropped (〜そうだ（伝聞）
    is そうだ)."""
    out = set()
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            for alt in alternatives(point.get("pattern", "")):
                for piece in alt.split("〜"):
                    piece = piece.split("（")[0].split("(")[0].strip(_TRIM)
                    if piece:
                        out.add(piece)
    return frozenset(out)


@lru_cache(maxsize=4096)
def _ends_in_copula(piece: str) -> bool:
    if not morphology.MORPHOLOGY_AVAILABLE:
        return False
    tokens = morphology.tokenize(piece) or []
    if len(tokens) > 2 and tokens[-1].lemma == "た":
        tokens = tokens[:-1]                    # ところだった: the copula's past
    return len(tokens) > 1 and _is_copula(tokens[-1])


def _registered(pattern: str, piece: str, needles: tuple[str, ...]) -> tuple[str, ...]:
    """`needles` and each in the other register and the spoken
    contraction (see above)."""
    out = list(needles)
    others = _surfaces() - {piece}
    # (A sense point is its own register: hearsay has no そうでした.)
    copula = (piece not in ("です", "だ") and not _qualified(pattern) and pattern not in _ONE_REGISTER
              and _ends_in_copula(piece))
    for n in needles:
        for ending, alts in _REGISTERS if copula else ():
            if n.endswith(ending) and len(n) > len(ending):
                out += [n[: -len(ending)] + a for a in alts if n[: -len(ending)] + a not in others]
    if piece.startswith("させ") and len(piece) > 3:
        # a 五段 verb's causative is せる: 持たせてください, 使わせていただく
        out += [n[1:] for n in needles if n.startswith("させ")]
    if piece == "だ" and len(alternatives(pattern)) == 1 and pattern != "です／だ":
        out += ["です", "でし"]                      # 〜のは〜だ's second half
    for written, said in _CONTRACTIONS:
        if written in piece and "ならでは" not in piece:
            out += [n.replace(written, said) for n in list(out) if written in n]
    for segment, alts in _SHORT_FORMS.get(pattern, ()):
        out += [n.replace(segment, a) for n in list(out) if segment in n for a in alts]
    return tuple(dict.fromkeys(out))


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
        needles = [_registered(pattern, p, _respelled(pattern, _needles(p))) for p in pieces if p]
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
# The 五段 verbs whose 連用形 before ます is い (plan 193).
_ARU_HONORIFICS = ("いらっしゃる", "おっしゃる", "なさる", "くださる", "ござる")


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
            if piece.endswith(_ARU_HONORIFICS):
                # いらっしゃる, おっしゃる, なさる say い before ます, never り:
                # いらっしゃいます, おっしゃいました (plan 193)
                forms.append(word[:-1] + "い")
    elif ctype.startswith(("上一段", "下一段")):
        forms = [word[:-1], word[:-1] + "れ", word[:-1] + "ろ"]
    elif ctype == "サ行変格" and word.endswith("する"):
        forms = [word[:-2] + e for e in ("し", "さ", "せ")]
    elif ctype == "カ行変格":
        forms = [word[:-1]] if word.endswith("来る") else [word[:-2] + e for e in ("き", "こ")]
    elif ctype == "形容詞" or ctype.startswith(("助動詞-ナイ", "助動詞-タイ", "助動詞-ラシイ")):
        forms = [word[:-1] + e for e in ("く", "かっ", "けれ")]
    out = [head + f for f in forms]
    if word == "ない":
        out += _polite_negative(tokens, head, ctype)
        # (and as rough speech says it: 一度しか言わねえ, 負けるわけには
        # いかねえ, plan 272)
        out += [head + "ねえ", head + "ねー", head + "ねぇ"]
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
    if len(tokens) < 2 or tokens[-2].pos not in ("verb", "suffix") or not tokens[-2].ctype:
        return []                           # (a suffix that conjugates: かねない, かねません)
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
    # A conjugation is held to the rule a truncation is -- except where the
    # piece is a particle or an ending and する, whose 連用形 and 未然形 are
    # one kana: がします, 強くします, コーヒーにします are the point in its
    # polite form, and the shape its lessons teach (a particle, then the
    # verb) is what keeps がし off the letters of 探します (plan 188).
    suru = len(full) > 2 and full.endswith("する")
    found += [c for c in _conjugations(full) if _distinctive(c) or (suru and len(c) >= 2)
              # (ない said roughly, a part of its own: 一度しか言わねえ, plan 272)
              or (full == "ない" and c in ("ねえ", "ねー", "ねぇ"))]
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
    i = tokens.index(t)
    if t.lemma in ("ず", "ます") and i >= 1:
        # ありません is ない said politely, and ends as ない would after the
        # same word: 相違ありません is 相違ない (plan 188).
        k = i - 1 if t.lemma == "ず" else i
        # (Only the negative: 二十六キロあります is ます's own, plan 272.)
        if k >= 1 and tokens[k].lemma == "ます" and tokens[k].surface == "ませ" and tokens[k - 1].lemma in ("有る", "ある"):
            i, t = k - 1, tokens[k - 1]
            return "auxiliary" if i == 0 or tokens[i - 1].pos not in ("noun", "pronoun") else "adjective"
    if t.lemma in _CONTRACTED and t.pos == "auxiliary":
        return "verb"                       # 決まってる's てる is ている's いる (plan 188)
    if t.lemma in ("無い", "ない"):
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
# A noun + だ point whose lesson names its negative as its own: 〜ものだ's
# "Negative: ものではない (one shouldn't)". Every other one's negative is
# another point or no point (plan 188).
_NEGATES_ITSELF = frozenset({"〜ものだ"})


def _opens_negative(tokens, k: int) -> bool:
    """Whether the copula at tokens[k] opens a negative: で or じゃ, は or
    も, then ない or ありません."""
    return (k + 2 < len(tokens) and tokens[k].surface in ("で", "じゃ") and tokens[k + 1].surface in ("は", "も")
            and _negative_at(tokens, k + 2))


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
    and nothing but more particles and marks follows it in its sentence
    -- いいかね。例の件で話がある closes its first sentence on ね (plan
    272)."""
    after = False
    for t in tokens:
        if t.start == start:
            if t.surface not in _FINAL_PARTICLES:
                return False
            after = True
            continue
        if after and t.pos == "symbol" and t.surface in _UTTERANCE_ENDS:
            return True
        if after and t.pos not in ("particle", "symbol"):
            return False
    return after


def _polite_noun(tokens, token, start: int) -> bool:
    """Whether `token` is a verb's stem the polite お or ご makes a noun
    of, before the particle a noun takes (plan 272): おすすめは, お知らせが
    -- never the に of お待ちになる, which is お〜になる's."""
    k = tokens.index(token)
    at = next((t for t in tokens if t.start == start), None)
    # (...or the copula: お呼びでございます, "is calling for you".)
    if at is None or not ((at.pos == "particle" and at.surface in ("は", "が", "を", "も", "の", "と", "や"))
                          or (at.pos == "auxiliary" and at.lemma in ("だ", "です"))):
        return False
    if token.conjunctive and k >= 1:
        # ...or a noun in kana UniDic read as a て form: きってを, 切手.
        from study.card_lookup import resolve_te_noun
        return resolve_te_noun(tokens, k - 1) is not None
    return (token.pos == "verb" and token.cform.startswith("連用形-一般") and k >= 1
            and tokens[k - 1].pos == "prefix" and tokens[k - 1].surface in ("お", "ご", "御"))


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
    if token is None:
        # A point its lessons only ever show after a predicate -- a
        # verb's stem, an adjective, an ending -- does not open a
        # sentence on kana letters (plan 266): はじめまして is a greeting,
        # and its はじめ no 〜はじめる "to begin to" with no verb before it.
        # Spelled in kanji it is its own word there: 一方で、… is "on the
        # other hand".
        # (Nothing at all before it: after a closing quote, 」と思った, the
        # quotation is what it follows.)
        at = next((t for t in tokens if t.start == start), None)
        return not (befores and "" not in befores and set(befores) <= _PREDICATE
                    and at is not None and "\u3041" <= at.surface[:1] <= "\u309f"
                    and not any(t.end <= start for t in tokens))
    if token.pos == "suffix" and token.ctype.startswith("形容詞"):
        # A suffix that inflects as an adjective ends a clause as one
        # (plan 272): 滑りやすいから, 子供っぽいから -- and 読みにくいので's の
        # is no noun's.
        return "adjective" in befores
    if token.pos in befores:
        return True
    if "noun" in befores and token.pos == "adjective" and token.cform.startswith("連用形") \
            and token.surface.endswith("く"):
        # An adjective's く form is a noun before まで, から and に: 夜遅く
        # まで, 朝早くから, 遠くに (plan 272).
        at = next((t for t in tokens if t.start == start), None)
        if at is not None and at.pos == "particle" and at.surface in ("まで", "から", "に", "までに"):
            return True
    if "noun" in befores and _polite_noun(tokens, token, start):
        return True
    if "noun" in befores and token.pos == "particle" and token.surface in ("の", "ん"):
        # A clause the の of a noun makes is the noun ではなく and its
        # kin come after (plan 272): 消えるのではなく, "not that they
        # vanish". Only those: 行くので is 〜ので, 行くのに 〜のに.
        at = next((t for t in tokens if t.start == start), None)
        if at is not None and at.surface in ("で", "じゃ") and (at.pos == "particle" or _is_copula(at)):
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
        # An adverb is a word of its own wherever it stands, and modifies
        # what follows it, not what went before: いいえ、ぜんぜん分かりません,
        # 待っているが、なかなか来ない (plan 188).
        return particle_headed or "" in befores or bool(heads) and heads <= {"adverb"}
    shown = set(befores) - {""}
    if (heads == {"conjunction"} and shown <= {"symbol"}
            and token.pos in ("particle", "auxiliary", "verb", "adjective", "interjection")):
        # A conjunction the tokenizer reads as one word (そして, しかし),
        # which its lessons show opening a sentence or a clause, opens one
        # after a particle or a predicate too in a line written without
        # its commas, as a subtitle writes speech: バンドメンバーとそして…
        # (plan 272).
        return True
    if token.pos == "adverb" and token.surface in ("そう", "こう", "ああ", "どう") and shown & _PREDICATE:
        # そう stands for a clause: そうとは限らない, そうかもしれない (plan 188)
        return True
    at = next((t for t in tokens if t.start == start), None)
    if token.pos == "adverb" and at is not None and (shown & _PREDICATE or shown & _NOMINAL) and (
            (token.surface in ("なぜ", "何故", "どうして") and at.surface != "な" and (_is_copula(at) or at.surface == "か"))
            or (token.surface in ("せっかく", "折角") and _is_copula(at))
            or (at.surface == "なら" and at.pos == "auxiliary")):
        # The question "why?" said with the copula (なぜだろう, どうしてでしょ
        # うか), せっかくですので, and なら after an adverb: ゆっくりなら,
        # 少しなら, "if (it is) slowly" (plan 272).
        return True
    if token.pos == "adverb" and shown & _NOMINAL and (token.surface[:1] in _NUMERAL_CHARS or token.surface == "ただ"):
        # a count the tagger reads as an adverb (十分, "ten minutes", not
        # "enough": 十分といったところだ), and ただ the noun "free" (ただ同然)
        return True
    if (token.pos == "interjection" and token.end == start and len(token.surface) <= 2 and shown & _NOMINAL
            and all("\u3041" <= c <= "\u309f" for c in token.surface)):
        k = tokens.index(token)
        if k >= 1 and tokens[k - 1].end == token.start and tokens[k - 1].pos != "symbol":
            # the tail of a kana noun the tokenizer broke into pieces:
            # きっさてん as きっ + さて + ん (plan 188)
            return True
    if _quoted_before(start, tokens) and shown & _NOMINAL:
        # 「のりかえ」というのは: what a quotation holds is named, a noun
        # whatever the tokenizer reads inside it (plan 188).
        return True
    if not shown:
        # (Nor an adnominal: この, その are words wherever they stand --
        # だれがこの本をかいたか, plan 272.)
        return heads <= {"pronoun", "adnominal"}
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


# ── What the structure line names (plan 188) ─────────────────────
# A lesson's four sentences show a point after the kinds of word they
# happen to use. The entry's `structure` line says in prose what it
# attaches to -- 「plain form + くせに」, 「verb stem + 方」, 「noun + めく」 --
# and plan 187g's tours met the gap between the two: 若いくせに had no
# 〜くせに because no lesson puts an adjective before it, 遅れているようです
# no 〜ようです because every lesson's follows た. So the line is read
# too, for the kinds of word it names (widening what the lessons show,
# never narrowing it), and for the one form of a verb it asks: a point
# written on a verb's stem is not after its dictionary form (乗るっこない,
# 見るに行きます), nor one written on a plain form after a bare stem
# (読みこと) -- a learner's slip, and no key to hand them for it.

_PREDICATE = frozenset({"verb", "adjective", "auxiliary"})
# The forms a structure line asks of a verb in front of the point, when it
# asks one only: its stem (ます-stem, ない-stem, a causative stem), or a
# plain form (the dictionary form, a clause).
_STEM_FORMS = frozenset({"連用形", "未然形"})
# ...and what may stand where a stem must: an imperative never takes a
# suffix, so one before a point written on the stem is the tagger's
# misreading of the stem (乗りおくれかねない read 乗り + お + くれ).
_STEM_LIKE = _STEM_FORMS | {"命令形"}


@lru_cache(maxsize=None)
def _structure(pattern: str) -> tuple[frozenset[str], str]:
    """(the kinds of word the point's structure line names in front of it,
    "stem" | "plain" | "" -- the form it asks of a verb there, where it
    names exactly one). Only each way's first stretch is read, up to its
    first +: what comes after is the point itself -- each way, since plan
    272: "noun + の + ような ／ plain form + ような" admits a plain form
    (ひっくり返したような雨), which the line's first stretch alone hid."""
    found = find(pattern)
    if found is None:
        return frozenset(), ""
    line = found[1].get("structure") or ""
    head = "/".join(way.split("+", 1)[0] for way in line.replace("／", "/").split("/"))
    kinds: set[str] = set()
    forms: set[str] = set()
    for alt in head.replace("／", "/").replace("・", "/").split("/"):
        a = alt.strip().lower()
        if not a or "。" in a:
            continue                        # 「sentence。ところが」: an opener, after no word
        if "noun" in a or a.startswith(("number", "quantity", "counter", "quoted", "question word")):
            kinds |= _NOMINAL
        if "adj" in a:
            if "な-adj" in a:
                kinds.add("other")
            elif "い-adj" in a:
                kinds.add("adjective")
            else:
                # an adjective's stem: 悲し of 悲しい, and a な-adjective's,
                # which the tokenizer files as a noun (不安) or a 形状詞
                kinds |= {"adjective", "other"} | ({"noun"} if "stem" in a else set())
        if "plain" in a or a.startswith(("clause", "sentence")):
            kinds |= {"verb", "auxiliary"} if "verb" in a and "adj" not in a else _PREDICATE
            forms.add("plain")
        elif "verb" in a or a.startswith(("dictionary", "ます-stem")):
            if "stem" in a:
                kinds.add("verb")
                forms.add("stem")
            elif "dictionary" in a:
                kinds.add("verb")
                forms.add("plain")
            else:
                forms.add("other")          # て-form, た-form, volitional: the lessons say
    return frozenset(kinds), (forms.pop() if len(forms) == 1 and forms <= {"stem", "plain"} else "")


# What a point stands after that neither its lessons nor its line's first
# stretch say (plan 272): an embedded question closes on any plain clause,
# なにがいいか悩む, 何が好きか教えて.
_ALSO_AFTER = {"〜か（間接疑問）": frozenset({"adjective", "other"}),
               # (そのような, このような: "such", a likeness before a noun)
               "〜ような": frozenset({"adnominal"})}


# The nouns of time 〜うちに's の follows (今のうちに, 夏休みのうちに): 家の
# うちに入る is "into the house".
_TIMES_OF_UCHI = frozenset({"今", "朝", "昼", "夜", "夕方", "午前", "午前中", "午後", "今日", "今夜", "今週", "今月",
                            "今年", "一日", "夏", "冬", "春", "秋", "夏休み", "冬休み", "春休み", "休み", "若い頃",
                            "学生時代", "子供", "子ども", "週末", "明日", "あした", "数日", "数年", "期間", "在学中"})


def _noun_before_no_fits(pattern: str, tokens, no) -> bool:
    """Whether the noun before the の of a "noun + の + …" way is one the
    point takes there: any noun, but a time for 〜うちに."""
    if pattern != "〜うちに":
        return True
    k = tokens.index(no)
    return k > 0 and (tokens[k - 1].surface in _TIMES_OF_UCHI or tokens[k - 1].counter
                      or tokens[k - 1].surface.endswith(("中", "間", "時代")))


def _polite_stem_before(tokens, start: int) -> bool:
    """Whether the word before `start` is a verb's stem the polite prefix
    makes a noun of: お出かけ, ご利用."""
    b = _before_token(start, tokens)
    if b is None or b.pos != "verb" or not b.cform.startswith("連用形"):
        return False
    k = tokens.index(b)
    after = tokens[k + 2] if k + 2 < len(tokens) else None
    if after is not None and after.lemma in ("成る", "なる"):
        return False                       # お待ちになる: お〜になる's に
    return k > 0 and tokens[k - 1].pos == "prefix" and tokens[k - 1].surface in ("お", "ご", "御")


@lru_cache(maxsize=None)
def _after_no(pattern: str) -> bool:
    """Whether a way of the point's structure line is "noun + の + …"
    (〜うちに: 今のうちに, plan 272), so the の before it is its own."""
    found = find(pattern)
    line = (found[1].get("structure") or "") if found else ""
    return any("".join(way.split()).startswith("noun+の+") for way in line.replace("／", "/").split("/"))


def _admitted(pattern: str, befores, heads) -> frozenset[str]:
    """The kinds of word a point may stand after beyond what its lessons
    show: the predicates its structure line names -- never a noun, where
    a point's sense-qualified sibling (〜らしい（典型）, 春らしい) holds the
    nouns its lessons show apart -- and, for a particle, a verb where the
    lessons show an い-adjective, both a plain predicate (うれしいやら悲しい
    やら, 泣くやら笑うやら). A point in several spellings keeps its lessons':
    the line's first stretch is its first spelling's (〜くなる／〜になる)."""
    kinds = frozenset()
    if len(alternatives(pattern)) == 1:
        kinds = _structure(pattern)[0] - _NOMINAL
    if "adjective" in befores and heads and heads <= {"particle"}:
        kinds = kinds | {"verb"}
    return kinds | _ALSO_AFTER.get(pattern, frozenset())


def _admits(token, admitted) -> bool:
    """Whether `token` is a kind of word `admitted` names -- a passive or a
    causative standing for the verb it conjugates as (締結されるに至った)."""
    if token is None:
        return False
    return token.pos in admitted or ("verb" in admitted and token.pos == "auxiliary"
                                     and token.lemma_reading in _PASSIVE | _CAUSATIVE)


def _wrong_form(start: int, tokens, pattern: str) -> bool:
    """Whether the verb in front of a hit is in a form the point's
    structure line rules out: a dictionary form before a point written on
    the stem (乗るっこない, 見るに行きます), a bare stem before one written
    on a plain form (読みこと) -- unless the line admits a noun there too,
    which a stem standing as a noun is (言いのがれにすぎない, お持ちの方)."""
    kinds, form = _structure(pattern)
    if not form:
        return False
    token = _before_token(start, tokens)
    if token is None or token.pos != "verb" or not token.cform:
        return False
    head = _form_head(token.cform)
    if form == "stem":
        return head not in _STEM_LIKE
    return head in _STEM_FORMS and not kinds & _NOMINAL


def _copula_ni(tokens, start: int, end: int) -> bool:
    """Whether the hit opens on the copula's に after a な-adjective and
    reaches past it: the tokenizer reads the に of むりに決まっている and
    大事に至らず as だ's, and a construction written with に claims it --
    where a bare に stays unlit, since 平和に is "for peace" or
    "peacefully" (plan 150) and nothing in the text says which (plan 188)."""
    t = next((t for t in tokens if t.start == start), None)
    return (t is not None and t.surface == "に" and _is_copula(t) and t.cform == "連用形-ニ"
            and end > t.end)


def _copula_de_after_no(tokens, start: int, end: int) -> bool:
    """Whether the hit opens on the copula's で after a clause's の and
    reaches past it: the tokenizer reads the で of 消えるのではなく as
    だ's, where 明日ではなく's is a particle, and 〜ではなく is the same
    there, "not that they vanish" (plan 272)."""
    k = next((k for k, t in enumerate(tokens) if t.start == start), None)
    if not k:
        return False
    t, prev = tokens[k], tokens[k - 1]
    return (t.surface == "で" and _is_copula(t) and t.cform == "連用形-一般" and end > t.end
            and prev.pos == "particle" and prev.surface in ("の", "ん"))


def _quoted_before(start: int, tokens) -> bool:
    """Whether a closing quotation mark stands right before `start`."""
    return any(t.end == start and t.pos == "symbol" and t.surface in "」』\"”" for t in tokens)


def _closes_on_a_noun(start: int, end: int, tokens, befores, heads) -> bool:
    """Whether a point of sentence-final particles (〜かな) closes its
    sentence on a noun, whose copula the casual register drops: 何時かな
    is 何時だろうか, 雨かな (plan 188). Its lessons show it after a
    predicate, and a noun with its copula unsaid is one."""
    token = _before_token(start, tokens)
    if token is None or token.pos not in _NOMINAL or not heads or not heads <= {"particle"}:
        return False
    if not set(befores) & {"verb", "auxiliary"}:
        return False
    inside = [t for t in tokens if start <= t.start and t.end <= end]
    return (bool(inside) and inside[-1].end == end and all(t.pos == "particle" for t in inside)
            and _sentence_final(tokens, tokens.index(inside[-1])))


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
        if pos not in heads and not (pos == "auxiliary" and "particle" in heads and (
                _copula_ni(tokens, start, end) or _copula_de_after_no(tokens, start, end))):
            continue
        copula_te = False
        if sentence[start] in "だで" and _written_unvoiced(pattern, spelling):
            # A voiced た／て is a verb's ending after ん (読んだら, 飲んでも):
            # the でも of コーヒーでも is で + も, no ending at all.
            prev = _before_token(start, tokens)
            # ...except in a construction that reaches past でも to its
            # predicate, where で is the copula's て-form after a noun:
            # 明日でもさしつかえない (plan 188).
            copula_te = (prev is not None and prev.pos in _NOMINAL and contiguous
                         and sentence.startswith("でも", start) and end - start > 4
                         and not sentence.startswith(("でもいい", "でもよい", "でも良い"), start)
                         and not _question_word_before(tokens, tokens.index(prev) + 1))
            # (でもいい after a noun stays 〜でも's, as plan 151 read it --
            # お茶でもいい, "tea or the like is fine" -- and 何でもいい is
            # "anything"'s.)
            if prev is None or (prev.pos not in ("verb", "auxiliary") and not copula_te
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
        own = _own_ending(pattern, sentence[start:end], tokens, end)
        noun_da = _noun_da(pattern)
        if noun_da and not sentence[start:end].endswith(("だ", "です", "でし", "だっ", "である")) and not own:
            # ことだ, ものだ, ところだ written short of their copula are the
            # nouns こと, もの, ところ unless the copula follows: ということを
            # is "the fact that", ごう慢なところがある "a side of him" (plan 151).
            after = next((t for t in tokens if t.start == end), None)
            if after is None or not _is_copula(after):
                continue
            if pattern not in _NEGATES_ITSELF and _opens_negative(tokens, tokens.index(after)):
                # というものでもない is the negative, which has its own
                # meaning (〜というものではない's) -- as わけではない is
                # 〜わけではない's (plan 188)
                continue
        cited = end in ends and len(sentence[start:end]) >= 5 and sentence[start:end] == parts[spelling][-1][0]
        if tails and not cited and not own and not (_ends_in_da(pattern) and _is_copula(_tail_token(end, tokens) or tokens[0])) and (
                _tail(end, tokens) not in tails if end not in ends
                else _coarse_kind(_tail(end, tokens)) not in {_coarse_kind(k) for k in tails}
                or (_tail(end, tokens) in ("verb", "adjective") and tails <= {"verb", "adjective"}
                    and _tail(end, tokens) not in tails)):
            # (A verb is no adjective at a word's edge either: the いい of
            # なるといい is 良い, no いう -- 〜という; plan 188.)
            # (At a word's edge only function against content word: the ない
            # of しかなかった is an adjective to the tokenizer, and the で of
            # おかげで a particle in one sentence and the copula in the next.)
            continue
        held = next((t for t in tokens if t.start < end < t.end), None) if end not in ends else None
        proposed = False
        if (held is not None and held.pos == "verb" and held.cform.startswith("意志推量形")
                and held.lemma_reading == _final_verb(pattern)):
            # A pattern written in the dictionary form is proposed in the
            # volitional, as its tail is (見てみよう, plan 149): ふりをしよう
            # is 〜ふりをする, and takes the whole word (plan 188).
            end, proposed = held.end, True
            _segments = tuple(_segments[:-1]) + ((_segments[-1][0], end),)
            hit = (start, end, pos, contiguous, spelling, _segments)
        elif held is not None and _is_copula(held) and _ends_in_da(pattern):
            # The copula a pattern written with だ ends on only conjugates:
            # ものだった is 〜ものだ, and takes its た along -- whatever its
            # lessons show, or かのようだった leaves its past to 〜ようです
            # (plan 188).
            after = next((t for t in tokens if t.start == held.end), None)
            end = after.end if after is not None and after.lemma == "た" else held.end
            _segments = tuple(_segments[:-1]) + ((_segments[-1][0], end),)
            hit = (start, end, pos, contiguous, spelling, _segments)
        elif closes and end not in ends and not own:
            # A point its lessons always end on a word's edge stops on one
            # here too. (〜もので + す is not 〜もので.)
            continue
        if "である" not in pattern and _ends_on_de_aru(tokens, end):
            # The で of である is the copula, not 〜ので's or 〜一方で's
            # (神髄なのである, 募る一方である).
            continue
        joins = _joins(level, pattern)
        join = joins[spelling] if spelling < len(joins) else ""
        if join and pos == "particle" and not copula_te:
            token = next((t for t in tokens if t.start == start), None)
            prev = _before_token(start, tokens)
            if token is not None and token.conjunctive != (join == "conj") and not (
                    join == "case" and prev is not None and prev.pos in _PREDICATE
                    and _admits(prev, _admitted(pattern, befores, heads))) and not (
                    # (傘があると安心です: UniDic's case と after a plain form,
                    # before a word that judges what would follow, plan 272)
                    join == "conj" and token.surface == "と" and prev is not None and prev.pos in _PREDICATE
                    and prev.cform.startswith(("終止形", "連体形")) and _judged_after(tokens, end)):
                # (なるとあれば: after a plain form the structure line names,
                # the tokenizer reads と as the conditional; plan 188)
                continue
        if not (copula_te or _attaches(start, tokens, befores, heads, exact)
                # A point that opens on the honorific prefix (お〜ください)
                # stands after anything: 少々お待ちください -- and so does
                # a point that is a verb word itself: 明日いらっしゃいます
                # (plan 193)
                or (start in starts and (pos == "prefix" or (pos == "verb" and "〜" not in pattern)))
                or ((not exact or pattern in _ALSO_AFTER) and _admits(_before_token(start, tokens),
                                                                      _admitted(pattern, befores, heads)))
                or (_after_no(pattern) and (b := _before_token(start, tokens)) is not None and b.surface == "の"
                    and b.pos == "particle" and _noun_before_no_fits(pattern, tokens, b))
                # (お出かけには: お and a verb's stem are a noun, plan 272)
                or (("noun" in befores or "noun" in _admitted(pattern, befores, heads) or not befores)
                    and _polite_stem_before(tokens, start))
                or _closes_on_a_noun(start, end, tokens, befores, heads)
                or _inside_an_adjective(start, tokens, heads)):
            continue
        if _wrong_form(start, tokens, pattern):
            continue
        if not proposed and not own and _ending(end, tokens) not in endings:
            continue
        out.append(hit)
    return out


# The short forms whose ending is their own, not their lessons' (plan
# 272): に伴い ends on a verb's stem where に伴って ends on て, もんじゃ
# on the old copula, はずがなかろう on the old volitional, and
# 優しくなれる inside なる's potential.
_OWN_ENDINGS = {
    "〜に伴って": ("に伴い", "にともない"),
    "〜ものだ": ("もんじゃ", "ものじゃ"),
    "〜はずがない": ("はずがなかろう", "はずはなかろう"),
    "〜くなる／〜になる": ("くなれ", "になれ"),
    "〜に限って": ("に限り", "にかぎり"),
    "〜通りに": ("どおり",),
    "〜によって": ("により",),
}


def _own_ending(pattern: str, text: str, tokens, end: int) -> bool:
    """Whether `text`, a hit of `pattern`, is one of the short forms
    _OWN_ENDINGS lists: one the lessons' shape cannot vouch for. A
    じゃ that opens a negative (もんじゃない) is no ending; なれ ending
    inside a word is なる's (なれる, the potential)."""
    if not any(text.endswith(alt) for alt in _OWN_ENDINGS.get(pattern, ())):
        return False
    i = next((k for k, t in enumerate(tokens) if t.start < end <= t.end), None)
    if i is None:
        return False
    if text.endswith("じゃ") and (i + 1 < len(tokens) and _negative_at(tokens, i + 1) or _opens_negative(tokens, i)):
        return False
    return tokens[i].end == end or tokens[i].lemma in ("成る", "為る", "なる")


def _inside_an_adjective(start: int, tokens, heads) -> bool:
    """Whether the hit opens inside an い-adjective its lessons write the
    point on -- the く of 痛くて, the か of 高かった -- where the word before
    the adjective says nothing of it (plan 272): とても痛くて and ひどく痛
    くて are 〜くて as 喉が痛くて is, though the lessons only ever show a
    particle there."""
    held = next((t for t in tokens if t.start < start < t.end), None)
    return held is not None and held.pos == "adjective" and "adjective" in heads


@lru_cache(maxsize=None)
def _final_verb(pattern: str) -> str:
    """The reading of the verb the pattern's last piece ends in, in its
    dictionary form (〜ふりをする: する), or "" -- the word a proposal
    (ふりをしよう) must be."""
    last = alternatives(pattern)[-1].split("〜")[-1].strip(_TRIM) if alternatives(pattern) else ""
    if not last or not _conjugations(last):
        return ""
    tokens = morphology.tokenize(last) or []
    return tokens[-1].lemma_reading if tokens and tokens[-1].pos == "verb" else ""


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
        # A comma right after a part sets that part's phrase off and
        # closes no clause: 果物の中で、りんごがいちばん, 落ちれば、それまでだ
        # (plan 188).
        rest = between[1:] if between[:1] in _COMMAS else between
        if not commas_ok and any(c in _COMMAS for c in rest):
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


def _stem_spans(tokens, core, relaxed: bool = False, pattern: str = "") -> list[tuple[int, int]]:
    """A stem tail: its tokens, right after a verb or adjective, on a
    token grammaticalised there -- and, for a point its structure line
    writes on a verb's stem, never after the verb's dictionary form
    (乗るっこない, plan 188). A suffix stands after a noun too where the
    line names one (秋めいて, 不安げに)."""
    kinds, form = _structure(pattern) if pattern else (frozenset(), "")
    nominal = bool(core) and core[0][0] == "suffix" and bool(kinds & _NOMINAL)
    # (a suffix after a noun is the pattern's own letters, not a reading of
    # them: 三日's 日 is read か, and no 〜化)
    heads = {alt.lstrip("〜")[:1] for alt in alternatives(pattern)} if nominal else set()
    verb_only = kinds == {"verb"}
    out = []
    for i in range(1, len(tokens)):
        prev = tokens[i - 1]
        if not _grammaticalised(tokens[i]):
            continue
        if not (_stem_before(prev, core) or (nominal and prev.pos in _NOMINAL and tokens[i].surface[:1] in heads)):
            continue
        if verb_only and not (prev.pos == "verb" or prev.lemma_reading in _PASSIVE | _CAUSATIVE
                              or _misread_stem(prev)):
            continue                        # 〜こむ is a verb's: すごくこむ is 混む
        if form == "stem" and prev.pos == "verb" and prev.cform and _form_head(prev.cform) not in _STEM_LIKE:
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


@lru_cache(maxsize=1)
def _deck_words() -> frozenset[str]:
    """Every spelling the vocab deck teaches a word under (its kanji form
    and each of its readings)."""
    from content.vocab_data import VOCAB_BY_LEVEL

    out: set[str] = set()
    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            if entry.get("kanji"):
                out.add(entry["kanji"])
            out.update(k.strip() for k in entry.get("kana", "").split("/") if k.strip())
    return frozenset(out)


def _lexical_causative(tokens, i: int) -> bool:
    """tokens[i] is a せる the tokenizer split from a verb the deck
    teaches whole (plan 193): 知ら + せる is 知らせる, "to inform", and
    済ま + せる 済ませる, "to finish off" -- words a learner has a card
    for, which the reading bank's drafting found lit as the causative
    (知らせてください as 〜させてください, "please let me")."""
    if i == 0 or tokens[i].lemma_reading not in _CAUSATIVE:
        return False
    verb = tokens[i - 1]
    return verb.pos == "verb" and (verb.surface + "せる") in _deck_words()


def _causative_spans(tokens):
    # (...and after がる's stem: こわがらせる, "to frighten", plan 272)
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "auxiliary" and t.lemma_reading in _CAUSATIVE and (
                _after_verb(tokens, i) or (i > 0 and tokens[i - 1].pos == "suffix" and tokens[i - 1].lemma == "がる"))
            and not _lexical_causative(tokens, i)]


def _causative_passive_spans(tokens):
    return [(a.start, b.end) for i, (a, b) in enumerate(zip(tokens, tokens[1:]))
            if a.pos == "auxiliary" and a.lemma_reading in _CAUSATIVE
            and b.pos == "auxiliary" and b.lemma_reading in _PASSIVE
            and not _lexical_causative(tokens, i)]


# A 五段 verb's 未然形 vowel (あ row) to its dictionary ending (う row).
_A_TO_U = dict(zip("かがさたなばまらわ", "くぐすつぬぶむるう"))


def _short_causative_passive_spans(tokens):
    """The short causative-passive of a 五段 verb (plan 193): 走らされた,
    待たされた, 飲まされた are read by the tokenizer as a verb of their
    own in す (走らす) and the passive れる, never as せる + られる.
    Only where the す-verb is no word the deck teaches and the verb it
    is made from is one: 減らされた, 鳴らされた, 動かされた are the
    passives of 減らす, 鳴らす, 動かす, each a card of its own."""
    out = []
    for verb, nxt in zip(tokens, tokens[1:]):
        lemma = verb.lemma
        if (verb.pos != "verb" or not verb.ctype.startswith("五段-サ行") or not verb.surface.endswith("さ")
                or len(lemma) < 3 or lemma[-2] not in _A_TO_U or not _is_kanji_char(lemma[-3])
                or nxt.pos != "auxiliary" or nxt.lemma_reading not in _PASSIVE):
            continue
        deck = _deck_words()
        if lemma not in deck and (lemma[:-2] + _A_TO_U[lemma[-2]]) in deck:
            out.append((verb.end - 1, nxt.end))
    return out


def _is_kanji_char(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff" or c == "々"


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
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        realis = t.cform.startswith("已然形") and (nxt is None or nxt.surface in ("よ", "な", "や") or (
            nxt.pos == "symbol" and nxt.surface in "。！？!?、"))
        if t.pos != "verb" or not (t.cform.startswith("命令形") or realis):
            # (UniDic files the order before よ as the old realis: おごれよ,
            # plan 272.)
            continue
        if t.lemma in ("為る", "する") and i > 0 and tokens[i - 1].surface == "に" and not (
                i + 1 >= len(tokens) or tokens[i + 1].surface in _SENTENCE_ENDS):
            continue                   # 和服にしろ洋服にしろ, 移動するにせよ: the points', no order (plan 272)
        if t.lemma in ("呉れる", "くれる", "下さる", "くださる", "為さる", "なさる", "居らっしゃる", "いらっしゃる",
                       "仰る", "おっしゃる") and (t.auxiliary_use or t.surface.endswith("い")):
            # (くれ, ください, なさい are their points', the requests; the
            # other verbs after て are ordered all the same -- 燃やしてしまえ,
            # やってみろ -- and 参れ alone is "come!", plan 272.)
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
        # (After a clause's の too: 違うのではありませんか, plan 272.)
        if ((t.pos == "particle" and t.surface == "で" or _is_copula(t) and t.cform == "連用形-一般")
              and (_prev_kind(tokens, i) == "nominal" or (
                  i > 0 and tokens[i - 1].pos == "particle" and tokens[i - 1].surface in ("の", "ん")))
              and nxt is not None and nxt.surface in ("は", "も") and i + 2 < len(tokens)):
            neg = tokens[i + 2]
            if neg.lemma in ("無い", "ない") or (neg.lemma in ("御座る", "ござる") and i + 3 < len(tokens)
                                               and tokens[i + 3].lemma in ("ます", "ず")) or (neg.lemma in ("有る", "ある") and (
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
            elif (_is_copula(nxt) and nxt.cform == "連用形-一般" and i + 3 < len(tokens)
                  and tokens[i + 2].surface == "は" and tokens[i + 3].lemma in ("無い", "ない", "有る", "ある")):
                # のではない, のではありませんか: the written 行くんじゃない
                # (plan 272), never ので, "because".
                out.append((begin, nxt.end))
    return out


_MOTION = frozenset({"いく", "くる", "かえる", "もどる", "でかける"})


def _purpose_spans(tokens):
    """〜に行きます in any form and with the verbs its lesson names
    beside 行く (来ます, 帰ります): a verb's 連用形, に, then the verb of
    going -- 会いに来て, 買いに行った, 取りに帰る."""
    out = []
    for i in range(1, len(tokens) - 1):
        stem, ni, go = tokens[i - 1], tokens[i], tokens[i + 1]
        # (A verb UniDic files as auxiliary-capable is the verb itself
        # before に: 見に行く is "go to see", where its auxiliary use is
        # the 〜てみる after a て -- plan 272.)
        after_te = i >= 2 and tokens[i - 2].pos == "particle" and tokens[i - 2].conjunctive
        if (stem.pos == "verb" and stem.cform.startswith("連用形") and not (stem.auxiliary_use and after_te)
                and ni.pos == "particle" and ni.surface == "に"
                and go.pos == "verb" and go.lemma_reading in _MOTION):
            out.append((ni.start, go.end))
    return out


def _closes_a_set_phrase(tokens, i: int) -> bool:
    """Whether the て at tokens[i] is the last letter of a set phrase the
    deck teaches whole, said from its clause's start (plan 272): もし + か
    + し + て is もしかして, "perhaps" (card_lookup.resolve_phrase)."""
    from study.card_lookup import resolve_phrase
    for start in range(max(0, i - 4), i):
        if start == 0 or tokens[start - 1].pos == "symbol":
            hit = resolve_phrase(tokens, start)
            if hit and start + hit[3] - 1 == i:
                return True
    return False


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
        if _closes_a_set_phrase(tokens, i):
            continue                   # もしかして、…: "perhaps", no "and then"
        if _te_owned(tokens, i):
            continue                   # 2024年から2025年にかけて製造された
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
        if not comma and words[0].lemma == "参る":
            continue                   # 持ってまいります: 〜ていく said humbly
        if _thanks_or_apology(words) or _too_much(tokens, i) or _a_feeling(tokens, i + 1):
            continue                   # 遅れてすみません, 食べすぎて, 会えてうれしい: what it is for, no "and then" (plan 272)
        if not comma and len(words) >= 2 and words[0].lemma == tokens[i - 1].lemma and words[1].conjunctive \
                and words[1].surface in ("て", "で"):
            continue                   # 待って待って: one request said twice (plan 272)
        if i >= 3 and tokens[i - 2].conjunctive and tokens[i - 2].surface in ("て", "で") \
                and tokens[i - 3].lemma == tokens[i - 1].lemma:
            continue                   # ...and its second て
        if comma and words[-1].pos == "particle" and words[-1].conjunctive and words[-1].surface in ("から", "ので", "し"):
            # 待って、すぐ行くから: a request and the reason given for
            # it, not two actions in a row -- and nothing in the letters
            # says which, so no key rather than a wrong one (plan 150).
            continue
        if any(u.pos in ("verb", "adjective", "auxiliary") for u in words):
            out.append((t.start, t.end))
    return out


# What a て before it gives the reason for (plan 272): 遅れてすみません,
# 手伝ってくれてありがとう -- 〜て（理由）'s own おそくなって、すみません.
_APOLOGY_HEADS = ("すみ", "すい", "ごめん", "申し訳", "もうしわけ", "ありがとう", "有難う", "有り難う")


def _thanks_or_apology(words) -> bool:
    if not words or not words[0].surface.startswith(_APOLOGY_HEADS):
        return False
    if words[0].surface in ("すみ", "すい"):
        # 済む's すみ before ません, never 墨, "ink": すみがつくえについた
        return words[0].pos == "verb" and len(words) > 1 and words[1].lemma == "ます"
    return True


def _reason_te_spans(tokens):
    """〜て（理由） where the clause after the て is an apology, a thanks
    or a feeling, which the て gives the reason for (plan 272): 遅れて
    すみません, 来てくれてありがとう, 天気がよくて、うれしいです. Elsewhere the
    letters do not say a reason from "and then", and 〜て（理由） is never
    guessed at."""
    out = []
    for i, t in enumerate(tokens):
        if i == 0 or not (t.conjunctive and t.surface in ("て", "で")):
            continue
        if tokens[i - 1].pos not in ("verb", "auxiliary", "adjective"):
            continue
        words = [u for u in tokens[i + 1:i + 4] if u.pos != "symbol"]
        if _thanks_or_apology(words) or _a_feeling(tokens, i + 1) or _felt_so(tokens, i) or _a_verdict(words) or (
                _too_much(tokens, i) and any(
                    u.pos in ("verb", "adjective", "auxiliary") for u in tokens[i + 1:] if u.pos != "symbol")):
            out.append((t.start, t.end))
    return out


# What one says of a thing done: Lにして正解でした, 来てよかった (plan 272).
_VERDICTS = frozenset({"正解", "大正解", "失敗", "大失敗", "損", "得", "後悔", "正しかっ", "間違い"})


def _a_verdict(words) -> bool:
    """Whether `words`, what follows a て, open on a verdict on the deed:
    正解, 失敗, よかった, 助かった."""
    if not words:
        return False
    w = words[0]
    return w.surface in _VERDICTS or (w.lemma in ("良い", "いい", "よい") and len(words) > 1 and words[1].lemma == "た")


def _felt_so(tokens, i: int) -> bool:
    """Whether the て at tokens[i] closes a feeling that what follows
    does because of it: 嬉しくて泣いた, 怖くて動けない -- a verb after it,
    never a second adjective, which 〜くて／〜で lists (嬉しくて楽しい)."""
    prev = tokens[i - 1]
    if not (prev.pos == "adjective" and prev.lemma in _FEELINGS and prev.surface.endswith("く")):
        return False
    k = i + 1
    while k < len(tokens) and tokens[k].pos == "symbol" and tokens[k].surface in _COMMAS:
        k += 1
    return k < len(tokens) and tokens[k].pos == "verb"


# What a clause feels, which the て before it gives the reason for (plan
# 272): 天気がよくて、うれしいです, 会えてうれしい, おそくなって困りました.
_FEELINGS = frozenset({"嬉しい", "悲しい", "寂しい", "残念", "心配", "安心", "困る", "恥ずかしい",
                       "申し訳無い", "助かる", "驚く", "びっくり", "怖い", "嫌", "辛い", "悔しい",
                       "ほっと", "感動", "がっかり"})
_DEGREE = frozenset({"とても", "本当", "本当に", "すごく", "凄く", "大変", "非常に", "ちょっと", "少し", "とっても"})


def _a_feeling(tokens, k: int) -> bool:
    """Whether the clause from tokens[k] is a feeling said of what came
    before -- its first word a feeling (a degree word before it aside),
    and the clause's predicate, never an adverb of a verb after it (家に
    帰って、楽しく遊んだ is "and then")."""
    while k < len(tokens) and tokens[k].pos == "symbol" and tokens[k].surface in _COMMAS:
        k += 1
    if k < len(tokens) and (tokens[k].lemma in _DEGREE or tokens[k].surface in _DEGREE):
        k += 1
        if k < len(tokens) and tokens[k].surface == "に" and tokens[k - 1].surface == "本当":
            k += 1
    if k >= len(tokens) or tokens[k].lemma not in _FEELINGS:
        return False
    nxt = tokens[k + 1] if k + 1 < len(tokens) else None
    if nxt is None or nxt.pos in ("symbol", "auxiliary", "particle"):
        return True
    return nxt.pos == "verb" and nxt.lemma in ("為る", "する")       # 心配した, ほっとした


def _too_much(tokens, i: int) -> bool:
    """Whether the て at tokens[i] is 〜すぎる's, whose excess is the
    reason for what follows (plan 272): 食べすぎて、お腹が痛い, 尊すぎて
    今日も生きられる."""
    prev = tokens[i - 1]
    return (prev.lemma in ("過ぎる", "すぎる") and prev.pos == "verb" and prev.auxiliary_use
            and i >= 2 and tokens[i - 2].pos in ("verb", "adjective", "auxiliary", "other"))


def _na_adjective_sa_spans(tokens):
    """〜さ on a な-adjective, which its structure line names after the い
    one and its lessons never show (plan 272): 大変さ, 便利さ, 豊かさ."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.surface == "さ" and t.pos == "suffix"
            and (tokens[i - 1].pos == "other" or (tokens[i - 1].pos == "noun" and tokens[i - 1].adjectival))]


# The nouns a clause closes on without being described by it: 黙って
# いればいいものを, 聞けばいいことだ (plan 272).
_FORMAL_NOUNS = frozenset({"もの", "もん", "こと", "の", "ところ", "わけ", "はず"})


def _should_spans(tokens):
    """〜といい／〜たらいい／〜ばいい on an い-adjective's ば, which its
    lessons never show (plan 272): 高ければいい, 安ければよい -- いい or よい
    then, never one that describes a noun (思えばよいきっかけ)."""
    out = []
    for i in range(1, len(tokens) - 1):
        ba, good = tokens[i], tokens[i + 1]
        if not (ba.pos == "particle" and ba.surface == "ば" and tokens[i - 1].pos == "adjective"
                and good.pos == "adjective" and good.lemma in ("良い", "いい", "よい")):
            continue
        after = tokens[i + 2] if i + 2 < len(tokens) else None
        if after is not None and after.pos in ("noun", "pronoun") and after.surface not in _FORMAL_NOUNS:
            continue
        out.append((ba.start, good.end))
    return out


def _after_doing_spans(tokens):
    """〜上で where its noun cannot be "above" (plan 272): after a verb
    (よく考えた上で, 確認したうえで, 漢字をおぼえる上で) or after ご／お + a noun and の
    (ご確認のうえ, ご了承の上) -- its で dropped before a comma as business
    writing drops it. 机の上で is the noun 上, "on top"; 決めた上は and
    安い上に are their own points."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface not in ("上", "うえ") or t.pos != "noun" or i == 0:
            continue
        prev = tokens[i - 1]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        after_past = (prev.pos == "auxiliary" and prev.lemma == "た") or (
            # (a verb is never "on top": 漢字をおぼえる上で, in learning
            # them -- with its で, since お金がかかるうえ、 is 〜上に's
            # "besides", its に dropped)
            prev.pos == "verb" and _form_head(prev.cform) in ("連体形", "終止形")
            and nxt is not None and nxt.surface == "で")
        after_polite = (prev.pos == "particle" and prev.surface == "の" and i >= 3
                        and tokens[i - 2].pos == "noun" and tokens[i - 3].pos == "prefix"
                        and tokens[i - 3].surface in ("ご", "御", "お"))
        # (...or after a する-noun and の before a comma, as notices write it:
        # マナーモードに設定のうえ、, plan 272)
        after_polite = after_polite or (prev.pos == "particle" and prev.surface == "の" and i >= 2
                                        and tokens[i - 2].pos == "noun" and _suru_noun(tokens[i - 2].lemma)
                                        and nxt is not None and nxt.pos == "symbol" and nxt.surface in _COMMAS)
        if not (after_past or after_polite):
            continue
        if nxt is not None and nxt.surface == "で" and nxt.pos in ("particle", "auxiliary"):
            out.append((t.start, nxt.end))
        elif nxt is not None and ((nxt.pos == "symbol" and nxt.surface in _COMMAS) or nxt.pos == "verb"):
            out.append((t.start, t.end))
    return out


def _so_that_spans(tokens):
    """〜ように with its に dropped before a comma, as notices and polite
    speech drop it (plan 272): お忘れ物のないよう、, 聞こえるよう、 -- after
    a verb or ない in the plain form; ますよう is 〜ますように's or a
    request's."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface != "よう" or i == 0 or i + 1 >= len(tokens):
            continue
        nxt, prev = tokens[i + 1], tokens[i - 1]
        if not (nxt.pos == "symbol" and nxt.surface in _COMMAS) and not (
                # (お乗り遅れのないようご注意ください: before the request, plan 272)
                nxt.pos == "prefix" and nxt.surface in ("ご", "お", "御")
                and any(u.lemma in ("下さる", "くださる", "願う") for u in tokens[i + 2:i + 5])):
            continue
        if (prev.pos == "verb" and _form_head(prev.cform) in ("連体形", "終止形")) or (
                prev.lemma == "ない" and prev.pos in ("auxiliary", "adjective")
                and _form_head(prev.cform) in ("連体形", "終止形")) or (
                prev.pos == "adjective" and prev.lemma in ("無い", "ない")):
            out.append((t.start, t.end))
    return out


def _ask_to_spans(tokens):
    """〜ように言う where what is said is asked or told, its に dropped as
    polite writing drops it (plan 272): ご査収くださいますようお願い申し上げ
    ます, 来るように頼んだ -- the structure line names 頼む, and お願いする
    is 頼む said humbly."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface != "よう" or i == 0:
            continue
        k = i + 1
        if k < len(tokens) and tokens[k].surface == "に" and tokens[k].pos in ("particle", "auxiliary"):
            k += 1
        if k >= len(tokens):
            continue
        u = tokens[k]
        if u.pos == "prefix" and u.surface == "お" and k + 1 < len(tokens):
            u = tokens[k + 1]
        if u.lemma in ("願う", "頼む", "言う", "伝える") or u.surface.startswith("願い"):
            out.append((t.start, tokens[k - 1].end if k > i + 1 else t.end))
    return out


def _so_much_spans(tokens):
    """〜あまり, "so much that", after a verb's plain form or a noun and の
    (追い求めるあまり, 心配のあまり, 悲しさのあまり, 急いだあまり), where
    あまり cannot be the adverb "not very", which stands before its
    predicate (plan 272), and あまりの + a noun + に, "such … that"
    (あまりの痛さに). Not あまりに, "too", nor the leftovers a case
    particle follows (残ったあまりを)."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface not in ("あまり", "余り"):
            continue
        prev = tokens[i - 1] if i else None
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if nxt is not None and nxt.surface == "の" and i + 3 < len(tokens) and (
                _so_much_noun(tokens, i + 2)) and tokens[_so_much_noun(tokens, i + 2)].surface in ("に", "で"):
            # あまりの痛さに, あまりの暑さで: such pain that. (Its noun
            # keeps its own point: 痛さ is 〜さ's.)
            out.append((t.start, nxt.end))
            continue
        if prev is None or (nxt is not None and nxt.pos == "particle"):
            continue
        if (prev.pos == "verb" and _form_head(prev.cform) in ("連体形", "終止形")) or (
                prev.pos == "auxiliary" and prev.lemma == "た") or (
                prev.pos == "particle" and prev.surface == "の" and i >= 2
                and tokens[i - 2].pos in ("noun", "suffix")):
            # (...a noun, or one an adjective makes: 悲しさのあまり)
            out.append((t.start, t.end))
    return out


def _take_care_spans(tokens):
    """お気をつけください, お〜ください on the idiom 気をつける (plan 272):
    お, its 気を, and つけください."""
    out = []
    for i in range(len(tokens) - 2):
        o = tokens[i]
        if o.surface != "お" or o.pos != "prefix":
            continue
        if tokens[i + 1].lemma == "気を付ける" and tokens[i + 2].lemma in ("下さる", "くださる"):
            # (気をつけ joined as the deck's idiom)
            out.append(((o.start, o.end), (tokens[i + 1].start, tokens[i + 2].end)))
        elif i + 4 < len(tokens):
            ki, wo, tsuke, kudasai = tokens[i + 1:i + 5]
            if (ki.surface == "気" and wo.surface == "を" and tsuke.lemma in ("付ける", "つける", "着ける")
                    and kudasai.lemma in ("下さる", "くださる")):
                out.append(((o.start, o.end), (tsuke.start, kudasai.end)))
    return out


def _suggest_spans(tokens):
    """〜たらどうですか said short, as speech says it (plan 272): たら that
    closes what is said (少し気分を変えたら。), or before どう, いかが
    with nothing but a question after them (行ってみたらどう？). Its
    lessons write どうですか whole."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.pos == "auxiliary" and t.lemma == "た" and t.surface in ("たら", "だら") and i > 0
                and tokens[i - 1].pos in ("verb", "auxiliary")):
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if nxt is not None and nxt.pos == "symbol" and nxt.surface in ("。", "？", "?", "！", "!"):
            # (Its mark says so: a lyric's line left on たら is an "if",
            # ぴょんと跳ねたら.)
            out.append((t.start, t.end))
        elif nxt is not None and nxt.surface in ("どう", "いかが", "如何") and all(
                u.pos in ("symbol", "particle") or _is_copula(u) or u.lemma == "です"
                for u in tokens[i + 2:i + 5]):
            out.append((t.start, nxt.end))
    return out


# The spans of time 〜ぶり counts (plan 272): 三年ぶりの公演, 十日ぶりだ.
_SPANS_OF_TIME = frozenset({"年", "月", "か月", "カ月", "ヶ月", "ヵ月", "週間", "日", "時間", "分", "年間", "日間"})


def _after_so_long_spans(tokens):
    """〜ぶりに with its に said otherwise (plan 272): 三年ぶりの公演, "the
    first performance in three years", 十日ぶりだ -- ぶり after a span of
    time, never 話しぶり, "a way of talking"."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface != "ぶり" or t.pos != "suffix" or i == 0 or tokens[i - 1].surface not in _SPANS_OF_TIME:
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if nxt is not None and (nxt.surface == "の" or _is_copula(nxt)):
            out.append((t.start, t.end))
    return out


def _sound_toiu_spans(tokens):
    """〜という after a sound or a cry set off by its mark (plan 272):
    バーン！という音, 「ギャー」という声."""
    out = []
    for i in range(1, len(tokens) - 1):
        t, prev, nxt = tokens[i], tokens[i - 1], tokens[i + 1]
        if (t.surface == "と" and t.pos == "particle" and prev.pos == "symbol" and prev.surface in ("！", "!", "」", "』")
                and nxt.lemma in ("言う", "いう") and nxt.surface in ("いう", "言う") and i + 2 < len(tokens)
                and tokens[i + 2].pos in ("noun", "prefix")):
            out.append((t.start, nxt.end))
    return out


def _so_much_noun(tokens, k: int) -> int:
    """Where the noun that あまりの describes, starting at tokens[k], ends:
    the index of what follows it (痛さ is an adjective and さ), or 0."""
    if k >= len(tokens):
        return 0
    if tokens[k].pos == "noun" and k + 1 < len(tokens):
        return k + 1
    if tokens[k].pos == "adjective" and k + 2 < len(tokens) and tokens[k + 1].surface == "さ" \
            and tokens[k + 1].pos == "suffix":
        return k + 2
    return 0


def _te_wa_iru_spans(tokens):
    """〜ています with は or も inside it, its negative stressed: 見失っては
    いない, 決まってはおりません, 忘れてもいない (plan 272). Its lessons never
    put a particle there."""
    out = []
    for i in range(1, len(tokens) - 2):
        te, wa, iru = tokens[i], tokens[i + 1], tokens[i + 2]
        if (te.conjunctive and te.surface in ("て", "で") and tokens[i - 1].pos in ("verb", "auxiliary")
                and wa.pos == "particle" and wa.surface in ("は", "も")
                and iru.pos == "verb" and iru.lemma in ("居る", "いる", "おる")):
            out.append(((te.start, te.end), (iru.start, iru.end)))
    return out


def _na_adjective_te_spans(tokens):
    """The で of a な-adjective's て form, 〜くて／〜で's second half, which
    no lesson shows (all four are い-adjectives) and the structure line
    names after its slash (plan 272): この部屋は静かで、きれいです, 元気で、
    仕事も. Only the で that joins: never ではない, でもない, である, でござる."""
    out = []
    for i in range(1, len(tokens)):
        t, prev = tokens[i], tokens[i - 1]
        if not (t.surface == "で" and t.pos == "auxiliary" and t.lemma == "だ"
                and (prev.pos == "other" or (prev.pos == "noun" and prev.adjectival))):
            # (A noun UniDic marks a な-adjective too counts: 残酷で, 楽で.)
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if nxt is None or nxt.surface in ("は", "も") or nxt.lemma in ("有る", "ある", "無い", "ない", "御座る",
                                                                 "ござる", "いらっしゃる"):
            continue
        out.append((t.start, t.end))
    return out


def _but_spans(tokens):
    """が, "but", after a plain clause (plan 272): 怪我しているが、最後まで
    走った, 高いが、おいしい. 〜が（逆接）'s lessons are all polite
    (高いですが), and its structure line says any clause; UniDic files this
    が a conjunctive particle, the subject's が a case particle (雨が降る,
    小さいがゆえに)."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "particle" and t.surface == "が" and t.conjunctive
            and tokens[i - 1].pos in ("verb", "adjective", "auxiliary")
            and not _insists(tokens, i)]


def _insists(tokens, i: int) -> bool:
    """Whether the が at tokens[i] closes its sentence after だろう on an
    exclamation, which insists rather than turns (plan 272): 見りゃ分かる
    だろうが！, "anyone can see that!". Before a full stop it is "though":
    普通は言わないだろうが。"""
    return (tokens[i - 1].surface in ("だろう", "だろ", "でしょう", "でしょ")
            and i + 1 < len(tokens) and tokens[i + 1].surface in ("！", "!"))


def _only_after_verb_spans(tokens):
    """だけ, "only, just", after a verb or an ending (plan 272): 謝るだけ
    ではすまない, 少し走っただけで. 〜だけ's lessons put it after a noun."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "particle" and t.surface == "だけ" and _after_a_plain_form(tokens, i)]


def _one_no_spans(tokens):
    """の after a word that is no noun, where の's lesson (そのかさはわたしの
    です, "mine") is at work (plan 272): 大きいのをください, "the big one";
    初めての土地, せっかくの休み, またのお越し -- a modifier joined to its
    noun. Never the の of 〜ので, 〜のに, 〜のです or 〜のは〜だ, their own
    points."""
    out = []
    copula_later = lambda k: any(_is_copula(u) for u in tokens[k:])
    for i in range(1, len(tokens) - 1):
        t, prev, nxt = tokens[i], tokens[i - 1], tokens[i + 1]
        if t.surface != "の" or t.pos != "particle":
            continue
        if prev.pos == "adjective" and _form_head(prev.cform) in ("終止形", "連体形") \
                and nxt.pos == "particle" and nxt.surface in ("を", "が", "と", "も", "は") \
                and not (nxt.surface == "は" and copula_later(i + 2)):
            out.append((t.start, t.end))
        elif prev.pos == "adverb" and prev.surface in ("初めて", "はじめて", "せっかく", "また", "多く", "おおく",
                                                       "少し", "すこし", "ちょっと", "かなり", "最近"):
            if nxt.pos in ("noun", "prefix", "pronoun"):
                out.append((t.start, t.end))
    return out


def _adverb_wa_spans(tokens):
    """は after an adverb, the contrast は's lesson shows (魚は食べますが、
    にくは食べません) said of when or how (plan 272): たまには, "once in a
    while at least"; まずは, ついには."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "particle" and t.surface == "は" and not t.conjunctive
            and tokens[i - 1].pos == "adverb" and tokens[i - 1].surface not in ("そう", "こう", "ああ", "どう")]


def _compound_form_spans(tokens, lemma: str, form: str):
    """The forms of a compound particle its lesson names beside the て
    form (plan 272): に関する and に対する before a noun, に関し and に対し
    written; によれば and によりますと for 〜によると; による before a noun
    and により for 〜によって (地震による被害, "damage from the
    earthquake")."""
    out = []
    for i in range(len(tokens) - 1):
        p, v = tokens[i], tokens[i + 1]
        if not (p.surface == "に" and p.pos == "particle" and v.pos == "verb" and v.lemma == lemma):
            continue
        after = tokens[i + 2] if i + 2 < len(tokens) else None
        after2 = tokens[i + 3] if i + 3 < len(tokens) else None
        if form == "noun_or_written":
            if v.cform.startswith("連体形") and after is not None and after.pos in ("noun", "prefix", "pronoun"):
                out.append((p.start, v.end))
            elif v.cform.startswith("連用形") and (after is None or (after.pos == "symbol" and after.surface in _COMMAS)):
                out.append((p.start, v.end))
        elif form == "reported":
            if after is not None and v.cform.startswith("仮定形") and after.surface == "ば":
                out.append((p.start, after.end))
            elif (after is not None and after2 is not None and v.cform.startswith("連用形") and after.lemma == "ます"
                  and after.surface == "ます" and after2.surface == "と" and after2.pos == "particle"):
                out.append((p.start, after2.end))
        elif form == "means":
            if v.cform.startswith("連体形") and after is not None and after.pos in ("noun", "prefix"):
                out.append((p.start, v.end))
            elif v.cform.startswith("連用形") and v.surface in ("より", "因り") and after is not None \
                    and after.pos == "symbol" and after.surface in _COMMAS:
                out.append((p.start, v.end))
    return out


def _kanshite_forms_spans(tokens):
    return _compound_form_spans(tokens, "関する", "noun_or_written")


def _taishite_forms_spans(tokens):
    return _compound_form_spans(tokens, "対する", "noun_or_written")


def _niyoruto_forms_spans(tokens):
    return _compound_form_spans(tokens, "因る", "reported")


def _niyotte_forms_spans(tokens):
    return _compound_form_spans(tokens, "因る", "means")


# What a clause and its と are said, thought or reported with, besides
# the lesson's 言う and 思う (plan 272).
_SAYING_VERBS = frozenset({"言う", "思う", "考える", "話す", "答える", "書く", "聞く", "伝える", "述べる", "叫ぶ",
                           "信じる", "感じる", "語る", "記す", "告げる", "申す", "おっしゃる", "仰る", "存ずる",
                           "見る", "呼ぶ", "為る", "する"})
# The verbs a quotation's と hands what is known, decided or wished
# (plan 272): 悪いと知りつつ, 繰り返すまいと誓った, 二度と来るまいと決めた.
_KNOWING_VERBS = frozenset({"分かる", "知る", "誓う", "決める", "願う", "祈る", "認める", "気付く", "悟る", "疑う",
                            "見做す", "考え得る"})
_VOWING_VERBS = frozenset({"誓う", "決める", "願う", "祈る"})
_SAYING_NOUNS = frozenset({"発表", "説明", "報告", "主張", "判断", "予想", "回答", "返事", "連絡", "指摘", "強調",
                           "宣言", "表明", "発言", "約束", "決定", "結論", "推測", "推定", "証言", "供述", "否定"})


def _closes_its_clause(tokens, k: int) -> bool:
    """Whether the する at tokens[k], with its て or た, ends its clause:
    として、, とする。, とした。"""
    if tokens[k].cform.startswith(("仮定形", "未然形")):
        return False                    # すれば, しよう
    k += 1
    while k < len(tokens) and ((tokens[k].conjunctive and tokens[k].surface in ("て", "で"))
                               or (tokens[k].pos == "auxiliary" and tokens[k].lemma == "た"
                                   and tokens[k].cform.startswith("終止形"))):
        k += 1
    return k >= len(tokens) or (tokens[k].pos == "symbol" and (tokens[k].surface in _COMMAS
                                                               or tokens[k].surface in _UTTERANCE_ENDS))


def _quote_to_spans(tokens):
    """The と of what is said or thought, と's lesson's 「行く」と言いました,
    after a whole clause and before a verb or a noun of saying (plan 272):
    導入すると発表した, "announced that it would bring it in"; 被害が相次い
    でいるとして, "saying that the cases keep coming".
    Never the と of 〜と ("whenever"), which a clause follows."""
    out = []
    for i in range(1, len(tokens) - 1):
        t, prev, nxt = tokens[i], tokens[i - 1], tokens[i + 1]
        if not (t.surface == "と" and t.pos == "particle"):
            continue
        if not ((prev.pos in ("verb", "adjective", "auxiliary") and prev.cform.startswith("終止形"))
                # (a greeting said on someone's behalf, plan 272: 部長が
                # よろしくと申しておりました)
                or prev.surface in ("よろしく", "宜しく", "ありがとう", "おめでとう", "さようなら")):
            continue
        saying = (nxt.pos == "verb" and nxt.lemma in _SAYING_VERBS
                  and (nxt.lemma not in ("為る", "する") or _closes_its_clause(tokens, i + 1))) or (
            nxt.pos == "noun" and nxt.lemma in _SAYING_NOUNS and i + 2 < len(tokens)
            and tokens[i + 2].pos == "verb" and tokens[i + 2].lemma in ("為る", "する"))
        if not saying:
            # (plan 272) Through a は or も (あるとは言えない, 消えるとは思え
            # ない), or a word and its particle (と心に誓った), to a verb of
            # saying, thinking, knowing or deciding.
            k = i + 1
            while k < len(tokens) and k <= i + 3 and (
                    (tokens[k].pos == "particle" and tokens[k].surface in ("は", "も")
                     or tokens[k].surface == "に" and tokens[k - 1].surface in ("心", "胸"))
                    # (心に誓う, 胸に決める: never 家に帰ると母に話した, a "when")
                    or (tokens[k].surface in ("心", "胸") and k + 1 < len(tokens) and tokens[k + 1].surface == "に")):
                k += 1
            verb = tokens[k] if k < len(tokens) else None
            # (分かる, 知る after a deed are a "whenever" as often:
            # 勉強すると分かる, "study and you'll see" -- a quotation only
            # after a state, 悪いと分かりつつ, or an intention.)
            stated = prev.pos in ("adjective", "auxiliary") or prev.lemma in ("有る", "ある", "居る", "いる")
            saying = verb is not None and verb.pos == "verb" and verb.lemma not in ("為る", "する") and (
                verb.lemma in _SAYING_VERBS or verb.lemma in _KNOWING_VERBS) and (
                k > i + 1 or verb.lemma in _VOWING_VERBS or (verb.lemma in _KNOWING_VERBS and stated))
        if saying:
            out.append((t.start, t.end))
    return out


def _humble_go_come_spans(tokens):
    """〜ていく／〜てくる said humbly (plan 272): 確認してまいります, "I
    will go and check" -- the て and まいる, the humble いく and くる."""
    return [(t.start, tokens[i + 1].end) for i, t in enumerate(tokens[:-1])
            if i > 0 and t.conjunctive and t.surface in ("て", "で")
            and tokens[i - 1].pos in ("verb", "auxiliary")
            and tokens[i + 1].pos == "verb" and tokens[i + 1].lemma == "参る"]


def _from_until_spans(tokens):
    """から〜まで with one of its two ends: から after a noun is "from"
    and まで after a noun "until", the two halves of the one lesson
    (から after a clause is 〜から, "because"). With both present the
    two-part hit is the one reported (_detect's dedupe). An adjective's
    く form is a noun there: 夜遅くまで, 朝早くから (plan 272)."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "particle" and t.surface in ("から", "まで") and not t.conjunctive
            and (_prev_kind(tokens, i) == "nominal"
                 or (tokens[i - 1].pos == "adjective" and tokens[i - 1].cform.startswith("連用形")
                     and tokens[i - 1].surface.endswith("く")))]


def _after_a_plain_form(tokens, i: int) -> bool:
    """Whether tokens[i] follows a verb or an ending in its plain form
    (plan 272): 亡くなるまで, "until he died"; 走っただけ, "only ran"."""
    if i < 1:
        return False
    prev = tokens[i - 1]
    return prev.pos in ("verb", "auxiliary") and _form_head(prev.cform) in ("終止形", "連体形")


def _adjective_spans(tokens):
    """い形容詞／な形容詞 where its lesson's forms are written: the な a
    な-adjective takes before a noun (しずかな店), and an い-adjective's
    own negative and past (高くない, 高かった). The dictionary form in
    front of a noun is the word and nothing to point at."""
    out = []
    for i, t in enumerate(tokens):
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        after = tokens[i + 2] if i + 2 < len(tokens) else None
        if (_is_copula(t) and t.lemma == "だ" and _form_head(t.cform) == "連体形"
                and i > 0 and tokens[i - 1].pos in ("other", "noun", "suffix")
                and nxt is not None and (nxt.pos in ("noun", "pronoun")
                                         # (plan 272: 貴重なお時間, 重大な不具合; 豊かなばかり,
                                         # 意外なほど; 経済的な豊かさ)
                                         or (nxt.pos == "prefix" and after is not None and after.pos == "noun")
                                         or (nxt.surface in ("ほど", "ばかり") and nxt.pos == "particle")
                                         or (nxt.pos == "other" and after is not None and after.pos == "suffix"
                                             and after.surface in ("さ", "み")))):
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


def _a_word_of_its_own(surface: str) -> bool:
    """Whether the deck or JMdict holds `surface` as a word: 思わず,
    "involuntarily", 絶えず, 親知らず (a wisdom tooth) -- a ず inside one
    is that word's, no negative to point at (plan 272)."""
    from study.card_lookup import is_a_word
    return is_a_word(surface)


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
        elif (t.pos == "auxiliary" and t.lemma == "ず" and prev.pos in ("verb", "auxiliary") and prev.lemma != "ます"
              and t.surface in ("ず", "ぬ", "ざる", "ざれ", "ざら", "ね", "ん")
              and not _a_word_of_its_own(prev.surface + t.surface)
              and not (prev.surface in ("いわ", "言わ") and i >= 2 and tokens[i - 2].surface == "と")):
            # The negative written: 頼らず, 至らぬ点, 働かざる者, 作らねば, and
            # the spoken わからん (plan 272). Its longer points (〜ずに,
            # 〜ざるを得ない, 〜ねばならない) take it over.
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
        # (drawn out too: 教えて〜, plan 272)
        if i == 0 or not (t.conjunctive and t.surface.rstrip("〜ー～") in ("て", "で")):
            continue
        prev = tokens[i - 1]
        negative = prev.pos == "auxiliary" and prev.lemma == "ない"
        # (said twice, the first is the request too: 待って待って, plan 272)
        twice = (i + 2 < len(tokens) and tokens[i + 1].lemma == prev.lemma and tokens[i + 1].pos == "verb"
                 and tokens[i + 2].conjunctive and tokens[i + 2].surface in ("て", "で"))
        again = (i >= 3 and tokens[i - 2].conjunctive and tokens[i - 2].surface in ("て", "で")
                 and tokens[i - 3].lemma == prev.lemma)
        if not (prev.pos == "verb" or negative) or not (_sentence_final(tokens, i) or twice or (
                again and i + 1 < len(tokens) and tokens[i + 1].pos == "symbol")):
            continue
        if any(u.pos == "particle" and u.surface == "が" and not u.conjunctive
               for u in tokens[_clause_start_of(tokens, i):i]):
            continue
        out.append((prev.start if negative else t.start, t.end))
    return out


# What closes a clause that gives a reason or a condition before the one
# it is said of (plan 272).
_CLAUSE_CLOSERS = frozenset({"から", "ので", "けど", "けれど", "けれども", "のに", "し", "ば", "たら"})


def _clause_start_of(tokens, i: int) -> int:
    """Where the clause tokens[i] closes opens: after the comma or the
    から of the clause before it -- 道が滑りやすいから、気をつけてね asks
    the listener, whatever the road does."""
    start = _sentence_start(tokens, i)
    for k in range(i - 1, start - 1, -1):
        u = tokens[k]
        if (u.pos == "symbol" and u.surface in _COMMAS) or (u.pos == "particle" and u.surface in _CLAUSE_CLOSERS):
            return k + 1
    return start


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


def _index_from(tokens, start: int) -> int:
    """The index of the first token at or after `start`, or len(tokens)."""
    return next((i for i, t in enumerate(tokens) if t.start >= start), len(tokens))


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
    # (plan 272: なにがいいか悩む, どれにするか選ぶ)
    "悩む", "選ぶ", "迷い", "悩み",
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
    if first.surface == "と" and len(after) > 1 and after[1].surface in ("いう", "言う") \
            and len(after) > 2 and after[2].pos in ("noun", "pronoun"):
        return True                                    # 何を問うかという力 (plan 272)
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


def _filler_ano(tokens, start: int, end: int, _segments) -> bool:
    """あのね, あのさ: "hey, you know", a filler that opens what is said,
    no demonstrative "that" (plan 272)."""
    i = _index_at(tokens, start)
    if i is None or tokens[i].surface != "あの" or i + 1 >= len(tokens):
        return False
    return tokens[i + 1].surface.rstrip("ーぇえ") in ("ね", "さ", "な") and tokens[i + 1].pos == "particle"


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


def _says_of_its_subject(tokens, k: int) -> bool:
    """Whether the adjective at tokens[k] is said of a subject its clause
    names (家賃が安く、, けがは軽く、, 湿度も高く、): the continuative, "is …,
    and". 朝早く、 and 危なく、 have none, and are adverbs."""
    if k > 0 and tokens[k - 1].surface in ("朝", "今朝", "夜", "晩", "夕方", "明朝", "昼"):
        return False
    j = k - 1
    while j >= 0 and not (tokens[j].pos == "symbol" and (tokens[j].surface in _COMMAS or tokens[j].surface in _UTTERANCE_ENDS)):
        if tokens[j].pos == "particle" and tokens[j].surface in ("が", "は", "も") and not tokens[j].conjunctive:
            return True
        j -= 1
    return False


def _same_twice(tokens, segments) -> bool:
    """Whether 〜か〜か asks one question twice (plan 272): the words
    between two か, a comma aside, are the words before the first, as in
    入るか、入るか and 今か今か -- no choice. 病院が払うのか、患者が払うの
    か and 賛成なのか、反対なのか are two. Read from any か the point is
    on, its one か included."""
    kas = [k for k, u in enumerate(tokens) if u.surface == "か" and u.pos == "particle"]
    mine = {_index_at(tokens, a) for a, _b in segments}
    for k1, k2 in zip(kas, kas[1:]):
        if not ({k1, k2} & mine) or k2 <= k1 + 1:
            continue
        between = [u.surface for u in tokens[k1 + 1:k2] if not (u.pos == "symbol" and u.surface in _COMMAS)]
        before = [u.surface for u in tokens[max(0, k1 - len(between)):k1]]
        if between and between == before:
            return True
    return False


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
    """それで ("and so") is not the それで of それでも ("even so") nor of
    それでは ("well then"), and not それ + で before an evaluation:
    それでいい is "that's fine", それでお願いします "that one, please"
    (plan 272)."""
    from study.card_lookup import evaluates

    i = _index_at(tokens, start)
    if i is None:
        return False
    k = next((n for n in range(i, len(tokens)) if tokens[n].end == end), None)
    if k is None or k + 1 >= len(tokens):
        return False
    return tokens[k + 1].surface in ("も", "は") or evaluates(tokens, k + 1)



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
    from study.card_lookup import whole_word_spans
    if any(tail <= tokens[first].start and tokens[first].end <= e for _s, tail, e in whole_word_spans(tokens)):
        return True                    # 実は's は is no topic (plan 272)
    if any(u.pos == "particle" and u.conjunctive and u.surface not in ("て", "で")
           for u in tokens[first + 1:last]):
        return True
    if any(_is_copula(tokens[j]) and tokens[j].surface == "で" and tokens[j + 1].surface in _COMMAS
           and tokens[j - 1].pos in ("noun", "other") for j in range(first + 2, last)):
        # (仕事は楽で、暇がたくさんあります: the copula's で after a noun
        # closed the topic's clause, plan 272 -- never ので's, 冷えるので、)
        return True
    if any(u.pos == "verb" and u.cform.startswith("連用形-一般") and v.surface in _COMMAS
           and not (w.pos == "particle" and w.surface in ("に", "を", "と") and u.lemma in _compound_particle_verbs())
           for w, u, v in zip(tokens[first:last], tokens[first + 1:last], tokens[first + 2:last + 1])):
        # A clause closed on its verb's stem before a comma is the topic's
        # own (plan 272): 部分は任せ、…ときが来ている, "leave those parts
        # to it; the time has come". Not a compound particle's verb, which
        # closes nothing: この店は味といい値段といい、文句がない.
        return True
    for k in range(max(first, 2), last):
        # (A clause conceded before a comma is closed, its とは no topic:
        # 一般化は難しいとはいえ、…意義がある, plan 272. One that says how or
        # how far goes on to the same topic: 年齢を問わず、, 美しいだけでなく、.)
        if tokens[k].lemma in ("言う", "いう") and tokens[k - 1].surface == "は" and tokens[k - 2].surface == "と" \
                and k + 1 < len(tokens) and tokens[k + 1].surface in _COMMAS:
            return True
    return _ga_in_a_clause_of_its_own(tokens, first, last)


# What closes a clause the topic is no part of: ゆうひがしずむまで, 雨が
# 降ると思う, 被害が相次いでいるとして (plan 272).
_CLAUSE_OF_ITS_OWN = frozenset({"まで", "と", "ながら"})
_TIME_NOUNS = frozenset({"とき", "時", "前", "まえ", "後", "あと", "うち", "間", "あいだ"})


def _ga_in_a_clause_of_its_own(tokens, first: int, k: int) -> bool:
    """Whether the が at tokens[k] is the subject of a clause that closes
    before the sentence's own predicate (plan 272): ふたりはゆうひがしずむ
    までがんばりました -- the two did their best, the sun set; 露は太陽が
    昇ると蒸発した. A quotation's と closes it where the topic is who says
    or thinks it (彼は自分が一番だと言った; 警視庁は、被害が相次いでいる
    として) -- not where the topic is said of inside it (御社は残業が多いと
    伺いました, "I heard your firm has a lot of overtime")."""
    i = k + 1
    while i < len(tokens) and tokens[i].pos not in ("verb", "adjective") \
            and not (tokens[i].pos == "auxiliary" and tokens[i].lemma in ("だ", "です")):
        if tokens[i].pos == "symbol" and tokens[i].surface in _UTTERANCE_ENDS:
            return False
        i += 1
    i += 1
    while i < len(tokens) and (tokens[i].pos == "auxiliary" or (tokens[i].conjunctive and tokens[i].surface in ("て", "で"))
                               or (tokens[i].pos == "verb" and tokens[i].auxiliary_use)):
        i += 1
    if i >= len(tokens):
        return False
    nxt = tokens[i]
    if nxt.pos == "particle" and nxt.surface == "と" and i + 1 < len(tokens) and (
            tokens[i + 1].lemma in _SAYING_VERBS or tokens[i + 1].lemma in _SAYING_NOUNS
            or tokens[i + 1].lemma in ("聞く", "伺う", "見る", "嘆く", "分かる", "信じる", "いう")):
        topic = tokens[first - 1] if first >= 1 else None
        return topic is not None and (topic.pos == "pronoun" or topic.name_kind in ("family", "given", "person")
                                      or (first >= 1 and tokens[first + 1].surface in _COMMAS))
    if nxt.pos in ("noun", "pronoun") and tokens[i - 1].cform.startswith("連体形") \
            and tokens[i - 1].pos in ("verb", "adjective", "auxiliary") and not _carries_the_predicate(tokens, i):
        # (plan 272) A が inside a clause that describes a noun: 本規約は、
        # 当社が提供するすべてのサービスの…定める -- the topic is of 定める.
        return True
    return (nxt.pos == "particle" and nxt.surface in _CLAUSE_OF_ITS_OWN) or nxt.surface in _TIME_NOUNS


# The nouns a predicate goes on through, no noun it describes (plan
# 272): 深さが百メートルもあるそうだ, 仕事が速い上に, 経験が少ないわりに.
_PREDICATE_GOES_ON = frozenset({"そう", "よう", "様", "はず", "筈", "わけ", "訳", "上", "うえ", "わり", "割", "一方",
                                "反面", "ため", "為", "おかげ", "せい", "限り", "以上", "うち", "まま", "通り", "とおり",
                                "ほど", "くらい", "ぐらい", "おそれ", "恐れ"})


def _carries_the_predicate(tokens, i: int) -> bool:
    """Whether the noun at tokens[i] carries the clause before it on to
    the sentence's own predicate: a noun of _PREDICATE_GOES_ON, ことから,
    or ところ／もの before the copula (歯が生えかけているところです, 蛙が
    たくさんいたものだった)."""
    nxt, after = tokens[i], tokens[i + 1] if i + 1 < len(tokens) else None
    if nxt.surface in _PREDICATE_GOES_ON:
        return True
    if nxt.surface in ("こと", "事") and after is not None and after.surface == "から":
        return True
    return nxt.surface in ("ところ", "所", "もの", "物", "もん") and after is not None and _is_copula(after)


# What judges the outcome 〜と sets up (plan 272): あると安心, 以内だと助かり
# ます, そうしてもらえると嬉しい.
_JUDGED = frozenset({"安心", "便利", "助かる", "いい", "良い", "よい", "困る", "嬉しい", "うれしい", "ありがたい",
                     "有り難い", "楽", "不便", "危ない", "大変", "心配", "幸い", "面倒"})


def _judged_after(tokens, end: int) -> bool:
    """Whether the word after the と ending at `end` judges what the
    condition would bring: 安心, 便利, 助かる."""
    k = next((j for j, t in enumerate(tokens) if t.start >= end), None)
    return k is not None and (tokens[k].lemma in _JUDGED or tokens[k].surface in _JUDGED)


def _te_te_refused(tokens, start: int, end: int, segments) -> bool:
    """〜て、〜て joins a clause to the next: every て but the last must
    be one _te_link_spans would light on its own -- not the て of
    についての, which a particle follows, nor one a construction hangs
    off (ている)."""
    links = set(_te_link_spans(tokens))
    last = _index_at(tokens, segments[-1][0])
    return any((a, b) not in links for a, b in segments[:-1]) or (last is not None and _te_owned(tokens, last))


# What hangs off a て as a construction's second half, with ている's いる
# and てしまう's しまう (auxiliary_use): てください, てくれる, てほしい.
_AFTER_A_TE = frozenset({"下さる", "くださる", "呉れる", "くれる", "貰う", "もらう", "上げる", "あげる",
                         "頂く", "いただく", "差し上げる", "欲しい", "ほしい"})


def _hiragana_only(text: str) -> bool:
    return bool(text) and all("\u3041" <= c <= "\u309f" for c in text)


# Compound particles whose verb is as often itself, in kanji: 手に取って,
# 責任を持って, 荷物を置いて -- the compound is written in kana (にとって,
# をもって, をおいて).
_LITERAL_TOO = frozenset({("に", "取る"), ("を", "持つ"), ("を", "置く"), ("に", "当たる"), ("に", "有る"),
                          ("と", "有る"), ("に", "答える"), ("を", "込める")})


def _te_owned(tokens, i: int) -> bool:
    """Whether the て at tokens[i] is another point's (plan 272): a
    compound particle's (から〜にかけて, として, について) or a
    construction's first half (してください, 呼びかけています)."""
    if i >= 2 and tokens[i - 2].pos == "particle":
        pair = (tokens[i - 2].surface, tokens[i - 1].lemma)
        if pair in _polite_compounds() and (pair not in _LITERAL_TOO or _hiragana_only(tokens[i - 1].surface)):
            return True
    nxt = tokens[i + 1] if i + 1 < len(tokens) else None
    if nxt is not None and nxt.pos == "auxiliary" and nxt.lemma in ("へん", "てちょう", "てけらいん"):
        return True                    # 聞いてへん, 持ってちょう: Kansai's, Nagoya's (plan 272)
    return nxt is not None and nxt.pos in ("verb", "adjective") and (nxt.auxiliary_use or nxt.lemma in _AFTER_A_TE)


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
    どうしようもない or of a counter (何度も) is another word's; and so
    is the も of 言えなくもない and of こともまた (plan 272)."""
    for a, _b in segments:
        i = _index_at(tokens, a)
        if i is not None and i > 0 and tokens[i - 1].surface in ("なく", "無く") and _followed_by(tokens, tokens[i].end, "ない"):
            return True
        if i is not None and i + 1 < len(tokens) and tokens[i + 1].surface in ("また", "又"):
            return True
        if i is None:
            continue
        if i + 1 < len(tokens) and tokens[i + 1].surface.startswith("かかわら"):
            return True
        if i >= 1 and (_counter_after_nan(tokens, i - 1) or tokens[i - 1].surface in ("しよう", "よう")):
            return True
        if i >= 1 and tokens[i - 1].surface == "まで" and i + 1 < len(tokens) and tokens[i + 1].lemma in ("無い", "ない"):
            return True                # 言うまでもなく: 〜までもない's (plan 272)
    return False


def _asks_after(tokens, end: int) -> bool:
    """Whether what follows `end` asks someone: お願い, 願う, 頼む."""
    k = _index_at(tokens, end)
    if k is None:
        return False
    if tokens[k].pos == "prefix" and tokens[k].surface == "お" and k + 1 < len(tokens):
        k += 1
    return tokens[k].lemma in ("願う", "頼む") or tokens[k].surface.startswith("願い")


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
    if _in_set_phrase(tokens, s) or _many_mo(tokens, s) or _in_kamo(tokens, i):
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
    if t is None:
        return True
    if t.lemma not in ("掛ける", "かける"):
        return False                    # a compound the compound rule read (言いかけ, 読みかけ; plan 188)
    if t.start != s:
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


# What may follow a の that ends what is said (_explaining_no).
_AFTER_A_FINAL_NO = frozenset({"よ", "ね", "か", "さ", "な", "わ", "ぞ", "ぜ", "かな", "かしら", "ねえ", "よね"})


def _asks_why_no(tokens, start: int) -> bool:
    """Whether the の at `start` is the copula's な and の after a word
    that asks why (なぜなのか, どうしてなの): the explaining の, no
    nominaliser (plan 272)."""
    k = _index_at(tokens, start)
    if k is not None and tokens[k].surface == "の" and k >= 1:
        k -= 1
    return (k is not None and k >= 1 and tokens[k].surface == "な" and _is_copula(tokens[k])
            and tokens[k - 1].surface in ("なぜ", "何故", "どうして"))


def _explaining_no(tokens, end: int) -> bool:
    """Whether the の ending at `end` closes what is said, with nothing
    after it but a softening particle: 好きだったの。, 行くの？, 遭わなきゃ
    いけないのよ -- the explaining の, the casual のです."""
    k = _tok_ending(tokens, end)
    if k is None:
        return False
    for u in tokens[k + 1:]:
        if u.pos == "symbol":
            return u.surface in _UTTERANCE_ENDS or u.surface in "…‥"
        if u.pos == "particle" and u.surface in _AFTER_A_FINAL_NO:
            continue
        return False
    return True


def _soreni_refused(tokens, s, e, segments) -> bool:
    """それに is "moreover" where a clause follows it: それに、冷房もない,
    それに家賃も安い. Where the word after it takes it, it is それ and the
    particle (plan 272): それにします, "I'll have that one", それに比べ,
    それに関する記憶, それに挑戦する, それについて."""
    nxt = _next_word(tokens, e)
    if nxt is None:
        return False
    if nxt.pos == "verb" or nxt.surface in ("つい", "は", "対し", "よっ", "よる", "関し", "ひきかえ", "引き換え"):
        return True
    k = _index_at(tokens, nxt.start)
    after = tokens[k + 1] if k is not None and k + 1 < len(tokens) else None
    # (A noun said with する after it is the verb: 挑戦したがる.)
    return nxt.pos == "noun" and after is not None and after.pos == "verb" and after.lemma in ("為る", "する")


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
    if nxt is not None and nxt.lemma == "為る" and nxt.pos == "verb" and prev is not None \
            and prev.pos in ("verb", "adjective", "auxiliary") and prev.cform.startswith("終止形") \
            and _closes_its_clause(tokens, tokens.index(nxt)):
        # A whole clause and とする, として、: what is supposed or claimed
        # (被害が相次いでいるとして, "saying that the cases keep coming",
        # plan 272), and its と the quotation's -- never 〜としたら,
        # 〜としても, 〜とすれば, points of their own.
        return False
    if nxt is not None and nxt.lemma in ("成る", "為る") and nxt.pos == "verb":
        # 言うこととすることとは: "saying and doing", two nouns listed
        k = tokens.index(nxt)
        listed = tokens[k + 1:k + 3]
        return not (len(listed) == 2 and listed[0].lemma in ("事", "の") and listed[1].surface == "と")
    prev = _prev_word(tokens, s)
    if prev is not None and prev.pos == "other" and (prev.surface in _TO_MANNER or prev.surface.endswith("々")) \
            and not (nxt is not None and (nxt.lemma in _SAYING or nxt.lemma in _THOUGHT)):
        return True                    # 意外と優しい: the adverb's と (plan 272)
    return prev is not None and prev.surface == "度"


# The な-adjectives of manner said with と (analysis.TO_MANNER).
_TO_MANNER = frozenset({"意外", "案外", "平然", "漠然", "毅然", "呆然", "唖然", "悠然", "颯爽", "歴然", "断然",
                          "公然", "決然", "整然", "雑然", "騒然", "愕然", "泰然", "超然", "敢然", "漫然", "黙然",
                          "茫然", "憤然", "釈然", "厳然", "粛然", "猛然", "忽然"})


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
    ないたかと思うと is 泣いた, written in kana. Nor is ん after a verb's
    plain form, the explaining の said short (plan 272): なんぼするん？,
    "how much is it?" -- the negative ん is on the ない stem (せん, 行かん)."""
    i, t = _tok_at(tokens, s)
    if t is not None and t.surface == "ん" and i >= 1 and tokens[i - 1].pos in ("verb", "auxiliary") \
            and tokens[i - 1].cform.startswith(("終止形", "連体形")):
        return True
    return (t is not None and t.surface == "ない" and i + 1 < len(tokens) and tokens[i + 1].lemma == "た"
            and tokens[i + 1].surface == "た")


# What 〜ことに says it feels about what follows (plan 272): 残念なこと
# に, 驚いたことに -- 全力を尽くしたことに意味がある is こと and に.
_FELT = frozenset({"残念", "驚く", "嬉しい", "悲しい", "困る", "不思議", "幸い", "面白い", "意外", "感心", "呆れる",
                   "恐ろしい", "悔しい", "情けない", "有り難い", "ありがたい", "不幸", "幸運", "興味深い", "皮肉",
                   "良い", "よい", "いい", "悪い", "まずい", "困った",
                   "惜しい", "喜ばしい", "腹立たしい", "驚き", "うれしい", "かなしい", "ざんねん", "困った"})


def _felt_before_koto(tokens, start: int) -> bool:
    """Whether the こと of 〜ことに at `start` follows a word of feeling,
    the な of a な-adjective or the た of a verb aside."""
    k = _index_at(tokens, start)
    if k is None:
        return False
    j = k - 1
    while j >= 0 and tokens[j].surface in ("な", "た", "だ") and tokens[j].pos == "auxiliary":
        j -= 1
    return j >= 0 and (tokens[j].lemma in _FELT or tokens[j].surface in _FELT)


def _explanatory_refused(tokens, s, e, _g) -> bool:
    """〜んです／〜のです explains after a predicate: 私のです is "mine"."""
    i, t = _tok_at(tokens, s)
    if t is None or t.surface not in ("の", "ん"):
        return False
    prev = _prev_word(tokens, s)
    return prev is not None and prev.pos in ("noun", "pronoun", "suffix")


def _passive_refused(tokens, s, e, _g) -> bool:
    """おられる is おる's honorific, never a passive; nor is なられる
    (お休みになられる, 先生になられた) -- なる has no passive anyone says
    (plan 272). And where the sentence says the られる is the potential
    (plan 272): an intransitive verb that nobody does to anyone (生きられ
    たなら, 朝起きられず), with no one before に to suffer it (子どもに泣か
    れた is the passive), or one that guesses it cannot be (成し遂げられ
    まい)."""
    prev = _prev_word(tokens, s)
    if prev is not None and prev.surface == "おら":
        return True
    i = _index_at(tokens, s)
    if i is None or i == 0:
        return False
    verb = tokens[i - 1]
    if verb.surface == "なら" and verb.lemma == "成る" and i >= 2 and tokens[i - 2].surface == "に":
        return True
    if tokens[i].lemma_reading != "られる":
        return False
    nxt = tokens[i + 1] if i + 1 < len(tokens) else None
    if nxt is not None and nxt.surface == "まい":
        return True
    return verb.lemma in _INTRANSITIVE and not _suffered_by(tokens, i)


def _potential_refused_by_use(tokens, s, e) -> bool:
    """Where the sentence says the られる is the passive (plan 272): it is
    going on (求められている, 使われている -- what can be done does not go
    on), or someone stands before に to do it (弟にケーキを食べられた)."""
    i = _index_at(tokens, s)
    if i is None or tokens[i].lemma_reading != "られる":
        return False
    nxt = tokens[i + 1] if i + 1 < len(tokens) else None
    after = tokens[i + 2] if i + 2 < len(tokens) else None
    if nxt is not None and nxt.conjunctive and nxt.surface == "て" and after is not None \
            and after.lemma in ("居る", "いる", "おる"):
        return True
    return _suffered_by(tokens, i)


# Intransitive る-verbs whose られる, with nobody before に, can only be
# the potential (plan 272): no one 生きる's or 起きる's anyone.
_INTRANSITIVE = frozenset({"生きる", "起きる", "寝る", "出る", "来る", "逃げる", "居る", "降りる", "落ちる",
                           "出掛ける", "出かける", "生まれる", "慣れる", "痩せる", "太る", "眠る"})
# Who suffers a passive or does it: a person, by a word for one or an
# honorific, an animal, the rain.
_DOERS = frozenset({"私", "僕", "俺", "彼", "彼女", "弟", "妹", "兄", "姉", "母", "父", "子ども", "子供", "こども",
                    "先生", "友達", "友だち", "犬", "猫", "誰か", "人", "皆", "みんな", "上司", "部長", "社長", "客",
                    "雨", "泥棒", "警察", "親", "夫", "妻", "息子", "娘", "隣", "店員", "医者", "他人", "相手"})


def _suffered_by(tokens, i: int) -> bool:
    """Whether a doer and its に stand in the clause before tokens[i]: 弟
    に, 母に, 田中さんに (_DOERS, or a name's honorific)."""
    for k in range(i - 1, 0, -1):
        t = tokens[k]
        if t.pos == "symbol" or (t.pos == "particle" and t.conjunctive):
            return False
        if t.pos == "particle" and t.surface == "に":
            w = tokens[k - 1]
            if w.surface in _DOERS or w.surface.endswith(("さん", "くん", "ちゃん", "様", "たち", "達")) \
                    or (w.pos == "suffix" and w.surface in ("さん", "くん", "ちゃん", "様", "たち", "達")):
                return True
    return False


def _acts_on_nothing(tokens, s, e, _g) -> bool:
    """〜くする／〜にする acts on a thing (部屋をきれいにする, テレビの音、
    小さくする -- the を dropped as speech drops it). An adjective + する
    with nothing before it in its sentence acts on nothing, and is the
    adverbial form and する: 静かにしてください, "be quiet" (plan 188)."""
    before = _sentence_tokens_before(tokens, s)
    if before and before[0].end == s and before[0].pos in ("other", "noun", "suffix"):
        before = before[1:]                 # (静か of 静かにする is the adjective itself)
    return not any(x.pos in _NOMINAL for x in before)


def _noha_da_refused(tokens, s, e, segments) -> bool:
    """〜のは〜だ puts a noun in focus: 好きなのはすしです, 来たのは田中さん
    だ, 休んだのは、病気だったからです. Not the の of というのは (that point's
    own), and not a copula after an adjective, a verb or a manner word --
    本を読むのは楽しいです says what reading is, 小さいのはどうですか asks
    about the small one (plan 188)."""
    prev = _prev_word(tokens, segments[0][0])
    if prev is not None and prev.lemma in ("言う", "云う"):
        return True
    i = _index_at(tokens, segments[-1][0])
    if i is None or i == 0:
        return False
    before = tokens[i - 1]
    if before.pos in ("verb", "adjective") or before.surface == "どう":
        return True
    return before.pos == "adverb" and not _is_question_word(before)


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


@lru_cache(maxsize=2048)
def _suru_noun(lemma: str) -> bool:
    """Whether `lemma` is a noun that takes する: UniDic's サ変可能 noun,
    read alone (注意, 遠慮, 設定)."""
    alone, tags = morphology._tag(lemma, 0, morphology._plain_tagger)
    return len(alone) == 1 and alone[0].pos == "noun" and len(tags[0]) > 2 and "サ変" in (tags[0][2] or "")


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
    # ご + a する-noun + する is the humble form too: ごれんらくします (plan 188)
    as_suru_noun = (t.surface == "ご" and stem.pos == "noun" and i + 2 < len(tokens)
                    and tokens[i + 2].lemma == "為る")
    # ...and before ください the request: ご注意ください, ご遠慮ください
    # (plan 272) -- never お茶ください, a thing asked for
    as_suru_noun = as_suru_noun or (t.surface in ("ご", "御") and stem.pos == "noun" and i + 2 < len(tokens)
                                    and tokens[i + 2].lemma in ("下さる", "くださる") and _suru_noun(stem.lemma))
    if (stem.surface == "気" and i + 3 < len(tokens) and tokens[i + 2].surface == "を"
            and tokens[i + 3].lemma in ("付ける", "つける", "着ける") and len(segments) > 1
            and segments[1][0] == tokens[i + 3].start):
        return False                   # お気をつけください, _take_care_spans's (plan 272)
    if not (as_verb or as_noun or as_suru_noun):
        return True
    if len(segments) < 2:
        return False
    k = _index_at(tokens, segments[-1][1])
    if k is not None and tokens[k].pos == "auxiliary" and tokens[k].lemma_reading in _PASSIVE \
            and tokens[k - 1].surface == "なら":
        return True                    # お休みになられる: _honorific_nare_spans's, with its れ
    if (stem.lemma == "願う" and i + 3 < len(tokens) and tokens[i + 2].lemma == "為る"
            and tokens[i + 3].lemma == "ます" and _sentence_final(tokens, i + 3)):
        return True     # (お願いします closing a sentence: the request "please", a phrase of its own)
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
        # ...and in the past it is the 〜ところだった of "nearly" (乗り遅れる
        # ところだった), except after た, where it is still just done:
        # 着いたところだった, "had just arrived" (plan 193)
        "〜ところだ": lambda t, s, e, g: (p := _prev_word(t, s)) is None or p.pos not in ("verb", "auxiliary")
            or _is_copula(p) or ("".join(x.surface for x in t if s <= x.start < e).endswith(("だった", "でした"))
                                 and p.lemma != "た"),
        "〜ところだった": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.lemma == "た",
        "〜ことは〜が": _koto_wa_ga_refused,
        "〜という": _toiu_refused,
        "〜ように": _youni_refused,
        "〜にします": _niwaka_refused,
        "〜につき": lambda t, s, e, g: _followed_by(t, e, "まし"),
        "〜たばかり": lambda t, s, e, g: _followed_by(t, e, "に"),
        # 〜ばかりだ is "keeps getting": not the たばかり of just done
        # (来たばかりだ), not the んばかり of 泣かんばかりの, and a ばかり
        # with no copula is the particle (plan 188)
        "〜ばかりだ": lambda t, s, e, g: ((p := _prev_word(t, s)) is not None and (p.lemma == "た" or _n_ends(t, p)))
            or not ("".join(x.surface for x in t if s <= x.start < e).endswith(("だ", "です", "でし", "だっ"))
                    or _followed_by_copula(t, e)),
        "〜のは〜だ": _noha_da_refused,
        # 〜もので is "because"; もので + は／も is the copula's negative of
        # もの (笑うものではない, というものでもない), never a reason (plan 188)
        "〜もので": lambda t, s, e, g: _followed_by(t, e, "は", "も"),
        "〜くする／〜にする": _acts_on_nothing,
        # しかたがない, しかたありません: "it can't be helped", no way of doing
        "〜方": lambda t, s, e, g: (k := _tok_ending(t, e)) is not None and t[k].lemma == "仕方" and (
            _negative_at(t, k + 1) or (k + 1 < len(t) and t[k + 1].surface in ("が", "も") and _negative_at(t, k + 2))),
        "〜ばかり": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and _n_ends(t, p),
        # 下げんばかりに is 〜んばかりに, "as if about to bow", no regret
        "〜ばかりに": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and _n_ends(t, p),
        "〜たるもの": _tarumono_refused,
        # 飲みたそう, 食べたそうだった: たい's stem before the そう of looks,
        # no past (plan 152)
        "た形 〜た": lambda t, s, e, g: (i := _index_at(t, s)) is not None and i + 1 < len(t)
            and t[i + 1].surface == "そう" and (_tai_stem(t, i) or (i + 2 < len(t) and t[i + 2].surface in ("だっ", "でし", "な", "に"))),
        # どんなに ("however much") and こんなに／そんなに／あんなに (their
        # own point) are adverbs, no な-adjective's adverbial form
        "〜く／〜に（副詞形）": lambda t, s, e, g: ((p := _prev_word(t, s)) is not None
            and p.surface in ("どんな", "こんな", "そんな", "あんな"))
            # (The く of 高くても or 高くない is the adjective's て form or
            # negative, no adverb, plan 272.)
            or _followed_by(t, e, "て", "ない", "なかっ", "なけれ", "なく", "なかろ")
            # (一大事にございます is でございます said of old, plan 272.)
            or _followed_by(t, e, "ござい", "ござる", "ござり", "御座い", "御座る")
            # (持ちが悪く、: the continuative, "is bad, and" -- an adjective's
            # く before a comma closes its clause, plan 272)
            or ((k := _tok_ending(t, e)) is not None and t[k].pos == "adjective" and k + 1 < len(t)
                and t[k + 1].surface in _COMMAS and _says_of_its_subject(t, k)),
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
        "〜ことに": lambda t, s, e, g: ((n := _next_word(t, e)) is not None and n.pos == "verb")
            or not _felt_before_koto(t, s),
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
        "可能形 〜(ら)れる": lambda t, s, e, g: ("".join(x.surface for x in t if s <= x.start < e) == "いけ"
                                             and _followed_by(t, e, "ない", "ませ", "ず", "なかっ", "なく"))
            or _potential_refused_by_use(t, s, e)
            # (なり得る: 〜得る's own, no potential, plan 272)
            or any(x.lemma == "得る" and x.surface in ("得る", "得", "うる", "える") for x in t if s <= x.start < e),
        "お〜ください": _o_kudasai_refused,
        "お〜になる／お〜する": _o_kudasai_refused,
        "それに": _soreni_refused,
        # (好きだったの。, 気が済むの？: the の that ends what is said
        # explains, the casual のです, never the nominaliser, plan 272.)
        "〜の": lambda t, s, e, g: _explaining_no(t, e) or _asks_why_no(t, s),
        # (ところがある, "there is a side of": 〜ところがある's.)
        "ところが": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.lemma in (
            "有る", "ある", "無い", "ない", "多い", "少ない"),
        "〜ませんか": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (p.lemma in ("有る", "ある") or (
            # (だれか いませんか, "is anyone there?": a question, no
            # invitation, plan 272)
            p.lemma in ("居る", "いる") and any(u.surface in ("誰か", "だれか", "どなたか", "何か", "なにか")
                                                or (u.surface in ("誰", "だれ", "どなた") and v.surface == "か")
                                                for u, v in zip(t, t[1:]) if u.end <= p.start))),
        # この／その／あの／どの stands before its noun: あの、すみません
        # is "um"
        # (あのね, あのさ: a filler that opens what is said, plan 272.)
        "この／その／あの／どの": lambda t, s, e, g: (n := _next_word(t, e)) is None or n.pos == "symbol"
            or _filler_ano(t, s, e, g),
        "これ／それ／あれ／どれ": lambda t, s, e, g: _konosoa_refused(t, s, e, g)
            or ((i := _index_at(t, s)) is not None and _soretomo(t, i)),
        "や": _ya_refused,
        "助数詞 〜つ／〜人／〜枚": _counter_refused,
        "〜かたわら": lambda t, s, e, g: _followed_by(t, e, "に"),
        # plan 193, what the reading bank's drafting found lit wrong:
        # 知らせる and 済ませる are words, not causatives
        "使役形 〜させる": lambda t, s, e, g: _lexical_in(t, s, e),
        "〜させてください": lambda t, s, e, g: _lexical_in(t, s, e),
        # 補償がなされる is なす's passive ("compensation is made"), no
        # honorific なさる
        "いらっしゃる／おっしゃる／なさる": lambda t, s, e, g: any(
            x.lemma in ("成す", "為す") for x in t if s <= x.start < e)
            # (the い of なさい without ます is 〜なさい's command)
            or (sentence_text(t, s, e).endswith("い") and not _followed_by(t, e, "ます", "まし", "ませ")),
        # 発言一つで is "with a single remark": 一つ + a case particle is
        # one of something, not "not even one"
        "〜一つ〜ない": lambda t, s, e, g: (k := _one_at(t, s, e)) is not None and k + 1 < len(t)
            and t[k + 1].pos == "particle" and t[k + 1].surface in _CASE_AFTER_ONE,
        # 遮ろうとしても is 〜ようとする's ても ("even when one tries"),
        # not "even supposing"
        "〜としても": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and (
            p.cform.startswith("意志推量形") or (p.surface == "よう" and p.lemma == "様")),
        # 歌手としても is として + も, "as a singer, too", no "even if"
        "〜ても": _toshite_mo,
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
            p.lemma in ("居る", "いる", "た", "御座る", "ござる") or p.surface in ("てる", "でる", "ござる")),
        "〜のに": lambda t, s, e, g: (n := _next_word(t, e)) is not None and (n.surface.startswith("気") or n.pos == "verb"),
        # 高くても, 高くては: the て of 〜ても and 〜ては, no "and" (plan 272).
        "〜くて／〜で": lambda t, s, e, g: _followed_by(t, e, "も", "は") or _a_feeling(t, _index_from(t, e))
        or (_index_from(t, e) > 0 and _felt_so(t, _index_from(t, e) - 1)),
        # だろうが！ insists, no "but" (plan 272); 足掻くがいい is "go ahead
        # and", 私ごときが the subject's が after the likes of me.
        "〜が（逆接）": lambda t, s, e, g: (i := _index_at(t, s)) is not None and i > 0 and (
            _insists(t, i) or t[i - 1].surface in ("ごとき", "如き")
            # (怒られてまうがね。: Nagoya's がね, "you know!", plan 272)
            or (i + 1 < len(t) and t[i + 1].surface == "ね" and (i + 2 >= len(t) or t[i + 2].pos == "symbol"))
            # (降ろうが: "no matter whether", after the volitional, plan 272)
            or t[i - 1].cform.startswith("意志推量形")
            or (_followed_by(t, e, "いい", "よい", "良い")
                and ((n := _index_at(t, e)) is None or n + 1 >= len(t) or t[n + 1].pos == "symbol"))),
        # 思えばよいきっかけ: the いい of a noun it describes, no advice
        # (plan 272).
        "〜といい／〜たらいい／〜ばいい": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.pos in ("noun", "pronoun")
            and n.surface not in _FORMAL_NOUNS,
        # くださいますようお願いします asks, it wishes nothing (plan 272).
        "〜ますように": lambda t, s, e, g: _asks_after(t, e),
        # のではないか is の and the copula's では, "isn't it that ...";
        # the ので of a reason never takes は (plan 272).
        "〜ので": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.surface == "は" and n.pos == "particle",
        "〜みたいだ": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.pos == "particle"
            and p.surface in ("が", "を"),
        "〜んです／〜のです": _explanatory_refused,
        "受身形 〜られる": _passive_refused,
        "〜と同じ": lambda t, s, e, g: (p := _prev_word(t, s)) is not None and p.surface == "度",
        "〜と言います": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.pos == "noun",
        "ない形 〜ない": _nai_form_refused,
        # (plan 272) 雨が降っていました: the い of 〜ている, no "there is"
        "〜があります／います": lambda t, s, e, g: (k := _index_at(t, g[-1][0])) is not None and k >= 1
            and t[k - 1].conjunctive and t[k - 1].surface in ("て", "で"),
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
        # (時間をおいてから: 置いて, letting time pass -- 〜をおいて is "but
        # for", 彼をおいてほかにいない, plan 272)
        "〜をおいて": lambda t, s, e, g: _te_aux_refused(t, s, e, g) or not any(
            u.surface in ("他", "ほか", "外", "以外") or _negated(u) for u in t if u.start >= e),
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


def _n_ends(tokens, p) -> bool:
    """Whether word p ends in the classical negative ん of 〜んばかり."""
    return _n_before(tokens, tokens.index(p)) is not None


def sentence_text(tokens, start: int, end: int) -> str:
    return "".join(x.surface for x in tokens if start <= x.start < end)


def _lexical_in(tokens, start: int, end: int) -> bool:
    return any(_lexical_causative(tokens, k) for k, x in enumerate(tokens) if start <= x.start < end)


_CASE_AFTER_ONE = frozenset({"で", "が", "を", "に", "の", "と", "から", "まで", "へ", "より"})


def _one_at(tokens, start: int, end: int):
    """The index of the つ of 一つ inside a hit, or None."""
    for k, x in enumerate(tokens):
        if start <= x.start < end and x.surface == "つ" and k > 0 and tokens[k - 1].surface == "一":
            return k
    return None


def _toshite_mo(tokens, start: int, end: int, _g) -> bool:
    """〜ても on the して + も of the compound particle として: a noun, と,
    して, then も."""
    k = next((k for k, x in enumerate(tokens) if start <= x.start < end and x.surface == "て"), None)
    return (k is not None and k >= 3 and tokens[k - 1].lemma == "為る" and tokens[k - 2].surface == "と"
            and tokens[k - 2].pos == "particle" and tokens[k - 3].pos in _NOMINAL)


def tokens_after(tokens, t, surfaces) -> bool:
    k = tokens.index(t)
    rest = [x.surface for x in tokens[k + 1:k + 1 + len(surfaces)]]
    return tuple(rest) == tuple(surfaces)


# The な-adjective's adverbial form: 静かに, 非常に.
_ADVERBIAL = "〜く／〜に（副詞形）"

_NEGATIVE_PAIRS = ("もう〜ない", "あまり〜ない", "ぜんぜん〜ない", "ちっとも〜ない", "なかなか〜ない",
                   "何も／誰も〜ない", "別に〜ない")


_REFUSALS = {
    "〜でも": _demo_refused,
    "〜とは": _towa_refused,
    "〜とか": _toka_refused,
    "〜か〜か": lambda tokens, s, e, g: _ka_ka_refused(tokens, s, e, g) or _ka_nanika(tokens, s, e, g)
    or _same_twice(tokens, g),
    "〜も〜も": _mo_mo_refused,
    **{p: _negative_part_refused for p in _NEGATIVE_PAIRS},
    "〜は〜が": _wa_ga_refused,
    "〜て、〜て": lambda tokens, s, e, segments: len(segments) > 1 and _te_te_refused(tokens, s, e, segments),
    "それで": _sorede_refused,
    "と": _to_marker_refused,
    "か": lambda tokens, s, e, _g: _in_set_phrase(tokens, s) or (
        (i := _index_at(tokens, s)) is not None and (_embedded_question_at(tokens, i) or _nandaka(tokens, i)
                                                     or _in_kadouka(tokens, i) or _in_kamo(tokens, i))),
    "も": _mo_refused,
    "で": lambda tokens, s, e, _g: _in_set_phrase(tokens, s),
    "に": lambda tokens, s, e, _g: (i := _index_at(tokens, s)) is not None and adverbial_ni(tokens, i),
    # 割に合わない, "it doesn't pay": the idiom 割に合う (plan 272)
    "〜わりに": lambda t, s, e, g: (n := _next_word(t, e)) is not None and n.lemma in ("合う", "あう"),
    # (熱があるようなので: ようだ and ので, no likeness before a noun)
    "〜ような": lambda t, s, e, g: (n := _next_word(t, e)) is None or (n.pos == "particle" and n.surface in ("の", "ので", "のに")),
}


# Nouns that make an adverb with に, which is then none of the times,
# places and receivers に's lesson teaches (plan 272): 本当においしい,
# 一緒に行こう, 特に好きだ.
_ADVERB_NOUNS = frozenset({"本当", "ほんとう", "ほんと", "本と", "一緒", "いっしょ", "特", "とく", "主", "おも",
                           "互い", "たがい", "お互い", "同時", "一斉", "交互", "一度", "いちど", "一気", "一遍",
                           "順番", "次第", "ついで", "代わり",
                           # (plan 272: 絶対に負けない, 誠にありがとうございます,
                           # 実際に見た, 逆に言えば)
                           "絶対", "ぜったい", "誠", "まこと", "実際", "じっさい", "逆", "ぎゃく", "同様",
                           "どうよう", "直接", "ちょくせつ", "偶然", "ぐうぜん"})


def adverbial_ni(tokens, i: int) -> bool:
    """Whether the に at tokens[i] makes an adverb of the noun before it
    (_ADVERB_NOUNS), or of 先 that no の or この makes a place
    (先に帰る, "to go home first", but 駅の先に, "past the station")."""
    if i < 1 or tokens[i].surface != "に":
        return False
    prev = tokens[i - 1]
    if prev.pos not in ("noun", "pronoun", "other"):
        return False
    if prev.surface in ("代わり", "次第"):
        # その代わりに, 着き次第: "instead", "as soon as" -- after a noun of
        # its own they are the noun's (父の代わりに is still "instead of").
        return True
    if prev.surface in _ADVERB_NOUNS:
        return True
    if prev.surface in ("先", "さき"):
        before = tokens[i - 2] if i >= 2 else None
        return before is None or not (before.surface in ("の", "この", "その", "あの", "どの")
                                      or before.pos == "adnominal")
    return False


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


_CONTRACTED = {"てる": "〜ています", "ちゃう": "〜てしまう", "とく": "〜ておく",
               # (plan 272: 置いてっちゃう, 飲んでく -- ていく said short)
               "てく": "〜ていく／〜てくる"}


def _contraction_spans(tokens):
    """(pattern, start, end) for the spoken short forms of three て
    constructions, which the tokenizer reads as auxiliaries of their
    own: してる / 飲んでる / 見てた is 〜ています, 食べちゃった /
    読んじゃう 〜てしまう (its lesson names both), 買っとく 〜ておく. A
    subtitle writes these far more often than the long forms."""
    return [(_CONTRACTED[t.lemma], t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "auxiliary" and t.lemma in _CONTRACTED
            and tokens[i - 1].pos in ("verb", "auxiliary")]


# A sentence-final particle drawn out in speech (plan 272): ねー, よぉ.
_DRAWN_FINAL = frozenset("ーぇェぉォえお〜～")


def _spoken_final_spans(tokens):
    """(pattern, start, end) for the sentence-final particles speech
    writes its own way (plan 272): ね and よ drawn out (雨だねー, そうだよー),
    which no lesson spells and the plain needle does not reach, and
    じゃん, the casual 〜じゃないか (言ってないじゃん, 雨じゃん). Each closes
    its sentence, after what the plain particle comes after; a ねえ that
    opens one is "hey" (an interjection), and stays the tokenizer's."""
    out = []
    for i, t in enumerate(tokens):
        if i == 0 or t.pos != "particle" or not all(u.pos in ("particle", "symbol") for u in tokens[i + 1:]):
            continue
        prev = tokens[i - 1]
        drawn = len(t.surface) > 1 and t.surface[0] in "ねよ" and all(c in _DRAWN_FINAL for c in t.surface[1:])
        if drawn and prev.pos in ("verb", "adjective", "auxiliary", "particle"):
            out.append((t.surface[0], t.start, t.end))
        elif t.surface == "じゃん" and prev.pos in ("verb", "adjective", "auxiliary", "noun", "pronoun", "other"):
            out.append(("〜じゃないか", t.start, t.end))
        elif t.surface == "か" and (de := _formal_janai_at(tokens, i)) is not None:
            # ではないか and ではありませんか, the lesson's own formal and
            # polite spellings (plan 272): 言ったではないか.
            out.append(("〜じゃないか", tokens[de].start, t.end))
        elif _kamo_at(tokens, i) and prev.pos in ("verb", "adjective", "auxiliary", "noun", "pronoun", "other",
                                                   "suffix"):
            # かも, 〜かもしれない said short: 雨かも, 行くかもね.
            out.append(("〜かもしれません", t.start, tokens[i + 1].end))
    return out


def _formal_janai_at(tokens, i: int) -> int | None:
    """The index of the で of では + ない (or ありません), or of the じゃ
    of じゃないです or じゃありません, that closes on tokens[i]'s か, after
    what じゃないか comes after, or None. The plain じゃないか is the
    needle's."""
    for head, tail in ((("で", "は"), ("ない",)), (("で", "は"), ("あり", "ませ", "ん")),
                       (("で", "は"), ("ない", "です")), (("じゃ",), ("ない", "です")),
                       (("じゃ",), ("あり", "ませ", "ん")), (("じゃ",), ("ねえ",)), (("じゃ",), ("ねー",)),
                       (("じゃ",), ("ねぇ",))):
        k = i - len(tail) - len(head)
        if k < 1 or tuple(u.surface for u in tokens[k:i]) != head + tail:
            continue
        if not (tokens[k].pos == "particle" or _is_copula(tokens[k])):
            continue
        if tokens[k - 1].pos in ("verb", "adjective", "auxiliary", "noun", "pronoun", "other", "particle"):
            return k
    return None


def _kamo_at(tokens, i: int) -> bool:
    """Whether tokens[i] is the か of かも closing its clause, 〜かもしれない
    said short (plan 272): 雨かも。, そうかもね -- never the か of a
    question known and its "even" も (本当かも分からない)."""
    if i + 1 >= len(tokens) or tokens[i].surface != "か" or tokens[i].pos != "particle":
        return False
    if tokens[i + 1].surface != "も" or tokens[i + 1].pos != "particle":
        return False
    return all(u.pos in ("particle", "symbol") for u in tokens[i + 2:])


def _in_kamo(tokens, i: int) -> bool:
    """Whether the か or the も at tokens[i] is a letter of かもしれない
    or of かも said short: no question's か and no "also"."""
    k = i if tokens[i].surface == "か" else i - 1
    if k < 0 or k + 1 >= len(tokens) or tokens[k].surface != "か" or tokens[k + 1].surface != "も":
        return False
    nxt = tokens[k + 2] if k + 2 < len(tokens) else None
    return _kamo_at(tokens, k) or (nxt is not None and nxt.lemma in ("知れる", "しれる"))


def _humble_progressive_spans(tokens):
    """(pattern, start, end) for 〜ています said humbly (plan 266): the
    conjunctive て／で, then おる, the humble いる -- 続いております,
    お待ちしております, お世話になっております. A shop, a hotel and a
    letter say it far more often than ています, and its て and おり said
    nothing: no lesson writes it, and いる's needle is not おる."""
    return [("〜ています", t.start, tokens[i + 1].end) for i, t in enumerate(tokens[:-1])
            if i > 0 and t.conjunctive and t.surface in ("て", "で")
            and tokens[i - 1].pos in ("verb", "auxiliary")
            and tokens[i + 1].pos == "verb" and tokens[i + 1].lemma == "居る"
            and tokens[i + 1].lemma_reading == "おる"]


def _single_tari_spans(tokens):
    """〜たり〜たり with one たり: サボったりしたら, "skipping and the
    like" -- one example named, the rest implied. With two, the
    two-part hit is the one reported (_detect's dedupe)."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if i > 0 and t.pos == "particle" and t.lemma in ("たり", "だり")
            and tokens[i - 1].pos in ("verb", "adjective", "auxiliary")]


# ── What the tours found (plan 188) ─────────────────────────────
# Plan 187g wrote a twist and a scene for every point, and its drafters
# met forms of a point the detector could not find, worked around them
# in the text and listed them. A learner's own sentence still uses
# them. The ones the tokenizer can name are read here, each held to its
# point's own lessons like every rule (_confirmed) and pinned with its
# counter-case in tests/test_grammar_precision.py's TourTests.

# A compound the tokenizer files as one word: 乗り込む, 助け合う, 書き直す,
# 見通す, 言い掛ける (one verb each), 遣り甲斐, 泥塗れ, 葱抜き, 買い方, 読み掛け
# (one noun each) -- or as two verbs side by side, 降り + 出す, 開け + 掛ける.
# The point is the compound's second half, known by its lemma, on a first
# half that is a verb's stem (it reads as one before ます: 乗ります,
# 遣ります) or a noun. Per point: (the lemmas the compound ends in with
# their readings, the kinds of compound, the first half's kind, what must
# follow, the compounds its own lesson sets apart -- 思い出す "remember",
# 申し込む and 落ち込む "fixed verbs built on it" -- and the lexical ones
# whose second half means something else: 話し掛ける "speak to", 出掛ける
# "go out", 栓抜き "a bottle opener").
_KAKERU_WORDS = frozenset({
    "話し掛ける", "呼び掛ける", "問い掛ける", "働き掛ける", "出掛ける", "見掛ける", "追い掛ける", "押し掛ける",
    "腰掛ける", "心掛ける", "見せ掛ける", "仕掛ける", "引っ掛ける", "振り掛ける", "詰め掛ける", "持ち掛ける",
    "投げ掛ける", "差し掛ける", "立て掛ける", "吹っ掛ける", "笑い掛ける", "語り掛ける", "誘い掛ける",
    "微笑み掛ける",
    # (plan 272) きっかけ, UniDic's 切っ掛け, is "an occasion", no cutting begun
    "切っ掛ける",
})
_COMPOUNDS: dict[str, tuple] = {
    "〜こむ": ((("込む", "こむ"),), frozenset({"verb"}), "verb", "", frozenset({"申し込む", "落ち込む", "見込む"})),
    "〜あう": ((("合う", "あう"),), frozenset({"verb"}), "verb", "", frozenset({"似合う", "見合う", "掛け合う"})),
    "〜直す": ((("直す", "なおす"),), frozenset({"verb"}), "verb", "", frozenset()),
    "〜通す": ((("通す", "とおす"),), frozenset({"verb"}), "verb", "", frozenset()),
    "〜出す": ((("出す", "だす"),), frozenset({"verb"}), "verb", "", frozenset({"思い出す"})),
    "〜かける": ((("掛ける", "かける"), ("掛け", "かけ")), frozenset({"verb", "noun"}), "verb", "",
               _KAKERU_WORDS | {w[:-1] for w in _KAKERU_WORDS}),
    "〜方": ((("方", "かた"),), frozenset({"noun"}), "verb", "", frozenset()),
    "〜がい": ((("甲斐", "がい"),), frozenset({"noun"}), "verb", "", frozenset()),
    "〜まみれ": ((("塗れ", "まみれ"),), frozenset({"noun"}), "noun", "", frozenset()),
    "〜ぬきで": ((("抜き", "ぬき"),), frozenset({"noun"}), "noun", "で",
               frozenset({"栓抜き", "毛抜き", "手抜き", "息抜き", "骨抜き", "釘抜き", "型抜き", "中抜き"})),
}


@lru_cache(maxsize=4096)
def _stem_reading(front: str) -> str | None:
    """The reading of `front` where it is a verb's stem -- where it reads
    as one before ます (乗り -> 乗ります) -- else None."""
    tokens = morphology.tokenize(front + "ます") or []
    if (len(tokens) == 2 and tokens[0].pos == "verb" and tokens[0].cform.startswith("連用形")
            and tokens[1].lemma == "ます"):
        return tokens[0].reading.translate(_SAID)
    return None


@lru_cache(maxsize=4096)
def _noun_front(front: str) -> bool:
    tokens = morphology.tokenize(front) or []
    return bool(tokens) and all(t.pos in _NOMINAL for t in tokens) and _stem_reading(front) is None


def _misread_stem(t) -> bool:
    """Whether t is a verb's stem in kana the tokenizer read as an
    adjective's attributive form: なき出す's なき is 泣き, not 無き -- an
    attributive form never stands before a verb, and なき reads as a
    stem before ます (泣きます)."""
    return (t.pos == "adjective" and t.cform.startswith("連体形")
            and all("\u3041" <= c <= "\u309f" for c in t.surface) and _stem_reading(t.surface) is not None)


def _compound_offset(t, spec) -> int | None:
    """Where in t's surface the compound's second half begins, or None
    where t is no such compound."""
    tails, kinds, front_kind, _then, excepted = spec
    if t.pos not in kinds or t.lemma in excepted:
        return None
    for lemma_tail, reading_tail in tails:
        if not t.lemma.endswith(lemma_tail) or len(t.lemma) == len(lemma_tail):
            continue
        front = t.lemma[: -len(lemma_tail)]
        if front_kind == "verb":
            reading = _stem_reading(front)
            # the halves read as the whole does: 見出す is みいだす, no 見 + 出す
            if reading is None or reading + reading_tail != t.lemma_reading.translate(_SAID):
                continue
        else:
            reading = None
            if not _noun_front(front):
                continue
        for head in (front, reading):
            if head and t.surface.startswith(head):
                return len(head)
        for tail in (lemma_tail, reading_tail):
            if t.surface.endswith(tail):
                return len(t.surface) - len(tail)
        for first in (lemma_tail[:1], reading_tail[:1]):
            if first and first in t.surface[1:]:
                return t.surface.rindex(first)        # 閉め出し, 探しだし
        return 0
    return None


def _compound_rule(pattern: str):
    spec = _COMPOUNDS[pattern]
    tails, kinds, front, then, _excepted = spec
    verbs = {lemma for lemma, _r in tails if "verb" in kinds and lemma.endswith(("む", "う", "す", "る"))}
    nouns = {lemma for lemma, _r in tails if front == "noun"}

    def spans(tokens):
        out = []
        for i, t in enumerate(tokens):
            at = _compound_offset(t, spec)
            if at is not None:
                # a verb's second half where it begins; a noun is one word,
                # and the key is on the whole of it (生きがい, 泥まみれ)
                start = t.start + at if t.pos == "verb" else t.start
            elif (t.pos == "verb" and t.lemma in verbs and i >= 1
                  and (tokens[i - 1].pos == "verb" and tokens[i - 1].cform.startswith("連用形")
                       or _misread_stem(tokens[i - 1]))
                  and not (t.surface == "だし" and (i + 1 == len(tokens) or tokens[i + 1].pos == "symbol"))):
                # 降り + 出し, 開け + かけ -- not 休み + だし closing its clause,
                # which is the noun, the copula and し (今日は休みだし、)
                start = t.start
            elif (t.pos == "noun" and t.lemma in nouns and i >= 1 and tokens[i - 1].pos in _NOMINAL
                  and t.lemma not in _excepted):
                start = t.start                    # 朝食 + ぬき
            else:
                continue
            end = t.end
            if then:
                nxt = tokens[i + 1] if i + 1 < len(tokens) else None
                if nxt is None or nxt.surface != then or nxt.pos != "particle":
                    continue
                end = nxt.end
            out.append((start, end))
        return out
    return spans


def _that_is_all_spans(tokens):
    """〜ばそれまでだ with the comma a writer puts after its ば: 落ちれば、
    それまでだ -- ば, then それ + まで and the copula."""
    out = []
    for i in range(len(tokens) - 3):
        ba = tokens[i]
        if ba.surface != "ば" or ba.pos != "particle":
            continue
        k = i + 2 if tokens[i + 1].surface in _COMMAS else i + 1
        if k + 2 < len(tokens) and tokens[k].surface == "それ" and tokens[k + 1].surface == "まで" \
                and _is_copula(tokens[k + 2]):
            da = tokens[k + 2]
            out.append(((ba.start, ba.end), (tokens[k].start, da.end)) if k == i + 2 else (ba.start, da.end))
    return out


def _volitional_at(tokens, i: int):
    """(where the volitional's ending begins, the index of its last token)
    for a volitional whose verb is tokens[i], or None. The tokenizer reads
    one two ways: as a verb in the 意志推量形 (乗ろう, かけよう -- the ending
    its last two letters), or as a stem and the noun よう (信じ + 様,
    参加し + 様), which is how the lessons of 〜ようが〜まいが have it."""
    t = tokens[i]
    if t.pos in ("verb", "auxiliary") and t.cform.startswith("意志推量形"):
        return (t.end - 2 if len(t.surface) >= 2 and t.surface.endswith("う") else t.start), i
    if (t.pos in ("verb", "auxiliary") and t.cform.startswith(("連用形", "未然形")) and i + 1 < len(tokens)
            and tokens[i + 1].surface == "よう" and tokens[i + 1].lemma == "様"):
        return tokens[i + 1].start, i + 1
    return None


def _choice_ka_spans(tokens):
    """〜か〜か with its second か dropped, as its lesson says it drops
    between nouns: 電車かバスで行きます. か joins a noun to the next noun;
    not after a question word (何か, "something"), not the か of とか."""
    out = []
    for i in range(1, len(tokens) - 1):
        t, prev, nxt = tokens[i], tokens[i - 1], tokens[i + 1]
        if (t.pos == "particle" and t.surface == "か" and not t.conjunctive
                and prev.pos in _NOMINAL and nxt.pos in ("noun", "pronoun") and not _is_question_word(nxt)
                and not _indefinite_ka(tokens, t.start) and prev.surface != "と"):
            out.append((t.start, t.end))
    return out


def _humble_spans(tokens):
    """お〜する: お + a verb's stem, or ご + a する-noun, then する in any
    form -- 私がお持ちします, ごれんらくします -- which the letters never
    met, since the lesson writes する and the polite sentence says し."""
    out = []
    for i in range(len(tokens) - 2):
        o, stem, suru = tokens[i], tokens[i + 1], tokens[i + 2]
        if o.pos != "prefix" or o.lemma != "御" or suru.lemma != "為る":
            continue
        if ((stem.pos == "verb" and stem.cform.startswith("連用形")) or (o.surface == "ご" and stem.pos == "noun")
                # お運びします: a verb's stem the tagger files as a noun,
                # ending in the stem's kana (plan 193)
                or (o.surface == "お" and stem.pos == "noun" and stem.surface[-1:] in _STEM_ENDINGS)):
            out.append(((o.start, o.end), (suru.start, suru.end)))
    return out


def _honorific_nare_spans(tokens):
    """お〜になる said twice over, お休みになられる (plan 272): the れる of
    なられる is the honorific's too, never a passive -- お, the stem, に,
    なら and れ."""
    out = []
    for i in range(len(tokens) - 4):
        o, stem, ni, nara, re = tokens[i:i + 5]
        if (o.pos == "prefix" and o.surface in ("お", "ご") and stem.pos in ("verb", "noun")
                and ni.surface == "に" and nara.surface == "なら" and nara.lemma == "成る"
                and re.pos == "auxiliary" and re.lemma_reading in _PASSIVE):
            out.append(((o.start, o.end), (ni.start, re.end)))
    return out


def _try_to_spans(tokens):
    """〜ようとする after a 五段 verb, whose volitional writes no よう:
    乗ろうとした, 帰ろうとする -- the volitional, と, then する."""
    out = []
    for i in range(len(tokens)):
        vol = _volitional_at(tokens, i)
        if vol is None or vol[1] + 2 >= len(tokens):
            continue
        to, suru = tokens[vol[1] + 1], tokens[vol[1] + 2]
        if to.surface == "と" and to.pos == "particle" and suru.lemma == "為る" and suru.pos == "verb":
            out.append((vol[0], suru.end))
    return out


def _mean_to_spans(tokens):
    """〜ようと思う after a 五段 verb, whose volitional writes no よう
    (plan 193): 帰ろうと思う, 習おうと思います -- the volitional, と, then
    思う in any form."""
    out = []
    for i in range(len(tokens)):
        vol = _volitional_at(tokens, i)
        if vol is None or vol[1] + 2 >= len(tokens):
            continue
        to, omou = tokens[vol[1] + 1], tokens[vol[1] + 2]
        if to.surface == "と" and to.pos == "particle" and omou.lemma == "思う" and omou.pos == "verb":
            out.append((vol[0], omou.end))
    return out


def _throughout_spans(tokens):
    """〜中 read じゅう where the tokenizer has made one word of its
    numeral's counter and 中 (plan 193): 一|日中, 一|年中, 一|晩中 --
    the 中 of 一日中, "all day long"."""
    return [(t.end - 1, t.end) for i, t in enumerate(tokens)
            if t.surface in ("日中", "年中", "晩中") and i > 0 and tokens[i - 1].surface == "一"]


def _humble_itasu_spans(tokens):
    """いたす after ご + a する-noun or お + a verb's stem, the humble form
    at its most polite (plan 193): ご案内いたします, お持ちいたします."""
    out = []
    for i in range(2, len(tokens)):
        t, stem, o = tokens[i], tokens[i - 1], tokens[i - 2]
        if (t.lemma == "致す" and t.pos == "verb" and o.pos == "prefix" and o.lemma == "御"
                and (stem.pos == "noun" or (stem.pos == "verb" and stem.cform.startswith("連用形")))):
            out.append((t.start, t.end))
    return out


def _n_before(tokens, k: int):
    """Where the classical negative ん of 〜んばかり begins, when it ends
    tokens[k], or None (plan 193): the tokenizer reads 言わん as 言わ +
    ん, but 割れん and 下げん as one verb in its 撥音便, and 泣き出さん as
    泣き + 出 + さん."""
    if k < 0:
        return None
    t = tokens[k]
    if t.surface == "ん" and t.pos == "auxiliary":
        return t.start
    if t.pos == "verb" and t.surface.endswith("ん") and "撥音" in t.cform:
        return t.end - 1
    if t.surface == "さん" and t.pos == "suffix" and k > 0 and tokens[k - 1].surface == "出":
        return t.end - 1
    return None


def _nbakari_spans(tokens):
    """〜んばかりに and its attributive 〜んばかりの: as if about to (plan
    193)."""
    out = []
    for k in range(1, len(tokens) - 1):
        b = tokens[k]
        if b.surface != "ばかり":
            continue
        n = _n_before(tokens, k - 1)
        nxt = tokens[k + 1]
        if n is not None and nxt.surface in ("に", "の"):
            out.append((n, nxt.end if nxt.surface == "に" else b.end))
    return out


def _ppoi_spans(tokens):
    """〜っぽい the tokenizer has made one adjective of (plan 193): 安っぽい,
    keyed on the whole word, as a compound noun is (やりがい); and the
    suffix it cuts off a noun or a stem, in any of its forms (plan 272):
    水っぽくて, 忘れっぽかった."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if (t.pos == "adjective" and len(t.lemma) > 3 and t.lemma.endswith("っぽい"))
            or (t.pos == "suffix" and t.lemma in ("ぽい", "っぽい") and t.surface.startswith("っぽ") and i > 0
                and tokens[i - 1].end == t.start)]


def _zukume_spans(tokens):
    """〜ずくめ after a word the tokenizer calls an adverb (plan 193):
    初めてずくめ, 結構ずくめ -- ずくめ is 尽くめ, no other word."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.lemma == "尽くめ" and i > 0 and tokens[i - 1].pos in ("adverb", "noun", "other")]


def _temae_spans(tokens):
    """〜手前 after ている (plan 193): 厳しく言っている手前, "having said so
    myself" -- the lesson shows た and の; ている is the same face to keep."""
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.lemma == "手前" and i >= 2 and tokens[i - 1].lemma == "居る" and tokens[i - 2].surface in ("て", "で")]


def _dokoro_spans(tokens):
    """〜どころではない where the tokenizer reads どころ as the noun 所
    (plan 193): 店を開けるどころではない, 寝るどころではない."""
    out = []
    for k in range(1, len(tokens) - 2):
        t = tokens[k]
        if t.surface != "どころ" or tokens[k - 1].pos not in ("verb", "noun"):
            continue
        j = k + 1
        if tokens[j].surface == "では" or tokens[j].surface == "じゃ":
            j += 1
        elif tokens[j].surface == "で" and j + 1 < len(tokens) and tokens[j + 1].surface == "は":
            j += 2
        else:
            continue
        if j < len(tokens) and tokens[j].lemma in ("無い", "ない"):
            out.append((t.start, tokens[j].end))
    return out


def _negative_after(tokens, k: int):
    """The index of the first negative after tokens[k] in its sentence --
    ない, なかっ, or ません's ん -- or None."""
    for j in range(k + 1, len(tokens)):
        u = tokens[j]
        if u.pos == "symbol" and u.surface in _UTTERANCE_ENDS:
            return None
        if u.lemma in ("ない", "無い") or (u.lemma == "ず" and j >= 1 and tokens[j - 1].lemma == "ます"):
            return j
    return None


def _no_way_spans(tokens):
    """〜ようがない where the tokenizer reads the stem and よう as
    something else: as a volitional (かけようがない -- かけ + よう, a stem
    and the noun "way", spelled like the volitional of かける) or as the
    noun 仕様 (しようがない, which its lesson names)."""
    out = []
    for i in range(len(tokens) - 2):
        t = tokens[i]
        vol = _volitional_at(tokens, i)
        if vol is not None and t.surface.endswith("よう") or vol is not None and vol[1] > i:
            start, i = vol                       # かけよう, 直し + よう
        elif t.lemma == "仕様" and t.surface == "しよう":
            start = t.start                       # one word to the tokenizer, and the key on all of it
        else:
            continue
        ga = tokens[i + 1] if i + 1 < len(tokens) else None
        if ga is None or ga.surface != "が" or ga.pos != "particle" or i + 2 >= len(tokens):
            continue
        neg = i + 2
        if tokens[neg].lemma in ("ない", "無い"):
            out.append((start, tokens[neg].end))
        elif (tokens[neg].lemma in ("有る", "ある") and neg + 2 < len(tokens) and tokens[neg + 1].lemma == "ます"
              and tokens[neg + 2].lemma == "ず"):
            out.append((start, tokens[neg + 2].end))        # ありません
    return out


def _unable_spans(tokens):
    """〜ようにも〜ない: a volitional, にも, and the negative that follows
    in its sentence -- 帰ろうにも帰れない, 出かけようにも出かけられない,
    電話をかけようにも番号がわからない. The tokenizer reads the volitional
    as one word, so the letters よう were never a word of their own."""
    out = []
    for i in range(len(tokens)):
        vol = _volitional_at(tokens, i)
        if vol is None or vol[1] + 2 >= len(tokens):
            continue
        ni, mo = tokens[vol[1] + 1], tokens[vol[1] + 2]
        if not (ni.surface == "に" and mo.surface == "も" and mo.pos == "particle"):
            continue
        k = _negative_after(tokens, vol[1] + 2)
        if k is not None:
            neg = tokens[k - 1] if tokens[k].lemma == "ず" else tokens[k]
            out.append(((vol[0], mo.end), (neg.start, tokens[k].end)))
    return out


def _either_way_spans(tokens):
    """〜ようが〜まいが (and its lesson's ようと〜まいと): a volitional and
    が, then a verb, まい and the same particle -- 降ろうが降るまいが,
    来ようが来るまいが, 信じようが信じまいが."""
    out = []
    for i in range(len(tokens)):
        vol = _volitional_at(tokens, i)
        if vol is None or vol[1] + 1 >= len(tokens):
            continue
        p = tokens[vol[1] + 1]
        if not (p.pos == "particle" and p.surface in ("が", "と")):
            continue
        for j in range(vol[1] + 2, len(tokens) - 1):
            u = tokens[j]
            if u.pos == "symbol":
                break
            if tokens[j + 1].surface != p.surface:
                continue
            if u.lemma == "まい" and u.pos == "auxiliary":
                out.append(((vol[0], p.end), (u.start, tokens[j + 1].end)))
                break
            if u.lemma == "仕舞い" and u.surface == "しまい":
                out.append(((vol[0], p.end), (u.start, tokens[j + 1].end)))       # しようがしまいが
                break
    return out


def _aimatte_spans(tokens):
    """〜と相まって where the tokenizer cuts 相まって into 相 + 待って, and
    with both things named before it: 景色と音楽が相まって (A と B が
    相まって), the と then the verb."""
    out = []
    for i in range(1, len(tokens) - 1):
        a, v = tokens[i], tokens[i + 1]
        if not ((a.surface == "相" and v.lemma == "待つ" and v.surface == "まっ") or v.lemma in ("相俟つ", "相まつ")):
            continue
        if v.lemma in ("相俟つ", "相まつ"):
            a = v
        te = tokens[tokens.index(v) + 1] if tokens.index(v) + 1 < len(tokens) else None
        if te is None or te.surface != "て":
            continue
        for j in range(tokens.index(a) - 1, -1, -1):
            u = tokens[j]
            if u.pos == "symbol":
                break
            if u.surface == "と" and u.pos == "particle":
                pieces = ((u.start, te.end),) if u.end == a.start else ((u.start, u.end), (a.start, te.end))
                out.append(pieces)
                break
    return out


def _if_only_spans(tokens):
    """〜ものを, "if only…": もの and を closing their clause on a past or
    a いい, with a ば before them in the sentence -- 言ってくれれば
    よかったものを, 早く寝ればいいものを、 -- as every one of its lessons
    has it. もの + を taking a verb is the thing and its object
    (食べるものを買った), never this."""
    out = []
    for i in range(1, len(tokens) - 1):
        mono, wo = tokens[i], tokens[i + 1]
        if mono.lemma not in ("物", "もの") or wo.surface != "を" or wo.pos != "particle":
            continue
        after = tokens[i + 2] if i + 2 < len(tokens) else None
        if after is not None and not (after.pos == "symbol" and (after.surface in _UTTERANCE_ENDS
                                                                 or after.surface in _COMMAS or after.surface in "…‥")):
            continue
        prev = tokens[i - 1]
        if not (prev.lemma == "た" or prev.lemma in ("良い", "いい", "よい")):
            continue
        if any(u.pos == "particle" and u.surface == "ば" for u in _sentence_tokens_before(tokens, mono.start)):
            out.append((mono.start, wo.end))
    return out


def _short_causative_spans(tokens):
    """The causative's せ where the tokenizer reads a 五段 verb + せる as a
    verb of its own in the imperative (遊ばせました is 遊ばす's 命令形 to
    it): an imperative never takes ます or た, so it is the causative stem."""
    out = []
    for i, t in enumerate(tokens[:-1]):
        nxt = tokens[i + 1]
        if (t.pos == "verb" and t.cform.startswith("命令形") and t.surface.endswith("せ")
                and t.ctype.startswith("五段-サ行") and len(t.lemma) >= 2 and t.lemma[-2] in _A_ROW
                and nxt.pos == "auxiliary" and nxt.lemma in ("ます", "た", "ない")):
            out.append((t.end - 1, t.end))
    return out


_A_ROW = frozenset("あかがさざただなはばぱまやらわ")


def _tage_spans(tokens):
    """〜げ after たい, which the tokenizer reads as the auxiliary たげる:
    言いたげな顔, 言いたげに -- たげる takes て or ます, never な or に."""
    out = []
    for i, t in enumerate(tokens):
        if t.surface != "たげ" or t.lemma != "たげる" or i == 0 or tokens[i - 1].pos != "verb":
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        # (言いたげに, the に UniDic reads as a particle after たげる, plan 272)
        if nxt is None or nxt.pos == "symbol" or (nxt.surface in ("な", "に", "だ")
                                                  and (_is_copula(nxt) or nxt.pos == "particle")):
            out.append((t.end - 1, t.end))
    return out


# The form points that span a whole word (_detect's containment rule).
_WORD_FORMS = frozenset({"意向形 〜(よ)う", "可能形 〜(ら)れる", "命令形 〜ろ／〜え"})

# The points an idiom of their shape is an instance of, which keep it
# (plan 272): 味がする, 音がする are 〜がする, where 気になる is no
# 〜になる, "to become".
_OWNS_ITS_IDIOMS = frozenset({"〜がする"})


# Points a rule reads only IN PART (plan 149): い形容詞／な形容詞 is lit
# where its lesson's forms are written (しずかな, 高くない, 高かった) and
# not on every adjective in its dictionary form, which is a word rather
# than something to point at. A breakdown gains the key; 作文 must not
# hear "not found" from it (can_find), since この犬は大きいです uses the
# point and shows none of those forms.
_PARTIAL = frozenset({"い形容詞／な形容詞",
                      # (plan 272: the reason て where what follows is an
                      # apology, thanks or すぎる; 〜上で after a verb or
                      # ご〜の, never 仕事の上では, which only its noun tells
                      # from 机の上では)
                      "〜て（理由）", "〜上で"})

# Points read by their rule alone, never by letters: a pattern that is a
# bare ending (た, ない) matches every た and every ない there is, and
# the letters' conjugations reach ません, which the ない-form's own
# lesson names as a different point.
_RULE_ONLY = frozenset({"た形 〜た", "ない形 〜ない", "〜て／〜ないで（依頼）", "〜も（強調）", "〜か（間接疑問）",
                        # (a て gives a reason only where what follows says so, plan 272)
                        "〜て（理由）",
                        # (何でもない's letters are 何でも's: the rule is what tells them apart)
                        "何でも／誰でも／いつでも／どこでも",
                        # a compound's second half is a full verb of its own as letters:
                        # 電車がこむ is 混む, 友だちにあう 会う, 時計を直す (plan 188)
                        "〜こむ", "〜あう", "〜直す", "〜通す", "〜出す", "〜かける"})


# ── What the lessons never wrote (plan 266) ──────────────────────
# Measured over every sentence the app teaches, these were the parts a
# breakdown left saying nothing: a lesson's four sentences show a point
# in the shapes they happen to use, and the shapes they did not use
# went unexplained. Each rule reads words, never letters, and each is
# confirmed by its point's own lessons like the rest (_confirmed), save
# the two whose form no lesson writes and whose docstring says why.

# The verbs a quotation's と hands what was said or thought to: what a
# quoted volitional or conjecture is handed to (_THOUGHT), less the verbs
# of doing a と goes before as "with" or "as" (する, 努力), and the verbs
# of feeling, deciding and saying it left out.
_QUOTING = (_THOUGHT - {"する", "為る", "努力"}) | frozenset({
    "感じる", "感ずる", "決める", "申す", "おっしゃる", "存じる", "存ずる", "述べる", "疑う",
    "思える", "言える", "呼ぶ", "記す", "つぶやく", "呟く", "返事", "思い込む", "見なす",
    "言い張る", "書き込む", "考え直す",
})


def _quotative_to_spans(tokens):
    """と where it hands what is said or thought to the verb that says or
    thinks it (と's lesson: 「quotation」 + と + 言う・思う): after a plain
    predicate -- 行きたくないと言う, 面白いと感じた, 評判がいいと聞いていた --
    or a closing quote, and straight before a verb of saying, thinking or
    feeling. Its lessons quote in brackets, so a quotation without them
    was no と at all. After a noun, と is "with" (友だちと話した) and its
    other rules' to read; before a comma it is the conditional
    (話を聞くと、…), 〜と's."""
    out = []
    for i, t in enumerate(tokens[1:-1], start=1):
        if not (t.pos == "particle" and t.surface == "と" and not t.conjunctive):
            continue
        prev, nxt = tokens[i - 1], tokens[i + 1]
        said = (prev.pos in ("verb", "adjective", "auxiliary")
                or (prev.pos == "particle" and prev.surface in _FINAL_PARTICLES | {"か"})
                or (prev.pos == "symbol" and prev.surface in _CLOSERS))
        if not said:
            continue
        verb = nxt if nxt.pos == "verb" else None
        if verb is None and nxt.pos == "noun" and i + 2 < len(tokens) and tokens[i + 2].lemma in ("為る", "する"):
            verb = nxt                                  # と説明する, と返事する
        if verb is not None and verb.lemma in _QUOTING:
            out.append((t.start, t.end))
    return out


def _polite_spans(tokens):
    """〜ます／〜ません where its lessons never put it: the negative ませ +
    ん before が, か or ね (申し訳ありませんが left its ませ and ん saying
    nothing), the polite て-form まして (風邪をひいてしまいまして), and
    ます after a verb the tokenizer files as a suffix (払い戻しかねます).
    Its lessons end their sentences on ます and ません after a verb, and
    every other place was refused for what came after or before."""
    out = []
    for i, t in enumerate(tokens):
        if not (t.pos == "auxiliary" and t.lemma == "ます"):
            continue
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if t.surface == "ませ" and nxt is not None and nxt.pos == "auxiliary" and nxt.surface == "ん":
            out.append((t.start, nxt.end))
        elif t.surface == "まし" and nxt is not None and nxt.conjunctive and nxt.surface == "て":
            out.append((t.start, t.end))
        elif t.surface == "まし" and nxt is not None and nxt.lemma == "た" and nxt.cform.startswith("仮定形"):
            out.append((t.start, t.end))   # 確認しましたら: たら is 〜たら's (plan 272)
        elif t.surface == "ます" and i > 0 and tokens[i - 1].pos == "suffix" and tokens[i - 1].ctype:
            out.append((t.start, t.end))
        elif t.surface.replace("ー", "").replace("〜", "") in ("ます", "ました") and t.surface not in ("ます", "ました"):
            out.append((t.start, t.end))   # 休憩挟みまーす: ます drawn out (plan 272)
    return out


@lru_cache(maxsize=1)
def _polite_compounds() -> dict[tuple[str, str], str]:
    """(particle, verb lemma) -> the compound particle written with them in
    the て-form: ("に", "就く") -> 〜について. Read off each pattern as the
    tokenizer cuts it, like compound_particles."""
    out = {}
    for pattern in compound_particles():
        for alt in alternatives(pattern):
            for piece in (p.strip(_TRIM) for p in alt.split("〜")):
                tokens = morphology.tokenize("本" + piece) if piece else None
                if not tokens or len(tokens) != 4:
                    # (Ending on its て: としても and にしては are their
                    # own points, and として is what としまして says.)
                    continue
                head, verb, te = tokens[1], tokens[2], tokens[3]
                if verb.pos == "verb" and te.conjunctive and te.surface in ("て", "で"):
                    out.setdefault((head.surface, verb.lemma), pattern)
    return out


def _polite_compound_spans(tokens, sentence: str = ""):
    """(pattern, start, end) for a compound particle said politely (plan
    266): につきまして, に関しまして, に対しまして, によりまして -- the
    particle, its verb's stem, まし and て, where the lesson writes について.
    A letter and an announcement say it so, and its つき took 着く, "to
    arrive", while まして said nothing.

    Held to what the plain form would be: the sentence is read again with
    the lesson's own spelling in place of the polite one (につきまして as
    について), and the hit stands only where the point is found there. So
    every refusal the plain form has holds for the polite one: 興味を持ちまして
    is 持つ, "to have", as 興味を持って is, and no 〜をもって."""
    table = _polite_compounds()
    out = []
    for i in range(len(tokens) - 3):
        p, verb, mashi, te = tokens[i:i + 4]
        pattern = table.get((p.surface, verb.lemma)) if p.pos == "particle" else None
        if not (pattern and verb.cform.startswith("連用形") and mashi.lemma == "ます" and mashi.surface == "まし"
                and te.conjunctive and te.surface == "て"):
            continue
        if sentence and not _plain_form_found(sentence, pattern, verb, te):
            continue
        out.append((pattern, p.start, te.end))
    return out


def _plain_form_found(sentence: str, pattern: str, verb, te) -> bool:
    """Whether `pattern` is found where the polite `verb` + まし + `te`
    stood once the sentence is written in the plain て-form, the verb in
    the page's own spelling (_polite_compound_spans): 持ちまして is read
    as 持って, which 持つ "to have" writes -- the pattern's own もって
    would take every 持つ for the compound."""
    for alt in alternatives(pattern):
        piece = next((p.strip(_TRIM) for p in alt.split("〜") if p.strip(_TRIM)), "")
        cut = morphology.tokenize("本" + piece) if piece else None
        if not cut or len(cut) != 4:
            continue
        plain_stem = cut[2].surface                     # もっ, つい, 関し
        head = verb.surface
        while head and "\u3041" <= head[-1] <= "\u3096":
            head = head[:-1]
        okuri = verb.surface[len(head):]
        head_reading = verb.reading[:len(verb.reading) - len(okuri)] if okuri else verb.reading
        if head and plain_stem.startswith(head_reading):
            plain_stem = head + plain_stem[len(head_reading):]
        plain = sentence[:verb.start] + plain_stem + "て" + sentence[te.end:]
        offset = verb.start - 1                         # the particle before the verb
        return any(h[0] == pattern and h[2] <= offset < h[3] for h in _detect(plain, None))
    return False


def _topic_after_compound_spans(tokens):
    """は after a compound particle's て, plain or polite (plan 266):
    については, につきましては, にとっては -- the topic said of what the
    compound names. The particle's lessons put it after nouns, and after
    a て it was refused for what 〜てはいけません makes of a て and a は;
    a compound particle's て is no verb's."""
    table = _polite_compounds()
    out = []
    for i, t in enumerate(tokens):
        if not (t.pos == "particle" and t.surface == "は" and i >= 3):
            continue
        k = i - 1
        if not (tokens[k].conjunctive and tokens[k].surface == "て"):
            continue
        k -= 1
        if tokens[k].lemma == "ます" and tokens[k].surface == "まし":
            k -= 1
        if k >= 1 and tokens[k].pos == "verb" and (tokens[k - 1].surface, tokens[k].lemma) in table:
            out.append((t.start, t.end))
    return out


# Rules that stand BESIDE a point's other rules rather than replacing
# them (_CLASS_RULES points skip the stem and te rules).
_EXTRA_RULES = (
    ("〜たり〜たり", _single_tari_spans),
    ("〜かどうか", _kadouka_spans),
    ("〜に対して", _taishite_spans),
    ("〜なくてはいけない", _must_spans),
    ("助数詞 〜つ／〜人／〜枚", _counter_spans),
    ("〜そうだ（伝聞）", _hearsay_spans),
    # plan 188
    *((pattern, _compound_rule(pattern)) for pattern in _COMPOUNDS),
    ("〜か〜か", _choice_ka_spans),
    ("お〜になる／お〜する", _humble_spans),
    ("お〜になる／お〜する", _honorific_nare_spans),
    ("〜ようとする", _try_to_spans),
    ("〜ようがない", _no_way_spans),
    ("〜ようにも〜ない", _unable_spans),
    ("〜ようが〜まいが", _either_way_spans),
    ("〜と相まって", _aimatte_spans),
    ("〜ものを", _if_only_spans),
    ("〜ばそれまでだ", _that_is_all_spans),
    ("使役形 〜させる", _short_causative_spans),
    # plan 193
    ("使役受身形 〜させられる", _short_causative_passive_spans),
    ("〜ようと思う", _mean_to_spans),
    ("〜中", _throughout_spans),
    ("まいる／もうす／いたす", _humble_itasu_spans),
    ("〜んばかりに", _nbakari_spans),
    ("〜っぽい", _ppoi_spans),
    ("〜ずくめ", _zukume_spans),
    ("〜手前", _temae_spans),
    ("〜どころではない", _dokoro_spans),
    ("〜げ", _tage_spans),
    # plan 266
    ("と", _quotative_to_spans),
    ("〜ます／〜ません", _polite_spans),
    ("は", _topic_after_compound_spans),
    # plan 272
    ("の", _one_no_spans),
    ("は", _adverb_wa_spans),
    ("〜くて／〜で", _na_adjective_te_spans),
    ("〜て（理由）", _reason_te_spans),
    ("〜さ", _na_adjective_sa_spans),
    ("〜上で", _after_doing_spans),
    ("〜といい／〜たらいい／〜ばいい", _should_spans),
    ("〜ように", _so_that_spans),
    ("〜ように言う", _ask_to_spans),
    ("〜あまり", _so_much_spans),
    ("〜ています", _te_wa_iru_spans),
    ("〜たらどうですか", _suggest_spans),
    ("お〜ください", _take_care_spans),
    ("〜という", _sound_toiu_spans),
    ("〜ぶりに", _after_so_long_spans),
    ("〜が（逆接）", _but_spans),
    ("〜だけ", _only_after_verb_spans),
    ("〜ていく／〜てくる", _humble_go_come_spans),
    ("と", _quote_to_spans),
    ("〜に関して", _kanshite_forms_spans),
    ("〜に対して", _taishite_forms_spans),
    ("〜によると", _niyoruto_forms_spans),
    ("〜によって", _niyotte_forms_spans),
)


# Rules for a form the point's own lessons never show, so that no lesson
# can confirm them (_confirmed), each written on a word nothing else is
# spelled with (plan 193): いたす after ご + a noun or お + a stem, a
# っぽい adjective the tokenizer made one word, 手前 after ている.
_SELF_EVIDENT = frozenset({_humble_itasu_spans, _ppoi_spans, _temae_spans,
                           # (plan 272: the lessons show one form of each;
                           # the word before is the evidence)
                           _but_spans, _only_after_verb_spans, _humble_go_come_spans, _one_no_spans,
                           _adverb_wa_spans, _kanshite_forms_spans, _taishite_forms_spans,
                           _niyoruto_forms_spans, _niyotte_forms_spans, _quote_to_spans,
                           # (plan 266: は's lessons put it after nouns, and
                           # the compound particle before it is its evidence)
                           _topic_after_compound_spans,
                           # (plan 272: 〜くて／〜で's lessons are all い-
                           # adjectives; its structure line names the な one)
                           _na_adjective_te_spans,
                           # (plan 272: the lessons show the い one; and the
                           # point said its other way, which no lesson shows)
                           _na_adjective_sa_spans, _after_doing_spans, _so_that_spans, _so_much_spans,
                           _should_spans, _honorific_nare_spans,
                           _te_wa_iru_spans, _suggest_spans, _after_so_long_spans, _take_care_spans,
                           _sound_toiu_spans})


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
        if tokens and any(h[0] == pattern for h in _form_hits(tokens, confirm=False)):
            return True
    return False


def _pieces(span) -> tuple[tuple[int, int], ...]:
    """A rule's span as the pieces it is written on: (start, end) for a
    point in one piece, or the pieces themselves for one in several
    (〜ようにも〜ない's ようにも and ない, plan 188)."""
    return tuple(span) if isinstance(span[0], tuple) else (tuple(span),)


def _form_hits(tokens, confirm: bool = True, sentence: str = "") -> list[tuple[str, str, int, int, tuple[tuple[int, int], ...]]]:
    """(pattern, level, start, end, pieces) for every point the second
    pass finds, each held to its own lessons unless `confirm` is off
    (which is how the lessons themselves are read)."""
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
            read = _te_spans if shape == "te" else partial(_stem_spans, pattern=pattern)
            spans = read(tokens, core)
            ok = None
            if spans:
                ok = not confirm or _confirmed(level, pattern)
                if ok:
                    out.extend((pattern, level, s, e, ((s, e),)) for s, e in spans)
                    if core[-1][2] in _MEANING_FORMS:
                        in_form.update(spans)
            if core[-1][2] == "":
                extra = set(read(tokens, core, relaxed=True)) - set(spans)
                if extra and (ok if ok is not None else (not confirm or _confirmed(level, pattern))):
                    relaxed_hits.extend((pattern, level, s, e, ((s, e),)) for s, e in extra)
    out.extend(h for h in relaxed_hits if (h[2], h[3]) not in in_form)
    for pattern, rule in (*_CLASS_RULES.items(), *_EXTRA_RULES):
        spans = rule(tokens)
        if not spans:
            continue
        found = find(pattern)
        if found is None:
            continue
        level = found[0]
        if not confirm or rule in _SELF_EVIDENT or _confirmed(level, pattern):
            for span in spans:
                pieces = _pieces(span)
                out.append((pattern, level, pieces[0][0], pieces[-1][1], pieces))
    for pattern, s, e in _spoken_final_spans(tokens):
        # (No lesson spells ねー or じゃん, so none confirms them: the rule
        # reads the particle's own letters and nothing else, as
        # _SELF_EVIDENT's do.)
        found = find(pattern)
        if found is not None:
            out.append((pattern, found[0], s, e, ((s, e),)))
    for pattern, s, e in (*_contraction_spans(tokens), *_humble_progressive_spans(tokens)):
        found = find(pattern)
        if found is not None and (not confirm or _confirmed(found[0], pattern)):
            out.append((pattern, found[0], s, e, ((s, e),)))
    for pattern, s, e in _polite_compound_spans(tokens, sentence):
        # (No lesson writes the polite form, so none confirms it: the
        # rule reads the compound's own particle and verb and nothing
        # else, as _SELF_EVIDENT's do.)
        found = find(pattern)
        if found is not None:
            out.append((pattern, found[0], s, e, ((s, e),)))
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
def _compound_particle_verbs() -> frozenset[str]:
    """The verbs compound_particles' points are built on: 言う of
    といい, 比べる of に比べ, 対する of に対し."""
    out = set()
    for pattern in compound_particles():
        for alt in alternatives(pattern):
            for piece in (p.strip(_TRIM) for p in alt.split("〜")):
                out.update(t.lemma for t in morphology.tokenize("本" + piece) or [] if t.pos == "verb")
    return frozenset(out)


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
NO_GOOD_VERBS = frozenset({"行く", "行ける", "成る",
                           # (plan 272: 〜てたまらない's たまら is no 溜まる, "to collect")
                           "溜まる", "堪る"})
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
        for pattern, level, start, end, pieces in _form_hits(tokens, sentence=sentence):
            # A word-point's span may take in the ending it carries (the
            # copula's だった, ではない) and is still the word it starts on.
            token = spans.get((start, end)) or ((firsts.get(start)) if "〜" not in pattern else None)
            found.append((pattern, level, start, end, _kind(pattern, token), len(pieces) == 1, pieces))

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
    # And a form point (the volitional, the potential, the imperative) is
    # the form of the whole word it spans, not a construction: the
    # 〜こむ of 乗りこもう is the word's own second half (plan 188).
    words = [(s, e) for p, _l, s, e, _k, whole, _segs in deduped if whole and "〜" not in p]
    words += [(s, e) for p, _l, s, e, k, whole, _segs in deduped
              if whole and k != "marker" and _all_particles(tokens, s, e)]
    # And inside a word the deck teaches whole that the tokenizer writes
    # as a word and its particles (plan 272): the も of いつも is no
    # "also", the は of 実は no topic (card_lookup.resolve_whole_word).
    # A construction written on those letters alone is no more there: the
    # まで of いつまでも is no から〜まで. The adverbial form is: 非常に is
    # 非常 + に, the card's word and the lesson's (plan 272).
    # So with an idiom read whole (気になる): its particle and its verb
    # are the idiom's, and only the verb's own form stays a point (本題に
    # 入ろう's volitional). Not where a point is the idiom's very shape:
    # 味がする is 〜がする's own example (plan 272).
    if tokens:
        from study.card_lookup import idiom_spans, whole_word_spans
        wholes = whole_word_spans(tokens)
        idioms = [span for span in idiom_spans(tokens) if not any(
            h[0] in _OWNS_ITS_IDIOMS and any(span[1] <= a and b <= span[2] for a, b in h[6]) for h in deduped)]
        words += [(s, e) for s, _tail, e in wholes + idioms]
        deduped = [h for h in deduped if h[0] == _ADVERBIAL or not any(
            tail <= a and b <= e for a, b in h[6]
            for _s, tail, e in wholes + ([] if h[0] in _WORD_FORMS else idioms))]
    deduped = [h for h in deduped if not (h[0] == "か" and _indefinite_ka(tokens, h[2]))]
    return [
        _with_attributive_na(tokens, (pattern, level, start, end, kind, segments))
        for pattern, level, start, end, kind, _c, segments in deduped
        if (kind == "marker" and not any((s, e) != (start, end) and s <= start and end <= e for s, e in words))
        or (kind != "marker" and not any(
            whole and (s, e) != (start, end) and s <= start and end <= e and _p not in _WORD_FORMS
            # (燃やしてしまえ: the order is the form of しまう, read inside
            # 〜てしまう as the volitional is inside 〜ておこう, plan 272)
            and not (pattern == "命令形 〜ろ／〜え" and _p.startswith("〜て"))
            for _p, _l, s, e, _k, whole, _segs in deduped
        ))
    ]


@lru_cache(maxsize=None)
def _opens_on_no(pattern: str) -> bool:
    """Whether a pattern is written from の or ん after the clause it
    takes: 〜ので, 〜のに, 〜のは〜だ, 〜の."""
    return "〜" in pattern and any(alt.lstrip("〜").startswith(("の", "ん")) for alt in alternatives(pattern))


# The particles a noun phrase ends in, which the copula's な follows as
# it follows a noun: 買ったばかりなのに, 少しだけなので (plan 272).
_NOMINAL_PARTICLES = frozenset({"ばかり", "だけ", "ほど", "くらい", "ぐらい", "のみ", "きり", "っきり"})


def _with_attributive_na(tokens, hit):
    """A point opening on の, its start moved back over the な a noun or a
    な-adjective takes before it (plan 266): 休みなので, 春なのに, 大切なのは
    -- "noun / な-adjective + な + ので". The な was a row that said nothing,
    in the very lessons of 〜ので, 〜のに and 〜のは〜だ; 〜んです／〜のです
    has read it so since plan 149."""
    pattern, level, start, end, kind, segments = hit
    if not _opens_on_no(pattern):
        return hit
    i, t = _tok_at(tokens, start)
    if t is None or i < 2 or t.surface not in ("の", "ん"):
        return hit
    na = tokens[i - 1]
    if not (_is_copula(na) and na.surface == "な" and _form_head(na.cform) == "連体形"
            and (tokens[i - 2].pos in _NOMINAL or tokens[i - 2].surface in _NOMINAL_PARTICLES
                 # (an adverb the copula follows is a noun there: はじめてなので)
                 or tokens[i - 2].pos == "adverb")):
        return hit
    first = (na.start, segments[0][1]) if segments else (na.start, end)
    return pattern, level, na.start, end, kind, (first, *segments[1:])
