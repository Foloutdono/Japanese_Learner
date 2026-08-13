"""
Grammar data scraped from jlptsensei.com
"""

GRAMMAR_BY_LEVEL = {
  "N5": [
    {
      "grammar": "ちゃいけない・じゃいけない",
      "meaning": "must not do (spoken Japanese)",
      "structure": "Verb て ちゃだめ ちゃいけない ちゃいけません Verb で じゃダメ じゃいけない じゃいけません → ちゃだめ ちゃいけない ちゃいけません Verb で じゃダメ じゃいけない じゃいけません → Verb で じゃダメ じゃいけない じゃいけません → じゃダメ じゃいけない じゃいけません | Verb で じゃダメ じゃいけない じゃいけません → じゃダメ じゃいけない じゃいけません",
      "explanation": "",
      "examples": [
        {
          "jp": "寝る前にスマホを見ちゃダメよ。",
          "romaji": "neru mae ni sumaho o micha dame yo.",
          "en": "You shouldn't look at your smartphone before going to bed."
        },
        {
          "jp": "ここはきけんなので、入っちゃダメだよ。",
          "romaji": "koko wa kiken na node, haiccha dame da yo.",
          "en": "This area is dangerous, so you're not allowed to enter."
        },
        {
          "jp": "やっちゃいけないことをやっちゃった。",
          "romaji": "yaccha ikenai koto o yacchatta.",
          "en": "I did something I shouldn't have..."
        },
        {
          "jp": "自信をなくしちゃいけません！",
          "romaji": "jishin o naku shicha ikemasen!",
          "en": "You mustn't lose confidence!"
        },
        {
          "jp": "そんなに授業をさぼっちゃダメよ。",
          "romaji": "sonna ni jugyou o saboccha dame yo.",
          "en": "You shouldn't skip class so much."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a1%e3%82%83%e3%81%84%e3%81%91%e3%81%aa%e3%81%84-%e3%81%98%e3%82%83%e3%81%84%e3%81%91%e3%81%aa%e3%81%84-cha-ikenai-ja-dame/"
    },
    {
      "grammar": "だ / です",
      "meaning": "to be (am, is, are, were, used to)",
      "structure": "present affirmative だ (casual) です (polite) past affirmative だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → だ (casual) です (polite) past affirmative だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → past affirmative だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃなかった ではなかった じゃありませんでした ではありませんでした | past affirmative だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → だった (casual) でした (polite) present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃなかった ではなかった じゃありませんでした ではありませんでした | present negative じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃない ではない じゃありません ではありません past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃなかった ではなかった じゃありませんでした ではありませんでした | past negative じゃなかった ではなかった じゃありませんでした ではありませんでした → じゃなかった ではなかった じゃありませんでした ではありませんでした",
      "explanation": "私はクリス です 。 watashi wa kurisu desu. I am Chris. watashi wa kurisu desu. I am Chris.",
      "examples": [
        {
          "jp": "今日は暑いですね。",
          "romaji": "kyou wa atsui desu ne.",
          "en": "It's pretty hot today, isn't it?"
        },
        {
          "jp": "かれは私の友だちです。",
          "romaji": "kare wa watashi no tomodachi desu.",
          "en": "He is my friend."
        },
        {
          "jp": "日本の文化が好きです。",
          "romaji": "nihon no bunka ga suki desu.",
          "en": "I like Japanese culture"
        },
        {
          "jp": "昔はサッカーが趣味だったが、今はやっていない。",
          "romaji": "mukashi wa sakka ga shumi datta ga, ima wa yatteinai.",
          "en": "Soccer used to be my hobby, but I don't play anymore."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0-da-%e3%81%a7%e3%81%99-desu-meaning/"
    },
    {
      "grammar": "だけ",
      "meaning": "only; just; as much as ~",
      "structure": "Verb (dictionary form) だけ Noun な-adjective + な い-adjective → だけ Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "一人 だけ 。 hitori dake. only one person. hitori dake. only one person.",
      "examples": [
        {
          "jp": "私の持っているお金はこれだけだ。",
          "romaji": "watashi no motteiru okane wa kore dake da.",
          "en": "This is the only money I have."
        },
        {
          "jp": "ちょっと見ているだけです。",
          "romaji": "chotto mitteiru dake desu.",
          "en": "I'm just looking around."
        },
        {
          "jp": "好きじゃない食べ物はトマトだけだ。",
          "romaji": "suki janai tabemono wa tomato dake da.",
          "en": "The only food I dislike are tomatoes."
        },
        {
          "jp": "ただ話していただけです。",
          "romaji": "tada hanashiteita dake desu.",
          "en": "I was just speaking."
        },
        {
          "jp": "問題はそれだけだと思うかい？",
          "romaji": "mondai wa sore dake da to omou?",
          "en": "You think that's all there is to this problem?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91-dake-meaning/"
    },
    {
      "grammar": "だろう",
      "meaning": "I think; it seems; probably; right?",
      "structure": "Verb (dictionary form) だろう Noun な-adjective い-adjective → だろう Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "嘘 だろう 。 uso darou. You’re kidding ( surely that’s a lie) That’s a lie, right? uso darou. You’re kidding ( surely that’s a lie) That’s a lie, right?",
      "examples": [
        {
          "jp": "彼はもうすぐ来るだろう。",
          "romaji": "kare wa mou sugu kuru darou.",
          "en": "He should be coming any moment now."
        },
        {
          "jp": "そうだろうと思ったよ。",
          "romaji": "sou darou to omotta.",
          "en": "I thought (figured) as much."
        },
        {
          "jp": "明日はたぶん雨が降るだろう。空に雲がたくさんあるから。",
          "romaji": "ashita wa tabun ame ga furu darou. sora ni kumo ga takusan aru kara.",
          "en": "It will likely rain tomorrow.. There's a lot of clouds in the sky now.."
        },
        {
          "jp": "間違いないだろう。",
          "romaji": "machigai nai darou.",
          "en": "Surely there's no mistake."
        },
        {
          "jp": "たぶんこの雨は１時間ぐらいでやむだろう。",
          "romaji": "tabun kono ame wa ichijikan gurai de yamu darou.",
          "en": "This rain will probably be over in about an hour or so."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%82%8d%e3%81%86-darou-meaning/"
    },
    {
      "grammar": "で",
      "meaning": "in; at; on; by; with; via ~",
      "structure": "Noun で → で",
      "explanation": "",
      "examples": [
        {
          "jp": "じてんしゃで行きます。",
          "romaji": "jitensha de ikimasu.",
          "en": "I will go by bicycle."
        },
        {
          "jp": "みんなで行こう！",
          "romaji": "minna de ikou!",
          "en": "Let's go together with everyone!"
        },
        {
          "jp": "たまに一人でカラオケに行きます。",
          "romaji": "tamani hitori de karaoke ni ikimasu.",
          "en": "I sometimes go to sing karaoke by myself."
        },
        {
          "jp": "なにかの理由で彼は虫が怖いんだ。",
          "romaji": "nanika no riyuu de kare wa mushi ga kowai n da.",
          "en": "For some reason, he is scared of bugs."
        },
        {
          "jp": "そのシャツどこで買いました？",
          "romaji": "sono shatsu doko de kaimashita?",
          "en": "Where did you buy that shirt?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7-de-particle-meaning/"
    },
    {
      "grammar": "でも",
      "meaning": "but; however; though ~",
      "structure": "Between 2 clauses",
      "explanation": "",
      "examples": [
        {
          "jp": "私は魚が好きです。でも肉も好きです。",
          "romaji": "watashi wa sakana ga suki desu. demo niku mo suki desu.",
          "en": "I like fish. But I also like meat."
        },
        {
          "jp": "パン屋に行きました。でも、何も買いませんでした。",
          "romaji": "panya ni ikimashita. demo, nanimo kaimasen deshita.",
          "en": "I went to the bakery, but didn't buy anything."
        },
        {
          "jp": "動物が好きです。でも、犬が一ばん好きです。",
          "romaji": "doubutsu ga suki desu. demo, inu ga ichiban suki desu.",
          "en": "I like animals. But I love dogs the most."
        },
        {
          "jp": "図書館に行きました。でも、集中できませんでした。",
          "romaji": "toshokan ni ikimashita. demo, shuuchuu dekimasen deshita.",
          "en": "I went to the library. But I wasn't able to concentrate."
        },
        {
          "jp": "スーパーに行きました。でも、財布を忘れました！",
          "romaji": "suupaa ni ikimashita. demo, saifu wo wasuremashita.",
          "en": "I went to the grocery store. But I forgot my wallet!"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82-demo-meaning/"
    },
    {
      "grammar": "でしょう",
      "meaning": "I think; it seems; probably; right?",
      "structure": "Verb (dictionary form) でしょう Noun な-adjective い-adjective → でしょう Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "明日は雨が降る でしょう 。 ashita wa ame ga furu deshou. It will probably rain tomorrow. I think it will rain tomorrow. ashita wa ame ga furu deshou. It will probably rain tomorrow. I think it will rain tomorrow.",
      "examples": [
        {
          "jp": "あの人は誰でしょう？",
          "romaji": "ano hito wa dare deshou?",
          "en": "I wonder who that person is.."
        },
        {
          "jp": "いいでしょう。",
          "romaji": "ii deshou.",
          "en": "That sounds/seems good."
        },
        {
          "jp": "この問題は簡単でしょう？",
          "romaji": "kono mondai wa kantan deshou?",
          "en": "This problem is easy, right?"
        },
        {
          "jp": "彼はもうすぐ来るでしょう。",
          "romaji": "kare wa mou sugu kuru deshou.",
          "en": "He should be here any second."
        },
        {
          "jp": "頑張れば、いい大学に行けるでしょう。",
          "romaji": "ganbareba, ii daigaku ni ikeru deshou.",
          "en": "If you work hard, you should be able to get into a good university."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%97%e3%82%87%e3%81%86-deshou-meaning/"
    },
    {
      "grammar": "どんな",
      "meaning": "what kind of; what sort of",
      "structure": "どんな Noun → Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "ベトナムはどんな国ですか。",
          "romaji": "betonamu wa donna kuni desu ka.",
          "en": "What kind of country is Vietnam?"
        },
        {
          "jp": "どんな仕事をするのですか。",
          "romaji": "donna shigoto o suru no desu ka?",
          "en": "What kind of work do you do?"
        },
        {
          "jp": "どんな食べ物が好きですか。",
          "romaji": "donna tabemono ga suki desu ka.",
          "en": "What kind of food do you like?"
        },
        {
          "jp": "どんなパソコンを持っていますか。",
          "romaji": "donna pasokon o motteimasu ka.",
          "en": "What kind of computer do you have?"
        },
        {
          "jp": "どんな車に乗っていますか？",
          "romaji": "donna kuruma ni notteimasu ka?",
          "en": "What kind of car do you drive?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%82%93%e3%81%aa-donna-meaning/"
    },
    {
      "grammar": "どうして",
      "meaning": "why; for what reason; how",
      "structure": "can be used mid-sentence or to start new sentence",
      "explanation": "どうして 来なかった？ doushite konakatta Why did you not come? doushite konakatta Why did you not come?",
      "examples": [
        {
          "jp": "どうして来ないの？",
          "romaji": "doushite konai no?",
          "en": "Why aren't you coming?"
        },
        {
          "jp": "どうしてそうなったの？",
          "romaji": "doushite sou natta no?",
          "en": "How/why did that happen?"
        },
        {
          "jp": "どうしてそれを知っている？",
          "romaji": "doushite sore o shitteiru?",
          "en": "How/why do you know that?"
        },
        {
          "jp": "どうして日本に来たんですか？",
          "romaji": "doushite nihon ni kitan desu ka?",
          "en": "Why did you come to Japan?"
        },
        {
          "jp": "どうして日本の夏はこんなに暑いんだろう。",
          "romaji": "doushite nihon no natsu wa konnani atsui n darou.",
          "en": "Why is Summer in Japan so hot..?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%81%97%e3%81%a6-doushite-meaning/"
    },
    {
      "grammar": "どうやって",
      "meaning": "how; in what way; by what means​",
      "structure": "can be used at beginning or mid-sentence",
      "explanation": "",
      "examples": [
        {
          "jp": "駅までどうやって行きますか。",
          "romaji": "eki made douyatte ikimasu ka.",
          "en": "How can I get to the station?"
        },
        {
          "jp": "これはどうやって使いますか。",
          "romaji": "kore wa douyatte tsukaimasu ka.",
          "en": "How do you use this?"
        },
        {
          "jp": "これはどうやって食べますか。",
          "romaji": "kore wa douyatte tabemasu ka.",
          "en": "How do you eat this?"
        },
        {
          "jp": "リサさんは毎日どうやって学校へ来ますか。",
          "romaji": "risa san wa mainichi douyatte gakkou e kimasu ka.",
          "en": "Lisa, how do you come to school every day?"
        },
        {
          "jp": "どうやって彼女と出会ったのですか。",
          "romaji": "douyatte kanojo to deatta no desu ka.",
          "en": "How did you meet her?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%82%84%e3%81%a3%e3%81%a6-douyatte-meaning/"
    },
    {
      "grammar": "が",
      "meaning": "subject marker; however; but ~",
      "structure": "Usage 1: subject marker subject + が Usage 2: however; but Sentence 1 + が + Sentence 2 → Usage 2: however; but Sentence 1 + が + Sentence 2 | Usage 2: however; but Sentence 1 + が + Sentence 2",
      "explanation": "",
      "examples": [
        {
          "jp": "明日は雨が降る。",
          "romaji": "ashita wa ame ga furu.",
          "en": "It is going to rain tomorrow."
        },
        {
          "jp": "仕方がない。",
          "romaji": "shikata ga nai.",
          "en": "It cannot be helped. (a common expression in Japanese)"
        },
        {
          "jp": "コンビニが近くにあります。",
          "romaji": "konbini ga chikaku ni arimasu.",
          "en": "There is a convenience store nearby."
        },
        {
          "jp": "彼は借金がある。",
          "romaji": "kare wa shakkin ga aru.",
          "en": "He is in debt."
        },
        {
          "jp": "今日は、やることがたくさんある。",
          "romaji": "kyou wa, yaru koto ga takusan aru.",
          "en": "There are a lot of things to do today."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c-ga-subject-marker-particle/"
    },
    {
      "grammar": "があります",
      "meaning": "there is; is (non-living things)",
      "structure": "Noun がある / があります があった / がありました がない / がありません がなかった / がありませんでした → がある / があります があった / がありました がない / がありません がなかった / がありませんでした → があった / がありました がない / がありません がなかった / がありませんでした → がない / がありません がなかった / がありませんでした → がなかった / がありませんでした | があった / がありました がない / がありません がなかった / がありませんでした → がない / がありません がなかった / がありませんでした → がなかった / がありませんでした | がない / がありません がなかった / がありませんでした → がなかった / がありませんでした | がなかった / がありませんでした",
      "explanation": "",
      "examples": [
        {
          "jp": "人気がある。",
          "romaji": "ninki ga aru.",
          "en": "to be popular."
        },
        {
          "jp": "先月お金がぜんぜんなかった。",
          "romaji": "sengetsu okane ga zenzen nakatta.",
          "en": "Last month I had no money."
        },
        {
          "jp": "へやにテレビがあります。",
          "romaji": "heya ni terebi ga arimasu.",
          "en": "I have a TV in my room."
        },
        {
          "jp": "日本の好きじゃないところはあります。",
          "romaji": "nihon no suki janai tokoro ha arimasu.",
          "en": "There are some things I don't like about Japan."
        },
        {
          "jp": "このマンションにはへやが三つあります。",
          "romaji": "kono manshon niwa heya ga mitsu arimasu.",
          "en": "There are three rooms in this apartment."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%82%e3%82%8a%e3%81%be%e3%81%99-ga-arimasu-%e3%81%8c%e3%81%82%e3%82%8b-ga-aru-meaning/"
    },
    {
      "grammar": "がほしい",
      "meaning": "to want something",
      "structure": "Noun + が ほしい 欲しい → ほしい 欲しい",
      "explanation": "",
      "examples": [
        {
          "jp": "もっとお金が欲しいです。",
          "romaji": "motto okane ga hoshii desu.",
          "en": "I want more money."
        },
        {
          "jp": "彼女がほしい。",
          "romaji": "kanojo ga hoshii.",
          "en": "I want a girlfriend."
        },
        {
          "jp": "お金がたくさんほしい。",
          "romaji": "okane ga takusan hoshii.",
          "en": "I want a lot of money."
        },
        {
          "jp": "何人子どもがほしいですか？",
          "romaji": "nan nin kodomo ga hoshii desu ka?",
          "en": "How many children do you want to have?"
        },
        {
          "jp": "新しいGoProカメラが欲しいです！",
          "romaji": "atarashii gopuro kamera ga hoshii desu!",
          "en": "I want the new GoPro camera!"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%bb%e3%81%97%e3%81%84-ga-hoshii-%e3%81%8c%e6%ac%b2%e3%81%97%e3%81%84-meaning/"
    },
    {
      "grammar": "がいます",
      "meaning": "there is; to be; is (living things)",
      "structure": "Noun がいる / がいます がいた / がいました がいない / がいません がいなかった / がいませんでした → がいる / がいます がいた / がいました がいない / がいません がいなかった / がいませんでした → がいた / がいました がいない / がいません がいなかった / がいませんでした → がいない / がいません がいなかった / がいませんでした → がいなかった / がいませんでした | がいた / がいました がいない / がいません がいなかった / がいませんでした → がいない / がいません がいなかった / がいませんでした → がいなかった / がいませんでした | がいない / がいません がいなかった / がいませんでした → がいなかった / がいませんでした | がいなかった / がいませんでした",
      "explanation": "",
      "examples": [
        {
          "jp": "テーブルの下に猫がいる。",
          "romaji": "teeburu no shita ni neko ga iru.",
          "en": "There is a cat below the table."
        },
        {
          "jp": "あなたは彼氏がいるの？",
          "romaji": "anata wa kareshi ga iru no?",
          "en": "Do you have a boyfriend?"
        },
        {
          "jp": "私には兄弟がいないんだ。",
          "romaji": "watashi ni wa kyoudai ga inai nda.",
          "en": "I don't have any siblings."
        },
        {
          "jp": "弟一人妹一人がいます。",
          "romaji": "otouto hitori imouto hitori ga imasu.",
          "en": "I have one younger brother and one younger sister."
        },
        {
          "jp": "その部屋に犬がいる。",
          "romaji": "sono heya ni inu ga iru.",
          "en": "There is a dog in that room."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%84%e3%81%be%e3%81%99-ga-imasu-%e3%81%8c%e3%81%84%e3%82%8b-ga-iru-meaning/"
    },
    {
      "grammar": "ほうがいい",
      "meaning": "had better; it'd be better to; should ~",
      "structure": "Verb 方がいい ほうがいい → 方がいい ほうがいい",
      "explanation": "行っ たほうがいい。 itta hou ga ii. You had better go / you should go. itta hou ga ii. You had better go / you should go.",
      "examples": [
        {
          "jp": "疲れたら、早く寝たほうがいい。",
          "romaji": "tsukaretara, hayaku neta hou ga ii.",
          "en": "If you're tired, it's better to go to bed early."
        },
        {
          "jp": "暑い日には、水をたくさん飲んだ方がいい。",
          "romaji": "atsui hi ni wa, mizu o takusan nonda hou ga ii.",
          "en": "It's best to drink a lot of water on hot days."
        },
        {
          "jp": "寝る前に、スマホを使わない方がいい。",
          "romaji": "neru mae ni, sumaho o tsukawanai hou ga ii.",
          "en": "Before going to bed, it's best to not use your smartphone."
        },
        {
          "jp": "毎日日本語を練習した方がいいですよ。",
          "romaji": "mainichi nihongo o renshuu shita hou ga ii desu yo.",
          "en": "You should practice Japanese every day."
        },
        {
          "jp": "分からないとき、先生に聞いた方がいいですよ。",
          "romaji": "wakaranai toki, sensei ni kiita hou ga ii desu yo.",
          "en": "When you don't understand, you're best off asking your teacher."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%96%b9%e3%81%8c%e3%81%84%e3%81%84-%e3%81%bb%e3%81%86%e3%81%8c%e3%81%84%e3%81%84-hou-ga-ii-meaning/"
    },
    {
      "grammar": "い-adjectives",
      "meaning": "i-adjectives",
      "structure": "present い present negative くない くありません past かった past negative くなかった くありませんでした → い present negative くない くありません past かった past negative くなかった くありませんでした → present negative くない くありません past かった past negative くなかった くありませんでした → くない くありません past かった past negative くなかった くありませんでした → past かった past negative くなかった くありませんでした → かった past negative くなかった くありませんでした → past negative くなかった くありませんでした → くなかった くありませんでした | present negative くない くありません past かった past negative くなかった くありませんでした → くない くありません past かった past negative くなかった くありませんでした → past かった past negative くなかった くありませんでした → かった past negative くなかった くありませんでした → past negative くなかった くありませんでした → くなかった くありませんでした | past かった past negative くなかった くありませんでした → かった past negative くなかった くありませんでした → past negative くなかった くありませんでした → くなかった くありませんでした | past negative くなかった くありませんでした → くなかった くありませんでした",
      "explanation": "今日はあつ い です。 kyou wa atsu i desu. It is hot today. kyou wa atsu i desu. It is hot today.",
      "examples": [],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/japanese-%e3%81%84-adjectives-%e3%81%84%e5%bd%a2%e5%ae%b9%e8%a9%9e-meaning/"
    },
    {
      "grammar": "一番",
      "meaning": "the most; the best",
      "structure": "[A] + が/は + いちばん いちばん + [A] → いちばん + [A] | いちばん + [A]",
      "explanation": "",
      "examples": [
        {
          "jp": "彼がいちばん働いた。",
          "romaji": "kare ga ichiban hataraita.",
          "en": "He worked the hardest."
        },
        {
          "jp": "秋が一番好きな季節です。",
          "romaji": "aki ga ichiban suki na kisetsu desu.",
          "en": "Fall is my favorite season."
        },
        {
          "jp": "私はブロッコリーが一番嫌いだ。",
          "romaji": "watashi wa burokkorii ga ichiban kirai da.",
          "en": "I hate broccoli the most."
        },
        {
          "jp": "午前中が一番調子がいい。",
          "romaji": "gozen chuu ga ichiban choushi ga ii.",
          "en": "I feel best in the morning."
        },
        {
          "jp": "一番前に座っている人は誰ですか？",
          "romaji": "ichiban mae ni suwatteiru hito wa dare desu ka?",
          "en": "Who is that sitting in the very front?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e7%95%aa-%e3%81%84%e3%81%a1%e3%81%b0%e3%82%93-ichiban-meaning/"
    },
    {
      "grammar": "一緒に",
      "meaning": "together",
      "structure": "often preceded with と",
      "explanation": "一緒に 行きませんか？ issho ni ikimasen ka? Shall we go together ? issho ni ikimasen ka? Shall we go together ?",
      "examples": [
        {
          "jp": "一緒に日本語を勉強しましょう。",
          "romaji": "isshoni nihongo o benkyou shimashou.",
          "en": "Let's study Japanese together."
        },
        {
          "jp": "今夜、カラオケに一緒に行こう。",
          "romaji": "konya, karaoke ni isshoni ikou.",
          "en": "Let's go to karaoke together tonight."
        },
        {
          "jp": "ずっと彼と一緒にいたい。",
          "romaji": "zutto kare to issho ni itai.",
          "en": "I want to be together with him forever."
        },
        {
          "jp": "明日の朝、一緒にジムに行きませんか？",
          "romaji": "ashita no asa, issho ni jimu ni ikimasen ka?",
          "en": "Do you want to go to the gym together tomorrow morning?"
        },
        {
          "jp": "今朝、友だちと一緒に図書館に行きました。",
          "romaji": "kesa, tomodachi to issho ni toshokan ni ikimashita.",
          "en": "I went to the library together with my friend this morning."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e7%b7%92%e3%81%ab-%e3%81%84%e3%81%a3%e3%81%97%e3%82%87%e3%81%ab-issho-ni-meaning/"
    },
    {
      "grammar": "いつも",
      "meaning": "always; usually; habitually",
      "structure": "Can be used mid-sentence and also to start a new sentence",
      "explanation": "",
      "examples": [
        {
          "jp": "彼はいつも元気ですね。",
          "romaji": "kare wa itsumo genki desu ne.",
          "en": "He is always energetic."
        },
        {
          "jp": "妹はいつも寝ている。",
          "romaji": "imouto wa itsumo neteiru.",
          "en": "My younger sister is always sleeping."
        },
        {
          "jp": "いつも夜10時に寝ます。",
          "romaji": "itsumo yoru juuji ni nemasu.",
          "en": "I always go to bed at 10 o'clock."
        },
        {
          "jp": "昼ご飯はいつも納豆を食べます。",
          "romaji": "hirugohan wa itsumo nattou o tabemasu.",
          "en": "I always have natto (fermented soybeans) for lunch."
        },
        {
          "jp": "仕事に行く前にいつもジムに行きます。",
          "romaji": "shigoto ni iku mae ni itsumo jimu ni ikimasu.",
          "en": "I always go to the gym before going to work."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%a4%e3%82%82-itsumo-meaning/"
    },
    {
      "grammar": "じゃない・ではない",
      "meaning": "to not be (am not; is not; are not)",
      "structure": "present negative casual じゃない ではない polite じゃありません ではありません past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃない ではない polite じゃありません ではありません past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした | past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした",
      "explanation": "私はともこ先生 ではない 。 watashi wa tomoko sensei dewanai. I am not Tomoko-sensei. watashi wa tomoko sensei dewanai. I am not Tomoko-sensei.",
      "examples": [
        {
          "jp": "あなたは一人じゃない。",
          "romaji": "anata wa hitori janai.",
          "en": "You are not alone."
        },
        {
          "jp": "危険じゃないの？",
          "romaji": "kiken janai no?",
          "en": "Isn't it dangerous?"
        },
        {
          "jp": "そんなつもりじゃなかった。",
          "romaji": "sonna tsumori ja nakatta.",
          "en": "That wasn't my plan/intention."
        },
        {
          "jp": "ごめんなさい！わざとではありませんでした。",
          "romaji": "gomennasai! wazato dewa arimasen deshita.",
          "en": "I'm so sorry! It wasn't intentional."
        },
        {
          "jp": "肉はあまり好きじゃないです。",
          "romaji": "niku wa amari suki janai desu.",
          "en": "I don't really like meat."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%98%e3%82%83%e3%81%aa%e3%81%84-janai-%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84-dewa-nai-meaning/"
    },
    {
      "grammar": "じゃない・ではない",
      "meaning": "to not be (am not; is not; are not)",
      "structure": "present negative casual じゃない ではない polite じゃありません ではありません past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃない ではない polite じゃありません ではありません past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした | past negative casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした → casual じゃなかった ではなかった polite じゃありませんでした ではありませんでした",
      "explanation": "私はともこ先生 ではない 。 watashi wa tomoko sensei dewanai. I am not Tomoko-sensei. watashi wa tomoko sensei dewanai. I am not Tomoko-sensei.",
      "examples": [
        {
          "jp": "あなたは一人じゃない。",
          "romaji": "anata wa hitori janai.",
          "en": "You are not alone."
        },
        {
          "jp": "危険じゃないの？",
          "romaji": "kiken janai no?",
          "en": "Isn't it dangerous?"
        },
        {
          "jp": "そんなつもりじゃなかった。",
          "romaji": "sonna tsumori ja nakatta.",
          "en": "That wasn't my plan/intention."
        },
        {
          "jp": "ごめんなさい！わざとではありませんでした。",
          "romaji": "gomennasai! wazato dewa arimasen deshita.",
          "en": "I'm so sorry! It wasn't intentional."
        },
        {
          "jp": "肉はあまり好きじゃないです。",
          "romaji": "niku wa amari suki janai desu.",
          "en": "I don't really like meat."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%98%e3%82%83%e3%81%aa%e3%81%84-janai-%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84-dewa-nai-meaning/"
    },
    {
      "grammar": "か",
      "meaning": "question particle",
      "structure": "end of sentence か → か",
      "explanation": "",
      "examples": [
        {
          "jp": "何ですか？",
          "romaji": "nan desu ka?",
          "en": "What?"
        },
        {
          "jp": "すみません、あなたも学生ですか。",
          "romaji": "sumimasen, anata mo gakusei desu ka.",
          "en": "Excuse me, are you also a student?"
        },
        {
          "jp": "あなたの名前は何ですか。",
          "romaji": "anata no namae wa nandesu ka.",
          "en": "What is your name?"
        },
        {
          "jp": "元気ですか。",
          "romaji": "genki desu ka.",
          "en": "How are you?"
        },
        {
          "jp": "彼は何才ですか。",
          "romaji": "kare wa nansai desu ka.",
          "en": "How old is he?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b-ka-question-particle-meaning/"
    },
    {
      "grammar": "か～か",
      "meaning": "or",
      "structure": "Verb か Noun な-adjective い-adjective → か Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "明日は雨かどうか分からない。",
          "romaji": "ashita wa ame ka dou ka wakaranai.",
          "en": "I'm not sure if it will rain or not tomorrow."
        },
        {
          "jp": "お茶かコーヒーが飲みたい。",
          "romaji": "ocha ka koohii ga nomitai.",
          "en": "I would like to drink tea or coffee."
        },
        {
          "jp": "当たるかはずれるか。",
          "romaji": "ataru ka hazureru ka.",
          "en": "Hit or miss."
        },
        {
          "jp": "やるかやらないか早く決めてください。",
          "romaji": "yaru ka yaranai ka hayaku kimete kudasai.",
          "en": "Please hurry up and decide if you are going to do it or not."
        },
        {
          "jp": "来週の月曜日か火曜日に京都に行きます。",
          "romaji": "raishuu no getsuyoubi ka kayoubi ni kyouto ni ikimasu.",
          "en": "I'm going to Kyoto next Monday or Tuesday."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%ef%bd%9e%e3%81%8b-ka-ka-or-meaning/"
    },
    {
      "grammar": "から",
      "meaning": "because; since; from",
      "structure": "Verb から Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → から Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → な-adjective + だ い-adjective + い meaning 2: from; since Noun から → い-adjective + い meaning 2: from; since Noun から → Noun から → から | Verb から Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → から Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → な-adjective + だ い-adjective + い meaning 2: from; since Noun から → い-adjective + い meaning 2: from; since Noun から → Noun から → から | Noun + だ な-adjective + だ い-adjective + い meaning 2: from; since Noun から → な-adjective + だ い-adjective + い meaning 2: from; since Noun から → い-adjective + い meaning 2: from; since Noun から → Noun から → から | な-adjective + だ い-adjective + い meaning 2: from; since Noun から → い-adjective + い meaning 2: from; since Noun から → Noun から → から | い-adjective + い meaning 2: from; since Noun から → Noun から → から | Noun から → から | Noun から → から",
      "explanation": "明日テストがある から 、今夜勉強つもりだ。 ashita tesuto ga aru kara, konya benkyou tsumori da. Since I have a test tomorrow, I plan to study tonight. ashita tesuto ga aru kara, konya benkyou tsumori da. Since I have a test tomorrow, I plan to study tonight.",
      "examples": [
        {
          "jp": "天気がいいから、外に行きたい。",
          "romaji": "tenki ga ii kara, soto ni ikitai.",
          "en": "Since the weather is nice, I want to go outside."
        },
        {
          "jp": "私はすぐ戻るから、ここでちょっと待ってください。",
          "romaji": "watashi wa sugu modoru kara, koko de chotto matte kudasai.",
          "en": "I'll return shortly, so please wait here just a moment."
        },
        {
          "jp": "これからもよろしくお願いします。",
          "romaji": "kore kara mo yoroshiku onegaishimasu.",
          "en": "From now on, let's have a good relationship (I'll be counting on you)."
        },
        {
          "jp": "ここからあの駅まで歩いてどれぐらいかかりますか？",
          "romaji": "koko kara ano eki made aruite dore gurai kakarimasuka?",
          "en": "How long does it take to walk from here to that station?"
        },
        {
          "jp": "お店は何時から何時まで開いていますか？",
          "romaji": "omise wa nanji kara nanji made aiteimasu ka?",
          "en": "What are the shop's opening hours?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%82%89-kara-meaning/"
    },
    {
      "grammar": "方",
      "meaning": "the way of doing something; how to do ~",
      "structure": "Verb ます (stem form) 方 かた → 方 かた",
      "explanation": "",
      "examples": [
        {
          "jp": "パソコンの使いかたがわかりません。",
          "romaji": "pasokon no tsukai kata ga wakarimasen.",
          "en": "I don't know how to use a computer."
        },
        {
          "jp": "ケーキの作り方を知っていますか？",
          "romaji": "keeki no tsukuri kata o shitteimasu ka?",
          "en": "Do you know how to make a cake?"
        },
        {
          "jp": "おはしの使い方が上手ですね。",
          "romaji": "ohashi no tsukai kata ga jouzu desu ne.",
          "en": "You're very good at using chopsticks (you will be told this all the time in Japan)"
        },
        {
          "jp": "あの先生の教え方はとてもわかりやすいです。",
          "romaji": "ano sensei no oshie kata wa totemo wakari yasui desu.",
          "en": "That teacher's way of teaching is very easy to understand"
        },
        {
          "jp": "彼の生き方は、かっこいいです。",
          "romaji": "kare no iki kata wa, kakkoii desu.",
          "en": "His way of living is really cool."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%96%b9-%e3%81%8b%e3%81%9f-kata-meaning/"
    },
    {
      "grammar": "けど",
      "meaning": "but; however; although ~",
      "structure": "Use between 2 contradicting ideas",
      "explanation": "",
      "examples": [
        {
          "jp": "仕事は辛いけど楽しい。",
          "romaji": "shigoto wa tsurai kedo tanoshii.",
          "en": "Work is tough, but fun."
        },
        {
          "jp": "金はないけど夢はある。",
          "romaji": "kane wa nai kedo yume wa aru.",
          "en": "I don't have money, but I have dreams."
        },
        {
          "jp": "スポーツは上手じゃないけど、好きです。",
          "romaji": "supootsu wa jouzu janai kedo, suki desu.",
          "en": "I'm not good at sports, but I like them."
        },
        {
          "jp": "悪いけど、明日のパーティーに行けません。",
          "romaji": "warui kedo, ashita no paatii ni ikemasen.",
          "en": "Sorry, but I can't make it to tomorrow's party."
        },
        {
          "jp": "眠いけど、まだ宿題があるから寝られません。",
          "romaji": "nemui kedo, mada shukudai ga aru kara neraremasen.",
          "en": "I'm sleepy, but I still have homework to do so I can't go to sleep yet."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%91%e3%81%a9-kedo-meaning/"
    },
    {
      "grammar": "けれども",
      "meaning": "but; however; although ~",
      "structure": "Use between 2 contradicting ideas",
      "explanation": "",
      "examples": [
        {
          "jp": "外はさむいけれど、家の中は暖かいです。",
          "romaji": "soto wa samui keredo, ie no naka wa atatakai desu.",
          "en": "It’s cold outside, but inside the house it is warm."
        },
        {
          "jp": "彼は若いけれども経験がある。",
          "romaji": "kare wa wakai keredo mo keiken ga aru.",
          "en": "Although he is young he has experience."
        },
        {
          "jp": "眠いけれど、まだ宿題があるから寝られません。",
          "romaji": "nemui keredo, mada shukudai ga aru kara neraremasen.",
          "en": "I'm sleepy but still have homework to do so I can't go to bed yet."
        },
        {
          "jp": "このカメラは高かったけれど、すぐ壊れてしまいました。",
          "romaji": "kono kamera wa takakatta keredo, sugu kowarete shimaimashita.",
          "en": "This camera was really expensive, but it broke right away."
        },
        {
          "jp": "雪が降っているけれども、スーパーに行きます。",
          "romaji": "yuki ga futteiru keredo mo, suupaa ni ikimasu.",
          "en": "Although it is snowing outside, I'm going to the grocery store."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%91%e3%82%8c%e3%81%a9%e3%82%82-keredo-mo-meaning/"
    },
    {
      "grammar": "まだ",
      "meaning": "still; not yet",
      "structure": "まだ Verb (ている) Verb (ていない) Noun → Verb (ている) Verb (ていない) Noun → Noun | Noun",
      "explanation": "まだ 寝ているの？ mada neteiru no? You’re still sleeping? mada neteiru no? You’re still sleeping?",
      "examples": [
        {
          "jp": "まだですか？",
          "romaji": "mada desu ka?",
          "en": "Is it ready yet? / are we there yet? / Still...?"
        },
        {
          "jp": "まだまだ暑いだ。",
          "romaji": "mada mada atsui da.",
          "en": "It's still hot out. (mada can be used twice in a row for extra emphasis)"
        },
        {
          "jp": "先生はまだ来ていない。",
          "romaji": "sensei wa mada kiteinai.",
          "en": "Our teacher still hasn't come."
        },
        {
          "jp": "もう10時ですが弟がまだ寝ている。",
          "romaji": "mou juuji desu ga otouto ga mada neteiru.",
          "en": "It's already 10 am, but my younger brother is still sleeping."
        },
        {
          "jp": "まだ1時間もあるよ。",
          "romaji": "mada ichijikan mo aru yo.",
          "en": "We still have one hour."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%a0-mada-meaning/"
    },
    {
      "grammar": "まだ～ていません",
      "meaning": "have not yet ~",
      "structure": "まだ Verb (てない) *spoken Verb (ていない) Verb (ていません) → Verb (てない) *spoken Verb (ていない) Verb (ていません)",
      "explanation": "",
      "examples": [
        {
          "jp": "バスはまだ来ていません。",
          "romaji": "basu wa mada kiteimasen.",
          "en": "The bus still hasn't come."
        },
        {
          "jp": "まだ、決まっていません。",
          "romaji": "mada, kimatteimasen.",
          "en": "It hasn't been decided yet."
        },
        {
          "jp": "私はまだ朝ごはんを食べていません。",
          "romaji": "watashi wa mada asagohan o tabete imasen.",
          "en": "I still haven't eaten breakfast yet."
        },
        {
          "jp": "今週の新しい単語をまだ覚えていません。",
          "romaji": "konshuu no atarashii tango o mada oboete imasen.",
          "en": "I still haven't memorized this week's new vocabulary."
        },
        {
          "jp": "父はまだ帰ってきていない。",
          "romaji": "chichi wa mada kaette kiteinai.",
          "en": "My father still hasn't come home yet."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%a0%ef%bd%9e%e3%81%a6%e3%81%84%e3%81%be%e3%81%9b%e3%82%93-mada-te-imasen-meaning/"
    },
    {
      "grammar": "まで",
      "meaning": "until; as far as; to (an extent); even ~",
      "structure": "Noun まで → まで",
      "explanation": "",
      "examples": [
        {
          "jp": "昨日までお休みでした。",
          "romaji": "kinou made o yasumi deshita.",
          "en": "I was on vacation until yesterday."
        },
        {
          "jp": "ここからそこまでは遠いですよ。",
          "romaji": "koko kara soko made wa tooi desu yo.",
          "en": "That's really far from here!"
        },
        {
          "jp": "駅まで行きたいんですが、どう行ったらいいですか。",
          "romaji": "eki made ikitai ndesu ga, dou ittara ii desu ka.",
          "en": "How can I get to the station?"
        },
        {
          "jp": "最後までがんばってね！",
          "romaji": "saigo made ganbatte ne!",
          "en": "Do your best all the way until the end!"
        },
        {
          "jp": "家まで車で送ります。",
          "romaji": "ie made kuruma de okurimasu.",
          "en": "I'll take you home by car."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%a7-made-meaning/"
    },
    {
      "grammar": "前に",
      "meaning": "before; in front of ~",
      "structure": "Verb (dictionary form) 前に まえに Noun + の → 前に まえに Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "ドアを開ける前にノックぐらいしてください。",
          "romaji": "doa o akeru mae ni nokku gurai shite kudasai.",
          "en": "Before opening the door, please at least knock first."
        },
        {
          "jp": "コンビニの前にじてんしゃがたくさんあります。",
          "romaji": "konbini no mae ni jitensha ga takusan arimasu.",
          "en": "There are many bicycles in front of the convenience store."
        },
        {
          "jp": "旅行の前に切符を買っておきます。",
          "romaji": "ryokou no mae ni kippu o katte okimasu.",
          "en": "I will buy the tickets before the trip."
        },
        {
          "jp": "ご飯の前に手を洗いましょう。",
          "romaji": "gohan no mae ni te o araimashou.",
          "en": "let's make sure to wash our hands before eating."
        },
        {
          "jp": "テストの前に一生懸命勉強しました。",
          "romaji": "tesuto no mae ni isshokenmei benkyou shimashita.",
          "en": "I studied like crazy before the test."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%89%8d%e3%81%ab-%e3%81%be%e3%81%88%e3%81%ab-mae-ni-meaning/"
    },
    {
      "grammar": "ませんか",
      "meaning": "would you; do you want to; shall we ~",
      "structure": "Verb (polite negative) + か ません + か",
      "explanation": "行き ませんか 。 iki masen ka. Shall we go? / do you want to go? / etc.. iki masen ka. Shall we go? / do you want to go? / etc..",
      "examples": [
        {
          "jp": "今日一緒に食べませんか？",
          "romaji": "kyou isshoni tabemasen ka?",
          "en": "Do you want to eat together today?"
        },
        {
          "jp": "うちで映画を見ませんか。",
          "romaji": "uchi de eiga o mimasen ka.",
          "en": "Do you want to watch a movie at my place?"
        },
        {
          "jp": "お茶にしませんか？",
          "romaji": "ocha ni shimasen ka?",
          "en": "Would you care for some tea?"
        },
        {
          "jp": "日曜日にテニスをしませんか。",
          "romaji": "nichiyoubi ni tenisu o shimasen ka.",
          "en": "Do you want to play tennis on Sunday?"
        },
        {
          "jp": "明日自転車で学校へ行きませんか？",
          "romaji": "ashita jitensha de gakkou e ikimasen ka?",
          "en": "Do you want to go to school tomorrow by bike?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%9b%e3%82%93%e3%81%8b-masen-ka-meaning/"
    },
    {
      "grammar": "ましょう",
      "meaning": "let's ~; shall we ~",
      "structure": "Verb ます (stem form) ましょう → ましょう",
      "explanation": "",
      "examples": [
        {
          "jp": "行きましょう！",
          "romaji": "iki mashou!",
          "en": "Let's go!"
        },
        {
          "jp": "駅で会いましょう！",
          "romaji": "eki de ai mashou!",
          "en": "Let's meet at the station!"
        },
        {
          "jp": "もうご飯の時間だよ、早く食べましょう！",
          "romaji": "mou gohan no jikan dayo, hayaku tabe mashou!",
          "en": "It's already dinner time, let's hurry up and eat!"
        },
        {
          "jp": "帰る前に教室をきれいにしましょう。",
          "romaji": "kaeru mae ni kyoushitsu o kirei ni shi mashou.",
          "en": "Before we go home, let's clean up the classroom."
        },
        {
          "jp": "一緒に日本語を勉強しましょう！",
          "romaji": "isshoni nihongo o benkyou shi mashou!",
          "en": "Let's study Japanese together!"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%97%e3%82%87%e3%81%86-mashou-meaning/"
    },
    {
      "grammar": "ましょうか",
      "meaning": "shall I ~; used to offer help to the listener",
      "structure": "Verb ます (stem form) ましょうか → ましょうか",
      "explanation": "",
      "examples": [
        {
          "jp": "マドを開けましょうか。",
          "romaji": "mado o ake mashouka?",
          "en": "Shall I open the window?"
        },
        {
          "jp": "手伝いましょうか。",
          "romaji": "tetsudai mashouka?",
          "en": "Do you want some help?"
        },
        {
          "jp": "荷物を持ちましょうか。",
          "romaji": "nimotsu o mochi mashouka?",
          "en": "Shall I help carry your luggage?"
        },
        {
          "jp": "タクシーを呼びましょうか。",
          "romaji": "takushii o yobi mashouka?",
          "en": "Shall I call a taxi for you?"
        },
        {
          "jp": "私がお皿を洗いましょうか？",
          "romaji": "watashi ga osara o arai mashouka?",
          "en": "Shall I wash the dishes?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%97%e3%82%87%e3%81%86%e3%81%8b-mashouka-meaning/"
    },
    {
      "grammar": "も",
      "meaning": "too; also; as well",
      "structure": "Noun + も",
      "explanation": "",
      "examples": [
        {
          "jp": "私もできる。",
          "romaji": "watashi mo dekiru.",
          "en": "I can do that too."
        },
        {
          "jp": "甘いものも辛いものも好きです。",
          "romaji": "amai mono mo karai mono mo suki desu.",
          "en": "I like sweets as well as spicy foods."
        },
        {
          "jp": "カラオケにはみんなが来ました。先生も来ました。",
          "romaji": "karaoke ni wa minna ga kimashita. sensei mo kimashita.",
          "en": "Everyone came to sing karaoke. Our teacher came too."
        },
        {
          "jp": "私は日本語も英語もベトナム語も話せます。",
          "romaji": "watashi wa nihongo mo eigo mo betonamugo mo hanasemasu.",
          "en": "I can speak English, Japanese, as well as Vietnamese."
        },
        {
          "jp": "あなたもお腹が空いたでしょう？",
          "romaji": "anata mo onaka ga suita deshou.",
          "en": "You are probably hungry too, aren't you?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%82%82-mo-particle-meaning/"
    },
    {
      "grammar": "もう",
      "meaning": "already; anymore; again; other",
      "structure": "See examples below",
      "explanation": "もう 9時だ。 mou ku ji da. It’s already 9 o’clock. mou ku ji da. It’s already 9 o’clock.",
      "examples": [
        {
          "jp": "もう昼ご飯の時間だ。早く食べましょう！",
          "romaji": "mou hiru gohan no jikan da. hayaku tabe mashou!",
          "en": "It's lunch time already, let's hurry up and eat."
        },
        {
          "jp": "宿題はもう終わった？",
          "romaji": "shukudai wa mou owatta?",
          "en": "Did you already finish your homework?"
        },
        {
          "jp": "ビールもう一杯ください！",
          "romaji": "biiru mou ippai kudasai!",
          "en": "One more beer please!"
        },
        {
          "jp": "飲み物は全部飲みました。もうありません。",
          "romaji": "nomimono wa zenbu nomimashita. mou arimasen.",
          "en": "We drank all of the drinks. There aren't any left."
        },
        {
          "jp": "もう少し待ってください。",
          "romaji": "mou sukoshi matte kudasai.",
          "en": "Please wait a little while longer."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%82%82%e3%81%86-mou-meaning/"
    },
    {
      "grammar": "な-adjectives",
      "meaning": "na-adjectives",
      "structure": "present な / だ present negative じゃない ではない past だった でした past negative じゃなかった ではありませんでした → な / だ present negative じゃない ではない past だった でした past negative じゃなかった ではありませんでした → present negative じゃない ではない past だった でした past negative じゃなかった ではありませんでした → じゃない ではない past だった でした past negative じゃなかった ではありませんでした → past だった でした past negative じゃなかった ではありませんでした → だった でした past negative じゃなかった ではありませんでした → past negative じゃなかった ではありませんでした → じゃなかった ではありませんでした | present negative じゃない ではない past だった でした past negative じゃなかった ではありませんでした → じゃない ではない past だった でした past negative じゃなかった ではありませんでした → past だった でした past negative じゃなかった ではありませんでした → だった でした past negative じゃなかった ではありませんでした → past negative じゃなかった ではありませんでした → じゃなかった ではありませんでした | past だった でした past negative じゃなかった ではありませんでした → だった でした past negative じゃなかった ではありませんでした → past negative じゃなかった ではありませんでした → じゃなかった ではありませんでした | past negative じゃなかった ではありませんでした → じゃなかった ではありませんでした",
      "explanation": "その子は げんきだ 。 sono ko wa genki da . That child is energetic. sono ko wa genki da . That child is energetic.",
      "examples": [],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/japanese-%e3%81%aa-adjectives-%e3%81%aa%e5%bd%a2%e5%ae%b9%e8%a9%9e-meaning/"
    },
    {
      "grammar": "なあ",
      "meaning": "sentence ending particle; confirmation; admiration, etc",
      "structure": "end of sentence + な(あ)",
      "explanation": "",
      "examples": [
        {
          "jp": "たくさんの人がいるなあ。",
          "romaji": "takusan no hito ga iru naa.",
          "en": "Wow, there's a lot of people here."
        },
        {
          "jp": "これ、美味しいなあ。",
          "romaji": "kore, oishii naa.",
          "en": "This is really delicious."
        },
        {
          "jp": "暑くなってきたなあ。",
          "romaji": "atsu ku natte kita naa.",
          "en": "It's starting to get hotter."
        },
        {
          "jp": "それは本当かな。",
          "romaji": "sore wa hontou kana.",
          "en": "I wonder if that's true..."
        },
        {
          "jp": "明日は晴れるかなあ。",
          "romaji": "ashita wa hareru kanaa.",
          "en": "I wonder if the weather will clear up tomorrow..."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%82-naa-sentence-ending-particle-meaning/"
    },
    {
      "grammar": "ないで",
      "meaning": "without doing ~; to do [B] without doing [A]",
      "structure": "Verb-A (ない form) + で Verb-B → Verb-B",
      "explanation": "",
      "examples": [
        {
          "jp": "コーヒーには、いつもさとうを入れないで飲みます。",
          "romaji": "koohii ni wa, itsumo satou o irenaide nomimasu.",
          "en": "I always drink coffee without putting any sugar in it."
        },
        {
          "jp": "彼女はカサを持たないで出てしまった。",
          "romaji": "kanojo wa kasa o mota naide deteshimatta.",
          "en": "She left without bringing an umbrella."
        },
        {
          "jp": "昨日は疲れていて、電気を消さないで寝てしまった。",
          "romaji": "kinou wa tsukarete ite, denki o kesanaide nete shimatta.",
          "en": "Yesterday I was so tired I fell asleep without turning off the lights."
        },
        {
          "jp": "今朝、朝ごはんを食べないで仕事に来ました。",
          "romaji": "kesa, asa gohan o tabenaide shigoto ni kimashita.",
          "en": "I came to work today without eating any breakfast."
        },
        {
          "jp": "昨日、お風呂に入らないで寝てしまった。",
          "romaji": "kinou, ofuro ni haira naide neteshimatta.",
          "en": "I went to bed yesterday without taking a bath/shower."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%84%e3%81%a7-naide-meaning/"
    },
    {
      "grammar": "ないでください",
      "meaning": "please don't do ~",
      "structure": "Verb (ない form) + で ください → ください",
      "explanation": "行か ないでください 。 ika naide kudasai. Please don’t go! ika naide kudasai. Please don’t go!",
      "examples": [
        {
          "jp": "泣かないでください。",
          "romaji": "nakanaide kudasai",
          "en": "Please don't cry."
        },
        {
          "jp": "このパソコンを使わないでください。",
          "romaji": "kono pasokon o tsukawanaide kudasai.",
          "en": "Please don't use this computer."
        },
        {
          "jp": "明日の予定を忘れないでください。",
          "romaji": "ashita no yotei o wasure naide kudasai.",
          "en": "Don't forget about our plans tomorrow!"
        },
        {
          "jp": "私のことを心配しないでください。",
          "romaji": "watashi no koto o shinpai shi naide kudasai.",
          "en": "Please don't worry about me."
        },
        {
          "jp": "道の邪魔をしないでください。",
          "romaji": "michi no jama o shi naide kudasai",
          "en": "Please don't block the street."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%84%e3%81%a7%e3%81%8f%e3%81%a0%e3%81%95%e3%81%84-naide-kudasai-meaning/"
    },
    {
      "grammar": "ないといけない",
      "meaning": "must do; have an obligation to do ~",
      "structure": "Verb (ない form) + と いけない いけません ダメです → いけない いけません ダメです",
      "explanation": "",
      "examples": [
        {
          "jp": "そろそろ寝ないといけない。",
          "romaji": "sorosoro nenaito ikenai.",
          "en": "I have to sleep soon."
        },
        {
          "jp": "私は家に帰らないといけない。",
          "romaji": "watashi wa ie ni kaeranaito ikenai.",
          "en": "I have to go home."
        },
        {
          "jp": "今から勉強をしないといけない。",
          "romaji": "ima kara benkyou o shinaito ikenai.",
          "en": "I have to study now."
        },
        {
          "jp": "明日から働かないといけない。",
          "romaji": "ashita kara hatarakanaito ikenai.",
          "en": "I have to work from tomorrow."
        },
        {
          "jp": "この薬を飲まないといけませんか。",
          "romaji": "kono kusuri o nomanaito ikemasen ka?",
          "en": "Do I have to take this medicine?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%84%e3%81%a8%e3%81%84%e3%81%91%e3%81%aa%e3%81%84-naito-ikenai-meaning/"
    }
  ],
  "N4": [
    {
      "grammar": "間",
      "meaning": "while; during; between ~",
      "structure": "Verb (dictionary form) 間 Noun + の → 間 Noun + の → Noun + の | Noun + の",
      "explanation": "電車に乗っている 間 、ずっと本を読んでいました。 densha ni notteiru aida, zutto hon o yonde imashita. I read a book the entire time I was on the train. densha ni notteiru aida, zutto hon o yonde imashita. I read a book the entire time I was on the train.",
      "examples": [
        {
          "jp": "昨日は、家にいる間、ずっとテレビを見ていました。",
          "romaji": "kinou wa, ie ni iru aida, zutto terebi o miteimashita.",
          "en": "Yesterday, while I was home I watched TV the entire time."
        },
        {
          "jp": "日本にいる間は、毎日日本語を話すつもりです。",
          "romaji": "nihon ni iru aida wa, mainichi nihongo o hanasu tsumori desu.",
          "en": "I plan to speak Japanese everyday while I am in Japan."
        },
        {
          "jp": "サイクリングをしている間、ずっと雨が降っていました。",
          "romaji": "saikuringu o shiteiru aida, zutto ame ga futteimashita.",
          "en": "It rained the entire time I was cycling."
        },
        {
          "jp": "食事の間、彼女と一緒に映画を見ました。",
          "romaji": "shokuji no aida, kanojo to isshoni eiga o mimashita.",
          "en": "While eating dinner, I watched a movie together with my girlfriend."
        },
        {
          "jp": "学校にいる間は、スマホを使ってはいけません。",
          "romaji": "gakkou ni iru aida wa, sumaho o tsukatte wa ikemasen.",
          "en": "We can't use our smartphones while in school."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e9%96%93-aida-meaning/"
    },
    {
      "grammar": "間に",
      "meaning": "while; during~ something happened",
      "structure": "Verb (casual, non-past) 間に Noun + の な-adjective + な い-adjective → 間に Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "待っている 間に 本を読んだ。 matteiru aida ni hon o yonda. I read a book while I waited. matteiru aida ni hon o yonda. I read a book while I waited.",
      "examples": [
        {
          "jp": "夜の間に火事が起こった。",
          "romaji": "yoru no aida ni kaji ga okotta.",
          "en": "A fire broke out during the night."
        },
        {
          "jp": "知らない間に寝ていた。",
          "romaji": "shiranai aida ni neteita.",
          "en": "I fell asleep before I even realized it."
        },
        {
          "jp": "日本にいる間に、日本語が上手になりたいです。",
          "romaji": "nihon ni iru aida ni, nihongo ga jouzu ni naritai desu.",
          "en": "I want to get good at Japanese while I'm in Japan."
        },
        {
          "jp": "休みの間に漢字を200個覚えた。",
          "romaji": "yasumi no aida ni kanji o ni hyaku ko oboeta.",
          "en": "I memorized 200 kanji over the break."
        },
        {
          "jp": "先生がいない間にスマホを見ていた。",
          "romaji": "sensei ga inai aida ni, sumaho o miteita.",
          "en": "I looked at my smartphone while the teacher was gone."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e9%96%93%e3%81%ab-aida-ni-meaning/"
    },
    {
      "grammar": "あまり～ない",
      "meaning": "not very, not much ~",
      "structure": "あまり い-adjective + い くない な-adjective + な じゃない Verb (ない form) → い-adjective + い くない な-adjective + な じゃない Verb (ない form) → な-adjective + な じゃない Verb (ない form) → Verb (ない form) | な-adjective + な じゃない Verb (ない form) → Verb (ない form) | Verb (ない form)",
      "explanation": "",
      "examples": [
        {
          "jp": "私はあまり運動しない。",
          "romaji": "watashi wa amari undou shinai.",
          "en": "I don't really exercise."
        },
        {
          "jp": "日本語があまり分からない。",
          "romaji": "nihongo ga amari wakaranai.",
          "en": "I don't really understand Japanese."
        },
        {
          "jp": "ホラー映画はあまり見ない。",
          "romaji": "horaa eiga wa amari minai",
          "en": "I don't really watch horror movies."
        },
        {
          "jp": "彼はあまり速く走ることができない。",
          "romaji": "kare wa amari hayaku hashiru koto ga dekinai.",
          "en": "He can't run very fast."
        },
        {
          "jp": "この文法があまり分かりません。教えてください。",
          "romaji": "kono bunpo ga amari wakarimasen. Oshiete kudasai.",
          "en": "I don't understand this grammar very well, could you please explain it to me?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%be%e3%82%8a%ef%bd%9e%e3%81%aa%e3%81%84-amarinai-meaning/"
    },
    {
      "grammar": "後で",
      "meaning": "after~; later",
      "structure": "Verb (た form) 後で あとで Noun + の → 後で あとで Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "図書館で宿題をしたあとで、帰ります。",
          "romaji": "toshokan de shukudai o shita ato de, kaerimasu.",
          "en": "I will head home after I finish my homework at the library."
        },
        {
          "jp": "晩ご飯の後でアイスを食べた。",
          "romaji": "bangohan no ato de aisu o tabeta",
          "en": "After dinner, I had some ice cream."
        },
        {
          "jp": "授業が終わった後で、部活に行く。",
          "romaji": "jugyou ga owatta ato de, bukatsu ni iku.",
          "en": "After classes finish, I will go to my club activities."
        },
        {
          "jp": "お酒を飲んだ後で、運転してはダメですよ！",
          "romaji": "osake o nonda ato de, unten shitewa dame desu yo.",
          "en": "Driving after drinking is not permitted."
        },
        {
          "jp": "昼ご飯を食べた後で、30分ほど昼寝をした。",
          "romaji": "hiru gohan o tabeta ato de, sanjuu pun hodo hirune o shita.",
          "en": "After eating dinner, I took a nap for about a half hour."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%be%8c%e3%81%a7-%e3%81%82%e3%81%a8%e3%81%a7-ato-de-meaning/"
    },
    {
      "grammar": "ば",
      "meaning": "conditional form; If [A] then [B]",
      "structure": "special formatting rules (see below)",
      "explanation": "行 く = いく = iku = to go ku changes to ke 行 けば = いけば = ikeba = if (you) go 食べ る = たべる = taberu = to eat ru changes to re 食べ れば = たべれば = tabereba = if (you) eat",
      "examples": [
        {
          "jp": "このボタンを押せば、ドアが開きます。",
          "romaji": "kono botan o oseba, doa ga hirakimasu.",
          "en": "If you push this button, the door will open."
        },
        {
          "jp": "あなたが行けば、わたしも行くよ。",
          "romaji": "anata ga ikeba, watashi mo iku yo.",
          "en": "If you go, then I'm going too."
        },
        {
          "jp": "今すぐ出発すれば間に合うでしょう。",
          "romaji": "ima sugu shuppatsu sureba ma ni au deshou.",
          "en": "If you leave right away, you'll likely make it in time."
        },
        {
          "jp": "毎日練習をすれば、上手になるよ。",
          "romaji": "mainichi renshuu o sureba, jouzu ni naru yo.",
          "en": "If you practice everyday, you're going to improve!"
        },
        {
          "jp": "数週間もすれば、みんな忘れるよ。",
          "romaji": "suushuukan mo sureba, minna wasureru yo.",
          "en": "Everyone will forget this in a few weeks."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0-ba-conditional-form-meaning/"
    },
    {
      "grammar": "場合は",
      "meaning": "in the event of; in the case that ~",
      "structure": "Verb (casual) 場合は ばあいは Noun + の な-adjective + な い-adjective → 場合は ばあいは Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "パスワードを忘れた場合は、こちらからご連絡ください。",
          "romaji": "pasuwaado o wasureta baai wa, kochira kara gorenraku kudasai.",
          "en": "If you forget your password, please contact us here."
        },
        {
          "jp": "火事の場合は、119をかけます。",
          "romaji": "kaji no baai wa, 119 o kakemasu.",
          "en": "In the event of a fire, call 119."
        },
        {
          "jp": "地震が起きた場合は、テーブルの下に潜ってください。",
          "romaji": "jishin ga okita baai wa, teeburu no shita ni mogutte kudasai.",
          "en": "In the case of an earthquake, cover yourself under a table."
        },
        {
          "jp": "避難する場合は、車を使わないで必ず歩きます。",
          "romaji": "hinan suru baai wa, kuruma o tsukawanaide kanarazu arukimasu.",
          "en": "In an evacuation, make sure to walk instead of use your car."
        },
        {
          "jp": "授業に間に合わない場合は、連絡してください。",
          "romaji": "jugyou ni ma ni awanai baai wa, renraku shite kudasai.",
          "en": "In the case that you will not make it to class on time, please contact us."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%a0%b4%e5%90%88%e3%81%af-baai-wa-meaning/"
    },
    {
      "grammar": "ばかり",
      "meaning": "only; nothing but ~",
      "structure": "Noun ばかり Verb (て form) → ばかり Verb (て form) → Verb (て form) | Verb (て form)",
      "explanation": "6月は雨 ばかり です！ roku gatsu wa ame bakari desu! It’s constantly raining in June / It’s nothing but rain, It’s always raining, etc.. roku gatsu wa ame bakari desu! It’s constantly raining in June / It’s nothing but rain, It’s always raining, etc..",
      "examples": [
        {
          "jp": "娘はテレビばかり見ている。",
          "romaji": "musume wa terebi bakari miteiru.",
          "en": "My daughter does nothing but watch TV."
        },
        {
          "jp": "彼はお金ばかり考えている。",
          "romaji": "kare wa o kane bakari kangaiteiru.",
          "en": "He only thinks about money."
        },
        {
          "jp": "甘いものばかり食べると太ります。",
          "romaji": "amaimono bakari taberu to futorimasu.",
          "en": "If you just eat sweets you're gonna gain weight."
        },
        {
          "jp": "嘘ばかりつく人が嫌いだ。",
          "romaji": "uso bakari tsuku hito ga kirai da.",
          "en": "I hate people who always lie."
        },
        {
          "jp": "得るものはなく、失うものばかりだ。",
          "romaji": "eru mono wa naku, ushinau mono bakari da.",
          "en": "You have nothing to gain, but everything to lose."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a-bakari-meaning/"
    },
    {
      "grammar": "だけで",
      "meaning": "just by; just by doing",
      "structure": "Verb (casual) だけで Noun → だけで Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "あなたに会うだけで元気になる。",
          "romaji": "anata ni au dake de genki ni naru.",
          "en": "I get energetic from just meeting you."
        },
        {
          "jp": "あなたの写真を見るだけでうれしい。",
          "romaji": "anata no shashin o miru dake de ureshii.",
          "en": "I'm happy to just see your picture."
        },
        {
          "jp": "宿題のことを考えるだけでやる気がなくなります。",
          "romaji": "shukudai no koto o kangaeru dake de yaruki ga naku narimasu.",
          "en": "Just by thinking of my homework I start to lose motivation."
        },
        {
          "jp": "二人だけで少し話がしたい。",
          "romaji": "futari dake de sukoshi hanashi ga shitai.",
          "en": "I want to talk together just the two of us."
        },
        {
          "jp": "彼女のことを思うだけでドキドキする。",
          "romaji": "kanojo no koto o omou dake de doki doki suru.",
          "en": "I get worked up just thinking about her."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%a7-dake-de-meaning/"
    },
    {
      "grammar": "出す",
      "meaning": "to begin to; to start to; to burst into; ... out (e.g. to jump out, to carry out)​",
      "structure": "Verb ます (stem form) 出す だす → 出す だす",
      "explanation": "",
      "examples": [
        {
          "jp": "雨が急に降り出した。",
          "romaji": "ame ga kyuu ni furi dashita.",
          "en": "It suddenly started raining."
        },
        {
          "jp": "彼は店から飛び出した。",
          "romaji": "kare wa mise kara tobi dashita.",
          "en": "He dashed out of the store."
        },
        {
          "jp": "校長室へ呼び出された。",
          "romaji": "kouchoushitsu e yobi dasareta.",
          "en": "I was called into the principal's office."
        },
        {
          "jp": "それを運び出してくれますか。",
          "romaji": "sore o hakobi dashite kuremasu ka?",
          "en": "Would you please carry that out for me?"
        },
        {
          "jp": "朝食後すぐに飛び出した。",
          "romaji": "choushoku go sugu ni tobi dashita.",
          "en": "I dashed out right after breakfast."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%87%ba%e3%81%99-dasu-meaning/"
    },
    {
      "grammar": "でございます",
      "meaning": "to be (honorific)",
      "structure": "です -> でございます ではありません -> でございません → でございます ではありません -> でございません → ではありません -> でございません → でございません | ではありません -> でございません → でございません",
      "explanation": "",
      "examples": [
        {
          "jp": "お釣でございます。",
          "romaji": "otsuri de gozaimasu.",
          "en": "Here is your change."
        },
        {
          "jp": "初めまして、経理部の佐藤でございます。",
          "romaji": "hajime mashite, keiribu no satou degozaimasu.",
          "en": "Nice to meet you, I am Satou from accounting."
        },
        {
          "jp": "この件に関しましては、ただいま確認中でございます。",
          "romaji": "kono ken ni kanshi mashite wa, tadaima kakuninchuu degozaimasu.",
          "en": "We are currently confirming this case."
        },
        {
          "jp": "私からは以上でございます。",
          "romaji": "watashi kara wa ijou de gozaimasu.",
          "en": "I do not have any further statements to make."
        },
        {
          "jp": "予約で満員でございます。",
          "romaji": "yoyaku wa man'in de gozaimasu.",
          "en": "We are fully booked up."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%94%e3%81%96%e3%81%84%e3%81%be%e3%81%99-de-gozaimasu-meaning/"
    },
    {
      "grammar": "でも",
      "meaning": "... or something; how about~",
      "structure": "Noun でも → でも",
      "explanation": "",
      "examples": [
        {
          "jp": "水でも飲みますか？",
          "romaji": "mizu demo nomimasu ka?",
          "en": "Would you care for some water or something to drink?"
        },
        {
          "jp": "牛丼でもしましょうか？",
          "romaji": "gyuudon demo shimashou ka?",
          "en": "Shall we go with something like the beef bowl?"
        },
        {
          "jp": "寒いから、暖かいものでも飲みませんか。",
          "romaji": "samui kara, atatakai mono demo nomimasen ka.",
          "en": "It's a bit cold so why don't we get something warm to drink?"
        },
        {
          "jp": "晩ご飯ならサラダでも作りましょうか？",
          "romaji": "bangohan nara sarada demo tsukuri mashouka?",
          "en": "Should I make a salad for dinner?"
        },
        {
          "jp": "ちょっと時間があるからゲームでもしましょうか？",
          "romaji": "chotto jikan ga aru kara geemu demo shimashou ka？",
          "en": "We have a little time, let’s play games or something？"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82-demo-meaning-something/"
    },
    {
      "grammar": "ではないか",
      "meaning": "right?; isn't it?",
      "structure": "phrase ではないか ではありませんか → ではないか ではありませんか",
      "explanation": "",
      "examples": [
        {
          "jp": "トムではないか。",
          "romaji": "tomu dewa nai ka.",
          "en": "Well if it isn't Tom?"
        },
        {
          "jp": "何ときれいではないか。",
          "romaji": "nanto kirei dewa nai ka.",
          "en": "How pretty!"
        },
        {
          "jp": "すばらしい天気ではないか。",
          "romaji": "subarashii tenki dewa nai ka.",
          "en": "What wonderful weather we're having, eh?"
        },
        {
          "jp": "明日は雨ではないかと思う。",
          "romaji": "ashita wa ame dewa nai ka to omou.",
          "en": "I think it will rain tomorrow."
        },
        {
          "jp": "彼は病気ではないかと思う。",
          "romaji": "kare wa byouki dewa nai ka to omou.",
          "en": "I suspect that he's sick."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84%e3%81%8b-dewa-nai-ka-meaning/"
    },
    {
      "grammar": "が必要",
      "meaning": "need; necessary",
      "structure": "Noun が必要 は必要 → が必要 は必要",
      "explanation": "",
      "examples": [
        {
          "jp": "それは必要だ。",
          "romaji": "sore wa hitsuyou da.",
          "en": "It is necessary."
        },
        {
          "jp": "君が必要だ。",
          "romaji": "kimi ga hitsuyou da.",
          "en": "I need you!"
        },
        {
          "jp": "サインは必要ですか？",
          "romaji": "sain wa hitsuyou desu ka?",
          "en": "Is a signature required?"
        },
        {
          "jp": "サッカーを練習する場所が必要です。",
          "romaji": "sakkaa o renshuu suru basho ga hitsuyou desu.",
          "en": "I need a place to practice soccer."
        },
        {
          "jp": "私は少し考える時間が必要です。",
          "romaji": "watashi wa sukoshi kangaeru jikan ga hitsuyou desu.",
          "en": "I need some time to think it over."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e5%bf%85%e8%a6%81-ga-hitsuyou-meaning/"
    },
    {
      "grammar": "がする",
      "meaning": "to smell; hear; taste",
      "structure": "Noun がする がします がしている → がする がします がしている",
      "explanation": "",
      "examples": [
        {
          "jp": "甘い味がする。",
          "romaji": "amai aji ga suru.",
          "en": "It has a sweet taste."
        },
        {
          "jp": "人の声がする。",
          "romaji": "hito no koe ga suru.",
          "en": "I can hear someone's voice."
        },
        {
          "jp": "ガスの匂いがする。",
          "romaji": "gasu no nioi ga suru.",
          "en": "I smell gas."
        },
        {
          "jp": "このクッキーはしょうがの味がする。",
          "romaji": "kono kukkii wa shouga no aji ga suru.",
          "en": "I can taste ginger in this cookie."
        },
        {
          "jp": "このフルーツはどんな味がする？",
          "romaji": "kono furuutsu wa donna aji ga suru?",
          "en": "What kind of flavor does this fruit have?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%99%e3%82%8b-ga-suru-meaning/"
    },
    {
      "grammar": "がり",
      "meaning": "personality (someone tends to; has a tendency to; has a sensitivity to ~)",
      "structure": "な-adjective がり い-adjective い → がり い-adjective い → い-adjective い | い-adjective い",
      "explanation": "scaredy cat; someone who is easily scared; tends to scare easily shy person; someone who tends to be shy",
      "examples": [
        {
          "jp": "彼女は寂しがり屋です。",
          "romaji": "kanojo wa sabishi gari ya desu.",
          "en": "She is a lonely person."
        },
        {
          "jp": "この仕事は恥ずかしがりの人には向いていない 。",
          "romaji": "kono shigoto wa hazukashi gari no hito ni wa muiteinai.",
          "en": "This job is not suited for shy people."
        },
        {
          "jp": "彼は強がりだけど、優しい心の人です。",
          "romaji": "kare wa tsuyogari dakedo, yasashii kokoro no hito desu.",
          "en": "He acts tough, but he has a kind heart."
        },
        {
          "jp": "彼女は怖がりだからホラー映画はダメだ。",
          "romaji": "kanojo wa kowa gari dakara horaa eiga wa dame da",
          "en": "She tends to scare easily so horror movies are not good."
        },
        {
          "jp": "私は寒がりなので、冬はあまり好きじゃない。",
          "romaji": "watashi wa samu gari nanode, fuyu wa amari suki janai.",
          "en": "I'm sensitive to the cold, so I don't really like winter."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%82%8a-gari-meaning/"
    },
    {
      "grammar": "がる / がっている",
      "meaning": "to show signs of; to appear; to feel, to think ~",
      "structure": "な-adjective がる がっている がった がらないで い-adjective い → がる がっている がった がらないで い-adjective い → い-adjective い | い-adjective い",
      "explanation": "彼は犬を怖 がる 。 kare wa inu o kowa garu. He is (appears to be/seems to be) generally afraid of dogs. kare wa inu o kowa garu. He is (appears to be/seems to be) generally afraid of dogs.",
      "examples": [
        {
          "jp": "怖がらないでください。",
          "romaji": "kowa garanai de kudasai.",
          "en": "Please don't feel scared."
        },
        {
          "jp": "彼は死ぬのを怖がっている。",
          "romaji": "kare wa shinu no o kowa gatteiru.",
          "en": "He is afraid of death."
        },
        {
          "jp": "彼は彼女が欲しがるバッグを買ってあげた。",
          "romaji": "kare wa kanojo ga hoshi garu baggu o katte ageta.",
          "en": "He bought her the bag she wanted."
        },
        {
          "jp": "彼は負けて残念がっている。",
          "romaji": "kare wa makete zannen gatteiru.",
          "en": "He appears to be disappointed at his defeat."
        },
        {
          "jp": "恥ずかしがらないで、前に出てきてください。",
          "romaji": "hazukashi garanai de, mae ni dete kite kudasai.",
          "en": "Please don't feel shy and come up to the front."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%82%8b-garu-%e3%81%8c%e3%81%a3%e3%81%a6%e3%81%84%e3%82%8b-gatteiru-meaning/"
    },
    {
      "grammar": "ございます",
      "meaning": "to be, to exist (the polite form of いる/ある)",
      "structure": "あります changes to ございます います changes to ございます → います changes to ございます | います changes to ございます",
      "explanation": "",
      "examples": [
        {
          "jp": "ご質問はございますか。",
          "romaji": "go shitsumon wa gozaimasu ka",
          "en": "Are there any questions?"
        },
        {
          "jp": "お忘れ物はございませんか。",
          "romaji": "o wasure mono wa gozaimasen ka?",
          "en": "Are there any lost items?"
        },
        {
          "jp": "お時間がございますか？",
          "romaji": "ojikan ga gozaimasu ka?",
          "en": "Do you have some time?"
        },
        {
          "jp": "電話は階段の横にございます。",
          "romaji": "denwa wa kaidan no yoko ni gozaimasu.",
          "en": "The phone is next to the stairs."
        },
        {
          "jp": "お問い合わせいただいた商品については在庫がございます。",
          "romaji": "o toiawase itadaita shouhin ni tsuite wa zaiko ga gozaimasu.",
          "en": "We have stock of the item from your inquiry."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%94%e3%81%96%e3%81%84%e3%81%be%e3%81%99-gozaimasu-meaning/"
    },
    {
      "grammar": "始める",
      "meaning": "to start; to begin to ~",
      "structure": "Verb ます (stem form) はじめる はじめた はじめている → はじめる はじめた はじめている",
      "explanation": "",
      "examples": [
        {
          "jp": "食べ始める。",
          "romaji": "tabe hajimeru.",
          "en": "To begin eating."
        },
        {
          "jp": "雨が降り始めた。",
          "romaji": "ame ga furi hajimeta.",
          "en": "It started to rain."
        },
        {
          "jp": "いつそれをやり始めるの？",
          "romaji": "itsu sore o yari hajimeru no?",
          "en": "When will you start doing that?"
        },
        {
          "jp": "今朝、歯が痛くなり始めた。",
          "romaji": "kesa, ha ga itaku nari hajimeta.",
          "en": "My tooth started hurting this morning."
        },
        {
          "jp": "私はまだ走り始めていない。",
          "romaji": "watashi wa mada hashiri hajimete inai.",
          "en": "I still haven't started running."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%a7%8b%e3%82%81%e3%82%8b-hajimeru-%e5%a7%8b%e3%82%81%e3%81%9f-meaning/"
    },
    {
      "grammar": "はずだ",
      "meaning": "it must be; it should be (expectation)",
      "structure": "Verb (dictionary form) はずだ Noun + の な-adjective + な い-adjective → はずだ Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "あなたなら分かるはずだ。",
          "romaji": "anata nara wakaru hazu da.",
          "en": "You should know this."
        },
        {
          "jp": "彼は今学校にいるはずだ。",
          "romaji": "kare wa ima gakkou ni iru hazu da.",
          "en": "He should be in school right now."
        },
        {
          "jp": "お父さんがそろそろ家に帰るはずだ。",
          "romaji": "otousan ga sorosoro ie ni kaeru hazu da.",
          "en": "Father should be returning home anytime now."
        },
        {
          "jp": "今日は祝日だから、銀行は休みのはずだ。",
          "romaji": "kyou wa shukujitsu dakara, ginkou wa yasumi no hazu da.",
          "en": "Today is a national holiday, so surely the banks are closed."
        },
        {
          "jp": "それは明らかなはずだ。",
          "romaji": "sore wa akirakana hazu da.",
          "en": "That should be obvious."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%af%e3%81%9a%e3%81%a0-hazu-da-meaning/"
    },
    {
      "grammar": "はずがない",
      "meaning": "cannot be (impossible)",
      "structure": "Verb (dictionary form) はずがない はずがありません Noun + の な-adjective + な い-adjective → はずがない はずがありません Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "そんなはずがない。",
          "romaji": "sonna hazu ga nai.",
          "en": "That can't be true."
        },
        {
          "jp": "彼女の話は本当のはずがない。",
          "romaji": "kanojo no hanashi wa hontou no hazu ga nai.",
          "en": "Her story can't be true."
        },
        {
          "jp": "彼はそんなことを言うはずがない。",
          "romaji": "kare wa sonna koto o iu hazu ga nai.",
          "en": "He would never say such a thing."
        },
        {
          "jp": "ジョンが嘘をついているはずがない。",
          "romaji": "jon ga uso o tsuiteiru hazu ga nai.",
          "en": "There's no way that John is lying."
        },
        {
          "jp": "そんな大きな量を全部食べられるはずがない。",
          "romaji": "sonna ookina ryou o zenbu taberareru hazu ga nai.",
          "en": "There's no way you're going to be able to eat all of that."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%af%e3%81%9a%e3%81%8c%e3%81%aa%e3%81%84-hazu-ga-nai-meaning/"
    },
    {
      "grammar": "はずがない",
      "meaning": "cannot be (impossible)",
      "structure": "Verb (dictionary form) はずがない はずがありません Noun + の な-adjective + な い-adjective → はずがない はずがありません Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "そんなはずがない。",
          "romaji": "sonna hazu ga nai.",
          "en": "That can't be true."
        },
        {
          "jp": "彼女の話は本当のはずがない。",
          "romaji": "kanojo no hanashi wa hontou no hazu ga nai.",
          "en": "Her story can't be true."
        },
        {
          "jp": "彼はそんなことを言うはずがない。",
          "romaji": "kare wa sonna koto o iu hazu ga nai.",
          "en": "He would never say such a thing."
        },
        {
          "jp": "ジョンが嘘をついているはずがない。",
          "romaji": "jon ga uso o tsuiteiru hazu ga nai.",
          "en": "There's no way that John is lying."
        },
        {
          "jp": "そんな大きな量を全部食べられるはずがない。",
          "romaji": "sonna ookina ryou o zenbu taberareru hazu ga nai.",
          "en": "There's no way you're going to be able to eat all of that."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%af%e3%81%9a%e3%81%8c%e3%81%aa%e3%81%84-hazu-ga-nai-meaning/"
    },
    {
      "grammar": "必要がある",
      "meaning": "need to; it is necessary to",
      "structure": "Verb (dictionary form) 必要がある 必要がない → 必要がある 必要がない",
      "explanation": "私はもっと勉強する 必要がある 。 watashi wa motto benkyou suru hitsuyou ga aru. I need to study more. watashi wa motto benkyou suru hitsuyou ga aru. I need to study more.",
      "examples": [
        {
          "jp": "彼らは休む必要がある。",
          "romaji": "karera wa yasumu hitsuyou ga aru.",
          "en": "They need to rest."
        },
        {
          "jp": "もっと勉強する必要がある。",
          "romaji": "motto benkyou suru hitsuyou ga aru.",
          "en": "I need to study more."
        },
        {
          "jp": "私の弟は今日学校に行く必要がない。",
          "romaji": "watashi no otouto wa kyou gakkou ni iku hitsuyou ga nai.",
          "en": "My younger brother doesn't need to go to school today."
        },
        {
          "jp": "俺にはもう必要がない。",
          "romaji": "ore ni wa mou hitsuyou ga nai.",
          "en": "I have no need for this anymore."
        },
        {
          "jp": "何でそんなことをする必要があるんですか？",
          "romaji": "nande sonna koto o suru hitsuyou ga aru n desu ka?",
          "en": "Why is it necessary to do that?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%bf%85%e8%a6%81%e3%81%8c%e3%81%82%e3%82%8b-hitsuyou-ga-aru-meaning/"
    },
    {
      "grammar": "意向形",
      "meaning": "volitional form​; let's do ~",
      "structure": "see conjugation rules below...",
      "explanation": "食べ る → 食べ よう (tabe ru → tabe you ) let’s eat 食べ る → 食べ ましょう (tabe ru → tabe mashou ) let’s eat",
      "examples": [
        {
          "jp": "今日から自転車で出勤しよう。",
          "romaji": "kyou kara jitensha de shukkin shiyou.",
          "en": "Let's start commuting by bicycle from today!"
        },
        {
          "jp": "もう11時だ。早く寝よう。",
          "romaji": "mou 11 ji da. hayaku neyou.",
          "en": "It's already 11pm, let's hurry and go to sleep."
        },
        {
          "jp": "重たそうだね。手伝おうか。",
          "romaji": "omota sou da ne. tetsudaou ka?",
          "en": "That looks heavy, shall I give you a hand?"
        },
        {
          "jp": "今日は食堂で昼食を食べよう。",
          "romaji": "kyou wa shokudou de chuushoku o tabeyou.",
          "en": "Let's eat lunch at the dining room today."
        },
        {
          "jp": "図書館で一緒に勉強しよう。",
          "romaji": "toshokan de issho ni benkyou shiyou.",
          "en": "Let's study together at the library."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%84%8f%e5%90%91%e5%bd%a2-ikou-kei-volitional-form-meaning/"
    },
    {
      "grammar": "いらっしゃる",
      "meaning": "to be; to come; to go (polite version)",
      "structure": "いる (changes to) 来る (changes to) 行く (changes to) いらっしゃる Verb (て form) + いらっしゃる → いらっしゃる Verb (て form) + いらっしゃる → Verb (て form) + いらっしゃる → + いらっしゃる | Verb (て form) + いらっしゃる → + いらっしゃる",
      "explanation": "",
      "examples": [
        {
          "jp": "質問のある方はいらっしゃいませんか。",
          "romaji": "shitsumon no aru kata wa irasshaimasen ka.",
          "en": "Does anyone have any questions?"
        },
        {
          "jp": "校長先生は図書館にいらっしゃいます。",
          "romaji": "kouchou sensei wa toshokan ni irasshaimasu.",
          "en": "The headmaster is in the library."
        },
        {
          "jp": "私たちと一緒にいらっしゃいませんか？",
          "romaji": "watashitachi to isshoni irasshaimasen ka?",
          "en": "Wouldn't you like to come with us?"
        },
        {
          "jp": "先生、何時まで学校にいらっしゃいますか。",
          "romaji": "sensei, nanji made gakkou ni irasshaimasu ka.",
          "en": "Teacher, until what time will you remain at school?"
        },
        {
          "jp": "先生はあなたを信じていらっしゃる。",
          "romaji": "sensei wa anata o shinjite irassharu.",
          "en": "Our teacher believes in you."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%82%89%e3%81%a3%e3%81%97%e3%82%83%e3%82%8b-irassharu-meaning/"
    },
    {
      "grammar": "いたします",
      "meaning": "to do (polite form of する)",
      "structure": "する (changes to) いたす します (changes to) いたします お/ご + Verb ます (stem) いたします → いたす します (changes to) いたします お/ご + Verb ます (stem) いたします → します (changes to) いたします お/ご + Verb ます (stem) いたします → いたします お/ご + Verb ます (stem) いたします → お/ご + Verb ます (stem) いたします → いたします | します (changes to) いたします お/ご + Verb ます (stem) いたします → いたします お/ご + Verb ます (stem) いたします → お/ご + Verb ます (stem) いたします → いたします | お/ご + Verb ます (stem) いたします → いたします",
      "explanation": "",
      "examples": [
        {
          "jp": "失礼いたします。",
          "romaji": "shitsurei itashimasu.",
          "en": "Excuse me."
        },
        {
          "jp": "この仕事は私がいたします。",
          "romaji": "kono shigoto wa watashi ga itashimasu.",
          "en": "I will do this job."
        },
        {
          "jp": "お席にご案内いたします。",
          "romaji": "oseki ni goannai itashimasu.",
          "en": "I’ll take you to your seat."
        },
        {
          "jp": "新幹線の予約は私がいたします。",
          "romaji": "shinkansen no yoyaku wa watashi ga itashimasu.",
          "en": "I’ll book the shinkansen bullet train tickets."
        },
        {
          "jp": "荷物は私が明日にお届けいたします。",
          "romaji": "nimotsu wa watashi ga ashita ni otodoke itashimasu.",
          "en": "I’ll send the luggage tomorrow."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%9f%e3%81%97%e3%81%be%e3%81%99-itashimasu-meaning/"
    },
    {
      "grammar": "じゃないか",
      "meaning": "right? isn't it? let's~; confirmation",
      "structure": "phrase じゃないか → じゃないか",
      "explanation": "",
      "examples": [
        {
          "jp": "行こうじゃないか。",
          "romaji": "ikou janai ka.",
          "en": "Let's go, shall we?"
        },
        {
          "jp": "ダメじゃないか。",
          "romaji": "dame janai ka.",
          "en": "You should know that's no good / you can't do that."
        },
        {
          "jp": "だから言ったじゃないか！",
          "romaji": "dakara itta janai ka!",
          "en": "I told you so! (didn't I?)"
        },
        {
          "jp": "今夜外食しようじゃないか。",
          "romaji": "konya gaishoku shiyou janai ka.",
          "en": "Let's go out for dinner tonight, shall we?"
        },
        {
          "jp": "今日は元気そうじゃないか。",
          "romaji": "kyou wa genki sou janai ka.",
          "en": "Well aren't you looking quite energetic today?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%98%e3%82%83%e3%81%aa%e3%81%84%e3%81%8b-janai-ka-meaning/"
    },
    {
      "grammar": "かどうか",
      "meaning": "whether or not ~",
      "structure": "Verb (casual form) かどうか Noun な-adjective い-adjective → かどうか Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "明日晴れるかどうか知らない。",
          "romaji": "ashita hareru ka dou ka shiranai.",
          "en": "I don't know if the weather will be clear or not tomorrow."
        },
        {
          "jp": "それが正しいかどうかわからない。",
          "romaji": "sore ga tadashii ka dou ka wakaranai.",
          "en": "I'm not sure if that is correct or not."
        },
        {
          "jp": "行くかどうか後で電話で知らせます。",
          "romaji": "iku ka douka atode denwa de shirasemasu.",
          "en": "Whether or not I go, I'll let you know later by phone."
        },
        {
          "jp": "おいしいかどうか食べないとわからない。",
          "romaji": "oishii ka douka tabenai to wakaranai.",
          "en": "We won't know if it's good or not until we eat it."
        },
        {
          "jp": "名前を書いたかどうか、もう一度チェックしてください。",
          "romaji": "namae o kaita ka douka, mou ichido chekku shite kudasai.",
          "en": "Please check again whether or not you wrote the name."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%a9%e3%81%86%e3%81%8b-ka-dou-ka-meaning/"
    },
    {
      "grammar": "かしら",
      "meaning": "I wonder (feminine)",
      "structure": "phrase かしら → かしら",
      "explanation": "",
      "examples": [
        {
          "jp": "本当かしら。",
          "romaji": "hontou ka shira.",
          "en": "I wonder if that's true."
        },
        {
          "jp": "どこへ行ったかしら。",
          "romaji": "doko e itta ka shira.",
          "en": "I wonder where they could have gone?"
        },
        {
          "jp": "誰かしら。",
          "romaji": "dare ka shira.",
          "en": "I wonder who that is."
        },
        {
          "jp": "彼は本気かしら。",
          "romaji": "kare wa honki ka shira.",
          "en": "I wonder if he is serious."
        },
        {
          "jp": "明日は雨かしら。",
          "romaji": "ashita wa ame ka shira.",
          "en": "I wonder if it will rain tomorrow."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%97%e3%82%89-ka-shira-meaning/"
    },
    {
      "grammar": "かい",
      "meaning": "turns a sentence into a yes/no question",
      "structure": "Sentence かい → かい",
      "explanation": "",
      "examples": [
        {
          "jp": "歩けるかい？",
          "romaji": "arukeru kai?",
          "en": "Can you walk?"
        },
        {
          "jp": "コーヒーいるかい？",
          "romaji": "koohii iru kai?",
          "en": "Do you want a coffee?"
        },
        {
          "jp": "一緒にくるかい。",
          "romaji": "isshoni kuru kai.",
          "en": "Do you want to come along?"
        },
        {
          "jp": "まだ終わってないのかい？",
          "romaji": "mada owatte nai no kai.",
          "en": "Aren’t you finished yet?"
        },
        {
          "jp": "話してくれるかい？いったい何があったんだ？",
          "romaji": "hanashite kureru kai? ittai nani ga attan da?",
          "en": "Will you tell me the story? What happened?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%84-kai-meaning/"
    },
    {
      "grammar": "かもしれない",
      "meaning": "might; perhaps; indicates possibility",
      "structure": "Verb (casual form) かも かもしれない かもしれません Noun な-adjective い-adjective → かも かもしれない かもしれません Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "難しいかも。",
          "romaji": "muzukashii kamo.",
          "en": "This might be a bit difficult."
        },
        {
          "jp": "そうかもしれない。",
          "romaji": "sou kamo shirenai.",
          "en": "That may be the case."
        },
        {
          "jp": "病気かもしれない。",
          "romaji": "byouki kamo shirenai.",
          "en": "I might be sick..."
        },
        {
          "jp": "午後から雨が降るかもしれない。",
          "romaji": "gogo kara ame ga furu kamo shirenai.",
          "en": "It might start raining in the afternoon."
        },
        {
          "jp": "来週、台風が来るかもしれない。",
          "romaji": "konshuu, taifuu ga kuru kamo shirenai.",
          "en": "A typhoon is possibly coming this week."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%82%82%e3%81%97%e3%82%8c%e3%81%aa%e3%81%84-kamo-shirenai-meaning/"
    },
    {
      "grammar": "かな",
      "meaning": "I wonder; should I?",
      "structure": "Verb (casual form) かな Noun な-adjective い-adjective → かな Noun な-adjective い-adjective → Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | Noun な-adjective い-adjective → な-adjective い-adjective → い-adjective | な-adjective い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女は元気かな。",
          "romaji": "kanojo wa genki kana.",
          "en": "I wonder if she's doing well."
        },
        {
          "jp": "雨が降るかな。",
          "romaji": "ame ga furu kana.",
          "en": "I wonder if it's going to rain."
        },
        {
          "jp": "外は寒いかな。",
          "romaji": "soto wa samui kana.",
          "en": "I wonder if it's cold outside."
        },
        {
          "jp": "もう食べていいかな。",
          "romaji": "mou tabete ii kana.",
          "en": "I wonder if it's OK to start eating."
        },
        {
          "jp": "一緒に映画を見るのはどうかな？",
          "romaji": "isshoni eiga o miru no wa dou kana?",
          "en": "What do you think about going to see a movie together?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%aa-kana-meaning/"
    },
    {
      "grammar": "から作る",
      "meaning": "made from; made with",
      "structure": "Noun + から 作る 作られる (passive form) 作られている Noun + で → 作る 作られる (passive form) 作られている Noun + で → Noun + で | Noun + で",
      "explanation": "",
      "examples": [
        {
          "jp": "ワインはブドウから作る。",
          "romaji": "wain wa budou kara tsukuru.",
          "en": "Wine is made from grapes."
        },
        {
          "jp": "紙は木から作られる。",
          "romaji": "kami wa ki kara tsukurareru.",
          "en": "Paper is made from wood."
        },
        {
          "jp": "酒は米で作る。",
          "romaji": "sake wa kome de tsukuru.",
          "en": "Sake (Japanese alcohol) is made from rice."
        },
        {
          "jp": "このつくえは木で作られています。",
          "romaji": "kono tsukue wa ki de tsukurarete imasu.",
          "en": "This desk was made from wood."
        },
        {
          "jp": "チーズは牛乳から作られますか？",
          "romaji": "chiizu wa gyuunyuu kara tsukurare masu ka?",
          "en": "Can you make cheese from milk?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%82%89%e4%bd%9c%e3%82%8b-%e4%bd%9c%e3%82%89%e3%82%8c%e3%81%a6%e3%81%84%e3%82%8b-kara-tsukuru-meaning/"
    },
    {
      "grammar": "きっと",
      "meaning": "surely; undoubtedly; almost certainly; most likely",
      "structure": "きっと event action → event action",
      "explanation": "",
      "examples": [
        {
          "jp": "明日はきっと雨でしょう。",
          "romaji": "ashita wa kitto ame deshou.",
          "en": "It will likely rain tomorrow."
        },
        {
          "jp": "彼女はきっと来るよ。",
          "romaji": "kanojo wa kitto kuru yo.",
          "en": "I am certain she will come."
        },
        {
          "jp": "がんばって勉強したから、きっと明日のテストは大丈夫だよ。",
          "romaji": "ganbatte benkyou shita kara, kitto ashita no tesuto wa daijoubu da yo.",
          "en": "You studied really hard, so I'm sure tomorrow's test will be fine!"
        },
        {
          "jp": "明日は、きっと晴れるでしょう。",
          "romaji": "ashita wa, kitto hareru deshou.",
          "en": "It will most likely be sunny tomorrow."
        },
        {
          "jp": "彼は私の親友だから、きっと私を助けてくれる。",
          "romaji": "kare wa watashi no shinyuu da kara, kitto watashi o tasukete kureru.",
          "en": "He's my best friend, so I'm positive he will help me."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8d%e3%81%a3%e3%81%a8-kitto-meaning/"
    },
    {
      "grammar": "頃",
      "meaning": "around; about; when",
      "structure": "Noun (time) ごろ (around; about) Verb (casual) ころ (when) Noun + の Adjective → ごろ (around; about) Verb (casual) ころ (when) Noun + の Adjective → Verb (casual) ころ (when) Noun + の Adjective → ころ (when) Noun + の Adjective → Noun + の Adjective → Adjective | Verb (casual) ころ (when) Noun + の Adjective → ころ (when) Noun + の Adjective → Noun + の Adjective → Adjective | Noun + の Adjective → Adjective | Adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "夜の8時ごろ、うちに来てもらえるか？",
          "romaji": "yoru no hachiji goro, uchi ni kite moraeru ka？",
          "en": "Can you come by my place around eight p.m.?"
        },
        {
          "jp": "私はこのころとても忙しいのです。",
          "romaji": "watashi wa kono koro totemo isogashii no desu.",
          "en": "I am very busy these days."
        },
        {
          "jp": "私は若いころ初めての一人旅をしました。",
          "romaji": "watashi wa wakai koro hajimete no hitori tabi o shimashita.",
          "en": "I traveled alone for the first time when I was young."
        },
        {
          "jp": "じゃ、僕は9時半ごろ迎えに来ればいいですね。",
          "romaji": "ja, boku wa kujihan goro mukae ni kureba ii desu ne.",
          "en": "OK, I’ll pick you up round about nine thirty. Is that right?"
        },
        {
          "jp": "あなたは子供のころ、いじめにあったことはある？",
          "romaji": "anata wa kodomo no koro, ijime ni atta koto wa aru.",
          "en": "Did you ever experience bullying when you were a child?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e9%a0%83-%e3%81%93%e3%82%8d-%e3%81%94%e3%82%8d-meaning/"
    },
    {
      "grammar": "こと",
      "meaning": "Verb nominalizer",
      "structure": "Verb (casual, non-past) こと → こと",
      "explanation": "",
      "examples": [
        {
          "jp": "本を読むことが好きです。",
          "romaji": "hon o yomu koto ga suki desu.",
          "en": "I like to read books."
        },
        {
          "jp": "私は料理を作ることが下手です。",
          "romaji": "watashi wa ryouri o tsukuru koto ga heta desu.",
          "en": "I am bad at cooking food."
        },
        {
          "jp": "私はゲームをすることが大好きです。",
          "romaji": "watashi wa geemu o suru koto ga daisuki desu.",
          "en": "I love playing games."
        },
        {
          "jp": "私には考えることがたくさんある。",
          "romaji": "watashi ni wa kangaeru koto ga takusan aru.",
          "en": "There are many things that we think about."
        },
        {
          "jp": "私の趣味は料理を作ることです。",
          "romaji": "watashi no shumi wa ryouri o tsukuru koto desu.",
          "en": "My hobby is cooking."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%93%e3%81%a8-koto-meaning/"
    },
    {
      "grammar": "ことがある",
      "meaning": "there are times when",
      "structure": "Verb (casual, non-past) ことがある こともある ことがあります こともあります → ことがある こともある ことがあります こともあります",
      "explanation": "",
      "examples": [
        {
          "jp": "たまに彼女と一緒にテニスをしに行くことがある。",
          "romaji": "tamani kanojo to isshoni tenisu o shini iku koto ga aru.",
          "en": "Sometimes I go to play tennis with my girlfriend."
        },
        {
          "jp": "たまに自転車で通勤することがある。",
          "romaji": "tamani jitensha de tsuukin suru koto ga aru.",
          "en": "Sometimes I commute to work by bicycle."
        },
        {
          "jp": "私は会議中でも、寝てしまうことがある。",
          "romaji": "watashi wa kaigichuu demo, nete shimau koto ga aru.",
          "en": "Sometimes I fall asleep during meetings."
        },
        {
          "jp": "時々仕事をやめたいと思うことがある。",
          "romaji": "tokidoki shigoto o yametai to omou koto ga aru.",
          "en": "There are times when I feel like quitting my job."
        },
        {
          "jp": "私の地元は6月でも寒いことがある。",
          "romaji": "watashi no jimoto wa roku gatsu demo samui koto ga aru.",
          "en": "In my hometown there are times where it is cold even in June."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%93%e3%81%a8%e3%81%8c%e3%81%82%e3%82%8b-koto-ga-aru-meaning/"
    },
    {
      "grammar": "ことができる",
      "meaning": "can; able to",
      "structure": "Verb (dictionary form) ことができる ことができない ことができます ことができません → ことができる ことができない ことができます ことができません",
      "explanation": "",
      "examples": [
        {
          "jp": "私は日本語を話すことができる。",
          "romaji": "watashi wa nihongo o hanasu koto ga dekiru.",
          "en": "I can speak Japanese."
        },
        {
          "jp": "彼女は歌うことができる。",
          "romaji": "kanojo wa utau koto ga dekiru.",
          "en": "She can sing."
        },
        {
          "jp": "このナイフはどんなものでも切ることができるよ。",
          "romaji": "kono naifu wa donna mono demo kiru koto ga dekiru yo.",
          "en": "This knife can cut through anything."
        },
        {
          "jp": "何も言うことができない。",
          "romaji": "nani mo iu koto ga dekinai.",
          "en": "I can't say anything."
        },
        {
          "jp": "私は嘘をつくことができない。",
          "romaji": "watashi wa uso o tsuku koto ga dekinai.",
          "en": "I'm not able to tell a lie."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%93%e3%81%a8%e3%81%8c%e3%81%a7%e3%81%8d%e3%82%8b-koto-ga-dekiru-%e3%81%93%e3%81%a8%e3%81%8c%e3%81%a7%e3%81%8d%e3%81%be%e3%81%99%e3%81%8b-meaning/"
    },
    {
      "grammar": "ことになる",
      "meaning": "It has been decided that..; it turns out that..",
      "structure": "Verb (dictionary form) Verb (ない form) ことになる → ことになる",
      "explanation": "",
      "examples": [
        {
          "jp": "入学式は4月1日に行うことになりました。",
          "romaji": "nyuugakushiki wa shigatsu tsuitachi ni okonau koto ni narimashita.",
          "en": "The entrance ceremony will be held on April 1st."
        },
        {
          "jp": "私の母が入院することになった。",
          "romaji": "watashi no haha ga nyuuin suru koto ni natta.",
          "en": "My mother has been hospitalized."
        },
        {
          "jp": "大阪に転勤することになりました。",
          "romaji": "oosaka ni tenkin suru koto ni narimashita.",
          "en": "It's been decided that I'll be transferring to Osaka for work."
        },
        {
          "jp": "どうしてそれを学ぶことになったの？",
          "romaji": "doushite sore o manabu koto ni natta no?",
          "en": "How did you come to learn that?"
        },
        {
          "jp": "両親は離婚ということになった。",
          "romaji": "ryoushin wa rikon toiu koto ni natta.",
          "en": "My parents ended up deciding to get a divorce."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%93%e3%81%a8%e3%81%ab%e3%81%aa%e3%82%8b-koto-ni-naru-meaning/"
    },
    {
      "grammar": "ことにする",
      "meaning": "to decide on",
      "structure": "Verb (dictionary form) Verb )ない form) ことにする ことにします ことにしている ことにしています → ことにする ことにします ことにしている ことにしています",
      "explanation": "行かない ことにする 。 ikanai koto ni suru. I’ve decided to not go. ikanai koto ni suru. I’ve decided to not go.",
      "examples": [
        {
          "jp": "これから毎日ランニングをすることにする。",
          "romaji": "kore kara mainichi ranningu o suru koto ni suru.",
          "en": "I've decided to go running every day from now on."
        },
        {
          "jp": "タバコをやめることにした。",
          "romaji": "tabako o yameru koto ni shita.",
          "en": "I've decided to quit smoking."
        },
        {
          "jp": "春休みに彼女と一緒に台湾に行くことにします。",
          "romaji": "haruyasumi ni okusan to isshoni taiwan ni iku koto ni shimasu.",
          "en": "I've decided to go to Taiwan with my girlfriend during spring break."
        },
        {
          "jp": "寝る前に食べないことにした。",
          "romaji": "neru mae ni tabenai koto ni shimashita.",
          "en": "I've decided to stop eating before going to bed."
        },
        {
          "jp": "毎朝、30分ジョギングすることにしています。",
          "romaji": "maiasa, 30 pun jogingu suru koto ni shite imasu.",
          "en": "I've decided to go jogging every morning for 30 minutes."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%93%e3%81%a8%e3%81%ab%e3%81%99%e3%82%8b-koto-ni-suru-meaning/"
    },
    {
      "grammar": "くする",
      "meaning": "to make something ~",
      "structure": "い-adjective い くする くします くして → くする くします くして",
      "explanation": "",
      "examples": [
        {
          "jp": "音楽でもっと良くする。",
          "romaji": "ongaku de motto yoku suru.",
          "en": "Make it better with music."
        },
        {
          "jp": "あと５００円安くしてくれたら、買いますよ。",
          "romaji": "ato go hyaku en yasuku shite kure tara, kaimasu yo.",
          "en": "I'll buy it if you make it 500 yen cheaper."
        },
        {
          "jp": "彼女は声を大きくした。",
          "romaji": "kanojo wa koe o ookiku shita.",
          "en": "She raised her voice."
        },
        {
          "jp": "電気をつけて、部屋を明るくしましょう。",
          "romaji": "denki o tsukete, heya o akaruku shimashou.",
          "en": "Let's turn on the lights and make the room brighter."
        },
        {
          "jp": "部屋が暑いので、エアコンをつけて涼しくします。",
          "romaji": "heya ga atsui no de, eakon o tsukete suzushiku shimasu.",
          "en": "This room is a bit hot so I'll turn on the air conditioning to make it cooler."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84-adjective-%e3%81%8f%e3%81%99%e3%82%8b-ku-suru-meaning/"
    },
    {
      "grammar": "急に",
      "meaning": "quickly; immediately; hastily; suddenly; abruptly; unexpectedly ~",
      "structure": "急に Phrase → Phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "急に雨が降り始めました。",
          "romaji": "kyuu ni ame ga furi hajimemashita.",
          "en": "It suddenly started raining."
        },
        {
          "jp": "雨は急にやんだ。",
          "romaji": "ame wa kyuu ni yanda.",
          "en": "The rain suddenly stopped."
        },
        {
          "jp": "その車は急に曲がった。",
          "romaji": "sono kuruma wa kyuu ni magatta.",
          "en": "That car made an abrupt turn."
        },
        {
          "jp": "今日は急に涼しくなった。",
          "romaji": "kyou wa kyuu ni suzushiku natta.",
          "en": "It suddenly got a bit cooler today."
        },
        {
          "jp": "その子は急に泣き出した。",
          "romaji": "sono ko wa kyuu ni naki dashita.",
          "en": "That child suddenly started crying."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%80%a5%e3%81%ab-kyuu-ni-meaning/"
    }
  ],
  "N3": [
    {
      "grammar": "上げる",
      "meaning": "to finish doing ~",
      "structure": "Verb (ます stem) ます あげる あがる → あげる あがる",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女は小説を書き上げた。",
          "romaji": "kanojo wa shousetsu o kaki ageta.",
          "en": "She finished writing her novel."
        },
        {
          "jp": "この会社は新製品を作り上げた。",
          "romaji": "kono kaisha wa shinseihin o tsukuri ageta.",
          "en": "This company has created a new product."
        },
        {
          "jp": "みんなの意見を取り入れて、とてもいいプランが出来上がった。",
          "romaji": "minna no iken o tori irete, totemo ii puran ga deki agatta.",
          "en": "A very good plan was completed, incorporating the opinions of everyone"
        },
        {
          "jp": "研究のレポートを一日で書き上げた。",
          "romaji": "kenkyuu no repooto o ichinichi de kaki ageta.",
          "en": "I wrote my research report in one day."
        },
        {
          "jp": "出来上がった料理を、お客さんのところに運ぶのが私の仕事です。",
          "romaji": "deki agatta ryouri o, okyaku san no tokoro ni hakobu noga watashi no shigoto desu.",
          "en": "It is my job to bring the finished food to the customer."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%8a%e3%81%92%e3%82%8b-ageru-meaning/"
    },
    {
      "grammar": "あまり",
      "meaning": "so much… that",
      "structure": "Verb (dictionary form) あまり Verb (casual, past) Noun + の → あまり Verb (casual, past) Noun + の → Verb (casual, past) Noun + の → Noun + の | Verb (casual, past) Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "嬉しさのあまり、彼女は涙を流しました。",
          "romaji": "ureshisa no amari, kanojo wa namida o nagashimashita.",
          "en": "She was so happy that she cried."
        },
        {
          "jp": "それのあまりの安さにおどろいた。",
          "romaji": "sore no amari no yasusa ni odoroita.",
          "en": "I was shocked by how cheap it was."
        },
        {
          "jp": "プレゼンのとき、緊張のあまり間違えてしまった。",
          "romaji": "purezen no toki, kinchou no amari machigaete shimatta.",
          "en": "During my presentation I was so nervous that I ended up making a mistake."
        },
        {
          "jp": "怒りのあまり口がきけなかった。",
          "romaji": "ikari no amari kuchi ga kikenakatta.",
          "en": "I was speechless with anger."
        },
        {
          "jp": "私は苦悩のあまり、病気になりました。",
          "romaji": "watashi wa kunou no amari, byouki ni narimashita.",
          "en": "I was so worried I became sick."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%be%e3%82%8a-amari-meaning/"
    },
    {
      "grammar": "あまりにも",
      "meaning": "too much; so much… that; excessively ~",
      "structure": "あまりに(も) Verb Adverb Adjective あまりの Noun → Verb Adverb Adjective あまりの Noun → Adverb Adjective あまりの Noun → Adjective あまりの Noun → あまりの Noun → Noun | Adverb Adjective あまりの Noun → Adjective あまりの Noun → あまりの Noun → Noun | Adjective あまりの Noun → あまりの Noun → Noun | あまりの Noun → Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "最近あまりに暑すぎる。",
          "romaji": "saikin amari ni atsu sugiru.",
          "en": "It's too hot recently.."
        },
        {
          "jp": "彼はあまりにも変わった。",
          "romaji": "kare wa amari ni mo kawatta.",
          "en": "He changed a lot."
        },
        {
          "jp": "あまりにも天気が良い。",
          "romaji": "amari ni mo tenki ga yoi.",
          "en": "The weather is excellent."
        },
        {
          "jp": "あまりにも疲れているので仕事ができない。",
          "romaji": "amari ni mo tsukareteiru no de shigoto ga dekinai.",
          "en": "I am so tired that I cannot do my job."
        },
        {
          "jp": "あなたは起きるのがあまりに遅すぎる。",
          "romaji": "anata wa okiru no ga amari ni ososugiru.",
          "en": "You wake up too late.."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%be%e3%82%8a%e3%81%ab%e3%82%82-amari-ni-mo-meaning/"
    },
    {
      "grammar": "合う",
      "meaning": "do something together",
      "structure": "Verb ます (stem form) 合う あう → 合う あう",
      "explanation": "",
      "examples": [
        {
          "jp": "私たちはその件について話し合いましょう。",
          "romaji": "watashi tachi wa sono ken ni tsuite hanashi aimashou.",
          "en": "Let's discuss together regarding that matter."
        },
        {
          "jp": "2人は愛し合っている。",
          "romaji": "futari wa aishiatteiru.",
          "en": "Those 2 are in love with each other."
        },
        {
          "jp": "チームだから、困った時は助け合いましょう。",
          "romaji": "chiimu da kara, komatta toki wa tasukeai mashou.",
          "en": "We are a team so whenever someone is in trouble, let's help each other!"
        },
        {
          "jp": "私たちはお互い助け合うべきだ。",
          "romaji": "watashi tachi wa otagai ni tasuke au beki da.",
          "en": "We should help each other."
        },
        {
          "jp": "彼女は仲間とうまく付き合っている。",
          "romaji": "kanojo wa nakama to umaku tsukiatte iru.",
          "en": "She gets along well with her peers."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%90%88%e3%81%86-%e3%81%82%e3%81%86-au-meaning/"
    },
    {
      "grammar": "ばいい",
      "meaning": "should; can; it’d be good if ~",
      "structure": "Verb (ば conditional form) いい → いい",
      "explanation": "",
      "examples": [
        {
          "jp": "どうすればいいですか？",
          "romaji": "dou sureba ii desu ka.",
          "en": "What should I do?"
        },
        {
          "jp": "どこに行けばいいですか？",
          "romaji": "doko ni ikeba ii desu ka?",
          "en": "Where should I go?"
        },
        {
          "jp": "私は何を言えばいいかわからない。",
          "romaji": "watashi wa nani o ieba ii ka wakaranai.",
          "en": "I'm not sure what I should say."
        },
        {
          "jp": "何を歌えばいいですか。",
          "romaji": "nani o utaeba ii desu ka.",
          "en": "What should I sing?"
        },
        {
          "jp": "君が決めればいい。",
          "romaji": "kimi ga kimereba ii.",
          "en": "It is for you to decide."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%84%e3%81%84-ba-ii-meaning/"
    },
    {
      "grammar": "ばよかった",
      "meaning": "should have; would have been better if ~",
      "structure": "Verb (ば conditional form) よかった（のに） → よかった（のに）",
      "explanation": "",
      "examples": [
        {
          "jp": "そうすればよかった。",
          "romaji": "sou sureba yokatta.",
          "en": "I should have done that."
        },
        {
          "jp": "傘を持ってくればよかった。",
          "romaji": "kasa o motte kureba yokatta.",
          "en": "I should have brought an umbrella."
        },
        {
          "jp": "遅刻してしまった。もっと早く家を出ればよかった。",
          "romaji": "chikoku shite shimatta. motto hayaku ie o dereba yokatta.",
          "en": "I was late... I should have left home earlier."
        },
        {
          "jp": "早く連絡してくればよかったのに。",
          "romaji": "hayaku renraku shite kurereba yokatta noni.",
          "en": "You should have contacted me earlier."
        },
        {
          "jp": "友人にあんなことを言わなければよかった。",
          "romaji": "yuujin ni anna koto o iwanakereba yokatta.",
          "en": "I wish I hadn't said such a thing to my good friend."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%82%88%e3%81%8b%e3%81%a3%e3%81%9f-ba-yokatta-meaning/"
    },
    {
      "grammar": "ば～ほど",
      "meaning": "the more… the more ~",
      "structure": "Verb (ば conditional form) same Verb + ほど な-adjective + なら same な-adj + なほど い-adjective + い ければ same い-adj + ほど → same Verb + ほど な-adjective + なら same な-adj + なほど い-adjective + い ければ same い-adj + ほど → な-adjective + なら same な-adj + なほど い-adjective + い ければ same い-adj + ほど → same な-adj + なほど い-adjective + い ければ same い-adj + ほど → い-adjective + い ければ same い-adj + ほど → same い-adj + ほど | な-adjective + なら same な-adj + なほど い-adjective + い ければ same い-adj + ほど → same な-adj + なほど い-adjective + い ければ same い-adj + ほど → い-adjective + い ければ same い-adj + ほど → same い-adj + ほど | い-adjective + い ければ same い-adj + ほど → same い-adj + ほど",
      "explanation": "",
      "examples": [
        {
          "jp": "ビートルズの音楽は聞けば聞くほど好きになります。",
          "romaji": "biitoruzu no ongaku wa kikeba kiku hodo suki ni narimasu.",
          "en": "The more I listen to The Beetles, the more I end up liking their music."
        },
        {
          "jp": "考えれば考えるほどわからなくなる。",
          "romaji": "kangaereba kangaeru hodo wakaranaku naru.",
          "en": "The more I think about it, the less I understand."
        },
        {
          "jp": "勉強すればするほど、日本語が上手になりますよ。",
          "romaji": "benkyou sureba suru hodo, nihongo ga jouzu ni narimasu.",
          "en": "The more you study, the better your Japanese will get."
        },
        {
          "jp": "スーパーは家から近ければ近いほど便利です。",
          "romaji": "suupaa wa ie kara chikakereba chikai hodo benri desu.",
          "en": "The closer the supermarket is to home, the more convenient it is."
        },
        {
          "jp": "日本語は話せば話すほど上手になります。",
          "romaji": "nihongo wa hanaseba hanasu hodo jouzu ni narimasu.",
          "en": "The more Japanese you speak, the more you will improve."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%ef%bd%9e%e3%81%bb%e3%81%a9-ba-hodo-meaning/"
    },
    {
      "grammar": "ば～のに",
      "meaning": "would have; should have; if only ~",
      "structure": "Verb (conditional form) clause + のに Noun + なら な-adjective + なら い-adjective + い ければ → clause + のに Noun + なら な-adjective + なら い-adjective + い ければ → Noun + なら な-adjective + なら い-adjective + い ければ → な-adjective + なら い-adjective + い ければ → い-adjective + い ければ | Noun + なら な-adjective + なら い-adjective + い ければ → な-adjective + なら い-adjective + い ければ → い-adjective + い ければ | な-adjective + なら い-adjective + い ければ → い-adjective + い ければ | い-adjective + い ければ",
      "explanation": "",
      "examples": [
        {
          "jp": "このかばん、欲しいけど高いなあ。もっと安ければいいのに。",
          "romaji": "kono kaban, hoshii kedo takai naa. motto yasukereba ii noni.",
          "en": "I want this bag, but it's pretty expensive... If only it were a bit cheaper."
        },
        {
          "jp": "もうちょっと早く来れば、大好きなアイドルが見えるのに。",
          "romaji": "mou chotto hayaku kureba, daisuki na aidoru ga mieru no ni.",
          "en": "If only I came a little earlier, I could have seen my favorite idol."
        },
        {
          "jp": "日本語がもっと上手なら、仕事が見つけれるのになあ。",
          "romaji": "nihongo ga motto jouzu nara, shigoto ga mitsukereru noni naa.",
          "en": "If only I were better at Japanese, I would be able to find a job.."
        },
        {
          "jp": "映画はとても面白かった。君も行けばよかったのに。",
          "romaji": "eiga wa totemo omoshirokatta. kimi mo ikeba yokatta noni.",
          "en": "The movie was very interesting. You should have gone!"
        },
        {
          "jp": "車で行けば、間に合ったのに、自転車に乗ったから遅れてしまった。",
          "romaji": "kuruma de ikeba, ma ni atta noni, jitensha ni notta kara okurete shimatta.",
          "en": "I would have made it on time if I came by car, but I came by bicycle and was late.."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%ef%bd%9e%e3%81%ae%e3%81%ab-ba-noni-meaning/"
    },
    {
      "grammar": "ばかりで",
      "meaning": "only; just ~ (negative description)",
      "structure": "Verb (casual) ばかりで な-adjective + な い-adjective → ばかりで な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "夏は暑いばかりで楽しくないですよ。",
          "romaji": "natsu wa atsui bakari de tanoshikunai desu yo.",
          "en": "Summer is just hot all the time, it's not enjoyable."
        },
        {
          "jp": "うちの子は毎日遊んでいるばかりで勉強をしない。",
          "romaji": "uchi no ko wa mainichi asondeiru bakari de benkyou o shinai.",
          "en": "My kid only plays all day and never studies"
        },
        {
          "jp": "あの人は背が高いばかりで、あまり力はない。",
          "romaji": "ano hito wa se ga takai bakari de, amari chikara wa nai.",
          "en": "That person is only tall, he's actually not that strong."
        },
        {
          "jp": "この仕事は忙しいばかりで、意味がない。",
          "romaji": "kono shigoto wa isogashii bakari de, imi ga nai.",
          "en": "This job is just busy all the time, but there's no point to it."
        },
        {
          "jp": "主人は小説を読んでいるばかりで、家事を全然手伝ってくれない。",
          "romaji": "shujin wa shousetsu o yonde iru bakari de, kaji o zenzen tetsudatte kurenai.",
          "en": "My husband just reads novels all day, and never helps out with the housework."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a%e3%81%a7-bakari-de-meaning/"
    },
    {
      "grammar": "ばかりでなく",
      "meaning": "not only... but also; as well as ~",
      "structure": "Verb (casual) ばかりでなく… (も) Noun な-adjective + な い-adjective + い → ばかりでなく… (も) Noun な-adjective + な い-adjective + い → Noun な-adjective + な い-adjective + い → な-adjective + な い-adjective + い → い-adjective + い | Noun な-adjective + な い-adjective + い → な-adjective + な い-adjective + い → い-adjective + い | な-adjective + な い-adjective + い → い-adjective + い | い-adjective + い",
      "explanation": "",
      "examples": [
        {
          "jp": "このマンションは狭いばかりでなく、暗いです。",
          "romaji": "kono manshon wa semai bakari denaku, kurai desu.",
          "en": "This apartment is not only very small, it's also quite dark."
        },
        {
          "jp": "彼は歌ばかりでなくダンスも上手です。",
          "romaji": "kare wa uta bakari denaku dansu mo jouzu desu.",
          "en": "He is not only good at singing, he also good at dancing."
        },
        {
          "jp": "うちの子は6歳なのに日本語ばかりでなく英語まで喋れるよ。",
          "romaji": "uchi no ko wa 6 sai nano ni nihongo bakari denaku eigo made shabereru yo!",
          "en": "Although our child is only 6, they can speak not only Japanese, but English as well."
        },
        {
          "jp": "このレストランは、味が悪いばかりでなく、店員の態度もひどい。",
          "romaji": "kono resutoran wa, aji ga warui bakari denaku, tenin no taido mo hidoi.",
          "en": "Not only is this restaurant's food bad, but the service is also horrible."
        },
        {
          "jp": "台風が来ている。雨ばかりでなく、風も強くなってきた。",
          "romaji": "taifuu ga kiteiru. ame bakari denaku, kaze mo tsuyoku natte kita.",
          "en": "The typhoon is coming. The rain as well as the wind are starting to get stronger."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a%e3%81%a7%e3%81%aa%e3%81%8f-bakari-denaku-meaning/"
    },
    {
      "grammar": "べきだ",
      "meaning": "should do; must do ~",
      "structure": "Verb (standard form) べき（だ） Special verb する OR す る な-adjective + である い-adjective + い くある → べき（だ） Special verb する OR す る な-adjective + である い-adjective + い くある → Special verb する OR す る な-adjective + である い-adjective + い くある → な-adjective + である い-adjective + い くある → い-adjective + い くある | Special verb する OR す る な-adjective + である い-adjective + い くある → な-adjective + である い-adjective + い くある → い-adjective + い くある | な-adjective + である い-adjective + い くある → い-adjective + い くある | い-adjective + い くある",
      "explanation": "",
      "examples": [
        {
          "jp": "私はそれについてもっと知るべきだ。",
          "romaji": "watashi wa sore ni tsuite motto shiru beki da.",
          "en": "I should know more about that."
        },
        {
          "jp": "約束は守るべきだ。",
          "romaji": "yakusoku wa mamoru beki da.",
          "en": "You should keep your promises."
        },
        {
          "jp": "早く帰宅すべきだ。",
          "romaji": "hayaku kitaku subeki da.",
          "en": "You should go home early."
        },
        {
          "jp": "真実を言うべきだ。",
          "romaji": "shinjitsu o iu beki da.",
          "en": "You should tell the truth."
        },
        {
          "jp": "おもちゃは、先ず安全であるべきです。",
          "romaji": "omocha wa, mazu anzen de aru beki desu.",
          "en": "Safety comes first for toys."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8d%e3%81%a0-beki-da-meaning/"
    },
    {
      "grammar": "べきではない",
      "meaning": "should not do; must not do ~",
      "structure": "Verb (standard form) べきではない べきではありません Special verb する OR す る な-adjective + である い-adjective + い くある → べきではない べきではありません Special verb する OR す る な-adjective + である い-adjective + い くある → Special verb する OR す る な-adjective + である い-adjective + い くある → な-adjective + である い-adjective + い くある → い-adjective + い くある | Special verb する OR す る な-adjective + である い-adjective + い くある → な-adjective + である い-adjective + い くある → い-adjective + い くある | な-adjective + である い-adjective + い くある → い-adjective + い くある | い-adjective + い くある",
      "explanation": "",
      "examples": [
        {
          "jp": "そんなことをすべきではない。",
          "romaji": "sonna koto o subeki dewa nai.",
          "en": "You shouldn't do such a thing."
        },
        {
          "jp": "寝る前にアイスを食べるべきではない。",
          "romaji": "neru mae ni aisu o taberu beki dewa nai.",
          "en": "You shouldn't eat ice cream before going to bed."
        },
        {
          "jp": "私達は遅く寝るべきではありません。",
          "romaji": "watashitachi wa osoku neru beki dewa arimasen.",
          "en": "We shouldn't go to bed late."
        },
        {
          "jp": "約束を破るべきではありません。",
          "romaji": "yakusoku o yaburu beki dewa arimasen.",
          "en": "You shouldn't break your promises."
        },
        {
          "jp": "過去を忘れるべきではありません。",
          "romaji": "kako o wasureru beki dewa arimasen.",
          "en": "You shouldn't forget about your past."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8d%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84-beki-dewa-nai-meaning/"
    },
    {
      "grammar": "別に～ない",
      "meaning": "not really, not particularly",
      "structure": "別に Verb (ない form) Noun + ではない な-adjective + ではない い-adjective + い くない → Verb (ない form) Noun + ではない な-adjective + ではない い-adjective + い くない → Noun + ではない な-adjective + ではない い-adjective + い くない → な-adjective + ではない い-adjective + い くない → い-adjective + い くない | Noun + ではない な-adjective + ではない い-adjective + い くない → な-adjective + ではない い-adjective + い くない → い-adjective + い くない | な-adjective + ではない い-adjective + い くない → い-adjective + い くない | い-adjective + い くない",
      "explanation": "",
      "examples": [
        {
          "jp": "それは別に悪いことでもない。",
          "romaji": "sore wa betsu ni warui koto demo nai.",
          "en": "That's not particularly a bad thing."
        },
        {
          "jp": "別に彼のために作ったわけではない。",
          "romaji": "betsu ni kare no tame ni tsukutta wake dewa nai.",
          "en": "It’s not like I made this for him."
        },
        {
          "jp": "この仕事には別に期限はない。",
          "romaji": "kono shigoto ni wa betsu ni kigen wa nai.",
          "en": "There is no time limit in particular for completing this job."
        },
        {
          "jp": "君は別に悪いことをしている訳ではない。",
          "romaji": "kimi wa betsu ni warui koto o shite iru wake dewa nai.",
          "en": "It's not like you're doing anything wrong."
        },
        {
          "jp": "ただ困っている人を手伝いたいだけだよ。別に彼のことが好きではない。",
          "romaji": "tada komatte iru hito o tetsudaitai dake dayo. Betsu ni kare no koto ga suki dewa nai.",
          "en": "I just want to help people who need help. It's not like I like him or anything."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%88%a5%e3%81%ab%ef%bd%9e%e3%81%aa%e3%81%84-betsu-ni-nai-meaning/"
    },
    {
      "grammar": "ぶりに",
      "meaning": "for the first time in (period of time)",
      "structure": "Noun (measurement of time) ぶり（に） っぷり → ぶり（に） っぷり",
      "explanation": "",
      "examples": [
        {
          "jp": "今日、やく2週間ぶりに雨が降った。",
          "romaji": "kyou, yaku 2 shuukan buri ni ame ga futta.",
          "en": "Today, it rained for the first time in 2 weeks."
        },
        {
          "jp": "この街に帰ってくるのはもう１０年ぶりだなあ。",
          "romaji": "kono machi ni kaette kuru no wa mou juu nen buri da naa.",
          "en": "It's been already 10 years since I last came to this town."
        },
        {
          "jp": "先週からずっと雨が降った。一週間ぶりにようやく晴れてきた。",
          "romaji": "senshuu kara zutto ame ga futta. isshuukan buri ni youyaku harete kita.",
          "en": "It's been constantly raining since last week. For the first time in a week, it the sun finally came out."
        },
        {
          "jp": "父はうちで倒れて入院したが、意識がなかった。二日ぶりに意識を回復した。",
          "romaji": "chichi wa uchi de taorete nyuuin shita ga, ishiki ga nakatta. futsuka buri ni ishiki o kaifuku shita.",
          "en": "My father collapsed and was hospitalized, though he was unconscious. For the first time in 2 days, he regained consciousness."
        },
        {
          "jp": "高校を卒業してから、2年ぶりにクラスメイトに会った。",
          "romaji": "koukou o sotsugyou shite kara, 2 nen buri ni kurasumeito ni atta.",
          "en": "I met my classmates for the first time in 2 years since graduating high school."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b6%e3%82%8a%e3%81%ab-buri-ni-meaning/"
    },
    {
      "grammar": "中",
      "meaning": "currently; during; at some point; throughout; before the end of ~",
      "structure": "Noun 中 ちゅう じゅう → 中 ちゅう じゅう",
      "explanation": "",
      "examples": [
        {
          "jp": "私は一晩中泣いていた。",
          "romaji": "watashi wa hitobanjuu naiteita.",
          "en": "I cried all night."
        },
        {
          "jp": "午前中がいちばん調子がいいです。",
          "romaji": "gozen chuu ga ichiban choushi ga ii desu.",
          "en": "During the morning is the best."
        },
        {
          "jp": "英語は世界中で話されています。",
          "romaji": "eigo wa sekaijuu de hanasarete imasu.",
          "en": "English is spoken throughout the world."
        },
        {
          "jp": "この事件に関しては、ただいま確認中でございます。",
          "romaji": "kono jiken ni kanshite wa, tadaima kakuninchuu degozaimasu.",
          "en": "We are currently checking this case."
        },
        {
          "jp": "私は一晩中、両親の夢をみていた。",
          "romaji": "watashi wa hitobanjuu, ryoushin no yume o mite ita.",
          "en": "I dreamed of my parents all through the night."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%ad-chuu-juu-meaning/"
    },
    {
      "grammar": "だけ",
      "meaning": "as much as ~",
      "structure": "Verb (dictionary form) だけ Noun な-adjective + な い-adjective → だけ Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "食べたいだけ食べなさい。",
          "romaji": "tabetai dake tabenasai.",
          "en": "Eat as much as you like."
        },
        {
          "jp": "私はそれをできるだけ早くいただけますか。",
          "romaji": "watashi wa sore o dekiru dake hayaku itadakemasu ka?",
          "en": "Would I be able to get that as soon as possible?"
        },
        {
          "jp": "できるだけ早く返事をいただけると助かります。",
          "romaji": "dekiru dake hayaku henji o itadakeru to tasukarimasu.",
          "en": "I would appreciate it if you could reply to me as soon as possible."
        },
        {
          "jp": "食べ放題だから、食べれるだけ食べてくださいね。",
          "romaji": "tabehoudai da kara, tabereru dake tabete kudasai ne.",
          "en": "It's all you can eat, so eat as much as you can!"
        },
        {
          "jp": "二度とここに戻れないから、読めるだけ本を読みたいです。",
          "romaji": "nido to koko ni modorenai kara, yomeru dake hon o yomitai desu.",
          "en": "I will never be able to come back here, so I want to read as much as I can."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91-dake-meaning-as-much-as/"
    },
    {
      "grammar": "だけでなく",
      "meaning": "not only… but also ~",
      "structure": "Verb (dictionary form) だけでなく Noun (である) な-adjective + な/である い-adjective → だけでなく Noun (である) な-adjective + な/である い-adjective → Noun (である) な-adjective + な/である い-adjective → な-adjective + な/である い-adjective → い-adjective | Noun (である) な-adjective + な/である い-adjective → な-adjective + な/である い-adjective → い-adjective | な-adjective + な/である い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "ここのレストランはどれも安いだけでなく、美味しい。",
          "romaji": "koko no resutoran wa dore mo yasui dake de naku, oishii.",
          "en": "Not only is everything cheap at this restaurant, it is all delicious."
        },
        {
          "jp": "この公園では、子供だけではなく大人も楽しむことができる。",
          "romaji": "kono kouen dewa, kodomo dake dewa naku otona mo tanoshimu koto ga dekiru.",
          "en": "This park is enjoyable for not only kids, but for adults as well."
        },
        {
          "jp": "彼女は日本語が上手なだけでなく、英語もペラペラだ。",
          "romaji": "kanojo wa nihongo ga jouzu na dake de naku, ego mo perapera da.",
          "en": "She is not only good at Japanese, but also fluent in English."
        },
        {
          "jp": "君だけでなく僕も悪かった。",
          "romaji": "kimi dake de naku boku mo warukatta.",
          "en": "It isn't just you, I am also to blame."
        },
        {
          "jp": "彼は知識だけではなく、経験も豊かである。",
          "romaji": "kare wa chishiki dake dewa naku, keiken mo yutaka de aru.",
          "en": "Not only does he have knowledge, but he also has an abundance of experience."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%a7%e3%81%aa%e3%81%8f-dake-de-naku-meaning/"
    },
    {
      "grammar": "だけど",
      "meaning": "but; however; although; regarding ~",
      "structure": "Verb (casual) + んだ/のだ けど Noun + だ/だった/です Noun + なんだ/なのだ な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → けど Noun + だ/だった/です Noun + なんだ/なのだ な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → Noun + だ/だった/です Noun + なんだ/なのだ な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → い-adjective + い/ い かった い-adjective + いんだ/いのだ | Noun + だ/だった/です Noun + なんだ/なのだ な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → い-adjective + い/ い かった い-adjective + いんだ/いのだ | な-adjective + だ/だった な-adjective + なんだ/なのだ い-adjective + い/ い かった い-adjective + いんだ/いのだ → い-adjective + い/ い かった い-adjective + いんだ/いのだ | い-adjective + い/ い かった い-adjective + いんだ/いのだ",
      "explanation": "",
      "examples": [
        {
          "jp": "スキー行きたいんだけど、お金が全然ないよ。",
          "romaji": "sukii ikitai n dakedo, okane ga zenzen nai yo.",
          "en": "I want to go skiing, but I have no money."
        },
        {
          "jp": "彼女はかわいいんだけど僕のタイプではない。",
          "romaji": "kanojo wa kawaii n dakedo boku no taipu dewa nai.",
          "en": "She's cute, but not my type."
        },
        {
          "jp": "今週は暇だけど、来週は忙しい。",
          "romaji": "konshuu wa hima dakedo, raishuu wa isogashii.",
          "en": "I am free this week, but next week I am busy."
        },
        {
          "jp": "彼に電話したんだけど、話し中で通じなかった。",
          "romaji": "kare ni denwa shita n dakedo, hanashi chuu de tuujinakatta.",
          "en": "I called him, but he was busy and I couldn't get through."
        },
        {
          "jp": "そうだといいんだけど。",
          "romaji": "sou da to ii n dakedo.",
          "en": "I hope that's true, but..."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%a9-dakedo-meaning/"
    },
    {
      "grammar": "だらけ",
      "meaning": "full of; covered with; a lot of (something undesirable)",
      "structure": "Noun だらけ → だらけ",
      "explanation": "泥 だらけ 。 doro darake. Covered in mud. doro darake. Covered in mud.",
      "examples": [
        {
          "jp": "この公園は、猫だらけだ。",
          "romaji": "kono kouen wa neko darake da.",
          "en": "There are cats all over this park."
        },
        {
          "jp": "この部屋はゴミだらけだ。",
          "romaji": "kono heya wa gomi darake da.",
          "en": "This room is completely covered in garbage.."
        },
        {
          "jp": "今、不安だらけです。",
          "romaji": "ima, fuan darake desu.",
          "en": "I'm super nervous right now."
        },
        {
          "jp": "自信があったのに、先週のテストは間違えだらけだった。",
          "romaji": "jishin ga atta noni, senshuu no tesuto wa machigae darake datta.",
          "en": "I was full of confidence, but my test from last week was full of mistakes."
        },
        {
          "jp": "4年ぶりに歯医者に行ったら、虫歯だらけだった。",
          "romaji": "4 nen buri ni haisha ni ittara, mushiba darake datta.",
          "en": "I went to the dentist for the first time in 4 years and my mouth was full of cavities."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%82%89%e3%81%91-darake-meaning/"
    },
    {
      "grammar": "どんなに～ても",
      "meaning": "no matter how (much)",
      "structure": "どんなに Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | な-adjective + でも い-adjective + い くても → い-adjective + い くても | い-adjective + い くても",
      "explanation": "",
      "examples": [
        {
          "jp": "どんなに頑張っても、70点しか取れなかった。",
          "romaji": "donna ni ganbatte mo, 70 ten shika torenakatta.",
          "en": "No matter how hard I tried, I never got more than 70 points."
        },
        {
          "jp": "どんなに苦しくても最後まで走り抜くつもりだ。",
          "romaji": "donna ni kurushiku temo saigo made hashiri nuku tsumori da.",
          "en": "No matter how painful it may be, I plan to run all the way until the end."
        },
        {
          "jp": "どんなに暑くても寝る時はクーラーを消して寝る。",
          "romaji": "donna ni atsukutemo neru toki wa kuuraa o keshite neru.",
          "en": "No matter how hot it is, I always turn off the air-conditioner when I go to bed."
        },
        {
          "jp": "あの人の名前はどんなに聞いても覚えられない。",
          "romaji": "ano hito no namae wa donna ni kiitemo oboerarenai.",
          "en": "I can't remember that person's name no matter how many times I hear it.."
        },
        {
          "jp": "どんなに好きでも、それを伝えなければ始まらない。",
          "romaji": "donna ni suki demo, sore o tsutae nakereba hajimaranai.",
          "en": "No matter how much you may like them, if you don't let them know nothing will ever start."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%82%93%e3%81%aa%e3%81%ab%ef%bd%9e%e3%81%a6%e3%82%82-donna-ni-temo-meaning/"
    },
    {
      "grammar": "どんなに～ても",
      "meaning": "no matter how (much)",
      "structure": "どんなに Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | な-adjective + でも い-adjective + い くても → い-adjective + い くても | い-adjective + い くても",
      "explanation": "",
      "examples": [
        {
          "jp": "どんなに頑張っても、70点しか取れなかった。",
          "romaji": "donna ni ganbatte mo, 70 ten shika torenakatta.",
          "en": "No matter how hard I tried, I never got more than 70 points."
        },
        {
          "jp": "どんなに苦しくても最後まで走り抜くつもりだ。",
          "romaji": "donna ni kurushiku temo saigo made hashiri nuku tsumori da.",
          "en": "No matter how painful it may be, I plan to run all the way until the end."
        },
        {
          "jp": "どんなに暑くても寝る時はクーラーを消して寝る。",
          "romaji": "donna ni atsukutemo neru toki wa kuuraa o keshite neru.",
          "en": "No matter how hot it is, I always turn off the air-conditioner when I go to bed."
        },
        {
          "jp": "あの人の名前はどんなに聞いても覚えられない。",
          "romaji": "ano hito no namae wa donna ni kiitemo oboerarenai.",
          "en": "I can't remember that person's name no matter how many times I hear it.."
        },
        {
          "jp": "どんなに好きでも、それを伝えなければ始まらない。",
          "romaji": "donna ni suki demo, sore o tsutae nakereba hajimaranai.",
          "en": "No matter how much you may like them, if you don't let them know nothing will ever start."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%82%93%e3%81%aa%e3%81%ab%ef%bd%9e%e3%81%a6%e3%82%82-donna-ni-temo-meaning/"
    },
    {
      "grammar": "どうしても",
      "meaning": "no matter what; at any cost; after all ~",
      "structure": "どうしても phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "私はどうしても自分の家がほしい。",
          "romaji": "watashi wa doushitemo jibun no ie ga hoshii.",
          "en": "I really want to have my own house (to the point I'd do anything)."
        },
        {
          "jp": "どうしても車が動かなかったので私たちは歩いて行くことにした。",
          "romaji": "doushitemo kuruma ga ugokana katta no de watashi tachi wa aruite iku koto ni shita.",
          "en": "No matter what we tried the car wouldn't start, so finally we decided to go on foot."
        },
        {
          "jp": "どうしても彼女の電話番号が思い出せない。",
          "romaji": "doushitemo kanojo no denwa bangou ga omoi dasenai.",
          "en": "I can't for the life of me remember her phone number."
        },
        {
          "jp": "他の問題はできたのだが、この問題だけはどうしても解けない。",
          "romaji": "hokano mondai wa dekita no daga, kono mondai dake wa doushitemo tokenai.",
          "en": "I was able to do the other problems, but this one I cannot solve no matter how hard I try."
        },
        {
          "jp": "どうしても来られないときは連絡してください。",
          "romaji": "doushitemo korarenai toki wa renraku shite kudasai.",
          "en": "Please contact me when you are not able to come."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%81%97%e3%81%a6%e3%82%82-doushitemo-meaning/"
    },
    {
      "grammar": "ふりをする",
      "meaning": "to pretend; to act as if ~",
      "structure": "Verb (casual) ふりをする Noun + の な-adjective + な い-adjective → ふりをする Noun + の な-adjective + な い-adjective → Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + の な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は聞こえないふりをした。",
          "romaji": "kare wa kikoenai furi o shita.",
          "en": "He pretended to not hear."
        },
        {
          "jp": "彼女は宿題をし終わったふりをしてテレビを見ている。",
          "romaji": "kanojo wa shukudai o shiowatta furi o shite terebi o miteiru.",
          "en": "She pretended that she finished her homework and is watching TV."
        },
        {
          "jp": "分かったふりをしていたが、実はよく分からない。もう一度言ってください。",
          "romaji": "wakatta furi o shiteita ga, jitsuwa yoku wakaranai. mou ichido itte kudasai.",
          "en": "I gave the impression that I understood, but I really didn't. Could you please say it once again?"
        },
        {
          "jp": "彼はいつも人の話を全く聞かないのに、分かっているふりをしている。",
          "romaji": "kare wa itsumo hito no hanashi o mattaku kikanai noni, wakatteiru furi o shiteiru.",
          "en": "Even though he never listens to anyone's stories, he always acts as if he understands."
        },
        {
          "jp": "知らないふりをしているけど本当は知っているでしょう？",
          "romaji": "shiranai furi o shiteiru kedo hontou wa shitteiru deshou?",
          "en": "You're just pretending to not know, but really you do. Right?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b5%e3%82%8a%e3%82%92%e3%81%99%e3%82%8b-furi-o-suru-meaning/"
    },
    {
      "grammar": "ふと",
      "meaning": "suddenly; accidentally; unexpectedly; unintentionally ~",
      "structure": "ふと action → action",
      "explanation": "",
      "examples": [
        {
          "jp": "ふと街で彼に会った。",
          "romaji": "futo machi de kare ni atta.",
          "en": "I met him in the street by chance."
        },
        {
          "jp": "学校に行く途中、ふと今日は母の誕生日だったことを思い出した。",
          "romaji": "gakkou ni iku tochuu, futo kyou wa haha no tanjoubi datta koto o omoidashita.",
          "en": "On my way to school I suddenly remembered that today was my mother's birthday."
        },
        {
          "jp": "財布がないのにふと気がついた。",
          "romaji": "saifu ga nai no ni futo ki ga tsuita.",
          "en": "He suddenly realized he had lost his wallet."
        },
        {
          "jp": "私はあの店で珍しいものをふと見つけた。",
          "romaji": "watashi wa ano mise de mezurashii mono o futo mitsuketa.",
          "en": "I came across a rare item at that store."
        },
        {
          "jp": "素晴らしい考えがふと心に浮かんだ。",
          "romaji": "subarashii kangae ga futo kokoro ni ukanda.",
          "en": "A brilliant idea just occurred to me."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b5%e3%81%a8-futo-meaning/"
    },
    {
      "grammar": "がち",
      "meaning": "tend to; tendency to; frequently; often; to do something easily",
      "structure": "Noun がち Verb ます (stem form) → がち Verb ます (stem form) → Verb ます (stem form) | Verb ます (stem form)",
      "explanation": "",
      "examples": [
        {
          "jp": "私は、仕事でミスしがちです。",
          "romaji": "watashi wa, shigoto de misu shi gachi desu.",
          "en": "I tend to make a lot of mistakes at work."
        },
        {
          "jp": "彼女は、学校をサボりがちです。",
          "romaji": "kanojo wa, gakkou o sabori gachi desu.",
          "en": "She's always skipping school."
        },
        {
          "jp": "ずっと曇りがちの天気が続いている。",
          "romaji": "zutto kumori gachi no tenki ga tsuzuiteiru.",
          "en": "The constant cloudy weather keeps continuing."
        },
        {
          "jp": "パソコンの使いすぎで目が疲れがちです。",
          "romaji": "pasokon no tsukai sugi de me ga tsukare gachi desu.",
          "en": "My eyes tend to get tired from using computers too much."
        },
        {
          "jp": "一人暮らしなので、コンビニ弁当ばかり食べがちだ。",
          "romaji": "hitorigurashi nano de, konbini bentou bakari tabe gachi da.",
          "en": "I live alone, so I tend to only eat meals from the convenience store."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%a1-gachi-meaning/"
    },
    {
      "grammar": "がたい",
      "meaning": "very difficult to; hard to ~",
      "structure": "Verb ます (stem form) がたい → がたい",
      "explanation": "",
      "examples": [
        {
          "jp": "信じがたいことだが、これは事実だ。",
          "romaji": "shinji gatai koto daga, kore wa jijitsu da.",
          "en": "This may be hard to believe, but this is the truth."
        },
        {
          "jp": "許しがたいことです。",
          "romaji": "yurushi gatai koto desu.",
          "en": "This is an unforgivable act."
        },
        {
          "jp": "彼の話は信じがたい内容でした。",
          "romaji": "kare no hanashi wa shinji gatai naiyou deshita.",
          "en": "His story's contents were impossible to believe."
        },
        {
          "jp": "彼女は美人だから近寄りがたい。",
          "romaji": "kanojo wa bijin dakara chikayori gatai.",
          "en": "She's so beautiful, It's impossible for me to approach her."
        },
        {
          "jp": "子どもに対する犯罪は許しがたい。",
          "romaji": "kodomo ni tai suru hanzai wa yurushi gatai.",
          "en": "Crimes against children are unforgivable."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%9f%e3%81%84-gatai-meaning/"
    },
    {
      "grammar": "気味",
      "meaning": "-like; -looking; -looked; tending to ~",
      "structure": "Verb ます (stem form) 気味 ぎみ Noun → 気味 ぎみ Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は人の名前を忘れ気味である。",
          "romaji": "kare wa hito no namae o wasure gimi de aru.",
          "en": "He tends to forget people's names."
        },
        {
          "jp": "昨夜、彼は風邪気味だった。",
          "romaji": "sakuya, kare wa kaze gimi datta.",
          "en": "He had a bit of a cold last night."
        },
        {
          "jp": "風邪気味で、熱っぽいんだ。",
          "romaji": "kaze gimi de, netsu ppoi nda.",
          "en": "I feel like I'm catching a cold, and I'm a bit feverish."
        },
        {
          "jp": "残業続きで疲れ気味だ。",
          "romaji": "zangyou tsuzuki de tsukare gimi da.",
          "en": "I'm feeling a bit tired due to continued overtime work."
        },
        {
          "jp": "新入社員は緊張気味の顔をしています。",
          "romaji": "shinnyuu shain wa kinchou gimi no kao o shiteimasu.",
          "en": "The new employee looks a little bit nervous."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%b0%97%e5%91%b3-%e3%81%8e%e3%81%bf-gimi-meaning/"
    },
    {
      "grammar": "ごとに",
      "meaning": "each; every; at intervals of ~",
      "structure": "Verb (dictionary form) ごとに Noun → ごとに Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "バスは１０分ごとに通っている。",
          "romaji": "basu wa 10 pun goto ni kayotteiru.",
          "en": "The buses run every 10 minutes."
        },
        {
          "jp": "オリンピックは４年ごとに開催される。",
          "romaji": "orinpikku wa yon nen goto ni kaisai sareru.",
          "en": "The Olympics are held every 4 years."
        },
        {
          "jp": "彼は6か月ごとに新作の小説を出している。",
          "romaji": "kare wa 6 ka getsu goto ni shinsaku no shousetsu o dashiteiru.",
          "en": "He puts out a new short novel every 6 months."
        },
        {
          "jp": "このフェリーは３０分ごとに通っている。",
          "romaji": "kono ferii wa 30 pun goto ni kayotteiru.",
          "en": "This ferry runs every 30 minutes."
        },
        {
          "jp": "彼は土曜ごとに恋人に会っている。",
          "romaji": "kare wa doyou goto ni koibito ni atteiru.",
          "en": "He meets his girlfriend on Saturdays."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%94%e3%81%a8%e3%81%ab-goto-ni-meaning/"
    },
    {
      "grammar": "ほど",
      "meaning": "degree; extent; bounds; upper limit",
      "structure": "Verb (casual, non-past) 程 ほど Noun な-adjective + な い-adjective → 程 ほど Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "君ほど美しい人はいません！",
          "romaji": "kimi hodo utsukushii hito wa imasen.",
          "en": "There is no one that rivals your beauty."
        },
        {
          "jp": "死ぬほどのどがかわいている。",
          "romaji": "shinu hodo nodo ga kawaiteiru.",
          "en": "I'm so thirsty I could die.."
        },
        {
          "jp": "今年ほど雨の降った年はなかった。",
          "romaji": "kotoshi hodo ame no futta toshi wa nakatta.",
          "en": "It rained more this year than any other year."
        },
        {
          "jp": "年をとるほど体が弱くなる。",
          "romaji": "toshi o toru hodo karada ga yowaku naru.",
          "en": "My body becomes weaker as I grow older."
        },
        {
          "jp": "ビックリするほど大きい赤ちゃん。",
          "romaji": "bikkuri suru hodo ookii akachan.",
          "en": "The child was surprisingly large."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e7%a8%8b-%e3%81%bb%e3%81%a9-hodo-meaning/"
    },
    {
      "grammar": "ほど～ない",
      "meaning": "is not as… as ~",
      "structure": "Noun + ほど Verb (ない form) Adjective (ない form) → Verb (ない form) Adjective (ない form) → Adjective (ない form) | Adjective (ない form)",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女ほど優しい人はいない。",
          "romaji": "kanojo hodo yasashii hito wa inai.",
          "en": "There’s no one as kind as her."
        },
        {
          "jp": "英語の文法は日本語ほど難しくありません。",
          "romaji": "eigo no bunpou wa nihongo hodo muzukashiku arimasen.",
          "en": "English grammar is not as difficult as Japanese grammar."
        },
        {
          "jp": "東京ほど家賃の高いところはない。",
          "romaji": "toukyou hodo yachin no takai tokoro wa nai.",
          "en": "No city has higher rent than Tokyo."
        },
        {
          "jp": "私ほどあなたのことを大切に思っている人はいないだよ。",
          "romaji": "watashi hodo anata no koto o taisetsu ni omotte iru hito wa inain da.",
          "en": "No one cares for you as much as I do."
        },
        {
          "jp": "彼ほど頭のいい人はいない。",
          "romaji": "kare hodo atama no ii hito wa inai.",
          "en": "There is nobody as clever as he is."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%bb%e3%81%a9%ef%bd%9e%e3%81%aa%e3%81%84-hodo-nai-meaning/"
    },
    {
      "grammar": "一度に",
      "meaning": "all at once",
      "structure": "一度に phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は一度にクッキーを3つ取った。",
          "romaji": "kare wa ichido ni kukkii o mitsu totta.",
          "en": "He took 3 cookies at once."
        },
        {
          "jp": "一度に３冊の本を借りることが出来ます。",
          "romaji": "ichido ni 3 satsu no hon o kariru koto ga dekimasu.",
          "en": "You can borrow three books at a time."
        },
        {
          "jp": "一度に全部はできないよ。",
          "romaji": "ichido ni zenbu wa dekinai yo.",
          "en": "You can't do everything at once."
        },
        {
          "jp": "彼は一度に６個の箱を運んだ。",
          "romaji": "kare wa ichido ni rokko no hako o hakonda.",
          "en": "He carried six boxes at once."
        },
        {
          "jp": "その薬品は一度に全部使用しなければなりません。",
          "romaji": "sono yakuhin wa ichido ni zenbu shiyou shinakereba narimasen.",
          "en": "You must use all of that medicine at the same time."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e5%ba%a6%e3%81%ab-ichido-ni-meaning/"
    },
    {
      "grammar": "いくら～ても",
      "meaning": "no matter how ~",
      "structure": "いくら Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Verb (ても form) Noun + でも な-adjective + でも い-adjective + い くても → Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | Noun + でも な-adjective + でも い-adjective + い くても → な-adjective + でも い-adjective + い くても → い-adjective + い くても | な-adjective + でも い-adjective + い くても → い-adjective + い くても | い-adjective + い くても",
      "explanation": "",
      "examples": [
        {
          "jp": "お金はいくらあっても困りません。",
          "romaji": "okane wa ikura attemo komarimasen.",
          "en": "You can never have too much money."
        },
        {
          "jp": "これはいくら安くても、買いたくない。",
          "romaji": "kore wa ikura yasukutemo, kaitakunai.",
          "en": "No matter how cheap this is, I don't want to buy it."
        },
        {
          "jp": "いくら調べても分からなかったので、先生に聞いた。",
          "romaji": "ikura shirabetemo wakaranakatta node, sensei ni kiita.",
          "en": "I could not understand no matter how much I studied, so I asked my teacher."
        },
        {
          "jp": "これは必要なので、いくら高くても買います。",
          "romaji": "kore wa hitsuyou na node, ikura takakutemo kaimasu.",
          "en": "I need it so I’ll buy it now matter how expensive it is."
        },
        {
          "jp": "いくら好きでも、それを伝えなければ始まらない。",
          "romaji": "ikura suki demo, sore o tsutae nakereba hajimaranai.",
          "en": "No matter how much you may like them, if you don't let them know nothing will ever start."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%8f%e3%82%89%ef%bd%9e%e3%81%a6%e3%82%82-ikura-temo-meaning/"
    },
    {
      "grammar": "一方だ",
      "meaning": "more and more; continue to ~",
      "structure": "Verb (dictionary form) 一方だ → 一方だ",
      "explanation": "",
      "examples": [
        {
          "jp": "最近、この町の人口は減る一方だ。",
          "romaji": "saikin, kono machi no jinkou wa heru ippou da.",
          "en": "Recently, this town's population continues to decrease."
        },
        {
          "jp": "日本に来る外国人の数は増える一方だ。",
          "romaji": "nihon ni kuru gaikokujin no kazu wa fueru ippou da.",
          "en": "The number of foreigners coming to Japan continues to increase."
        },
        {
          "jp": "交通事故は増える一方だ。",
          "romaji": "koutsuu jiko wa fueru ippou da.",
          "en": "Traffic accidents are continuing to increase."
        },
        {
          "jp": "私は全然勉強していないので、成績は下がる一方だ。",
          "romaji": "watashi wa zenzen benkyou shite inai node, seiseki wa sagaru ippou da.",
          "en": "I never study and so my grades just keep dropping."
        },
        {
          "jp": "日本の人口はこのままだと減少する一方だと思います。",
          "romaji": "nihon no jinkou wa kono mama da to genshou suru ippou da to omoimasu.",
          "en": "With Japan's population situation as it is, I think it will just continue to decline."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e6%96%b9%e3%81%a0-ippou-da-meaning/"
    },
    {
      "grammar": "一体",
      "meaning": "emphasis; what on earth; what in the world",
      "structure": "一体 いったい question → question",
      "explanation": "",
      "examples": [
        {
          "jp": "一体どこで彼に会ったんだ。",
          "romaji": "ittai doko de kare ni atta nda.",
          "en": "Where on earth did you meet him?"
        },
        {
          "jp": "あなたは一体何をしていますか？",
          "romaji": "anata wa ittai nani o shite imasu ka?",
          "en": "What exactly are you doing?"
        },
        {
          "jp": "あの人は一体何の者だ？",
          "romaji": "ano hito wa ittai nan no mono da?",
          "en": "Who in the world is that?"
        },
        {
          "jp": "彼女は一体どこに住んでいるだろう。",
          "romaji": "kanojo wa ittai doko ni sunde iru darou.",
          "en": "Where in the world does she live?"
        },
        {
          "jp": "一体誰が彼女にそんなことを言ったのか？",
          "romaji": "ittai dare ga kanojo ni sonna koto o itta no ka?",
          "en": "Who could have said such a thing to her?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e4%bd%93-%e3%81%84%e3%81%a3%e3%81%9f%e3%81%84-ittai-meaning/"
    },
    {
      "grammar": "じゃない",
      "meaning": "maybe; most likely; confirmation of information; express surprise towards listener",
      "structure": "Phrase じゃない → じゃない",
      "explanation": "",
      "examples": [
        {
          "jp": "トムさんも来るじゃない？",
          "romaji": "tomu san mo kuru janai?",
          "en": "Tom will surely come as well?"
        },
        {
          "jp": "あそこにいる人って、田中先生じゃない？",
          "romaji": "asoko ni iru hito tte, tanaka sensei janai?",
          "en": "Isn't that person over there Mr. Tanaka?"
        },
        {
          "jp": "やればできるじゃない。",
          "romaji": "yareba dekiru janai.",
          "en": "I didn't think you had it in you."
        },
        {
          "jp": "彼は今度も来ないんじゃないかな。",
          "romaji": "kare wa kondo mo konai n janai kana.",
          "en": "I don't think he'll come this time either."
        },
        {
          "jp": "ちょっと！危ないじゃない。",
          "romaji": "chotto! abunai janai.",
          "en": "Be careful, that's dangerous!"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%98%e3%82%83%e3%81%aa%e3%81%84-janai-meaning/"
    },
    {
      "grammar": "か何か",
      "meaning": "or something ~",
      "structure": "Noun か何か → か何か",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は病気か何かだろう。",
          "romaji": "kare wa byouki ka nani ka darou.",
          "en": "He must be sick or something."
        },
        {
          "jp": "オレンジジュースか何か欲しいな。",
          "romaji": "orenji juusu ka nani ka hoshii na.",
          "en": "I want some orange juice or something."
        },
        {
          "jp": "私はアイスクリームか何か食べたいです。",
          "romaji": "watashi wa aisu kuriimu ka nani ka tabetai desu.",
          "en": "I want to eat ice cream or something."
        },
        {
          "jp": "帰りは寒いから上着か何か持っていった方がいいよ 。",
          "romaji": "kaeri wa samui kara uwagi ka nani ka motte itta hou ga ii yo.",
          "en": "It will be cold when you come back, so you'd best bring a jacket or something."
        },
        {
          "jp": "昼ご飯はサンドイッチか何かを作ってあげましょうか。",
          "romaji": "hiru gohan wa sandoicchi ka nani ka tsukutte agemashou ka.",
          "en": "I'll fix a sandwich or something for your lunch?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e4%bd%95%e3%81%8b-ka-nani-ka-meaning/"
    },
    {
      "grammar": "かける",
      "meaning": "half-; not yet finished; in the middle of~",
      "structure": "Verb ます (stem form) かける かけの → かける かけの",
      "explanation": "",
      "examples": [
        {
          "jp": "お風呂に入りかけたときに電話が鳴った。",
          "romaji": "ofuro ni hairi kaketa toki ni denwa ga natta.",
          "en": "The phone rang when I was about to get in the bath."
        },
        {
          "jp": "この本はまだ読みかけだ。",
          "romaji": "kono hon wa mada yomikake da.",
          "en": "I haven’t finished this book yet."
        },
        {
          "jp": "テーブルの上に食べかけのケーキが置いてある。",
          "romaji": "teeburu no ue ni tabe kake no keeki ga oitearu.",
          "en": "The half-finished cake is put on the table."
        },
        {
          "jp": "彼は何か大事そうなことを言いかけて、やめてしまった。",
          "romaji": "kare wa nani ka daiji souna koto o ii kakete, yamete shimatta.",
          "en": "He stopped in the middle of saying something that sounded important."
        },
        {
          "jp": "彼女へのラブレターを書いたが、ポストに入れかけて、やっぱりやめた。",
          "romaji": "kanojo e no raburetaa o kaitaga, posuto ni ire kakete, yappari yameta.",
          "en": "I wrote a love letter for her and was halfway to putting it in the post before I changed my mind."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%91%e3%82%8b-kakeru-meaning/"
    },
    {
      "grammar": "から〜にかけて",
      "meaning": "through; from [A] to [B]",
      "structure": "Noun-1 から Noun-2 にかけて → から Noun-2 にかけて → Noun-2 にかけて → にかけて",
      "explanation": "",
      "examples": [
        {
          "jp": "東京から京都にかけて新幹線で行くのは何時間かかるの？",
          "romaji": "toukyou kara kyouto ni kakete shinkansen de iku no wa nan jikan kakaru no?",
          "en": "How long does it take to get from Tokyo to Kyoto by bullet train?"
        },
        {
          "jp": "午前から夕方にかけて昼寝をした。",
          "romaji": "gozen kara yuugata ni kakete hirune o shita.",
          "en": "I took a nap from morning until evening."
        },
        {
          "jp": "日本では、大学の入学試験は、普通２月から３月にかけて行われる。",
          "romaji": "nihon dewa, daigaku no nyuugaku shiken wa, futsuu nigatsu kara sangatsu ni kakete okonawareru.",
          "en": "In Japan, university entrance exam is usually held from February to March."
        },
        {
          "jp": "明日は昼から夕方にかけて雨でしょう。",
          "romaji": "ashita wa hiru kara yuugata ni kakete ame deshou.",
          "en": "Tomorrow it will rain from noon through late afternoon."
        },
        {
          "jp": "六月から七月にかけて、日本は梅雨のシーズンです。",
          "romaji": "6 gatsu kara 7gatsu ni kakete, nihon wa tsuyu no shiizun desu.",
          "en": "From June to July is Japan's rainy season."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%82%89%e3%80%9c%e3%81%ab%e3%81%8b%e3%81%91%e3%81%a6-kara-ni-kakete-meaning/"
    },
    {
      "grammar": "代わりに",
      "meaning": "instead of; as a substitute for​; in exchange for; in return for",
      "structure": "Verb (casual) 代わりに Noun + の その → 代わりに Noun + の その → Noun + の その → その | Noun + の その → その | その",
      "explanation": "",
      "examples": [
        {
          "jp": "私が部長の代わりに出張に行きます。",
          "romaji": "watashi ga buchou no kawari ni shucchou ni ikimasu.",
          "en": "I will go on a business trip on behalf of my manager."
        },
        {
          "jp": "今朝はコーヒーの代わりにお茶を飲んだ。",
          "romaji": "kesa wa koohii no kawari ni ocha o nonda.",
          "en": "This morning, I drank tea instead of coffee."
        },
        {
          "jp": "昨日残業した代わりに、今日は少し早く帰っていいと言われた。",
          "romaji": "kinou zangyou shita kawari ni, kyou wa sukoshi hayaku kaette ii to iwareta.",
          "en": "In exchange for working overtime yesterday, I was told I could leave a little earlier today."
        },
        {
          "jp": "今日は仕事へ車で行く代わりに自転車で行った。",
          "romaji": "kyou wa shigoto e iku kawari ni jitensha de itta.",
          "en": "Today, instead of going to work by car, I went by bicycle."
        },
        {
          "jp": "お箸がないので、その代わりにフォークを使う。",
          "romaji": "ohashi ga nai no de, sono kawari ni fooku o tsukau.",
          "en": "Since I do not have any chopsticks, I will use a fork instead"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%bb%a3%e3%82%8f%e3%82%8a%e3%81%ab-%e3%81%8b%e3%82%8f%e3%82%8a%e3%81%ab-kawari-ni-meaning/"
    },
    {
      "grammar": "結果",
      "meaning": "as a result of; after ~",
      "structure": "Verb (casual, past) 結果 けっか Noun + の その → 結果 けっか Noun + の その → Noun + の その → その | Noun + の その → その | その",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は仕事をサボった結果として首になった。",
          "romaji": "kare wa shigoto o sabotta kekka toshite kubi ni natta.",
          "en": "As a result of him skipping work, he was fired."
        },
        {
          "jp": "みんなで相談した結果、今回は参加しないことにした。",
          "romaji": "minna de soudan shita kekka, konkai wa sanka shinai koto ni shita.",
          "en": "After consulting with everyone, I've decided to not participate this time."
        },
        {
          "jp": "ほとんど勉強をしなかった。その結果、試験に落ちてしまった。",
          "romaji": "hotondo benkyou o shinakatta. sono kekka, shiken ni ochite shimatta.",
          "en": "I barely studied. As a result, I failed my exam."
        },
        {
          "jp": "これは君の努力の結果だと思います。",
          "romaji": "kore wa kimi no doryoku no kekka da to omoimasu.",
          "en": "I think this is a result of your hard effort."
        },
        {
          "jp": "毎日ご飯の量を減らした結果、1ヶ月で3キロ体重が減った。",
          "romaji": "mainichi gohan no ryou o herashita kekka, ikkagetsu de san kiro taijuu ga hetta.",
          "en": "As a result of reducing the amount of food I eat every day, I lost 3 kilograms after 1 month."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%9f%e7%b5%90%e6%9e%9c-ta-kekka-meaning/"
    },
    {
      "grammar": "結局",
      "meaning": "after all; eventually; in the end ~",
      "structure": "(phrase) 結局（は） conclusion → 結局（は） conclusion → conclusion",
      "explanation": "",
      "examples": [
        {
          "jp": "結局彼はそれを買わなかった。",
          "romaji": "kekkyoku kare wa sore o kawanakatta.",
          "en": "He didn't buy it in the end."
        },
        {
          "jp": "友人から何度も誘われたが、結局行かないことにした。",
          "romaji": "yuujin kara nando mo sasowareta ga, kekkyoku ikanai koto ni shita.",
          "en": "I was invited by my good friend countless times, but ultimately decided not to go."
        },
        {
          "jp": "私たちは結局この試合に負けてしまった。",
          "romaji": "watashitachi wa kekkyoku kono shiai ni makete shimatta.",
          "en": "In the end, we lost this match."
        },
        {
          "jp": "彼は働きすぎて、結局は病気になってしまった。",
          "romaji": "kare wa hatarakisugite, kekkyoku wa byouki ni natte shimatta.",
          "en": "He worked so hard that eventually he made himself ill."
        },
        {
          "jp": "お昼は何を食べようかと考えていたけど、結局ハンバーガーにした。",
          "romaji": "ohiru wa nani o tabeyou ka to kangaeteita kedo, kekkyoku hanbaagaa ni shita.",
          "en": "I was thinking about what I should eat for lunch, but ended up getting a hamburger."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e7%b5%90%e5%b1%80%e3%81%af-kekkyoku-wa-meaning/"
    }
  ],
  "N2": [
    {
      "grammar": "あげく",
      "meaning": "to end up; in the end; finally; after all ~",
      "structure": "Verb (た form) あげく（に） Noun + の → あげく（に） Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "2時間も待たされたあげく、結局に試合は延期になった。",
          "romaji": "2 jikan mo matasareta ageku, keekyoku ni shiai wa enki ni natta.",
          "en": "After waiting for 2 hours, the match ended up being postponed."
        },
        {
          "jp": "毎日の残業のあげく、彼女は倒れて入院することになりました。",
          "romaji": "mainichi no zangyou no ageku, kanojo wa taorete nyuuin shita koto ni nari mashita.",
          "en": "After working overtime everyday, she collapsed and was hospitalized."
        },
        {
          "jp": "人気のラーメン店に２時間も並んだあげく、売り切れで食べられなかった。",
          "romaji": "ninki no raamen mise ni 2 jikan mo naranda ageku, urikire de taberarena katta.",
          "en": "After waiting at the popular ramen shop for 2 hours, they ended up sold out and I couldn't eat anything."
        },
        {
          "jp": "どの大学に入ろうかと、さんざん悩んだあげく、京都大学に決めた。",
          "romaji": "dono daigaku ni hairou ka to, sanzan nayanda ageku, kyouto daigaku ni kimeta.",
          "en": "After thinking it over carefully about which university to enter, I decided on Kyoto University."
        },
        {
          "jp": "彼らは夫婦げんかを繰り返したあげく、とうとう離婚した。",
          "romaji": "karera wa fuufu genka o kurikaeshita ageku, toutou rikon shita.",
          "en": "After fighting countless times, they finally got a divorce."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%92%e3%81%8f-ageku-meaning/"
    },
    {
      "grammar": "あるいは",
      "meaning": "or; either; maybe; perhaps; possibly ~",
      "structure": "あるいは other option → other option",
      "explanation": "",
      "examples": [
        {
          "jp": "今日中にファックス、あるいは、メールで送ってください。",
          "romaji": "kyoujuu ni fakkusu, aruiwa meeru de okutte kudasai.",
          "en": "Please send it today via fax or mail."
        },
        {
          "jp": "ご注文は電話か、あるいはインターネットでお願いします。",
          "romaji": "gochuumon wa, aruiwa intaanetto de onegai shimasu.",
          "en": "Please order either by phone or online."
        },
        {
          "jp": "来週の火曜日の午後はどうですか。あるいは水曜日の午前でも構いませんが．．．",
          "romaji": "raishuu no kayoubi no gogo wa dou desuka. aruiwa suiyoubi no gozen demo kamai masen ga…",
          "en": "How about Tuesday afternoon next week? Or Wednesday morning also works."
        },
        {
          "jp": "進学するか、あるいは就職するか私は迷っています。",
          "romaji": "shingaku suru ka, aruiwa shuushoku suru ka watashi wa mayotte imaus.",
          "en": "I'm not sure whether I should advance my education or start working."
        },
        {
          "jp": "あるいはそれは本当かもしれない。",
          "romaji": "aruiwa sore wa hontou kamoshirenai.",
          "en": "Perhaps that's true."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%82%8b%e3%81%84%e3%81%af-aruiwa-meaning/"
    },
    {
      "grammar": "ばかり",
      "meaning": "about, approximately ~",
      "structure": "Noun (indicates time or distance) ばかり → ばかり",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女は30分ばかりベッドに横になった。",
          "romaji": "kanojo wa 30 pun bakari beddo ni yoko ni natta.",
          "en": "She lay in bed for about a half-hour."
        },
        {
          "jp": "５分ばかりこの道を行けば、右手にその店があります。",
          "romaji": "go fun bakari kono michi o ikeba, migite ni sono mise ga arimasu.",
          "en": "If you continue on this road for about 5 minutes, that shop will be on your right."
        },
        {
          "jp": "さくら大学まで２時間ばかりで着くと思います。",
          "romaji": "sakura daigaku made 2 jikan bakari de tsuku to omoimasu.",
          "en": "I think it takes about 2 hours to get to Sakura University."
        },
        {
          "jp": "今日は8時間ばかりプログラミングをやって、目が疲れた。",
          "romaji": "kyou wa 8 jikan bakari puroguramingu o yatte, me ga tsukareta.",
          "en": "Today I did programming for about 8 hours and my eyes are really tired."
        },
        {
          "jp": "昨日は4時間ばかりハイキングをしたから、今日は筋肉が痛い。",
          "romaji": "kinou wa 4 jikan bakari haikingu o shita kara, kyou wa kinniku ga itai.",
          "en": "Because I went hiking yesterday for about 4 hours, today my muscles are sore."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/n2-%e3%81%b0%e3%81%8b%e3%82%8a-bakari-meaning/"
    },
    {
      "grammar": "ばかりだ",
      "meaning": "continue to (go in negative direction)",
      "structure": "Verb (dictionary) ばかりだ ばかりです → ばかりだ ばかりです",
      "explanation": "",
      "examples": [
        {
          "jp": "あの二人の関係は悪くなるばかりだ。",
          "romaji": "ano futari no kankei wa waruku naru bakari da.",
          "en": "Their relationship just keeps getting worse."
        },
        {
          "jp": "物価は上がるばかりだ。",
          "romaji": "bukka wa agaru bakari da.",
          "en": "Prices just keep going up and up."
        },
        {
          "jp": "この傷が深くなるばかりだ。",
          "romaji": "kono kizu ga fukaku naru bakari da.",
          "en": "This wound keeps getting worse and worse."
        },
        {
          "jp": "日本の人口が減るばかりです。",
          "romaji": "nihon no jinkou ga heru bakari desu.",
          "en": "Japan's population keeps continuing to decrease."
        },
        {
          "jp": "薬を飲んでいるのに、症状は悪くなるばかりだ。",
          "romaji": "kusuri o nondeiru no ni, shoujou wa waruku naru bakari da.",
          "en": "Even though I am taking medicine, my symptoms keep getting worse."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a%e3%81%a0-bakari-da-meaning/"
    },
    {
      "grammar": "ばかりか",
      "meaning": "not only... but also; as well as ~",
      "structure": "Verb (casual) ばかりか Noun な-adjective + な い-adjective → ばかりか Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "このマンションは狭いばかりか、暗いです。",
          "romaji": "kono manshon wa semai bakari ka, kurai desu.",
          "en": "This apartment is not only very small, it's also quite dark."
        },
        {
          "jp": "私は、漢字ばかりか、ひらがなもカタカナも書けません。",
          "romaji": "watashi wa, kanji bakarika, hiragana mo katakana mo kakemasen.",
          "en": "Not only can I not write kanji, but I can't even write hiragana or katakana."
        },
        {
          "jp": "このレストランは、味が悪いばかりか、店員の態度も悪い。",
          "romaji": "kono resutoran wa, aji ga warui bakari ka, tenin no taido mo warui.",
          "en": "Not only is this restaurant's food bad, but the service is also horrible."
        },
        {
          "jp": "花子さんはスポーツが上手なばかりか、成績も優秀である。",
          "romaji": "hanako san wa supootsu ga jouzu na bakari ka, seiseki mo yuushuu de aru.",
          "en": "Hanako is not only good at sports, but she also has excellent grades."
        },
        {
          "jp": "うちの子は7歳なのに日本語ばかりか英語まで喋れるよ。",
          "romaji": "uchi no ko wa 7 sai nano ni nihongo bakari ka eigo made shabereru yo!",
          "en": "Although our child is only 7, they can speak not only Japanese, but English as well."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a%e3%81%8b-bakari-ka-meaning/"
    },
    {
      "grammar": "ばかりに",
      "meaning": "simply because; on account of~ (negative result)",
      "structure": "Verb (casual) ばかりに Noun (+ である) な-adjective + な/である い-adjective → ばかりに Noun (+ である) な-adjective + な/である い-adjective → Noun (+ である) な-adjective + な/である い-adjective → な-adjective + な/である い-adjective → い-adjective | Noun (+ である) な-adjective + な/である い-adjective → な-adjective + な/である い-adjective → い-adjective | な-adjective + な/である い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "お金がないばかりに、今度の旅行に行けなかった。",
          "romaji": "okane ga nai bakari ni, kondo no ryokou ni ikenakatta.",
          "en": "I wasn't able to go on this trip since I don't have any money."
        },
        {
          "jp": "ホラー映画を見たばかりに、怖くてなかなか寝られない。",
          "romaji": "horaa eiga o mita bakari ni, kowakute nakanaka nerarenai.",
          "en": "I watched a horror movie, which was really scary and now I can't seem to fall asleep."
        },
        {
          "jp": "先輩のアドバイスを聞き入れなかったばかりに大きな失敗をしてしまった。",
          "romaji": "senpai no adobaisu o kiki irenakatta bakari ni ooki na shippai o shite shimatta.",
          "en": "I didn't listen to the advice of my senior and ended up making a huge mistake."
        },
        {
          "jp": "彼の一言を信じたばかりにひどい目にあった。",
          "romaji": "kare no hitokoto o shinjita bakari ni hidoime ni atta.",
          "en": "I had a horrible experience all because I believed what he said."
        },
        {
          "jp": "経験がないばかりに苦労した。",
          "romaji": "keiken ga nai bakari ni kurou shita.",
          "en": "I suffered since I lacked any experience."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a%e3%81%ab-bakari-ni-meaning/"
    },
    {
      "grammar": "ちなみに",
      "meaning": "by the way; in this connection; incidentally; (conjunction)",
      "structure": "ちなみに phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "これ、お土産だよ。ちなみにベトナムで買ったんだよ。",
          "romaji": "kore, omiyage da yo. chinamini betonamu de katta nda yo.",
          "en": "Here is a souvenir. I bought it in Vietnam by the way."
        },
        {
          "jp": "ちなみに、私のことを覚えていますか？",
          "romaji": "chinamini, watashi no koto o oboete imasu ka?",
          "en": "By the way, do you remember me?"
        },
        {
          "jp": "ちなみに、私は刺身と寿司は好きではない。",
          "romaji": "chinamini, watashi wa sashimi to sushi wa suki dewa nai.",
          "en": "Incidentally, I do not like sashimi or sushi."
        },
        {
          "jp": "N2に合格したよ！ちなみに満点だったよ！",
          "romaji": "N2 ni goukaku shita yo! chinamini manten datta yo!",
          "en": "I passed the N2! And by the way, I got a full score!"
        },
        {
          "jp": "ちなみに、私の日本語が間違ってたら遠慮なく言ってください。",
          "romaji": "chinamini, watashi no nihongo ga machigatte tarae enryo naku itte kudasai.",
          "en": "By the way, please feel free to tell me if my Japanese is wrong."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a1%e3%81%aa%e3%81%bf%e3%81%ab-chinamini-meaning/"
    },
    {
      "grammar": "ちっとも～ない",
      "meaning": "(not) at all; (not) in the least ~",
      "structure": "ちっとも Verb (ない form) → Verb (ない form)",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は酒はちっとも飲まない。",
          "romaji": "kare wa sake wa chitto mo nomanai.",
          "en": "He doesn't drink any alcohol at all."
        },
        {
          "jp": "この商品はちっとも売れない。",
          "romaji": "kono shouhin wa chitto mo urenai.",
          "en": "This product does not sell at all."
        },
        {
          "jp": "俺の妻は英語をちっとも知らない。彼女は日本語しか話せない。",
          "romaji": "ore no tsuma wa eigo o chitto mo shiranai. kanojo wa nihongo shika hanasenai.",
          "en": "My wife doesn't know any English. She only speaks Japanese."
        },
        {
          "jp": "彼は父親の言うことをちっとも聞かない。",
          "romaji": "kare wa chichioya no iukoto o chitto mo kikanai.",
          "en": "He doesn't listen to anything his father says."
        },
        {
          "jp": "彼は女の子の気持なんかちっともわからない。",
          "romaji": "kare wa onna no ko no kimochi nanka chitto mo wakarai.",
          "en": "He doesn't understand the feelings of young women one bit."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a1%e3%81%a3%e3%81%a8%e3%82%82%ef%bd%9e%e3%81%aa%e3%81%84-chitto-monai-meaning/"
    },
    {
      "grammar": "だけあって",
      "meaning": "being the case; precisely because; as expected from ~",
      "structure": "Verb (casual) だけあって だけのことはあって Noun な-adjective + な い-adjective → だけあって だけのことはあって Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "このアパートは駅に近いだけあって、やっぱり家賃も高い。",
          "romaji": "kono apaato wa eki ni chikai dake atte, yappari yachin ga takai.",
          "en": "This apartment is close to the station, so as expected the rent is expensive."
        },
        {
          "jp": "さすが大都会だけあって何かしら仕事がある。",
          "romaji": "sasuga daitokai dake atte nanika shira shigoto ga aru.",
          "en": "As expected of a big city, there is always work to do."
        },
        {
          "jp": "料理教室に通っているだけあって、彼女の作る料理はとても美味しい。",
          "romaji": "ryouri kyoushitsu ni kayotte iru dake atte, kanojo no tsukuru ryouri wa totemo oishii.",
          "en": "She is taking lessons at a cooking school and so the food she makes is really delicious."
        },
        {
          "jp": "このバッグは安いだけあってすぐに壊れてしまった。",
          "romaji": "kono baggu wa yasui dake atte sugu ni kowarete shimatta.",
          "en": "As expected of this cheap bag, it broke right away."
        },
        {
          "jp": "この場所は有名なだけあって、たくさんの観光客がいる。",
          "romaji": "kono basho wa yuumei na dake atte, takusan no kankoukyaku ga iru.",
          "en": "This is a very famous place and so there are lots of tourists."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%82%e3%81%a3%e3%81%a6-dake-atte-meaning/"
    },
    {
      "grammar": "だけましだ",
      "meaning": "it’s better than; one should feel grateful for ~",
      "structure": "Verb (casual) だけましだ Noun + である な-adjective + な い-adjective → だけましだ Noun + である な-adjective + な い-adjective → Noun + である な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun + である な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "今日は暑いが、湿度が高くないだけましだ。",
          "romaji": "kyou wa atsui ga, shitsudo ga takakunai dake mashi da.",
          "en": "It's hot today, but I'm glad the humidity is low."
        },
        {
          "jp": "君は仕事があるだけましだよ。俺は首になってしまった。",
          "romaji": "kimi wa shigoto ga aru dake mashida yo. ore wa kubi ni natte shimatta.",
          "en": "You should be grateful for even having a job. I got fired."
        },
        {
          "jp": "僕のアパートは、狭くて高いけれど、便利なだけましだ。",
          "romaji": "boku no apaato wa, semakute takai keredo, benri na dake mashi da.",
          "en": "My apartment is narrow and tall, but convenient, which I am grateful for."
        },
        {
          "jp": "車とぶつかって私の自転車が壊れてしまったが、怪我がなかっただけましだ。",
          "romaji": "kuruma to butsukatte watashi no jitensha ga kowarete shimatta ga, kega ga nakatta dake mashi da.",
          "en": "I ran into a car and destroyed my bike, but I'm just glad there were no injuries."
        },
        {
          "jp": "給料が減ったけれど、首にならないだけましだ。",
          "romaji": "kyuuryou ga hetta keredo, kubi ni naranai dake mashida.",
          "en": "Although my salary has gone down, I’m grateful they didn’t fire me."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%be%e3%81%97%e3%81%a0-dake-mashi-da-meaning/"
    },
    {
      "grammar": "だけに",
      "meaning": "being the case; precisely because; as one would expect",
      "structure": "Verb (casual) だけに Noun な-adjective + な い-adjective → だけに Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "駅が近いだけに家賃も高い。",
          "romaji": "eki ga chikai dake ni yachin mo takai.",
          "en": "The station is nearby, which is also why the rent is so high."
        },
        {
          "jp": "このホテルは５つ星ホテルなだけに、サービスが充実している。",
          "romaji": "kono hoteru wa itsutsu boshi hoteru na dake ni, saabisu ga juujitsu shite iru.",
          "en": "As one would expect of a 5-star hotel, the service is perfect."
        },
        {
          "jp": "彼女は日本語を20年教えているだけに、教え方がとても上手だ。",
          "romaji": "kanojo wa nihongo o 20 nen oshiete iru dake ni, oshiekata ga totemo jouzu da.",
          "en": "As expected of someone who has taught Japanese for 20 years, her teaching style is very good."
        },
        {
          "jp": "田中さんは小学校の時にアメリカで生活していただけに、英語の発音はネイティブのようだ。",
          "romaji": "tanaka san wa shougakkou no toki ni amerika de seikatsu shiteita dake ni, eigo no hatsuon wa neitibu no you da.",
          "en": "Tanaka spent his elementary school days in America, and as one would expect his English pronunciation is just like a native."
        },
        {
          "jp": "試験のために一生懸命勉強しただけに、不合格のショックは大きかった。",
          "romaji": "shiken no tame ni isshoukenmei benkyou shita dake ni, fugoukaku no shokku wa ookikatta.",
          "en": "I studied very hard for the exam, so I was really shocked when I heard that I failed."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%ab-dake-ni-meaning/"
    },
    {
      "grammar": "だけのことはある",
      "meaning": "no wonder; as expected of; not ... for nothing; not ... with nothing to show for it",
      "structure": "Verb (casual) だけ（のことは）ある Noun な-adjective + な い-adjective → だけ（のことは）ある Noun な-adjective + な い-adjective → Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | Noun な-adjective + な い-adjective → な-adjective + な い-adjective → い-adjective | な-adjective + な い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "山田さんは英語が上手だ。アメリカに留学していただけのことはある。",
          "romaji": "yamada san wa eigo ga jouzu da. amerika ni ryuugaku shiteita dake no koto wa aru.",
          "en": "Mr. Yamada is good at English. As expected of someone who studied abroad in America."
        },
        {
          "jp": "このホテルはサービスが素晴らしい。5つ星ホテルだけのことはある。",
          "romaji": "kono hoteru wa saabisu ga subarashii. itsutsu boshi hoteru dake no koto wa aru.",
          "en": "This hotel has amazing service. As expected of a 5 star hotel."
        },
        {
          "jp": "料理教室に通っているだけのことはある、彼女の手作り料理はとても美味しい。",
          "romaji": "ryouri kyoushitsu o kayotte iru dake no koto wa aru, kanojo no tedukuri ryouri wa totemo oishii.",
          "en": "As expected of someone attending cooking classes, her homemade cooking is very delicious."
        },
        {
          "jp": "彼は体力があって疲れ知らずだ。やっぱり若いだけのことはある。",
          "romaji": "kare wa tairyoku ga atte tsukare shirazu da. yappari wakai dake no koto wa aru.",
          "en": "He has a lot of stamina and doesn't seem to ever get tired. As expected of someone so young."
        },
        {
          "jp": "彼はさすが大学に行っただけのことはある。",
          "romaji": "kare wa sasuga daigaku ni itta dake no koto wa aru.",
          "en": "He did not go to university for nothing."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%ae%e3%81%93%e3%81%a8%e3%81%af%e3%81%82%e3%82%8b-dake-no-koto-wa-aru-meaning/"
    },
    {
      "grammar": "だけは",
      "meaning": "to do all that one can",
      "structure": "Verb (dictionary form) だけは Same verb (past form) → だけは Same verb (past form) → Same verb (past form)",
      "explanation": "",
      "examples": [
        {
          "jp": "走れるだけは速く走った。",
          "romaji": "hashireru dake wa hayaku hashitta.",
          "en": "I ran as fast as my legs could carry me."
        },
        {
          "jp": "私はあなたを手伝えるだけは手伝ったよ。",
          "romaji": "watashi wa anata o tetsudaeru dake wa tetsudatta yo.",
          "en": "I did everything I could to help you."
        },
        {
          "jp": "彼氏のことは親に話すだけは話しました。",
          "romaji": "kareshi no koto wa oya ni hanasu dake wa hanashimashita.",
          "en": "I told my parents everything there is to say about my boyfriend."
        },
        {
          "jp": "覚えるだけは覚えたのだから 、後は試験の日を待つだけだ。",
          "romaji": "oboeru dake wa oboeta no da kara, ato wa shiken no hi o matsu dake da.",
          "en": "I've memorized everything I need to know, so all that's left is to wait until the day of the test."
        },
        {
          "jp": "すべて彼のことを聞くだけは聞いたが彼は悪い人を思わないよ。",
          "romaji": "subete kare no koto o kiku dake wa kiita ga kare wa warui hito o omowanai yo.",
          "en": "I heard everything I could about him, but I don't think he is a bad person."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%91%e3%81%af-dake-wa-meaning/"
    },
    {
      "grammar": "だって",
      "meaning": "because; but; after all; even; too",
      "structure": "Noun + だって even, too だって + phrase because, but → even, too だって + phrase because, but → だって + phrase because, but → because, but | だって + phrase because, but → because, but",
      "explanation": "",
      "examples": [
        {
          "jp": "彼だって人間だ。",
          "romaji": "kare datte ningen da.",
          "en": "He is only human."
        },
        {
          "jp": "私だってあなたに会いたい。",
          "romaji": "watashi datte anata ni aitai.",
          "en": "I miss you too."
        },
        {
          "jp": "誰だってそんなことは知っているさ。",
          "romaji": "dare datte sonna koto wa shitteiru sa.",
          "en": "Everybody knows that."
        },
        {
          "jp": "私だって本くらい読むよ。",
          "romaji": "watashi datte hon kurai yomu yo.",
          "en": "Even I read books every once in a while."
        },
        {
          "jp": "「何を怒ってるの？」「だって、約束を破ったじゃん。』",
          "romaji": "「nani o okotteru no?」「datte, yakusoku o yabutta jan.」",
          "en": "\"Why are you upset?\"\"Because you broke your promise!\""
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%a3%e3%81%a6-datte-meaning/"
    },
    {
      "grammar": "でしかない",
      "meaning": "merely; nothing but; no more than; there is only ~",
      "structure": "Noun でしかない → でしかない",
      "explanation": "",
      "examples": [
        {
          "jp": "これらの考えは推測でしかない。",
          "romaji": "korera no kangae wa suisoku de shika nai.",
          "en": "This idea is nothing more than a guess."
        },
        {
          "jp": "この作業は時間の無駄でしかない。",
          "romaji": "kono sagyou wa jikan no muda de shika nai.",
          "en": "This work is nothing but a waste of time."
        },
        {
          "jp": "夢は夢でしかない。",
          "romaji": "yume wa yume de shika nai.",
          "en": "Dreams are nothing more than dreams."
        },
        {
          "jp": "もし薬で治らなかったら、手術でしかない。",
          "romaji": "moshi kusuri de naorana kattara, shujutsu de shika nai.",
          "en": "If it doesn't heal with the medicine, then there is no choice but to have surgery."
        },
        {
          "jp": "彼は社長ですが、両親の目から見るといつまでも子供でしかない。",
          "romaji": "kare wa shachou desu ga, ryoushin no me kara miru to itsu made mo kodomo de shika nai.",
          "en": "He might be a company president, but to his parents he’s only a kid."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%97%e3%81%8b%e3%81%aa%e3%81%84-de-shika-nai-meaning/"
    },
    {
      "grammar": "どころではない",
      "meaning": "not the time for; not the place for; far from; anything but ~",
      "structure": "Verb (casual) どころではない どころじゃない Noun → どころではない どころじゃない Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "彼はよく間違いをするが、バカどころではない。",
          "romaji": "kare wa yoku machigai o suru ga, baka dokoro dewa nai.",
          "en": "He often makes mistakes, but he is no fool."
        },
        {
          "jp": "宿題がたくさんあってテレビを見るどころではない。",
          "romaji": "shukudai ga takusan atte terebi o miru dokoro dewa nai.",
          "en": "There's a bunch of homework to do, this is no time to be watching TV."
        },
        {
          "jp": "風邪がひどくて、遊びに行くどころじゃない。",
          "romaji": "kaze ga hidokute, asobi ni iku doroko janai.",
          "en": "I have a bad cold and can't even think about going out right now."
        },
        {
          "jp": "彼女はケーキ屋で働いているから、毎年クリスマスは彼氏とデートどころではない。",
          "romaji": "kanojo wa keekiya de hataraite iru kara, maitoshi kurisumasu wa kanojo to deeto dokoro dewa nai.",
          "en": "She works at a cake shop so every year on Christmas she has no time to go on a date with her boyfriend."
        },
        {
          "jp": "他人の仕事を手伝うどころではありません。自分の仕事も間に合わないんです。",
          "romaji": "tanin no shigoto o tetsudau dokoro dewa arimasen. jibun no shigoto mo mani awanain desu.",
          "en": "There is no time to be helping other people with their work. You'll end up being late with your own work."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%93%e3%82%8d%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84-dokoro-dewa-nai-meaning/"
    },
    {
      "grammar": "どころか",
      "meaning": "far from; anything but; let alone; not to mention; much less ~",
      "structure": "Verb (casual, non-past) どころか Noun な-adjective + (な) い-adjective → どころか Noun な-adjective + (な) い-adjective → Noun な-adjective + (な) い-adjective → な-adjective + (な) い-adjective → い-adjective | Noun な-adjective + (な) い-adjective → な-adjective + (な) い-adjective → い-adjective | な-adjective + (な) い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "もっと勉強しないと、N2どころかN3も無理だ。",
          "romaji": "motto benkyou shinaito, N2 dokoro ka N3 mo muri da.",
          "en": "If you do not study more, you will not be able to pass N2, let alone N3."
        },
        {
          "jp": "そんな食べ物、健康になるどころか、病気になっちゃうよ。",
          "romaji": "sonna tabemono, kenkou ni naru dokoro ka, byouki ni nacchau yo.",
          "en": "That food isn't going to make you healthy, on the contrary it will make you sick."
        },
        {
          "jp": "「夏休みは取れそう？」「忙しくて夏休みどころか日曜日も休めない。」",
          "romaji": "「natsu yasumi wa toresou？」「isogashikute natsu yasumi dokoro ka nichiyoubi mo yasumeni.」",
          "en": "\"Does it look like you can take summer break off?\"\"I'm so busy I won't be able to take a summer break, much less even a Sunday off.\""
        },
        {
          "jp": "医者に出された薬を飲んでいるのに、よくなるどころか、症状はひどくなる一方だよ。",
          "romaji": "isha ni dasareta kusuri o nondeiru noni, yoku naru dokoro ka, shoujou ga hidoku naru ippou da yo.",
          "en": "Even though I'm taking the medicine my doctor gave me, I am not getting better. On the contrary, my symptoms keep getting worse."
        },
        {
          "jp": "私は彼に役に立つどころか、迷惑もかけた。",
          "romaji": "watashi wa kare ni yaku ni tatsu dokoro ka, meiwaku mo kaketa.",
          "en": "I was far from being of any help to him. Rather I got in his way."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%93%e3%82%8d%e3%81%8b-dokoro-ka-meaning/"
    },
    {
      "grammar": "どうやら",
      "meaning": "possibly; apparently; seems like; somehow; barely ~",
      "structure": "どうやら phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "どうやら明日は雨になりそうだ。",
          "romaji": "dou yara ashita wa ame ni nari sou da.",
          "en": "Apparently, it's going to rain tomorrow."
        },
        {
          "jp": "どうやら、彼は知らないらしい。",
          "romaji": "dou yara, kare wa shiranai rashii.",
          "en": "It seems he doesn’t know."
        },
        {
          "jp": "どうやら誤解があるようだ。",
          "romaji": "dou yara gokai ga aru you da.",
          "en": "There appears to be a misunderstanding."
        },
        {
          "jp": "今晩はどうやら雪が降りそうだ。",
          "romaji": "konban wa dou yara yuki ga furi sou da.",
          "en": "Apparently, it is going to snow tonight."
        },
        {
          "jp": "どうやら日本の生活になれてきた。",
          "romaji": "dou yara nihon no seikatsu ni narete kita.",
          "en": "Somehow, I finally started getting used to life in Japan."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%82%84%e3%82%89-dou-yara-meaning/"
    },
    {
      "grammar": "どうせ",
      "meaning": "anyhow; in any case; at any rate; after all; no matter what",
      "structure": "どうせ phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "どうせやるなら上手にやれ。",
          "romaji": "douse yaru nara jouzu ni yare.",
          "en": "If you're going to do it no matter what, do it well!"
        },
        {
          "jp": "どうせ行くんでしょ。",
          "romaji": "douse iku n desho.",
          "en": "I daresay you are going to go no matter what."
        },
        {
          "jp": "どうせ参加しないのなら、早めに伝えたほうがいい。",
          "romaji": "douse sanka shinai no nara, hayame ni tsutaeta houga ii.",
          "en": "If you're not going to participate after all, it's best to say so as quick as possible."
        },
        {
          "jp": "どうせ、試合の前にまだ一週間があるのでもっと練習しょう。",
          "romaji": "douse, shiai no mae ni mada isshukan ga aru node motto renshuu shiyou.",
          "en": "Anyway, we still have a week to go before the game so let's practice some more."
        },
        {
          "jp": "今から行ってもどうせ遅刻だから、行かないことにする。",
          "romaji": "ima kara itte mo douse chikoku dakara, ikanai koto ni suru.",
          "en": "Even if I go now I will be late anyway, so I decided not to go."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%81%9b-douse-meaning/"
    },
    {
      "grammar": "得ない",
      "meaning": "unable to; cannot; it is not possible to ~",
      "structure": "Verb ます (stem form) 得ない → 得ない",
      "explanation": "",
      "examples": [
        {
          "jp": "あの人が結婚したって本当！？え～！あり得ないよ！",
          "romaji": "ano hito ga kekkon shitatte hontou! ? e~! ari enai yo!",
          "en": "Is it true that he got married? No way! It's not possible!"
        },
        {
          "jp": "あの真面目な彼が犯人？そんなことはあり得ない。",
          "romaji": "ano majime na kare ga hannin? sonna koto wa ari enai.",
          "en": "You think someone as earnest as him is the culprit? That's unbelievable.."
        },
        {
          "jp": "地震がいつ来るかなんて、予測し得ないことだ。",
          "romaji": "jishin ga itsu kuru ka nante, yosoku shi enai kotoda.",
          "en": "It is unpredictable when an earthquake will occur."
        },
        {
          "jp": "無から有は生じ得ない。",
          "romaji": "mu kara yuu wa shouji enai.",
          "en": "Nothing can come of nothing."
        },
        {
          "jp": "機械は完全には人力に代わり得ない。",
          "romaji": "kikai wa kanzen ni wa jinriki ni kawari enai.",
          "en": "Machinery cannot completely take the place of human labor."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%be%97%e3%81%aa%e3%81%84-%e3%81%88%e3%81%aa%e3%81%84-enai-meaning/"
    },
    {
      "grammar": "得ない",
      "meaning": "unable to; cannot; it is not possible to ~",
      "structure": "Verb ます (stem form) 得ない → 得ない",
      "explanation": "",
      "examples": [
        {
          "jp": "あの人が結婚したって本当！？え～！あり得ないよ！",
          "romaji": "ano hito ga kekkon shitatte hontou! ? e~! ari enai yo!",
          "en": "Is it true that he got married? No way! It's not possible!"
        },
        {
          "jp": "あの真面目な彼が犯人？そんなことはあり得ない。",
          "romaji": "ano majime na kare ga hannin? sonna koto wa ari enai.",
          "en": "You think someone as earnest as him is the culprit? That's unbelievable.."
        },
        {
          "jp": "地震がいつ来るかなんて、予測し得ないことだ。",
          "romaji": "jishin ga itsu kuru ka nante, yosoku shi enai kotoda.",
          "en": "It is unpredictable when an earthquake will occur."
        },
        {
          "jp": "無から有は生じ得ない。",
          "romaji": "mu kara yuu wa shouji enai.",
          "en": "Nothing can come of nothing."
        },
        {
          "jp": "機械は完全には人力に代わり得ない。",
          "romaji": "kikai wa kanzen ni wa jinriki ni kawari enai.",
          "en": "Machinery cannot completely take the place of human labor."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%be%97%e3%81%aa%e3%81%84-%e3%81%88%e3%81%aa%e3%81%84-enai-meaning/"
    },
    {
      "grammar": "得る",
      "meaning": "can; to be able to; is possible to ~",
      "structure": "Verb ます (stem form) 得る (える/うる) → 得る (える/うる)",
      "explanation": "",
      "examples": [
        {
          "jp": "君の話を信じるよ。だってこの世界ではどんなことでも起こり得るから。",
          "romaji": "kimi no hanashi o shinjiru yo. datte kono sekaide wa donna koto demo okori eru kara.",
          "en": "I believe in your story. I mean, anything is possible in this world."
        },
        {
          "jp": "事故はいつでも起こり得るので、気をつけてください。",
          "romaji": "jiko wa itsu demo okori eru node, ki o tsukete kudasai.",
          "en": "Accidents can happen at any time, so please be careful!"
        },
        {
          "jp": "タバコを吸いすぎや、お酒を飲み過ぎは病気の原因になり得ます。",
          "romaji": "tabako o sui sugi ya, o sake o nomi sugi wa byouki no genin ni nari emasu.",
          "en": "Excessive smoking and drinking too much alcohol can cause illness."
        },
        {
          "jp": "運動不足は病気の原因になり得るので、できるだけ体を動かすようにしてください。",
          "romaji": "undou fusoku wa byouki no genin ni nari eru node, dekiru dake karada o ugokasu youni shite kudasai.",
          "en": "Lack of exercise can cause illness, so try to move as much as you can."
        },
        {
          "jp": "この不況では大手企業の倒産もあり得る。",
          "romaji": "kono fukyou dewa ootekigyou no tousan mo ariuru.",
          "en": "In this recession, it's possible some major companies may go bankrupt."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%be%97%e3%82%8b-%e3%81%88%e3%82%8b-%e3%81%86%e3%82%8b-eru-uru-meaning/"
    },
    {
      "grammar": "再び",
      "meaning": "again; once more",
      "structure": "再び ふたたび phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "来週の月曜日からレッスンを再び開始したいですか？",
          "romaji": "raishuu no getsuyoubi kara ressun o futatabi kaishi shitai desu ka?",
          "en": "Would you like to restart your lessons from next Monday?"
        },
        {
          "jp": "今年の旅行は楽しかった。来年の冬再びここに来たい。",
          "romaji": "kotoshi no ryokou wa tanoshikatta. rainen no fuyu futatabi koko ni kitai.",
          "en": "This year's trip was fun. I want to come here again next winter."
        },
        {
          "jp": "10年後にようやく彼は、再び故郷の町を見た。",
          "romaji": "10 nengo ni youyaku kare wa, futatabi kokyou no machi o mita.",
          "en": "He finally saw his hometown again after ten years."
        },
        {
          "jp": "昨日私は、図書館で１ヶ月前に出会った少女と再び会った。",
          "romaji": "kinou watashi wa, toshokan de ikkagetsu mae ni deatta shoujo to futatabi atta.",
          "en": "Yesterday I once again met the girl whom I met in the library a month ago."
        },
        {
          "jp": "本当に最悪の男だ。二度と再びあの男とは会いたくない。",
          "romaji": "hontou ni saiaku no otoko da. nido to futatabi ano otoko to wa aitakunai.",
          "en": "He really is the worst guy... I don't ever want to see him again."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%86%8d%e3%81%b3-%e3%81%b5%e3%81%9f%e3%81%9f%e3%81%b3-futatabi-meaning/"
    },
    {
      "grammar": "ふうに",
      "meaning": "this way; that way; in such a way; how",
      "structure": "どんな あんな こんな どういう ふうに + Verb Verb (casual) → ふうに + Verb Verb (casual) → Verb (casual) | Verb (casual)",
      "explanation": "",
      "examples": [
        {
          "jp": "こんなふうにやりなさい。",
          "romaji": "konna fuu ni yarinasai.",
          "en": "Please do it like this."
        },
        {
          "jp": "私もあんなふうになりたいです。",
          "romaji": "watashi mo anna fuu ni naritai desu.",
          "en": "I also want to become that way."
        },
        {
          "jp": "どういうふうに動くか見せてください。",
          "romaji": "douiu fuu ni ugoku ka misete kudasai.",
          "en": "Please show me how it works."
        },
        {
          "jp": "すみません、これはどんなふうにやればよいでしょうか。",
          "romaji": "sumimasen, kore wa donna fuu ni yareba yoi deshou ka?",
          "en": "Excuse me, what is the correct way to do this?"
        },
        {
          "jp": "勝手にそんなふうにしないでください。教えたどおりにやればいいです。",
          "romaji": "katte ni sonna fuu ni shinai de kudasai. oshieta doori ni yareba ii desu.",
          "en": "Please don't do it your own way. Do it as you were taught to."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b5%e3%81%86%e3%81%ab-fuu-ni-meaning/"
    },
    {
      "grammar": "がきっかけで / をきっかけに",
      "meaning": "with… as a start; as a result of; taking advantage of ~",
      "structure": "Verb (た form) + の/こと がきっかけで をきっかけに Noun → がきっかけで をきっかけに Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女は病気をきっかけにそのつまらない仕事を辞めた。",
          "romaji": "kanojo wa byouki o kikkake ni sono tsumaranai shigoto o yameta.",
          "en": "She used her illness to quit that boring job."
        },
        {
          "jp": "昨年の事故をきっかけとして、安全対策が強化された。",
          "romaji": "sakunen no jiko o kikkake toshite, anzentaisaku ga kyouka sareta.",
          "en": "As a result of last year's accident, safety measures have been strengthened."
        },
        {
          "jp": "子供が生まれたのをきっかけとして、タバコを辞めた。",
          "romaji": "kodomo ga umareta no o kikkake to shite, tabako o yameta.",
          "en": "As a result of my child being born, I quit smoking."
        },
        {
          "jp": "パソコンを買ってもらったことがきっかけで、プログラミングの勉強を始めました。",
          "romaji": "pasokon o katte moratta koto ga kikkake de, puroguramingu no benkyou o hajime mashita.",
          "en": "Taking advantage of the computer I received, I began studying programming."
        },
        {
          "jp": "失恋をきっかけに、海外に出て仕事をしようと決心した。",
          "romaji": "shitsuren o kikkake ni, kaigai ni dete shigoto o shiyou to kesshin shita.",
          "en": "After experiencing heartbreak, I decided to move and work abroad."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%8d%e3%81%a3%e3%81%8b%e3%81%91%e3%81%a7-ga-kikkake-de-%e3%82%92%e3%81%8d%e3%81%a3%e3%81%8b%e3%81%91%e3%81%ab-o-kikkake-ni-meaning/"
    },
    {
      "grammar": "げ",
      "meaning": "looks like; seems like; appears to ~",
      "structure": "な-adjective な げ い-adjective + い Irregular: いい/よい => よさ Verb ます (stem form) Verb た い (tai form) Noun (very limited) → げ い-adjective + い Irregular: いい/よい => よさ Verb ます (stem form) Verb た い (tai form) Noun (very limited) → い-adjective + い Irregular: いい/よい => よさ Verb ます (stem form) Verb た い (tai form) Noun (very limited) → Verb ます (stem form) Verb た い (tai form) Noun (very limited) → Verb た い (tai form) Noun (very limited) → Noun (very limited) | い-adjective + い Irregular: いい/よい => よさ Verb ます (stem form) Verb た い (tai form) Noun (very limited) → Verb ます (stem form) Verb た い (tai form) Noun (very limited) → Verb た い (tai form) Noun (very limited) → Noun (very limited) | Verb ます (stem form) Verb た い (tai form) Noun (very limited) → Verb た い (tai form) Noun (very limited) → Noun (very limited) | Verb た い (tai form) Noun (very limited) → Noun (very limited) | Noun (very limited)",
      "explanation": "",
      "examples": [
        {
          "jp": "何か、言いたげだね。",
          "romaji": "nanika, iita ge da ne.",
          "en": "They look like they want to say something."
        },
        {
          "jp": "あの人は寂しげな目をしている。",
          "romaji": "ano hito wa sabishige na me o shiteiru.",
          "en": "That person has a lonely look in their eyes"
        },
        {
          "jp": "彼は眠たげな声でおはようと言った。",
          "romaji": "kare wa nemuta ge na koe de ohayou to itta.",
          "en": "He said good morning with a sleepy voice."
        },
        {
          "jp": "ずいぶん、自信ありげだね。",
          "romaji": "zuibun, jishin ari ge da ne.",
          "en": "You seem very confident."
        },
        {
          "jp": "一人暮らしのために家を出る日、母は少し寂しげだった。",
          "romaji": "hitori gurashi no tame ni ie o deru hi, haha wa sukoshi sabishi ge datta.",
          "en": "My mother looked a little sad on the day I moved out to live by myself."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%92-ge-meaning/"
    },
    {
      "grammar": "逆に",
      "meaning": "conversely; on the contrary ~",
      "structure": "逆に phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "娘はスポーツが好きだが、逆に息子はスポーツが嫌いだ。",
          "romaji": "musume wa supootsu ga suki da ga, gyaku ni musuko wa supootsu ga kirai da.",
          "en": "My daughter likes sports, but on the other hand my son hates them."
        },
        {
          "jp": "天気予報と逆に、雨が降り続いている。",
          "romaji": "tenki yohou to gyaku ni, ame ga furitsuzuite iru.",
          "en": "It’s been raining nonstop in contrast to the weather forecast."
        },
        {
          "jp": "彼はゲームが大好きだが、逆に弟さんは嫌いだ。",
          "romaji": "kare wa geemu ga daisuki daga, gyaku ni otouto san wa kirai da.",
          "en": "He loves to play games, but contrarily his younger brother dislikes them."
        },
        {
          "jp": "逆に、嫌いな日本の料理はなんですか？",
          "romaji": "gyaku ni, kirai na nihon no ryouri wa nan desu ka?",
          "en": "On the other hand, what is a Japanese food that you hate?"
        },
        {
          "jp": "私達の期待とは逆に、今年の売り上げは増えなかった。",
          "romaji": "watashitachi no kitai to wa gyaku ni, kotoshi no uriage wa fuenakatta.",
          "en": "Contrary to our expectations, sales did not increase this year."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e9%80%86%e3%81%ab-gyaku-ni-meaning/"
    },
    {
      "grammar": "反面",
      "meaning": "while, although; on the other hand~",
      "structure": "Verb (casual, non-past) 反面 Noun + である な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → 反面 Noun + である な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → Noun + である な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → い-adjective Phrase 1 + その反面 + Phrase 2 → Phrase 1 + その反面 + Phrase 2 | Noun + である な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → い-adjective Phrase 1 + その反面 + Phrase 2 → Phrase 1 + その反面 + Phrase 2 | な-adjective + な/である い-adjective Phrase 1 + その反面 + Phrase 2 → い-adjective Phrase 1 + その反面 + Phrase 2 → Phrase 1 + その反面 + Phrase 2 | い-adjective Phrase 1 + その反面 + Phrase 2 → Phrase 1 + その反面 + Phrase 2 | Phrase 1 + その反面 + Phrase 2",
      "explanation": "",
      "examples": [
        {
          "jp": "この部屋は日当たりがいい反面、夏はかなり暑いです。",
          "romaji": "kono heya wa hiatari ga ii hanmen, natsu wa kanari atsui desu.",
          "en": "This room has great light exposure, but on the other hand it is very hot in the summer."
        },
        {
          "jp": "子供の成長は嬉しい反面、どこか寂しい。",
          "romaji": "kodomo no seichou wa ureshii hanmen, dokoka sabishii.",
          "en": "I'm happy to see my children grow, but on the other hand I am a little bit sad."
        },
        {
          "jp": "彼氏ができたら、楽しい反面、一人の時間がすくなくなりました。",
          "romaji": "kareshi ga dekitara, tanoshii hanmen, hitori no jikan ga sukunaku narimashita.",
          "en": "I'm happy to have a boyfriend, but on the other hand my time for myself has considerably dropped."
        },
        {
          "jp": "一人暮らしは楽しい反面、一緒に話す相手がいないので寂しいこともあります。",
          "romaji": "hitori gurashi wa tanoshii hanmen, issho ni hanasu aite ga inai node sabishii koto mo arimasu.",
          "en": "Living alone is enjoyable, but on the other hand it can sometimes be a little lonely not having someone to talk to."
        },
        {
          "jp": "子供にとって、インターネットは便利な反面、悪い影響を与えることもあります。",
          "romaji": "kodomo ni totte, intaanetto wa benri na hanmen, warui eikyou o ataeru koto mo arimasu.",
          "en": "For children, on one hand the inernet is very convenient, but there are also some negative effects as well."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%8f%8d%e9%9d%a2-%e3%81%af%e3%82%93%e3%82%81%e3%82%93-hanmen-meaning/"
    },
    {
      "grammar": "果たして",
      "meaning": "as was expected; sure enough; really; actually ~",
      "structure": "果たして phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "果たしてそうだろうか。",
          "romaji": "hatashite sou darou ka.",
          "en": "Can it really be so?"
        },
        {
          "jp": "果たして本当に足音が聞こえたのかどうかはわからない。",
          "romaji": "hatashite hontou ni ashioto ga kikoeta no ka dou ka wa wakaranai.",
          "en": "I don’t know for sure if I really heard the footsteps or not."
        },
        {
          "jp": "そのうわさは果たして本当だろうか。",
          "romaji": "sono uwasa wa hatashite hontou darou ka.",
          "en": "Can that rumor really be true?"
        },
        {
          "jp": "私があの店にいるとき、彼らがそこにやってきたのは果たして偶然だろうか？",
          "romaji": "watashi ga ano mise ni iru toki, karera ga soko ni yatte kita no wa hatashite guuzen darou ka.",
          "en": "Was it really a coincidence that they came to the store while I was there?"
        },
        {
          "jp": "この程度の金額で、果たして彼が承知するだろうか。",
          "romaji": "kono teido no kingaku de, hatashite kare ga shouchi suru darou ka.",
          "en": "Surely he will agree to this amount of money."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%9e%9c%e3%81%9f%e3%81%97%e3%81%a6-%e3%81%af%e3%81%9f%e3%81%97%e3%81%a6-hatashite-meaning/"
    },
    {
      "grammar": "一応",
      "meaning": "more or less; pretty much; roughly; tentatively ~",
      "structure": "一応 phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "一応やりました。",
          "romaji": "ichiou yarimashita.",
          "en": "I did it (but it may still need some work)."
        },
        {
          "jp": "一応やってみます。",
          "romaji": "ichiou yatte miru.",
          "en": "(I may not be able to do it well, but) I will give it a shot."
        },
        {
          "jp": "一応、付き合っている人がいるんだ。",
          "romaji": "ichiou, tsukiatteiru hito ga iru nda.",
          "en": "I am sort of seeing someone.."
        },
        {
          "jp": "彼はもう寝たかもしれないけど、一応電話してみようかな。",
          "romaji": "kare wa mou neta kamoshirenai kedo, ichiou denwa shite miyou kana.",
          "en": "He may already be asleep, but I guess I should try to give him a call.."
        },
        {
          "jp": "一応、明日までに返事をくれる？",
          "romaji": "ichiou, ashita made ni henji o kureru.",
          "en": "Can you at least give me an answer by tomorrow?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e5%bf%9c-ichiou-meaning/"
    },
    {
      "grammar": "以外",
      "meaning": "with the exception of; excepting ~",
      "structure": "Noun 以外 + (の、は、に） → 以外 + (の、は、に）",
      "explanation": "",
      "examples": [
        {
          "jp": "食事以外には何ができる？",
          "romaji": "shokuji igai ni wa nani ga dekiru?",
          "en": "Apart from eating, what else can we do?"
        },
        {
          "jp": "彼女以外誰もいない。",
          "romaji": "kanojo igai dare mo inai.",
          "en": "There's no one else but her."
        },
        {
          "jp": "水以外何も見えない。",
          "romaji": "mizu igai nanimo mienai.",
          "en": "I don't see anything other than water."
        },
        {
          "jp": "彼は英語以外の言語は全く知らない。",
          "romaji": "kare wa eigo igai no gengo wa mattaku shiranai.",
          "en": "He knows no languages other than English."
        },
        {
          "jp": "私は彼女以外はみんな好きだ。",
          "romaji": "watashi wa kanojo igai wa minna suki da.",
          "en": "I like everyone aside from her."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%bb%a5%e5%a4%96%e3%81%ae-igai-no-meaning/"
    },
    {
      "grammar": "以上に",
      "meaning": "more than; not less than; beyond ~",
      "structure": "Verb (casual) 以上に Noun な-adjective 以上の Noun → 以上に Noun な-adjective 以上の Noun → Noun な-adjective 以上の Noun → な-adjective 以上の Noun → 以上の Noun → Noun | Noun な-adjective 以上の Noun → な-adjective 以上の Noun → 以上の Noun → Noun | な-adjective 以上の Noun → 以上の Noun → Noun | 以上の Noun → Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "今まで以上に仕事を頑張ります。",
          "romaji": "ima made ijou ni shigoto o ganbarimasu.",
          "en": "I will work even harder at work than I have until now."
        },
        {
          "jp": "必要以上にたくさんのお金を使わないでください。",
          "romaji": "hitsuyou ijou ni takusan no okane o tsukawanaide kudasai.",
          "en": "Please don’t use more money than you need."
        },
        {
          "jp": "私が予想していた以上に彼の様態はよくなかった。",
          "romaji": "watashi wa yosou shite ita ijou ni kare no youtai wa yokunakatta.",
          "en": "His condition was worse than I had expected."
        },
        {
          "jp": "今以上に日本語ができるようになりたいです。",
          "romaji": "ima ijou ni nihongo ga dekiru youni naritai desu.",
          "en": "I want to get even better at Japanese than I am now."
        },
        {
          "jp": "私たちが泊まったホテルは、予想以上に豪華だった。",
          "romaji": "watashi tachi ga tomatta hoteru wa, yosou ijou ni gouka datta.",
          "en": "The hotel that we stayed in was even more extravagant than we had imagined."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%bb%a5%e4%b8%8a%e3%81%ab-%e3%81%84%e3%81%98%e3%82%87%e3%81%86%e3%81%ab-ijou-ni-meaning/"
    },
    {
      "grammar": "以上は",
      "meaning": "because; since; seeing that ~",
      "structure": "Verb (casual) 以上（は） Noun + である な-adjective + である → 以上（は） Noun + である な-adjective + である → Noun + である な-adjective + である → な-adjective + である | Noun + である な-adjective + である → な-adjective + である | な-adjective + である",
      "explanation": "",
      "examples": [
        {
          "jp": "約束した以上、きちんと守ってくださいね。",
          "romaji": "yakusoku shita ijou, kichinto mamotte kudasai ne.",
          "en": "You've made a promise, so be sure to keep it!"
        },
        {
          "jp": "学生である以上、アルバイトではなく勉強が大事ですよ。",
          "romaji": "gakusei de aru ijou, arubaito dewa naku benkyou ga daiji desu yo.",
          "en": "Because you are a student, your studies are more important than your part-time job."
        },
        {
          "jp": "給料がこんなに安い以上は、転職を考える人がいるのも当然だ。",
          "romaji": "kyuuryou ga konna ni yasui ijou wa, tenshoku o kangaeru hito ga iru no mo touzen da.",
          "en": "With such low salaries, it's no wonder there are people who want to change jobs."
        },
        {
          "jp": "お金を払って勉強する以上は、しっかり身につけたい。",
          "romaji": "okane o haratte benkyou suru ijou wa, shikkari mi ni tsuketai.",
          "en": "Since I am paying money to study, I really want to learn."
        },
        {
          "jp": "一度やると決めた以上は、最後まで責任を持ってやらないと。",
          "romaji": "ichido yaru to kimeta ijou wa, saigo made sekinin o motte yaranai to.",
          "en": "Once you decide to do something, you must stay responsible until the end."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%bb%a5%e4%b8%8a%e3%81%af-ijou-wa-meaning/"
    },
    {
      "grammar": "いきなり",
      "meaning": "abruptly; suddenly; all of a sudden; without warning",
      "structure": "いきなり action → action",
      "explanation": "",
      "examples": [
        {
          "jp": "いきなり男の人に道を聞かれた。",
          "romaji": "ikinari otoko no hito ni michi o kikareta.",
          "en": "A man suddenly asked me for directions."
        },
        {
          "jp": "いきなりあなたにメールを送ってしまい申し訳ありません。",
          "romaji": "ikinari anata ni meeru o okutte shimai moushiwake arimasen.",
          "en": "I'm sorry for sending you an email suddenly."
        },
        {
          "jp": "彼は彼女の手からいきなりハンドバッグを取った。",
          "romaji": "kare wa kanojo no te kara ikinari hando baggu o totta.",
          "en": "He suddenly grabbed her purse from her hand."
        },
        {
          "jp": "彼女の兄弟は、いきなり結婚式に現れた。",
          "romaji": "kanojo no kyoudai wa, ikinari kekkonshiki ni arawareta.",
          "en": "Her siblings showed up at the wedding out of the blue."
        },
        {
          "jp": "今日は会社に来るとき、私の前でタクシーがいきなり止まってびっくりした。",
          "romaji": "kyou wa kaisha ni kuru toki, watashi no mae de takushii ga ikinari tomatte bikkuri shita.",
          "en": "Today on my way to work, I was surprised by a taxi suddenly stopping right in front of me."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%8d%e3%81%aa%e3%82%8a-ikinari-meaning/"
    },
    {
      "grammar": "一気に",
      "meaning": "in one go; without stopping; all at once; immediately; instantly; right away ~",
      "structure": "一気に phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "お茶を一気に飲みました。",
          "romaji": "ocha o ikki ni nomimashita.",
          "en": "I drank all of the tea at once."
        },
        {
          "jp": "私はこの本を一気に読みました。",
          "romaji": "watashi wa kono hon o ikki ni yomimashita.",
          "en": "I read this book all in one go."
        },
        {
          "jp": "彼は一気に１０時間働いた。",
          "romaji": "kare wa ikki ni juu jikan hataraita.",
          "en": "He worked for 10 hours without stopping."
        },
        {
          "jp": "こういう仕事は一気にやった方がいいんだよ。",
          "romaji": "kouiu shigoto wa ikki ni yatta hou ga ii nda yo.",
          "en": "This kind of work is best done all at once."
        },
        {
          "jp": "買ってきたお菓子は一気に食べないで、少しずつ食べましょうね。",
          "romaji": "katte kita okashi wa ikki ni tabenaide, sukoshi zutsu tabemashou ne.",
          "en": "Don't eat all of the sweets you bought in one go, let's take our time eating them."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e6%b0%97%e3%81%ab-%e3%81%84%e3%81%a3%e3%81%8d%e3%81%ab-ikki-ni-meaning/"
    },
    {
      "grammar": "一方で",
      "meaning": "on one hand, on the other hand; although ~",
      "structure": "Verb (casual) 一方（で） Noun + である な-adjective + である い-adjective → 一方（で） Noun + である な-adjective + である い-adjective → Noun + である な-adjective + である い-adjective → な-adjective + である い-adjective → い-adjective | Noun + である な-adjective + である い-adjective → な-adjective + である い-adjective → い-adjective | な-adjective + である い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "お母さんは優しい一方で、お父さんはこわい。",
          "romaji": "okaasan wa yasashii ippou de, otousan wa kowai.",
          "en": "My mother is kind, but on the other hand my father is scary."
        },
        {
          "jp": "父は自分に厳しい一方で、他人には優しい。",
          "romaji": "chichi wa jibun ni kibishii ippou de, ta’nin niwa yasashii.",
          "en": "My father is very strict with himself but very kind to others."
        },
        {
          "jp": "彼女の仕事は夏は非常に忙しい一方、冬は暇になる。",
          "romaji": "kanojo no shigoto wa natsu wa hijou ni isogashii ippou, fuyu wa hima ni naru.",
          "en": "Her work is very busy in the summer, but on the other hand it is much more relaxed in the winter."
        },
        {
          "jp": "彼は俳優である一方で、歌手としても活躍している。",
          "romaji": "kare wa haiyuu dearu ippou de, kashu toshite mo katsuyaku shite iru.",
          "en": "He is an actor, and on the other hand is active as a singer."
        },
        {
          "jp": "海外旅行は非日常を体験できることから、楽しいと感じることが多い一方で、不安なこともある。",
          "romaji": "kaigai ryokou wa hinichijou o taiken dekiru koto kara, tanoshii to kanjiru koto ga ooi ippou de, fuan na koto mo aru.",
          "en": "Traveling abroad can be extraordinary, so it's often fun, but on the other hand can be uneasy."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%80%e6%96%b9%e3%81%a7-ippou-de-meaning/"
    },
    {
      "grammar": "いわゆる",
      "meaning": "what is called; as it is called; the so-called; so to speak​",
      "structure": "いわゆる Noun → Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "彼はいわゆる語学の天才だ。",
          "romaji": "kare wa iwayuru gogaku no tensai da.",
          "en": "He is what is called a genius in language."
        },
        {
          "jp": "彼女はいわゆる本の虫です。",
          "romaji": "kanojo wa iwayuru hon no mushi desu.",
          "en": "She is what we call a bookworm."
        },
        {
          "jp": "彼女はいわゆる「やり手」だ。",
          "romaji": "kanojo wa iwayuru 「yarite」da.",
          "en": "She is what we call a“go‐getter.\""
        },
        {
          "jp": "彼は何でも知っているから、いわゆる生きる辞書だ。",
          "romaji": "kare wa nan demo shitte iru kara, iwayuru ikiru jisho da.",
          "en": "He knows everything, like a living dictionary."
        },
        {
          "jp": "彼女の考えは、いわゆる進歩的なものでした。",
          "romaji": "kanojo no kangae wa, iwayuru shinpoteki na mono deshita.",
          "en": "Her ideas were progressive, so to speak."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%82%8f%e3%82%86%e3%82%8b-iwayuru-meaning/"
    },
    {
      "grammar": "いよいよ",
      "meaning": "at last; finally; beyond doubt",
      "structure": "いよいよ phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "いよいよ大学の生活が始まります。初めて親に離れるからちょっと心配する。",
          "romaji": "iyoiyo daigaku no seikatsu ga hajimarimasu. hajimete oya ni hanareru kara chotto shinpai suru.",
          "en": "My university life has finally begun. Though it is my first time to be away from my parents so I am a little nervous."
        },
        {
          "jp": "いよいよ来週の日曜日が母の日だ。母に何を買って上げたほうがいいかな。",
          "romaji": "iyoiyo raishuu no nichiyoubi ga haha no hi da. haha ni nani o katte ageta hou ga ii kana.",
          "en": "Mother's day is finally coming up next Sunday. I wonder what should I get for my mom..?"
        },
        {
          "jp": "いよいよスピーチが始まる。どうしよう！めちゃ緊張しているよ。",
          "romaji": "iyoiyo supiichi ga hajimaru. dou shiyou! mecha kinchou shiteiru yo.",
          "en": "The speech is about to start! I'm very nervous!"
        },
        {
          "jp": "いよいよ彼女の出番だ。頑張って練習したからうまく行けるといいね！",
          "romaji": "iyoiyo kanojo no deban da. ganbatte renshuu shita karaumaku ikeru to ii ne!",
          "en": "Finally it's time for her entrance! She worked hard with her practice, so I hope it goes well!"
        },
        {
          "jp": "いよいよ結婚式が目前に迫ってなんとなく落ち着かない。",
          "romaji": "iyoiyo kekkonshiki ga mokuzen ni sematte nantonaku ochitsukanai.",
          "en": "Now that our wedding ceremony is just around the corner, we can't seem to calm down."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%82%88%e3%81%84%e3%82%88-iyoiyo-meaning/"
    },
    {
      "grammar": "上",
      "meaning": "for the sake of; from the standpoint of; as a matter of; in terms of ~",
      "structure": "Noun 上 → 上",
      "explanation": "",
      "examples": [
        {
          "jp": "健康上ではポテトフライや揚げ物などは食べない方がいいと思います。",
          "romaji": "kenkou jou de wa poteto furai ya agemono nado wa tabenai hou ga ii to omoi masu.",
          "en": "For the sake of one's health, I think it's best to not eat french fries or other fried foods."
        },
        {
          "jp": "日本の法律上はお酒を飲んで車を運転するのは禁止です。",
          "romaji": "nihon no houritsu jou wa osake o nonde kuruma o unten suru no wa kinshi desu.",
          "en": "In terms of Japanese law, it is illegal to drink and drive."
        },
        {
          "jp": "理論上はこれが可能だが、実用化には時間がかかりそうだ。",
          "romaji": "riron jou wa kore ga kanou da ga, jitsuyouka ni wa jikan ga kakari sou da.",
          "en": "In theory this is possible, but to actually implement it looks like it will take some time."
        },
        {
          "jp": "彼女は健康上の理由で仕事を辞めたそうです。",
          "romaji": "kanojo wakenkou jou no riyuu de shigoto o yameta sou desu.",
          "en": "She apparently quit her job for the sake of her health."
        },
        {
          "jp": "会社の規則上は作業中にヘルメットを必ず被ることです。",
          "romaji": "kaisha no kisoku jou wa sagyouchuu ni herumetto o kanarazu kaburu koto desu.",
          "en": "In accordance with the company rules, one must always wear their helmet during work."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e4%b8%8a-jou-meaning/"
    },
    {
      "grammar": "かのように",
      "meaning": "as if; just like ~",
      "structure": "Noun であるかのように な-adjective Verb (casual) かのように + Verb かのような + Noun かのようだ → であるかのように な-adjective Verb (casual) かのように + Verb かのような + Noun かのようだ → な-adjective Verb (casual) かのように + Verb かのような + Noun かのようだ → Verb (casual) かのように + Verb かのような + Noun かのようだ → かのように + Verb かのような + Noun かのようだ → かのような + Noun かのようだ → かのようだ | な-adjective Verb (casual) かのように + Verb かのような + Noun かのようだ → Verb (casual) かのように + Verb かのような + Noun かのようだ → かのように + Verb かのような + Noun かのようだ → かのような + Noun かのようだ → かのようだ | Verb (casual) かのように + Verb かのような + Noun かのようだ → かのように + Verb かのような + Noun かのようだ → かのような + Noun かのようだ → かのようだ | かのような + Noun かのようだ → かのようだ | かのようだ",
      "explanation": "",
      "examples": [
        {
          "jp": "怖いものを見たかのように、彼女は震えた。",
          "romaji": "kowai mono o mita ka no you ni, kanojo wa furueta.",
          "en": "She was shaking as if she saw something scary."
        },
        {
          "jp": "友達は自分が合格したかのように喜んでくれた。",
          "romaji": "tomodachi wa jibun ga goukaku shita ka no youni yorokonde kureta.",
          "en": "My friend was so happy for me as if they had passed (the test) themself."
        },
        {
          "jp": "彼は今日初めて会うのに、前に何度も会ったことがあるかのような態度で話してくる。",
          "romaji": "kare wa kyou hajimete au noni, mae ni nando mo atta koto ga aru ka no youna taido de hanashite kuru.",
          "en": "Although this is the first time I am meeting him, he spoke to me as if we had met many times before."
        },
        {
          "jp": "Instagramでたくさんの人にフォロワーされると、まるで有名人になったかのようだ。",
          "romaji": "Instagram de takusan no hito ni forowaa sareru to, marude yuumeijin ni natta ka no you da.",
          "en": "I'm followed by a lot of people on Instagram, it's almost as if I am a celebrity."
        },
        {
          "jp": "あの二人は姉妹であるかのようだが、実は親子です。",
          "romaji": "ano futari wa shimai de aru ka no you da ga, jitsu wa oyako desu.",
          "en": "Those two may seem like they are sisters, but they are actually mother and daughter."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%ae%e3%82%88%e3%81%86%e3%81%ab-ka-no-you-ni-meaning/"
    },
    {
      "grammar": "かと思ったら",
      "meaning": "just when; no sooner than ~",
      "structure": "Verb (た form) かと思ったら かと思うと かと思えば → かと思ったら かと思うと かと思えば",
      "explanation": "",
      "examples": [
        {
          "jp": "空が急に暗くなってきたかと思うと、雨が降ってきた。",
          "romaji": "sora ga kyuu ni kuraku natte kita ka to omou to, ame ga futte kita.",
          "en": "No sooner had the sky turned dark, when it started to rain."
        },
        {
          "jp": "娘が帰って来たかと思うと、すぐに家を出ていった。",
          "romaji": "musume ga kaette kita ka to omou to, sugu ni ie o deteitta.",
          "en": "Just as my daughter returned home, she was out the door again."
        },
        {
          "jp": "うちの近くの公園の花が咲いたかと思ったら、もう散ってしまった。",
          "romaji": "uchi no chikaku no kouen no hana ga saita ka to omottara, mou chitte shimatta.",
          "en": "No sooner than the flowers were starting to bloom at our nearby park, the pedals had fallen."
        },
        {
          "jp": "息子が勉強を始めたかと思ったら、リビングでドラマを見ている。",
          "romaji": "musuko ga benkyou o hajimeta ka to omottara, ribingu de dorama o mite iru.",
          "en": "No sooner than my son had started studying, he was already in the living room watching TV."
        },
        {
          "jp": "彼は食事を始めたかと思ったら寝てしまった。",
          "romaji": "kare wa shokuji o hajimeta ka to omottara nete shimatta.",
          "en": "Just when he thought he would start eating he fell asleep."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%81%a8%e6%80%9d%e3%81%a3%e3%81%9f%e3%82%89-ka-to-omottara-meaning/"
    }
  ],
  "N1": [
    {
      "grammar": "敢えて",
      "meaning": "dare to; daringly; deliberately; purposely ~",
      "structure": "あえて clause → clause",
      "explanation": "",
      "examples": [
        {
          "jp": "彼はあえて一人で行く気ですか。",
          "romaji": "kare wa aete hitori de iku kidesu ka.",
          "en": "Dare he go alone?"
        },
        {
          "jp": "私はあえて彼女に忠告した。",
          "romaji": "watashi wa aete kanojo ni chuukoku shita.",
          "en": "I ran a risk of advising her."
        },
        {
          "jp": "あえて彼の意見を支持した。",
          "romaji": "aete kare no iken o shiji shita.",
          "en": "I dared to support his opinion."
        },
        {
          "jp": "私は、あえて彼に電話をしない。",
          "romaji": "watashi wa, aete kare ni denwa o shinai.",
          "en": "I don't dare call him."
        },
        {
          "jp": "その時彼女はあえて何も言わなかった。",
          "romaji": "sono toki kanojo wa aete nanimo iwanakatta.",
          "en": "At that time, she didn't dare say anything."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%95%a2%e3%81%88%e3%81%a6-%e3%81%82%e3%81%88%e3%81%a6-aete-meaning/"
    },
    {
      "grammar": "あくまでも",
      "meaning": "to the end; persistently; absolutely; is still very ~",
      "structure": "あくまでも clause → clause",
      "explanation": "",
      "examples": [
        {
          "jp": "空はあくまでも青い。",
          "romaji": "sora wa akumade mo aoi.",
          "en": "The sky is as blue as blue can be."
        },
        {
          "jp": "私はあくまでも彼女を見つけるつもりです。",
          "romaji": "watashi wa akumademo kanojo o mitsukeru tsumori desu.",
          "en": "I will definitely find her."
        },
        {
          "jp": "このスケジュールはあくまでも予定です。",
          "romaji": "kono sukejuuru wa akumademo yotei desu.",
          "en": "This schedule is still just a plan."
        },
        {
          "jp": "我々はあくまでも戦い抜く決心をした。",
          "romaji": "wareware wa akumademo tatakai nuku kesshin o shita.",
          "en": "We have made up our minds to fight it out."
        },
        {
          "jp": "この仕事はあくまでも一時的で、永遠にここに働くつもりはない。",
          "romaji": "kono shigoto wa akumademo ichijiteki de, eien ni koko ni hataraku tsumori wa nai.",
          "en": "This job is only temporary and I'm not going to work here forever."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%8f%e3%81%be%e3%81%a7%e3%82%82-akumade-mo-meaning/"
    },
    {
      "grammar": "案の定",
      "meaning": "just as one thought; as usual; sure enough",
      "structure": "案の定 phrase → phrase",
      "explanation": "",
      "examples": [
        {
          "jp": "案の定、結果がよくないだ。",
          "romaji": "an no jou, kekka ga yokunai da.",
          "en": "As might be expected, the results are poor."
        },
        {
          "jp": "案の定、彼は第一位になった。",
          "romaji": "an no jou, kare wa daiichii ni natta.",
          "en": "As was to be expected, he took first place."
        },
        {
          "jp": "あの堤防は、案の定今回の台風で決壊してしまった。",
          "romaji": "ano teibou wa, an no jou konkai no taifuu de kekkai shite shimatta.",
          "en": "Just as we thought, that embankment collapsed because of the typhoon."
        },
        {
          "jp": "急行は案の定混んでいて席がなかった。",
          "romaji": "kyuukou wa an no jou konde ite seki ga nakatta.",
          "en": "Just as I had feared, the express train was very crowded and I couldn't get a seat."
        },
        {
          "jp": "案の定、レポートの提出の締め切りに間に合わなかった。",
          "romaji": "an no jou, repooto no teishutsu no shimekiri ni ma ni awanakatta.",
          "en": "Sure enough, I missed the deadline for submitting the report."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%a1%88%e3%81%ae%e5%ae%9a-%e3%81%82%e3%82%93%e3%81%ae%e3%81%98%e3%82%87%e3%81%86-an-no-jou-meaning/"
    },
    {
      "grammar": "あらかじめ",
      "meaning": "beforehand; in advance; previously​",
      "structure": "あらかじめ Verb → Verb",
      "explanation": "",
      "examples": [
        {
          "jp": "あらかじめ教科書を読んでください。",
          "romaji": "arakajime kyoukasho o yonde kudasai.",
          "en": "Please read the textbook in advance."
        },
        {
          "jp": "私たちはあらかじめスナックを用意しておきました。",
          "romaji": "watashi tachi wa arakajime sunakku o youi shite okimashita.",
          "en": "We have prepared snacks in advance."
        },
        {
          "jp": "僕は逃げ道をあらかじめ探しました。",
          "romaji": "boku wa nigemichi o arakajime sagashimashita.",
          "en": "I searched for an escape route in advance."
        },
        {
          "jp": "私はその資料をあらかじめ印刷して持参します。",
          "romaji": "watashi wa sono shiryou o arakajime insatsu shite jisan shimasu.",
          "en": "I will print that document beforehand and bring it with me."
        },
        {
          "jp": "私たちはそれをあらかじめ考慮しておく必要がある。",
          "romaji": "watashi tachi wa sore o arakajime kouryo shite oku hitsuyou ga aru.",
          "en": "We need to take that into account in advance."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%82%89%e3%81%8b%e3%81%98%e3%82%81-arakajime-meaning/"
    },
    {
      "grammar": "あっての",
      "meaning": "which can exist solely due to the presence of; which owes everything to",
      "structure": "Noun-1 あっての Noun-2 → あっての Noun-2 → Noun-2",
      "explanation": "お客様 あっての 仕事 okyaku sama atte no shigoto a job which relies on customers / exists only with customers okyaku sama atte no shigoto a job which relies on customers / exists only with customers",
      "examples": [
        {
          "jp": "健康な体あっての人生です。",
          "romaji": "kenkou na karada atte no jinsei desu.",
          "en": "Life is dependent on having a healthy body."
        },
        {
          "jp": "お客様あっての仕事だから、言葉遣いに気を付けてください。",
          "romaji": "okyaku sama atte no shigoto dakara, kotobadzukai ni ki o tsukete kudasai.",
          "en": "Please be careful of the language you use around our customers since they are essential for our business."
        },
        {
          "jp": "私の幸せは家族あってのものだ。みんな病気をせず元気でいてほしい。",
          "romaji": "watashi no shiawase wa kazoku atte no mono da. minna byouki o sezu genki de ite hoshii.",
          "en": "My happiness comes from my family. I wish everyone is able to live healthily without sickness."
        },
        {
          "jp": "健康あっての人生だ。不健康なものを食べないように頑張りましょう！",
          "romaji": "kenkou atte no jinsei da. fukenkou na mono o tabenai youni ganbarimashou.",
          "en": "Our health is essential for our lives. Let's do our best to avoid eating unhealthy foods."
        },
        {
          "jp": "学生あっての学校ですから、いくら設備が良くても、素晴らしい先生がいても、学生が来なければ意味がない。",
          "romaji": "gakusei atte no gakkou desu kara, ikura setsubi ga yokutemo, subarashii sensei ga itemo, gakusei ga konakereba imi ga nai.",
          "en": "The school depends on the students, so no matter how good the facilities are, even if there are wonderful teachers, it doesn't make sense if students don't come."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%82%e3%81%a3%e3%81%a6%e3%81%ae-atte-no-meaning/"
    },
    {
      "grammar": "ばこそ",
      "meaning": "only because ~",
      "structure": "Verb (ば conditional) こそ Noun + であれば な-adjective + であれば い-adjective + い ければ → こそ Noun + であれば な-adjective + であれば い-adjective + い ければ → Noun + であれば な-adjective + であれば い-adjective + い ければ → な-adjective + であれば い-adjective + い ければ → い-adjective + い ければ | Noun + であれば な-adjective + であれば い-adjective + い ければ → な-adjective + であれば い-adjective + い ければ → い-adjective + い ければ | な-adjective + であれば い-adjective + い ければ → い-adjective + い ければ | い-adjective + い ければ",
      "explanation": "",
      "examples": [
        {
          "jp": "優勝できたのは、チーム全員の協力あればこそだ。",
          "romaji": "yuushou dekita nowa chiimu zenin no kyouryoku areba koso da.",
          "en": "We could only win because of our teamwork."
        },
        {
          "jp": "家族を愛すればこそ、自分が犠牲になることなどは恐れない。",
          "romaji": "kazoku o aisureba koso, jibun ga gisei ni naru koto nado wa osorenai.",
          "en": "Because I love my family, I’m not afraid to sacrifice myself."
        },
        {
          "jp": "子供のためを思えばこそ、費用は子ども自身に用意させたのです。",
          "romaji": "kodomo no tame o omoeba koso, hiyou wa kodomo jishin ni youi saseta no desu.",
          "en": "I made my children pay for their own expenses because I think it’s good for them."
        },
        {
          "jp": "自分の努力を認めてくれる人がいればこそ、やる気も出てくるというものだ。",
          "romaji": "jibun no doryoku o mitomete kureru hito ga ireba koso, yaruki mo detekuru toiu mono da.",
          "en": "Only if there are people who acknowledge their efforts will they be motivated."
        },
        {
          "jp": "忙しければこそ、時間の使い方が上手になってくるものだ。",
          "romaji": "isogashikereba koso, jikan no tsukaikata ga jouzu ni natte kuru mono da.",
          "en": "The more busy you are, the better you will be at using your time."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%93%e3%81%9d-ba-koso-meaning/"
    },
    {
      "grammar": "ばそれまでだ / たらそれまでだ",
      "meaning": "if… then it’s over",
      "structure": "Verb (conditional) ば / たら それまでだ → それまでだ",
      "explanation": "",
      "examples": [
        {
          "jp": "いくらお金をためでも、死んでしまえばそれまでだ。",
          "romaji": "ikura okane o tame demo, shinde shimaeba sore made da.",
          "en": "Even if you make a lot of money, it's pointless if you die."
        },
        {
          "jp": "どんなに大変でも諦めたらそれまでだ。",
          "romaji": "donnani taihen demo akirametara sore made da.",
          "en": "No matter how hard it may be, once you give up, it's all over."
        },
        {
          "jp": "いくら参考書を買っても、使わなければそれまでだ。",
          "romaji": "ikura sankousho o katte mo, tsukawanakereba sore made da.",
          "en": "No matter how many reference books you buy, if you don't use them they are meaningless."
        },
        {
          "jp": "一生懸命勉強しても、試験の日に風邪を引いたらそれまでだ。",
          "romaji": "isshoukenmei benkyou shite mo, shiken no hi ni kaze o hiitara sore made da.",
          "en": "Even if you study hard, if you catch a cold on the day of the exam, then it's over."
        },
        {
          "jp": "ハードディスクに写真を保存しておいても、ハードディクスが壊れてしまえばそれまでだ。",
          "romaji": "haadodisuku ni shashin o hozon shite oite mo, haadodisuku ga kowarete shimaeba sore made da.",
          "en": "Even if you save your photos on a hard disk, they will all be gone if the hard disc breaks."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%9d%e3%82%8c%e3%81%be%e3%81%a7%e3%81%a0-%e3%81%9f%e3%82%89%e3%81%9d%e3%82%8c%e3%81%be%e3%81%a7%e3%81%a0-ba-sore-made-da-meaning/"
    },
    {
      "grammar": "べからず / べからざる",
      "meaning": "must not; should not; do not ~",
      "structure": "Verb (dictionary) べからず べからざる → べからず べからざる",
      "explanation": "",
      "examples": [
        {
          "jp": "ここに駐車するべからず。",
          "romaji": "koko ni chuusha suru bekarazu.",
          "en": "Don't park here. / No parking here."
        },
        {
          "jp": "芝生に入るべからず。",
          "romaji": "shibafu ni hairu bekarazu.",
          "en": "Stay off the grass."
        },
        {
          "jp": "ビル内でたばこを吸うべからず。",
          "romaji": "biru nai de tabako o suu bekarazu.",
          "en": "No smoking inside the building!"
        },
        {
          "jp": "この池で釣りをするべからず。",
          "romaji": "kono ike de tsuri o suru bekarazu.",
          "en": "Don't fish in this pond."
        },
        {
          "jp": "彼はわがチームには欠くべからざる選手である。",
          "romaji": "kare wa waga chiimu ni wa kaku bekarazaru senshu de aru.",
          "en": "He is an indispensable player for our team."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8b%e3%82%89%e3%81%9a-%e3%81%b9%e3%81%8b%e3%82%89%e3%81%96%e3%82%8b-bekarazu-bekarazaru-meaning/"
    },
    {
      "grammar": "べく",
      "meaning": "in order to; for the purpose of ~",
      "structure": "Verb (dictionary form) べく Exception: する するべく すべく → べく Exception: する するべく すべく → Exception: する するべく すべく → するべく すべく | Exception: する するべく すべく → するべく すべく",
      "explanation": "",
      "examples": [
        {
          "jp": "JLPT N1に合格すべく、毎日頑張って勉強しています。",
          "romaji": "JLPT N1 ni goukaku subeku, mainichi ganbatte benkyou shite imasu.",
          "en": "I am studying hard every day to pass JLPT N1."
        },
        {
          "jp": "親の期待に応えるべく、努力して医者の道に進んだ。",
          "romaji": "oya no kitai ni kotaeru beku, doryoku shite isha no michi ni susunda.",
          "en": "I made an effort to meet the expectations of my parents and went on to become a doctor."
        },
        {
          "jp": "彼は良い席を手に入れるべく、2時間も前から並んでいた。",
          "romaji": "kare wa yoi seki o te ni ireru beku, 2 jikan mo mae kara narande ita.",
          "en": "He had been in line for two hours to get a good seat."
        },
        {
          "jp": "人手不足という問題を解決すべく、社内で緊急会議が開かれた。",
          "romaji": "hitodebusoku toiu mondai o kaiketsu subeku, shanai de kinkyuu kaigi ga akareta.",
          "en": "An emergency meeting was held in-house to solve the problem of labor shortage."
        },
        {
          "jp": "彼は一日も早く借金を返すべく、必死で働いている。",
          "romaji": "kare wa ichinichi mo hayaku shakkin o kaesu beku, hisshi de hataraite iru.",
          "en": "He is working hard to pay off his debt as soon as possible."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8f-beku-meaning/"
    },
    {
      "grammar": "べくもない",
      "meaning": "cannot possibly be ~",
      "structure": "Verb (dictionary form) べくもない Exception: する するべくもない すべくもない → べくもない Exception: する するべくもない すべくもない → Exception: する するべくもない すべくもない → するべくもない すべくもない | Exception: する するべくもない すべくもない → するべくもない すべくもない",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は勉強をせずに毎日遊んでばかりいた。N１合格は望むべくもない。",
          "romaji": "kare wa benkyou o sezu ni mainichi asonde bakari ita. N1 goukaku o nozomu beku mo nai.",
          "en": "He just played every day without studying. There is no hope of passing N1."
        },
        {
          "jp": "祖父の病状は悪くなるばかりだ。回復はもう望むべくもない。",
          "romaji": "sofu no byoujou wa waruku naru bakari da. Kaifuku wa mou nozomubeku mo nai.",
          "en": "My grandfather's condition is only getting worse. There is no hope for recovery anymore."
        },
        {
          "jp": "すでに5点も差があるので、この試合に勝つのは望むべくもない。",
          "romaji": "sudeni 5 ten mo sa ga aru node, kono shiai ni katsu nowa nozomu beku mo nai.",
          "en": "There is already a difference of 5 points, so I can't hope to win this match."
        },
        {
          "jp": "東京生まれと育ちの彼には、田舎暮らしの大変さなど知るべくもない。",
          "romaji": "toukyou umare to sodachi no kare ni wa, inakakurashi no taihensa nado shirubeku mo nai.",
          "en": "Born and raised in Tokyo, he doesn't know how difficult life in the countryside is."
        },
        {
          "jp": "プロとは比べるべくもないですが、彼の歌のうまさは学校の一番だと思います。",
          "romaji": "puro to wa kuraberubeku mo nai desu ga, kare no uta no umasa wa gakkou no ichiban da to omoimasu.",
          "en": "It's hard to compare with a professional, but I think his singing is the best at school."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8f%e3%82%82%e3%81%aa%e3%81%84-beku-mo-nai-meaning/"
    },
    {
      "grammar": "べくして",
      "meaning": "as it is bound to (happen); following the natural course",
      "structure": "Verb (dictionary) べくして Verb (た form) → べくして Verb (た form) → Verb (た form)",
      "explanation": "",
      "examples": [
        {
          "jp": "あの子は何も勉強せずに、遊びばかりしているんから、大学試験に落ちるべくして落ちた。",
          "romaji": "ano ko wa nani mo benkyou se zu ni, asobi bakari shite irun kara, daigaku shiken ni ochiru beku shite ochita.",
          "en": "That kid doesn’t bother studying and spends all of his time playing. Only naturally, he failed the university entrance exam."
        },
        {
          "jp": "君はいつもこんな所に自転車を置いていたから、盗むべくして盗んだ。",
          "romaji": "kimi wa itsumo konna tokoro ni jitensha o oite ita kara, nusumu beku shite nusunda.",
          "en": "If you always leave your bike in a place like this, sooner or later it will be stolen."
        },
        {
          "jp": "今回は練習不足がたたり、負けるべくして負けたのだと思う。",
          "romaji": "konkai wa renshuu busoku ga tatari, makeru beku shite maketa noda to omou.",
          "en": "I think it's only natural we lost with our lack of practice this time."
        },
        {
          "jp": "彼とは考え方よく似ていて、私たちは出会うべくして出会ったと信じている。",
          "romaji": "kare to wa kangaekata yoku nite ite, watashitachi wa deau beku shite deatta to shinjite iru.",
          "en": "Our way of thinking is very similar and I believe we met as though we were meant to meet each other."
        },
        {
          "jp": "この機械の危険性は以前から何度も指摘されていた。この事故は起こるべくして起こったといえる。",
          "romaji": "kono kikai no kikensei wa izen kara nando mo shiteki sarete ita. ko no jiko wa okoru beku shite okotta to ieru.",
          "en": "The dangers of this machine have been pointed out many times before. It can be said that this accident was bound to happen."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b9%e3%81%8f%e3%81%97%e3%81%a6-beku-shite-meaning/"
    },
    {
      "grammar": "びる / びて / びた",
      "meaning": "to seem to be; to appear; to behave as ~",
      "structure": "Noun びる びて びた + Noun い-adjective + い → びる びて びた + Noun い-adjective + い → い-adjective + い | い-adjective + い",
      "explanation": "",
      "examples": [
        {
          "jp": "え、彼女３０歳なの？ずいぶん幼びて見えますね。",
          "romaji": "e, kanojo 30 sai nano? zuibun osana bite miemasu ne.",
          "en": "What, she is 30!? She looks very young."
        },
        {
          "jp": "彼はカバンから古びたカメラを取り出した。",
          "romaji": "kare wa kaban kara furu bita kamera o toridashita.",
          "en": "He took an ancient‐looking camera out of his bag."
        },
        {
          "jp": "姪っ子はまだ13歳だけど、最近大人びてきた。",
          "romaji": "meikko wa mada 13 sai da kedo, saikin otona bite kita.",
          "en": "My niece is only 13 years old, but recently she is starting to seem like an adult."
        },
        {
          "jp": "息子は中学生になったとたん、大人びたことを言うようになった。",
          "romaji": "musuko wa chuugakusei ni natta totan, otona bita koto o iu you ni natta.",
          "en": "After my son became a middle school student, he started talking like an adult."
        },
        {
          "jp": "彼女はずいぶん幼びて見えますね。未成年じゃないの？",
          "romaji": "kanojo wa zuibun you bite miemasu ne. miseinen janai no?",
          "en": "She looks very young. Isn't she a minor?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b3%e3%82%8b-biru-%e3%81%b3%e3%81%9f-bita-%e3%81%b3%e3%81%a6-bite-meaning/"
    },
    {
      "grammar": "ぶり / っぷり",
      "meaning": "style; manner; way​",
      "structure": "Verb (ます stem) + ます ぶり っぷり Noun → ぶり っぷり Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "先生はその生徒のがんばりぶりを見ていた。",
          "romaji": "sensei wa sono seito no ganbari buri o mite ita.",
          "en": "The teacher has been observing how hard that student has been trying."
        },
        {
          "jp": "社長の話しぶり、今年のバーナスはないようだ。",
          "romaji": "shachou no hanashi buri dewa, kotoshi no boonasu wa nai you da.",
          "en": "From the way the director talks, there will probably be no bonus this year."
        },
        {
          "jp": "先輩の仕事ぶりを見ながら要領を覚えよう。",
          "romaji": "senpai no shigoto buri o mi nagara youryou o oboeyou.",
          "en": "Please watch how seniors work and remember the operations."
        },
        {
          "jp": "彼の生活ぶりを見ていると、将来が心配になる。",
          "romaji": "kare no seikatsu buri o mite iru to, shourai ga shinpai ni naru.",
          "en": "Looking at his life, I'm worried about his future."
        },
        {
          "jp": "父は、英語で話しかけられただけですごい慌てぶりだった。",
          "romaji": "chichi wa, eigo de hanashi kakerareta dake de sugoi awate buri datta.",
          "en": "My father got all panicked just because someone spoke to him in English."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b6%e3%82%8a-%e3%81%a3%e3%81%b7%e3%82%8a-buri-ppuri-meaning/"
    },
    {
      "grammar": "ぶる / ぶって / ぶった",
      "meaning": "assuming the air of; behaving like; to pretend / act like ~",
      "structure": "Noun ぶる ぶって ぶった ぶっちゃって な-adjective い-adjective + い → ぶる ぶって ぶった ぶっちゃって な-adjective い-adjective + い → な-adjective い-adjective + い → い-adjective + い | な-adjective い-adjective + い → い-adjective + い | い-adjective + い",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は金持ちぶっているが、本当は借金がたくさんある。",
          "romaji": "kare wa kanemochi butte iru ga, hontou wa shakkin ga takusan aru.",
          "en": "Though he pretends to be rich, in reality he is in serious debt."
        },
        {
          "jp": "親切ぶって近づいてくる人には気を付けてください。",
          "romaji": "shinsetsu butte chikadzuite kuru hito ni wa ki o tsukete kudasai.",
          "en": "Be careful of people who approach you and pretend to be nice."
        },
        {
          "jp": "まだまだ子供のくせに大人ぶっちゃって、どうしたの？",
          "romaji": "mada mada kodomo no kuse ni otona bucchatte, doushita no?",
          "en": "Even though you're still a child, you're pretending to be an adult. What's wrong?"
        },
        {
          "jp": "若者ぶって薄着などするから風邪をひくんですよ。",
          "romaji": "wakamono butte usugi nado suru kara kaze o hikun desu yo.",
          "en": "You keep acting like you're still young and wearing thin clothes so that's why you catch a cold."
        },
        {
          "jp": "息子は悪ぶっているが、実は気の弱い優しい子です。",
          "romaji": "musuko wa waru butte iru ga, jitsu wa ki no yowai yasashii ko desu.",
          "en": "My son acts tough, but he is actually quite weak and gentle."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b6%e3%82%8b-%e3%81%b6%e3%81%a3%e3%81%a6-%e3%81%b6%e3%81%a3%e3%81%9f-buru-butte-butta-meaning/"
    },
    {
      "grammar": "だに / だにしない",
      "meaning": "even; not even ~",
      "structure": "Verb (dicationary) だに だにしない Noun Exception: 夢 -> 夢に → だに だにしない Noun Exception: 夢 -> 夢に → Noun Exception: 夢 -> 夢に | Noun Exception: 夢 -> 夢に",
      "explanation": "",
      "examples": [
        {
          "jp": "こんな事故が起きるとは想像だにしなかった。",
          "romaji": "konna jiko ga okiru to wa souzou dani shinakatta.",
          "en": "I never imagined that such an accident would occur."
        },
        {
          "jp": "この間の彼女の態度は思い出すだに腹が立つ。",
          "romaji": "kono aida no kanojo no taido wa omoidasu dani hara ga tatsu.",
          "en": "Even just thinking about her attitude the other day still upsets me."
        },
        {
          "jp": "こんな結末になるなんて、誰もが予想だにしなかった。",
          "romaji": "konna ketsumatsu ni naru nante, dare mo ga yosou dani shinakatta.",
          "en": "No one expected it to end up like this."
        },
        {
          "jp": "宝くじで１億円当たるなんて、夢にだに思わなかったよ。",
          "romaji": "takarakuji de 1 okuen ataru nante, yume ni dani omowanakatta yo.",
          "en": "I never dreamed that I would win 100 million yen in the lottery."
        },
        {
          "jp": "人間がロボットに仕事を奪われる日が来るなんて、考えるだに恐ろしい。",
          "romaji": "ningen ga robotto ni shigoto o ubawareru hi ga kuru nante, kangaeru dani osoroshii.",
          "en": "It's scary to think that the day will come when humans will be robbed of their jobs by robots."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%ab-%e3%81%a0%e3%81%ab%e3%81%97%e3%81%aa%e3%81%84-dani-shinai-meaning/"
    },
    {
      "grammar": "だの～だの",
      "meaning": "and; and the like; and so forth ~",
      "structure": "Pattern [A] + だの + [B] + だの Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → [A] + だの + [B] + だの Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → Verb だの Noun (だった） な-adjective （だった） い-adjective → だの Noun (だった） な-adjective （だった） い-adjective → Noun (だった） な-adjective （だった） い-adjective → な-adjective （だった） い-adjective → い-adjective | [A] + だの + [B] + だの Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → Verb だの Noun (だった） な-adjective （だった） い-adjective → だの Noun (だった） な-adjective （だった） い-adjective → Noun (だった） な-adjective （だった） い-adjective → な-adjective （だった） い-adjective → い-adjective | Conjugations Verb だの Noun (だった） な-adjective （だった） い-adjective → Verb だの Noun (だった） な-adjective （だった） い-adjective → だの Noun (だった） な-adjective （だった） い-adjective → Noun (だった） な-adjective （だった） い-adjective → な-adjective （だった） い-adjective → い-adjective | Verb だの Noun (だった） な-adjective （だった） い-adjective → だの Noun (だった） な-adjective （だった） い-adjective → Noun (だった） な-adjective （だった） い-adjective → な-adjective （だった） い-adjective → い-adjective | Noun (だった） な-adjective （だった） い-adjective → な-adjective （だった） い-adjective → い-adjective | な-adjective （だった） い-adjective → い-adjective | い-adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "父は酒だの、タバコだのが好きで、健康が心配です。",
          "romaji": "chichi wa sake dano, tabako dano ga suki de, kenkou ga shinpai desu.",
          "en": "My father really likes things like alcohol and cigarettes, so I really worry for his health."
        },
        {
          "jp": "お菓子だの、アイスだの甘いものばかり食べてるから虫歯になるんだよ。",
          "romaji": "okashi dano, aisu dano amai mono bakari tabeteru kara mushiba ni naru n da yo.",
          "en": "Because you only eat sweets and ice cream you are going to get some cavities."
        },
        {
          "jp": "僕の毎月の小遣いは、飲み会だのカラオケだので消えていく。",
          "romaji": "boku no maitsuki no kodzukai wa, nomikai dano karaoke dano de kieteiku.",
          "en": "My monthly allowance usually disappears from drinking parties and karaoke."
        },
        {
          "jp": "彼女は、風邪を引いただの、頭が痛いだのと言って、よく授業を休む。",
          "romaji": "kanojo wa, kaze o hiita dano, atama ga itai dano to itte, yoku jugyou wo yasumu.",
          "en": "She often skips class by saying things like I've caught a cold or I've got a headache.."
        },
        {
          "jp": "一生結婚しないだの、海外で暮らすだの、うちの娘は本当に自分勝手だ。",
          "romaji": "isshou kekkon shinai dano, kaigai de kurasu dano, uchi no musume wa hontou ni jibun katte da.",
          "en": "She will never get married and lives abroad, my daughter is truly a selfish person."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%81%ae%ef%bd%9e%e3%81%a0%e3%81%ae-dano-dano-meaning/"
    },
    {
      "grammar": "だろうに",
      "meaning": "(1) surely..., but ~; although... is likely, ~ (2) should have (regret); might / must have been ~",
      "structure": "Sentence (casual) だろうに → だろうに",
      "explanation": "",
      "examples": [
        {
          "jp": "私があなたの立場だったら、辞めているだろうに。",
          "romaji": "watashi ga anata no tachiba dattara, yamete iru darou ni.",
          "en": "Were I in your position, I would have quit."
        },
        {
          "jp": "子育てで疲れているだろうに、妻は家事も頑張ってくれている。",
          "romaji": "kosodate de tsukarete iru darou ni, tsuma wa kaji mo ganbatte kurete iru.",
          "en": "My wife is doing her best with the housework, even though she may be tired from raising our children."
        },
        {
          "jp": "子供を激しく叱るなんてよくないだろうに、叱らないと子供が自立できない。",
          "romaji": "kodomo o hageshiku shikaru nante yokunai darou ni, shikaranai to kodomo ga jiritsu dekinai.",
          "en": "Although harsly scolding children is surely not good, if we don't scold them at all, our kids won’t become independent."
        },
        {
          "jp": "万一彼があなたに会えば、彼は驚くだろうに。",
          "romaji": "manichi kare ga anata ni aeba, kare wa odoroku darou ni.",
          "en": "Should he be able to see you, he would surely be surprised."
        },
        {
          "jp": "リスクがあるだろうに、なぜ続けているのか話を聞いてみたい。",
          "romaji": "risuku ga aru darou ni, naze tsudzukete iru no ka hanashi o kiite mitai.",
          "en": "I'd like to hear why you're continuing this, even though there clearly are risks."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a0%e3%82%8d%e3%81%86%e3%81%ab-darou-ni-meaning/"
    },
    {
      "grammar": "であれ / であろうと",
      "meaning": "whoever; whatever; however; even ~",
      "structure": "Noun であれ であろうと → であれ であろうと",
      "explanation": "誰 であれ / 誰 であろうと dare de are / dare de arou to dare de are / dare de arou to",
      "examples": [
        {
          "jp": "若い時はどんな仕事であれ、一生懸命取り組みました。",
          "romaji": "wakai toki wa donna shigoto de are, isshoukenmei torikumimashita.",
          "en": "When I was young, no matter what the work was I always gave it my best effort."
        },
        {
          "jp": "嘘をつくとは、どんな理由であれ、許されないことだ。",
          "romaji": "uso o tsuku to wa, donna riyuu de are, yurusarenai koto da.",
          "en": "Whatever the reason, lying is an unforgivable act."
        },
        {
          "jp": "彼女が誰であれ、特別扱いするのはダメでしょう。",
          "romaji": "kanojo ga dare de are, tokubetsuatsukai suru no wa dame deshou.",
          "en": "Regardless of whoever she may be, preferential treatment is surely not acceptable."
        },
        {
          "jp": "彼の話が真実であろうと無かろうと違いは無い。",
          "romaji": "kare no hanashi ga shinjitsu de arou to nakarou to chigai wa nai.",
          "en": "It makes no difference whether his story is true or not."
        },
        {
          "jp": "故意であろうとなかろうと人を傷つけたことには変わりはありません。",
          "romaji": "koi de arou to nakarou to hito o kizutsuketa koto ni wa kawari wa arimasen.",
          "en": "Whatever the intent may be, that doesn't change the fact that someone was hurt."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%82%e3%82%8c-%e3%81%a7%e3%81%82%e3%82%8d%e3%81%86%e3%81%a8-de-are-de-arou-meaning/"
    },
    {
      "grammar": "であれ～であれ",
      "meaning": "whether [A] or [B]",
      "structure": "Noun であれ であろうと Noun であれ であろうと → であれ であろうと Noun であれ であろうと → Noun であれ であろうと → であれ であろうと",
      "explanation": "",
      "examples": [
        {
          "jp": "彼がお金持ちであれ貧乏であれ、私の気持ちが変わることはない。",
          "romaji": "kare ga okanemochi de are binbou de are, watashi no kimochi ga kawaru koto wa nai.",
          "en": "It doesn't matter whether he is rich or poor, my feelings will not change."
        },
        {
          "jp": "先生であれ学生であれ、規則には従わなければなりません。",
          "romaji": "sensei de are gakusei de are, kisoku ni wa shitagawa nakereba narimasen.",
          "en": "Whether you are a teacher or a student, everyone must follow the rules."
        },
        {
          "jp": "オクラであれ納豆であれ、ネバネバしたものはとにかく嫌いだ。",
          "romaji": "okura de are nattou de are, nebaneba shita mono wa tonikaku kirai da.",
          "en": "Whether it be okra or natto, I hate these kinds of sticky foods."
        },
        {
          "jp": "たとえ雨であろうと雪であろうと、明日の試合は予定通り行います。",
          "romaji": "tatoe ame de arou to yuki de arou to, ashita no shiai wa yotei doori okonaimasu.",
          "en": "Even if it rains or snows, tomorrows match will continue as scheduled."
        },
        {
          "jp": "正社員であろうと、パートであろうと、仕事に対する責任は変わりません。",
          "romaji": "seishain de arou to, paato de arou to, shigoto ni taisuru sekinin wa kawarimasen.",
          "en": "Whether you are a full-timer or part timer, one's responsibility towards work does not change."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%82%e3%82%8c%ef%bd%9e%e3%81%a7%e3%81%82%e3%82%8c-de-are-de-are-meaning/"
    },
    {
      "grammar": "でもあり～でもある",
      "meaning": "to also be; both… and ~",
      "structure": "Noun + で もあり Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → もあり Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → もある な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で い-adj + い く い-adj + い く → い-adj + い く い-adj + い く → い-adj + い く | な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で い-adj + い く い-adj + い く → い-adj + い く い-adj + い く → い-adj + い く | い-adj + い く い-adj + い く → い-adj + い く",
      "explanation": "",
      "examples": [
        {
          "jp": "明日の試合は興奮でもあり、緊張でもある。",
          "romaji": "ashita no shiai wa koufun demo ari, kinchou demo aru.",
          "en": "I'm both excited and nervous for tomorrow's match."
        },
        {
          "jp": "高校に卒業したら喜ばしくもあり悲しくもある。",
          "romaji": "koukou ni sotsugyou shitara yorokobashi kumo ari kanashi kumo aru.",
          "en": "Graduating from high school is both happy and sad."
        },
        {
          "jp": "考えすぎてしまうのは、長所でもあり、短所でもある。",
          "romaji": "kangae sugite shimau nowa, chousho demo ari, tansho demo aru.",
          "en": "Thinking too much is both a strength and a weakness."
        },
        {
          "jp": "彼は教師でもあり小説家でもある。",
          "romaji": "kare wa kyoushi demo ari shousetsuka demo aru.",
          "en": "He is both a teacher and a novelist."
        },
        {
          "jp": "この本は面白くもあり有益でもある。",
          "romaji": "kono hon wa omoshiro kumo ari yuueki demo aru.",
          "en": "This book is both interesting and informative."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82%e3%81%82%e3%82%8a%ef%bd%9e%e3%81%a7%e3%82%82%e3%81%82%e3%82%8b-demo-ari-demo-aru-meaning/"
    },
    {
      "grammar": "でもあり～でもある",
      "meaning": "to also be; both… and ~",
      "structure": "Noun + で もあり Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → もあり Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → Noun + で もある な-adj + で な-adj + で い-adj + い く い-adj + い く → もある な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で い-adj + い く い-adj + い く → い-adj + い く い-adj + い く → い-adj + い く | な-adj + で な-adj + で い-adj + い く い-adj + い く → な-adj + で い-adj + い く い-adj + い く → い-adj + い く い-adj + い く → い-adj + い く | い-adj + い く い-adj + い く → い-adj + い く",
      "explanation": "",
      "examples": [
        {
          "jp": "明日の試合は興奮でもあり、緊張でもある。",
          "romaji": "ashita no shiai wa koufun demo ari, kinchou demo aru.",
          "en": "I'm both excited and nervous for tomorrow's match."
        },
        {
          "jp": "高校に卒業したら喜ばしくもあり悲しくもある。",
          "romaji": "koukou ni sotsugyou shitara yorokobashi kumo ari kanashi kumo aru.",
          "en": "Graduating from high school is both happy and sad."
        },
        {
          "jp": "考えすぎてしまうのは、長所でもあり、短所でもある。",
          "romaji": "kangae sugite shimau nowa, chousho demo ari, tansho demo aru.",
          "en": "Thinking too much is both a strength and a weakness."
        },
        {
          "jp": "彼は教師でもあり小説家でもある。",
          "romaji": "kare wa kyoushi demo ari shousetsuka demo aru.",
          "en": "He is both a teacher and a novelist."
        },
        {
          "jp": "この本は面白くもあり有益でもある。",
          "romaji": "kono hon wa omoshiro kumo ari yuueki demo aru.",
          "en": "This book is both interesting and informative."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82%e3%81%82%e3%82%8a%ef%bd%9e%e3%81%a7%e3%82%82%e3%81%82%e3%82%8b-demo-ari-demo-aru-meaning/"
    },
    {
      "grammar": "でも何でもない / くも何ともない",
      "meaning": "not in the least; nothing like that",
      "structure": "Noun でも何でもない な-adjective い-adjective い くも何ともない → でも何でもない な-adjective い-adjective い くも何ともない → な-adjective い-adjective い くも何ともない → い-adjective い くも何ともない → くも何ともない | な-adjective い-adjective い くも何ともない → い-adjective い くも何ともない → くも何ともない | い-adjective い くも何ともない → くも何ともない",
      "explanation": "",
      "examples": [
        {
          "jp": "誕生日でもなんでもないのにプレゼントをもらった。",
          "romaji": "tanjoubi demo nan demo nai no ni purezento o moratta.",
          "en": "I got a present even though it wasn't my birthday or anything like that."
        },
        {
          "jp": "彼の冗談は面白くもなんともない。",
          "romaji": "kare no joudan wa omoshiroku mo nantomo nai.",
          "en": "His joke is not interesting at all."
        },
        {
          "jp": "彼は僕の親戚でもなんでもない。",
          "romaji": "kare wa boku no shinseki demo nan demo nai.",
          "en": "I am not related to him at all."
        },
        {
          "jp": "彼のこと、好きでもなんでもないけれど、なぜか気にかかる。",
          "romaji": "kare no koto, suki demo nan demo nai keredo, naze ka ki ni kakaru.",
          "en": "I don't really like him at all but there is something interesting about him."
        },
        {
          "jp": "今回の結果は不思議でもなんでもないし、当然だと思う。",
          "romaji": "konkai no kekka wa fushigi demo nan demo nai shi, touzen da to omou.",
          "en": "The result this time is nothing strange and I think was to be expected."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82%e4%bd%95%e3%81%a7%e3%82%82%e3%81%aa%e3%81%84-%e3%81%8f%e3%82%82%e4%bd%95%e3%81%a8%e3%82%82%e3%81%aa%e3%81%84-demo-nan-demo-nai-meaning/"
    },
    {
      "grammar": "でなくてなんだろう",
      "meaning": "must be; is definitely ~",
      "structure": "Noun でなくてなんだろう → でなくてなんだろう",
      "explanation": "",
      "examples": [
        {
          "jp": "彼女に対するこの気持ちは、愛でなくてなんだろう。",
          "romaji": "kanojo ni taisuru kono kimochi wa, ai denakute nan darou.",
          "en": "The feeling of mine for her must be love."
        },
        {
          "jp": "子供のために病気になるまで働くとは、親の愛でなくてなんだろう。",
          "romaji": "kodomo no tame ni byouki ni naru made hataraku to wa, oya no ai denakute nan darou.",
          "en": "Working to the point of sickness for the sake of one's child is nothing other than parental love."
        },
        {
          "jp": "彼は裁判で無罪を主張しているが、彼のやったことは殺人ででなくてなんだろう。",
          "romaji": "kare wa saiban de muzai o shuchou shite iru ga, kare no yatta koto wa satsujin denakute nan darou.",
          "en": "He is claiming to be innocent in court, but what he did was clearly murder."
        },
        {
          "jp": "あの政治家のやったことは汚職でなくてなんだろう。",
          "romaji": "ano seijika no yatta koto wa oshoku denakute nan darou.",
          "en": "What that politician did was definitely corrupt."
        },
        {
          "jp": "友達は飛行機で隣に座った人と結婚したそうだ。これが運命でなくてなんだろう。",
          "romaji": "tomodachi wa hikouki de tonari ni suwatta hito to kekkon shita sou da. kore ga unmei denakute nan darou.",
          "en": "My friend married the person he was sitting next to on the plane. This must be fate."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%aa%e3%81%8f%e3%81%a6%e3%81%aa%e3%82%93%e3%81%a0%e3%82%8d%e3%81%86-denakute-nan-darou-meaning/"
    },
    {
      "grammar": "ではあるまいか",
      "meaning": "isn't it; I wonder if it’s not ~",
      "structure": "Verb (casual) + の ではあるまいか Noun + (なの) な-adjective + (なの) い-adjective + の → ではあるまいか Noun + (なの) な-adjective + (なの) い-adjective + の → Noun + (なの) な-adjective + (なの) い-adjective + の → な-adjective + (なの) い-adjective + の → い-adjective + の | Noun + (なの) な-adjective + (なの) い-adjective + の → な-adjective + (なの) い-adjective + の → い-adjective + の | な-adjective + (なの) い-adjective + の → い-adjective + の | い-adjective + の",
      "explanation": "",
      "examples": [
        {
          "jp": "この調子なら、今年の売り上げ目標を達成できるのではあるまいか。",
          "romaji": "kono choushi nara, kotoshi no uriage mokuhyou o tassei dekiru no dewa arumai ka.",
          "en": "If this is the case, I wonder if we can reach our sales target this year."
        },
        {
          "jp": "天気予報で今日は天気が悪いと言っていたが、雨は降らないのではあるまいか。",
          "romaji": "tenkiyohou de kyou wa tenki ga warui to itte ita ga, ame wa furanai no dewa arumai ka.",
          "en": "The weather forecast said that the weather would be bad today, but I wonder if it's not going to rain."
        },
        {
          "jp": "道がすごい渋滞だね。約束の時間に間に合わないのではあるまいか。",
          "romaji": "michi ga sugoi juutai da ne. yakusoku no jikan ni ma ni awanai no dewa arumai ka.",
          "en": "The road is very congested. I wonder if we won't make it in time (to the promised time)."
        },
        {
          "jp": "100万円宝くじが当たるなんて夢ではあるまいか。",
          "romaji": "100 manen takarakuji ga ataru nante yume dewa arumai ka.",
          "en": "Isn't it a dream to win a 1 million yen lottery?"
        },
        {
          "jp": "上司は僕のチームの意見に反対するのではあるまいか。",
          "romaji": "joushi wa boku no chiimu no iken ni hantai suru no dewa arumai ka.",
          "en": "I wonder if my boss disagrees with my team's opinion."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%af%e3%81%82%e3%82%8b%e3%81%be%e3%81%84%e3%81%8b-dewa-arumai-ka-meaning/"
    },
    {
      "grammar": "ではあるまいし",
      "meaning": "it’s not like; it isn’t as if ~",
      "structure": "Noun ではあるまいし でもあるまいし じゃあるまいし → ではあるまいし でもあるまいし じゃあるまいし",
      "explanation": "",
      "examples": [
        {
          "jp": "子供ではあるまいし、泣くのはやめなさい。",
          "romaji": "kodomo dewa arumai shi, naku nowa yamenasai.",
          "en": "Stop crying! You are not a child."
        },
        {
          "jp": "新入社員ではあるまいし、基本的なことは説明する必要ないと思います。",
          "romaji": "shinnyuu shain dewa arumai shi, kihonteki na koto wa setsumei suru hitsuyou nai to omoimasu.",
          "en": "You're not a new employee, so I don't think I need to explain the basics."
        },
        {
          "jp": "お金持ちじゃあるまいし、そんな高価なものは買えません。",
          "romaji": "okanemochi ja arumai shi, sonna kouka na mono wa kaemasen.",
          "en": "It's not like I'm rich, so I can't buy such an expensive item."
        },
        {
          "jp": "一生会えなくなるわけじゃあるまいし、そんなに悲しまないでよ。",
          "romaji": "isshou aenaku naru wake ja arumai shi, sonnani kanashimanaide yo.",
          "en": "It's not like you won't be able to meet for the rest of your life, so don't be so sad."
        },
        {
          "jp": "面接試験は初めてではあるまいし、どうしてそんなに緊張するの？",
          "romaji": "mensetsu shiken wa hajimete dewa arumai shi, doushite sonna ni kinchou suru no.",
          "en": "It’s not like you are having your first interview, so why are you so nervous?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%af%e3%81%82%e3%82%8b%e3%81%be%e3%81%84%e3%81%97-dewa-arumai-shi-meaning/"
    },
    {
      "grammar": "では済まない",
      "meaning": "it doesn’t end with just ~; it will take more than ~",
      "structure": "Verb (casual) + (の) ではすまない ではすまされない Noun → ではすまない ではすまされない Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "このストーリーはただの笑い話では済まされないと思うところがある。",
          "romaji": "kono sutoorii wa tada no waraibanashi dewa sumasarenai to omou tokoro ga aru.",
          "en": "I don't think this story is just a funny story."
        },
        {
          "jp": "どんな言語を学ぶにしても辞書なしでは済まない。",
          "romaji": "donna gengo o manabu ni shite mo jisho nashi dewa sumanai.",
          "en": "Whatever language you study, you cannot do without dictionary."
        },
        {
          "jp": "あなたが彼女に言ったことは、冗談では済まされない。",
          "romaji": "anata ga kanojo ni itta koto wa, joudan dewa sumasarenai.",
          "en": "What you said to her isn’t acceptable as \"just a joke\"."
        },
        {
          "jp": "自分にとっては冗談のつもりでも、相手にとっては冗談では済まされない場合もある。",
          "romaji": "jibun ni totte wa joudan no tsumori demo, aite ni totte wa joudan dewa sumasarenai baai mo aru.",
          "en": "There are times where it may just be a joke for you, but it's not a joke for the other person."
        },
        {
          "jp": "インフルエンザが流行してるこの時期、私たちも他人事では済まされない。",
          "romaji": "infuruenza ga ryuukou shiteru kono jiki, watashitachi mo taningoto dewa sumasarenai.",
          "en": "At this time of the flu epidemic, we can't ignore it and leave it alone."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%81%af%e6%b8%88%e3%81%be%e3%81%aa%e3%81%84-dewa-sumanai-meaning/"
    },
    {
      "grammar": "どうにも～ない",
      "meaning": "not … by any means; no matter how hard one tries, cannot ~",
      "structure": "どうにも Verb (ない form) Noun + がない → Verb (ない form) Noun + がない → Noun + がない | Noun + がない",
      "explanation": "",
      "examples": [
        {
          "jp": "こんな蒸し暑い天気は、どうにも我慢できない。",
          "romaji": "konna mushiatsui tenki wa, dou nimo gaman dekinai.",
          "en": "I can't stand this humid weather."
        },
        {
          "jp": "私はこの場所ではどうにも勉強に集中できない。",
          "romaji": "watashi wa kono basho de wa dou nimo benkyou ni shuuchuu dekinai",
          "en": "I cannot concentrate on my studies at all in this place."
        },
        {
          "jp": "彼女が亡くなったことをどうにも信じられない。",
          "romaji": "kanojo ga nakunatta koto o dou nimo shinjirarenai.",
          "en": "I just can't believe that she passed away."
        },
        {
          "jp": "彼の怠惰な性格は、どうにも直しようがない。",
          "romaji": "kare no taida na seikaku wa, dou nimo naoshiyou ga nai.",
          "en": "Nothing can be done to fix his lazy personality."
        },
        {
          "jp": "その携帯電話はどうにも直しようがないほどに壊れてしまった。",
          "romaji": "sono keitai denwa wa dou nimo naoshiyou ga nai hodo ni kowarete shimatta.",
          "en": "The cell phone broke to the point that it couldn't be fixed."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a9%e3%81%86%e3%81%ab%e3%82%82%ef%bd%9e%e3%81%aa%e3%81%84-dou-nimo-nai-meaning/"
    },
    {
      "grammar": "が早いか",
      "meaning": "no sooner than; as soon as ~",
      "structure": "Verb (dictionary) が早いか → が早いか",
      "explanation": "",
      "examples": [
        {
          "jp": "その人は、信号の色が変わるが早いか、走り出した。",
          "romaji": "sono hito wa, shingou no iro ga kawaru ga hayai ka, hashiri dashita.",
          "en": "That guy ran off as soon as the crosswalk light changed."
        },
        {
          "jp": "うちの子はいつも学校から帰ってきて、かばんを放り出すが早いか、遊びに行ってしまう。",
          "romaji": "uchi no ko wa itsumo gakkou kara kaette kite, kaban o houridasu ga hayai ka, asobi ni itte shimau.",
          "en": "As soon as my child gets home from school, they immediately drop their bag and go off to play."
        },
        {
          "jp": "隣席のクラスメイトは、授業の終わりのベルが鳴るが早いか、教室を出て行った。",
          "romaji": "rinseki no kurasumeito wa, jugyou no owari no beru ga naru ga hayai ka, kyoushitsu o dete itta.",
          "en": "My classmate who sits next to me rushed out of the classroom the instant the bell rang."
        },
        {
          "jp": "先生が地震だと叫ぶが早いか、子供たちは机の下に潜り込んだ。",
          "romaji": "sensei ga jishin da to sakebu ga hayai ka, kodomotachi wa tsukue no shita ni moguri konda.",
          "en": "The kids crawled under the table as soon as the teacher shouted “Earthquake.”"
        },
        {
          "jp": "警察に気がつくが早いか、その男はどこかへ向かって走り出した。",
          "romaji": "keisatsu ni ki ga tsuku ga hayai ka, sono otoko wa doko ka e mukatte hashiri dashita.",
          "en": "As soon as he noticed the police, the man started running off somewhere."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e6%97%a9%e3%81%84%e3%81%8b-ga-hayai-ka-meaning/"
    },
    {
      "grammar": "が/も～なら、～も～だ",
      "meaning": "negative connection/comparison (like father like son)",
      "structure": "Noun-1＋が/も＋Noun-1＋なら、 Noun-2＋も＋Noun-2＋だ",
      "explanation": "",
      "examples": [
        {
          "jp": "先生が先生なら、学生も学生だ。",
          "romaji": "sensei ga sensei nara, gakusei mo gakusei da.",
          "en": "Like teacher like student. (with a bad teacher like this of course the students are also bad)"
        },
        {
          "jp": "味が味なら、サービスもサービスだ。",
          "romaji": "aji ga aji nara, saabisu mo saabisu da.",
          "en": "With bad taste like this, of course the service is also bad."
        },
        {
          "jp": "子供が子供なら、親も親だ。",
          "romaji": "kodomo ga kodomo nara, oya mo oya da.",
          "en": "With the kid like this, of course the parents are also bad."
        },
        {
          "jp": "あのカフェは、味も味なら、サービスもサービスだ。",
          "romaji": "ano kafee wa, aji mo aji nara, saabisu mo saabisu da.",
          "en": "That cafe's food and service are both bad."
        },
        {
          "jp": "この会社の社員は常識がない。上司が上司なら、部下も部下ですね。",
          "romaji": "kono kaisha no shain wa joushiki ga nai. joushi ga joushi nara, buka mo buka desu ne.",
          "en": "The employees at this company have no common sense. If the managers are bad, then the general staff will be too."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c-%e3%82%82%ef%bd%9e%e3%81%aa%e3%82%89%ef%bd%9e%e3%82%82%ef%bd%9e%e3%81%a0-ga-mo-nara-mo-da-meaning/"
    },
    {
      "grammar": "がましい",
      "meaning": "look like; sound like; approximate; similar to; somewhat like ~",
      "structure": "Noun がましい → がましい",
      "explanation": "",
      "examples": [
        {
          "jp": "差し出がましい男だ。",
          "romaji": "sashide gamashii otoko da.",
          "en": "He is too forward."
        },
        {
          "jp": "彼女は言い訳がましい事は一切言わなかった。",
          "romaji": "kanojo wa iiwake ga mashii koto wa issai iwanakatta.",
          "en": "She didn't say anything sounding like an excuse."
        },
        {
          "jp": "彼は他人がましい振る舞いをする。",
          "romaji": "kare wa tanin ga mashii furumai o suru.",
          "en": "He behaves like others."
        },
        {
          "jp": "言い訳がましいことは言わないほうがカッコいい。",
          "romaji": "iiwake ga mashii koto wa iwanai hou ga kakkoii.",
          "en": "It's cooler to not to make excuses."
        },
        {
          "jp": "彼女は恩着せがましい態度で僕と踊ってくれた。",
          "romaji": "kanojo wa onkise ga mashii taido de boku to odotte kureta.",
          "en": "She danced with me in a gracious manner."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%be%e3%81%97%e3%81%84-gamashii-meaning/"
    },
    {
      "grammar": "がてら",
      "meaning": "while; on the same occasion; at the same time; coincidentally ~",
      "structure": "Verb ます (sterm form) がてら Noun → がてら Noun → Noun | Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "散歩がてら、コンビニに行ってくるよ。",
          "romaji": "sanpo gatera, konbini ni itte kuru yo.",
          "en": "I'm going for a walk and will stop by a convenience store."
        },
        {
          "jp": "友達を駅まで送りがてらDVDを返してきた。",
          "romaji": "tomodachi o eki made okuri gatera DVD o kaeshite kita.",
          "en": "While I was dropping my friend off at the station, I returned the DVD."
        },
        {
          "jp": "遊びがてらお立ち寄りください。",
          "romaji": "asobi gatera otachi yori kudasai.",
          "en": "Please stop by when you are free"
        },
        {
          "jp": "ちょっと買い物がてら、銀行に寄って記帳してきます。",
          "romaji": "chotto kaimono gatera, ginkou ni yotte kichou shite kimasu.",
          "en": "After a little shopping, I will stop by the bank and update my bank book."
        },
        {
          "jp": "紅葉を見がてら隣の町まで歩いた。",
          "romaji": "kouyou wo migatera tonari no machi made aruita.",
          "en": "While looking at the autumn leaves, I ended up walking to the next town."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8c%e3%81%a6%e3%82%89-gatera-meaning/"
    },
    {
      "grammar": "ごとき / ごとく / ごとし",
      "meaning": "like; as if; the same as ~",
      "structure": "Verb （＋が／かの） (dictionary / た form) ごとき + noun ごとく～（文の途中） ごとし（文の終わり） Noun + の → ごとき + noun ごとく～（文の途中） ごとし（文の終わり） Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "彼は風のごとく走っています。",
          "romaji": "kare wa kaze no gotoku hashitte imasu.",
          "en": "He is running like the wind."
        },
        {
          "jp": "誰も見ていないかのごとく自由に踊りましょう。",
          "romaji": "dare mo mite inai ka no gotoku jiyuu ni odorimashou.",
          "en": "Let's dance freely as if no one is watching."
        },
        {
          "jp": "彼女は水のごとくお金を使う。",
          "romaji": "kanojo wa mizu no gotoku okane o tsukau.",
          "en": "She spends money like water."
        },
        {
          "jp": "彼は何でも知っているかのごとく、いつも自信を持って話す。",
          "romaji": "kare wa nan demo shitte iru ka no gotoku, itsumo jishin o motte hanasu.",
          "en": "He always speaks with confidence, as if he knew everything."
        },
        {
          "jp": "すでに述べたがごとく、この調査方法にはいくつかの問題点がある。",
          "romaji": "sudeni nobeta ga gotoku, kono chousa houhou ni wa ikutsu ka no mondaiten ga aru.",
          "en": "As I pointed out earlier, there are a few problems with the method used to conduct this survey."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%94%e3%81%a8%e3%81%8d-%e3%81%94%e3%81%a8%e3%81%8f-%e3%81%94%e3%81%a8%e3%81%97-gotoki-gotoku-gotoshi-meaning/"
    },
    {
      "grammar": "ぐるみ",
      "meaning": "together (with); -wide",
      "structure": "Noun ぐるみ → ぐるみ",
      "explanation": "家族 ぐるみ kazoku gurumi together with family / family-wide kazoku gurumi together with family / family-wide",
      "examples": [
        {
          "jp": "私たちは家族ぐるみで仲良くしている。",
          "romaji": "watashi tachi wa kazoku gurumi de nakayoku shiteiru.",
          "en": "We are close with everyone in our family."
        },
        {
          "jp": "町ぐるみで自然環境の保全に努めている。",
          "romaji": "machi gurumi de shizen kankyou no hozen ni tsutometeiru.",
          "en": "The entire town is striving together to protect its natural environment."
        },
        {
          "jp": "彼女とは長年家族ぐるみの付き合いをしている。",
          "romaji": "kanojo towa naganen kazoku gurumi no tsukiai o shiteiru.",
          "en": "She and I have been good friends for a long time and so have our families."
        },
        {
          "jp": "その企業が会社ぐるみで脱税をしてたのが発覚した。",
          "romaji": "sono kigyou ga kaisha gurumi de datsuzei wo shiteita no ga hakkaku shita.",
          "en": "That company was caught for doing company-wide tax evasion."
        },
        {
          "jp": "子供たちの非行を減らすために、町ぐるみで活動している。",
          "romaji": "kodomo tachi no hikou o herasu tame ni, machi gurumi de katsudou shiteiru.",
          "en": "We are working throughout the town to reduce children's delinquency."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%90%e3%82%8b%e3%81%bf-gurumi-meaning/"
    },
    {
      "grammar": "羽目になる",
      "meaning": "to get stuck with; to end up with (something unpleasant)",
      "structure": "Verb (dictionary) 羽目になる ハメになる → 羽目になる ハメになる",
      "explanation": "",
      "examples": [
        {
          "jp": "私は歩く時に転んで、入院する羽目になった。",
          "romaji": "watashi wa aruku toki ni koronde, nyuuin suru hame ni natta.",
          "en": "I fell while walking and ended up being hospitalized."
        },
        {
          "jp": "授業をサボりすぎたので、試験前は徹夜する羽目になりそうだ。",
          "romaji": "jugyou o sabori sugita node, shiken mae wa tetsuya suru hame ni nari sou da.",
          "en": "Because I skipped class too much, It looks like I will end up staying up all night the day before the exam."
        },
        {
          "jp": "急いで家を飛び出して、傘を忘れたので、結局戻る羽目になった。",
          "romaji": "isoide ie o tobidashite, kasa o wasureta node, kekkyoku modoru hame ni natta.",
          "en": "I hurried out of the house and forgot my umbrella, so I ended up having to go back to get it."
        },
        {
          "jp": "冬に暖かい格好をしないと,ひどい風邪をひく羽目になる。",
          "romaji": "fuyu ni attakai kakkou o shinai to, hidoi kaze o hiku hame ni naru.",
          "en": "If you don't dress warmly in winter, you will end up catching a bad cold."
        },
        {
          "jp": "うっかりしてデータを消してしまったので、もう一度入力する羽目になった。",
          "romaji": "ukkari shite deeta o keshite shimatta node, mou ichido nyuuryoku suru hame ni natta.",
          "en": "I accidentally deleted the data so I had to input it all in again."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e7%be%bd%e7%9b%ae%e3%81%ab%e3%81%aa%e3%82%8b-%e3%81%af%e3%82%81%e3%81%ab%e3%81%aa%e3%82%8b-hame-ni-naru-meaning/"
    },
    {
      "grammar": "ほどのことではない",
      "meaning": "it's not worth; no need to ~",
      "structure": "Verb (dictionary) ほどのことではない → ほどのことではない",
      "explanation": "",
      "examples": [
        {
          "jp": "それは悲しむほどのことではない。",
          "romaji": "sore wa kanashimu hodo no koto dewa nai.",
          "en": "That isn't anything to be sad over."
        },
        {
          "jp": "もっとも気にする程のことではないが。",
          "romaji": "mottomo ki ni suru hodo no koto dewa nai ga.",
          "en": "You needn't let it worry you, though."
        },
        {
          "jp": "ちょっと転んで、怪我をしただけなので、病院に行くほどのことではない。",
          "romaji": "chotto koronde, kega o shita dake na node, byouin ni iku hodo no koto dewa nai.",
          "en": "I just fell and got a little hurt so I don't need to go to the hospital."
        },
        {
          "jp": "これは初級の文法だから、説明するほどのことではないですね？",
          "romaji": "kore wa shokyuu no bunpou da kara, setsumei suru hodo no koto dewa nai desu ne?",
          "en": "This is grammar for beginners, so there's no need to explain, right?"
        },
        {
          "jp": "この話は人に隠れてお話しするほどのことではないと思います。",
          "romaji": "kono hanashi wa hito ni kakurete ohanashi suru hodo no koto dewa nai to omoimasu.",
          "en": "I think this story is not something that needs to be said in secret."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%bb%e3%81%a9%e3%81%ae%e3%81%93%e3%81%a8%e3%81%a7%e3%81%af%e3%81%aa%e3%81%84-hodo-no-koto-dewa-nai-meaning/"
    },
    {
      "grammar": "ほうがましだ",
      "meaning": "better than; would rather ~",
      "structure": "Verb (casual form) ほうがましだ Noun + の → ほうがましだ Noun + の → Noun + の | Noun + の",
      "explanation": "",
      "examples": [
        {
          "jp": "あなたと結婚するくらいなら、独身のほうがましだ。",
          "romaji": "anata to kekkon suru kurai nara, dokushin no hou ga mashida.",
          "en": "It's better to be single than to marry you."
        },
        {
          "jp": "ギャンブルに金を浪費するなら捨てたほうがましだ。",
          "romaji": "gyanburu ni kin o rouhi suru nara suteta hou ga mashida.",
          "en": "I would rather throw my money away than waste it on gambling."
        },
        {
          "jp": "途中でやめるぐらいなら始めからやらないほうがましだ。",
          "romaji": "tochuu de yameru gurai nara hajime kara yaranai hou ga mashida.",
          "en": "If you're going to give up halfway, it's better to not start at all."
        },
        {
          "jp": "そんな雑誌を読むくらいなら、昼寝をするほうがましだよ。",
          "romaji": "sonna zasshi o yomu kurai nara, hirune o suru hou ga mashida yo.",
          "en": "It's better to take a nap than to read such a magazine."
        },
        {
          "jp": "こんな天気の中を出かけるよりは、家にいるほうがましだ。",
          "romaji": "konna tenki no naka o dekakeru yori wa, ie ni iru hou ga mashida.",
          "en": "It's better to stay at home than to go out in this weather."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%bb%e3%81%86%e3%81%8c%e3%81%be%e3%81%97%e3%81%a0-hou-ga-mashi-da-meaning/"
    },
    {
      "grammar": "放題",
      "meaning": "doing as one pleases; to one's heart's content; leaving uncontrolled",
      "structure": "Verb (ます stem) ます + (たい) 放題 → 放題",
      "explanation": "",
      "examples": [
        {
          "jp": "焼肉食べ放題大人一人2,500円。",
          "romaji": "yakiniku tabehoudai otona hitori 2,500 en.",
          "en": "All-you-can-eat BBQ for one adult is 2,500 yen."
        },
        {
          "jp": "このゲームを使い放題にします。",
          "romaji": "kono geemu o tsukai houdai ni shimasu.",
          "en": "I will play this game as much as I want."
        },
        {
          "jp": "日頃の不満を言いたい放題言ったら、気分がすっきりした。",
          "romaji": "higoro no fuman o iitai houdai ittara, kibun ga sukkiri shita.",
          "en": "I felt refreshed after saying all I wanted to say."
        },
        {
          "jp": "僕の家へ来れば本は読み放題だ。",
          "romaji": "boku no ie e kureba hon wa yomi houdai da.",
          "en": "You can read as many books as you want when you come to my house."
        },
        {
          "jp": "子供には自分の好きなようにやりたい放題させておけばいい。",
          "romaji": "kodomo ni wa jibun no sukina you ni yaritai houdai sasete okeba ii.",
          "en": "Let the kids do whatever they want."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e6%94%be%e9%a1%8c-%e3%81%bb%e3%81%86%e3%81%a0%e3%81%84-houdai-meaning/"
    },
    {
      "grammar": "いかんだ / いかんでは / いかんによっては",
      "meaning": "in accordance with; depending on; whether or not ~",
      "structure": "Noun +（の） いかんだ いかんで（は） いかんによっては → いかんだ いかんで（は） いかんによっては",
      "explanation": "",
      "examples": [
        {
          "jp": "検査の結果いかんでは、入院もあり得ます。",
          "romaji": "kensa no kekka ikan dewa, nyuuin mo ariemasu.",
          "en": "Depending on the result of the test, you may be hospitalized."
        },
        {
          "jp": "来月の業績いかんによっては、閉店することも考えている。",
          "romaji": "raigetsu no gyouseki ikan ni yotte wa, heiten suru koto mo kangaete iru.",
          "en": "We are considering closing the store depending on the performance of next month."
        },
        {
          "jp": "父は体調いかんでは会社を辞めるかもしれない。",
          "romaji": "chichi wa taichou ikan dewa kaisha o yameru kamo shirenai.",
          "en": "My father may quit the company depending on his physical condition."
        },
        {
          "jp": "試験に合格できるかどうかは、あなたの努力いかんだよ。",
          "romaji": "shiken ni goukaku dekiru ka douka wa, anata no doryoku ikan da yo.",
          "en": "Whether you can pass the exam depends on your efforts."
        },
        {
          "jp": "台風の状況いかんでは、旅行をキャンセルかもしれません。",
          "romaji": "taifuu no joukyou ikan dewa, ryokou o kyanseru kamo shiremasen.",
          "en": "Depending on the typhoon situation, the trip may be cancelled."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%8b%e3%82%93%e3%81%a0-%e3%81%84%e3%81%8b%e3%82%93%e3%81%a7%e3%81%af-%e3%81%84%e3%81%8b%e3%82%93%e3%81%ab%e3%82%88%e3%81%a3%e3%81%a6%e3%81%af-ikan-dewa-meaning/"
    },
    {
      "grammar": "いかんにかかわらず / いかんによらず / いかんをとわず",
      "meaning": "regardless of; whether or not; doesn't matter whether ~",
      "structure": "Noun +（の） いかんにかかわらず いかんによらず いかんをとわず → いかんにかかわらず いかんによらず いかんをとわず",
      "explanation": "",
      "examples": [
        {
          "jp": "理由のいかんにかかわらず、ここに駐車をしてはいけない。",
          "romaji": "riyuu no ikan ni kakawarazu, koko ni chuusha o shite wa ikenai.",
          "en": "Do not park here for any reason."
        },
        {
          "jp": "天気のいかんにかかわらず、開会式は予定通り行います。",
          "romaji": "tenki no ikan ni kakawarazu, kaikaishiki wa yotei doori ni okonaimasu.",
          "en": "The opening ceremony will be held as scheduled regardless of the weather."
        },
        {
          "jp": "学歴や年齢のいかんを問わず、どなたでも応募することが可能です。",
          "romaji": "gakureki ya nenrei no ikan o towazu, donata demo oubo suru koto ga kanou desu.",
          "en": "Anyone can apply regardless of educational background or age."
        },
        {
          "jp": "事情のいかんによらず、遅刻をすれば大学の受験に参加できない。",
          "romaji": "jijou no ikan ni yorazu, chikoku o sureba daigaku no juken ni sanka dekinai.",
          "en": "Regardless of the circumstances, if you are late, you will not be able to participate in the university entrance examination."
        },
        {
          "jp": "この講義は専攻のいかんにかかわらず、全員受けてください。",
          "romaji": "kono kougi wa senkou no ikan ni kakawarazu, zenin ukete kudasai.",
          "en": "All students should take this lecture regardless of their major."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e3%81%84%e3%81%8b%e3%82%93%e3%81%ab%e3%81%8b%e3%81%8b%e3%82%8f%e3%82%89%e3%81%9a-%e3%81%84%e3%81%8b%e3%82%93%e3%81%ab%e3%82%88%e3%82%89%e3%81%9a-ikan-ni-kakawarazu-meaning/"
    },
    {
      "grammar": "いかなる",
      "meaning": "any kind of; every; whatsoever; whatever",
      "structure": "いかなる Noun → Noun",
      "explanation": "",
      "examples": [
        {
          "jp": "君はいかなる状況でも部屋を離れてはならない。",
          "romaji": "kimi wa ikanaru joukyou demo heya o hanarete wa naranai.",
          "en": "You must not leave the room under any circumstances."
        },
        {
          "jp": "私はいかなる質問にも答えるつもりはない。",
          "romaji": "watashi wa ikanaru shitsumon ni mo kotaeru tsumori wa nai.",
          "en": "I will not answer any questions."
        },
        {
          "jp": "警察はいつもいかなる事態にも対処できる態勢にある。",
          "romaji": "keisatsu wa itsumo ikanaru jitai ni mo taisho dekiru taisei ni aru.",
          "en": "The police are always ready to deal with any situation."
        },
        {
          "jp": "私たちはいかなる損害にもその責任を負いません。",
          "romaji": "watashi tachi wa ikanaru songai ni mo sono sekinin o oimasen.",
          "en": "We are not responsible for any damages."
        },
        {
          "jp": "彼はいかなる難局にも処しうる男だ。",
          "romaji": "kare wa ikanaru nankyoku ni mo shoshi uru otoko da.",
          "en": "He is a man who knows how to cope with any difficult situation."
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%a6%82%e4%bd%95%e3%81%aa%e3%82%8b-%e3%81%84%e3%81%8b%e3%81%aa%e3%82%8b-ikanaru-meaning/"
    },
    {
      "grammar": "いかに",
      "meaning": "how; in what way; how much; to what extent",
      "structure": "いかに Verb Noun Adjective → Verb Noun Adjective → Noun Adjective → Adjective | Noun Adjective → Adjective | Adjective",
      "explanation": "",
      "examples": [
        {
          "jp": "これがいかに難しいかわかり始めている。",
          "romaji": "kore ga ikani muzukashii ka wakari hajimete iru.",
          "en": "I'm starting to see how difficult this is."
        },
        {
          "jp": "この会合がいかに重要かを彼は全然わかっていない。",
          "romaji": "kono kaigou ga ikani juuyou ka o kare wa zenzen wakatte inai.",
          "en": "He has no idea how important this meeting is."
        },
        {
          "jp": "彼女の顔を見れば彼女がいかに幸せかがわかった。",
          "romaji": "kanojo no kao o mireba kanojo ga ikani shiawase ka ga wakatta.",
          "en": "Looking at her face showed how happy she was."
        },
        {
          "jp": "彼は法を守ることはいかに大切かを指摘した。",
          "romaji": "kare wa hou o mamoru koto wa ikani taisetsu ka o shiteki shita.",
          "en": "He pointed out how important it is to uphold the law."
        },
        {
          "jp": "あの人は君の目にいかに映じたか。",
          "romaji": "ano hito wa kimi no me ni ikani eijita ka.",
          "en": "How has he impressed you?"
        }
      ],
      "detail_url": "https://jlptsensei.com/learn-japanese-grammar/%e5%a6%82%e4%bd%95%e3%81%ab-%e3%81%84%e3%81%8b%e3%81%ab-ikani-meaning/"
    }
  ]
}

def grammar_to_id(entry: dict, level: str) -> str:
    return f"grammar_{level}_{entry['grammar']}"
