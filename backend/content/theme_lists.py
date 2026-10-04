"""
The thematic vocab decks, written by hand: each theme's words, placed in
its four levels and in order inside each level, easiest first.

One line a word: `漢字 かな | english | français`, or `かな | english |
français` for a word written in kana. scripts/build_theme_db.py resolves
every line to the card the app already has for that word — the deck's
first, else the JMdict pool's — and writes datas/vocab/theme_words.json,
which content/theme_data.py serves. Run `python -m scripts.build_theme_db
--check` after any change here: a word must be written as the deck (or
the pool) stores it, or it would be a second card for a word the learner
already studies.

THE SCALE
---------
The level is the word's place on a difficulty scale inside its theme,
judged rather than counted — not its JLPT level, and not how often a
newspaper prints it:

  basic     the word everybody knows, a child's first words of the theme
            (りんご, apple)
  medium    the everyday word one step further (梨, pear)
  advanced  the word one meets but seldom uses (ざくろ, pomegranate)
  expert    the word only a specialist or an enthusiast reaches for
            (金柑, kumquat)

Within a theme, a word appears once and a gloss once (the meaning ->
word direction and the multiple choice need them apart), and every
gloss names the sense the word has IN the theme (羽 is a feather here,
not a counter).
"""

THEMES = {
    "fruits": {
        "basic": """
            果物 くだもの | fruit | fruit
            りんご | apple | pomme
            バナナ | banana | banane
            蜜柑 みかん | mandarin orange | mandarine
            苺 いちご | strawberry | fraise
            ぶどう | grapes | raisin
            桃 もも | peach | pêche
            メロン | melon | melon
            西瓜 すいか | watermelon | pastèque
            オレンジ | orange | orange
            レモン | lemon | citron
        """,
        "medium": """
            梨 なし | pear | poire
            桜ん坊 さくらんぼ | cherry | cerise
            パイナップル | pineapple | ananas
            柿 かき | persimmon | kaki
            キウイ | kiwi | kiwi
            マンゴー | mango | mangue
            グレープフルーツ | grapefruit | pamplemousse
            ブルーベリー | blueberry | myrtille
            梅 うめ | Japanese plum | prune japonaise
            栗 くり | chestnut | châtaigne
        """,
        "advanced": """
            柘榴 ざくろ | pomegranate | grenade
            無花果 いちじく | fig | figue
            ラズベリー | raspberry | framboise
            パパイヤ | papaya | papaye
            アボカド | avocado | avocat
            ココナッツ | coconut | noix de coco
            杏 あんず | apricot | abricot
            プラム | plum | prune
            柚 ゆず | yuzu | yuzu
            ライチ | lychee | litchi
        """,
        "expert": """
            金柑 きんかん | kumquat | kumquat
            枇杷 びわ | loquat | nèfle du Japon
            ドリアン | durian | durian
            グアバ | guava | goyave
            クランベリー | cranberry | canneberge
            棗 なつめ | jujube | jujube
            ネクタリン | nectarine | nectarine
            パッションフルーツ | passion fruit | fruit de la passion
            ドラゴンフルーツ | dragon fruit | pitaya
            文旦 ぶんたん | pomelo | pomélo
        """,
    },
    "vegetables": {
        "basic": """
            野菜 やさい | vegetable | légume
            トマト | tomato | tomate
            じゃが芋 じゃがいも | potato | pomme de terre
            人参 にんじん | carrot | carotte
            玉ねぎ たまねぎ | onion | oignon
            キャベツ | cabbage | chou
            胡瓜 きゅうり | cucumber | concombre
            とうもろこし | corn | maïs
        """,
        "medium": """
            茄子 なす | eggplant | aubergine
            ピーマン | green pepper | poivron
            南瓜 かぼちゃ | pumpkin | potiron
            レタス | lettuce | laitue
            ほうれん草 ほうれんそう | spinach | épinards
            大根 だいこん | daikon radish | radis daikon
            葱 ねぎ | green onion | ciboule
            さつま芋 さつまいも | sweet potato | patate douce
            豆 まめ | beans | haricots
            茸 きのこ | mushroom | champignon
            白菜 はくさい | Chinese cabbage | chou chinois
            にんにく | garlic | ail
        """,
        "advanced": """
            生姜 しょうが | ginger | gingembre
            セロリ | celery | céleri
            アスパラガス | asparagus | asperge
            カリフラワー | cauliflower | chou-fleur
            萌やし もやし | bean sprouts | germes de soja
            枝豆 えだまめ | green soybeans | edamame
            竹の子 たけのこ | bamboo shoot | pousse de bambou
            椎茸 しいたけ | shiitake mushroom | shiitake
            オクラ | okra | gombo
            ズッキーニ | zucchini | courgette
        """,
        "expert": """
            牛蒡 ごぼう | burdock root | bardane
            蓮根 れんこん | lotus root | racine de lotus
            蕪 かぶ | turnip | navet
            里芋 さといも | taro | taro
            山芋 やまいも | Japanese yam | igname
            春菊 しゅんぎく | edible chrysanthemum | chrysanthème comestible
            ビート | beet | betterave
            韮 にら | garlic chives | ciboulette chinoise
            茗荷 みょうが | myoga ginger | gingembre myoga
            クレソン | watercress | cresson
        """,
    },
    "body_parts": {
        "basic": """
            体 からだ | body | corps
            頭 あたま | head | tête
            顔 かお | face | visage
            目 め | eye | œil
            耳 みみ | ear | oreille
            鼻 はな | nose | nez
            口 くち | mouth | bouche
            歯 は | tooth | dent
            手 て | hand | main
            足 あし | foot, leg | pied, jambe
            お腹 おなか | belly | ventre
            髪 かみ | hair | cheveux
        """,
        "medium": """
            首 くび | neck | cou
            肩 かた | shoulder | épaule
            腕 うで | arm | bras
            指 ゆび | finger | doigt
            背中 せなか | back | dos
            胸 むね | chest | poitrine
            膝 ひざ | knee | genou
            唇 くちびる | lips | lèvres
            舌 した | tongue | langue
            喉 のど | throat | gorge
            爪 つめ | nail | ongle
            血 ち | blood | sang
            心臓 しんぞう | heart | cœur
        """,
        "advanced": """
            肘 ひじ | elbow | coude
            手首 てくび | wrist | poignet
            足首 あしくび | ankle | cheville
            頬 ほお | cheek | joue
            眉 まゆ | eyebrow | sourcil
            額 ひたい | forehead | front
            顎 あご | jaw, chin | mâchoire, menton
            腰 こし | lower back | bas du dos
            骨 ほね | bone | os
            筋肉 きんにく | muscle | muscle
            脳 のう | brain | cerveau
            肺 はい | lungs | poumons
            胃 い | stomach | estomac
            皮膚 ひふ | skin | peau
        """,
        "expert": """
            肝臓 かんぞう | liver | foie
            腎臓 じんぞう | kidney | rein
            腸 ちょう | intestines | intestins
            まぶた | eyelid | paupière
            まつ毛 まつげ | eyelash | cil
            太もも ふともも | thigh | cuisse
            踵 かかと | heel | talon
            背骨 せぼね | spine | colonne vertébrale
            骨盤 こつばん | pelvis | bassin
            鎖骨 さこつ | collarbone | clavicule
            関節 かんせつ | joint | articulation
            神経 しんけい | nerve | nerf
            動脈 どうみゃく | artery | artère
            静脈 じょうみゃく | vein | veine
        """,
    },
    "rooms": {
        "basic": """
            部屋 へや | room | pièce
            台所 だいどころ | kitchen | cuisine
            トイレ | toilet | toilettes
            風呂 ふろ | bath | bain
            玄関 げんかん | entrance | entrée
            庭 にわ | garden | jardin
            窓 まど | window | fenêtre
            ドア | door | porte
        """,
        "medium": """
            寝室 しんしつ | bedroom | chambre
            居間 いま | living room | salon
            廊下 ろうか | corridor | couloir
            階段 かいだん | stairs | escalier
            食堂 しょくどう | dining room | salle à manger
            浴室 よくしつ | bathroom | salle de bain
            和室 わしつ | Japanese-style room | pièce à la japonaise
            洋室 ようしつ | Western-style room | pièce à l'occidentale
            押し入れ おしいれ | closet | placard
            車庫 しゃこ | garage | garage
            ベランダ | balcony | balcon
        """,
        "advanced": """
            屋根裏 やねうら | attic | grenier
            地下室 ちかしつ | basement | sous-sol
            書斎 しょさい | study | bureau
            客間 きゃくま | guest room | chambre d'amis
            物置 ものおき | storeroom | débarras
            洗面所 せんめんじょ | washroom | cabinet de toilette
            縁側 えんがわ | veranda | véranda
            子ども部屋 こどもべや | children's room | chambre d'enfant
            天井 てんじょう | ceiling | plafond
        """,
        "expert": """
            床の間 とこのま | tokonoma | alcôve tokonoma
            土間 どま | earthen floor | sol en terre battue
            茶室 ちゃしつ | tea room | pavillon de thé
            仏間 ぶつま | altar room | pièce de l'autel
            勝手口 かってぐち | kitchen door | porte de service
            中庭 なかにわ | courtyard | cour intérieure
            踊り場 おどりば | landing | palier
            離れ はなれ | detached room | pavillon annexe
        """,
    },
    "buildings": {
        "basic": """
            家 いえ | house | maison
            学校 がっこう | school | école
            病院 びょういん | hospital | hôpital
            駅 えき | station | gare
            店 みせ | shop | magasin
            銀行 ぎんこう | bank | banque
            図書館 としょかん | library | bibliothèque
            郵便局 ゆうびんきょく | post office | bureau de poste
            ホテル | hotel | hôtel
            レストラン | restaurant | restaurant
        """,
        "medium": """
            建物 たてもの | building | bâtiment
            ビル | tall building | immeuble
            寺 てら | temple | temple
            神社 じんじゃ | shrine | sanctuaire shinto
            教会 きょうかい | church | église
            アパート | apartment | appartement
            美術館 びじゅつかん | art museum | musée d'art
            博物館 はくぶつかん | museum | musée
            映画館 えいがかん | cinema | cinéma
            交番 こうばん | police box | poste de police
            工場 こうじょう | factory | usine
            体育館 たいいくかん | gymnasium | gymnase
        """,
        "advanced": """
            城 しろ | castle | château
            塔 とう | tower | tour
            警察署 けいさつしょ | police station | commissariat
            市役所 しやくしょ | city hall | mairie
            大使館 たいしかん | embassy | ambassade
            劇場 げきじょう | theater | théâtre
            倉庫 そうこ | warehouse | entrepôt
            寮 りょう | dormitory | résidence étudiante
            旅館 りょかん | Japanese inn | auberge japonaise
            競技場 きょうぎじょう | stadium | stade
            刑務所 けいむしょ | prison | prison
            消防署 しょうぼうしょ | fire station | caserne de pompiers
        """,
        "expert": """
            宮殿 きゅうでん | palace | palais
            灯台 とうだい | lighthouse | phare
            高層ビル こうそうビル | skyscraper | gratte-ciel
            修道院 しゅうどういん | monastery | monastère
            大聖堂 だいせいどう | cathedral | cathédrale
            納屋 なや | barn | grange
            温室 おんしつ | greenhouse | serre
            小屋 こや | hut | cabane
            天守閣 てんしゅかく | castle keep | donjon
            長屋 ながや | row house | maisons mitoyennes
        """,
    },
    "furniture": {
        "basic": """
            机 つくえ | desk | bureau
            椅子 いす | chair | chaise
            テーブル | table | table
            ベッド | bed | lit
            本棚 ほんだな | bookshelf | bibliothèque
            ソファー | sofa | canapé
        """,
        "medium": """
            家具 かぐ | furniture | meubles
            棚 たな | shelf | étagère
            鏡 かがみ | mirror | miroir
            カーテン | curtain | rideau
            引き出し ひきだし | drawer | tiroir
            布団 ふとん | futon | futon
            戸棚 とだな | cupboard | placard
            たんす | chest of drawers | commode
            ランプ | lamp | lampe
            畳 たたみ | tatami mat | tatami
        """,
        "advanced": """
            座布団 ざぶとん | floor cushion | coussin de sol
            火燵 こたつ | kotatsu | kotatsu
            絨毯 じゅうたん | carpet | tapis
            障子 しょうじ | shoji screen | cloison shoji
            襖 ふすま | sliding door | porte coulissante
            食器棚 しょっきだな | china cabinet | vaisselier
            ベンチ | bench | banc
            ロッカー | locker | casier
        """,
        "expert": """
            鏡台 きょうだい | dressing table | coiffeuse
            屏風 びょうぶ | folding screen | paravent
            仏壇 ぶつだん | household altar | autel bouddhiste
            衝立 ついたて | partition screen | cloison mobile
            掛け軸 かけじく | hanging scroll | rouleau suspendu
            ちゃぶ台 ちゃぶだい | low dining table | table basse
            長椅子 ながいす | settee | banquette
        """,
    },
    "school": {
        "basic": """
            学校 がっこう | school | école
            先生 せんせい | teacher | enseignant
            学生 がくせい | student | étudiant
            教室 きょうしつ | classroom | salle de classe
            宿題 しゅくだい | homework | devoirs
            試験 しけん | exam | examen
            テスト | test | contrôle
            大学 だいがく | university | université
            授業 じゅぎょう | class | cours
        """,
        "medium": """
            生徒 せいと | pupil | élève
            教科書 きょうかしょ | textbook | manuel scolaire
            黒板 こくばん | blackboard | tableau noir
            小学校 しょうがっこう | elementary school | école primaire
            中学校 ちゅうがっこう | junior high school | collège
            高校 こうこう | high school | lycée
            卒業 そつぎょう | graduation | fin d'études
            入学 にゅうがく | entering a school | entrée à l'école
            留学 りゅうがく | study abroad | études à l'étranger
            時間割 じかんわり | timetable | emploi du temps
        """,
        "advanced": """
            幼稚園 ようちえん | kindergarten | maternelle
            校長 こうちょう | principal | directeur d'école
            教授 きょうじゅ | professor | professeur d'université
            奨学金 しょうがくきん | scholarship | bourse d'études
            学期 がっき | term | trimestre
            成績 せいせき | grades | notes
            講義 こうぎ | lecture | cours magistral
            部活 ぶかつ | club activities | club scolaire
            遠足 えんそく | school excursion | sortie scolaire
            受験 じゅけん | taking an entrance exam | passer un concours
        """,
        "expert": """
            通知表 つうちひょう | report card | bulletin scolaire
            学費 がくひ | tuition | frais de scolarité
            修学旅行 しゅうがくりょこう | school trip | voyage scolaire
            単位 たんい | credit | unité de valeur
            論文 ろんぶん | thesis | mémoire
            学位 がくい | degree | diplôme universitaire
            担任 たんにん | homeroom teacher | professeur principal
            学園祭 がくえんさい | school festival | fête de l'école
            偏差値 へんさち | standard score | note standardisée
        """,
    },
    "travel": {
        "basic": """
            旅行 りょこう | trip | voyage
            空港 くうこう | airport | aéroport
            切符 きっぷ | ticket | billet
            地図 ちず | map | carte
            荷物 にもつ | luggage | bagages
            パスポート | passport | passeport
            観光 かんこう | sightseeing | tourisme
            お土産 おみやげ | souvenir | souvenir
        """,
        "medium": """
            予約 よやく | reservation | réservation
            出発 しゅっぱつ | departure | départ
            到着 とうちゃく | arrival | arrivée
            観光客 かんこうきゃく | tourist | touriste
            スーツケース | suitcase | valise
            温泉 おんせん | hot spring | source chaude
            両替 りょうがえ | currency exchange | change
            乗り換え のりかえ | transfer | correspondance
            時刻表 じこくひょう | timetable | horaires
            ホテル | hotel | hôtel
        """,
        "advanced": """
            税関 ぜいかん | customs | douane
            ビザ | visa | visa
            日帰り ひがえり | day trip | excursion d'une journée
            宿泊 しゅくはく | lodging | hébergement
            名所 めいしょ | famous sight | lieu célèbre
            往復 おうふく | round trip | aller-retour
            片道 かたみち | one way | aller simple
            搭乗券 とうじょうけん | boarding pass | carte d'embarquement
            ガイドブック | guidebook | guide touristique
        """,
        "expert": """
            入国審査 にゅうこくしんさ | immigration control | contrôle d'immigration
            時差ぼけ じさぼけ | jet lag | décalage horaire
            乗り継ぎ のりつぎ | layover | escale
            旅程 りょてい | itinerary | itinéraire
            民宿 みんしゅく | guesthouse | pension
            手荷物 てにもつ | hand luggage | bagage à main
            添乗員 てんじょういん | tour conductor | accompagnateur
            野宿 のじゅく | sleeping outdoors | nuit à la belle étoile
        """,
    },
    "jobs": {
        "basic": """
            仕事 しごと | job | travail
            医者 いしゃ | doctor | médecin
            警察官 けいさつかん | police officer | policier
            会社員 かいしゃいん | office worker | employé de bureau
            店員 てんいん | shop clerk | vendeur
            歌手 かしゅ | singer | chanteur
            運転手 うんてんしゅ | driver | chauffeur
            看護師 かんごし | nurse | infirmier
        """,
        "medium": """
            弁護士 べんごし | lawyer | avocat
            エンジニア | engineer | ingénieur
            料理人 りょうりにん | cook | cuisinier
            消防士 しょうぼうし | firefighter | pompier
            農家 のうか | farmer | agriculteur
            俳優 はいゆう | actor | acteur
            作家 さっか | writer | écrivain
            記者 きしゃ | journalist | journaliste
            公務員 こうむいん | civil servant | fonctionnaire
            パイロット | pilot | pilote
            歯医者 はいしゃ | dentist | dentiste
        """,
        "advanced": """
            美容師 びようし | hairdresser | coiffeur
            大工 だいく | carpenter | charpentier
            漁師 りょうし | fisherman | pêcheur
            建築家 けんちくか | architect | architecte
            通訳 つうやく | interpreter | interprète
            翻訳家 ほんやくか | translator | traducteur
            会計士 かいけいし | accountant | comptable
            獣医 じゅうい | veterinarian | vétérinaire
            薬剤師 やくざいし | pharmacist | pharmacien
            秘書 ひしょ | secretary | secrétaire
            司書 ししょ | librarian | bibliothécaire
            写真家 しゃしんか | photographer | photographe
        """,
        "expert": """
            板前 いたまえ | Japanese chef | chef de cuisine japonaise
            職人 しょくにん | craftsman | artisan
            外交官 がいこうかん | diplomat | diplomate
            裁判官 さいばんかん | judge | juge
            税理士 ぜいりし | tax accountant | conseiller fiscal
            配管工 はいかんこう | plumber | plombier
            庭師 にわし | gardener | jardinier
            学芸員 がくげいいん | museum curator | conservateur de musée
            鍛冶屋 かじや | blacksmith | forgeron
            整備士 せいびし | mechanic | mécanicien
        """,
    },
    "dishes": {
        "basic": """
            料理 りょうり | dish | plat
            御飯 ごはん | cooked rice | riz
            パン | bread | pain
            寿司 すし | sushi | sushi
            ラーメン | ramen | ramen
            カレー | curry | curry
            朝御飯 あさごはん | breakfast | petit-déjeuner
            昼御飯 ひるごはん | lunch | déjeuner
            晩御飯 ばんごはん | dinner | dîner
            サンドイッチ | sandwich | sandwich
            ケーキ | cake | gâteau
        """,
        "medium": """
            うどん | udon | udon
            蕎麦 そば | soba | soba
            天ぷら てんぷら | tempura | tempura
            おにぎり | rice ball | boulette de riz
            味噌汁 みそしる | miso soup | soupe miso
            弁当 べんとう | boxed lunch | bento
            ハンバーガー | hamburger | hamburger
            ピザ | pizza | pizza
            サラダ | salad | salade
            スープ | soup | soupe
            焼き肉 やきにく | grilled meat | viande grillée
            アイスクリーム | ice cream | glace
        """,
        "advanced": """
            すき焼き すきやき | sukiyaki | sukiyaki
            しゃぶしゃぶ | shabu-shabu | shabu-shabu
            刺身 さしみ | sashimi | sashimi
            丼 どんぶり | rice bowl dish | bol de riz garni
            餃子 ギョーザ | gyoza | gyoza
            焼き鳥 やきとり | yakitori | yakitori
            お好み焼き おこのみやき | okonomiyaki | okonomiyaki
            鍋 なべ | hot pot | fondue japonaise
            たこ焼き たこやき | takoyaki | takoyaki
            グラタン | gratin | gratin
            シチュー | stew | ragoût
        """,
        "expert": """
            茶碗蒸し ちゃわんむし | savory egg custard | flan salé
            懐石 かいせき | kaiseki | kaiseki
            雑炊 ぞうすい | rice porridge | soupe de riz
            茶漬け ちゃづけ | ochazuke | ochazuke
            精進料理 しょうじんりょうり | Buddhist vegetarian cuisine | cuisine végétarienne bouddhiste
            おでん | oden | oden
            たい焼き たいやき | taiyaki | taiyaki
            冷奴 ひややっこ | chilled tofu | tofu froid
            肉じゃが にくじゃが | meat and potato stew | ragoût de bœuf et pommes de terre
        """,
    },
    "animals": {
        "basic": """
            動物 どうぶつ | animal | animal
            犬 いぬ | dog | chien
            猫 ねこ | cat | chat
            馬 うま | horse | cheval
            牛 うし | cow | vache
            豚 ぶた | pig | cochon
            兎 うさぎ | rabbit | lapin
            鼠 ねずみ | mouse | souris
            猿 さる | monkey | singe
            熊 くま | bear | ours
            ライオン | lion | lion
            象 ぞう | elephant | éléphant
        """,
        "medium": """
            虎 とら | tiger | tigre
            羊 ひつじ | sheep | mouton
            鹿 しか | deer | cerf
            狐 きつね | fox | renard
            蛇 へび | snake | serpent
            亀 かめ | turtle | tortue
            蛙 かえる | frog | grenouille
            麒麟 きりん | giraffe | girafe
            パンダ | panda | panda
            狼 おおかみ | wolf | loup
            山羊 やぎ | goat | chèvre
            ペット | pet | animal de compagnie
        """,
        "advanced": """
            鯨 くじら | whale | baleine
            いるか | dolphin | dauphin
            狸 たぬき | raccoon dog | chien viverrin
            栗鼠 りす | squirrel | écureuil
            縞馬 しまうま | zebra | zèbre
            カンガルー | kangaroo | kangourou
            コアラ | koala | koala
            駱駝 らくだ | camel | chameau
            ゴリラ | gorilla | gorille
            鰐 わに | crocodile | crocodile
            驢馬 ろば | donkey | âne
            猪 いのしし | wild boar | sanglier
        """,
        "expert": """
            豹 ひょう | leopard | léopard
            犀 さい | rhinoceros | rhinocéros
            河馬 かば | hippopotamus | hippopotame
            針鼠 はりねずみ | hedgehog | hérisson
            川獺 かわうそ | otter | loutre
            鼬 いたち | weasel | belette
            あらいぐま | raccoon | raton laveur
            蜥蜴 とかげ | lizard | lézard
            土竜 もぐら | mole | taupe
            蝙蝠 こうもり | bat | chauve-souris
            哺乳類 ほにゅうるい | mammal | mammifère
        """,
    },
    "colors": {
        "basic": """
            色 いろ | color | couleur
            赤 あか | red | rouge
            青 あお | blue | bleu
            白 しろ | white | blanc
            黒 くろ | black | noir
            黄色 きいろ | yellow | jaune
            緑 みどり | green | vert
            茶色 ちゃいろ | brown | marron
        """,
        "medium": """
            ピンク | pink | rose
            オレンジ | orange | orange
            紫 むらさき | purple | violet
            灰色 はいいろ | gray | gris
            水色 みずいろ | light blue | bleu clair
            金色 きんいろ | gold | doré
            銀色 ぎんいろ | silver | argenté
        """,
        "advanced": """
            紺 こん | navy blue | bleu marine
            ベージュ | beige | beige
            黄緑 きみどり | yellowish green | vert-jaune
            真っ赤 まっか | bright red | rouge vif
            真っ白 まっしろ | pure white | blanc immaculé
            真っ黒 まっくろ | pitch black | noir de jais
            真っ青 まっさお | deep blue | bleu profond
            透明 とうめい | transparent | transparent
        """,
        "expert": """
            朱色 しゅいろ | vermilion | vermillon
            藍色 あいいろ | indigo | indigo
            紅 くれない | crimson | cramoisi
            群青 ぐんじょう | ultramarine | outremer
            ねずみ色 ねずみいろ | dove gray | gris souris
            小豆色 あずきいろ | reddish brown | brun rougeâtre
            山吹色 やまぶきいろ | golden yellow | jaune d'or
            黄土色 おうどいろ | ochre | ocre
        """,
    },
    "clothing": {
        "basic": """
            服 ふく | clothes | vêtements
            シャツ | shirt | chemise
            ズボン | trousers | pantalon
            スカート | skirt | jupe
            靴 くつ | shoes | chaussures
            帽子 ぼうし | hat | chapeau
            靴下 くつした | socks | chaussettes
            セーター | sweater | pull
            コート | coat | manteau
        """,
        "medium": """
            上着 うわぎ | jacket | veste
            ネクタイ | necktie | cravate
            着物 きもの | kimono | kimono
            下着 したぎ | underwear | sous-vêtements
            手袋 てぶくろ | gloves | gants
            Ｔシャツ ティーシャツ | T-shirt | tee-shirt
            ジーンズ | jeans | jean
            ドレス | dress | robe
            スーツ | suit | costume
            パジャマ | pajamas | pyjama
            制服 せいふく | uniform | uniforme
            マフラー | scarf | écharpe
        """,
        "advanced": """
            ブラウス | blouse | chemisier
            ベルト | belt | ceinture
            ブーツ | boots | bottes
            サンダル | sandals | sandales
            水着 みずぎ | swimsuit | maillot de bain
            浴衣 ゆかた | yukata | yukata
            レインコート | raincoat | imperméable
            エプロン | apron | tablier
            ポケット | pocket | poche
            袖 そで | sleeve | manche
            ボタン | button | bouton
            スリッパ | slippers | chaussons
        """,
        "expert": """
            襟 えり | collar | col
            帯 おび | obi sash | ceinture de kimono
            下駄 げた | geta clogs | socques japonaises
            草履 ぞうり | zori sandals | sandales de paille
            足袋 たび | tabi socks | chaussettes japonaises
            袴 はかま | hakama | hakama
            羽織 はおり | haori jacket | veste de kimono
            裾 すそ | hem | ourlet
            喪服 もふく | mourning clothes | vêtements de deuil
            晴れ着 はれぎ | one's best clothes | habits de fête
        """,
    },
    "weather": {
        "basic": """
            天気 てんき | weather | temps
            雨 あめ | rain | pluie
            雪 ゆき | snow | neige
            風 かぜ | wind | vent
            雲 くも | cloud | nuage
            晴れ はれ | sunny weather | beau temps
            曇り くもり | cloudy weather | temps nuageux
            台風 たいふう | typhoon | typhon
        """,
        "medium": """
            天気予報 てんきよほう | weather forecast | météo
            気温 きおん | temperature | température
            嵐 あらし | storm | tempête
            雷 かみなり | thunder | tonnerre
            霧 きり | fog | brouillard
            虹 にじ | rainbow | arc-en-ciel
            梅雨 つゆ | rainy season | saison des pluies
            大雨 おおあめ | heavy rain | forte pluie
            湿度 しつど | humidity | humidité
            気候 きこう | climate | climat
        """,
        "advanced": """
            霜 しも | frost | givre
            夕立 ゆうだち | evening shower | averse du soir
            俄雨 にわかあめ | sudden shower | averse
            稲妻 いなずま | lightning | éclair
            吹雪 ふぶき | snowstorm | tempête de neige
            霧雨 きりさめ | drizzle | bruine
            大雪 おおゆき | heavy snow | fortes chutes de neige
            猛暑 もうしょ | heat wave | canicule
            洪水 こうずい | flood | inondation
            竜巻 たつまき | tornado | tornade
            露 つゆ | dew | rosée
        """,
        "expert": """
            雹 ひょう | hail | grêle
            霙 みぞれ | sleet | neige fondue
            木枯らし こがらし | cold winter wind | bise d'hiver
            春一番 はるいちばん | first spring gale | premier vent du printemps
            小春日和 こはるびより | Indian summer | été indien
            霞 かすみ | haze | brume
            陽炎 かげろう | heat shimmer | mirage de chaleur
            時雨 しぐれ | late-autumn shower | averse d'automne
            低気圧 ていきあつ | low pressure | dépression
            高気圧 こうきあつ | high pressure | anticyclone
        """,
    },
    "family": {
        "basic": """
            家族 かぞく | family | famille
            父 ちち | father | père
            母 はは | mother | mère
            兄 あに | older brother | grand frère
            姉 あね | older sister | grande sœur
            弟 おとうと | younger brother | petit frère
            妹 いもうと | younger sister | petite sœur
            両親 りょうしん | parents | parents
            子供 こども | child | enfant
            赤ちゃん あかちゃん | baby | bébé
        """,
        "medium": """
            祖父 そふ | grandfather | grand-père
            祖母 そぼ | grandmother | grand-mère
            夫 おっと | husband | mari
            妻 つま | wife | épouse
            息子 むすこ | son | fils
            娘 むすめ | daughter | fille
            兄弟 きょうだい | siblings | frères et sœurs
            孫 まご | grandchild | petit-enfant
            叔父 おじ | uncle | oncle
            叔母 おば | aunt | tante
            従兄弟 いとこ | cousin | cousin
        """,
        "advanced": """
            親戚 しんせき | relatives | parenté
            甥 おい | nephew | neveu
            姪 めい | niece | nièce
            双子 ふたご | twins | jumeaux
            夫婦 ふうふ | married couple | couple marié
            長男 ちょうなん | eldest son | fils aîné
            長女 ちょうじょ | eldest daughter | fille aînée
            末っ子 すえっこ | youngest child | benjamin
            一人っ子 ひとりっこ | only child | enfant unique
            先祖 せんぞ | ancestor | ancêtre
        """,
        "expert": """
            義母 ぎぼ | mother-in-law | belle-mère
            義父 ぎふ | father-in-law | beau-père
            曽祖父 そうそふ | great-grandfather | arrière-grand-père
            曾祖母 そうそぼ | great-grandmother | arrière-grand-mère
            嫁 よめ | daughter-in-law | belle-fille
            婿 むこ | son-in-law | gendre
            配偶者 はいぐうしゃ | spouse | conjoint
            子孫 しそん | descendant | descendant
            身内 みうち | one's kin | les siens
        """,
    },
    "emotions": {
        "basic": """
            気持ち きもち | feeling | sentiment
            嬉しい うれしい | glad | content
            悲しい かなしい | sad | triste
            楽しい たのしい | fun | amusant
            怖い こわい | scary | effrayant
            好き すき | liked | aimé
            嫌い きらい | disliked | détesté
            愛 あい | love | amour
            幸せ しあわせ | happiness | bonheur
        """,
        "medium": """
            寂しい さびしい | lonely | seul
            恥ずかしい はずかしい | embarrassed | gêné
            心配 しんぱい | worry | inquiétude
            驚き おどろき | surprise | surprise
            怒り いかり | anger | colère
            喜び よろこび | joy | joie
            悲しみ かなしみ | sorrow | chagrin
            不安 ふあん | anxiety | anxiété
            恐怖 きょうふ | fear | peur
            感情 かんじょう | emotion | émotion
            緊張 きんちょう | nervousness | nervosité
            安心 あんしん | peace of mind | tranquillité
        """,
        "advanced": """
            希望 きぼう | hope | espoir
            失望 しつぼう | disappointment | déception
            後悔 こうかい | regret | regret
            嫉妬 しっと | jealousy | jalousie
            誇り ほこり | pride | fierté
            感謝 かんしゃ | gratitude | gratitude
            退屈 たいくつ | boredom | ennui
            孤独 こどく | solitude | solitude
            満足 まんぞく | satisfaction | satisfaction
            興奮 こうふん | excitement | excitation
            同情 どうじょう | sympathy | compassion
            憎しみ にくしみ | hatred | haine
        """,
        "expert": """
            絶望 ぜつぼう | despair | désespoir
            郷愁 きょうしゅう | nostalgia | nostalgie
            羨望 せんぼう | envy | envie
            憂鬱 ゆううつ | melancholy | mélancolie
            屈辱 くつじょく | humiliation | humiliation
            憤り いきどおり | indignation | indignation
            安堵 あんど | relief | soulagement
            戸惑い とまどい | bewilderment | désarroi
            焦り あせり | impatience | fébrilité
            罪悪感 ざいあくかん | guilt | culpabilité
            劣等感 れっとうかん | inferiority complex | complexe d'infériorité
        """,
    },
    "nature": {
        "basic": """
            自然 しぜん | nature | nature
            山 やま | mountain | montagne
            川 かわ | river | rivière
            海 うみ | sea | mer
            空 そら | sky | ciel
            森 もり | forest | forêt
            島 しま | island | île
            太陽 たいよう | sun | soleil
            月 つき | moon | lune
            星 ほし | star | étoile
            湖 みずうみ | lake | lac
            石 いし | stone | pierre
        """,
        "medium": """
            池 いけ | pond | étang
            林 はやし | woods | bois
            丘 おか | hill | colline
            谷 たに | valley | vallée
            滝 たき | waterfall | cascade
            海岸 かいがん | coast | côte
            砂 すな | sand | sable
            岩 いわ | rock | rocher
            波 なみ | wave | vague
            地球 ちきゅう | the Earth | la Terre
            火山 かざん | volcano | volcan
            砂漠 さばく | desert | désert
        """,
        "advanced": """
            洞窟 どうくつ | cave | grotte
            崖 がけ | cliff | falaise
            沼 ぬま | swamp | marais
            地平線 ちへいせん | horizon | horizon
            水平線 すいへいせん | sea horizon | ligne d'horizon marine
            草原 そうげん | grassland | prairie
            小川 おがわ | brook | ruisseau
            泉 いずみ | spring | source
            潮 しお | tide | marée
            峠 とうげ | mountain pass | col
            氷河 ひょうが | glacier | glacier
        """,
        "expert": """
            渓谷 けいこく | ravine | gorge
            湿原 しつげん | wetland | zone humide
            岬 みさき | cape | cap
            入り江 いりえ | inlet | crique
            干潟 ひがた | tidal flat | estran
            鍾乳洞 しょうにゅうどう | limestone cave | grotte calcaire
            樹海 じゅかい | sea of trees | océan d'arbres
            サンゴ礁 さんごしょう | coral reef | récif corallien
            尾根 おね | ridge | crête
            麓 ふもと | foot of a mountain | pied de la montagne
        """,
    },
    "vehicles": {
        "basic": """
            車 くるま | car | voiture
            電車 でんしゃ | train | train
            バス | bus | bus
            自転車 じてんしゃ | bicycle | vélo
            飛行機 ひこうき | airplane | avion
            船 ふね | ship | bateau
            タクシー | taxi | taxi
            地下鉄 ちかてつ | subway | métro
        """,
        "medium": """
            乗り物 のりもの | vehicle | véhicule
            新幹線 しんかんせん | bullet train | shinkansen
            トラック | truck | camion
            バイク | motorbike | moto
            救急車 きゅうきゅうしゃ | ambulance | ambulance
            消防車 しょうぼうしゃ | fire engine | camion de pompiers
            パトカー | police car | voiture de police
            ボート | rowboat | barque
            ヘリコプター | helicopter | hélicoptère
            フェリー | ferry | ferry
        """,
        "advanced": """
            路面電車 ろめんでんしゃ | streetcar | tramway
            モノレール | monorail | monorail
            ヨット | yacht | voilier
            潜水艦 せんすいかん | submarine | sous-marin
            戦車 せんしゃ | tank | char d'assaut
            ロケット | rocket | fusée
            スクーター | scooter | scooter
            一輪車 いちりんしゃ | unicycle | monocycle
            ケーブルカー | cable car | funiculaire
            ロープウェイ | ropeway | téléphérique
        """,
        "expert": """
            人力車 じんりきしゃ | rickshaw | pousse-pousse
            屋形船 やかたぶね | pleasure boat | bateau de plaisance
            馬車 ばしゃ | carriage | calèche
            筏 いかだ | raft | radeau
            カヌー | canoe | canoë
            霊柩車 れいきゅうしゃ | hearse | corbillard
            宇宙船 うちゅうせん | spaceship | vaisseau spatial
            ブルドーザー | bulldozer | bulldozer
            寝台車 しんだいしゃ | sleeping car | wagon-lit
        """,
    },
    "technology": {
        "basic": """
            パソコン | computer | ordinateur
            電話 でんわ | telephone | téléphone
            スマホ | smartphone | smartphone
            テレビ | television | télévision
            カメラ | camera | appareil photo
            インターネット | internet | internet
            電気 でんき | electricity | électricité
            メール | email | e-mail
        """,
        "medium": """
            携帯電話 けいたいでんわ | mobile phone | téléphone portable
            ラジオ | radio | radio
            ロボット | robot | robot
            電池 でんち | battery | pile
            画面 がめん | screen | écran
            キーボード | keyboard | clavier
            プリンタ | printer | imprimante
            アプリ | app | application
            パスワード | password | mot de passe
            機械 きかい | machine | machine
        """,
        "advanced": """
            ソフトウェア | software | logiciel
            データ | data | données
            ファイル | file | fichier
            ネットワーク | network | réseau
            充電器 じゅうでんき | charger | chargeur
            イヤホン | earphones | écouteurs
            タブレット | tablet | tablette
            スピーカー | speaker | haut-parleur
            マイク | microphone | micro
            人工知能 じんこうちのう | artificial intelligence | intelligence artificielle
            衛星 えいせい | satellite | satellite
        """,
        "expert": """
            アルゴリズム | algorithm | algorithme
            サーバー | server | serveur
            データベース | database | base de données
            プロセッサー | processor | processeur
            半導体 はんどうたい | semiconductor | semi-conducteur
            回路 かいろ | circuit | circuit
            暗号 あんごう | cipher | chiffrement
            周波数 しゅうはすう | frequency | fréquence
            センサー | sensor | capteur
            アンテナ | antenna | antenne
        """,
    },
    "sports": {
        "basic": """
            スポーツ | sport | sport
            サッカー | soccer | football
            野球 やきゅう | baseball | baseball
            テニス | tennis | tennis
            水泳 すいえい | swimming | natation
            試合 しあい | match | match
            ボール | ball | ballon
        """,
        "medium": """
            バスケットボール | basketball | basket-ball
            バレーボール | volleyball | volley-ball
            柔道 じゅうどう | judo | judo
            空手 からて | karate | karaté
            相撲 すもう | sumo | sumo
            スキー | skiing | ski
            ゴルフ | golf | golf
            マラソン | marathon | marathon
            卓球 たっきゅう | table tennis | tennis de table
            選手 せんしゅ | player | joueur
            体操 たいそう | gymnastics | gymnastique
            スケート | skating | patinage
        """,
        "advanced": """
            ラグビー | rugby | rugby
            バドミントン | badminton | badminton
            ボクシング | boxing | boxe
            剣道 けんどう | kendo | kendo
            陸上競技 りくじょうきょうぎ | track and field | athlétisme
            審判 しんぱん | referee | arbitre
            優勝 ゆうしょう | championship victory | victoire finale
            監督 かんとく | coach | entraîneur
            大会 たいかい | tournament | tournoi
            レスリング | wrestling | lutte
            サーフィン | surfing | surf
            登山 とざん | mountain climbing | alpinisme
        """,
        "expert": """
            フェンシング | fencing | escrime
            弓道 きゅうどう | kyudo | kyudo
            合気道 あいきどう | aikido | aïkido
            アーチェリー | archery | tir à l'arc
            棒高跳び ぼうたかとび | pole vault | saut à la perche
            競歩 きょうほ | race walking | marche athlétique
            三段跳び さんだんとび | triple jump | triple saut
            横綱 よこづな | yokozuna | yokozuna
            延長戦 えんちょうせん | overtime | prolongations
            十種競技 じっしゅきょうぎ | decathlon | décathlon
        """,
    },
    "music": {
        "basic": """
            音楽 おんがく | music | musique
            歌 うた | song | chanson
            ピアノ | piano | piano
            ギター | guitar | guitare
            歌手 かしゅ | singer | chanteur
            コンサート | concert | concert
            曲 きょく | piece of music | morceau
        """,
        "medium": """
            楽器 がっき | musical instrument | instrument de musique
            バイオリン | violin | violon
            ドラム | drums | batterie
            バンド | band | groupe
            リズム | rhythm | rythme
            メロディー | melody | mélodie
            歌詞 かし | lyrics | paroles
            合唱 がっしょう | chorus | chœur
            フルート | flute | flûte
            トランペット | trumpet | trompette
            太鼓 たいこ | Japanese drum | tambour japonais
        """,
        "advanced": """
            オーケストラ | orchestra | orchestre
            作曲家 さっきょくか | composer | compositeur
            指揮者 しきしゃ | conductor | chef d'orchestre
            楽譜 がくふ | sheet music | partition
            チェロ | cello | violoncelle
            サックス | saxophone | saxophone
            ハーモニカ | harmonica | harmonica
            民謡 みんよう | folk song | chanson folklorique
            国歌 こっか | national anthem | hymne national
            演奏 えんそう | musical performance | interprétation
            オペラ | opera | opéra
            交響曲 こうきょうきょく | symphony | symphonie
        """,
        "expert": """
            三味線 しゃみせん | shamisen | shamisen
            琴 こと | koto | koto
            尺八 しゃくはち | shakuhachi | shakuhachi
            和音 わおん | chord | accord
            音程 おんてい | pitch interval | intervalle
            拍子 ひょうし | time signature | mesure
            独奏 どくそう | solo | solo
            協奏曲 きょうそうきょく | concerto | concerto
            雅楽 ががく | gagaku | musique de cour
            ハープ | harp | harpe
            クラリネット | clarinet | clarinette
        """,
    },
    "kitchen_items": {
        "basic": """
            皿 さら | plate | assiette
            箸 はし | chopsticks | baguettes
            スプーン | spoon | cuillère
            フォーク | fork | fourchette
            ナイフ | knife | couteau
            コップ | glass | verre
            冷蔵庫 れいぞうこ | refrigerator | réfrigérateur
            茶碗 ちゃわん | rice bowl | bol à riz
        """,
        "medium": """
            鍋 なべ | pot | marmite
            フライパン | frying pan | poêle
            庖丁 ほうちょう | kitchen knife | couteau de cuisine
            薬缶 やかん | kettle | bouilloire
            電子レンジ でんしレンジ | microwave oven | micro-ondes
            オーブン | oven | four
            まな板 まないた | cutting board | planche à découper
            カップ | cup | tasse
            炊飯器 すいはんき | rice cooker | cuiseur à riz
            流し ながし | sink | évier
        """,
        "advanced": """
            お玉 おたま | ladle | louche
            急須 きゅうす | teapot | théière
            蓋 ふた | lid | couvercle
            トレー | tray | plateau
            食器 しょっき | tableware | vaisselle
            笊 ざる | strainer | passoire
            泡だて器 あわだてき | whisk | fouet
            栓抜き せんぬき | bottle opener | décapsuleur
            缶切り かんきり | can opener | ouvre-boîte
            食器洗い機 しょっきあらいき | dishwasher | lave-vaisselle
        """,
        "expert": """
            すり鉢 すりばち | mortar | mortier
            すりこ木 すりこぎ | pestle | pilon
            おろし金 おろしがね | grater | râpe
            土鍋 どなべ | earthenware pot | marmite en terre
            蒸し器 むしき | steamer | cuit-vapeur
            杓文字 しゃもじ | rice paddle | spatule à riz
            菜箸 さいばし | cooking chopsticks | baguettes de cuisine
            麺棒 めんぼう | rolling pin | rouleau à pâtisserie
            換気扇 かんきせん | extractor fan | hotte
        """,
    },
    "office_supplies": {
        "basic": """
            ペン | pen | stylo
            鉛筆 えんぴつ | pencil | crayon
            紙 かみ | paper | papier
            ノート | notebook | cahier
            消しゴム けしゴム | eraser | gomme
            はさみ | scissors | ciseaux
        """,
        "medium": """
            ボールペン | ballpoint pen | stylo à bille
            封筒 ふうとう | envelope | enveloppe
            切手 きって | postage stamp | timbre
            テープ | tape | ruban adhésif
            糊 のり | glue | colle
            定規 じょうぎ | ruler | règle
            手帳 てちょう | planner | agenda
            カレンダー | calendar | calendrier
            電卓 でんたく | calculator | calculatrice
            メモ | memo | note
        """,
        "advanced": """
            ホッチキス | stapler | agrafeuse
            クリップ | paper clip | trombone
            万年筆 まんねんひつ | fountain pen | stylo-plume
            筆箱 ふでばこ | pencil case | trousse
            付箋 ふせん | sticky note | post-it
            修正液 しゅうせいえき | correction fluid | correcteur liquide
            蛍光ペン けいこうペン | highlighter | surligneur
            文房具 ぶんぼうぐ | stationery | papeterie
            画鋲 がびょう | thumbtack | punaise
            印鑑 いんかん | personal seal | sceau personnel
        """,
        "expert": """
            朱肉 しゅにく | vermilion ink pad | tampon encreur
            カッター | box cutter | cutter
            輪ゴム わゴム | rubber band | élastique
            分度器 ぶんどき | protractor | rapporteur
            便箋 びんせん | letter paper | papier à lettres
            墨 すみ | ink stick | bâton d'encre
            硯 すずり | inkstone | pierre à encre
            筆 ふで | brush | pinceau
        """,
    },
    "shopping_money": {
        "basic": """
            お金 おかね | money | argent
            店 みせ | shop | magasin
            買い物 かいもの | shopping | courses
            値段 ねだん | price | prix
            円 えん | yen | yen
            財布 さいふ | wallet | portefeuille
            銀行 ぎんこう | bank | banque
            スーパー | supermarket | supermarché
        """,
        "medium": """
            現金 げんきん | cash | espèces
            コンビニ | convenience store | supérette
            デパート | department store | grand magasin
            レシート | receipt | ticket de caisse
            おつり | change | monnaie rendue
            セール | sale | soldes
            割引 わりびき | discount | réduction
            税金 ぜいきん | tax | impôt
            給料 きゅうりょう | salary | salaire
            硬貨 こうか | coin | pièce de monnaie
            お札 おさつ | banknote | billet de banque
            レジ | cash register | caisse
        """,
        "advanced": """
            貯金 ちょきん | savings | épargne
            客 きゃく | customer | client
            クレジットカード | credit card | carte de crédit
            消費税 しょうひぜい | consumption tax | TVA
            領収書 りょうしゅうしょ | official receipt | reçu
            予算 よさん | budget | budget
            借金 しゃっきん | debt | dette
            返品 へんぴん | returned goods | article retourné
            送料 そうりょう | shipping fee | frais de port
            定価 ていか | list price | prix catalogue
        """,
        "expert": """
            為替 かわせ | exchange rate | taux de change
            利子 りし | interest | intérêts
            分割払い ぶんかつばらい | installment payment | paiement échelonné
            前払い まえばらい | advance payment | paiement d'avance
            福袋 ふくぶくろ | lucky bag | sac surprise
            品切れ しなぎれ | out of stock | rupture de stock
            小銭 こぜに | small change | petite monnaie
            請求書 せいきゅうしょ | invoice | facture
            赤字 あかじ | deficit | déficit
        """,
    },
    "geography": {
        "basic": """
            国 くに | country | pays
            町 まち | town | ville
            村 むら | village | village
            世界 せかい | world | monde
            北 きた | north | nord
            南 みなみ | south | sud
            東 ひがし | east | est
            西 にし | west | ouest
        """,
        "medium": """
            首都 しゅと | capital | capitale
            地方 ちほう | region | région
            県 けん | prefecture | préfecture
            大陸 たいりく | continent | continent
            国境 こっきょう | national border | frontière
            人口 じんこう | population | population
            田舎 いなか | countryside | campagne
            都会 とかい | big city | grande ville
            島国 しまぐに | island nation | pays insulaire
        """,
        "advanced": """
            半島 はんとう | peninsula | péninsule
            列島 れっとう | archipelago | archipel
            赤道 せきどう | equator | équateur
            海峡 かいきょう | strait | détroit
            盆地 ぼんち | basin | bassin
            平野 へいや | plain | plaine
            郊外 こうがい | suburbs | banlieue
            領土 りょうど | territory | territoire
            北極 ほっきょく | North Pole | pôle Nord
            南極 なんきょく | South Pole | pôle Sud
        """,
        "expert": """
            緯度 いど | latitude | latitude
            経度 けいど | longitude | longitude
            半球 はんきゅう | hemisphere | hémisphère
            標高 ひょうこう | altitude | altitude
            植民地 しょくみんち | colony | colonie
            太平洋 たいへいよう | Pacific Ocean | océan Pacifique
            大西洋 たいせいよう | Atlantic Ocean | océan Atlantique
            地形 ちけい | terrain | relief
            三角州 さんかくす | delta | delta
        """,
    },
    "insects_bugs": {
        "basic": """
            虫 むし | insect | insecte
            蝶 ちょう | butterfly | papillon
            蚊 か | mosquito | moustique
            蟻 あり | ant | fourmi
            蜂 はち | bee | abeille
            蜘蛛 くも | spider | araignée
            蠅 はえ | fly | mouche
        """,
        "medium": """
            蜻蛉 とんぼ | dragonfly | libellule
            蝉 せみ | cicada | cigale
            ゴキブリ | cockroach | cafard
            甲虫 かぶとむし | rhinoceros beetle | scarabée rhinocéros
            てんとう虫 てんとうむし | ladybug | coccinelle
            バッタ | grasshopper | sauterelle
            蛍 ほたる | firefly | luciole
            蛾 が | moth | papillon de nuit
            ミミズ | earthworm | ver de terre
            蝸牛 かたつむり | snail | escargot
        """,
        "advanced": """
            毛虫 けむし | caterpillar | chenille
            幼虫 ようちゅう | larva | larve
            蟋蟀 こおろぎ | cricket | grillon
            蟷螂 かまきり | praying mantis | mante religieuse
            鍬形虫 くわがたむし | stag beetle | lucane
            蚕 かいこ | silkworm | ver à soie
            百足 むかで | centipede | mille-pattes
            スズメバチ | hornet | frelon
            蚤 のみ | flea | puce
            ダニ | mite | acarien
        """,
        "expert": """
            蛹 さなぎ | pupa | chrysalide
            白蟻 しろあり | termite | termite
            蠍 さそり | scorpion | scorpion
            水黽 あめんぼ | water strider | gerris
            鈴虫 すずむし | bell cricket | grillon chanteur
            蜉蝣 かげろう | mayfly | éphémère
            蛞蝓 なめくじ | slug | limace
            虱 しらみ | louse | pou
            触角 しょっかく | antenna | antenne
        """,
    },
    "birds": {
        "basic": """
            鳥 とり | bird | oiseau
            鶏 にわとり | chicken | poule
            烏 からす | crow | corbeau
            鳩 はと | pigeon | pigeon
            雀 すずめ | sparrow | moineau
            ペンギン | penguin | manchot
            アヒル | duck | canard
        """,
        "medium": """
            白鳥 はくちょう | swan | cygne
            鷲 わし | eagle | aigle
            鷹 たか | hawk | épervier
            梟 ふくろう | owl | hibou
            鸚鵡 おうむ | parrot | perroquet
            鶴 つる | crane | grue
            燕 つばめ | swallow | hirondelle
            羽 はね | feather | plume
            翼 つばさ | wing | aile
            巣 す | nest | nid
            嘴 くちばし | beak | bec
            雛 ひな | chick | poussin
        """,
        "advanced": """
            孔雀 くじゃく | peacock | paon
            カモメ | seagull | mouette
            隼 はやぶさ | falcon | faucon
            駝鳥 だちょう | ostrich | autruche
            フラミンゴ | flamingo | flamant rose
            啄木鳥 きつつき | woodpecker | pic
            鶯 うぐいす | bush warbler | bouscarle
            金糸雀 カナリア | canary | canari
            鴨 かも | wild duck | canard sauvage
            鷺 さぎ | heron | héron
            雉 きじ | pheasant | faisan
        """,
        "expert": """
            鴇 とき | crested ibis | ibis nippon
            鵜 う | cormorant | cormoran
            雲雀 ひばり | skylark | alouette
            渡り鳥 わたりどり | migratory bird | oiseau migrateur
            猛禽 もうきん | bird of prey | rapace
            鶉 うずら | quail | caille
            鴛鴦 おしどり | mandarin duck | canard mandarin
            ペリカン | pelican | pélican
            鳶 とび | black kite | milan noir
        """,
    },
    "seafood": {
        "basic": """
            魚 さかな | fish | poisson
            海老 えび | shrimp | crevette
            蟹 かに | crab | crabe
            イカ | squid | calmar
            蛸 たこ | octopus | poulpe
            鮪 まぐろ | tuna | thon
            鮭 さけ | salmon | saumon
            貝 かい | shellfish | coquillage
        """,
        "medium": """
            鰻 うなぎ | eel | anguille
            鯛 たい | sea bream | dorade
            鰯 いわし | sardine | sardine
            鯖 さば | mackerel | maquereau
            牡蠣 かき | oyster | huître
            帆立 ほたて | scallop | coquille Saint-Jacques
            海苔 のり | nori seaweed | algue nori
            若布 わかめ | wakame seaweed | algue wakame
            海藻 かいそう | seaweed | algue
            浅蜊 あさり | short-neck clam | palourde
        """,
        "advanced": """
            鯵 あじ | horse mackerel | chinchard
            秋刀魚 さんま | Pacific saury | balaou du Japon
            鰤 ぶり | yellowtail | sériole
            鰹 かつお | bonito | bonite
            うに | sea urchin | oursin
            イクラ | salmon roe | œufs de saumon
            鱈 たら | cod | cabillaud
            昆布 こんぶ | kelp | kombu
            平目 ひらめ | flounder | cardeau
            海鼠 なまこ | sea cucumber | concombre de mer
        """,
        "expert": """
            鮑 あわび | abalone | ormeau
            河豚 ふぐ | pufferfish | fugu
            数の子 かずのこ | herring roe | œufs de hareng
            明太子 めんたいこ | spicy cod roe | œufs de colin épicés
            鰹節 かつおぶし | dried bonito | bonite séchée
            伊勢海老 いせえび | spiny lobster | langouste
            穴子 あなご | conger eel | congre
            鮎 あゆ | sweetfish | ayu
            白子 しらこ | milt | laitance
        """,
    },
    "drinks": {
        "basic": """
            飲み物 のみもの | drink | boisson
            水 みず | water | eau
            お茶 おちゃ | tea | thé
            コーヒー | coffee | café
            牛乳 ぎゅうにゅう | milk | lait
            ジュース | juice | jus
            ビール | beer | bière
            酒 さけ | alcohol | alcool
        """,
        "medium": """
            紅茶 こうちゃ | black tea | thé noir
            緑茶 りょくちゃ | green tea | thé vert
            ワイン | wine | vin
            お湯 おゆ | hot water | eau chaude
            コーラ | cola | cola
            日本酒 にほんしゅ | sake | saké
            麦茶 むぎちゃ | barley tea | thé d'orge
            ココア | cocoa | chocolat chaud
            ウイスキー | whisky | whisky
        """,
        "advanced": """
            抹茶 まっちゃ | matcha | matcha
            ウーロン茶 ウーロンちゃ | oolong tea | thé oolong
            炭酸水 たんさんすい | sparkling water | eau gazeuse
            焼酎 しょうちゅう | shochu | shochu
            カクテル | cocktail | cocktail
            シャンパン | champagne | champagne
            ほうじ茶 ほうじちゃ | roasted green tea | thé vert torréfié
            レモネード | lemonade | limonade
            豆乳 とうにゅう | soy milk | lait de soja
            甘酒 あまざけ | amazake | amazake
        """,
        "expert": """
            梅酒 うめしゅ | plum wine | liqueur de prune
            玄米茶 げんまいちゃ | genmaicha | genmaicha
            番茶 ばんちゃ | coarse green tea | bancha
            泡盛 あわもり | awamori | awamori
            地ビール じビール | craft beer | bière artisanale
            熱燗 あつかん | hot sake | saké chaud
            白湯 さゆ | plain boiled water | eau bouillie
            カフェオレ | café au lait | café au lait
        """,
    },
    "shapes": {
        "basic": """
            形 かたち | shape | forme
            丸 まる | round shape | rond
            四角 しかく | square | carré
            三角 さんかく | triangle | triangle
            線 せん | line | ligne
            点 てん | dot | point
        """,
        "medium": """
            円 えん | circle | cercle
            長方形 ちょうほうけい | rectangle | rectangle
            正方形 せいほうけい | perfect square | carré parfait
            球 きゅう | sphere | sphère
            直線 ちょくせん | straight line | ligne droite
            曲線 きょくせん | curve | courbe
            角 かど | corner | coin
            ハート | heart shape | cœur
        """,
        "advanced": """
            楕円 だえん | oval | ovale
            円柱 えんちゅう | cylinder | cylindre
            立方体 りっぽうたい | cube | cube
            円錐 えんすい | cone | cône
            渦巻き うずまき | spiral | spirale
            半円 はんえん | semicircle | demi-cercle
            対角線 たいかくせん | diagonal | diagonale
            直角 ちょっかく | right angle | angle droit
            ピラミッド | pyramid | pyramide
            菱形 ひしがた | diamond | losange
            六角形 ろっかっけい | hexagon | hexagone
        """,
        "expert": """
            五角形 ごかくけい | pentagon | pentagone
            八角形 はっかくけい | octagon | octogone
            台形 だいけい | trapezoid | trapèze
            平行四辺形 へいこうしへんけい | parallelogram | parallélogramme
            多角形 たかくけい | polygon | polygone
            扇形 おうぎがた | fan shape | éventail
            同心円 どうしんえん | concentric circles | cercles concentriques
            弧 こ | arc | arc
            放物線 ほうぶつせん | parabola | parabole
            対称 たいしょう | symmetry | symétrie
        """,
    },
    "materials": {
        "basic": """
            紙 かみ | paper | papier
            木 き | wood | bois
            鉄 てつ | iron | fer
            金 きん | gold | or
            銀 ぎん | silver | argent
            プラスチック | plastic | plastique
            ガラス | glass | verre
            布 ぬの | cloth | tissu
        """,
        "medium": """
            金属 きんぞく | metal | métal
            銅 どう | copper | cuivre
            綿 めん | cotton | coton
            絹 きぬ | silk | soie
            革 かわ | leather | cuir
            ゴム | rubber | caoutchouc
            ウール | wool | laine
            鋼 はがね | steel | acier
            アルミ | aluminum | aluminium
            コンクリート | concrete | béton
        """,
        "advanced": """
            大理石 だいりせき | marble | marbre
            陶器 とうき | earthenware | faïence
            磁器 じき | porcelain | porcelaine
            粘土 ねんど | clay | argile
            煉瓦 れんが | brick | brique
            鉛 なまり | lead | plomb
            セメント | cement | ciment
            青銅 せいどう | bronze | bronze
            ナイロン | nylon | nylon
            段ボール だんボール | cardboard | carton
        """,
        "expert": """
            真鍮 しんちゅう | brass | laiton
            錫 すず | tin | étain
            亜鉛 あえん | zinc | zinc
            白金 はっきん | platinum | platine
            漆 うるし | lacquer | laque
            和紙 わし | Japanese paper | papier japonais
            合板 ごうはん | plywood | contreplaqué
            石膏 せっこう | plaster | plâtre
            ステンレス | stainless steel | inox
        """,
    },
    "tools": {
        "basic": """
            道具 どうぐ | tool | outil
            ハンマー | hammer | marteau
            釘 くぎ | nail | clou
            紐 ひも | string | ficelle
            ロープ | rope | corde
            梯子 はしご | ladder | échelle
            針 はり | needle | aiguille
            糸 いと | thread | fil
        """,
        "medium": """
            のこぎり | saw | scie
            ドライバー | screwdriver | tournevis
            ねじ | screw | vis
            スコップ | shovel | pelle
            斧 おの | axe | hache
            鎖 くさり | chain | chaîne
            バケツ | bucket | seau
            懐中電灯 かいちゅうでんとう | flashlight | lampe de poche
            接着剤 せっちゃくざい | adhesive | adhésif
        """,
        "advanced": """
            ペンチ | pliers | pince
            スパナ | spanner | clé plate
            ドリル | drill | perceuse
            鎌 かま | sickle | faucille
            鍬 くわ | hoe | houe
            鑢 やすり | file | lime
            紙やすり かみやすり | sandpaper | papier de verre
            ボルト | bolt | boulon
            熊手 くまで | rake | râteau
            巻尺 まきじゃく | tape measure | mètre ruban
        """,
        "expert": """
            鑿 のみ | chisel | ciseau à bois
            鉋 かんな | plane | rabot
            錐 きり | gimlet | vrille
            万力 まんりき | vise | étau
            鶴嘴 つるはし | pickaxe | pioche
            手押し車 ておしぐるま | wheelbarrow | brouette
            水準器 すいじゅんき | spirit level | niveau à bulle
            滑車 かっしゃ | pulley | poulie
            半田ごて はんだごて | soldering iron | fer à souder
        """,
    },
    "medical": {
        "basic": """
            病院 びょういん | hospital | hôpital
            医者 いしゃ | doctor | médecin
            薬 くすり | medicine | médicament
            病気 びょうき | illness | maladie
            風邪 かぜ | cold | rhume
            熱 ねつ | fever | fièvre
            怪我 けが | injury | blessure
            痛み いたみ | pain | douleur
        """,
        "medium": """
            看護師 かんごし | nurse | infirmier
            患者 かんじゃ | patient | patient
            注射 ちゅうしゃ | injection | piqûre
            手術 しゅじゅつ | surgery | opération
            頭痛 ずつう | headache | mal de tête
            咳 せき | cough | toux
            救急車 きゅうきゅうしゃ | ambulance | ambulance
            検査 けんさ | medical test | examen médical
            治療 ちりょう | treatment | traitement
            入院 にゅういん | hospitalization | hospitalisation
        """,
        "advanced": """
            診断 しんだん | diagnosis | diagnostic
            処方箋 しょほうせん | prescription | ordonnance
            包帯 ほうたい | bandage | bandage
            症状 しょうじょう | symptom | symptôme
            錠剤 じょうざい | tablet | comprimé
            体温計 たいおんけい | thermometer | thermomètre
            アレルギー | allergy | allergie
            インフルエンザ | influenza | grippe
            予防接種 よぼうせっしゅ | vaccination | vaccination
            骨折 こっせつ | fracture | fracture
            車椅子 くるまいす | wheelchair | fauteuil roulant
            吐き気 はきけ | nausea | nausée
        """,
        "expert": """
            麻酔 ますい | anesthesia | anesthésie
            聴診器 ちょうしんき | stethoscope | stéthoscope
            感染症 かんせんしょう | infectious disease | maladie infectieuse
            副作用 ふくさよう | side effect | effet secondaire
            軟膏 なんこう | ointment | pommade
            点滴 てんてき | IV drip | perfusion
            松葉杖 まつばづえ | crutches | béquilles
            捻挫 ねんざ | sprain | entorse
            炎症 えんしょう | inflammation | inflammation
            脳卒中 のうそっちゅう | stroke | AVC
        """,
    },
    "plants_trees": {
        "basic": """
            植物 しょくぶつ | plant | plante
            木 き | tree | arbre
            花 はな | flower | fleur
            草 くさ | grass | herbe
            葉 は | leaf | feuille
            桜 さくら | cherry blossom | fleur de cerisier
            種 たね | seed | graine
        """,
        "medium": """
            根 ね | root | racine
            枝 えだ | branch | branche
            松 まつ | pine | pin
            竹 たけ | bamboo | bambou
            薔薇 ばら | rose | rose
            向日葵 ひまわり | sunflower | tournesol
            チューリップ | tulip | tulipe
            紅葉 もみじ | autumn leaves | feuilles d'automne
            芽 め | sprout | pousse
            花びら はなびら | petal | pétale
        """,
        "advanced": """
            菊 きく | chrysanthemum | chrysanthème
            百合 ゆり | lily | lys
            蘭 らん | orchid | orchidée
            苔 こけ | moss | mousse
            杉 すぎ | Japanese cedar | cèdre du Japon
            楓 かえで | maple | érable
            柳 やなぎ | willow | saule
            雑草 ざっそう | weeds | mauvaises herbes
            茎 くき | stem | tige
            蕾 つぼみ | flower bud | bouton de fleur
            朝顔 あさがお | morning glory | belle-de-jour
            椿 つばき | camellia | camélia
            サボテン | cactus | cactus
        """,
        "expert": """
            藤 ふじ | wisteria | glycine
            紫陽花 あじさい | hydrangea | hortensia
            蓮 はす | lotus | lotus
            銀杏 いちょう | ginkgo | ginkgo
            檜 ひのき | Japanese cypress | cyprès du Japon
            蔦 つた | ivy | lierre
            羊歯 しだ | fern | fougère
            花粉 かふん | pollen | pollen
            樫 かし | oak | chêne
            椰子 やし | palm tree | palmier
        """,
    },
    "household_items": {
        "basic": """
            時計 とけい | clock | horloge
            傘 かさ | umbrella | parapluie
            鍵 かぎ | key | clé
            タオル | towel | serviette
            石鹸 せっけん | soap | savon
            歯ブラシ はブラシ | toothbrush | brosse à dents
            ごみ | garbage | ordures
        """,
        "medium": """
            毛布 もうふ | blanket | couverture
            枕 まくら | pillow | oreiller
            洗濯機 せんたくき | washing machine | lave-linge
            掃除機 そうじき | vacuum cleaner | aspirateur
            シャンプー | shampoo | shampoing
            歯磨き粉 はみがきこ | toothpaste | dentifrice
            ハンガー | hanger | cintre
            ゴミ箱 ごみばこ | trash can | poubelle
            電球 でんきゅう | light bulb | ampoule
            エアコン | air conditioner | climatiseur
            扇風機 せんぷうき | electric fan | ventilateur
        """,
        "advanced": """
            箒 ほうき | broom | balai
            洗剤 せんざい | detergent | lessive
            櫛 くし | comb | peigne
            籠 かご | basket | panier
            クッション | cushion | coussin
            蝋燭 ろうそく | candle | bougie
            アイロン | iron | fer à repasser
            スポンジ | sponge | éponge
            ドライヤー | hair dryer | sèche-cheveux
            目覚まし時計 めざましどけい | alarm clock | réveil
            雑巾 ぞうきん | floor cloth | serpillière
        """,
        "expert": """
            塵取り ちりとり | dustpan | pelle à poussière
            剃刀 かみそり | razor | rasoir
            湯たんぽ ゆたんぽ | hot-water bottle | bouillotte
            加湿器 かしつき | humidifier | humidificateur
            魔法瓶 まほうびん | thermos | bouteille isotherme
            爪切り つめきり | nail clippers | coupe-ongles
            耳かき みみかき | ear pick | cure-oreille
            蚊取り線香 かとりせんこう | mosquito coil | serpentin anti-moustiques
            風鈴 ふうりん | wind chime | carillon éolien
            物干し竿 ものほしざお | laundry pole | perche à linge
        """,
    },
    "holidays_events": {
        "basic": """
            誕生日 たんじょうび | birthday | anniversaire
            パーティー | party | fête
            正月 しょうがつ | New Year | Nouvel An
            休み やすみ | day off | jour de congé
            祭 まつり | festival | festival
            結婚式 けっこんしき | wedding | mariage
            クリスマス | Christmas | Noël
            夏休み なつやすみ | summer vacation | vacances d'été
        """,
        "medium": """
            花見 はなみ | cherry-blossom viewing | hanami
            花火 はなび | fireworks | feu d'artifice
            祝日 しゅくじつ | public holiday | jour férié
            卒業式 そつぎょうしき | graduation ceremony | remise des diplômes
            入学式 にゅうがくしき | school entrance ceremony | cérémonie de rentrée
            葬式 そうしき | funeral | funérailles
            記念日 きねんび | anniversary | jour commémoratif
            元日 がんじつ | New Year's Day | jour de l'An
            お盆 おぼん | Obon | fête des morts (Obon)
            バレンタインデー | Valentine's Day | Saint-Valentin
        """,
        "advanced": """
            七夕 たなばた | Tanabata | Tanabata
            節分 せつぶん | Setsubun | Setsubun
            成人式 せいじんしき | coming-of-age ceremony | cérémonie de la majorité
            大晦日 おおみそか | New Year's Eve | réveillon du Nouvel An
            初詣 はつもうで | first shrine visit of the year | première visite au sanctuaire
            ハロウィン | Halloween | Halloween
            運動会 うんどうかい | sports day | fête sportive
            宴会 えんかい | banquet | banquet
            歓迎会 かんげいかい | welcome party | fête de bienvenue
            忘年会 ぼうねんかい | year-end party | fête de fin d'année
        """,
        "expert": """
            ひな祭り ひなまつり | Doll Festival | fête des poupées
            七五三 しちごさん | Shichi-Go-San | Shichi-Go-San
            月見 つきみ | moon viewing | contemplation de la lune
            法事 ほうじ | Buddhist memorial service | service commémoratif
            送別会 そうべつかい | farewell party | fête d'adieu
            披露宴 ひろうえん | wedding reception | réception de mariage
            盆踊り ぼんおどり | Bon dance | danse de l'Obon
            還暦 かんれき | 60th birthday | 60e anniversaire
            彼岸 ひがん | equinox week | semaine de l'équinoxe
        """,
    },
}
