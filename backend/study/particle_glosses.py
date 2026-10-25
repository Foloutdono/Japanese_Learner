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
    "な_before_no": {"en": "the な a noun or a な-adjective takes before の: 日なのよ, だめなの？",
                     "fr": "le な que prend un nom ou un adjectif en な devant の : 日なのよ, だめなの ?"},
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
    "に_adjectival": {"en": "makes an adverb of the word before it (安全に, safely), or marks a goal (平和に役立つ, to peace)",
                     "fr": "fait un adverbe du mot qui précède (安全に, en sécurité), ou marque un but (平和に役立つ, à la paix)"},
    "と_adverb": {"en": "(after an adverb) the と the adverb is said with",
                 "fr": "(après un adverbe) le と qui l'accompagne"},
    "sound": {"en": "a sound or manner word (onomatopoeia)", "fr": "une onomatopée (un bruit ou une manière)"},
    "ガチ": {"en": "(slang) serious, for real", "fr": "(argot) sérieux, pour de vrai"},
    "ガチで": {"en": "(slang) seriously, for real", "fr": "(argot) sérieusement, pour de vrai"},
    "あざす": {"en": "(slang) thanks! (ありがとうございます said short)",
             "fr": "(argot) merci ! (ありがとうございます dit court)"},
    "どういった": {"en": "what kind of (= どんな, said politely)", "fr": "quel genre de (= どんな, poli)"},
    "へえ": {"en": "(surprise, interest) oh?, really?, wow", "fr": "(surprise, intérêt) ah bon ?, vraiment ?"},
    "はあ_huh": {"en": "(surprise or doubt) huh?, what?!", "fr": "(surprise ou doute) hein ?, quoi ?!"},
    "ええい": {"en": "(exasperation) argh!, enough!", "fr": "(exaspération) assez !, bon sang !"},
    "がいい": {"en": "(before いい, old-fashioned) go ahead and…, you may as well: 足掻くがいい",
             "fr": "(devant いい, ancien) libre à toi de…, fais donc : 足掻くがいい"},
    "え_huh": {"en": "(surprise) eh?, what?", "fr": "(surprise) hein ?, quoi ?"},
    "じゃ_da": {"en": "(old or regional speech) is: the copula だ (曲者じゃ！, an intruder!)",
              "fr": "(parler ancien ou régional) est : la copule だ (曲者じゃ！, un intrus !)"},
    "のう": {"en": "(old-fashioned) …isn't it!, …you know: なあ said of old",
           "fr": "(ancien) …n'est-ce pas !, …tu sais : なあ d'autrefois"},
    "まじで": {"en": "(casual) seriously, really",
             "fr": "(familier) sérieusement, vraiment"},
    "より_from": {"en": "(formal) from (= から): 口座より引き落とされます, it is debited from the account",
                  "fr": "(formel) de, à partir de (= から) : 口座より引き落とされます, c'est prélevé sur le compte"},
    "にて": {"en": "(formal) at, in, by (= で): 体育館にて, in the gym",
            "fr": "(formel) à, dans, par (= で) : 体育館にて, au gymnase"},
    "ながら_though": {"en": "(after a quality) though…, while: 勝手ながら, though it is selfish of us",
                     "fr": "(après une qualité) bien que…, tout en : 勝手ながら, bien que ce soit cavalier de notre part"},
    "と_as": {"en": "(before する, formal) as, to be: 休業とさせていただきます, we will close; …ものとする, shall …",
             "fr": "(devant する, formel) comme, en tant que : 休業とさせていただきます, nous fermerons ; …ものとする, doit …"},
    "やがる": {"en": "(rude) has the nerve to…, dares to: 何しやがる！, what do you think you're doing!",
             "fr": "(grossier) ose…, a le culot de : 何しやがる！, qu'est-ce qui te prend !"},
    "で_almost": {"en": "(after もう少し) almost, all but: もう少しで勝てた, I almost won",
                 "fr": "(après もう少し) presque : もう少しで勝てた, j'ai failli gagner"},
    "ところ_while": {"en": "(set phrase) at a time when: お忙しいところ, though you are busy",
                    "fr": "(formule) au moment où : お忙しいところ, alors que vous êtes occupé"},
    "や_da": {"en": "(Kansai) is (= だ): なんでやねん, why on earth?",
             "fr": "(Kansai) est (= だ) : なんでやねん, mais enfin pourquoi ?"},
    "ねん": {"en": "(Kansai) explains or insists (= のだ, んだ)", "fr": "(Kansai) explique ou insiste (= のだ, んだ)"},
    "やん": {"en": "(Kansai) isn't it!, you know (= じゃない)", "fr": "(Kansai) n'est-ce pas !, tu sais (= じゃない)"},
    "ん_no": {"en": "(spoken) の said short: explains or asks (なんぼするん？, how much is it?)",
             "fr": "(oral) の abrégé : explique ou demande (なんぼするん？, combien ça coûte ?)"},
    "が_even_if": {"en": "(after the volitional) no matter whether…: 雨が降ろうが, rain or not",
                   "fr": "(après la forme volitive) que … ou non : 雨が降ろうが, qu'il pleuve ou non"},
    "てか": {"en": "(casual) I mean, or rather (= というか)",
            "fr": "(familier) enfin, ou plutôt (= というか)"},
    "で_then": {"en": "(spoken, opening a sentence) so, and then (= それで)",
               "fr": "(oral, en tête de phrase) alors, et donc (= それで)"},
    "が_insist": {"en": "(after だろう, at the end) insists: …, isn't it obvious!",
                 "fr": "(après だろう, en fin de phrase) insiste : …, c'est évident !"},
    "じゃ_copula": {"en": "(spoken) では said short: as for, with …; じゃない is not",
                   "fr": "(oral) では dit court : quant à, avec … ; じゃない, n'est pas"},
    "www": {"en": "(net slang) laughter, lol: one w a laugh",
            "fr": "(argot du web) rires, mdr : un w par rire"},
    "草_lol": {"en": "(net slang) lol: laughter, whose ｗｗｗ look like grass",
              "fr": "(argot du web) mdr : le rire, dont les ｗｗｗ ressemblent à de l'herbe"},
}

# The letters a laugh is typed with: www, ｗｗｗ.
_LAUGH = frozenset("wｗWＷ")


def _a_laugh(surface: str) -> bool:
    return len(surface) >= 2 and all(c in _LAUGH for c in surface)


# The な-adjectives of manner said with と (analysis.TO_MANNER).
_TO_MANNER = frozenset({"意外", "案外", "平然", "漠然", "毅然", "呆然", "唖然", "悠然", "颯爽", "歴然", "断然",
                          "公然", "決然", "整然", "雑然", "騒然", "愕然", "泰然", "超然", "敢然", "漫然", "黙然",
                          "茫然", "憤然", "釈然", "厳然", "粛然", "猛然", "忽然"})


def _from_not_than(morphemes, i: int) -> bool:
    from study.card_lookup import _from_not_than as from_not_than

    return from_not_than(morphemes, i)


# The states お忙しいところ, お疲れのところ say a request is made in.
_BUSY = frozenset({"忙しい", "お忙しい", "疲れ", "お疲れ", "急ぎ", "お急ぎ", "休み", "お休み", "取り込み", "お取り込み"})


def busy_tokoro(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the ところ of お忙しいところ, "at a time
    when you are busy" (plan 272), no "place"."""
    if morphemes[i].surface not in ("ところ", "所") or i == 0:
        return False
    k = i - 1
    if morphemes[k].surface == "の" and k > 0:
        k -= 1
    return morphemes[k].lemma in _BUSY or morphemes[k].surface in _BUSY


def _a_sound_word(surface: str, pos: str = "adverb") -> bool:
    """Whether `surface` is shaped as a sound or manner word no
    dictionary has (plan 272): cut short (バキッ), drawn out to its ン
    (ガシャーン, ドーン), one letter said over and over (ゴゴゴ), or two
    letters and り in katakana (ペコリ)."""
    kana = surface and all("\u3041" <= c <= "\u30fc" for c in surface)
    if not kana or len(surface) < 3:
        return False
    if surface[-1] in "ッっ":
        return True
    if surface.endswith(("ーン", "ーん")):
        return pos in ("adverb", "interjection")
    if len(set(surface)) == 1:
        return True
    return len(surface) == 3 and surface[-1] == "リ" and all("\u30a1" <= c <= "\u30fc" for c in surface)


def net_laughter(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the 草 of net slang, "lol" (plan 272): one
    a typed laugh follows (それはさすがに草www), or 生える or 不可避 (草生える,
    草不可避) -- never the grass of 庭の草. The card is then no word of
    the sentence."""
    if morphemes[i].surface not in ("草", "くさ"):
        return False
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    return nxt is not None and (_a_laugh(nxt.surface) or nxt.lemma in ("生える", "はえる")
                                or nxt.surface.startswith("不可避"))

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
    # (plan 272)
    "絶対": ("absolutely, without fail", "absolument, à coup sûr"),
    "ぜったい": ("absolutely, without fail", "absolument, à coup sûr"),
    "誠": ("truly, sincerely", "sincèrement, vraiment"), "まこと": ("truly, sincerely", "sincèrement, vraiment"),
    "実際": ("actually, in fact", "en fait, réellement"), "じっさい": ("actually, in fact", "en fait, réellement"),
    "逆": ("conversely, the other way round", "à l'inverse"), "ぎゃく": ("conversely, the other way round", "à l'inverse"),
    "同様": ("likewise, in the same way", "de même"), "どうよう": ("likewise, in the same way", "de même"),
    "直接": ("directly", "directement"), "ちょくせつ": ("directly", "directement"),
    "偶然": ("by chance", "par hasard"), "ぐうぜん": ("by chance", "par hasard"),
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
    if m.pos == "auxiliary" and m.lemma == "ず" and m.surface == "ん" and i > 0 \
            and morphemes[i - 1].pos in ("verb", "auxiliary") and morphemes[i - 1].cform.startswith(("終止形", "連体形")):
        key = "ん_no"                       # なんぼするん？ (plan 272)
    elif m.pos == "auxiliary" and m.lemma == "ず" and m.surface in ("ん", "ぬ", "ず"):
        key = m.surface
    elif m.pos == "adverb" and m.surface in ("マジで", "まじで"):
        key = "まじで"
    elif m.pos == "conjunction" and m.surface in ("てか", "ってか"):
        key = "てか"
    elif m.surface == "やん" and m.pos == "particle":
        key = "やん"                        # (Kansai, plan 272)
    elif busy_tokoro(morphemes, i):
        key = "ところ_while"
    elif m.pos == "particle" and m.surface == "より" and _from_not_than(morphemes, i):
        key = "より_from"
    elif m.pos == "particle" and m.surface == "にて":
        key = "にて"
    elif m.pos == "particle" and m.surface == "ながら" and i > 0 and morphemes[i - 1].pos in ("noun", "other", "adjective") \
            and not morphemes[i - 1].cform.startswith("連用形"):
        key = "ながら_though"               # 誠に勝手ながら (plan 272)
    elif m.pos == "particle" and m.surface == "と" and i > 0 and i + 1 < len(morphemes) \
            and morphemes[i - 1].pos == "noun" and morphemes[i + 1].lemma in ("為る", "する"):
        key = "と_as"                       # 休業とさせていただきます, ものとする (plan 272)
    elif m.lemma == "やがる" and m.pos == "auxiliary":
        key = "やがる"
    elif m.pos == "particle" and m.surface == "で" and i >= 2 and morphemes[i - 1].surface in ("少し", "ちょっと") \
            and morphemes[i - 2].surface in ("もう", "あと"):
        key = "で_almost"                   # もう少しで勝てた (plan 272)
    elif m.pos == "auxiliary" and m.surface == "や" and m.lemma == "や" and (
            i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol"
            or morphemes[i + 1].surface in ("ねん", "ん", "で", "な", "なあ", "ねえ", "から", "けど", "し", "のに", "ろ", "わ")):
        key = "や_da"                       # なんでやねん, 下手やねん -- never 何やかや (plan 272)
    elif m.pos == "particle" and m.surface == "ねん":
        key = "ねん"
    elif m.pos == "particle" and m.surface == "が" and i > 0 and morphemes[i - 1].cform.startswith("意志推量形") \
            and morphemes[i - 1].pos in ("verb", "auxiliary") and morphemes[i - 1].lemma not in ("だ", "です", "ます") \
            and i + 1 < len(morphemes) and not (morphemes[i + 1].pos == "symbol" and morphemes[i + 1].surface in "。！？!?"):
        key = "が_even_if"                  # 雨が降ろうが槍が降ろうが, never 分かるだろうが！ (plan 272)
    elif m.pos == "conjunction" and m.surface == "で" and _opens(morphemes, i):
        key = "で_then"                     # で、その日の仕事はどうする？ (plan 272)
    elif _a_laugh(m.surface) or (m.pos == "interjection" and m.surface in _LAUGH):
        key = "www"
    elif m.surface in ("ガチ", "ガチで", "あざす", "あざっす", "あざーす", "どういった"):
        key = {"あざっす": "あざす", "あざーす": "あざす"}.get(m.surface, m.surface)
    elif m.pos == "interjection" and m.surface in ("へえ", "へー", "へぇ", "へええ", "ほえー"):
        key = "へえ"
    elif m.pos == "interjection" and m.surface in ("は", "はあ", "はぁ") and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface in ("？", "?", "！？", "!?"):
        key = "はあ_huh"                    # は？五千円も？
    elif m.pos == "interjection" and m.surface in ("ええい", "えい"):
        key = "ええい"
    elif m.pos == "interjection" and m.surface in ("え", "えっ", "えー", "ええっ", "えぇ") and _opens(morphemes, i) \
            and i + 1 < len(morphemes) and morphemes[i + 1].pos == "symbol":
        key = "え_huh"                      # え、もう帰る？
    elif m.pos == "auxiliary" and m.surface == "じゃ" and m.lemma in ("じゃ", "だ") and i > 0 \
            and (morphemes[i - 1].pos in ("noun", "pronoun", "suffix") or morphemes[i - 1].surface in ("の", "ん")) \
            and (i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol"):
        key = "じゃ_da"                     # 曲者じゃ！
    elif m.pos == "particle" and m.surface in ("のう", "のぅ") and i > 0 \
            and (i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol"):
        key = "のう"                        # なかなかやるのう
    elif m.pos in ("adverb", "noun", "interjection") and _a_sound_word(m.surface, m.pos):
        key = "sound"                      # ガシャーン, バキッ, ゴゴゴ
    elif net_laughter(morphemes, i):
        key = "草_lol"
    elif m.pos == "particle" and m.surface == "が" and 0 < i < len(morphemes) - 1 \
            and morphemes[i - 1].pos == "verb" and morphemes[i - 1].cform.startswith(("終止形", "連体形")) \
            and morphemes[i + 1].lemma in ("良い", "いい", "よい") \
            and (i + 2 >= len(morphemes) or morphemes[i + 2].pos == "symbol"):
        key = "がいい"                      # 足掻くがいい, 好きにするがいい (plan 272)
    elif m.pos == "particle" and m.surface == "が" and i > 0 \
            and morphemes[i - 1].surface in ("だろう", "だろ", "でしょう", "でしょ") \
            and i + 1 < len(morphemes) and morphemes[i + 1].surface in ("！", "!"):
        key = "が_insist"                  # 見りゃ分かるだろうが！
    elif m.pos == "auxiliary" and m.surface == "に" and m.lemma == "だ" and i > 0 \
            and morphemes[i - 1].pos == "noun" and morphemes[i - 1].adjectival:
        # 安全に泳げます, 平和に役立つ: the letters do not say which; the
        # gloss names both, and no point is lit (plan 150, 272).
        key = "に_adjectival"
    elif m.pos == "particle" and m.surface in ("じゃ", "じゃあ") and not _opens(morphemes, i) \
            and not (i > 0 and morphemes[i - 1].surface in ("それ", "そう", "これ") and _opens(morphemes, i - 1)):
        key = "じゃ_copula"                # お前のせいじゃね？
    elif m.pos == "auxiliary" and m.lemma == "へん" and m.surface == "へん":
        key = "へん"
    elif m.pos == "auxiliary" and m.surface == "に" and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface.startswith("ござ"):
        key = "に_gozaru"                   # 一大事にございます
    elif m.pos == "auxiliary" and m.surface == "で" and m.lemma == "だ" and m.cform.startswith("連用形") \
            and i > 0 and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in ("、", "，", ",")):
        key = "で_copula"                   # 残業続きで、, 48.6％で、
    elif m.surface == "な" and m.pos == "auxiliary" and m.lemma == "だ" and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface == "の" and morphemes[i + 1].pos == "particle" \
            and closes_sentence(morphemes, i + 1):
        key = "な_before_no"                # ゴミの日なのよ (plan 272)
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
            elif prev.pos in ("verb", "adjective", "auxiliary", "particle", "noun", "other", "interjection",
                              "adverb"):
                key = "な"                  # (参ったな, まあな, ちょっとな: plan 272)
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
        elif m.surface == "と" and i > 0 and (morphemes[i - 1].pos == "adverb" or (
                morphemes[i - 1].pos == "other" and (morphemes[i - 1].surface.endswith("々")
                                                     or morphemes[i - 1].surface in _TO_MANNER))) \
                and morphemes[i - 1].surface not in ("そう", "こう", "ああ", "どう"):
            key = "と_adverb"                # ざあざあと, an adverb no dictionary has
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
