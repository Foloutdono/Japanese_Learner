// ── 会話 — a whole scene, for the tests that measure the talk (plan 221) ──
// The bank's N3 apartment hunt (backend/content/conversation/N3.json),
// six exchanges and its last word, in French, shaped as
// GET /api/conversation/scenario serves it. A scene this long is what
// pushed the replies under the fold, so the screens' layout tests ride
// it rather than a two-line sketch. Furigana are stood in for: one
// reading of two kana over every kanji, the backend's one-kanji parts,
// which is what gives a line its real height.

const KANJI = /[一-鿿々]/
const parts = jp => [...jp].map((text, word) => (KANJI.test(text) ? { text, reading: 'かな', word } : { text }))
const said = (jp, translation) => ({ jp, parts: parts(jp), translation })
const reply = (jp, translation, note, right) => ({ jp, parts: parts(jp), translation, note, right })

// [their line, its translation], [the reply, its rōmaji, its translation, its note], [[a wrong reply, its translation, why]]
const TURNS = [
  [
    ["いらっしゃいませ。どのようなお部屋をお探しですか。", "Bienvenue. Quel genre de logement cherchez-vous ?"],
    ["一人で住むので、ワンルームを探しています。", "hitori de sumu node, wanruumu o sagashite imasu", "C'est pour une personne, alors je cherche un studio.", "「〜ので」 donne ta raison, et 「探しています」 dit ce que tu cherches."],
    [
      ["一人で住むのに、ワンルームを探しています。", "Bien que ce soit pour une personne, je cherche un studio.", "「のに」 marque une opposition (bien que) et change ta raison en contradiction ; une raison se donne avec 「ので」."],
      ["ワンルームを見つけています。", "J'ai trouvé un studio.", "「見つける」, c'est trouver : 「見つけています」 dit que tu en as déjà un ; chercher se dit 「探す」."],
    ],
  ],
  [
    ["ご予算はどのくらいですか。", "Et quel est votre budget ?"],
    ["家賃は七万円までにしたいです。", "yachin wa nanaman en made ni shitai desu", "J'aimerais un loyer de soixante-dix mille yens maximum.", "「まで」 fixe le plafond, et 「〜にしたいです」 dit que c'est la limite que tu choisis."],
    [
      ["家賃は月七万円しか払いたいです。", "Je veux payer seulement soixante-dix mille yens de loyer par mois.", "「しか」 ne s'emploie qu'avec un verbe à la forme négative (「七万円しか払えません」) : 「しか払いたいです」 ne tient pas."],
      ["七万円までの部屋を貸したいです。", "Je voudrais mettre en location un appartement à soixante-dix mille yens maximum.", "「貸す」, c'est ce que fait le propriétaire qui met en location ; toi qui cherches un logement, tu 「借りる」."],
    ],
  ],
  [
    ["駅からは、歩いて何分ぐらいがいいですか。", "Vous voulez être à combien de minutes à pied de la gare ?"],
    ["十分以内だと助かります。", "juppun inai da to tasukarimasu", "Dix minutes maximum, ça m'arrangerait.", "「以内」 veut dire « pas plus de », et 「〜だと助かります」 dit poliment que ça te faciliterait la vie."],
    [
      ["十分以内だと助けます。", "Si c'est à moins de dix minutes, j'aiderai.", "「助けます」 veut dire que tu vas aider quelqu'un ; pour dire que ça t'aiderait, le verbe est 「助かります」."],
      ["駅から歩いて来ました。", "J'ai fait le trajet à pied depuis la gare.", "「歩いて来ました」 raconte ton trajet d'aujourd'hui ; l'agent te demandait à quelle distance de la gare tu veux habiter."],
    ],
  ],
  [
    ["ほかに何かご希望はありますか。", "Vous avez d'autres souhaits ?"],
    ["二階以上で、明るい部屋がいいです。", "nikai ijou de, akarui heya ga ii desu", "Un logement lumineux, et pas au rez-de-chaussée.", "「二階以上」, c'est le deuxième niveau ou plus haut, le rez-de-chaussée comptant pour le premier : tout sauf le rez-de-chaussée."],
    [
      ["明るい部屋をほしがっています。", "Il veut un logement lumineux.", "「ほしがる」 dit ce que veut quelqu'un d'autre ; ton propre souhait se dit 「〜がいいです」 ou 「ほしいです」."],
      ["二階以上で、住みにくい部屋がいいです。", "Un logement difficile à habiter, et pas au rez-de-chaussée.", "「〜にくい」 rend une action difficile : 「住みにくい」 demande un logement où il est difficile de vivre ; facile à habiter, c'est 「住みやすい」."],
    ],
  ],
  [
    ["ご希望に合うお部屋が一つございます。今日、ご覧になりますか。", "J'ai un appartement qui correspond à vos critères. Vous voulez le visiter aujourd'hui ?"],
    ["はい、ぜひ見せてください。", "hai, zehi misete kudasai", "Oui, j'aimerais beaucoup le voir.", "「見せてください」 demande qu'on te montre l'appartement, et 「ぜひ」 rend le oui enthousiaste."],
    [
      ["はい、ぜひ今日ご覧になります。", "Oui, je daignerai le voir aujourd'hui.", "「ご覧になる」 honore celui qui regarde et ne s'emploie jamais pour soi ; pour toi, 「見せてください」 ou 「拝見します」."],
      ["はい、ぜひその部屋を見てください。", "Oui, regardez donc cet appartement, je vous en prie.", "「見てください」 demande à l'agent de le regarder ; toi, tu veux qu'on te le montre : 「見せてください」."],
    ],
  ],
  [
    ["では、何時ごろがよろしいですか。", "Alors, à quelle heure cela vous arrangerait ?"],
    ["午後三時ごろでもいいですか。", "gogo sanji goro demo ii desu ka", "Vers quinze heures, ça irait ?", "「〜でもいいですか」 propose une heure en laissant l'agent libre de dire non."],
    [
      ["三時間ぐらいかかります。", "Ça prend environ trois heures.", "「三時間」 est une durée, trois heures ; l'agent te demandait à quelle heure, 「何時」."],
      ["午後三時ごろに見ました。", "Je l'ai vu vers quinze heures.", "「見ました」 est au passé : ça dit que tu as déjà vu l'appartement, pas quand tu veux le voir."],
    ],
  ],
]

export const LONG_SCENE = {
  id: "apartment-hunt",
  level: 'N3',
  place: { jp: "不動産屋", parts: parts("不動産屋"), name: "Agence immobilière" },
  title: "À la recherche d'un appartement",
  situation: "Tu entres dans une agence immobilière pour trouver un appartement à louer. Un agent t'accueille au comptoir.",
  goal: "Décris l'appartement que tu cherches (ton budget, la distance à la gare) et prends rendez-vous pour une visite.",
  them: "Agent immobilier",
  register: "polite",
  // The right reply first: a test picks by the reply, not by its place.
  turns: TURNS.map(([them, [jp, romaji, translation, note], wrong]) => ({
    them: said(...them),
    me: { jp, parts: parts(jp), romaji, words: [], translation, note },
    alt: [],
    choices: [reply(jp, translation, note, true), ...wrong.map(([w, tr, why]) => reply(w, tr, why, false))],
  })),
  close: said("かしこまりました。では、三時にこちらでお待ちしております。", "Très bien. Je vous attends donc ici à quinze heures."),
}
