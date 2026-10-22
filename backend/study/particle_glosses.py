"""
What a word of speech says where the course has no lesson and no card
for it (plan 272).

The breakdown explains a function word by its point (study/grammar_detect)
or, where the deck has one, by its kana card
(card_lookup.resolve_function_word). Spoken Japanese -- a subtitle, a
song, a chat -- is made of words that have neither: ぞ, ぜ, わ, さ, かしら,
the もん that gives a reason, the って that quotes or names, ってば, the
negative ん, ぬ and ず, the Kansai へん. Their rows said nothing, and a
negative that says nothing is the sentence read backwards: 許さぬ without
its ぬ is "I forgive".

Each is glossed here by what it does where it stands, in both languages.
Where the sentence does not say which of two uses it is, the gloss names
both -- never a guess between them. A token a point is written on is the
point's, and is never glossed here (study/analysis._tokens asks only for
a token with no card and no point).
"""
from __future__ import annotations

# Marks a word is drawn out with: ねー, よぉ, なぁ.
_DRAWN = "ーぇェ〜～"

# The closing marks of an utterance, and the marks inside one.
_MARKS = frozenset("。！？!?…‥」』）)、，,　 ")


def _base(surface: str) -> str:
    """The word without the letters that draw it out: ねー ね, なあ な,
    よぉ よ, ぞー ぞ."""
    base = surface.rstrip(_DRAWN)
    if len(base) == 2 and base[1] in "あえお" and base[0] in "なねよ":
        base = base[0]
    return base or surface


def _rest(morphemes, i: int):
    return morphemes[i + 1:]


def _closes(morphemes, i: int) -> bool:
    """Whether nothing but particles and marks follows morphemes[i]."""
    return all(m.pos in ("particle", "symbol") for m in _rest(morphemes, i))


def closes_sentence(morphemes, i: int) -> bool:
    """Whether nothing but particles follows morphemes[i] in its
    sentence: 好きだったの。でも… closes the first one."""
    for m in _rest(morphemes, i):
        if m.pos == "symbol" and m.surface in "。！？!?」』…‥":
            return True
        if m.pos not in ("particle", "symbol"):
            return False
    return True


def _opens(morphemes, i: int) -> bool:
    """Whether morphemes[i] opens its utterance."""
    return i == 0 or (morphemes[i - 1].pos == "symbol" and morphemes[i - 1].surface in _MARKS)


def _after_a_predicate(morphemes, i: int) -> bool:
    return i > 0 and morphemes[i - 1].pos in ("verb", "adjective", "auxiliary")


def _followed_by_a_word(morphemes, i: int) -> bool:
    for m in _rest(morphemes, i):
        if m.pos == "symbol":
            if m.surface in "。！？!?":
                return False
            continue
        return m.pos not in ("particle",)
    return False


# Verbs that take what is said, thought, asked or called: 〜って言う is
# 〜と言う.
_SAYING = frozenset({
    "言う", "云う", "思う", "聞く", "訊く", "書く", "呼ぶ", "頼む", "伝える", "答える",
    "話す", "叫ぶ", "読む", "怒る", "教える", "考える", "言い出す", "感じる",
})

_GLOSSES = {
    "ぞ": {"en": "(sentence end) a strong assertion: I tell you!, (rough, mostly men)",
          "fr": "(fin de phrase) affirmation appuyée : je te dis !, (familier, surtout masculin)"},
    "ぜ": {"en": "(sentence end) a friendly emphasis: let's!, you know (casual, mostly men)",
          "fr": "(fin de phrase) insistance amicale : allez !, tu sais (familier, surtout masculin)"},
    "わ": {"en": "(sentence end) adds feeling or emphasis",
          "fr": "(fin de phrase) ajoute un sentiment ou de l'insistance"},
    "さ_end": {"en": "(sentence end) a light assertion: …, you know; …, of course",
              "fr": "(fin de phrase) affirmation légère : …, tu sais ; …, bien sûr"},
    "さ_mid": {"en": "(spoken) a filler that holds the listener: you see, …",
              "fr": "(oral) remplissage qui retient l'attention : tu vois, …"},
    "な": {"en": "(sentence end) feeling: …!, isn't it; a wish said to oneself (〜たいな)",
          "fr": "(fin de phrase) sentiment : … !, hein ; un souhait pour soi (〜たいな)"},
    "な_order": {"en": "(spoken) do it: the short form of 〜なさい (寝な, go to bed)",
                "fr": "(oral) fais-le : forme courte de 〜なさい (寝な, va te coucher)"},
    "ね_mid": {"en": "(mid-sentence) holds the listener: you know, …",
              "fr": "(en milieu de phrase) retient l'attention : tu vois, …"},
    "ねえ": {"en": "hey, say (calling for attention)",
            "fr": "dis, hé (pour attirer l'attention)"},
    "かしら": {"en": "I wonder (mostly women's speech)",
             "fr": "je me demande (surtout dans la bouche des femmes)"},
    "もん": {"en": "(sentence end) because…, giving one's reason (casual, insistent)",
            "fr": "(fin de phrase) parce que…, donne sa raison (familier, insistant)"},
    "じゃん": {"en": "(casual) isn't it?, see? (= じゃないか)",
             "fr": "(familier) non ?, tu vois ? (= じゃないか)"},
    "って_quote": {"en": "(spoken) quotes: '…', that… (= と)",
                 "fr": "(oral) cite : « … », que… (= と)"},
    "って_topic": {"en": "(spoken) as for, about (= は, というのは)",
                 "fr": "(oral) quant à, au sujet de (= は, というのは)"},
    "って_end": {"en": "(sentence end) they say, I heard (= そうだ); in a question, you mean…?",
               "fr": "(fin de phrase) il paraît, on m'a dit (= そうだ) ; dans une question, tu veux dire… ?"},
    "って": {"en": "(spoken) quotes or names: '…', as for… (= と, は)",
            "fr": "(oral) cite ou désigne : « … », quant à… (= と, は)"},
    "ってば": {"en": "(sentence end) I told you!, come on! (impatient insistence)",
             "fr": "(fin de phrase) je te dis !, enfin ! (insistance impatiente)"},
    "ん": {"en": "not: the negative, said short (= ない)",
          "fr": "ne… pas : la négation, dite courte (= ない)"},
    "ぬ": {"en": "not: the negative, literary (= ない)",
          "fr": "ne… pas : la négation, littéraire (= ない)"},
    "ず": {"en": "not, without: the negative, written (= ない, ないで)",
          "fr": "ne… pas, sans : la négation, écrite (= ない, ないで)"},
    "へん": {"en": "not: the negative in the Kansai (= ない)",
            "fr": "ne… pas : la négation du Kansai (= ない)"},
    "に_adverb": {"en": "makes an adverb of the word before it", "fr": "fait un adverbe du mot qui précède"},
    "まで_until": {"en": "until (it happens)", "fr": "jusqu'à ce que"},
    "よ_call": {"en": "(after a noun) calls out to it: O …, you …",
                "fr": "(après un nom) l'interpelle : ô …, toi …"},
    "は_stress": {"en": "(between a verb's stem and しない) stresses the negative: never, not at all",
                  "fr": "(entre le radical d'un verbe et しない) renforce la négation : jamais, pas du tout"},
    "の_explain": {"en": "(at the end) explains, or asks for an explanation: the casual のです (〜んです)",
                   "fr": "(en fin de phrase) explique, ou demande une explication : のです familier (〜んです)"},
    "に_gozaru": {"en": "(with ござる) is: でございます as it was said of old, very polite",
                 "fr": "(avec ござる) est : でございます à l'ancienne, très poli"},
    "で_copula": {"en": "is ..., and: です／だ joined to what follows (its て form), often giving the reason",
                  "fr": "est …, et : です／だ relié à la suite (sa forme en て), souvent pour donner la raison"},
    "は_after_te": {"en": "(after a て form) if, as long as: what follows is usually unwelcome",
                   "fr": "(après une forme en て) si, tant que : la suite est souvent fâcheuse"},
    "と_naru": {"en": "(with なる) becomes: the written form of 〜になる",
               "fr": "(avec なる) devient : la forme écrite de 〜になる"},
    "て_trailing": {"en": "(at the end) leaves the sentence open on what happened or why: …, you see",
                   "fr": "(en fin de phrase) laisse la phrase en suspens sur ce qui s'est passé ou pourquoi : …, tu vois"},
}

# What the adverb each noun makes with に says (plan 272), for the gloss.
_ADVERBS = {
    "本当": ("really, truly", "vraiment"), "ほんとう": ("really, truly", "vraiment"),
    "ほんと": ("really", "vraiment"), "本と": ("really", "vraiment"),
    "一緒": ("together", "ensemble"), "いっしょ": ("together", "ensemble"),
    "特": ("especially", "surtout"), "とく": ("especially", "surtout"),
    "主": ("mainly", "principalement"), "おも": ("mainly", "principalement"),
    "互い": ("each other", "l'un l'autre"), "お互い": ("each other", "l'un l'autre"),
    "たがい": ("each other", "l'un l'autre"), "同時": ("at the same time", "en même temps"),
    "一斉": ("all at once", "tous en même temps"), "交互": ("in turns", "en alternance"),
    "一度": ("at one time", "en une seule fois"), "いちど": ("at one time", "en une seule fois"),
    "一気": ("in one go", "d'un seul coup"), "一遍": ("all at once", "d'un coup"),
    "順番": ("in turn", "à tour de rôle"), "次第": ("gradually", "peu à peu"),
    "ついで": ("while at it", "au passage"), "代わり": ("instead", "à la place"),
    "先": ("first, ahead", "d'abord, en avance"), "さき": ("first, ahead", "d'abord, en avance"),
}


def gives_a_reason(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the もん that closes a sentence on its
    reason (言わないもん, "I won't say, so there"), which UniDic reads as
    もの, "thing": the card is then no word of the sentence."""
    m = morphemes[i]
    return m.surface == "もん" and _after_a_predicate(morphemes, i) and closes_sentence(morphemes, i)


def gloss(morphemes, i: int) -> dict | None:
    """The gloss of morphemes[i], a word of speech with no card and no
    point, or None."""
    m = morphemes[i]
    base = _base(m.surface)
    key = None
    if m.pos == "auxiliary" and m.lemma == "ず" and m.surface in ("ん", "ぬ", "ず"):
        key = m.surface
    elif m.pos == "auxiliary" and m.lemma == "へん" and m.surface == "へん":
        key = "へん"
    elif m.pos == "auxiliary" and m.surface == "に" and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface.startswith("ござ"):
        key = "に_gozaru"                   # 一大事にございます
    elif m.pos == "auxiliary" and m.surface == "で" and m.lemma == "だ" and m.cform.startswith("連用形") \
            and i > 0 and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in ("、", "，", ",")):
        key = "で_copula"                   # 残業続きで、, 48.6％で、
    elif m.pos in ("interjection", "particle") and base in ("ね", "ねえ") and m.surface != "ね" and (
            _opens(morphemes, i) or _base(morphemes[i - 1].surface) in ("ね", "ねえ")):
        key = "ねえ"
    elif m.surface == "もん" and m.pos in ("noun", "particle") and _after_a_predicate(morphemes, i) \
            and closes_sentence(morphemes, i):
        key = "もん"
    elif m.pos == "particle" and m.surface == "よ" and i > 0 and morphemes[i - 1].pos == "noun" \
            and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in ("\u3000", " ", "、", "，", "！", "!")):
        key = "よ_call"                     # 儚き夢よ　いずこへ
    elif m.pos == "particle" and m.surface == "は" and i > 0 and i + 2 < len(morphemes) \
            and morphemes[i - 1].pos in ("verb", "auxiliary") and morphemes[i - 1].cform.startswith("連用形") \
            and morphemes[i + 1].lemma in ("為る", "する") and morphemes[i + 2].lemma in ("ない", "無い", "ぬ", "ず"):
        key = "は_stress"                   # 止められはしない
    elif m.pos == "particle":
        if m.surface == "ってば":
            key = "ってば"
        elif base in ("ぞ", "ぜ", "かしら", "じゃん"):
            key = base
        elif base == "わ" and i > 0 and morphemes[i - 1].pos in ("verb", "adjective", "auxiliary", "particle"):
            key = "わ"
        elif base == "さ" and i > 0 and morphemes[i - 1].pos != "symbol":
            key = "さ_end" if _closes(morphemes, i) else "さ_mid"
        elif base == "な" and i > 0:
            prev = morphemes[i - 1]
            if prev.pos == "verb" and prev.cform.startswith("連用形"):
                key = "な_order"
            elif prev.pos == "verb" and prev.cform.startswith(("終止形", "連体形")):
                # 行くな is "don't go" as often as it is a sigh: the
                # prohibition is the detector's to find (〜な（禁止）).
                key = None
            elif prev.pos in ("verb", "adjective", "auxiliary", "particle", "noun", "other"):
                key = "な"
        elif base == "ね" and i > 0 and _followed_by_a_word(morphemes, i):
            key = "ね_mid"
        elif m.surface == "って" and i > 0:
            key = _quoting(morphemes, i)
        elif m.surface == "の" and _after_a_predicate(morphemes, i) and closes_sentence(morphemes, i):
            key = "の_explain"              # 好きだったの。, どうしたの？
        elif m.surface == "は" and i > 0 and morphemes[i - 1].conjunctive and morphemes[i - 1].surface in ("て", "で") \
                and i + 1 < len(morphemes) and morphemes[i + 1].surface in ("、", "，"):
            key = "は_after_te"              # そんな運転をしていては、大けがをする
        elif m.surface == "まで" and i > 0 and morphemes[i - 1].pos in ("verb", "auxiliary") \
                and morphemes[i - 1].cform.startswith(("終止形", "連体形")):
            key = "まで_until"               # 亡くなるまで, "until he died"
        elif m.surface == "と" and i > 0 and morphemes[i - 1].pos in ("noun", "pronoun", "suffix") \
                and i + 1 < len(morphemes) and morphemes[i + 1].pos == "verb" \
                and morphemes[i + 1].lemma in ("成る", "なる"):
            key = "と_naru"
        elif m.surface in ("て", "で") and m.conjunctive and i > 0 \
                and morphemes[i - 1].pos in ("verb", "auxiliary", "adjective") and _closes(morphemes, i) \
                and all(u.pos == "symbol" for u in _rest(morphemes, i)):
            key = "て_trailing"
        elif m.surface == "に":
            from study.grammar_detect import adverbial_ni
            if adverbial_ni(morphemes, i):
                noun = morphemes[i - 1].surface
                if noun in _ADVERBS:
                    en, fr = _ADVERBS[noun]
                    return {"en": f"makes an adverb of {noun}: {noun}に, {en}",
                            "fr": f"fait un adverbe de {noun} : {noun}に, {fr}"}
                key = "に_adverb"
    return dict(_GLOSSES[key]) if key else None


def _quoting(morphemes, i: int) -> str:
    """Which って this is: one that quotes (食べ放題って言っても), names a
    topic (あれって本当に), or closes the sentence on what was heard
    (彼氏できたんだって) -- or, where the sentence does not say, both."""
    rest = [m for m in _rest(morphemes, i) if m.pos != "symbol" or m.surface not in "　 "]
    nxt = rest[0] if rest else None
    if nxt is not None and nxt.pos == "verb" and nxt.lemma in _SAYING:
        return "って_quote"
    if _closes(morphemes, i):
        return "って_end"
    prev = morphemes[i - 1]
    if prev.pos in ("noun", "pronoun", "suffix") and nxt is not None and nxt.pos not in ("particle", "symbol"):
        return "って_topic"
    return "って"
