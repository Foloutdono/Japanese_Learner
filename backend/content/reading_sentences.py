"""
Hand-written reading-practice sentences, one bank per JLPT level.

── Why this file exists ──────────────────────────────────────
Reading practice drew its sentences from the JMdict/Tatoeba examples
attached to each vocab word, filtered only by "does this sentence use
kanji above the level". Measured over ~650 candidate sentences per level
with study/difficulty's full gate (kanji + grammar + length):

    N5   24 of 666 usable   (3.6%)
    N4   61 of 642          (9.5%)
    N3  244 of 628          (39%)
    N2  288 of 568          (51%)
    N1  511 of 565          (90%)

Tatoeba is a bilingual corpus, not a syllabus. Its sentences are written
by adults for adults, so the further down the levels you go the less of
it is reachable -- and with 24 usable sentences the N5 picker had no
choice but to keep serving the ones that only LOOKED N5 because they
happened to be spelled in easy kanji (〜ようとする, 〜んです, and a
memorable one about an itch).

These are written for the syllabus instead. Every entry names the grammar
point it demonstrates, and the point is checked against
content/grammar_points.json at import (see validate()) rather than
trusted -- a sentence claiming a point it does not use would teach the
wrong thing to anyone reading the label.

── The rules each sentence follows ───────────────────────────
Enforced by tests/test_reading_sentences.py, which runs the whole bank
through study/difficulty.report:

  * every kanji is in the level's cumulative set
  * no grammar point above the level appears
  * every word the app's vocab deck knows is learnable at or below it
  * within the level's length cap (N5 26 chars, up to N1 80)
  * `grammar` names a real point AT that level, and the sentence
    verifiably contains it

── Shape ─────────────────────────────────────────────────────
    {"jp": ..., "en": ..., "grammar": "<pattern>", "focus": "<word>"}

`focus` is the word the sentence is built around -- reading.py reports it
as the phrase's headword so the "look this up" affordance has something
to look up, the same field a Tatoeba-sourced phrase gets from the vocab
entry it hung off.
"""
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL

# ── N5 ────────────────────────────────────────────────────────
# 103 kanji, present/past polite, the core particles, and the first
# conditional-free half of the syllabus. Sentences stay concrete and
# everyday: at this level a reader is decoding, and an abstract sentence
# costs them the whole working-memory budget before the grammar lands.
N5 = [
    {"jp": "わたしは学生です。", "en": "I am a student.", "grammar": "です／だ", "focus": "学生"},
    {"jp": "毎日、水を飲みます。", "en": "I drink water every day.", "grammar": "を", "focus": "毎日"},
    {"jp": "七時に学校へ行きます。", "en": "I go to school at seven.", "grammar": "に", "focus": "学校"},
    {"jp": "駅で友だちに会います。", "en": "I meet a friend at the station.", "grammar": "で", "focus": "駅"},
    {"jp": "父と母は今、外にいます。", "en": "My father and mother are outside right now.", "grammar": "と", "focus": "外"},
    {"jp": "わたしも魚を買います。", "en": "I will buy fish too.", "grammar": "も", "focus": "魚"},
    {"jp": "これはわたしの本です。", "en": "This is my book.", "grammar": "の", "focus": "本"},
    {"jp": "九時から五時まで会社にいます。", "en": "I am at the office from nine to five.", "grammar": "から〜まで", "focus": "会社"},
    {"jp": "今日は学校へ行きません。", "en": "I am not going to school today.", "grammar": "〜ます／〜ません", "focus": "今日"},
    {"jp": "きのう、新しい車を買いました。", "en": "I bought a new car yesterday.", "grammar": "〜ました／〜ませんでした", "focus": "車"},
    {"jp": "きれいな花を見たいです。", "en": "I want to see the pretty flowers.", "grammar": "〜たいです", "focus": "花"},
    {"jp": "この本を読んでください。", "en": "Please read this book.", "grammar": "〜てください", "focus": "読む"},
    {"jp": "母は今、テレビを見ています。", "en": "My mother is watching television right now.", "grammar": "〜ています", "focus": "母"},
    {"jp": "少し休んでもいいですか。", "en": "May I rest a little?", "grammar": "〜てもいいです", "focus": "休む"},
    {"jp": "ここで話してはいけません。", "en": "You must not talk here.", "grammar": "〜てはいけません", "focus": "話す"},
    {"jp": "日よう日に来ることができます。", "en": "I can come on Sunday.", "grammar": "〜ことができます", "focus": "来る"},
    {"jp": "ここに車を入れないでください。", "en": "Please do not bring a car in here.", "grammar": "〜ないでください", "focus": "入れる"},
    {"jp": "毎日、名前を書かなければなりません。", "en": "I have to write my name every day.", "grammar": "〜なければなりません", "focus": "名前"},
    {"jp": "本や新聞を買いました。", "en": "I bought books, newspapers and so on.", "grammar": "や", "focus": "新聞"},
    {"jp": "今日はいい天気ですね。", "en": "The weather is nice today, isn't it?", "grammar": "ね", "focus": "天気"},
    {"jp": "あの店は安いですよ。", "en": "That shop is cheap, you know.", "grammar": "よ", "focus": "店"},
    {"jp": "時間がないから、行きません。", "en": "I am not going, because there is no time.", "grammar": "〜から", "focus": "時間"},
    {"jp": "いっしょに魚を食べませんか。", "en": "Won't you eat fish with me?", "grammar": "〜ませんか", "focus": "食べる"},
    {"jp": "五時に駅の前で会いましょう。", "en": "Let's meet in front of the station at five.", "grammar": "〜ましょう", "focus": "前"},
    {"jp": "電気をつけましょうか。", "en": "Shall I turn on the light?", "grammar": "〜ましょうか", "focus": "電気"},
    {"jp": "山の上に大きい木があります。", "en": "There is a big tree on top of the mountain.", "grammar": "〜があります／います", "focus": "木"},
    {"jp": "この店は新しくて安いです。", "en": "This shop is new and cheap.", "grammar": "〜くて／〜で", "focus": "新しい"},
    {"jp": "子どもは大きくなりました。", "en": "The children have grown big.", "grammar": "〜くなる／〜になる", "focus": "子ども"},
    {"jp": "車より電車のほうが安いです。", "en": "The train is cheaper than the car.", "grammar": "〜より〜のほうが", "focus": "電車"},
    {"jp": "この店で、この本がいちばん高いです。", "en": "In this shop, this book is the most expensive.", "grammar": "〜で〜がいちばん", "focus": "高い"},
    {"jp": "今日は休んだほうがいいです。", "en": "You had better rest today.", "grammar": "〜ほうがいいです", "focus": "休む"},
    {"jp": "今日は来なくてもいいです。", "en": "You don't have to come today.", "grammar": "〜なくてもいいです", "focus": "来る"},
    {"jp": "ごはんを食べてから、本を読みます。", "en": "After eating, I read a book.", "grammar": "〜てから", "focus": "ごはん"},
    {"jp": "休むまえに、水を飲みます。", "en": "Before resting, I drink water.", "grammar": "〜まえに", "focus": "水"},
    {"jp": "学校のあとで、友だちと会います。", "en": "After school, I meet a friend.", "grammar": "〜あとで", "focus": "友だち"},
    {"jp": "小さいとき、山によく行きました。", "en": "When I was small, I often went to the mountains.", "grammar": "〜とき", "focus": "小さい"},
    {"jp": "わたしは毎週、電車で来ます。", "en": "I come by train every week.", "grammar": "で", "focus": "毎週"},
    {"jp": "その白い花はきれいですね。", "en": "That white flower is pretty, isn't it?", "grammar": "ね", "focus": "白い"},
    {"jp": "男の人が三人、店の中にいます。", "en": "There are three men inside the shop.", "grammar": "〜があります／います", "focus": "人"},
    {"jp": "先生の話を聞きました。", "en": "I listened to the teacher's talk.", "grammar": "〜ました／〜ませんでした", "focus": "先生"},
    {"jp": "この道をまっすぐ行ってください。", "en": "Please go straight along this road.", "grammar": "〜てください", "focus": "道"},
    {"jp": "土よう日に友だちと山へ行きます。", "en": "On Saturday I go to the mountains with a friend.", "grammar": "へ", "focus": "山"},
    {"jp": "何を買いたいですか。", "en": "What do you want to buy?", "grammar": "〜たいです", "focus": "買う"},
    {"jp": "外は雨です。今日は出ません。", "en": "It is raining outside. I am not going out today.", "grammar": "〜ます／〜ません", "focus": "雨"},
    {"jp": "六時に会社を出ました。", "en": "I left the office at six.", "grammar": "を", "focus": "出る"},
    {"jp": "ここで少し休みましょう。", "en": "Let's rest here a little.", "grammar": "〜ましょう", "focus": "休む"},
    {"jp": "女の人が本を読んでいます。", "en": "A woman is reading a book.", "grammar": "〜ています", "focus": "女"},
    {"jp": "父は毎日、新聞を読みます。", "en": "My father reads the newspaper every day.", "grammar": "を", "focus": "父"},
    {"jp": "母は日よう日に買いものをします。", "en": "My mother does the shopping on Sunday.", "grammar": "に", "focus": "買いもの"},
    {"jp": "この魚は大きくて安いです。", "en": "This fish is big and cheap.", "grammar": "〜くて／〜で", "focus": "魚"},
    {"jp": "先生に手をあげて聞きました。", "en": "I raised my hand and asked the teacher.", "grammar": "〜ました／〜ませんでした", "focus": "手"},
    {"jp": "午後から雨がふりますか。", "en": "Will it rain from the afternoon?", "grammar": "か", "focus": "午後"},
    {"jp": "あの人は目が大きいですね。", "en": "That person has big eyes, doesn't she?", "grammar": "ね", "focus": "目"},
    {"jp": "百円の花を十本買いました。", "en": "I bought ten flowers at a hundred yen each.", "grammar": "を", "focus": "百円"},
    {"jp": "小さい子が耳をすましています。", "en": "The little child is listening carefully.", "grammar": "が", "focus": "耳"},
]

# ── N4 ────────────────────────────────────────────────────────
# The conditionals, giving and receiving, causative and passive. Longer
# than N5 and allowed a subordinate clause, but still one idea per
# sentence -- N4's difficulty is the grammar, and burying it under a
# second clause tests reading stamina instead.
N4 = [
    {"jp": "あした雨がふったら、家にいます。", "en": "If it rains tomorrow, I will stay home.", "grammar": "〜たら", "focus": "家"},
    {"jp": "この本を読めば、よくわかりますよ。", "en": "If you read this book, you will understand.", "grammar": "〜ば", "focus": "本"},
    {"jp": "漢字の本なら、あの店にあります。", "en": "If it is kanji books you want, they are at that shop.", "grammar": "〜なら", "focus": "漢字"},
    {"jp": "重い仕事があるので、早く起きました。", "en": "I got up early because I have heavy work.", "grammar": "〜ので", "focus": "仕事"},
    {"jp": "早く休んだのに、まだ元気になりません。", "en": "Even though I rested early, I still do not feel well.", "grammar": "〜のに", "focus": "元気"},
    {"jp": "友だちが重い物を持ってくれました。", "en": "My friend carried the heavy things for me.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "物"},
    {"jp": "空が黒いので、雨がふりそうです。", "en": "The sky is dark, so it looks like it will rain.", "grammar": "〜そうです", "focus": "空"},
    {"jp": "先生はいそがしいようです。", "en": "The teacher seems to be busy.", "grammar": "〜ようです", "focus": "先生"},
    {"jp": "母は妹に手紙を書かせました。", "en": "My mother made my little sister write a letter.", "grammar": "使役形 〜させる", "focus": "手紙"},
    {"jp": "大切な肉を犬に食べられました。", "en": "The dog ate the meat I had set aside.", "grammar": "受身形 〜られる", "focus": "犬"},
    {"jp": "その本はもう読んでしまいました。", "en": "I have already finished reading that book.", "grammar": "〜てしまう", "focus": "本"},
    {"jp": "旅行の前に、地図を買っておきます。", "en": "I will buy a map in advance, before the trip.", "grammar": "〜ておく", "focus": "旅行"},
    {"jp": "古い町を歩いたことがあります。", "en": "I have walked through an old town.", "grammar": "〜ことがある", "focus": "町"},
    {"jp": "毎日習って、字が書けるようになりました。", "en": "I studied every day and came to be able to write.", "grammar": "〜ようになる", "focus": "字"},
    {"jp": "来年から一人で住むことにしました。", "en": "I have decided to live alone from next year.", "grammar": "〜ことにする", "focus": "来年"},
    {"jp": "夏に海へ行くつもりです。", "en": "I intend to go to the sea in summer.", "grammar": "〜つもりです", "focus": "海"},
    {"jp": "これは「さくら」という花です。", "en": "This is a flower called sakura.", "grammar": "〜という", "focus": "花"},
    {"jp": "映画は三時に始まるはずです。", "en": "The film should start at three.", "grammar": "〜はずです", "focus": "映画"},
    {"jp": "駅までは歩いて三十分かかるかもしれません。", "en": "It might take thirty minutes on foot to the station.", "grammar": "〜かもしれません", "focus": "歩く"},
    {"jp": "つかれて、服を着たまま休みました。", "en": "I was tired and rested with my clothes on.", "grammar": "〜まま", "focus": "服"},
    {"jp": "弟は今、漢字が読めます。", "en": "My little brother can read kanji now.", "grammar": "可能形 〜(ら)れる", "focus": "弟"},
    {"jp": "来週、海を見ようと思います。", "en": "I am thinking of going to see the sea next week.", "grammar": "〜ようと思う", "focus": "海"},
    {"jp": "春になると、花が開きます。", "en": "When spring comes, the flowers open.", "grammar": "〜と", "focus": "春"},
    {"jp": "音楽を聞きながら、料理を作ります。", "en": "I cook while listening to music.", "grammar": "〜ながら", "focus": "音楽"},
    {"jp": "日曜日は本を読んだり、歌ったりします。", "en": "On Sunday I read books, sing, and so on.", "grammar": "〜たり〜たり", "focus": "日曜日"},
    {"jp": "ゆうべは少し飲みすぎました。", "en": "I drank a little too much last night.", "grammar": "〜すぎる", "focus": "飲む"},
    {"jp": "この赤いペンはとても書きやすいです。", "en": "This red pen is very easy to write with.", "grammar": "〜やすい／〜にくい", "focus": "赤い"},
    {"jp": "十時から歌を習いはじめます。", "en": "I start learning to sing at ten.", "grammar": "〜はじめる／〜おわる／〜つづける", "focus": "歌"},
    {"jp": "だんだん明るくなっていきますね。", "en": "It is gradually getting brighter, is it not?", "grammar": "〜ていく／〜てくる", "focus": "明るい"},
    {"jp": "この洋食を作ってみます。", "en": "I will try making this western dish.", "grammar": "〜てみる", "focus": "洋食"},
    {"jp": "赤い紙に名前が書いてあります。", "en": "A name is written on the red paper.", "grammar": "〜てある", "focus": "紙"},
    {"jp": "あの茶色の犬はまだ子犬らしいです。", "en": "That brown dog is apparently still a puppy.", "grammar": "〜らしい", "focus": "茶色"},
    {"jp": "外は雨がふっているみたいです。", "en": "It looks like it is raining outside.", "grammar": "〜みたいだ", "focus": "雨"},
    {"jp": "来月から病院で仕事をすることになりました。", "en": "It has been decided that I will work at the hospital from next month.", "grammar": "〜ことになる", "focus": "病院"},
    {"jp": "毎朝、早く起きるようにしています。", "en": "I make a point of getting up early every morning.", "grammar": "〜ようにする", "focus": "毎朝"},
    {"jp": "あした来るかどうか、まだ知りません。", "en": "I still do not know whether he is coming tomorrow.", "grammar": "〜かどうか", "focus": "知る"},
    {"jp": "私には百円しかありません。", "en": "I have only a hundred yen.", "grammar": "〜しか〜ない", "focus": "私"},
    {"jp": "雨がふっても、試験はあります。", "en": "Even if it rains, the exam will go ahead.", "grammar": "〜ても", "focus": "試験"},
    {"jp": "友だちに写真を見せてもらいました。", "en": "My friend showed me the photographs.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "写真"},
    {"jp": "この字は小さくて読みにくいです。", "en": "These characters are small and hard to read.", "grammar": "〜やすい／〜にくい", "focus": "小さい"},
    {"jp": "兄は私に日本語を教えてくれます。", "en": "My older brother teaches me Japanese.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "兄"},
    {"jp": "新しい店の料理を食べてみました。", "en": "I tried the food at the new restaurant.", "grammar": "〜てみる", "focus": "料理"},
    {"jp": "この魚は特別においしそうです。", "en": "This fish looks especially delicious.", "grammar": "〜そうです", "focus": "特別"},
    {"jp": "歌を歌いながら、銀行まで歩きました。", "en": "I walked to the bank while singing.", "grammar": "〜ながら", "focus": "銀行"},
    {"jp": "バスが駅へ走っていきました。", "en": "The bus went off towards the station.", "grammar": "〜ていく／〜てくる", "focus": "バス"},
]

# ── N3 ────────────────────────────────────────────────────────
# Where the syllabus turns abstract: reasons, tendencies, degrees. Two
# clauses are normal here, and the sentences start describing situations
# rather than naming objects.
N3 = [
    {"jp": "うちの子は本ばかり読んでいます。", "en": "My child does nothing but read books.", "grammar": "〜ばかり", "focus": "本"},
    {"jp": "先生のおかげで、試験に受かりました。", "en": "Thanks to my teacher, I passed the exam.", "grammar": "〜おかげで", "focus": "試験"},
    {"jp": "大雨のせいで、電車が止まりました。", "en": "Because of the heavy rain, the trains stopped.", "grammar": "〜せいで", "focus": "大雨"},
    {"jp": "高い店の料理がいつもおいしいわけではない。", "en": "Food at an expensive restaurant is not always delicious.", "grammar": "〜わけではない", "focus": "料理"},
    {"jp": "彼がそんな失礼なことを言うわけがない。", "en": "There is no way he would say something so rude.", "grammar": "〜わけがない", "focus": "失礼"},
    {"jp": "この字を見れば、彼が書いたに違いない。", "en": "Looking at this handwriting, he must have written it.", "grammar": "〜に違いない", "focus": "字"},
    {"jp": "約束したのだから、守るべきだ。", "en": "You made a promise, so you ought to keep it.", "grammar": "〜べきだ", "focus": "約束"},
    {"jp": "その問題を説明しようとして、うまくいかなかった。", "en": "I tried to explain the problem and it did not go well.", "grammar": "〜ようとする", "focus": "問題"},
    {"jp": "家を出たとたんに、雨がふり始めた。", "en": "The moment I left the house, it started to rain.", "grammar": "〜たとたんに", "focus": "家"},
    {"jp": "その計画に対して、反対の意見が多い。", "en": "There are many opinions against that plan.", "grammar": "〜に対して", "focus": "意見"},
    {"jp": "彼は医者として、この町で働いている。", "en": "He works in this town as a doctor.", "grammar": "〜として", "focus": "医者"},
    {"jp": "この計画に関して、意見を聞きたい。", "en": "I would like to hear opinions regarding this plan.", "grammar": "〜に関して", "focus": "計画"},
    {"jp": "先生が言った通りに、書いてみました。", "en": "I tried writing it just as the teacher said.", "grammar": "〜通りに", "focus": "先生"},
    {"jp": "この道を通るたびに、昔を思い出す。", "en": "Every time I pass along this road, I remember the old days.", "grammar": "〜たびに", "focus": "昔"},
    {"jp": "長い会議の末に、答えが決まった。", "en": "After a long meeting, the answer was decided.", "grammar": "〜末に", "focus": "会議"},
    {"jp": "この町は静かな一方で、少し不便だ。", "en": "This town is quiet, while also being a little inconvenient.", "grammar": "〜一方で", "focus": "不便"},
    {"jp": "約束はしたものの、まだ始めていない。", "en": "Although I made a promise, I have not started yet.", "grammar": "〜ものの", "focus": "約束"},
    {"jp": "大雨が続くと、川があふれるおそれがある。", "en": "If the heavy rain continues, there is a risk the river will overflow.", "grammar": "〜おそれがある", "focus": "川"},
    {"jp": "町の様子は少しずつ変わりつつある。", "en": "The look of the town is gradually changing.", "grammar": "〜つつある", "focus": "様子"},
    {"jp": "用意ができ次第、出発します。", "en": "We will set off as soon as everything is ready.", "grammar": "〜次第だ", "focus": "用意"},
    {"jp": "子どものころ、母に長い手紙を書かせられた。", "en": "As a child, I was made to write long letters by my mother.", "grammar": "使役受身形 〜させられる", "focus": "手紙"},
    {"jp": "天気予報によると、明日は雪が降るそうだ。", "en": "According to the forecast, it will snow tomorrow.", "grammar": "〜そうだ（伝聞）", "focus": "予報"},
    {"jp": "日本の文化について研究しています。", "en": "I am doing research about Japanese culture.", "grammar": "〜について", "focus": "文化"},
    {"jp": "この作品は有名な作家によって書かれた。", "en": "This work was written by a famous author.", "grammar": "〜によって", "focus": "作品"},
    {"jp": "会議は本社において行われます。", "en": "The meeting will be held at the head office.", "grammar": "〜において", "focus": "会議"},
    {"jp": "私にとって、家族が一番大切です。", "en": "For me, family is the most important thing.", "grammar": "〜にとって", "focus": "家族"},
    {"jp": "年をとるにつれて、目が悪くなる。", "en": "As you grow older, your eyesight gets worse.", "grammar": "〜につれて", "focus": "目"},
    {"jp": "説明書にしたがって、料理を作った。", "en": "I cooked following the instructions.", "grammar": "〜にしたがって", "focus": "説明書"},
    {"jp": "家族とともに、新しい町へ引っこした。", "en": "I moved to a new town together with my family.", "grammar": "〜とともに", "focus": "家族"},
    {"jp": "暗くならないうちに、家へ帰りましょう。", "en": "Let us go home before it gets dark.", "grammar": "〜うちに", "focus": "暗い"},
    {"jp": "食事の最中に、電話が鳴った。", "en": "The phone rang right in the middle of the meal.", "grammar": "〜最中に", "focus": "食事"},
    {"jp": "お帰りの際に、この紙をお出しください。", "en": "Please hand in this form when you leave.", "grammar": "〜際に", "focus": "紙"},
    {"jp": "自分でやると言ったくせに、いつも人にたのむ。", "en": "He says he will do it himself, yet he always asks others.", "grammar": "〜くせに", "focus": "自分"},
    {"jp": "値段のわりに、この品物は質がいい。", "en": "For the price, this item is good quality.", "grammar": "〜わりに", "focus": "値段"},
    {"jp": "子どもの服はよごれだらけだった。", "en": "The child's clothes were covered in dirt.", "grammar": "〜だらけ", "focus": "服"},
    {"jp": "最近、忘れがちなので気をつけている。", "en": "I have been forgetful lately, so I am being careful.", "grammar": "〜がち", "focus": "最近"},
    {"jp": "その言い方は少し子どもっぽいですね。", "en": "That way of speaking is a little childish, is it not?", "grammar": "〜っぽい", "focus": "言い方"},
    {"jp": "勉強すればするほど、上手になります。", "en": "The more you study, the better you get.", "grammar": "〜ば〜ほど", "focus": "勉強"},
    {"jp": "いそがしくて、食事をする時間さえない。", "en": "I am so busy I do not even have time to eat.", "grammar": "〜さえ", "focus": "時間"},
    {"jp": "こうなったら、自分でやるしかない。", "en": "Now that it has come to this, there is nothing for it but to do it myself.", "grammar": "〜しかない", "focus": "自分"},
    {"jp": "電車が止まった。それで遅れたわけだ。", "en": "The train stopped. That is why he was late, then.", "grammar": "〜わけだ", "focus": "遅れる"},
]

# ── N2 ────────────────────────────────────────────────────────
N2 = [
    {"jp": "何度も注意したにもかかわらず、彼は同じ失敗をくり返した。", "en": "Despite being warned many times, he repeated the same mistake.", "grammar": "〜にもかかわらず", "focus": "失敗"},
    {"jp": "台風が近づいているので、旅行を中止せざるを得ない。", "en": "With a typhoon approaching, we have no choice but to call off the trip.", "grammar": "〜ざるを得ない", "focus": "台風"},
    {"jp": "だめだと知りつつも、彼は最後まで続けた。", "en": "Knowing it was hopeless, he still kept going to the end.", "grammar": "〜つつも", "focus": "最後"},
    {"jp": "長時間議論したあげくに、答えは出なかった。", "en": "After all that long discussion, no answer was reached.", "grammar": "〜あげくに", "focus": "議論"},
    {"jp": "人口の増加に伴って、緑が減ってきた。", "en": "As the population has grown, greenery has decreased.", "grammar": "〜に伴って", "focus": "人口"},
    {"jp": "実験のデータに基づいて、新しい方法を考えた。", "en": "We devised a new method based on the experimental data.", "grammar": "〜に基づいて", "focus": "実験"},
    {"jp": "安いからといって、たくさん買う必要はない。", "en": "Just because it is cheap does not mean you need to buy a lot.", "grammar": "〜からといって", "focus": "必要"},
    {"jp": "彼は漢字どころか、ひらがなも読めない。", "en": "Far from kanji, he cannot even read hiragana.", "grammar": "〜どころか", "focus": "漢字"},
    {"jp": "それは単なるうわさにすぎない。", "en": "That is nothing more than a rumour.", "grammar": "〜にすぎない", "focus": "うわさ"},
    {"jp": "この店は年齢を問わず、だれでも入れます。", "en": "This shop is open to anyone, regardless of age.", "grammar": "〜を問わず", "focus": "年齢"},
    {"jp": "彼は英語はもとより、中国語も話せる。", "en": "Not to mention English, he can also speak Chinese.", "grammar": "〜はもとより", "focus": "英語"},
    {"jp": "学生のころは、よく夜通し話したものだ。", "en": "Back in my student days, we used to talk all night.", "grammar": "〜ものだ", "focus": "学生"},
    {"jp": "手を洗ってからでないと、食事をしてはいけない。", "en": "You must not eat until after you have washed your hands.", "grammar": "〜てからでないと", "focus": "食事"},
    {"jp": "彼の気持ちは想像しがたい。", "en": "His feelings are hard to imagine.", "grammar": "〜がたい", "focus": "想像"},
    {"jp": "その運転では大きな問題を起こしかねない。", "en": "Driving like that might well cause a serious problem.", "grammar": "〜かねない", "focus": "運転"},
    {"jp": "去年会ったきり、彼とは連絡していない。", "en": "I have not been in touch with him since we met last year.", "grammar": "〜きり", "focus": "連絡"},
    {"jp": "この料理は肉ぬきで作ることもできます。", "en": "This dish can also be made without meat.", "grammar": "〜ぬきで", "focus": "料理"},
    {"jp": "引き受けたからには、最後まで責任を持つ。", "en": "Now that I have taken it on, I will see it through.", "grammar": "〜からには", "focus": "責任"},
    {"jp": "あの写真を見ると、昔を思い出さずにはいられない。", "en": "Seeing that photograph, I cannot help remembering the old days.", "grammar": "〜ずにはいられない", "focus": "写真"},
    {"jp": "彼女は英語ばかりか、フランス語も上手だ。", "en": "Not only English, she is good at French too.", "grammar": "〜ばかりか", "focus": "英語"},
    {"jp": "一言多かったばかりに、話がこじれてしまった。", "en": "Simply because he said one word too many, things got complicated.", "grammar": "〜ばかりに", "focus": "一言"},
    {"jp": "この薬は効果が高いのみならず、値段も安い。", "en": "This medicine is not only effective but also cheap.", "grammar": "〜のみならず", "focus": "効果"},
    {"jp": "気温に応じて、服を変えたほうがいい。", "en": "You should change your clothes in response to the temperature.", "grammar": "〜に応じて", "focus": "気温"},
    {"jp": "天気にかかわらず、試合は行われます。", "en": "The match will be held regardless of the weather.", "grammar": "〜にかかわらず", "focus": "試合"},
    {"jp": "この問題は日本に限らず、世界中で起きている。", "en": "This problem is not limited to Japan; it happens worldwide.", "grammar": "〜に限らず", "focus": "世界"},
    {"jp": "計算にかけては、彼にかなう人はいない。", "en": "When it comes to calculation, no one can match him.", "grammar": "〜にかけては", "focus": "計算"},
    {"jp": "給料に加えて、交通費も支給されます。", "en": "In addition to a salary, travel expenses are also paid.", "grammar": "〜に加えて", "focus": "給料"},
    {"jp": "出発に先立って、全員の荷物を確認した。", "en": "Prior to departure, everyone's luggage was checked.", "grammar": "〜に先立って", "focus": "出発"},
    {"jp": "期待に反して、今年の夏は涼しかった。", "en": "Contrary to expectations, this summer was cool.", "grammar": "〜に反して", "focus": "期待"},
    {"jp": "この点数は努力にほかならない。", "en": "This score is nothing other than the result of effort.", "grammar": "〜にほかならない", "focus": "点数"},
    {"jp": "その件については、今は答えかねます。", "en": "I am unable to answer about that matter at present.", "grammar": "〜かねる", "focus": "件"},
    {"jp": "彼は一度も休むことなく、最後まで走った。", "en": "He ran to the end without ever resting.", "grammar": "〜ことなく", "focus": "休む"},
    {"jp": "返事がないということは、参加しないということだ。", "en": "No reply amounts to saying they will not take part.", "grammar": "〜ということだ", "focus": "返事"},
    {"jp": "彼の説明は分かりにくいというより、間違っている。", "en": "His explanation is not so much hard to follow as simply wrong.", "grammar": "〜というより", "focus": "説明"},
    {"jp": "実際に見ないことには、良し悪しは判断できない。", "en": "Without actually seeing it, I cannot judge whether it is good.", "grammar": "〜ないことには", "focus": "判断"},
    {"jp": "約束したので、今さらやめるわけにはいかない。", "en": "I promised, so I cannot very well back out now.", "grammar": "〜わけにはいかない", "focus": "約束"},
    {"jp": "この地方は温泉をはじめ、見所がたくさんある。", "en": "This region has many attractions, starting with its hot springs.", "grammar": "〜をはじめ", "focus": "温泉"},
    {"jp": "その土地をめぐって、長い議論が続いている。", "en": "A long argument continues over that land.", "grammar": "〜をめぐって", "focus": "土地"},
    {"jp": "この物語は実話をもとに書かれている。", "en": "This story is written on the basis of a true account.", "grammar": "〜をもとに", "focus": "物語"},
    {"jp": "友人を通じて、その会社を知りました。", "en": "I learned of that company through a friend.", "grammar": "〜を通じて", "focus": "友人"},
    {"jp": "その計画は失敗もあり得ると考えている。", "en": "I think that plan could possibly fail as well.", "grammar": "〜得る／〜得ない", "focus": "失敗"},
]

# ── N1 ────────────────────────────────────────────────────────
N1 = [
    {"jp": "彼は今にも泣き出さんばかりに顔をゆがめた。", "en": "His face twisted as if he were about to burst into tears.", "grammar": "〜んばかりに", "focus": "顔"},
    {"jp": "館内では、写真を撮るべからず。", "en": "Photography is prohibited inside the building.", "grammar": "〜べからず", "focus": "館内"},
    {"jp": "資金が不足しているゆえに、計画は延期された。", "en": "The plan was postponed on account of a shortage of funds.", "grammar": "〜ゆえに", "focus": "資金"},
    {"jp": "皆さまの支援なくしては、この成果はあり得なかった。", "en": "Without everyone's support, this achievement would not have been possible.", "grammar": "〜なくして(は)", "focus": "支援"},
    {"jp": "彼の態度は失礼極まりないものだった。", "en": "His attitude was rude in the extreme.", "grammar": "〜極まりない", "focus": "態度"},
    {"jp": "彼は物事を悪いほうへ考えるきらいがある。", "en": "He tends to look on the dark side of things.", "grammar": "〜きらいがある", "focus": "物事"},
    {"jp": "その光景は見るにたえないものだった。", "en": "That scene was more than one could bear to watch.", "grammar": "〜にたえない", "focus": "光景"},
    {"jp": "ご家族の健康を願ってやまない。", "en": "I never cease to wish your family good health.", "grammar": "〜てやまない", "focus": "健康"},
    {"jp": "作業を終えた彼は、汗まみれになっていた。", "en": "Having finished the work, he was covered in sweat.", "grammar": "〜まみれ", "focus": "汗"},
    {"jp": "そんな結果は想像だにしなかった。", "en": "I never even imagined such a result.", "grammar": "〜だに", "focus": "結果"},
    {"jp": "この店はお客様あってのものだ。", "en": "This shop exists only thanks to its customers.", "grammar": "〜あっての", "focus": "お客様"},
    {"jp": "彼は断りなしに、私の部屋に入ってきた。", "en": "He came into my room without asking.", "grammar": "〜なしに", "focus": "部屋"},
    {"jp": "理由のいかんによらず、遅刻は認められない。", "en": "Regardless of the reason, lateness is not accepted.", "grammar": "〜いかんによらず", "focus": "理由"},
    {"jp": "この仕事を任せられるのは、彼をおいて他にいない。", "en": "There is no one other than him to whom this work can be entrusted.", "grammar": "〜をおいて", "focus": "仕事"},
    {"jp": "一分たりともむだにはできない。", "en": "We cannot waste even a single minute.", "grammar": "〜たりとも", "focus": "むだ"},
    {"jp": "完成しないまでも、大部分は仕上げておきたい。", "en": "Even if we cannot finish it, I want most of it done.", "grammar": "〜ないまでも", "focus": "完成"},
    {"jp": "結局、その本は読まずじまいだった。", "en": "In the end, I never did get around to reading that book.", "grammar": "〜ずじまい", "focus": "結局"},
    {"jp": "ベルが鳴るが早いか、子どもたちは外へ飛び出した。", "en": "No sooner had the bell rung than the children rushed outside.", "grammar": "〜が早いか", "focus": "ベル"},
    {"jp": "彼は席に着くや否や、話し始めた。", "en": "As soon as he sat down, he began to talk.", "grammar": "〜や否や", "focus": "席"},
    {"jp": "かたづけるそばから、子どもが散らかしてしまう。", "en": "No sooner do I tidy up than the children make a mess again.", "grammar": "〜そばから", "focus": "子ども"},
    {"jp": "彼は家に帰るなり、部屋に閉じこもった。", "en": "The moment he got home, he shut himself in his room.", "grammar": "〜なり", "focus": "部屋"},
    {"jp": "散歩がてら、郵便局に寄ってきます。", "en": "I will drop by the post office while I am out for a walk.", "grammar": "〜がてら", "focus": "散歩"},
    {"jp": "彼は教師のかたわら、小説も書いている。", "en": "Alongside his teaching, he also writes novels.", "grammar": "〜かたわら", "focus": "小説"},
    {"jp": "彼のごとき人物には、二度と会えないだろう。", "en": "I doubt I shall ever meet a person like him again.", "grammar": "〜ごとき／〜ごとく", "focus": "人物"},
    {"jp": "その日の彼女は黒ずくめの服装だった。", "en": "That day she was dressed entirely in black.", "grammar": "〜ずくめ", "focus": "服装"},
    {"jp": "ようやく春めく季節になりました。", "en": "The season has finally begun to feel like spring.", "grammar": "〜めく", "focus": "季節"},
    {"jp": "それは教師にあるまじき発言だ。", "en": "That is a remark unbecoming of a teacher.", "grammar": "〜まじき", "focus": "教師"},
    {"jp": "真実を確かめるべく、現地へ向かった。", "en": "He set out for the site in order to establish the truth.", "grammar": "〜べく", "focus": "真実"},
    {"jp": "彼の努力は評価されてしかるべきだ。", "en": "His efforts ought properly to be recognised.", "grammar": "〜てしかるべきだ", "focus": "努力"},
    {"jp": "この味は、この土地ならではのものだ。", "en": "This flavour is unique to this region.", "grammar": "〜ならでは", "focus": "土地"},
    {"jp": "子どもといえども、約束は守るべきだ。", "en": "Even though they are children, they should keep their promises.", "grammar": "〜といえども", "focus": "約束"},
    {"jp": "便利とはいえ、使いすぎるのはよくない。", "en": "Convenient as it is, using it too much is not good.", "grammar": "〜とはいえ", "focus": "便利"},
    {"jp": "彼は早く帰れとばかりに、時計を見た。", "en": "He looked at his watch as if to say I should go home.", "grammar": "〜とばかりに", "focus": "時計"},
    {"jp": "専門家ならいざ知らず、私には分からない。", "en": "I could not say about a specialist, but I do not understand it.", "grammar": "〜ならいざ知らず", "focus": "専門家"},
    {"jp": "長い調査の末、ようやく結論に至った。", "en": "After a long investigation, we finally reached a conclusion.", "grammar": "〜に至る", "focus": "結論"},
    {"jp": "その景色の美しさは感動の極みだった。", "en": "The beauty of that scenery was the height of moving.", "grammar": "〜の極み", "focus": "景色"},
    {"jp": "彼は漢字はおろか、ひらがなも書けない。", "en": "Let alone kanji, he cannot even write hiragana.", "grammar": "〜はおろか", "focus": "漢字"},
    {"jp": "味もさることながら、この店は雰囲気がいい。", "en": "The taste goes without saying, but this place also has a good atmosphere.", "grammar": "〜もさることながら", "focus": "雰囲気"},
    {"jp": "彼は周囲の反対をものともせず、計画を進めた。", "en": "Undaunted by the opposition around him, he pushed the plan forward.", "grammar": "〜をものともせず", "focus": "反対"},
    {"jp": "大雨のため、試合は中止を余儀なくされた。", "en": "Because of the heavy rain, the match was forced to be cancelled.", "grammar": "〜を余儀なくされる", "focus": "中止"},
    {"jp": "東京を皮切りに、全国で公演が行われる。", "en": "Starting with Tokyo, performances will be held nationwide.", "grammar": "〜を皮切りに", "focus": "公演"},
]

BY_LEVEL: dict[str, list[dict]] = {"N5": N5, "N4": N4, "N3": N3, "N2": N2, "N1": N1}


def patterns_for(level: str) -> set[str]:
    """Every grammar pattern the catalogue teaches at `level`."""
    return {p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL.get(level, [])}


def problems() -> list[str]:
    """Everything wrong with the bank, as human-readable lines.

    Lives here rather than only in the test so the bank can be checked
    from a shell while it is being written -- which is how it was
    written. Empty means every sentence passes every rule in the module
    docstring.
    """
    from study import difficulty as D
    from study.grammar_match import contains_pattern, verifiable

    out: list[str] = []
    for level, rows in BY_LEVEL.items():
        catalogue = patterns_for(level)
        for i, row in enumerate(rows):
            jp, en, pattern = row["jp"], row.get("en", ""), row.get("grammar", "")
            where = f"{level}[{i}] {jp}"
            if not en.strip():
                out.append(f"{where}: no translation")
            if pattern not in catalogue:
                out.append(f"{where}: {pattern!r} is not a {level} point")
            elif verifiable(pattern) and not contains_pattern(jp, pattern):
                out.append(f"{where}: does not contain {pattern!r}")
            # The point's own characters are exempt from the kanji gate --
            # see difficulty.report's allow_kanji.
            verdict = D.report(jp, level, allow_kanji=pattern)
            for key in ("kanji", "grammar", "vocab"):
                if verdict[key]:
                    out.append(f"{where}: {key} above {level}: {verdict[key]}")
            if verdict["too_long"]:
                out.append(f"{where}: {verdict['too_long']} chars, cap is {D.MAX_CHARS[level]}")
    return out
