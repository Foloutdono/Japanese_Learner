"""
The thematic vocab decks, written by hand: each theme's words, placed in
its four levels and in order inside each level, easiest first.

One line a word: `漢字 かな | english | français`, or `かな | english |
français` for a word written in kana; a word the deck has no card for
adds `| español` (plan 291: a deck word reads the deck's own Spanish, a
pool word has no other). scripts/build_theme_db.py resolves
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
            バナナ | banana | banane | plátano, banana
            蜜柑 みかん | mandarin orange | mandarine | mandarina
            苺 いちご | strawberry | fraise | fresa, frutilla
            ぶどう | grapes | raisin
            桃 もも | peach | pêche | melocotón, durazno
            メロン | melon | melon | melón
            西瓜 すいか | watermelon | pastèque | sandía
            オレンジ | orange | orange
            レモン | lemon | citron | limón
        """,
        "medium": """
            梨 なし | pear | poire | pera
            桜ん坊 さくらんぼ | cherry | cerise | cereza
            パイナップル | pineapple | ananas | piña, ananá
            柿 かき | persimmon | kaki | caqui
            キウイ | kiwi | kiwi | kiwi
            マンゴー | mango | mangue | mango
            グレープフルーツ | grapefruit | pamplemousse | pomelo, toronja
            ブルーベリー | blueberry | myrtille | arándano azul
            梅 うめ | Japanese plum | prune japonaise
            栗 くり | chestnut | châtaigne | castaña
        """,
        "advanced": """
            柘榴 ざくろ | pomegranate | grenade | granada
            無花果 いちじく | fig | figue | higo
            ラズベリー | raspberry | framboise | frambuesa
            パパイヤ | papaya | papaye | papaya
            アボカド | avocado | avocat | aguacate, palta
            ココナッツ | coconut | noix de coco | coco
            杏 あんず | apricot | abricot | albaricoque, damasco
            プラム | plum | prune | ciruela
            柚 ゆず | yuzu | yuzu | yuzu
            ライチ | lychee | litchi | lichi
        """,
        "expert": """
            金柑 きんかん | kumquat | kumquat | kumquat, quinoto
            枇杷 びわ | loquat | nèfle du Japon | níspero japonés
            ドリアン | durian | durian | durián
            グアバ | guava | goyave | guayaba
            クランベリー | cranberry | canneberge | arándano rojo
            棗 なつめ | jujube | jujube | azufaifa
            ネクタリン | nectarine | nectarine | nectarina
            パッションフルーツ | passion fruit | fruit de la passion | maracuyá, fruta de la pasión
            ドラゴンフルーツ | dragon fruit | pitaya | pitaya, fruta del dragón
            文旦 ぶんたん | pomelo | pomélo | pomelo chino, pampelmusa
        """,
    },
    "vegetables": {
        "basic": """
            野菜 やさい | vegetable | légume
            トマト | tomato | tomate | tomate
            じゃが芋 じゃがいも | potato | pomme de terre | patata, papa
            人参 にんじん | carrot | carotte | zanahoria
            玉ねぎ たまねぎ | onion | oignon | cebolla
            キャベツ | cabbage | chou | repollo, col
            胡瓜 きゅうり | cucumber | concombre | pepino
            とうもろこし | corn | maïs | maíz
        """,
        "medium": """
            茄子 なす | eggplant | aubergine | berenjena
            ピーマン | green pepper | poivron | pimiento verde
            南瓜 かぼちゃ | pumpkin | potiron | calabaza
            レタス | lettuce | laitue | lechuga
            ほうれん草 ほうれんそう | spinach | épinards | espinacas
            大根 だいこん | daikon radish | radis daikon | rábano daikon
            葱 ねぎ | green onion | ciboule | cebolleta, cebollín
            さつま芋 さつまいも | sweet potato | patate douce | batata, camote
            豆 まめ | beans | haricots
            茸 きのこ | mushroom | champignon | hongo, seta
            白菜 はくさい | Chinese cabbage | chou chinois | col china
            にんにく | garlic | ail | ajo
        """,
        "advanced": """
            生姜 しょうが | ginger | gingembre | jengibre
            セロリ | celery | céleri | apio
            アスパラガス | asparagus | asperge | espárrago
            カリフラワー | cauliflower | chou-fleur | coliflor
            萌やし もやし | bean sprouts | germes de soja | brotes de soja
            枝豆 えだまめ | green soybeans | edamame | soja verde, edamame
            竹の子 たけのこ | bamboo shoot | pousse de bambou | brote de bambú
            椎茸 しいたけ | shiitake mushroom | shiitake | hongo shiitake
            オクラ | okra | gombo | okra, quimbombó
            ズッキーニ | zucchini | courgette | calabacín, zucchini
        """,
        "expert": """
            牛蒡 ごぼう | burdock root | bardane | bardana
            蓮根 れんこん | lotus root | racine de lotus | raíz de loto
            蕪 かぶ | turnip | navet | nabo
            里芋 さといも | taro | taro | taro
            山芋 やまいも | Japanese yam | igname | ñame japonés
            春菊 しゅんぎく | edible chrysanthemum | chrysanthème comestible | crisantemo comestible
            ビート | beet | betterave | remolacha, betabel
            韮 にら | garlic chives | ciboulette chinoise | cebollino chino
            茗荷 みょうが | myoga ginger | gingembre myoga | jengibre myoga
            クレソン | watercress | cresson | berro
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
            足首 あしくび | ankle | cheville | tobillo
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
            肝臓 かんぞう | liver | foie | hígado
            腎臓 じんぞう | kidney | rein | riñón
            腸 ちょう | intestines | intestins
            まぶた | eyelid | paupière
            まつ毛 まつげ | eyelash | cil | pestaña
            太もも ふともも | thigh | cuisse | muslo
            踵 かかと | heel | talon
            背骨 せぼね | spine | colonne vertébrale | columna vertebral
            骨盤 こつばん | pelvis | bassin | pelvis
            鎖骨 さこつ | collarbone | clavicule | clavícula
            関節 かんせつ | joint | articulation | articulación
            神経 しんけい | nerve | nerf
            動脈 どうみゃく | artery | artère | arteria
            静脈 じょうみゃく | vein | veine | vena
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
            寝室 しんしつ | bedroom | chambre | dormitorio, habitación
            居間 いま | living room | salon
            廊下 ろうか | corridor | couloir
            階段 かいだん | stairs | escalier
            食堂 しょくどう | dining room | salle à manger
            浴室 よくしつ | bathroom | salle de bain
            和室 わしつ | Japanese-style room | pièce à la japonaise | habitación de estilo japonés
            洋室 ようしつ | Western-style room | pièce à l'occidentale | habitación de estilo occidental
            押し入れ おしいれ | closet | placard
            車庫 しゃこ | garage | garage
            ベランダ | balcony | balcon | balcón
        """,
        "advanced": """
            屋根裏 やねうら | attic | grenier | ático, desván
            地下室 ちかしつ | basement | sous-sol | sótano
            書斎 しょさい | study | bureau
            客間 きゃくま | guest room | chambre d'amis
            物置 ものおき | storeroom | débarras
            洗面所 せんめんじょ | washroom | cabinet de toilette | cuarto del lavabo, aseo
            縁側 えんがわ | veranda | véranda
            子ども部屋 こどもべや | children's room | chambre d'enfant | cuarto de los niños
            天井 てんじょう | ceiling | plafond
        """,
        "expert": """
            床の間 とこのま | tokonoma | alcôve tokonoma
            土間 どま | earthen floor | sol en terre battue | suelo de tierra apisonada
            茶室 ちゃしつ | tea room | pavillon de thé | pabellón de té, sala de té
            仏間 ぶつま | altar room | pièce de l'autel | sala del altar budista
            勝手口 かってぐち | kitchen door | porte de service | puerta de servicio, puerta de la cocina
            中庭 なかにわ | courtyard | cour intérieure | patio interior
            踊り場 おどりば | landing | palier | rellano, descanso (de escalera)
            離れ はなれ | detached room | pavillon annexe | pabellón anexo
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
            体育館 たいいくかん | gymnasium | gymnase | gimnasio
        """,
        "advanced": """
            城 しろ | castle | château
            塔 とう | tower | tour
            警察署 けいさつしょ | police station | commissariat | comisaría, estación de policía
            市役所 しやくしょ | city hall | mairie | ayuntamiento, alcaldía
            大使館 たいしかん | embassy | ambassade
            劇場 げきじょう | theater | théâtre
            倉庫 そうこ | warehouse | entrepôt
            寮 りょう | dormitory | résidence étudiante
            旅館 りょかん | Japanese inn | auberge japonaise
            競技場 きょうぎじょう | stadium | stade | estadio
            刑務所 けいむしょ | prison | prison | prisión, cárcel
            消防署 しょうぼうしょ | fire station | caserne de pompiers
        """,
        "expert": """
            宮殿 きゅうでん | palace | palais
            灯台 とうだい | lighthouse | phare
            高層ビル こうそうビル | skyscraper | gratte-ciel | rascacielos
            修道院 しゅうどういん | monastery | monastère | monasterio
            大聖堂 だいせいどう | cathedral | cathédrale | catedral
            納屋 なや | barn | grange | granero
            温室 おんしつ | greenhouse | serre
            小屋 こや | hut | cabane
            天守閣 てんしゅかく | castle keep | donjon | torre del homenaje (de un castillo)
            長屋 ながや | row house | maisons mitoyennes | casas en hilera, casas adosadas
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
            食器棚 しょっきだな | china cabinet | vaisselier | alacena, aparador
            ベンチ | bench | banc
            ロッカー | locker | casier
        """,
        "expert": """
            鏡台 きょうだい | dressing table | coiffeuse | tocador
            屏風 びょうぶ | folding screen | paravent | biombo
            仏壇 ぶつだん | household altar | autel bouddhiste | altar budista doméstico
            衝立 ついたて | partition screen | cloison mobile | mampara
            掛け軸 かけじく | hanging scroll | rouleau suspendu | pergamino colgante
            ちゃぶ台 ちゃぶだい | low dining table | table basse | mesa baja (para comer)
            長椅子 ながいす | settee | banquette | banco largo, sofá
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
            部活 ぶかつ | club activities | club scolaire | club escolar, actividades de club
            遠足 えんそく | school excursion | sortie scolaire
            受験 じゅけん | taking an entrance exam | passer un concours
        """,
        "expert": """
            通知表 つうちひょう | report card | bulletin scolaire | boletín de calificaciones
            学費 がくひ | tuition | frais de scolarité | matrícula, gastos escolares
            修学旅行 しゅうがくりょこう | school trip | voyage scolaire | viaje escolar, viaje de estudios
            単位 たんい | credit | unité de valeur
            論文 ろんぶん | thesis | mémoire
            学位 がくい | degree | diplôme universitaire | título universitario, grado académico
            担任 たんにん | homeroom teacher | professeur principal | tutor de clase, profesor a cargo
            学園祭 がくえんさい | school festival | fête de l'école | festival escolar
            偏差値 へんさち | standard score | note standardisée | puntuación estandarizada
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
            観光客 かんこうきゃく | tourist | touriste | turista
            スーツケース | suitcase | valise
            温泉 おんせん | hot spring | source chaude
            両替 りょうがえ | currency exchange | change
            乗り換え のりかえ | transfer | correspondance
            時刻表 じこくひょう | timetable | horaires
            ホテル | hotel | hôtel
        """,
        "advanced": """
            税関 ぜいかん | customs | douane
            ビザ | visa | visa | visado, visa
            日帰り ひがえり | day trip | excursion d'une journée
            宿泊 しゅくはく | lodging | hébergement
            名所 めいしょ | famous sight | lieu célèbre
            往復 おうふく | round trip | aller-retour
            片道 かたみち | one way | aller simple
            搭乗券 とうじょうけん | boarding pass | carte d'embarquement | tarjeta de embarque
            ガイドブック | guidebook | guide touristique
        """,
        "expert": """
            入国審査 にゅうこくしんさ | immigration control | contrôle d'immigration | control de inmigración
            時差ぼけ じさぼけ | jet lag | décalage horaire | desfase horario, jet lag
            乗り継ぎ のりつぎ | layover | escale | escala, conexión
            旅程 りょてい | itinerary | itinéraire | itinerario
            民宿 みんしゅく | guesthouse | pension
            手荷物 てにもつ | hand luggage | bagage à main | equipaje de mano
            添乗員 てんじょういん | tour conductor | accompagnateur | guía acompañante
            野宿 のじゅく | sleeping outdoors | nuit à la belle étoile | dormir a la intemperie, dormir al raso
        """,
    },
    "jobs": {
        "basic": """
            仕事 しごと | job | travail
            医者 いしゃ | doctor | médecin
            警察官 けいさつかん | police officer | policier | agente de policía
            会社員 かいしゃいん | office worker | employé de bureau | empleado de oficina, oficinista
            店員 てんいん | shop clerk | vendeur
            歌手 かしゅ | singer | chanteur
            運転手 うんてんしゅ | driver | chauffeur
            看護師 かんごし | nurse | infirmier | enfermero
        """,
        "medium": """
            弁護士 べんごし | lawyer | avocat | abogado
            エンジニア | engineer | ingénieur
            料理人 りょうりにん | cook | cuisinier | cocinero
            消防士 しょうぼうし | firefighter | pompier | bombero
            農家 のうか | farmer | agriculteur
            俳優 はいゆう | actor | acteur
            作家 さっか | writer | écrivain
            記者 きしゃ | journalist | journaliste
            公務員 こうむいん | civil servant | fonctionnaire
            パイロット | pilot | pilote
            歯医者 はいしゃ | dentist | dentiste
        """,
        "advanced": """
            美容師 びようし | hairdresser | coiffeur | peluquero
            大工 だいく | carpenter | charpentier
            漁師 りょうし | fisherman | pêcheur
            建築家 けんちくか | architect | architecte | arquitecto
            通訳 つうやく | interpreter | interprète
            翻訳家 ほんやくか | translator | traducteur | traductor
            会計士 かいけいし | accountant | comptable | contable, contador
            獣医 じゅうい | veterinarian | vétérinaire | veterinario
            薬剤師 やくざいし | pharmacist | pharmacien | farmacéutico
            秘書 ひしょ | secretary | secrétaire
            司書 ししょ | librarian | bibliothécaire | bibliotecario
            写真家 しゃしんか | photographer | photographe | fotógrafo
        """,
        "expert": """
            板前 いたまえ | Japanese chef | chef de cuisine japonaise | cocinero de comida japonesa
            職人 しょくにん | craftsman | artisan
            外交官 がいこうかん | diplomat | diplomate | diplomático
            裁判官 さいばんかん | judge | juge | juez
            税理士 ぜいりし | tax accountant | conseiller fiscal | asesor fiscal
            配管工 はいかんこう | plumber | plombier | fontanero, plomero
            庭師 にわし | gardener | jardinier | jardinero
            学芸員 がくげいいん | museum curator | conservateur de musée | conservador de museo
            鍛冶屋 かじや | blacksmith | forgeron | herrero
            整備士 せいびし | mechanic | mécanicien | mecánico
        """,
    },
    "dishes": {
        "basic": """
            料理 りょうり | dish | plat
            御飯 ごはん | cooked rice | riz
            パン | bread | pain
            寿司 すし | sushi | sushi | sushi
            ラーメン | ramen | ramen | ramen
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
            天ぷら てんぷら | tempura | tempura | tempura
            おにぎり | rice ball | boulette de riz | bola de arroz
            味噌汁 みそしる | miso soup | soupe miso | sopa de miso
            弁当 べんとう | boxed lunch | bento
            ハンバーガー | hamburger | hamburger | hamburguesa
            ピザ | pizza | pizza | pizza
            サラダ | salad | salade
            スープ | soup | soupe
            焼き肉 やきにく | grilled meat | viande grillée | carne a la parrilla
            アイスクリーム | ice cream | glace
        """,
        "advanced": """
            すき焼き すきやき | sukiyaki | sukiyaki | sukiyaki
            しゃぶしゃぶ | shabu-shabu | shabu-shabu | shabu-shabu
            刺身 さしみ | sashimi | sashimi
            丼 どんぶり | rice bowl dish | bol de riz garni
            餃子 ギョーザ | gyoza | gyoza | gyoza
            焼き鳥 やきとり | yakitori | yakitori | yakitori
            お好み焼き おこのみやき | okonomiyaki | okonomiyaki | okonomiyaki
            鍋 なべ | hot pot | fondue japonaise
            たこ焼き たこやき | takoyaki | takoyaki | takoyaki
            グラタン | gratin | gratin | gratinado
            シチュー | stew | ragoût | guiso, estofado
        """,
        "expert": """
            茶碗蒸し ちゃわんむし | savory egg custard | flan salé | flan salado de huevo
            懐石 かいせき | kaiseki | kaiseki | kaiseki
            雑炊 ぞうすい | rice porridge | soupe de riz | sopa de arroz
            茶漬け ちゃづけ | ochazuke | ochazuke | ochazuke
            精進料理 しょうじんりょうり | Buddhist vegetarian cuisine | cuisine végétarienne bouddhiste | cocina vegetariana budista
            おでん | oden | oden | oden
            たい焼き たいやき | taiyaki | taiyaki | taiyaki
            冷奴 ひややっこ | chilled tofu | tofu froid | tofu frío
            肉じゃが にくじゃが | meat and potato stew | ragoût de bœuf et pommes de terre | guiso de carne y papas (patatas)
        """,
    },
    "animals": {
        "basic": """
            動物 どうぶつ | animal | animal
            犬 いぬ | dog | chien
            猫 ねこ | cat | chat
            馬 うま | horse | cheval
            牛 うし | cow | vache
            豚 ぶた | pig | cochon | cerdo
            兎 うさぎ | rabbit | lapin
            鼠 ねずみ | mouse | souris
            猿 さる | monkey | singe
            熊 くま | bear | ours | oso
            ライオン | lion | lion | león
            象 ぞう | elephant | éléphant
        """,
        "medium": """
            虎 とら | tiger | tigre
            羊 ひつじ | sheep | mouton | oveja
            鹿 しか | deer | cerf | ciervo, venado
            狐 きつね | fox | renard | zorro
            蛇 へび | snake | serpent | serpiente
            亀 かめ | turtle | tortue | tortuga
            蛙 かえる | frog | grenouille | rana
            麒麟 きりん | giraffe | girafe | jirafa
            パンダ | panda | panda | panda
            狼 おおかみ | wolf | loup | lobo
            山羊 やぎ | goat | chèvre | cabra
            ペット | pet | animal de compagnie
        """,
        "advanced": """
            鯨 くじら | whale | baleine | ballena
            いるか | dolphin | dauphin | delfín
            狸 たぬき | raccoon dog | chien viverrin | perro mapache (tanuki)
            栗鼠 りす | squirrel | écureuil | ardilla
            縞馬 しまうま | zebra | zèbre | cebra
            カンガルー | kangaroo | kangourou | canguro
            コアラ | koala | koala | koala
            駱駝 らくだ | camel | chameau | camello
            ゴリラ | gorilla | gorille | gorila
            鰐 わに | crocodile | crocodile | cocodrilo
            驢馬 ろば | donkey | âne | burro, asno
            猪 いのしし | wild boar | sanglier | jabalí
        """,
        "expert": """
            豹 ひょう | leopard | léopard | leopardo
            犀 さい | rhinoceros | rhinocéros | rinoceronte
            河馬 かば | hippopotamus | hippopotame | hipopótamo
            針鼠 はりねずみ | hedgehog | hérisson | erizo
            川獺 かわうそ | otter | loutre | nutria
            鼬 いたち | weasel | belette | comadreja
            あらいぐま | raccoon | raton laveur | mapache
            蜥蜴 とかげ | lizard | lézard | lagarto, lagartija
            土竜 もぐら | mole | taupe | topo
            蝙蝠 こうもり | bat | chauve-souris | murciélago
            哺乳類 ほにゅうるい | mammal | mammifère | mamífero
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
            水色 みずいろ | light blue | bleu clair | azul claro, celeste
            金色 きんいろ | gold | doré | dorado
            銀色 ぎんいろ | silver | argenté | plateado
        """,
        "advanced": """
            紺 こん | navy blue | bleu marine
            ベージュ | beige | beige | beige
            黄緑 きみどり | yellowish green | vert-jaune | verde amarillento
            真っ赤 まっか | bright red | rouge vif
            真っ白 まっしろ | pure white | blanc immaculé
            真っ黒 まっくろ | pitch black | noir de jais
            真っ青 まっさお | deep blue | bleu profond
            透明 とうめい | transparent | transparent
        """,
        "expert": """
            朱色 しゅいろ | vermilion | vermillon | bermellón
            藍色 あいいろ | indigo | indigo | añil, índigo
            紅 くれない | crimson | cramoisi | carmesí
            群青 ぐんじょう | ultramarine | outremer | azul ultramar
            ねずみ色 ねずみいろ | dove gray | gris souris | gris ratón
            小豆色 あずきいろ | reddish brown | brun rougeâtre | marrón rojizo
            山吹色 やまぶきいろ | golden yellow | jaune d'or | amarillo dorado
            黄土色 おうどいろ | ochre | ocre | ocre
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
            Ｔシャツ ティーシャツ | T-shirt | tee-shirt | camiseta
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
            水着 みずぎ | swimsuit | maillot de bain | traje de baño, bañador
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
            袴 はかま | hakama | hakama | hakama
            羽織 はおり | haori jacket | veste de kimono | chaqueta de kimono
            裾 すそ | hem | ourlet
            喪服 もふく | mourning clothes | vêtements de deuil | ropa de luto
            晴れ着 はれぎ | one's best clothes | habits de fête | ropa de fiesta, de gala
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
            俄雨 にわかあめ | sudden shower | averse | chubasco, aguacero
            稲妻 いなずま | lightning | éclair | relámpago, rayo
            吹雪 ふぶき | snowstorm | tempête de neige
            霧雨 きりさめ | drizzle | bruine | llovizna
            大雪 おおゆき | heavy snow | fortes chutes de neige | fuerte nevada
            猛暑 もうしょ | heat wave | canicule | ola de calor, calor extremo
            洪水 こうずい | flood | inondation
            竜巻 たつまき | tornado | tornade | tornado
            露 つゆ | dew | rosée
        """,
        "expert": """
            雹 ひょう | hail | grêle | granizo
            霙 みぞれ | sleet | neige fondue | aguanieve
            木枯らし こがらし | cold winter wind | bise d'hiver | viento frío de invierno
            春一番 はるいちばん | first spring gale | premier vent du printemps | primer vendaval de primavera
            小春日和 こはるびより | Indian summer | été indien | veranillo de San Martín
            霞 かすみ | haze | brume | bruma, neblina
            陽炎 かげろう | heat shimmer | mirage de chaleur | reverberación del calor
            時雨 しぐれ | late-autumn shower | averse d'automne | chubasco de finales de otoño
            低気圧 ていきあつ | low pressure | dépression | baja presión, borrasca
            高気圧 こうきあつ | high pressure | anticyclone | anticiclón, alta presión
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
            叔父 おじ | uncle | oncle | tío
            叔母 おば | aunt | tante | tía
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
            一人っ子 ひとりっこ | only child | enfant unique | hijo único
            先祖 せんぞ | ancestor | ancêtre
        """,
        "expert": """
            義母 ぎぼ | mother-in-law | belle-mère | suegra
            義父 ぎふ | father-in-law | beau-père | suegro
            曽祖父 そうそふ | great-grandfather | arrière-grand-père | bisabuelo
            曾祖母 そうそぼ | great-grandmother | arrière-grand-mère | bisabuela
            嫁 よめ | daughter-in-law | belle-fille
            婿 むこ | son-in-law | gendre
            配偶者 はいぐうしゃ | spouse | conjoint
            子孫 しそん | descendant | descendant
            身内 みうち | one's kin | les siens | familiares, los suyos
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
            悲しみ かなしみ | sorrow | chagrin | tristeza, pena
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
            羨望 せんぼう | envy | envie | envidia
            憂鬱 ゆううつ | melancholy | mélancolie
            屈辱 くつじょく | humiliation | humiliation | humillación
            憤り いきどおり | indignation | indignation | indignación
            安堵 あんど | relief | soulagement | alivio
            戸惑い とまどい | bewilderment | désarroi | desconcierto, perplejidad
            焦り あせり | impatience | fébrilité | impaciencia, nerviosismo
            罪悪感 ざいあくかん | guilt | culpabilité | sentimiento de culpa
            劣等感 れっとうかん | inferiority complex | complexe d'infériorité | complejo de inferioridad
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
            洞窟 どうくつ | cave | grotte | cueva, caverna
            崖 がけ | cliff | falaise
            沼 ぬま | swamp | marais
            地平線 ちへいせん | horizon | horizon
            水平線 すいへいせん | sea horizon | ligne d'horizon marine
            草原 そうげん | grassland | prairie | pradera, pastizal
            小川 おがわ | brook | ruisseau | arroyo
            泉 いずみ | spring | source
            潮 しお | tide | marée | marea
            峠 とうげ | mountain pass | col
            氷河 ひょうが | glacier | glacier | glaciar
        """,
        "expert": """
            渓谷 けいこく | ravine | gorge | cañón, desfiladero
            湿原 しつげん | wetland | zone humide | humedal
            岬 みさき | cape | cap
            入り江 いりえ | inlet | crique | cala, ensenada
            干潟 ひがた | tidal flat | estran | llanura de marea
            鍾乳洞 しょうにゅうどう | limestone cave | grotte calcaire | cueva de estalactitas
            樹海 じゅかい | sea of trees | océan d'arbres | mar de árboles
            サンゴ礁 さんごしょう | coral reef | récif corallien | arrecife de coral
            尾根 おね | ridge | crête | cresta (de montaña)
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
            バイク | motorbike | moto | moto
            救急車 きゅうきゅうしゃ | ambulance | ambulance | ambulancia
            消防車 しょうぼうしゃ | fire engine | camion de pompiers | camión de bomberos
            パトカー | police car | voiture de police
            ボート | rowboat | barque
            ヘリコプター | helicopter | hélicoptère
            フェリー | ferry | ferry
        """,
        "advanced": """
            路面電車 ろめんでんしゃ | streetcar | tramway | tranvía
            モノレール | monorail | monorail
            ヨット | yacht | voilier
            潜水艦 せんすいかん | submarine | sous-marin | submarino
            戦車 せんしゃ | tank | char d'assaut | tanque (de guerra)
            ロケット | rocket | fusée
            スクーター | scooter | scooter | scooter, motoneta
            一輪車 いちりんしゃ | unicycle | monocycle | monociclo
            ケーブルカー | cable car | funiculaire | funicular
            ロープウェイ | ropeway | téléphérique | teleférico
        """,
        "expert": """
            人力車 じんりきしゃ | rickshaw | pousse-pousse | rickshaw
            屋形船 やかたぶね | pleasure boat | bateau de plaisance | barco de recreo
            馬車 ばしゃ | carriage | calèche | carruaje, coche de caballos
            筏 いかだ | raft | radeau | balsa
            カヌー | canoe | canoë | canoa
            霊柩車 れいきゅうしゃ | hearse | corbillard | coche fúnebre
            宇宙船 うちゅうせん | spaceship | vaisseau spatial | nave espacial
            ブルドーザー | bulldozer | bulldozer | bulldozer
            寝台車 しんだいしゃ | sleeping car | wagon-lit | coche cama
        """,
    },
    "technology": {
        "basic": """
            パソコン | computer | ordinateur
            電話 でんわ | telephone | téléphone
            スマホ | smartphone | smartphone
            テレビ | television | télévision
            カメラ | camera | appareil photo
            インターネット | internet | internet | internet
            電気 でんき | electricity | électricité
            メール | email | e-mail
        """,
        "medium": """
            携帯電話 けいたいでんわ | mobile phone | téléphone portable | teléfono móvil, celular
            ラジオ | radio | radio
            ロボット | robot | robot | robot
            電池 でんち | battery | pile
            画面 がめん | screen | écran | pantalla
            キーボード | keyboard | clavier | teclado
            プリンタ | printer | imprimante | impresora
            アプリ | app | application | aplicación, app
            パスワード | password | mot de passe | contraseña
            機械 きかい | machine | machine
        """,
        "advanced": """
            ソフトウェア | software | logiciel | software
            データ | data | données
            ファイル | file | fichier
            ネットワーク | network | réseau | red
            充電器 じゅうでんき | charger | chargeur | cargador
            イヤホン | earphones | écouteurs | auriculares, audífonos
            タブレット | tablet | tablette | tableta
            スピーカー | speaker | haut-parleur
            マイク | microphone | micro
            人工知能 じんこうちのう | artificial intelligence | intelligence artificielle | inteligencia artificial
            衛星 えいせい | satellite | satellite
        """,
        "expert": """
            アルゴリズム | algorithm | algorithme | algoritmo
            サーバー | server | serveur | servidor
            データベース | database | base de données | base de datos
            プロセッサー | processor | processeur | procesador
            半導体 はんどうたい | semiconductor | semi-conducteur | semiconductor
            回路 かいろ | circuit | circuit
            暗号 あんごう | cipher | chiffrement | cifrado, código secreto
            周波数 しゅうはすう | frequency | fréquence | frecuencia
            センサー | sensor | capteur | sensor
            アンテナ | antenna | antenne
        """,
    },
    "sports": {
        "basic": """
            スポーツ | sport | sport
            サッカー | soccer | football | fútbol
            野球 やきゅう | baseball | baseball | béisbol
            テニス | tennis | tennis
            水泳 すいえい | swimming | natation
            試合 しあい | match | match
            ボール | ball | ballon
        """,
        "medium": """
            バスケットボール | basketball | basket-ball | baloncesto, básquetbol
            バレーボール | volleyball | volley-ball | voleibol
            柔道 じゅうどう | judo | judo
            空手 からて | karate | karaté | karate
            相撲 すもう | sumo | sumo
            スキー | skiing | ski
            ゴルフ | golf | golf | golf
            マラソン | marathon | marathon
            卓球 たっきゅう | table tennis | tennis de table | tenis de mesa, ping-pong
            選手 せんしゅ | player | joueur
            体操 たいそう | gymnastics | gymnastique
            スケート | skating | patinage
        """,
        "advanced": """
            ラグビー | rugby | rugby | rugby
            バドミントン | badminton | badminton | bádminton
            ボクシング | boxing | boxe | boxeo
            剣道 けんどう | kendo | kendo | kendo
            陸上競技 りくじょうきょうぎ | track and field | athlétisme | atletismo
            審判 しんぱん | referee | arbitre
            優勝 ゆうしょう | championship victory | victoire finale
            監督 かんとく | coach | entraîneur
            大会 たいかい | tournament | tournoi
            レスリング | wrestling | lutte | lucha
            サーフィン | surfing | surf | surf
            登山 とざん | mountain climbing | alpinisme
        """,
        "expert": """
            フェンシング | fencing | escrime | esgrima
            弓道 きゅうどう | kyudo | kyudo | kyudo
            合気道 あいきどう | aikido | aïkido | aikido
            アーチェリー | archery | tir à l'arc | tiro con arco
            棒高跳び ぼうたかとび | pole vault | saut à la perche | salto con pértiga, salto con garrocha
            競歩 きょうほ | race walking | marche athlétique | marcha atlética
            三段跳び さんだんとび | triple jump | triple saut | triple salto
            横綱 よこづな | yokozuna | yokozuna
            延長戦 えんちょうせん | overtime | prolongations | prórroga, tiempo extra
            十種競技 じっしゅきょうぎ | decathlon | décathlon | decatlón
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
            ドラム | drums | batterie | batería
            バンド | band | groupe
            リズム | rhythm | rythme
            メロディー | melody | mélodie
            歌詞 かし | lyrics | paroles | letra (de una canción)
            合唱 がっしょう | chorus | chœur
            フルート | flute | flûte | flauta
            トランペット | trumpet | trompette | trompeta
            太鼓 たいこ | Japanese drum | tambour japonais
        """,
        "advanced": """
            オーケストラ | orchestra | orchestre
            作曲家 さっきょくか | composer | compositeur | compositor
            指揮者 しきしゃ | conductor | chef d'orchestre | director de orquesta
            楽譜 がくふ | sheet music | partition
            チェロ | cello | violoncelle | violonchelo, chelo
            サックス | saxophone | saxophone | saxofón, saxo
            ハーモニカ | harmonica | harmonica | armónica
            民謡 みんよう | folk song | chanson folklorique
            国歌 こっか | national anthem | hymne national | himno nacional
            演奏 えんそう | musical performance | interprétation
            オペラ | opera | opéra | ópera
            交響曲 こうきょうきょく | symphony | symphonie | sinfonía
        """,
        "expert": """
            三味線 しゃみせん | shamisen | shamisen | shamisen
            琴 こと | koto | koto
            尺八 しゃくはち | shakuhachi | shakuhachi | shakuhachi
            和音 わおん | chord | accord | acorde
            音程 おんてい | pitch interval | intervalle | intervalo
            拍子 ひょうし | time signature | mesure | compás
            独奏 どくそう | solo | solo | solo
            協奏曲 きょうそうきょく | concerto | concerto | concierto
            雅楽 ががく | gagaku | musique de cour | gagaku, música de corte
            ハープ | harp | harpe | arpa
            クラリネット | clarinet | clarinette | clarinete
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
            電子レンジ でんしレンジ | microwave oven | micro-ondes | horno microondas
            オーブン | oven | four | horno
            まな板 まないた | cutting board | planche à découper | tabla de cortar
            カップ | cup | tasse
            炊飯器 すいはんき | rice cooker | cuiseur à riz | arrocera
            流し ながし | sink | évier
        """,
        "advanced": """
            お玉 おたま | ladle | louche | cucharón, cazo
            急須 きゅうす | teapot | théière | tetera
            蓋 ふた | lid | couvercle
            トレー | tray | plateau | bandeja
            食器 しょっき | tableware | vaisselle
            笊 ざる | strainer | passoire | colador, escurridor
            泡だて器 あわだてき | whisk | fouet | batidor de varillas
            栓抜き せんぬき | bottle opener | décapsuleur | abrebotellas, destapador
            缶切り かんきり | can opener | ouvre-boîte | abrelatas
            食器洗い機 しょっきあらいき | dishwasher | lave-vaisselle | lavavajillas, lavaplatos
        """,
        "expert": """
            すり鉢 すりばち | mortar | mortier | mortero
            すりこ木 すりこぎ | pestle | pilon | mano de mortero
            おろし金 おろしがね | grater | râpe | rallador
            土鍋 どなべ | earthenware pot | marmite en terre | olla de barro
            蒸し器 むしき | steamer | cuit-vapeur | vaporera
            杓文字 しゃもじ | rice paddle | spatule à riz | pala para el arroz
            菜箸 さいばし | cooking chopsticks | baguettes de cuisine | palillos de cocina
            麺棒 めんぼう | rolling pin | rouleau à pâtisserie | rodillo de amasar
            換気扇 かんきせん | extractor fan | hotte | extractor de aire, campana extractora
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
            電卓 でんたく | calculator | calculatrice | calculadora
            メモ | memo | note
        """,
        "advanced": """
            ホッチキス | stapler | agrafeuse | grapadora, engrapadora
            クリップ | paper clip | trombone | clip, sujetapapeles
            万年筆 まんねんひつ | fountain pen | stylo-plume
            筆箱 ふでばこ | pencil case | trousse | estuche, cartuchera
            付箋 ふせん | sticky note | post-it | nota adhesiva
            修正液 しゅうせいえき | correction fluid | correcteur liquide | líquido corrector
            蛍光ペン けいこうペン | highlighter | surligneur | marcador fluorescente, resaltador
            文房具 ぶんぼうぐ | stationery | papeterie
            画鋲 がびょう | thumbtack | punaise | chincheta, chinche
            印鑑 いんかん | personal seal | sceau personnel
        """,
        "expert": """
            朱肉 しゅにく | vermilion ink pad | tampon encreur | almohadilla de tinta bermellón
            カッター | box cutter | cutter | cúter, cortador
            輪ゴム わゴム | rubber band | élastique | goma elástica, liga
            分度器 ぶんどき | protractor | rapporteur | transportador
            便箋 びんせん | letter paper | papier à lettres
            墨 すみ | ink stick | bâton d'encre
            硯 すずり | inkstone | pierre à encre | piedra de tinta
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
            スーパー | supermarket | supermarché | supermercado
        """,
        "medium": """
            現金 げんきん | cash | espèces
            コンビニ | convenience store | supérette
            デパート | department store | grand magasin
            レシート | receipt | ticket de caisse | tique de caja, recibo
            おつり | change | monnaie rendue
            セール | sale | soldes
            割引 わりびき | discount | réduction
            税金 ぜいきん | tax | impôt
            給料 きゅうりょう | salary | salaire
            硬貨 こうか | coin | pièce de monnaie
            お札 おさつ | banknote | billet de banque | billete (de banco)
            レジ | cash register | caisse
        """,
        "advanced": """
            貯金 ちょきん | savings | épargne
            客 きゃく | customer | client
            クレジットカード | credit card | carte de crédit | tarjeta de crédito
            消費税 しょうひぜい | consumption tax | TVA | impuesto al consumo, IVA
            領収書 りょうしゅうしょ | official receipt | reçu | recibo oficial, comprobante
            予算 よさん | budget | budget
            借金 しゃっきん | debt | dette
            返品 へんぴん | returned goods | article retourné | devolución (de un artículo)
            送料 そうりょう | shipping fee | frais de port
            定価 ていか | list price | prix catalogue
        """,
        "expert": """
            為替 かわせ | exchange rate | taux de change
            利子 りし | interest | intérêts
            分割払い ぶんかつばらい | installment payment | paiement échelonné | pago a plazos, pago en cuotas
            前払い まえばらい | advance payment | paiement d'avance | pago por adelantado
            福袋 ふくぶくろ | lucky bag | sac surprise | bolsa sorpresa
            品切れ しなぎれ | out of stock | rupture de stock | agotado, sin existencias
            小銭 こぜに | small change | petite monnaie
            請求書 せいきゅうしょ | invoice | facture | factura
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
            島国 しまぐに | island nation | pays insulaire | país insular
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
            半球 はんきゅう | hemisphere | hémisphère | hemisferio
            標高 ひょうこう | altitude | altitude | altitud
            植民地 しょくみんち | colony | colonie
            太平洋 たいへいよう | Pacific Ocean | océan Pacifique | océano Pacífico
            大西洋 たいせいよう | Atlantic Ocean | océan Atlantique | océano Atlántico
            地形 ちけい | terrain | relief
            三角州 さんかくす | delta | delta | delta
        """,
    },
    "insects_bugs": {
        "basic": """
            虫 むし | insect | insecte
            蝶 ちょう | butterfly | papillon
            蚊 か | mosquito | moustique
            蟻 あり | ant | fourmi | hormiga
            蜂 はち | bee | abeille | abeja
            蜘蛛 くも | spider | araignée | araña
            蠅 はえ | fly | mouche | mosca
        """,
        "medium": """
            蜻蛉 とんぼ | dragonfly | libellule | libélula
            蝉 せみ | cicada | cigale | cigarra, chicharra
            ゴキブリ | cockroach | cafard | cucaracha
            甲虫 かぶとむし | rhinoceros beetle | scarabée rhinocéros | escarabajo rinoceronte
            てんとう虫 てんとうむし | ladybug | coccinelle | mariquita, catarina
            バッタ | grasshopper | sauterelle | saltamontes
            蛍 ほたる | firefly | luciole | luciérnaga
            蛾 が | moth | papillon de nuit | polilla
            ミミズ | earthworm | ver de terre | lombriz de tierra
            蝸牛 かたつむり | snail | escargot | caracol
        """,
        "advanced": """
            毛虫 けむし | caterpillar | chenille | oruga peluda
            幼虫 ようちゅう | larva | larve | larva
            蟋蟀 こおろぎ | cricket | grillon | grillo
            蟷螂 かまきり | praying mantis | mante religieuse | mantis religiosa
            鍬形虫 くわがたむし | stag beetle | lucane | ciervo volante
            蚕 かいこ | silkworm | ver à soie | gusano de seda
            百足 むかで | centipede | mille-pattes | ciempiés
            スズメバチ | hornet | frelon | avispón
            蚤 のみ | flea | puce | pulga
            ダニ | mite | acarien | ácaro, garrapata
        """,
        "expert": """
            蛹 さなぎ | pupa | chrysalide | crisálida, pupa
            白蟻 しろあり | termite | termite | termita
            蠍 さそり | scorpion | scorpion | escorpión, alacrán
            水黽 あめんぼ | water strider | gerris | zapatero (insecto acuático)
            鈴虫 すずむし | bell cricket | grillon chanteur | grillo cantor
            蜉蝣 かげろう | mayfly | éphémère | efímera (insecto)
            蛞蝓 なめくじ | slug | limace | babosa
            虱 しらみ | louse | pou | piojo
            触角 しょっかく | antenna | antenne | antena
        """,
    },
    "birds": {
        "basic": """
            鳥 とり | bird | oiseau
            鶏 にわとり | chicken | poule | gallina, gallo
            烏 からす | crow | corbeau | cuervo
            鳩 はと | pigeon | pigeon | paloma
            雀 すずめ | sparrow | moineau | gorrión
            ペンギン | penguin | manchot | pingüino
            アヒル | duck | canard | pato (doméstico)
        """,
        "medium": """
            白鳥 はくちょう | swan | cygne | cisne
            鷲 わし | eagle | aigle | águila
            鷹 たか | hawk | épervier | azor, gavilán
            梟 ふくろう | owl | hibou | búho, lechuza
            鸚鵡 おうむ | parrot | perroquet | loro, papagayo
            鶴 つる | crane | grue | grulla
            燕 つばめ | swallow | hirondelle | golondrina
            羽 はね | feather | plume
            翼 つばさ | wing | aile
            巣 す | nest | nid
            嘴 くちばし | beak | bec
            雛 ひな | chick | poussin
        """,
        "advanced": """
            孔雀 くじゃく | peacock | paon | pavo real
            カモメ | seagull | mouette | gaviota
            隼 はやぶさ | falcon | faucon | halcón
            駝鳥 だちょう | ostrich | autruche | avestruz
            フラミンゴ | flamingo | flamant rose | flamenco
            啄木鳥 きつつき | woodpecker | pic | pájaro carpintero
            鶯 うぐいす | bush warbler | bouscarle | cetia japonesa, ruiseñor japonés
            金糸雀 カナリア | canary | canari | canario
            鴨 かも | wild duck | canard sauvage | pato salvaje, ánade
            鷺 さぎ | heron | héron | garza
            雉 きじ | pheasant | faisan | faisán
        """,
        "expert": """
            鴇 とき | crested ibis | ibis nippon | ibis nipón
            鵜 う | cormorant | cormoran | cormorán
            雲雀 ひばり | skylark | alouette | alondra
            渡り鳥 わたりどり | migratory bird | oiseau migrateur
            猛禽 もうきん | bird of prey | rapace | ave rapaz
            鶉 うずら | quail | caille | codorniz
            鴛鴦 おしどり | mandarin duck | canard mandarin | pato mandarín
            ペリカン | pelican | pélican | pelícano
            鳶 とび | black kite | milan noir | milano negro
        """,
    },
    "seafood": {
        "basic": """
            魚 さかな | fish | poisson
            海老 えび | shrimp | crevette | gamba, camarón
            蟹 かに | crab | crabe | cangrejo
            イカ | squid | calmar | calamar
            蛸 たこ | octopus | poulpe | pulpo
            鮪 まぐろ | tuna | thon | atún
            鮭 さけ | salmon | saumon | salmón
            貝 かい | shellfish | coquillage
        """,
        "medium": """
            鰻 うなぎ | eel | anguille | anguila
            鯛 たい | sea bream | dorade | besugo, pargo
            鰯 いわし | sardine | sardine | sardina
            鯖 さば | mackerel | maquereau | caballa
            牡蠣 かき | oyster | huître | ostra
            帆立 ほたて | scallop | coquille Saint-Jacques | vieira
            海苔 のり | nori seaweed | algue nori | alga nori
            若布 わかめ | wakame seaweed | algue wakame | alga wakame
            海藻 かいそう | seaweed | algue | alga marina
            浅蜊 あさり | short-neck clam | palourde | almeja
        """,
        "advanced": """
            鯵 あじ | horse mackerel | chinchard | jurel
            秋刀魚 さんま | Pacific saury | balaou du Japon | paparda del Pacífico
            鰤 ぶり | yellowtail | sériole | serviola, medregal
            鰹 かつお | bonito | bonite | bonito
            うに | sea urchin | oursin | erizo de mar
            イクラ | salmon roe | œufs de saumon | huevas de salmón
            鱈 たら | cod | cabillaud | bacalao
            昆布 こんぶ | kelp | kombu | alga kombu
            平目 ひらめ | flounder | cardeau | lenguado
            海鼠 なまこ | sea cucumber | concombre de mer | pepino de mar
        """,
        "expert": """
            鮑 あわび | abalone | ormeau | abulón, oreja de mar
            河豚 ふぐ | pufferfish | fugu | pez globo, fugu
            数の子 かずのこ | herring roe | œufs de hareng | huevas de arenque
            明太子 めんたいこ | spicy cod roe | œufs de colin épicés | huevas picantes de abadejo
            鰹節 かつおぶし | dried bonito | bonite séchée | bonito seco
            伊勢海老 いせえび | spiny lobster | langouste | langosta
            穴子 あなご | conger eel | congre | congrio
            鮎 あゆ | sweetfish | ayu | ayu
            白子 しらこ | milt | laitance | lecha (de pescado)
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
            緑茶 りょくちゃ | green tea | thé vert | té verde
            ワイン | wine | vin
            お湯 おゆ | hot water | eau chaude | agua caliente
            コーラ | cola | cola | refresco de cola
            日本酒 にほんしゅ | sake | saké | sake
            麦茶 むぎちゃ | barley tea | thé d'orge | té de cebada
            ココア | cocoa | chocolat chaud | chocolate caliente
            ウイスキー | whisky | whisky
        """,
        "advanced": """
            抹茶 まっちゃ | matcha | matcha | matcha
            ウーロン茶 ウーロンちゃ | oolong tea | thé oolong | té oolong
            炭酸水 たんさんすい | sparkling water | eau gazeuse | agua con gas
            焼酎 しょうちゅう | shochu | shochu | shochu
            カクテル | cocktail | cocktail
            シャンパン | champagne | champagne | champán
            ほうじ茶 ほうじちゃ | roasted green tea | thé vert torréfié | té verde tostado
            レモネード | lemonade | limonade | limonada
            豆乳 とうにゅう | soy milk | lait de soja | leche de soja, de soya
            甘酒 あまざけ | amazake | amazake | amazake
        """,
        "expert": """
            梅酒 うめしゅ | plum wine | liqueur de prune | licor de ciruela
            玄米茶 げんまいちゃ | genmaicha | genmaicha | genmaicha
            番茶 ばんちゃ | coarse green tea | bancha | bancha, té verde corriente
            泡盛 あわもり | awamori | awamori | awamori
            地ビール じビール | craft beer | bière artisanale | cerveza artesanal
            熱燗 あつかん | hot sake | saké chaud | sake caliente
            白湯 さゆ | plain boiled water | eau bouillie | agua hervida
            カフェオレ | café au lait | café au lait | café con leche
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
            ハート | heart shape | cœur | corazón (forma)
        """,
        "advanced": """
            楕円 だえん | oval | ovale
            円柱 えんちゅう | cylinder | cylindre | cilindro
            立方体 りっぽうたい | cube | cube | cubo
            円錐 えんすい | cone | cône | cono
            渦巻き うずまき | spiral | spirale | espiral
            半円 はんえん | semicircle | demi-cercle | semicírculo
            対角線 たいかくせん | diagonal | diagonale | diagonal
            直角 ちょっかく | right angle | angle droit
            ピラミッド | pyramid | pyramide | pirámide
            菱形 ひしがた | diamond | losange | rombo
            六角形 ろっかっけい | hexagon | hexagone | hexágono
        """,
        "expert": """
            五角形 ごかくけい | pentagon | pentagone | pentágono
            八角形 はっかくけい | octagon | octogone | octógono
            台形 だいけい | trapezoid | trapèze | trapecio
            平行四辺形 へいこうしへんけい | parallelogram | parallélogramme | paralelogramo
            多角形 たかくけい | polygon | polygone | polígono
            扇形 おうぎがた | fan shape | éventail | abanico, sector circular
            同心円 どうしんえん | concentric circles | cercles concentriques | círculos concéntricos
            弧 こ | arc | arc | arco
            放物線 ほうぶつせん | parabola | parabole | parábola
            対称 たいしょう | symmetry | symétrie | simetría
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
            鋼 はがね | steel | acier | acero
            アルミ | aluminum | aluminium
            コンクリート | concrete | béton
        """,
        "advanced": """
            大理石 だいりせき | marble | marbre | mármol
            陶器 とうき | earthenware | faïence
            磁器 じき | porcelain | porcelaine
            粘土 ねんど | clay | argile | arcilla
            煉瓦 れんが | brick | brique
            鉛 なまり | lead | plomb
            セメント | cement | ciment
            青銅 せいどう | bronze | bronze | bronce
            ナイロン | nylon | nylon
            段ボール だんボール | cardboard | carton | cartón
        """,
        "expert": """
            真鍮 しんちゅう | brass | laiton | latón
            錫 すず | tin | étain | estaño
            亜鉛 あえん | zinc | zinc | zinc
            白金 はっきん | platinum | platine | platino
            漆 うるし | lacquer | laque | laca
            和紙 わし | Japanese paper | papier japonais | papel japonés
            合板 ごうはん | plywood | contreplaqué | madera contrachapada
            石膏 せっこう | plaster | plâtre | yeso
            ステンレス | stainless steel | inox | acero inoxidable
        """,
    },
    "tools": {
        "basic": """
            道具 どうぐ | tool | outil
            ハンマー | hammer | marteau | martillo
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
            スコップ | shovel | pelle | pala
            斧 おの | axe | hache | hacha
            鎖 くさり | chain | chaîne
            バケツ | bucket | seau
            懐中電灯 かいちゅうでんとう | flashlight | lampe de poche | linterna
            接着剤 せっちゃくざい | adhesive | adhésif | adhesivo, pegamento
        """,
        "advanced": """
            ペンチ | pliers | pince
            スパナ | spanner | clé plate | llave fija
            ドリル | drill | perceuse
            鎌 かま | sickle | faucille | hoz
            鍬 くわ | hoe | houe | azada, azadón
            鑢 やすり | file | lime | lima
            紙やすり かみやすり | sandpaper | papier de verre | papel de lija, lija
            ボルト | bolt | boulon
            熊手 くまで | rake | râteau | rastrillo
            巻尺 まきじゃく | tape measure | mètre ruban | cinta métrica
        """,
        "expert": """
            鑿 のみ | chisel | ciseau à bois | formón, cincel
            鉋 かんな | plane | rabot | cepillo de carpintero
            錐 きり | gimlet | vrille | barrena, punzón
            万力 まんりき | vise | étau | tornillo de banco
            鶴嘴 つるはし | pickaxe | pioche | pico, zapapico
            手押し車 ておしぐるま | wheelbarrow | brouette | carretilla
            水準器 すいじゅんき | spirit level | niveau à bulle | nivel de burbuja
            滑車 かっしゃ | pulley | poulie | polea
            半田ごて はんだごて | soldering iron | fer à souder | soldador de estaño, cautín
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
            看護師 かんごし | nurse | infirmier | enfermero, enfermera
            患者 かんじゃ | patient | patient
            注射 ちゅうしゃ | injection | piqûre
            手術 しゅじゅつ | surgery | opération
            頭痛 ずつう | headache | mal de tête
            咳 せき | cough | toux
            救急車 きゅうきゅうしゃ | ambulance | ambulance | ambulancia
            検査 けんさ | medical test | examen médical
            治療 ちりょう | treatment | traitement
            入院 にゅういん | hospitalization | hospitalisation
        """,
        "advanced": """
            診断 しんだん | diagnosis | diagnostic
            処方箋 しょほうせん | prescription | ordonnance | receta médica
            包帯 ほうたい | bandage | bandage
            症状 しょうじょう | symptom | symptôme
            錠剤 じょうざい | tablet | comprimé | comprimido, pastilla
            体温計 たいおんけい | thermometer | thermomètre | termómetro
            アレルギー | allergy | allergie | alergia
            インフルエンザ | influenza | grippe | gripe, influenza
            予防接種 よぼうせっしゅ | vaccination | vaccination | vacunación
            骨折 こっせつ | fracture | fracture
            車椅子 くるまいす | wheelchair | fauteuil roulant | silla de ruedas
            吐き気 はきけ | nausea | nausée
        """,
        "expert": """
            麻酔 ますい | anesthesia | anesthésie
            聴診器 ちょうしんき | stethoscope | stéthoscope
            感染症 かんせんしょう | infectious disease | maladie infectieuse | enfermedad infecciosa
            副作用 ふくさよう | side effect | effet secondaire | efecto secundario
            軟膏 なんこう | ointment | pommade | pomada, ungüento
            点滴 てんてき | IV drip | perfusion | goteo intravenoso, suero
            松葉杖 まつばづえ | crutches | béquilles | muletas
            捻挫 ねんざ | sprain | entorse | esguince
            炎症 えんしょう | inflammation | inflammation | inflamación
            脳卒中 のうそっちゅう | stroke | AVC | accidente cerebrovascular, derrame cerebral
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
            薔薇 ばら | rose | rose | rosa
            向日葵 ひまわり | sunflower | tournesol | girasol
            チューリップ | tulip | tulipe | tulipán
            紅葉 もみじ | autumn leaves | feuilles d'automne
            芽 め | sprout | pousse
            花びら はなびら | petal | pétale
        """,
        "advanced": """
            菊 きく | chrysanthemum | chrysanthème | crisantemo
            百合 ゆり | lily | lys | lirio, azucena
            蘭 らん | orchid | orchidée | orquídea
            苔 こけ | moss | mousse | musgo
            杉 すぎ | Japanese cedar | cèdre du Japon
            楓 かえで | maple | érable | arce
            柳 やなぎ | willow | saule | sauce
            雑草 ざっそう | weeds | mauvaises herbes | malas hierbas, maleza
            茎 くき | stem | tige
            蕾 つぼみ | flower bud | bouton de fleur
            朝顔 あさがお | morning glory | belle-de-jour | campanilla, gloria de la mañana
            椿 つばき | camellia | camélia | camelia
            サボテン | cactus | cactus | cactus
        """,
        "expert": """
            藤 ふじ | wisteria | glycine | glicina
            紫陽花 あじさい | hydrangea | hortensia | hortensia, hidrangea
            蓮 はす | lotus | lotus
            銀杏 いちょう | ginkgo | ginkgo | ginkgo
            檜 ひのき | Japanese cypress | cyprès du Japon | ciprés japonés
            蔦 つた | ivy | lierre | hiedra
            羊歯 しだ | fern | fougère | helecho
            花粉 かふん | pollen | pollen
            樫 かし | oak | chêne | roble, encina
            椰子 やし | palm tree | palmier | palmera
        """,
    },
    "household_items": {
        "basic": """
            時計 とけい | clock | horloge
            傘 かさ | umbrella | parapluie
            鍵 かぎ | key | clé
            タオル | towel | serviette
            石鹸 せっけん | soap | savon
            歯ブラシ はブラシ | toothbrush | brosse à dents | cepillo de dientes
            ごみ | garbage | ordures
        """,
        "medium": """
            毛布 もうふ | blanket | couverture
            枕 まくら | pillow | oreiller
            洗濯機 せんたくき | washing machine | lave-linge | lavadora
            掃除機 そうじき | vacuum cleaner | aspirateur | aspiradora
            シャンプー | shampoo | shampoing | champú
            歯磨き粉 はみがきこ | toothpaste | dentifrice | pasta de dientes
            ハンガー | hanger | cintre
            ゴミ箱 ごみばこ | trash can | poubelle | cubo de basura, basurero
            電球 でんきゅう | light bulb | ampoule
            エアコン | air conditioner | climatiseur | aire acondicionado
            扇風機 せんぷうき | electric fan | ventilateur
        """,
        "advanced": """
            箒 ほうき | broom | balai
            洗剤 せんざい | detergent | lessive
            櫛 くし | comb | peigne
            籠 かご | basket | panier
            クッション | cushion | coussin | cojín
            蝋燭 ろうそく | candle | bougie
            アイロン | iron | fer à repasser
            スポンジ | sponge | éponge | esponja
            ドライヤー | hair dryer | sèche-cheveux | secador de pelo
            目覚まし時計 めざましどけい | alarm clock | réveil | despertador
            雑巾 ぞうきん | floor cloth | serpillière
        """,
        "expert": """
            塵取り ちりとり | dustpan | pelle à poussière
            剃刀 かみそり | razor | rasoir
            湯たんぽ ゆたんぽ | hot-water bottle | bouillotte | bolsa de agua caliente
            加湿器 かしつき | humidifier | humidificateur | humidificador
            魔法瓶 まほうびん | thermos | bouteille isotherme | termo
            爪切り つめきり | nail clippers | coupe-ongles | cortaúñas
            耳かき みみかき | ear pick | cure-oreille | limpiaoídos (cucharilla)
            蚊取り線香 かとりせんこう | mosquito coil | serpentin anti-moustiques | espiral antimosquitos
            風鈴 ふうりん | wind chime | carillon éolien | campanilla de viento
            物干し竿 ものほしざお | laundry pole | perche à linge | palo para tender la ropa
        """,
    },
    "holidays_events": {
        "basic": """
            誕生日 たんじょうび | birthday | anniversaire
            パーティー | party | fête
            正月 しょうがつ | New Year | Nouvel An | Año Nuevo
            休み やすみ | day off | jour de congé
            祭 まつり | festival | festival
            結婚式 けっこんしき | wedding | mariage | boda
            クリスマス | Christmas | Noël
            夏休み なつやすみ | summer vacation | vacances d'été
        """,
        "medium": """
            花見 はなみ | cherry-blossom viewing | hanami
            花火 はなび | fireworks | feu d'artifice
            祝日 しゅくじつ | public holiday | jour férié
            卒業式 そつぎょうしき | graduation ceremony | remise des diplômes | ceremonia de graduación
            入学式 にゅうがくしき | school entrance ceremony | cérémonie de rentrée | ceremonia de ingreso escolar
            葬式 そうしき | funeral | funérailles
            記念日 きねんび | anniversary | jour commémoratif | aniversario, día conmemorativo
            元日 がんじつ | New Year's Day | jour de l'An | día de Año Nuevo
            お盆 おぼん | Obon | fête des morts (Obon) | fiesta de los difuntos (Obon)
            バレンタインデー | Valentine's Day | Saint-Valentin | Día de San Valentín
        """,
        "advanced": """
            七夕 たなばた | Tanabata | Tanabata | Tanabata
            節分 せつぶん | Setsubun | Setsubun | Setsubun
            成人式 せいじんしき | coming-of-age ceremony | cérémonie de la majorité | ceremonia de la mayoría de edad
            大晦日 おおみそか | New Year's Eve | réveillon du Nouvel An | Nochevieja, último día del año
            初詣 はつもうで | first shrine visit of the year | première visite au sanctuaire | primera visita del año al santuario
            ハロウィン | Halloween | Halloween | Halloween
            運動会 うんどうかい | sports day | fête sportive | festival deportivo escolar
            宴会 えんかい | banquet | banquet
            歓迎会 かんげいかい | welcome party | fête de bienvenue | fiesta de bienvenida
            忘年会 ぼうねんかい | year-end party | fête de fin d'année | fiesta de fin de año
        """,
        "expert": """
            ひな祭り ひなまつり | Doll Festival | fête des poupées | fiesta de las muñecas
            七五三 しちごさん | Shichi-Go-San | Shichi-Go-San | Shichi-Go-San
            月見 つきみ | moon viewing | contemplation de la lune | contemplación de la luna
            法事 ほうじ | Buddhist memorial service | service commémoratif | servicio conmemorativo budista
            送別会 そうべつかい | farewell party | fête d'adieu | fiesta de despedida
            披露宴 ひろうえん | wedding reception | réception de mariage | banquete de bodas
            盆踊り ぼんおどり | Bon dance | danse de l'Obon | danza del Obon
            還暦 かんれき | 60th birthday | 60e anniversaire
            彼岸 ひがん | equinox week | semaine de l'équinoxe | semana del equinoccio
        """,
    },
}
