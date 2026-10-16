// ── カルーセル — explaining a point in its own sentence (plan 210b) ──
// The catalogue says what a point means in general ("で: location of an
// action, or means/method"). A carousel shows it at work in one sentence,
// so the slide says it with that sentence's own words: what the particle
// marks and what it ties it to (駅 + で -> 会います), how the form is
// built from the dictionary form (読む -> 読んでください), and, where two
// particles stand together (には, では, への ...), what each does and
// what the pair does. Everything here is built from the bank's rows and
// the hand-written tables below; nothing is generated text.

const fill = (tpl, slots) => tpl.replace(/\{(\w+)\}/g, (_, k) => slots[k] ?? '')

/** "駅 (station)", or the word alone where it has no gloss. */
export const quoted = (word, gloss) => (gloss ? `${word} (${gloss})` : word)

// What each particle does, said with the sentence's words: {X} the word it
// marks, {V} the predicate it ties it to, {Y} the word after it; each with
// a q ({Xq}) for the word and its gloss. `label` is the role, short enough
// to stand under the particle on the slide.
export const ROLES = {
  は: { label: { en: 'topic', fr: 'thème' },
    say: { en: 'は makes {Xq} the topic: the rest of the sentence says something about it.',
      fr: 'は fait de {Xq} le thème : le reste de la phrase en dit quelque chose.' } },
  が: { label: { en: 'subject', fr: 'sujet' },
    say: { en: 'が marks {Xq} as the subject of {Vq}.', fr: 'が marque {Xq} comme sujet de {Vq}.' } },
  を: { label: { en: 'object', fr: 'objet' },
    say: { en: 'を marks {Xq} as the object: what {Vq} acts on.', fr: 'を marque {Xq} comme objet : ce sur quoi porte {Vq}.' } },
  に: { label: { en: 'time · goal · to', fr: 'moment · but · à' },
    say: { en: 'に points {Vq} at {Xq}: when it happens, where it goes, or who it is for.',
      fr: 'に rattache {Vq} à {Xq} : le moment, la destination ou la personne visée.' },
    senses: {
      time: { en: 'に pins {Vq} to a point in time: {X}. Clock times, dates and weekdays take に; 今日, 明日 and 毎日 do not.',
        fr: 'に place {Vq} à un moment précis : {X}. Heures, dates et jours de la semaine prennent に ; 今日, 明日 et 毎日 non.' },
      goal: { en: 'に marks {Xq} as where {Vq} arrives: the destination.',
        fr: 'に marque {Xq} comme le point d’arrivée de {Vq} : la destination.' },
      being: { en: 'に marks {Xq} as where someone or something is ({V}). For an action done there, Japanese uses で.',
        fr: 'に marque {Xq} comme l’endroit où se trouve quelqu’un ou quelque chose ({V}). Pour une action faite à cet endroit, le japonais emploie で.' },
      person: { en: 'に points {Vq} at {Xq}: the person on the other end.',
        fr: 'に dirige {Vq} vers {Xq} : la personne visée.' },
      adverb: { en: 'に after {Xq} makes an adverb of it: it says how {Vq} is done.',
        fr: 'に après {Xq} en fait un adverbe : il dit comment se fait {Vq}.' },
    } },
  で: { label: { en: 'where · with', fr: 'où · avec' },
    say: { en: 'で marks {Xq} as the place of {Vq}, or the means it uses.',
      fr: 'で marque {Xq} comme le lieu de {Vq}, ou le moyen employé.' },
    senses: {
      place: { en: 'で marks {Xq} as the place where {Vq} is done. To say only that something is there, Japanese uses に.',
        fr: 'で marque {Xq} comme le lieu où se fait {Vq}. Pour dire seulement que quelque chose s’y trouve, le japonais emploie に.' },
      vehicle: { en: 'で marks {Xq} as the way you travel: by {X}.', fr: 'で marque {Xq} comme le moyen de transport : en {X}.' },
      tool: { en: 'で marks {Xq} as the tool {Vq} is done with.', fr: 'で marque {Xq} comme l’outil avec lequel se fait {Vq}.' },
      language: { en: 'で marks {Xq} as the language used: in {X}.', fr: 'で marque {Xq} comme la langue employée : en {X}.' },
    } },
  へ: { label: { en: 'toward', fr: 'vers' },
    say: { en: 'へ points {Vq} toward {Xq}: the direction it goes in.', fr: 'へ oriente {Vq} vers {Xq} : la direction du mouvement.' } },
  と: { label: { en: 'with · and', fr: 'avec · et' },
    say: { en: 'と links {Xq} to the rest: “and” between two nouns, “with” for who {Vq} is done with.',
      fr: 'と relie {Xq} au reste : « et » entre deux noms, « avec » pour dire avec qui se fait {Vq}.' } },
  も: { label: { en: 'too', fr: 'aussi' },
    say: { en: 'も stands where は or が would, and adds “too”: {Xq} as well.',
      fr: 'も prend la place de は ou de が et ajoute « aussi » : {Xq} aussi.' } },
  の: { label: { en: '’s · of', fr: 'de' }, next: true,
    say: { en: 'の links {Xq} to {Yq}: the {Y} that belongs to, or is described by, {X}.',
      fr: 'の relie {Xq} à {Yq} : le {Y} qui appartient à {X}, ou que {X} décrit.' } },
  や: { label: { en: 'and so on', fr: 'entre autres' }, next: true,
    say: { en: 'や lists {Xq} and {Yq} as examples: “A, B and others like them”.',
      fr: 'や cite {Xq} et {Yq} en exemples : « A, B, entre autres ».' } },
  か: { label: { en: 'question', fr: 'question' }, final: true,
    say: { en: 'か at the end turns the sentence into a question.', fr: 'か en fin de phrase en fait une question.' } },
  ね: { label: { en: 'isn’t it?', fr: 'n’est-ce pas ?' }, final: true,
    say: { en: 'ね at the end asks the listener to agree: “…, isn’t it?”', fr: 'ね en fin de phrase cherche l’accord de l’autre : « …, n’est-ce pas ? »' } },
  よ: { label: { en: 'you know', fr: 'tu sais' }, final: true,
    say: { en: 'よ at the end tells the listener something new: “…, you know.”', fr: 'よ en fin de phrase apprend quelque chose à l’autre : « …, tu sais. »' } },
  から: { label: { en: 'from', fr: 'depuis' },
    say: { en: 'から marks {Xq} as the starting point of {Vq}: from {X}.', fr: 'から marque {Xq} comme point de départ de {Vq} : depuis {X}.' } },
  まで: { label: { en: 'until · up to', fr: 'jusqu’à' },
    say: { en: 'まで marks {Xq} as the end point of {Vq}: up to {X}.', fr: 'まで marque {Xq} comme point d’arrivée de {Vq} : jusqu’à {X}.' } },
  より: { label: { en: 'than', fr: 'que' },
    say: { en: 'より marks {Xq} as the point of comparison: than {X}.', fr: 'より marque {Xq} comme terme de comparaison : que {X}.' } },
  です: { label: { en: 'is', fr: 'est' }, copula: true,
    say: { en: 'です after {Xq} says what the subject is, politely.', fr: 'です après {Xq} dit ce qu’est le sujet, poliment.' } },
  だ: { label: { en: 'is', fr: 'est' }, copula: true,
    say: { en: 'だ after {Xq} says what the subject is, in plain speech.', fr: 'だ après {Xq} dit ce qu’est le sujet, en langage courant.' } },
  だけ: { label: { en: 'only', fr: 'seulement' } },
  しか: { label: { en: 'only (+ not)', fr: 'ne… que' } },
  くらい: { label: { en: 'about', fr: 'environ' } },
  ぐらい: { label: { en: 'about', fr: 'environ' } },
  ごろ: { label: { en: 'around', fr: 'vers' } },
  など: { label: { en: 'and so on', fr: 'etc.' } },
  ずつ: { label: { en: 'each', fr: 'chacun' } },
}

// The one sense a particle has in a sentence, read from the word it marks
// and, for に, the verb it ties it to (plan 210b). The catalogue's で
// is "location of an action, or means/method"; 駅で says only the first.
const words = s => new Set(s.split(/\s+/).filter(Boolean))
const PLACES = words(`駅 学校 家 うち 部屋 公園 店 図書館 会社 病院 銀行 台所 教室 大学 喫茶店
  レストラン デパート スーパー コンビニ 町 国 東京 日本 京都 大阪 海 山 川 庭 前 後ろ 中 外 上 下 横 隣 近く
  食堂 映画館 美術館 郵便局 空港 ホテル 道 プール 池 外国 田舎 事務所 会議室 工場 市場 売り場
  玄関 入り口 出口 交差点 角 窓 机 テーブル 椅子 いす ベッド 箱 かばん 冷蔵庫 本屋 八百屋 花屋
  パン屋 そこ ここ あそこ どこ 階 ドア 寮 アパート マンション 会場 島 村 地方 都会 世界 市 県 店内 車内 温泉`)
const VEHICLES = words('バス 電車 車 自転車 タクシー 地下鉄 飛行機 船 新幹線 バイク')
const TOOLS = words(`ペン 鉛筆 えんぴつ はし 箸 手 ナイフ フォーク スプーン 電話 メール パソコン
  ボールペン 万年筆 カメラ 携帯 スマホ はさみ カード 現金 クレジットカード`)
const LANGS = words('日本語 英語 フランス語 中国語 韓国語 スペイン語 ドイツ語')
const PEOPLE = words(`友だち 友達 ともだち 先生 母 父 兄 姉 弟 妹 子ども 子供 こども 人 彼 彼女 医者
  学生 家族 両親 お母さん お父さん お兄さん お姉さん 店員 皆 みんな 私 わたし 僕 ぼく
  あなた 社長 部長 課長 先輩 後輩 同僚 客 お客さん 息子 娘 夫 妻 祖母 祖父 おばあさん おじいさん 誰 だれ`)
const PERSON_END = /(さん|先生|くん|君|ちゃん|様|さま)$/
const TIME_END = /([0-9０-９一二三四五六七八九十百半何]+(時|分|日|月)|[0-9０-９]+年|曜日|よう日|ようび|時間目)$/
const TIMES = words(`朝 晩 夜 昼 夕方 週末 午前 午後 夏 冬 春 秋 夏休み 冬休み 休み 誕生日 正月
  日 時 とき 頃 ころ 季節 来月 先月 来週 先週 来年 去年 今年 今月 今週 際 時代`)
// に that makes an adverb of the word before it (いっしょに, 静かに).
const ADVERBIAL = words('一緒 いっしょ 本当 特 急 静か 綺麗 きれい 上手 丁寧 簡単 自由 大切 元気 真剣 熱心 正直 確か 非常 十分 自然 別')
// The verb after に: going (行きます) or being (あります), read from its
// lemma where the row has one, else from its written form, as a
// lesson's rows are.
const GOING = /^(行|来|帰|入|着|乗|戻|登|届|出かけ|いく|いき|いっ|くる|き(ます|まし|ません|て|た))/
const BEING = /^(あ(る|り|っ|れ)|い(る|ま|た|て|な)|居|有|在|住|残)/
// なる takes に for what something becomes (医者になる): none of the senses.
const BECOMING = /^(な(る|り|っ|ら|れ)|成)/
const PASSIVE = p => /受身|使役/.test(p)
const formsOf = row => (row ? [row.t, ...(row.lemma || [])].filter(Boolean) : [])
const any = (row, test) => formsOf(row).some(test)
// A verb by its lemma's own spelling (きまる is 決まる, not 来ます), or as
// written where the row has no lemma.
const verbIs = (row, re) => re.test(row?.lemma?.[0] || row?.t || '')

/** Which of a particle's senses this sentence uses, or null. `phrase`
 *  is the phrase it marks as written (七時), `hostRow` its last word,
 *  `verbRow` the verb it ties it to. The tables are short on purpose: a
 *  word not in them keeps the general line, which is never wrong, where
 *  a guess could be. */
export function senseOf(particle, phrase, hostRow, verbRow) {
  const host = set => any(hostRow, w => set.has(w))
  const isVerb = verbRow?.pos === 'verb'
  if (particle === 'で') {
    if (host(VEHICLES)) return 'vehicle'
    if (host(TOOLS)) return 'tool'
    if (host(LANGS)) return 'language'
    if (host(PLACES)) return 'place'
    return null
  }
  if (particle !== 'に' || verbIs(verbRow, BECOMING)) return null
  if (host(ADVERBIAL)) return 'adverb'
  if (host(TIMES) || any(hostRow, w => TIME_END.test(w)) || TIME_END.test(phrase || '')) return 'time'
  if (!isVerb) return null
  const being = verbIs(verbRow, BEING)
  // The agent of a passive or a causative is no receiver (先生に叱られた),
  // and 私に兄がいる says who has, not who receives.
  if ((host(PEOPLE) || PERSON_END.test(hostRow?.t || '')) && !being && !(verbRow.g || []).some(PASSIVE)) return 'person'
  if (host(PLACES)) {
    if (verbIs(verbRow, GOING)) return 'goal'
    if (being) return 'being'
  }
  return null
}

const SAY = {
  chain: { en: '{Lq} becomes {R}: {meaning}.', fr: '{Lq} devient {R} : {meaning}.' },
  span: { en: '{R}: {meaning}.', fr: '{R} : {meaning}.' },
  after: { en: 'Here {R} comes after {Xq}: {meaning}.', fr: 'Ici, {R} vient après {Xq} : {meaning}.' },
}

// Two particles side by side, each keeping its own job (plan 210b). Only
// pairs that are not a pattern of their own (のは, でも, とは限らない
// are points of the catalogue) and only after a noun, where the slots
// below always read true. {X} the noun, {Y} the noun the の pairs
// describe.
export const STACKS = {
  には: { en: 'に ties {Xq} to the verb as it would alone; は then makes it the topic. Together, “as for {X}…”: the sentence sets {X} apart and says what holds for it, often in contrast with others.',
    fr: 'に rattache {Xq} au verbe comme il le ferait seul ; は en fait ensuite le thème. Ensemble, « pour ce qui est de {X}… » : la phrase met {X} à part et dit ce qui vaut pour lui, souvent par contraste avec d’autres.' },
  では: { en: 'で marks {Xq} as where or how something happens; は makes it the topic: “at {X}, as for {X}…”, often in contrast with other places.',
    fr: 'で marque {Xq} comme le lieu ou le moyen ; は en fait le thème : « à {X}, en ce qui concerne {X}… », souvent par contraste avec d’autres lieux.' },
  にも: { en: 'に points at {Xq}; も adds “too” or “even”: “to {X} too”.',
    fr: 'に désigne {Xq} ; も ajoute « aussi » ou « même » : « à {X} aussi ».' },
  でも: { en: 'で marks where or how; も adds “too” or “even”: “at {X} too”, “even at {X}”.',
    fr: 'で marque le lieu ou le moyen ; も ajoute « aussi » ou « même » : « à {X} aussi », « même à {X} ».' },
  とは: { en: 'と marks the partner; は makes it the topic: “with {X}, as for {X}…”.',
    fr: 'と marque le partenaire ; は en fait le thème : « avec {X}, en ce qui concerne {X}… ».' },
  とも: { en: 'と marks the partner; も adds “too”: “with {X} as well”.', fr: 'と marque le partenaire ; も ajoute « aussi » : « avec {X} aussi ».' },
  への: { en: 'へ marks the direction; の turns “{X}へ” into a description of {Yq}: the {Y} meant for {X}.',
    fr: 'へ marque la direction ; の fait de « {X}へ » une description de {Yq} : le {Y} à l’intention de {X}.' },
  での: { en: 'で marks the place; の turns “{X}で” into a description of {Yq}: the {Y} that happens at {X}.',
    fr: 'で marque le lieu ; の fait de « {X}で » une description de {Yq} : le {Y} qui a lieu à {X}.' },
  との: { en: 'と marks the partner; の turns “{X}と” into a description of {Yq}: the {Y} with {X}.',
    fr: 'と marque le partenaire ; の fait de « {X}と » une description de {Yq} : le {Y} avec {X}.' },
  からの: { en: 'から marks the starting point; の turns “{X}から” into a description of {Yq}: the {Y} from {X}.',
    fr: 'から marque le point de départ ; の fait de « {X}から » une description de {Yq} : le {Y} depuis {X}.' },
  までの: { en: 'まで marks the end point; の turns “{X}まで” into a description of {Yq}: the {Y} up to {X}.',
    fr: 'まで marque le point d’arrivée ; の fait de « {X}まで » une description de {Yq} : le {Y} jusqu’à {X}.' },
  からも: { en: 'から marks the starting point; も adds “too”: “from {X} as well”.', fr: 'から marque le point de départ ; も ajoute « aussi » : « depuis {X} aussi ».' },
  からは: { en: 'から marks the starting point; は makes it the topic: “from {X} on”, set apart from what came before.',
    fr: 'から marque le point de départ ; は en fait le thème : « à partir de {X} », par contraste avec ce qui précède.' },
  までは: { en: 'まで marks the end point; は makes it the topic: “up to {X}, at least”, in contrast with what lies beyond.',
    fr: 'まで marque la limite ; は en fait le thème : « jusqu’à {X} en tout cas », par contraste avec la suite.' },
  へは: { en: 'へ marks the direction; は makes it the topic: “as for going to {X}…”.', fr: 'へ marque la direction ; は en fait le thème : « pour ce qui est d’aller à {X}… ».' },
  にまで: { en: 'に points at {Xq}; まで adds “as far as”: “even to {X}”.', fr: 'に désigne {Xq} ; まで ajoute « jusqu’à » : « même à {X} ».' },
  だけは: { en: 'だけ means “only”; は makes it the topic: “{X}, at least”, the one thing set apart.',
    fr: 'だけ veut dire « seulement » ; は en fait le thème : « {X}, au moins », la seule chose mise à part.' },
  だけで: { en: 'だけ means “only”; で marks the means: “just with {X}”, {X} alone is enough.',
    fr: 'だけ veut dire « seulement » ; で marque le moyen : « rien qu’avec {X} », {X} suffit.' },
}

// には read with the sentence: for me (私には難しい), at a time, or at a
// place where something is. Any other には keeps the line above.
const STACK_SENSES = {
  には: {
    person: { en: 'に marks {Xq} as the person concerned; は makes it the topic: “for {X}, …”. What follows holds from {X}’s side, perhaps not for others.',
      fr: 'に marque {Xq} comme la personne concernée ; は en fait le thème : « pour {X}, … ». Ce qui suit vaut du point de vue de {X}, peut-être pas pour d’autres.' },
    time: { en: 'に sets the time at {Xq}; は makes it the topic: “at {X}, at least”, setting it apart from other times.',
      fr: 'に fixe le moment à {Xq} ; は en fait le thème : « à {X} en tout cas », par contraste avec d’autres moments.' },
    goal: { en: 'に marks {Xq} as where you go; は makes it the topic: “to {X}, at least…”, often to say not there, or not yet.',
      fr: 'に marque {Xq} comme la destination ; は en fait le thème : « à {X}, en tout cas… », souvent pour dire pas là, ou pas encore.' },
    being: { en: 'に marks {Xq} as where something is; は makes it the topic: “at {X}, there is…”. The sentence opens on the place, then says what is found there.',
      fr: 'に marque {Xq} comme l’endroit où se trouve quelque chose ; は en fait le thème : « à {X}, il y a… ». La phrase part du lieu, puis dit ce qu’on y trouve.' },
  },
  // A question word, then a negative verb: どこにも…ない, 誰にも…ない.
  にも: {
    nowhere: { en: 'に points at {Xq}; も adds “even”. With a negative verb, どこにも means “nowhere”, “not anywhere”.',
      fr: 'に désigne {Xq} ; も ajoute « même ». Avec un verbe négatif, どこにも veut dire « nulle part ».' },
    nobody: { en: 'に points at {Xq}; も adds “even”. With a negative verb, {X}にも means “(to) nobody”, “not to anyone”.',
      fr: 'に désigne {Xq} ; も ajoute « même ». Avec un verbe négatif, {X}にも veut dire « à personne ».' },
  },
}
const NOBODY = words('誰 だれ どなた')
// The predicates after 私には that say how it is for someone.
const FOR_SOMEONE = /^(わか|分か|でき|出来|見え|聞こえ|無理|むり)/

// Kana a learner mixes up, and how to tell them apart.
export const LOOKALIKES = [
  { set: ['ぬ', 'め'], tip: { en: 'ぬ ends in a loop; め does not.', fr: 'ぬ finit par une boucle ; め non.' } },
  { set: ['ね', 'れ', 'わ'], tip: { en: 'One left stroke, three endings: ね loops, れ kicks out, わ curves back in.', fr: 'Même trait à gauche, trois fins : ね fait une boucle, れ repart vers l’extérieur, わ s’enroule.' } },
  { set: ['る', 'ろ'], tip: { en: 'る ends in a loop; ろ does not.', fr: 'る finit par une boucle ; ろ non.' } },
  { set: ['は', 'ほ'], tip: { en: 'ほ has a second bar at the top; は has one.', fr: 'ほ a une seconde barre en haut ; は n’en a qu’une.' } },
  { set: ['き', 'さ'], tip: { en: 'き has two bars; さ has one.', fr: 'き a deux barres ; さ n’en a qu’une.' } },
  { set: ['さ', 'ち'], tip: { en: 'Mirror images: look at which way the bottom curve opens.', fr: 'L’un est le reflet de l’autre : regarde de quel côté s’ouvre la courbe du bas.' } },
  { set: ['い', 'り'], tip: { en: 'In り the right stroke is long and drops below the left one.', fr: 'Dans り, le trait de droite est long et descend sous celui de gauche.' } },
  { set: ['こ', 'に'], tip: { en: 'に has a vertical stroke on the left; こ is only the two bars.', fr: 'に a un trait vertical à gauche ; こ n’a que les deux barres.' } },
  { set: ['あ', 'お'], tip: { en: 'お has a small dot at the upper right; あ does not.', fr: 'お a un petit point en haut à droite ; あ non.' } },
  { set: ['シ', 'ツ'], tip: { en: 'シ: dots on the left, last stroke rises from the bottom. ツ: dots on top, last stroke falls from the top.', fr: 'シ : points à gauche, dernier trait qui monte du bas. ツ : points en haut, dernier trait qui descend du haut.' } },
  { set: ['ソ', 'ン'], tip: { en: 'ソ: dot on top, last stroke falls from the top. ン: dot on the left, last stroke rises from the bottom.', fr: 'ソ : point en haut, dernier trait qui descend. ン : point à gauche, dernier trait qui monte du bas.' } },
  { set: ['ク', 'タ'], tip: { en: 'タ is ク with one more stroke inside.', fr: 'タ, c’est ク avec un trait de plus à l’intérieur.' } },
  { set: ['ウ', 'ワ', 'フ'], tip: { en: 'ウ has a dot on top, ワ a short stroke on the left; フ is a single stroke.', fr: 'ウ a un point en haut, ワ un petit trait à gauche ; フ n’a qu’un trait.' } },
  { set: ['コ', 'ユ'], tip: { en: 'ユ’s bottom bar runs past its side; コ’s corner closes.', fr: 'La barre du bas de ユ dépasse sur le côté ; le coin de コ est fermé.' } },
  { set: ['ノ', 'メ'], tip: { en: 'メ is ノ with a short stroke across it.', fr: 'メ, c’est ノ barré d’un petit trait.' } },
  { set: ['チ', 'テ'], tip: { en: 'テ starts with two flat bars; チ starts with a slanted stroke.', fr: 'テ commence par deux barres plates ; チ par un trait penché.' } },
  { set: ['ア', 'マ'], tip: { en: 'マ ends in a short dot; ア ends in a long stroke falling to the left.', fr: 'マ finit par un petit point ; ア par un long trait qui descend vers la gauche.' } },
  { set: ['ス', 'ヌ'], tip: { en: 'ヌ’s small stroke crosses the sweep; ス’s sits below it.', fr: 'Le petit trait de ヌ croise la grande courbe ; celui de ス reste en dessous.' } },
]

export const lookalikesOf = kana => LOOKALIKES.find(g => g.set.includes(kana)) || null

// ── Reading a sentence's rows ─────────────────────────────────
const isWord = r => r && r.k === 'word'
// A noun, or what heads one in the breakdown (お客さん's お is a prefix).
const NOT_NOUN = new Set(['verb', 'adjective', 'adverb', 'auxiliary', 'conjunction', 'interjection', 'adnominal'])
const isNoun = r => isWord(r) && !NOT_NOUN.has(r.pos)
const isPredicate = r => r && (r.k === 'copula' || (r.k === 'word' && (r.pos === 'verb' || r.pos === 'adjective')))

function prevWord(rows, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (rows[j].k === 'punct') return -1
    if (isWord(rows[j])) return j
  }
  return -1
}
function nextOf(rows, i, test) {
  for (let j = i + 1; j < rows.length; j++) if (test(rows[j])) return j
  return -1
}
/** Where a phrase begins: 駅 alone, 七時 (two nouns side by side), or
 *  駅の前 when の ties a word to it. */
function phraseStart(rows, j) {
  let s = j
  for (;;) {
    if (s >= 1 && isNoun(rows[s - 1]) && isNoun(rows[s])) s -= 1
    else if (s >= 2 && rows[s - 1].t === 'の' && rows[s - 1].k === 'particle' && isWord(rows[s - 2])) s -= 2
    else if (s >= 1 && rows[s].pos === 'suffix' && isWord(rows[s - 1])) s -= 1 // 苦 + さ
    else return s
  }
}
/** The phrase a particle marks, as written (七時, 近所の人), glossed
 *  where it is one word: a gloss strung from several words reads wrong
 *  in one language or the other (sept + heure). */
function hostPhrase(rows, j, glossOf) {
  const run = rows.slice(phraseStart(rows, j), j + 1)
  return { t: run.map(r => r.t).join(''), gloss: run.length === 1 ? glossOf(rows[j]) : '' }
}
// Nouns that end a phrase rather than head it (説明なし, 行くため).
const NOT_HEAD = words('なし 無し ため 為 こと 事 もの 物 よう 様 ほう 方 など')
const heads = r => isNoun(r) && r.pos !== 'suffix' && !any(r, w => NOT_HEAD.has(w))
/** The noun a phrase after `i` is headed by: あいさつ in 丁寧なあいさつ,
 *  never a suffix after it (出張がてら). */
function nextHead(rows, i) {
  let j = nextOf(rows, i, isWord)
  if (j < 0) return -1
  for (;;) {
    if (heads(rows[j + 1])) j += 1
    else if (rows[j + 1]?.t === 'な' && isWord(rows[j + 2])) j += 2 // 丁寧な + あいさつ
    else return j
  }
}
/** A gloss short enough to sit in a sentence: its first sense, no notes. */
const short = g => (g || '').replace(/\([^)]*\)/g, '').split(/[,;]/)[0].replace(/\s+/g, ' ').trim()
/** A pattern's pieces as written: contiguous rows joined, a gap as …. */
function runs(rows, covered) {
  let out = ''
  covered.forEach((i, n) => { out += (n && i !== covered[n - 1] + 1 ? '…' : '') + rows[i].t })
  return out
}

/** The predicate a particle ties its word to: the next verb, adjective
 *  or copula, past an adjective that only describes what follows it
 *  (重い荷物, ひどく怒られた) and the に of an adverb (丁寧に). */
function targetOf(rows, i) {
  for (let j = i + 1; j < rows.length; j++) {
    const x = rows[j]
    if (!isPredicate(x)) continue
    if (x.k === 'copula' && (x.t === 'に' || x.t === 'な')) continue
    if (x.k === 'word' && x.pos === 'adjective' && isWord(rows[j + 1])) continue
    if (x.k === 'word' && rows[j + 1]?.t === '方') continue // 着方: a noun, not the verb
    return j
  }
  return -1
}

/** One particle at `at`: its chunk, its line, and whether the sentence
 *  settled its sense. A row that also carries a pattern of its own
 *  (人にしたら, 兄にひきかえ) keeps the general line. */
function particleChunk(rows, at, p, lang, glossOf, item, q) {
  const r = rows[at]
  const role = ROLES[r.t]
  const host = prevWord(rows, at)
  if (role.final) {
    const items = host >= 0 ? [item(host, false), item(at, true)] : [item(at, true)]
    return { items, line: role.say[lang] }
  }
  if (host < 0) return null
  const items = []
  for (let j = phraseStart(rows, host); j <= at; j++) if (rows[j].k !== 'punct') items.push(item(j, j === at))
  const X = hostPhrase(rows, host, glossOf)
  const slots = { X: X.t, Xq: quoted(X.t, X.gloss) }
  if (role.copula) return { items, line: fill(role.say[lang], slots) }
  const to = role.next ? nextHead(rows, at) : targetOf(rows, at)
  const target = to >= 0 ? to : nextOf(rows, at, isWord)
  if (target < 0) return null
  if (target > at + 1) items.push({ gap: true })
  items.push(item(target, false))
  Object.assign(slots, { V: rows[target].t, Vq: q(target), Y: rows[target].t, Yq: q(target) })
  const owned = (r.g || []).some(x => x !== r.t && x !== p && !ROLES[x])
  let key = r.k === 'particle' && !owned && senseOf(r.t, X.t, rows[host], rows[target])
  // 学生には手が出ない is “for students”: には's own slide says it.
  if (key === 'person' && rows[at + 1]?.t === 'は') key = null
  const sense = key && role.senses?.[key]
  return sense ? { items, line: fill(sense[lang], slots), sensed: true } : { items, line: fill(role.say[lang], slots) }
}

/**
 * How the point works in this sentence: the few words it acts on, each
 * with a label (its gloss, or a particle's role), the point's own lit,
 * and one line saying it with those words. `glossOf(row)` is the word's
 * first sense in the reader's language. Null where nothing in the rows
 * carries the point.
 */
export function howItWorks(rows, p, meaningText, lang, glossOfRow) {
  const glossOf = row => short(glossOfRow(row))
  // The line ends on its own full stop, not on the catalogue's "…".
  const meaning = String(meaningText || '').replace(/[\s.…]+$/, '')
  const covered = rows.map((r, i) => ((r.g || []).includes(p) || r.lit ? i : -1)).filter(i => i >= 0)
  if (!covered.length) return null
  const first = covered[0]
  const r = rows[first]
  const label = row => (row.k === 'word' ? glossOf(row) : ROLES[row.t]?.label?.[lang] || '')
  const item = (i, lit) => ({ t: rows[i].t, label: label(rows[i]), lit, line: rows[i].k === 'word' ? 'vocab' : 'grammar' })
  const q = i => quoted(rows[i].t, rows[i].k === 'word' ? glossOf(rows[i]) : '')
  const role = ROLES[r.t]

  // A particle or the copula: the word it marks, and what it ties it to.
  // Where the sentence uses it twice (駅で…電車で), the first instance
  // whose sense the sentence settles, else the first.
  const alone = covered.every(i => rows[i].t === r.t && (rows[i].k === 'particle' || rows[i].k === 'copula'))
  if (role?.say && alone) {
    const chunks = covered.map(i => particleChunk(rows, i, p, lang, glossOf, item, q)).filter(Boolean)
    const pick = chunks.find(c => c.sensed) || chunks[0]
    return pick ? { type: 'chunk', items: pick.items, line: pick.line } : null
  }

  // A form built on a verb or an adjective: from its dictionary form.
  if (isWord(r) && r.lemma && (r.pos === 'verb' || r.pos === 'adjective')) {
    const run = [first]
    while (covered.includes(run[run.length - 1] + 1)) run.push(run[run.length - 1] + 1)
    const R = run.map(i => rows[i].t).join('')
    const L = r.lemma[0]
    return {
      type: 'chain',
      from: { t: L, label: glossOf(r) },
      to: run.map(i => ({ t: rows[i].t, label: i === first ? '' : label(rows[i]), lit: true })),
      line: fill(SAY.chain[lang], { Lq: quoted(L, glossOf(r)), R, meaning }),
    }
  }

  // Anything else (ので, より…のほうが, のは…だ): the pattern's pieces, the
  // word before them, a gap where the sentence runs on between them. The
  // pieces carry no labels of their own: の in ので is no possessive.
  const groups = []
  for (const i of covered) {
    const last = groups[groups.length - 1]
    if (last && i - last[last.length - 1] <= 3) last.push(i)
    else groups.push([i])
  }
  const items = []
  const before = prevWord(rows, first)
  const X = before >= 0 && !covered.includes(before) ? hostPhrase(rows, before, glossOf) : null
  if (X) items.push({ t: X.t, label: X.gloss, lit: false, line: 'vocab' })
  groups.forEach((g, n) => {
    if (n) items.push({ gap: true })
    for (let j = g[0]; j <= g[g.length - 1]; j++) {
      if (rows[j].k === 'punct') continue
      const lit = covered.includes(j)
      items.push(lit ? { t: rows[j].t, label: '', lit: true, line: 'grammar' } : item(j, false))
    }
  })
  const slots = { R: runs(rows, covered), meaning, Xq: X ? quoted(X.t, X.gloss) : '' }
  return { type: 'chunk', items, line: fill((X ? SAY.after : SAY.span)[lang], slots) }
}

/** Whether the clause after `i` ends negative (行きたくない, 頼らず). */
function negativeAfter(rows, i) {
  let text = ''
  for (let j = i + 1; j < rows.length && rows[j].k !== 'punct'; j++) text += rows[j].t
  return /(ない|なかっ|ず|ません|ぬ)/.test(text)
}

// A particle's sense in a word, for the breakdown (plan 210l): 駅で is
// "place", where its general label says "where · with".
const SENSE_LABEL = {
  で: { place: { en: 'place', fr: 'lieu' }, vehicle: { en: 'by (transport)', fr: 'en (transport)' },
    tool: { en: 'with (tool)', fr: 'avec (outil)' }, language: { en: 'in (language)', fr: 'en (langue)' } },
  に: { time: { en: 'time', fr: 'moment' }, goal: { en: 'destination', fr: 'destination' },
    being: { en: 'location', fr: 'lieu' }, person: { en: 'to (someone)', fr: 'à (quelqu’un)' },
    adverb: { en: 'makes an adverb', fr: 'fait un adverbe' } },
}
/** What the particle at `at` does here, in a word or two: its sense
 *  where the sentence settles it, else its role; null for a row that is
 *  no particle the table knows. */
export function particleLabel(rows, at, lang) {
  const r = rows[at]
  const role = r && ROLES[r.t]
  // The copula で of 学生で is no “where · with”: a role's kind must match.
  if (!role || r.k !== (role.copula ? 'copula' : 'particle')) return null
  const host = prevWord(rows, at)
  // After a verb or an adjective から is “because”, と “if”, が “but”:
  // the role holds after a noun only.
  if (!role.final && !role.copula && (host < 0 || !isNoun(rows[host]) || host !== at - 1)) return null
  let key = null
  if (SENSE_LABEL[r.t] && host >= 0 && r.k === 'particle') {
    const to = targetOf(rows, at)
    key = senseOf(r.t, hostPhrase(rows, host, () => '').t, rows[host], rows[to >= 0 ? to : nextOf(rows, at, isWord)])
    if (key === 'person' && rows[at + 1]?.t === 'は') key = null
  }
  return (key && SENSE_LABEL[r.t][key]?.[lang]) || role.label[lang]
}

// What a particle or a form of だ does where no point is written on it
// and the noun-only roles above do not hold: after a verb, an adjective,
// an adverb or another particle (plan 215e). Only the uses the sentence
// settles by its shape: が before a comma after a clause is "but", まで
// after a verb "until", と before a verb of saying "that". A row none of
// them settles is left bare, never named by its part of speech; the
// copula で, which the tokenizer also gives to the particle (店で), is
// always left bare.
const CLAUSE_LABEL = {
  but: { en: 'but', fr: 'mais' },
  because: { en: 'because', fr: 'parce que' },
  after: { en: 'after', fr: 'après' },
  until: { en: 'until', fr: 'jusqu’à ce que' },
  even: { en: 'even · as far as', fr: 'même · jusqu’à' },
  quote: { en: 'that (quoting)', fr: 'que (citation)' },
  when: { en: 'when · if', fr: 'quand · si' },
  tryTo: { en: '(trying) to', fr: '(chercher à)' },
  so: { en: 'so (much)', fr: 'à ce point' },
  how: { en: 'how (much)', fr: 'à quel point' },
  about: { en: 'about', fr: 'environ' },
  extent: { en: 'so … that', fr: 'au point de' },
  possible: { en: 'as … as possible', fr: 'autant que possible' },
  like: { en: 'such a thing as', fr: 'une chose comme' },
  just: { en: 'just · merely', fr: 'juste' },
  topic: { en: 'topic · contrast', fr: 'thème · contraste' },
  too: { en: 'too · even', fr: 'aussi · même' },
  purpose: { en: '(in order) to', fr: 'pour' },
  describes: { en: 'links it to the noun', fr: 'le relie au nom' },
  necessarily: { en: '(必ずしも) not necessarily', fr: '(必ずしも) pas forcément' },
}
// The verbs a quotation と stands before (言う, 思う, 聞く ...), by lemma.
const SAYING = /^(言|思|聞|考|分か|わか|書|答|伝|叫|話|感じ|信じ|気付|知|いう|おもう|きく)/
// に after a verb's stem, before a verb of going: what one goes to do (見に来る).
const GOING_TO = /^(行|来|帰|参|まい|出かけ|いく|いき|いっ|くる)/
// The adverbs a form of だ makes of a word (急に, 安全に): the particle's own and a few more.
const ADVERB_STEMS = new Set([...ADVERBIAL, ...words('安全 慎重 誠実 正確 どんな 適当 積極的 具体的 自然 必死 素直 無事')])
const NUMERAL = /[0-9０-９一二三四五六七八九十百千万何数]/
export function clauseLabel(rows, at, lang) {
  const r = rows[at]
  const prev = rows[at - 1]
  const next = rows[at + 1]
  if (!r || !prev || r.k === 'word' || prev.k === 'punct') return null
  const pv = prev.k === 'word' ? prev.pos : prev.k
  const clause = pv === 'verb' || pv === 'adjective' || pv === 'auxiliary' || prev.k === 'copula'
  const key = (() => {
    if (r.k === 'copula') {
      if (r.t === 'に') return ADVERB_STEMS.has(prev.t) ? 'adverb' : null
      // な before the noun it describes (丁寧なあいさつ), else the copula's is (便利なので).
      if (r.t === 'な') return next?.k === 'word' && (next.pos === 'noun' || next.pos === 'prefix') ? 'describes' : 'is'
      return null
    }
    if (r.k !== 'particle') return null
    switch (r.t) {
      case 'が': return clause && next?.t === '、' ? 'but' : null
      case 'から': return clause ? (/[てで]$/.test(prev.t) ? 'after' : 'because') : null
      case 'まで': return pv === 'verb' ? 'until' : prev.t === 'に' ? 'even' : null
      case 'と': {
        if (pv === 'adverb') return 'adverb'
        if (!clause) return null
        // The volitional and と: what one sets out to do (謝ろうと).
        if (pv === 'verb' && /[おこそとのほもよろごぞどぼぽ]う$/.test(prev.t)) return 'tryTo'
        const said = next?.t === 'は' || next?.t === 'も' ? rows[at + 2] : next
        if (said?.pos === 'verb' && verbIs(said, SAYING)) return 'quote'
        if (next?.t === 'の' && rows[at + 2]?.t === 'こと') return 'quote'
        return pv === 'verb' && next?.t === '、' ? 'when' : null
      }
      case 'ほど':
        if (/^(これ|それ|あれ)$/.test(prev.t)) return 'so'
        if (prev.t === 'どれ') return 'how'
        if (pv === 'verb') return 'extent'
        return NUMERAL.test(prev.t) ? 'about' : null
      case 'だけ': return prev.t === 'できる' ? 'possible' : pv === 'verb' ? 'only' : null
      case 'など': return pv === 'verb' ? 'like' : null
      case 'くらい': case 'ぐらい': return pv === 'verb' ? 'just' : null
      case 'は': return 'topic'
      // よりも only stresses より, and も同然 is "as good as": both left bare.
      case 'も': return prev.t === 'より' || next?.t === '同然' ? null : 'too'
      case 'より': return 'than'
      case 'に':
        if (pv === 'adverb') return 'adverb'
        return pv === 'verb' && next?.pos === 'verb' && verbIs(next, GOING_TO) ? 'purpose' : null
      case 'の': return pv === 'adverb' || prev.t === 'して' ? 'of' : null
      case 'しも': return prev.t === '必ず' ? 'necessarily' : null
      default: return null
    }
  })()
  if (!key) return null
  if (key === 'adverb') return SENSE_LABEL.に.adverb[lang]
  if (key === 'only') return ROLES.だけ.label[lang]
  if (key === 'than') return ROLES.より.label[lang]
  if (key === 'of') return ROLES.の.label[lang]
  if (key === 'is') return ROLES.だ.label[lang]
  return CLAUSE_LABEL[key][lang]
}

/**
 * The stacked particles of a sentence (には, への ...): the pairs that are
 * not a pattern of their own, standing after a noun, that STACKS knows.
 */
export function stacksIn(rows, lang, glossOfRow) {
  const glossOf = row => short(glossOfRow(row))
  const out = []
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1]
    if (a.k !== 'particle' || b.k !== 'particle') continue
    const key = a.t + b.t
    const text = STACKS[key]?.[lang]
    if (!text) continue
    // A pair the catalogue teaches as one point (のは, でも ...) is that point's.
    const own = new Set([a.t, b.t])
    const shared = (a.g || []).filter(p => (b.g || []).includes(p) && !own.has(p))
    if (shared.length) continue
    const host = prevWord(rows, i)
    if (host < 0 || !isNoun(rows[host])) continue
    const next = key.endsWith('の') ? nextHead(rows, i + 1) : nextOf(rows, i + 1, isWord)
    if (key.endsWith('の') && next < 0) continue
    // 住民への事前の説明: which noun the pair describes is the reader's
    // call (an explanation, not a 事前), so the slide does not guess.
    if (key.endsWith('の') && rows[next + 1]?.t === 'の' && rows[next + 1].k === 'particle' && heads(rows[next + 2])) continue
    const X = hostPhrase(rows, host, glossOf)
    const pred = rows[targetOf(rows, i + 1)]
    // Not every pair is two particles: 今にも is “at any moment”, 往復とも
    // “both ways”, and と before 言う or 思う quotes (専門家とは言わない).
    if (key === 'にも' && X.t === '今') continue
    if (key === 'とも' && !(any(rows[host], w => PEOPLE.has(w)) || PERSON_END.test(X.t))) continue
    if (key.startsWith('と') && verbIs(pred, /^(言|云|いう|いわ|思|おも|考え|かんがえ|呼|よ[ぶば])/)) continue
    let sense = STACK_SENSES[key] && senseOf(a.t, X.t, rows[host], pred)
    // 友だちには会った is “as for friends, I met them”: “for {X}” only
    // over an adjective or a verb of ability (私には難しい, わからない).
    if (sense === 'person' && !(pred && (pred.pos === 'adjective' || any(pred, v => FOR_SOMEONE.test(v))))) sense = null
    if (key === 'にも') sense = !negativeAfter(rows, i + 1) ? null : X.t === 'どこ' ? 'nowhere' : NOBODY.has(X.t) ? 'nobody' : null
    const slots = {
      X: X.t, Xq: quoted(X.t, X.gloss),
      Y: next >= 0 ? rows[next].t : '', Yq: next >= 0 ? quoted(rows[next].t, glossOf(rows[next])) : '',
    }
    out.push({
      key,
      parts: [a, b].map(x => ({ t: x.t, label: ROLES[x.t]?.label?.[lang] || '' })),
      host: { t: X.t, label: X.gloss },
      next: key.endsWith('の') && next >= 0 ? { t: rows[next].t, label: glossOf(rows[next]) } : null,
      line: fill(STACK_SENSES[key]?.[sense]?.[lang] || text, slots),
    })
  }
  return out
}
