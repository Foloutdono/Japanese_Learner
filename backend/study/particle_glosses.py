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
        # (a hashtag or an emoji after a post's line ends it: 来てね〜🎮 #ゲーム,
        # plan 272)
        if m.pos == "symbol" and (m.surface in "。！？!?」』…‥#＃" or any(ord(c) >= 0x1F000 for c in m.surface)):
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
            # (a hashtag or an emoji ends a post's line, plan 272)
            if m.surface in "。！？!?#＃" or any(ord(c) >= 0x1F000 for c in m.surface):
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
    "って_end": {"en": "(sentence end) they say, I heard (= そうだ); or insisting, I'm telling you (いいって, "
                      "it's fine, really); in a question, you mean…?",
               "fr": "(fin de phrase) il paraît, on m'a dit (= そうだ) ; ou avec insistance, je te dis (いいって, "
                     "mais si, ça va) ; dans une question, tu veux dire… ?"},
    "やろ": {"en": "(Kansai) = だろう: …, isn't it?, I suppose", "fr": "(Kansai) = だろう : …, n'est-ce pas ?, je suppose"},
    "や_order": {"en": "(Kansai, after a verb's stem) do it: a gentle order (= 〜なさい)",
                "fr": "(Kansai, après le radical d'un verbe) fais-le : un ordre doux (= 〜なさい)"},
    "れ_can": {"en": "(the west, before へん) can: 歩かれへん, can't walk (= 歩けない)",
              "fr": "(l'Ouest, devant へん) pouvoir : 歩かれへん, ne plus pouvoir marcher (= 歩けない)"},
    "て_hen": {"en": "(before へん) = ている, its negative in the west: 聞いてへん, haven't heard",
              "fr": "(devant へん) = ている, sa négation dans l'Ouest : 聞いてへん, ne pas avoir entendu"},
    "ほんまに": {"en": "(Kansai) really, truly (= 本当に)", "fr": "(Kansai) vraiment (= 本当に)"},
    "そんなん": {"en": "(Kansai, casual) = そんなの: that kind of thing, such a thing",
                "fr": "(Kansai, familier) = そんなの : ce genre de chose, une chose pareille"},
    "って_insist": {"en": "(after an order, at the end) I'm telling you!: the order said again, insisting",
                   "fr": "(après un ordre, en fin de phrase) je te dis ! : l'ordre répété, avec insistance"},
    "って_iu": {"en": "(before a noun) = という: that …, called … (行かないってこと, the fact that you won't go)",
              "fr": "(devant un nom) = という : que …, appelé … (行かないってこと, le fait que tu n'iras pas)"},
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
    "も_even": {"en": "(between a verb's stem and しない) not even: 謝りもしなかった, didn't even apologize",
                "fr": "(entre le radical d'un verbe et しない) même pas : 謝りもしなかった, ne s'est même pas excusé"},
    "な_before_no": {"en": "the な a noun or a な-adjective takes before の: 日なのよ, だめなの？",
                     "fr": "le な que prend un nom ou un adjectif en な devant の : 日なのよ, だめなの ?"},
    "の_explain": {"en": "(at the end) explains, or asks for an explanation: the casual のです (〜んです)",
                   "fr": "(en fin de phrase) explique, ou demande une explication : のです familier (〜んです)"},
    "に_gozaru": {"en": "(with ござる) is: でございます as it was said of old, very polite",
                 "fr": "(avec ござる) est : でございます à l'ancienne, très poli"},
    "で_copula": {"en": "is ..., and: です／だ joined to what follows (its て form), often giving the reason",
                  "fr": "est …, et : です／だ relié à la suite (sa forme en て), souvent pour donner la raison"},
    "は_after_particle": {"en": "(after a particle) makes that part the topic, or sets it against others: 仕事では, "
                                "at work at least; 簡単には, not easily",
                          "fr": "(après une particule) en fait le thème, ou l'oppose au reste : 仕事では, au travail "
                                "du moins ; 簡単には, pas facilement"},
    "は_te_negative": {"en": "(between a て form and a negative) stresses the negative: 育ってはくれない, won't grow "
                             "(for you), however much you want",
                       "fr": "(entre une forme en て et une négation) renforce la négation : 育ってはくれない, ne "
                             "pousse pas (pour toi), quoi qu'on veuille"},
    "の_subject": {"en": "(in a clause before a noun) marks who or what does it, = が: 花粉の飛ぶ量, the amount "
                         "of pollen that flies",
                   "fr": "(dans une proposition devant un nom) marque qui fait l'action, = が : 花粉の飛ぶ量, la "
                         "quantité de pollen qui vole"},
    "まで_even": {"en": "(after に, or before も) even, as far as: 預金にまで手をつける, even touches the savings",
                 "fr": "(après に, ou devant も) jusqu'à, même : 預金にまで手をつける, toucher même à l'épargne"},
    "まで_upto": {"en": "up to, as far as, until: 最後まで, to the end", "fr": "jusqu'à : 最後まで, jusqu'au bout"},
    "て_form": {"en": "the て form: joins what comes before to what follows (and, so, by doing)",
               "fr": "la forme en て : relie ce qui précède à ce qui suit (et, donc, en faisant)"},
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
    "laugh_said": {"en": "(a laugh) heh heh, ha ha", "fr": "(un rire) hé hé, ha ha"},
    "と_end": {"en": "(at the end) the rest left unsaid: a quote, '…' (I said), or after ない a must (= 〜ないといけない)",
              "fr": "(en fin de phrase) la suite non dite : une citation, « … » (ai-je dit), ou après ない une obligation (= 〜ないといけない)"},
    "で_aru": {"en": "(with は or も, then ある or ない) is: the copula written out (ではない, ではあるまい, is not)",
              "fr": "(avec は ou も, puis ある ou ない) est : la copule écrite en entier (ではない, ではあるまい, n'est pas)"},
    "は_dewa": {"en": "(between で and ある or ない) sets off what is denied: ではない, ではあるまい",
               "fr": "(entre で et ある ou ない) met en relief ce qui est nié : ではない, ではあるまい"},
    "に_purpose": {"en": "(after a verb, before は) for, to: what it takes (取り戻すには, to win it back)",
                   "fr": "(après un verbe, devant は) pour : ce qu'il faut (取り戻すには, pour le regagner)"},
    "も_yori": {"en": "(after より) stresses the comparison: rather than, more than",
               "fr": "(après より) appuie la comparaison : plutôt que, plus que"},
    "や_yo": {"en": "(Kansai, at the end) = よ: softens a request or a claim (おってや, do stay)",
             "fr": "(Kansai, en fin de phrase) = よ : adoucit une demande ou une affirmation (おってや, reste donc)"},
    "おう": {"en": "(rough, mostly men) hey!, yeah!: a greeting or an answer",
            "fr": "(familier, surtout chez les hommes) hé !, ouais ! : un salut ou une réponse"},
    "あれ_huh": {"en": "huh?, eh?: surprise, or trying to remember", "fr": "hein ?, tiens ? : la surprise, ou un souvenir qui revient"},
    "あ_oh": {"en": "ah!, oh!: something noticed or remembered", "fr": "ah !, oh ! : on remarque ou on se rappelle quelque chose"},
    "stammer": {"en": "(a stammer) the start of the next word, said twice", "fr": "(un bégaiement) le début du mot suivant, dit deux fois"},
    "ませ": {"en": "(after ください, いらっしゃい) ます as a polite order: please, very politely",
            "fr": "(après ください, いらっしゃい) ます à l'impératif poli : veuillez, très poliment"},
    "じゃ_da": {"en": "(old or regional speech) is: the copula だ (曲者じゃ！, an intruder!)",
              "fr": "(parler ancien ou régional) est : la copule だ (曲者じゃ！, un intrus !)"},
    "のう": {"en": "(old-fashioned) …isn't it!, …you know: なあ said of old",
           "fr": "(ancien) …n'est-ce pas !, …tu sais : なあ d'autrefois"},
    "まじで": {"en": "(casual) seriously, really",
             "fr": "(familier) sérieusement, vraiment"},
    "に_sound": {"en": "makes an adverb of the word before it: べこべこに, all dented; さすがに, as you would expect",
                 "fr": "fait un adverbe du mot qui précède : べこべこに, tout cabossé ; さすがに, comme on pouvait s'y attendre"},
    "は_after_ku": {"en": "as for, at least (after a く form or an adverb): 正しくは, to be exact; 少なくとも",
                    "fr": "quant à, du moins (après une forme en く ou un adverbe) : 正しくは, pour être exact"},
    "で_mama": {"en": "(in 〜ままでいる) stays as it is: 知らないままでいたかった, I wanted to go on not knowing",
                "fr": "(dans 〜ままでいる) rester tel quel : 知らないままでいたかった, j'aurais voulu ne jamais savoir"},
    "ござる": {"en": "(old speech) to be, there is (= である, ございます): ござらぬ, is not",
              "fr": "(langue ancienne) être, il y a (= である, ございます) : ござらぬ, n'est pas"},
    "それがし": {"en": "(old speech) I, me: a samurai's humble \u2018I\u2019", "fr": "(langue ancienne) je, moi : le « je » humble du samouraï"},
    "や_surely": {"en": "(old, emphatic) indeed: 必ずや, surely, without fail", "fr": "(ancien, emphatique) bien : 必ずや, à coup sûr"},
    "笑": {"en": "(net slang) lol: 笑, read わら, laughter typed after a line", "fr": "(argot du net) mdr : 笑, lu わら, un rire tapé après la phrase"},
    "けえ": {"en": "(Hiroshima, Okayama) so, because (= から)", "fr": "(Hiroshima, Okayama) donc, parce que (= から)"},
    "けん": {"en": "(western Japan, Kyūshū) so, because (= から)", "fr": "(ouest du Japon, Kyūshū) donc, parce que (= から)"},
    "がね": {"en": "(Nagoya) …, you know! (= よ, ね)", "fr": "(Nagoya) …, hein ! (= よ, ね)"},
    "っちゃ": {"en": "(Sendai, Kyūshū) …, you know (a sentence's end)", "fr": "(Sendai, Kyūshū) …, tu sais (fin de phrase)"},
    "っぺ": {"en": "(Kantō, Tōhoku) let's, I'll (= よう): 食べっぺ, I'll eat", "fr": "(Kantō, Tōhoku) allons, je vais (= よう) : 食べっぺ, je vais manger"},
    "とる": {"en": "(western Japan) ている said とる: しとったら, していたら", "fr": "(ouest du Japon) ている dit とる : しとったら = していたら"},
    "てちょう": {"en": "(Nagoya) please (= 〜てちょうだい)", "fr": "(Nagoya) s'il te plaît (= 〜てちょうだい)"},
    "てけらいん": {"en": "(Sendai) please (= 〜てください)", "fr": "(Sendai) s'il vous plaît (= 〜てください)"},
    "らん": {"en": "(Kyūshū) not (= ない): 見らん, 見ない", "fr": "(Kyūshū) ne … pas (= ない) : 見らん = 見ない"},
    "てん": {"en": "(spoken) てる (= ている) said before の: 知ってんの？, how do you know?",
            "fr": "(oral) てる (= ている) avant の : 知ってんの？, comment tu le sais ?"},
    "どこう": {"en": "(spoken) でおこう, 〜ておく said short: 取り込んどこう, let's take them in now",
              "fr": "(oral) でおこう, 〜ておく abrégé : 取り込んどこう, rentrons-les maintenant"},
    "んで": {"en": "(spoken) ので said short: because", "fr": "(oral) ので abrégé : parce que"},
    "のん": {"en": "(Kansai) の？, asking why or what", "fr": "(Kansai) の？, pour demander pourquoi ou quoi"},
    "わしゃ": {"en": "わしは said as one: わし, I (an old man's word, or the west's)", "fr": "わしは en un mot : わし, je (mot d'homme âgé, ou de l'Ouest)"},
    "て_quote": {"en": "(spoken, = と) quotes: なんて言う, say what, how to put it",
                "fr": "(oral, = と) cite : なんて言う, dire quoi, comment dire"},
    "て_toshite": {"en": "(と + して, after a clause) on the grounds that…, saying that…: the reason given (盗んだとして逮捕, arrested on suspicion of theft)",
                   "fr": "(と + して, après une proposition) au motif que…, en disant que… : la raison avancée (盗んだとして逮捕, arrêté pour vol présumé)"},
    "て_miseru": {"en": "て + みせる: to show one can, I'll prove it (果たしてみせる, I'll keep it, you'll see)",
                  "fr": "て + みせる : montrer qu'on en est capable (果たしてみせる, je le tiendrai, tu verras)"},
    "ワン_one": {"en": "one (in loanwords): ワンサイズ, one size; ワンルーム, a one-room flat",
                "fr": "un (dans les mots d'emprunt) : ワンサイズ, une taille ; ワンルーム, un studio"},
    "ウケる": {"en": "(slang) that's hilarious, it cracks me up (= 面白い)", "fr": "(argot) trop drôle, ça me fait rire (= 面白い)"},
    "なーんだ": {"en": "(spoken) oh, is that all? (= なんだ)", "fr": "(oral) ah, ce n'est que ça ? (= なんだ)"},
    "へへっ": {"en": "(a laugh) heh heh", "fr": "(un rire) hé hé"},
    "じゃけえ": {"en": "(Hiroshima) so, that's why (= だから)", "fr": "(Hiroshima) donc, c'est pour ça (= だから)"},
    "どえりゃあ": {"en": "(Nagoya) terribly, awfully (= どえらく)", "fr": "(Nagoya) terriblement (= どえらく)"},
    "いぎなり": {"en": "(Sendai) very, really (= とても)", "fr": "(Sendai) très, vraiment (= とても)"},
    "おばんです": {"en": "(Tōhoku, Hokkaidō) good evening (= こんばんは)", "fr": "(Tōhoku, Hokkaidō) bonsoir (= こんばんは)"},
    "ずんだ": {"en": "(Sendai) sweet paste of green soybeans: ずんだ餅", "fr": "(Sendai) pâte sucrée de soja vert : ずんだ餅"},
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
    "ところ_truth": {"en": "(set phrase) the truth of it: 正直なところ, honestly speaking; 実のところ, in fact",
                    "fr": "(formule) ce qu'il en est : 正直なところ, à vrai dire ; 実のところ, en fait"},
    "だけ_as_many": {"en": "(after 数) as many as: 星の数だけ, as many times as there are stars",
                    "fr": "(après 数) autant que : 星の数だけ, autant de fois qu'il y a d'étoiles"},
    "ああ_yes": {"en": "(answering) yeah, right: a casual yes", "fr": "(en réponse) ouais, oui : un oui familier"},
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
    "よる_progressive": {"en": "(western Japan) is …ing (= ている): なにしよるん, what are you doing?",
                        "fr": "(ouest du Japon) est en train de (= ている) : なにしよるん, qu'est-ce que tu fais ?"},
    "で_yo": {"en": "(Kansai, at the end) you know, I tell you (= よ): 千円やで, it's a thousand yen, you know",
             "fr": "(Kansai, en fin de phrase) tu sais, je te dis (= よ) : 千円やで, c'est mille yens, tu sais"},
    "かて": {"en": "(Kansai) even if (= たって, ても): 言うたかて, even if you say so",
            "fr": "(Kansai) même si (= たって, ても) : 言うたかて, tu as beau dire"},
    "もうた": {"en": "(Kansai) = しまった: 〜てもうた, it's gone and happened, it's done",
              "fr": "(Kansai) = しまった : 〜てもうた, c'est arrivé, c'est fait"},
    "ちゃう": {"en": "(Kansai) = 違う: no!, it isn't (犬ちゃう, it's not a dog)",
              "fr": "(Kansai) = 違う : non !, ce n'est pas (犬ちゃう, ce n'est pas un chien)"},
    "あかん": {"en": "(Kansai) no good, mustn't (= だめ): しとったらあかん, you mustn't be doing that",
              "fr": "(Kansai) pas bien, il ne faut pas (= だめ) : しとったらあかん, tu ne dois pas faire ça"},
    "べ": {"en": "(eastern and northern speech) surely, I think, let's (= だろう, よう)",
          "fr": "(parlers de l'Est et du Nord) sûrement, je pense, allons (= だろう, よう)"},
    "なして": {"en": "(north, Hokkaido) why? (= どうして)", "fr": "(Nord, Hokkaidō) pourquoi ? (= どうして)"},
    "っしゃ": {"en": "(Tōhoku) closes a question or a remark softly (≈ ね, よ)",
              "fr": "(Tōhoku) clôt doucement une question ou une remarque (≈ ね, よ)"},
    "んだんだ": {"en": "(Tōhoku) that's right, yes yes (= そうだそうだ)", "fr": "(Tōhoku) c'est ça, oui oui (= そうだそうだ)"},
    "さ_ni": {"en": "(Tōhoku) to, toward (= に, へ): 孫さ会える, to meet the grandchild",
             "fr": "(Tōhoku) à, vers (= に, へ) : 孫さ会える, voir son petit-enfant"},
    "けろ": {"en": "(Tōhoku) = くれ: 言ってけろ, tell me", "fr": "(Tōhoku) = くれ : 言ってけろ, dis-le-moi"},
    "からっ": {"en": "(辛い cut short, a cry) so spicy!", "fr": "(辛い écourté, une exclamation) que c'est épicé !"},
    "い_dai": {"en": "(after だ, with a question word) asks warmly or gruffly: 何をお探しだい？, what are you after?",
              "fr": "(après だ, avec un mot interrogatif) demande avec chaleur ou rudesse : 何をお探しだい？, que cherchez-vous ?"},
    "は_te": {"en": "(after 〜て, then another doing) each time …: 確かめてはため息をつく, checks it again and again, sighing",
             "fr": "(après 〜て, puis une autre action) chaque fois que … : 確かめてはため息をつく, vérifier encore et encore en soupirant"},
    "つった": {"en": "(rough) って言った said short: なんつった, what did you say?",
              "fr": "(familier, rude) って言った abrégé : なんつった, qu'est-ce que t'as dit ?"},
    "かけ_piece": {"en": "(counter) a piece, a knob: 生姜1かけ, a knob of ginger; にんにく1かけ, a clove of garlic",
                  "fr": "(compteur) un morceau : 生姜1かけ, un morceau de gingembre ; にんにく1かけ, une gousse d'ail"},
    "おや": {"en": "oh?, well!: mild surprise", "fr": "tiens !, oh ? : une légère surprise"},
    "ちっ": {"en": "tch!: a click of the tongue, annoyance", "fr": "tss ! : un claquement de langue, l'agacement"},
    "むっと": {"en": "(of heat or a smell) stifling, stuffy; (of a person) offended, sulky",
              "fr": "(chaleur, odeur) étouffant, lourd ; (personne) vexé, renfrogné"},
    "アリ_ok": {"en": "(slang) acceptable, a fair option: 十分アリだ, it's quite OK",
               "fr": "(argot) acceptable, envisageable : 十分アリだ, ça se tient tout à fait"},
    "おくれ": {"en": "(after 〜て, old or gentle) please … for me (= 〜てくれ): 運んでおくれ, carry it for me",
              "fr": "(après 〜て, ancien ou tendre) … pour moi, s'il te plaît (= 〜てくれ) : 運んでおくれ, porte-le pour moi"},
    "草_lol": {"en": "(net slang) lol: laughter, whose ｗｗｗ look like grass",
              "fr": "(argot du web) mdr : le rire, dont les ｗｗｗ ressemblent à de l'herbe"},
}

# The letters a laugh is typed with: www, ｗｗｗ.
_LAUGH = frozenset("wｗWＷ")


def _a_laugh(surface: str) -> bool:
    return len(surface) >= 2 and all(c in _LAUGH for c in surface)


def _a_laugh_said(surface: str) -> bool:
    """A laugh written out: ふっふっふ, ははは, えへへ, うふふ (plan 272) --
    one sound said over, after one vowel at most."""
    s = "".join(c for c in surface if c not in "っッーー〜～")
    if s[:1] in ("え", "う", "あ", "い", "お") and len(s) >= 3:
        s = s[1:]
    return len(s) >= 2 and len(set(s)) == 1 and s[0] in "ふはへひくほ"


# The な-adjectives of manner said with と (analysis.TO_MANNER).
_TO_MANNER = frozenset({"意外", "案外", "平然", "漠然", "毅然", "呆然", "唖然", "悠然", "颯爽", "歴然", "断然",
                          "公然", "決然", "整然", "雑然", "騒然", "愕然", "泰然", "超然", "敢然", "漫然", "黙然",
                          "茫然", "憤然", "釈然", "厳然", "粛然", "猛然", "忽然"})


def _from_not_than(morphemes, i: int) -> bool:
    from study.card_lookup import _from_not_than as from_not_than

    return from_not_than(morphemes, i)


# The states お忙しいところ, お疲れのところ say a request is made in.
_BUSY = frozenset({"忙しい", "お忙しい", "疲れ", "お疲れ", "急ぎ", "お急ぎ", "休み", "お休み", "取り込み", "お取り込み"})


# What ところ says "the truth of it" after (plan 272): 正直なところ, 実のところ.
_TRUTH = frozenset({"正直", "実", "本当", "ほんとう", "ほんと"})


def truth_tokoro(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the ところ of 正直なところ, 実のところ,
    本当のところ -- "the truth of the matter", no "place" (plan 272)."""
    if morphemes[i].surface not in ("ところ", "所") or i < 2:
        return False
    return morphemes[i - 1].surface in ("な", "の") and morphemes[i - 2].surface in _TRUTH


def answering_yes(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the ああ that answers a question just
    asked (plan 272): 「まだ起きてる？」「ああ、なんか眠れなくて」 is
    "yeah", no "alas"."""
    m = morphemes[i]
    if m.pos != "interjection" or m.surface not in ("ああ", "あぁ", "あー"):
        return False
    k = i - 1
    while k >= 0 and morphemes[k].surface in ("「", "」", "『", "』"):
        k -= 1
    return k >= 0 and morphemes[k].surface in ("？", "?")


def no_card_here(morphemes, i: int) -> bool:
    """Whether morphemes[i] is a word a set phrase or the talk around it
    says, which its card would mislead on (plan 272): お忙しいところ,
    正直なところ, ああ answering."""
    return busy_tokoro(morphemes, i) or truth_tokoro(morphemes, i) or answering_yes(morphemes, i)


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
    if len(surface) == 4 and surface.endswith(("りん", "リン", "るん", "ルン")) and pos == "adverb":
        return True                     # くるりん, ころりん, ぷるるん (plan 272)
    return len(surface) == 3 and surface[-1] == "リ" and all("\u30a1" <= c <= "\u30fc" for c in surface)


def _rest_at(morphemes, i: int):
    """(index, morpheme) for what follows morphemes[i]."""
    return [(k, morphemes[k]) for k in range(i + 1, len(morphemes))]


def laughter_typed(morphemes, i: int) -> bool:
    """Whether morphemes[i] is a laugh typed after what is said (plan
    272): 笑 or 草 that ends the line (知ってんの笑, 後ろの猫があくびしてて
    草), or ｗｗｗ."""
    m = morphemes[i]
    if _a_laugh(m.surface):
        return True
    if m.surface not in ("笑", "草") or i == 0:
        return False
    after = morphemes[i + 1:]
    if not all(u.pos == "symbol" or _a_laugh(u.surface) for u in after):
        return False
    prev = morphemes[i - 1]
    if m.surface == "笑":
        return prev.pos != "symbol" or prev.surface in "？！?!"
    # 草 after a word that is no noun's (庭の草, 庭に草): で草, は草,
    # さすがに草, してて草.
    return (prev.surface in ("で", "は", "も") and prev.pos == "particle") or prev.conjunctive \
        or (prev.surface == "に" and i >= 2 and morphemes[i - 2].surface == "さすが")


def net_laughter(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the 草 of net slang, "lol" (plan 272): one
    a typed laugh follows (それはさすがに草www), or 生える or 不可避 (草生える,
    草不可避) -- never the grass of 庭の草. The card is then no word of
    the sentence."""
    if morphemes[i].surface not in ("草", "くさ", "笑"):
        return False
    if laughter_typed(morphemes, i):
        return True
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    return morphemes[i].surface != "笑" and nxt is not None and (
        _a_laugh(nxt.surface) or nxt.lemma in ("生える", "はえる") or nxt.surface.startswith("不可避"))

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
    elif m.pos == "particle" and m.surface == "ん" and i > 0 and morphemes[i - 1].surface == "なら":
        key = "ん"                          # 聞き捨てならん: ならない (plan 272)
    elif m.pos == "adverb" and m.surface in ("マジで", "まじで"):
        key = "まじで"
    elif m.pos == "conjunction" and m.surface in ("てか", "ってか"):
        key = "てか"
    elif m.surface in ("やん", "やんか") and m.pos == "particle":
        key = "やん"                        # (Kansai, plan 272)
    elif m.pos == "auxiliary" and m.lemma == "よる":
        key = "よる_progressive"            # なにしよるん (plan 272)
    elif m.surface == "かて" and m.pos == "particle":
        key = "かて"
    elif m.surface == "もうた":
        key = "もうた"                       # 決まってもうた
    elif m.surface == "ん" and m.pos == "particle" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "や" \
            and i > 0 and morphemes[i - 1].pos in ("verb", "auxiliary", "adjective", "noun"):
        key = "ん_no"                        # もうたんやし: んだ (plan 272)
    elif m.surface == "ちゃう" and _kansai_chau(morphemes, i):
        key = "ちゃう"                       # ちゃうちゃう, 犬ちゃうねん
    elif m.surface == "あかん":
        key = "あかん"
    elif m.surface == "べ" and m.pos == "particle" and closes_sentence(morphemes, i):
        key = "べ"                           # そう思うべ, 楽しみだべ
    elif m.surface in ("なして", "っしゃ", "んだんだ"):
        key = m.surface
    elif m.surface == "さ" and m.pos == "particle" and i > 0 and morphemes[i - 1].pos in ("noun", "pronoun") \
            and i + 1 < len(morphemes) and morphemes[i + 1].pos == "verb":
        key = "さ_ni"                        # 孫さ会える
    elif m.surface == "てけろ":
        key = "けろ"
    elif m.surface == "で" and m.pos == "particle" and i > 0 and _kansai_yo(morphemes, i):
        key = "で_yo"                        # 千円やで, あかんで
    elif busy_tokoro(morphemes, i):
        key = "ところ_while"
    elif truth_tokoro(morphemes, i):
        key = "ところ_truth"
    elif answering_yes(morphemes, i):
        key = "ああ_yes"
    elif m.pos == "particle" and m.surface == "だけ" and i > 0 and morphemes[i - 1].surface == "数":
        key = "だけ_as_many"
    elif m.pos == "particle" and m.surface == "より" and _from_not_than(morphemes, i):
        key = "より_from"
    elif m.pos == "particle" and m.surface == "にて":
        key = "にて"
    elif m.lemma == "御座る" or m.surface in ("ござる", "ござら", "ござり", "ござれ"):
        key = "ござる"                      # (old speech, plan 272)
    elif m.surface == "それがし" and m.pos == "pronoun":
        key = "それがし"
    elif m.pos == "particle" and m.surface == "や" and i > 0 and morphemes[i - 1].surface in ("必ず", "いざ"):
        key = "や_surely"
    elif m.surface == "笑" and laughter_typed(morphemes, i):
        key = "笑"
    elif m.surface in ("けえ", "けん", "がね", "っちゃ", "っぺ", "てちょう", "てけらいん", "らん", "てん", "どこう", "んで",
                       "のん") and m.pos in ("particle", "auxiliary", "suffix"):
        key = m.surface                     # (dialect and speech, plan 272)
    elif m.surface in ("なーんだ", "へへっ", "じゃけえ", "どえりゃあ", "いぎなり",
                       "おばんです", "ずんだ", "わしゃ") and m.pos in ("noun", "interjection", "adverb", "conjunction",
                                                                    "pronoun"):
        key = m.surface                     # (slang and dialect, plan 272)
    elif m.lemma in ("じゃけえ", "てちょう"):
        key = m.lemma                       # ほいじゃけえ; 持ってちょう
    elif m.surface in ("て", "で") and m.conjunctive and i + 1 < len(morphemes) and morphemes[i + 1].lemma in ("見せる", "みせる"):
        key = "て_miseru"                    # 果たしてみせよう (plan 272)
    elif m.surface == "て" and m.pos == "particle" and i >= 1 and morphemes[i - 1].surface in ("なん", "何") \
            and i + 1 < len(morphemes) and morphemes[i + 1].lemma in ("言う", "いう"):
        key = "て_quote"                     # なんていうか (plan 272)
    elif m.surface == "て" and m.pos == "particle" and i >= 3 and morphemes[i - 1].lemma == "為る" \
            and morphemes[i - 1].surface == "し" and morphemes[i - 2].surface == "と" and morphemes[i - 2].pos == "particle" \
            and morphemes[i - 3].pos in ("verb", "auxiliary") and morphemes[i - 3].cform.startswith(("終止形", "連体形")):
        key = "て_toshite"                   # だまし取ったとして、逮捕 (plan 272)
    elif m.surface in ("からっ", "辛っ") and i + 1 < len(morphemes) and morphemes[i + 1].pos == "symbol":
        key = "からっ"                       # うわ、からっ！ (plan 272)
    elif m.surface == "い" and m.pos == "particle" and i > 0 and morphemes[i - 1].surface == "だ" \
            and closes_sentence(morphemes, i):
        key = "い_dai"                       # 何をお探しだい？ (plan 272)
    elif m.surface == "は" and m.pos == "particle" and i > 0 and morphemes[i - 1].conjunctive \
            and morphemes[i - 1].surface in ("て", "で") and not _negative_ahead(morphemes, i) \
            and i + 1 < len(morphemes) and morphemes[i + 1].pos in ("noun", "verb") \
            and morphemes[i + 1].surface not in ("だめ", "駄目", "ダメ", "いや", "嫌"):
        key = "は_te"                        # 確かめては ため息ついた (plan 272)
    elif m.surface.startswith("つっ") and m.lemma == "つう":
        key = "つった"                       # なんつった (plan 272)
    elif m.surface == "かけ" and i > 0 and _numeral_like(morphemes[i - 1].surface):
        key = "かけ_piece"                   # 生姜1かけ (plan 272)
    elif m.surface == "と" and m.pos == "particle" and i > 0 and morphemes[i - 1].pos == "verb" \
            and morphemes[i - 1].cform.startswith("連用形") \
            and i + 1 < len(morphemes) and morphemes[i + 1].lemma in ("成る", "なる"):
        key = "と_naru"                      # 切り離しとなります: a verb's stem as a noun (plan 272)
    elif m.surface in ("おや", "おやおや", "ちっ") and _opens(morphemes, i):
        key = "おや" if m.surface.startswith("おや") else "ちっ"   # (plan 272)
    elif m.surface == "むっと" and m.pos == "adverb":
        key = "むっと"
    elif m.surface == "アリ" and i + 1 < len(morphemes) and _is_copula_token(morphemes[i + 1]):
        key = "アリ_ok"                      # 十分アリだと思う (plan 272)
    elif m.surface == "おくれ" and m.pos == "verb" and i > 0 and morphemes[i - 1].surface in ("て", "で") \
            and morphemes[i - 1].conjunctive:
        key = "おくれ"                       # 運んでおくれ (plan 272)
    elif m.surface.startswith("ウケ") and m.pos == "verb":
        key = "ウケる"
    elif m.surface == "ワン" and i + 1 < len(morphemes) and morphemes[i + 1].start == m.end \
            and any("\u30a1" <= c <= "\u30fa" for c in morphemes[i + 1].surface):
        key = "ワン_one"
    elif m.pos == "auxiliary" and m.lemma == "とる":
        key = "とる"
    elif m.pos == "particle" and m.surface == "じゃ" and i > 0 and morphemes[i - 1].pos in ("noun", "pronoun") \
            and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in "。！!" or (
                morphemes[i + 1].surface in ("、", "，") and i + 2 < len(morphemes)
                and morphemes[i + 2].surface == morphemes[i - 1].surface)):
        key = "じゃ_da"                     # まずは飯じゃ、飯！ (plan 272), never おにぎりじゃ、どっち
    elif m.pos == "particle" and m.surface == "に" and i > 0 and morphemes[i - 1].pos == "adverb" \
            and morphemes[i - 1].surface not in ("ちょう", "すぐ", "まさ", "非常", "特", "主"):
        key = "に_sound"                    # べこべこに, さすがに (plan 272)
    elif m.pos == "particle" and m.surface == "は" and i > 0 and morphemes[i - 1].pos == "adjective" \
            and morphemes[i - 1].surface.endswith("く"):
        key = "は_after_ku"                 # 正しくは (plan 272)
    elif m.pos == "auxiliary" and m.surface == "で" and i > 0 and morphemes[i - 1].surface == "まま" \
            and i + 1 < len(morphemes) and morphemes[i + 1].lemma in ("居る", "いる"):
        key = "で_mama"
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
    elif m.pos == "auxiliary" and m.lemma == "や" and m.surface in ("やろ", "やろう") and m.cform.startswith("意志推量形"):
        key = "やろ"                        # ちゃうやろ？ (plan 272)
    elif m.pos == "auxiliary" and m.surface == "や" and m.lemma == "や" and i > 0 \
            and (morphemes[i - 1].cform.startswith("連用形") or morphemes[i - 1].surface == "とき") \
            and (i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol"):
        key = "や_order"                    # 気ぃつけて帰りや, 返しときや (plan 272)
    elif m.surface in ("ほんまに", "ホンマに") and m.pos == "adverb":
        key = "ほんまに"
    elif m.surface in ("そんなん", "こんなん", "あんなん") and m.pos in ("noun", "pronoun"):
        key = "そんなん"
    elif m.pos == "auxiliary" and m.surface == "れ" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "へん":
        key = "れ_can"                      # 歩かれへん (plan 272)
    elif m.surface in ("て", "で") and m.pos == "particle" and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface == "へん":
        key = "て_hen"                      # 聞いてへん (plan 272)
    elif m.surface == "や" and (m.pos == "auxiliary" and m.lemma == "や" or (
            m.pos in ("particle", "suffix") and i > 0 and morphemes[i - 1].pos in ("noun", "pronoun", "suffix")
            and i + 1 < len(morphemes) and morphemes[i + 1].surface in ("と", "で") and _ends_or_breaks(morphemes, i + 1)
            or m.pos in ("particle", "suffix") and i > 0 and morphemes[i - 1].surface in ("なんぼ", "何ぼ"))) and (
            i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol"
            or morphemes[i + 1].surface in ("ねん", "ん", "で", "な", "なあ", "ねえ", "から", "けど", "し", "のに", "ろ", "わ",
                                            "と")):
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
    elif m.pos == "interjection" and _a_laugh_said(m.surface):
        key = "laugh_said"                  # ふっふっふ, えへへ (plan 272)
    elif m.pos == "interjection" and m.surface in ("おう", "おうっ", "おお"):
        key = "おう"                        # おう、リン！ (plan 272)
    elif m.pos == "interjection" and m.surface == "あれ":
        key = "あれ_huh"                    # あれ、今日って何曜日だっけ？ (plan 272)
    elif m.pos == "interjection" and m.surface in ("あ", "あっ") and i + 1 < len(morphemes) \
            and morphemes[i + 1].pos == "symbol":
        key = "あ_oh"                       # …あ、じゃあカードで (plan 272)
    elif len(m.surface) == 1 and i + 2 < len(morphemes) and morphemes[i + 1].surface in ("、", "，", "…") \
            and morphemes[i + 2].surface.startswith(m.surface) and len(morphemes[i + 2].surface) > 1 \
            and _opens(morphemes, i):
        key = "stammer"                     # ど、どうしましょう (plan 272)
    elif m.pos == "auxiliary" and m.surface == "ませ" and m.cform.startswith("命令形"):
        key = "ませ"                        # お申し付けくださいませ (plan 272)
    elif m.pos == "particle" and m.surface == "と" and i > 0 \
            and morphemes[i - 1].pos in ("verb", "adjective", "auxiliary") \
            and morphemes[i - 1].cform.startswith(("終止形", "連体形")) \
            and (i + 1 >= len(morphemes) or (morphemes[i + 1].pos == "symbol" and morphemes[i + 1].surface in "。！？!?…」")):
        key = "と_end"                      # 進むしかないと。 (plan 272)
    elif m.pos == "auxiliary" and m.surface == "で" and m.lemma == "だ" and i + 2 < len(morphemes) \
            and morphemes[i + 1].surface in ("は", "も") and morphemes[i + 2].lemma in ("有る", "ある", "無い", "ない"):
        key = "で_aru"                      # ものではあるまい (plan 272)
    elif m.pos == "particle" and m.surface == "は" and i >= 1 and i + 1 < len(morphemes) \
            and morphemes[i - 1].surface == "で" and morphemes[i - 1].lemma == "だ" \
            and morphemes[i + 1].lemma in ("有る", "ある", "無い", "ない"):
        key = "は_dewa"
    elif m.pos == "particle" and m.surface == "に" and i >= 1 and i + 1 < len(morphemes) \
            and morphemes[i - 1].pos == "verb" and morphemes[i - 1].cform.startswith(("終止形", "連体形")) \
            and morphemes[i + 1].surface == "は" and i + 2 < len(morphemes) and morphemes[i + 2].surface in ("、", "，"):
        key = "に_purpose"                  # 信頼を取り戻すには、 (plan 272)
    elif m.pos == "particle" and m.surface == "も" and i >= 1 and morphemes[i - 1].surface == "より" \
            and morphemes[i - 1].pos == "particle":
        key = "も_yori"                     # 言葉を尽くすよりも (plan 272)
    elif m.pos == "particle" and m.surface == "や" and i >= 1 and morphemes[i - 1].surface in ("て", "で") \
            and morphemes[i - 1].conjunctive \
            and (i + 1 >= len(morphemes) or (morphemes[i + 1].pos == "symbol" and morphemes[i + 1].surface in "。！？!?…")):
        key = "や_yo"                       # もうちょっとおってや (plan 272)
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
            and morphemes[i - 1].surface in ("だろう", "だろ", "でしょう", "でしょ", "じゃろう", "じゃろ") \
            and i + 1 < len(morphemes) and (morphemes[i + 1].surface in ("！", "!") or (
                # (the west's じゃろうが。 insists too, where だろうが。 is "though")
                morphemes[i + 1].surface == "。" and morphemes[i - 1].surface.startswith("じゃろ"))):
        key = "が_insist"                  # 見りゃ分かるだろうが！, 言うたじゃろうが。
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
            and i > 0 and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in ("、", "，", ",", "\u3000", " ")
                           # (before a filler said on it: 反抗期でさ、, plan 272)
                           or (morphemes[i + 1].pos == "particle" and morphemes[i + 1].surface in ("さ", "ね", "ねえ", "な")
                               and i + 2 < len(morphemes) and morphemes[i + 2].surface in ("、", "，", "…"))
                           or (morphemes[i - 1].pos in ("noun", "suffix", "other")
                               and morphemes[i + 1].pos in ("verb", "adjective")
                               and morphemes[i + 1].lemma not in ("無い", "ない"))):
        key = "で_copula"                   # 残業続きで、, 48.6％で、, ひとりぼっちで ないて
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
            and (i + 1 >= len(morphemes) or morphemes[i + 1].surface in ("\u3000", " ", "、", "，", "！", "!")
                 or morphemes[i + 1].start > m.end):
        key = "よ_call"                     # 儚き夢よ　いずこへ, 風よ 運んでおくれ (plan 272)
    elif m.pos == "particle" and m.surface == "は" and i > 0 and i + 2 < len(morphemes) \
            and morphemes[i - 1].pos in ("verb", "auxiliary") and morphemes[i - 1].cform.startswith("連用形") \
            and morphemes[i + 1].lemma in ("為る", "する") and morphemes[i + 2].lemma in ("ない", "無い", "ぬ", "ず"):
        key = "は_stress"                   # 止められはしない
    elif m.pos == "particle" and m.surface == "も" and i > 0 and i + 2 < len(morphemes) \
            and morphemes[i - 1].pos == "verb" and morphemes[i - 1].cform.startswith("連用形") \
            and morphemes[i + 1].lemma in ("為る", "する") and morphemes[i + 2].lemma in ("ない", "無い", "ぬ", "ず"):
        key = "も_even"                     # 謝りもしなかった (plan 272)
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
        elif (m.surface == "の" or (m.surface == "ん" and m.pos == "particle" and i > 0
                                     and not morphemes[i - 1].cform.startswith("未然形")
                                     and morphemes[i - 1].surface != "なら")) \
                and _after_a_predicate(morphemes, i) and closes_sentence(morphemes, i):
            key = "の_explain"              # 好きだったの。, どうしたの？ (and the west's どないしたん？)
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
                and morphemes[i - 1].pos in ("verb", "auxiliary", "adjective") \
                and all(u.pos == "symbol" or laughter_typed(morphemes, k) for k, u in _rest_at(morphemes, i)) \
                and (_closes(morphemes, i) or any(laughter_typed(morphemes, k) for k, _u in _rest_at(morphemes, i))):
            key = "て_trailing"                # (and before a typed laugh: あくびしてて草, plan 272)
        elif m.surface == "に":
            from study.grammar_detect import adverbial_ni
            if adverbial_ni(morphemes, i):
                noun = morphemes[i - 1].surface
                if noun in _ADVERBS:
                    en, fr = _ADVERBS[noun]
                    return {"en": f"makes an adverb of {noun}: {noun}に, {en}",
                            "fr": f"fait un adverbe de {noun} : {noun}に, {fr}"}
                key = "に_adverb"
        # (plan 272: what the gap report left silent, each by the word
        # before it)
        elif m.surface == "は" and i > 0 and (
                (morphemes[i - 1].pos == "particle" and morphemes[i - 1].surface in ("で", "に", "と", "から", "まで",
                                                                                   "へ", "より"))
                or (morphemes[i - 1].pos == "auxiliary" and morphemes[i - 1].surface == "に")):
            key = "は_after_particle"         # 仕事では, 簡単には, 課長の話では
        elif m.surface == "は" and i > 0 and morphemes[i - 1].conjunctive and morphemes[i - 1].surface in ("て", "で") \
                and _negative_ahead(morphemes, i):
            key = "は_te_negative"            # 育ってはくれない, まだ決まってはおりません
        elif m.surface == "の" and _subject_no(morphemes, i):
            key = "の_subject"                # 花粉の飛ぶ量, 持ち主のわからない荷物
        elif m.surface == "まで" and i > 0 and ((morphemes[i - 1].surface == "に" and morphemes[i - 1].pos == "particle")
                                              or (i + 1 < len(morphemes) and morphemes[i + 1].surface == "も"
                                                  and morphemes[i + 1].pos == "particle")):
            key = "まで_even"                 # 親の預金にまで手をつける, 老舗までもが
        elif m.surface == "まで" and i > 0 and morphemes[i - 1].pos in ("noun", "pronoun", "suffix", "adverb"):
            key = "まで_upto"                 # 最後まで残れますか, どのくらいまで
        elif m.surface in ("て", "で") and m.conjunctive and i > 0 \
                and (morphemes[i - 1].pos in ("verb", "auxiliary", "adjective")
                     or (morphemes[i - 1].pos == "suffix" and morphemes[i - 1].surface.endswith("く"))):
            key = "て_form"                   # 借りてまでして, 水っぽくて
    return dict(_GLOSSES[key]) if key else None


def _kansai_chau(morphemes, i: int) -> bool:
    """Whether ちゃう is the west's 違う, "no!" -- opening what is said or
    after a noun -- never 〜てしまう said short after a verb (plan 272)."""
    prev = morphemes[i - 1] if i > 0 else None
    return prev is None or prev.pos in ("symbol", "noun", "pronoun") or prev.surface == "ちゃう"


def _kansai_yo(morphemes, i: int) -> bool:
    """Whether で closes what is said after the west's や or あかん, its
    よ (plan 272): 千円やで, あかんで."""
    return morphemes[i - 1].surface in ("や", "あかん") and _ends_or_breaks(morphemes, i)


def _ends_or_breaks(morphemes, i: int) -> bool:
    """Whether a mark follows morphemes[i], or nothing but particles to
    its sentence's end: 千円やで、千円！"""
    return (i + 1 < len(morphemes) and morphemes[i + 1].pos == "symbol") or closes_sentence(morphemes, i)


def _numeral_like(surface: str) -> bool:
    return bool(surface) and all(c in "0123456789０１２３４５６７８９一二三四五六七八九十" for c in surface)


def _is_copula_token(m) -> bool:
    return m.pos == "auxiliary" and m.lemma in ("だ", "です")


def _subject_no(morphemes, i: int) -> bool:
    from study.grammar_detect import subject_no
    return subject_no(morphemes, morphemes[i].start)


def _negative_ahead(morphemes, i: int) -> bool:
    """Whether a negative closes the clause after morphemes[i]."""
    for u in morphemes[i + 1:]:
        if u.pos == "symbol" or (u.pos == "particle" and u.conjunctive and u.surface not in ("て", "で")):
            return False
        if u.lemma in ("ない", "無い", "ず", "ぬ") and u.pos in ("auxiliary", "adjective"):
            return True
    return False


def _quoting(morphemes, i: int) -> str:
    """Which って this is: one that quotes (食べ放題って言っても), names a
    topic (あれって本当に), or closes the sentence on what was heard
    (彼氏できたんだって) -- or, where the sentence does not say, both."""
    rest = [m for m in _rest(morphemes, i) if m.pos != "symbol" or m.surface not in "　 "]
    nxt = rest[0] if rest else None
    if nxt is not None and nxt.pos == "verb" and nxt.lemma in _SAYING:
        return "って_quote"
    # (its own sentence, whatever follows it: 寝坊したんだって。ほんと…,
    # plan 272)
    if closes_sentence(morphemes, i) and i > 0 and morphemes[i - 1].cform.startswith("命令形"):
        return "って_insist"              # 早く願い事しろって！ (plan 272)
    if closes_sentence(morphemes, i):
        return "って_end"
    prev = morphemes[i - 1]
    from study.grammar_detect import _SAID_NOUNS
    if nxt is not None and nxt.pos == "noun" and nxt.surface in _SAID_NOUNS and nxt.start == morphemes[i].end:
        return "って_iu"                  # 行かないってこと, 田中って人 (plan 272)
    if prev.pos in ("noun", "pronoun", "suffix") and nxt is not None and (
            nxt.pos not in ("particle", "symbol") or nxt.surface in ("、", "，")):
        return "って_topic"               # (それって、つまり… plan 272)
    return "って"
