<p align="center">
  <img src="frontend/brand/icon.png" alt="L’icône de Tsuji : le caractère 辻 en crème sur fond noir, souligné d’or" width="120" height="120">
</p>

<h1 align="center">辻 Tsuji</h1>

<p align="center">
  <strong>Apprendre le japonais, des kana jusqu’à la lecture de vrais textes.</strong><br>
  Vocabulaire, kanji, grammaire, lecture, écoute et examens blancs du JLPT, du N5 au N1,<br>
  dans une seule app et une seule file de révisions quotidienne.
</p>

<p align="center">
  <!-- TODO : remplacer par le domaine définitif dès qu’il est en ligne -->
  <a href="https://japanese-learner-seven.vercel.app"><strong>Essayer Tsuji →</strong></a>
  &nbsp;·&nbsp;
  <a href="README.md">English</a> · <strong>Français</strong>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="FastAPI sous Python 3.12" src="https://img.shields.io/badge/FastAPI-Python%203.12-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Supabase Auth" src="https://img.shields.io/badge/Supabase-Auth-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Capacitor 8" src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white">
  <img alt="PWA installable" src="https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white">
</p>

---

## Sommaire

- [À propos](#à-propos)
- [Ce qui distingue Tsuji](#ce-qui-distingue-tsuji)
- [Fonctionnalités](#fonctionnalités)
- [Le contenu en chiffres](#le-contenu-en-chiffres)
- [Aperçu en images](#aperçu-en-images)
- [Essayer Tsuji](#essayer-tsuji)
- [Gratuit en accès anticipé](#gratuit-en-accès-anticipé)
- [Comment Tsuji a été construit](#comment-tsuji-a-été-construit)
- [Points forts techniques](#points-forts-techniques)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Démarrage (développement)](#démarrage-développement)
- [Déploiement](#déploiement)
- [Plan de la documentation](#plan-de-la-documentation)
- [Auteur](#auteur)
- [Crédits et licence](#crédits-et-licence)

---

## À propos

Tsuji est une application d’apprentissage du japonais, sur le web et sur
mobile. Elle couvre tout le parcours, du premier kana jusqu’au JLPT N1, en
français et en anglais.

J’apprends moi-même le japonais : j’ai un niveau intermédiaire et je vise le
N3. Pendant longtemps, j’ai dû jongler entre plusieurs apps. Anki servait
pour le vocabulaire : il est puissant, mais austère et long à configurer.
Pour la grammaire et les kanji, j’utilisais d’autres outils qui ne se
parlaient pas. Duolingo est agréable, mais trop léger pour préparer le JLPT.
Après des mois d’étude, j’étais toujours incapable de lire une vraie page en
japonais.

Tsuji est l’app que je voulais à la place. Vocabulaire, kanji, grammaire,
lecture, écoute et entraînement à l’examen y vivent ensemble et alimentent
une seule file de révisions quotidienne. À chaque étape, ils ramènent vers
du vrai japonais. Tsuji se construit comme un vrai produit. C’est aussi la
démonstration de ce qu’un étudiant peut livrer en dirigeant un agent de code
IA.

## Ce qui distingue Tsuji

- **Un parcours, une file.** Les kana, le vocabulaire, les kanji, la
  grammaire et vos propres cartes alimentent une seule file de répétition
  espacée. Une journée d’étude, c’est une liste, pas cinq apps.
- **Pensé pour lire du vrai japonais.** L’analyseur prend n’importe quel
  texte, qu’il soit tapé, photographié ou tiré des sous-titres d’une vidéo.
  Il le découpe en mots avec leurs lectures et leur grammaire, signale ceux
  que vous connaissez déjà, et ouvre l’entrée de dictionnaire de chaque mot
  d’un simple toucher.
- **Une gare, pas un menu.** 辻 (*tsuji*) signifie « carrefour ». C’est un
  *kokuji*, un caractère inventé au Japon, dont les cinq traits dessinent le
  croisement qu’il nomme. L’app est conçue comme une gare ferroviaire
  japonaise :
  - chaque matière est une ligne avec sa couleur ;
  - les écrans sont des stations ;
  - votre profil est un abonnement de transport ;
  - les révisions du jour attendent au portique.

  La métaphore donne à une douzaine de matières un plan cohérent, au lieu
  d’un empilement de menus.

## Fonctionnalités

Tsuji est organisé en cinq onglets.

### Aujourd’hui
- **File du jour** : toutes les révisions dues, toutes sections
  confondues, dans une seule file, avec les nouvelles cartes du jour à côté.

### Apprendre
- **Kana** : hiragana et katakana, son par son. Vous apprenez d’abord à les
  reconnaître, puis à les écrire à la main.
- **Vocabulaire** : 8 090 mots classés du N5 au N1. Vous étudiez par niveau,
  par fréquence, par thème ou au-delà du programme, de la forme écrite vers
  le sens, et inversement.
- **Kanji** : 2 212 caractères par niveau, avec l’ordre des traits. Vous
  les lisez, puis vous les écrivez de mémoire. Vous pouvez aussi étudier par
  radical, une famille de caractères à la fois.
- **Grammaire** : 541 points du N5 au N1. Chacun a une leçon rédigée (à
  quoi il s’attache, ce qu’il fait, en quoi il diffère de ses voisins) et
  des phrases d’exemple.
- **Decks** : vos propres cartes, saisies à la main ou importées d’un
  tableur, et planifiées avec le contenu intégré.
- **Bibliothèque** : des decks publiés par d’autres apprenants, prêts à
  être suivis.

### Pratique
- **Lecture** : de vraies phrases à votre niveau, choisies par niveau, par
  fréquence ou parmi vos propres cartes. On lit d’abord, on vérifie ensuite.
- **Compréhension écrite** : de courts textes suivis de questions, pour répéter la
  partie lecture du JLPT.
- **Traduction** : traduisez vous-même une phrase en japonais, puis
  comparez-la à une réponse de référence et recevez un avis sur la vôtre.
- **Dictée** : écoutez une phrase, deux fois au plus, et écrivez ce qui a
  été dit, en romaji.
- **Examens blancs** : des examens complets et chronométrés au format du
  JLPT, en vocabulaire, grammaire, lecture et écoute. La notation n’est pas
  officielle.

### Dictionnaire
- **Dictionnaire** : cherchez un kanji, un kana ou l’un des 212 000 mots.
  Chaque entrée montre les lectures, les radicaux, l’ordre des traits, des
  exemples, et si vous l’avez déjà rencontrée. Les favoris gardent les
  entrées que vous voulez retrouver.
- **Analyseur** : collez un texte, prenez une photo ou chargez les
  sous-titres d’une vidéo. Tsuji le découpe phrase par phrase et mot par
  mot, montre la grammaire de chaque phrase et la situe par niveau du JLPT.
  Une explication par IA est disponible à la demande.

### Profil
- **Le pass (定期券)** : votre niveau d’XP, votre série de jours et votre
  progression, avec un classement de la semaine et un classement global.
- **Statistiques** : comment vos cartes tiennent, semaine après semaine ;
  jusqu’où chaque carte est planifiée ; et où vous en perdez.
- **Réglages** : votre niveau et votre rythme quotidien, une barre de
  notation à quatre ou six boutons, un thème clair, sombre ou système, et
  une interface en français ou en anglais.

Les nouveaux apprenants commencent par une courte prise en main. Ils
choisissent leur niveau ou passent un test de placement, fixent un rythme
quotidien (5, 10 ou 20 nouvelles cartes), puis font un premier trajet guidé
avec une carte et un exercice de lecture.

## Le contenu en chiffres

Tout le contenu est classé par niveau du JLPT :

| Niveau | Vocabulaire | Kanji | Points de grammaire |
|---|---:|---:|---:|
| N5 | 675 | 103 | 91 |
| N4 | 642 | 144 | 108 |
| N3 | 1 771 | 366 | 110 |
| N2 | 1 767 | 367 | 115 |
| N1 | 3 235 | 1 232 | 117 |
| **Total** | **8 090** | **2 212** | **541** |

- Chaque leçon de grammaire est rédigée à la main, jamais générée. Chaque
  phrase d’exemple est vérifiée : elle doit contenir son motif et ne pas
  dépasser les kanji de son niveau.
- Le dictionnaire couvre 212 000 entrées JMdict et les 13 108 caractères de
  KANJIDIC2, avec 6 702 schémas d’ordre des traits issus de KanjiVG.
- Les définitions et toute l’interface existent en français et en anglais.

## Aperçu en images

<!--
TODO : ajouter les six captures ci-dessous dans docs/readme/, puis retirer
les marqueurs d’ouverture et de fermeture de ce commentaire pour afficher la
galerie. Ce sont les mêmes fichiers que dans README.md.

  docs/readme/today-phone.png         La file du jour, sur téléphone
  docs/readme/analyzer-phone.png      L’analyseur qui décompose une phrase, sur téléphone
  docs/readme/grammar-phone.png       Une leçon de grammaire, sur téléphone
  docs/readme/dictionary-desktop.png  Une entrée du dictionnaire, sur ordinateur
  docs/readme/exam-desktop.png        Un examen blanc, sur ordinateur
  docs/readme/stats-desktop.png       La page des statistiques, sur ordinateur

Téléphone : environ 390×844 (portrait). Ordinateur : environ 1440×900.

<table>
  <tr>
    <td align="center"><img src="docs/readme/today-phone.png" alt="La file du jour sur téléphone" width="240"><br><sub>Aujourd’hui</sub></td>
    <td align="center"><img src="docs/readme/analyzer-phone.png" alt="L’analyseur qui décompose une phrase japonaise" width="240"><br><sub>Analyseur</sub></td>
    <td align="center"><img src="docs/readme/grammar-phone.png" alt="Une leçon de grammaire sur téléphone" width="240"><br><sub>Leçon de grammaire</sub></td>
  </tr>
</table>

<p align="center"><img src="docs/readme/dictionary-desktop.png" alt="Une entrée du dictionnaire sur ordinateur" width="720"><br><sub>Dictionnaire, sur ordinateur</sub></p>
<p align="center"><img src="docs/readme/exam-desktop.png" alt="Un examen blanc du JLPT sur ordinateur" width="720"><br><sub>Examen blanc</sub></p>
<p align="center"><img src="docs/readme/stats-desktop.png" alt="La page des statistiques sur ordinateur" width="720"><br><sub>Statistiques</sub></p>
-->

*Les captures d’écran arrivent bientôt.*

## Essayer Tsuji

<!-- TODO : remplacer par le domaine définitif dès qu’il est en ligne -->
- **Sur le web** : ouvrez **[japanese-learner-seven.vercel.app](https://japanese-learner-seven.vercel.app)**
  dans n’importe quel navigateur récent et créez un compte avec une adresse
  e-mail et un mot de passe, ou avec Google.
- **L’installer** : Tsuji est une Progressive Web App, qui s’installe comme
  une app native et s’ouvre en plein écran.
  - Dans Chrome ou sur Android, choisissez « Installer l’application ».
  - Sur iPhone ou iPad dans Safari, touchez « Partager », puis « Sur
    l’écran d’accueil ».
- **Téléphone ou ordinateur** : Tsuji est pensé d’abord pour le téléphone.
  À partir de 1 100 px de large, il passe à une mise en page pour ordinateur,
  avec une barre latérale et des écrans en deux colonnes.
- **Apps natives** : des versions Android et iOS, empaquetées avec
  Capacitor, sont en préparation.
- **Langues** : l’interface et les définitions sont en français et en
  anglais.

## Gratuit en accès anticipé

Tsuji est gratuit pendant l’accès anticipé.

Une offre payante, le **Pass** (定期券, « abonnement »), est déjà intégrée à
l’app mais pas encore en vente. À son lancement, la répartition prévue entre
l’offre gratuite et le Pass est la suivante. Ces limites peuvent encore
changer.

| | Gratuit | Pass |
|---|---|---|
| Révisions | 200 crédits à l’inscription, puis 30 de plus par jour (jusqu’à 50) ; un crédit par révision. Les kana restent toujours gratuits. | Illimitées |
| Vos propres decks | 7 | 100 |
| Vos propres cartes | 200 | 10 000 |
| Modes de pratique (lecture, compréhension, traduction, dictée, examens blancs) et analyseur | Non inclus | Inclus |

## Comment Tsuji a été construit

Tsuji est construit par une seule personne qui dirige un agent de code IA.
Je suis étudiant en troisième année d’intelligence artificielle. J’ai fixé la
direction du produit, le design et les priorités, j’ai relu le travail et je
l’ai testé chaque jour. Le code lui-même a été écrit par
**[Claude Code](https://claude.com/claude-code)**, l’agent de code
d’Anthropic. Je ne l’ai pas écrit à la main.

Depuis le printemps 2026, ce travail a produit 120 plans numérotés et plus
de 160 pull requests fusionnées. Il repose sur quatre habitudes :

1. **Des plans écrits, livrés par vagues.** Chaque chantier commence par un
   plan numéroté, que je lis et valide avant qu’une seule ligne de code soit
   écrite. Un plan fixe le périmètre, les décisions, les fichiers et les
   tests. Les plans liés partent ensemble, en vagues : la version mobile, la
   bibliothèque de decks, la mise en page pour ordinateur, etc.
2. **Des maquettes avant le code.** Les nouveaux écrans sont d’abord
   explorés en maquettes, et je choisis une direction avant que
   l’implémentation commence.
3. **L’usage quotidien et les retours.** J’étudie avec Tsuji sur mon
   téléphone et je fais remonter ce que je trouve. Les décisions prises
   ainsi sont consignées comme « owner-directed » dans
   [`DESIGN.md`](DESIGN.md), pour qu’on n’y revienne pas.
4. **Des règles écrites, et des contrôles qui les font respecter.** Quatre
   ensembles de documents fixent les règles de l’agent :
   - [`CLAUDE.md`](CLAUDE.md) : comment travailler dans ce dépôt ;
   - [`DESIGN.md`](DESIGN.md) : le langage visuel ;
   - [`CONTEXT.md`](CONTEXT.md) : le vocabulaire commun ;
   - 18 [décisions d’architecture](docs/adr/) (ADR).

   L’intégration continue les fait respecter : plus de 300 fichiers de
   tests, des linters, et des garde-fous de design qui font échouer le build
   quand une taille de police, un espacement ou une couleur sort de
   l’échelle de jetons du design.

Un agent vérifie aussi le contenu. Deux fois par semaine, une session
Claude Code planifiée prend une tranche de ce que Tsuji enseigne (points de
grammaire, vocabulaire ou phrases d’exemple) et tente de la réfuter à
l’aide de sources de référence. Elle rend ses conclusions dans une seule
issue GitHub et ne modifie jamais le contenu elle-même : une correction
fausse accompagnée d’une citation est pire que l’erreur d’origine. La
méthode est décrite dans
[`docs/content-audit/PLAYBOOK.md`](docs/content-audit/PLAYBOOK.md).

## Points forts techniques

### Architecture
- **Un seul code, trois cibles.** La même app React est livrée comme site
  web, comme PWA installable, et comme apps Android et iOS via Capacitor.
  Les apps natives passent par l’origine web pour atteindre l’API : il n’y a
  qu’un seul proxy et une seule surface CORS
  ([ADR 0008](docs/adr/0008-native-shells-reach-the-api-through-the-web-origin.md)).
- **Une seconde mise en page pour ordinateur.** À partir de 1 100 px de
  large, l’app passe à une mise en page pour ordinateur. En dessous, chaque
  écran rend exactement le balisage du téléphone. Des tests en format
  téléphone, tablette, ordinateur et grand écran gardent les deux mises en
  page séparées
  ([ADR 0018](docs/adr/0018-the-desk-is-a-second-chrome-that-never-reaches-the-phone.md)).
- **Une faible empreinte mémoire.** Les grands jeux de référence (212 000
  entrées JMdict et 13 108 kanji) sont stockés en SQLite et lus à la
  demande plutôt que gardés en mémoire. L’API tient ainsi sur un serveur de
  512 Mo.
- **Des coûts d’IA maîtrisés.** Chaque appel à un modèle passe par un seul
  client, qui :
  - bascule d’un fournisseur à l’autre (Gemini, puis OpenAI, puis
    OpenRouter) ;
  - compte les tokens de chaque appel ;
  - tient un pool partagé, pour qu’un exercice coûteux soit généré une fois
    et servi à de nombreux apprenants ;
  - applique des plafonds quotidiens par apprenant.

### Traitement du japonais
- **Un planificateur de répétition espacée maison.** Les cartes passent par
  des étapes d’apprentissage de 3 minutes à un jour. Ensuite, la difficulté
  propre à chaque carte fixe ses intervalles. La progression est suivie par
  carte et par mode d’étude.
- **Une analyse de phrases à deux niveaux.**
  - Le niveau local est instantané, gratuit, et fonctionne sans aucun
    fournisseur d’IA : tokenisation MeCab/UniDic, lectures, furigana,
    détection de la grammaire, niveau JLPT et correspondances avec vos
    decks.
  - Le niveau approfondi ajoute des traductions en contexte et une
    explication. C’est un appel à un modèle, fait seulement quand vous le
    demandez pour une phrase donnée
    ([ADR 0001](docs/adr/0001-two-tier-sentence-analysis.md)).
- **La grammaire repérée par la conjugaison, pas par l’orthographe.** Les
  formes comme le passif, le causatif, le potentiel, le volitif, 〜てみる ou
  〜すぎる sont repérées grâce aux champs de conjugaison du tokenizer, pas
  en comparant des caractères.
- **L’OCR d’abord dans le navigateur.** Les photos sont lues sur l’appareil
  avec Tesseract.js : l’image reste sur le téléphone. Un modèle de vision
  n’est appelé que dans trois cas : la confiance de Tesseract est faible, le
  résultat n’est presque pas du japonais, ou l’apprenant demande un nouvel
  essai. Le texte reconnu est toujours proposé à la correction avant
  l’analyse ([ADR 0004](docs/adr/0004-ocr-runs-client-first.md)).
- **Des textes générés qui respectent votre niveau.**
  - Un texte de compréhension est écrit autour de points de grammaire et de
    mots tirés du niveau choisi, pour ne pas reprendre toujours les trois
    mêmes.
  - Chaque texte est mesuré avant d’être servi. Au plus un mot sur vingt
    peut dépasser le niveau, sinon le texte est refusé. Les kanji hors
    niveau sont réécrits en kana
    ([ADR 0015](docs/adr/0015-generated-text-is-gated-on-its-level-mix.md)).
  - Les examens blancs suivent la structure officielle des épreuves du
    JLPT, sont validés avant d’être servis, et leur audio d’écoute est
    synthétisé.

### Qualité
- **Tests.**
  - Backend : 106 fichiers de tests (pytest), exécutés sur un vrai
    PostgreSQL.
  - Frontend : 209 fichiers de tests (Vitest), sur sept voies : Node, plus
    Chromium aux formats téléphone, tactile, tablette, ordinateur et grand
    écran.
- **Des garde-fous de design dans la CI.**
  - Un cliquet Stylelint : toute nouvelle violation fait échouer le build,
    et les anciennes sont suivies dans une référence.
  - Un contrôle de l’échelle de jetons sur les tailles de police, les
    espacements et les arrondis.
  - Des contrôles de contraste des couleurs.
- **Des contrôles du contenu.** Chaque exemple de grammaire doit contenir
  son propre motif et rester dans les kanji de son niveau. Un script audite
  le deck de vocabulaire : doublons, lectures et lacunes.
- **Des décisions consignées.** 18 [décisions d’architecture](docs/adr/)
  expliquent pourquoi le système a cette forme.

### Produit et vie privée
- **Des statistiques d’usage internes uniquement.** Aucun SDK tiers. L’app
  n’enregistre qu’une liste fermée d’événements, jamais ce qu’un apprenant a
  tapé et jamais une URL brute
  ([ADR 0012](docs/adr/0012-behaviour-is-recorded-first-party-or-not-at-all.md)).
- **Des comptes vraiment effacés.** Supprimer son compte supprime ses
  données, et des scripts de maintenance nettoient après les comptes
  supprimés par une autre voie
  ([ADR 0010](docs/adr/0010-learner-rows-are-reconciled-with-auth-not-cascaded-from-it.md)).
- **Bilingue de bout en bout.** Français et anglais, typographie française
  comprise.
- **La monétisation mesurée avant le lancement.** Le système de crédits et
  l’offre Pass sont construits et instrumentés avant toute boutique, pour
  mesurer la demande avant de fixer un prix.

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, CSS pur avec jetons de design dans une seule feuille de style |
| Mobile | PWA (vite-plugin-pwa), Capacitor 8 pour Android et iOS |
| Backend | Python 3.12, FastAPI, Uvicorn, psycopg2 (SQL brut, sans ORM) |
| Données | PostgreSQL 16 (sur Supabase), SQLite pour les données du dictionnaire |
| Authentification | Supabase Auth (e-mail et mot de passe, Google) |
| Japonais | fugashi + UniDic (MeCab), pykakasi, JMdict, KANJIDIC2, KanjiVG |
| IA | Gemini, OpenAI et OpenRouter via HTTP compatible OpenAI ; Tesseract.js pour l’OCR |
| Audio | edge-tts pour l’écoute des examens et la dictée ; la synthèse vocale du navigateur pour l’étude |
| Tests | pytest, Vitest avec Playwright (Chromium), ESLint, Stylelint |
| Hébergement et CI | Vercel (web), Render (API), GitHub Actions |

## Architecture

```mermaid
flowchart LR
  W["Web et PWA"] --> V["Vercel<br/>site statique + proxy /api"]
  N["Android et iOS<br/>Capacitor"] --> V
  V --> A["FastAPI<br/>sur Render"]
  A --> DB[("PostgreSQL<br/>données des apprenants")]
  A --> R[("SQLite et JSON<br/>dictionnaire et decks")]
  A --> L["Fournisseurs d'IA<br/>Gemini, OpenAI, OpenRouter"]
  A --> T["edge-tts<br/>audio des examens"]
  W -. connexion .-> S["Supabase Auth"]
  N -. connexion .-> S
  A -. vérification du jeton .-> S
```

Le navigateur ne parle jamais qu’à une seule origine. Vercel sert l’app et
transmet `/api`, les schémas d’ordre des traits et l’audio des examens au
backend FastAPI. Le backend garde la progression de chaque apprenant dans
PostgreSQL. Il lit le dictionnaire et les decks dans des fichiers livrés
avec le code, et n’appelle un fournisseur d’IA que pour les fonctions qui en
ont besoin.

```
.
├── backend/            application FastAPI
│   ├── routes/         un routeur léger par fonctionnalité
│   ├── srs/            moteur de répétition espacée, planificateur, XP, schéma
│   ├── study/          examens, analyse de phrases, tokenizer, client IA, dictée
│   ├── content/        contenu rédigé : grammaire (N5–N1), phrases, extraits audio
│   ├── datas/          decks de vocabulaire et de kanji, bases du dictionnaire
│   ├── scripts/        construction des données, migrations, maintenance
│   └── tests/          suite pytest
├── frontend/           application React + Vite
│   ├── src/            écrans, composants, hooks, logique métier, langues (en, fr)
│   ├── android/, ios/  projets natifs Capacitor
│   └── public/         icônes, fichiers PWA, page de confidentialité
├── docs/               décisions d'architecture, notes de design, guides de publication et d'audit
├── CLAUDE.md           le guide de travail de ce code
├── DESIGN.md           le langage visuel
└── CONTEXT.md          glossaire des termes du domaine
```

## Démarrage (développement)

Voici l’essentiel. [`CLAUDE.md`](CLAUDE.md) et
[`frontend/README.md`](frontend/README.md) couvrent le reste. Lancez chaque
bloc depuis la racine du dépôt.

**Prérequis** : Python 3.12, Node 22 ou plus récent, et Docker (ou un
PostgreSQL 16 local).

**1. Démarrer une base de données**

```bash
docker run -d --name jp-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp;"
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

**2. Lancer le backend** (sur le port 8000)

```bash
cd backend
cp .env.example .env          # les valeurs par défaut correspondent à la base ci-dessus
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- `DEV_USER_ID` dans `.env` fait traiter chaque requête comme venant de cet
  unique utilisateur local, sans vérifier de jeton. C’est réservé au
  développement local et ne doit jamais être défini sur un serveur déployé.
  Le backend affiche un bandeau d’avertissement quand il est actif.
- Les clés d’IA (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`)
  sont facultatives. Sans elles, les fonctions qui s’appuient sur l’IA
  renvoient une erreur : la génération d’examens, la compréhension, l’avis
  sur les traductions, les explications de l’analyseur et la lecture des
  photos par un modèle de vision. Tout le reste fonctionne.

**3. Lancer le frontend** (sur le port 5173)

```bash
cd frontend
grep -E '^VITE_SUPABASE' .env.production > .env.development.local
npm install
npm run dev
```

Ouvrez <http://localhost:5173> et connectez-vous. Le serveur de
développement transmet `/api` au backend sur le port 8000.

**4. Lancer les tests**

```bash
# Backend : les tests utilisent leur propre base.
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp_test;"
docker exec -i jp-db psql -U postgres -d jp_test < backend/srs/data_structure.sql
cd backend
DATABASE_URL=postgresql://postgres:dev@localhost:5432/jp_test DEV_USER_ID=test-user python -m pytest -q
```

```bash
# Frontend
cd frontend
npx playwright install chromium   # une fois, pour les voies de test dans le navigateur
npm test
npm run lint && npm run lint:css && npm run lint:scale && npm run lint:ink
```

Si `DATABASE_URL` n’est pas défini, les tests du backend cherchent une base
à `localhost:5433/jp_test`.

## Déploiement

- **Web** : Vercel construit `frontend/` depuis `main`.
  [`frontend/vercel.json`](frontend/vercel.json) transmet `/api`, `/kanjivg`
  et `/exam-audio` au backend, pour que le navigateur ne parle qu’à une
  seule origine.
- **API** : Render fait tourner le backend FastAPI, selon
  [`render.yaml`](render.yaml). Un disque persistant stocke l’audio généré
  des examens.
- **Base de données et connexion** : Supabase (PostgreSQL et Auth). Chaque
  module du backend crée ses propres tables au démarrage, et
  [`backend/srs/data_structure.sql`](backend/srs/data_structure.sql) est
  l’instantané de référence du schéma.
- **Mobile** : pousser un tag `vX.Y.Z` sur `main` construit un Android App
  Bundle signé et envoie une version iOS sur TestFlight. Voir
  [`docs/release.md`](docs/release.md).
- **GitHub Actions** : quatre workflows.
  - `CI` : tests du backend et du frontend, linters et build.
  - `Mobile` : les versions natives.
  - `Database maintenance` : élagage des journaux et compactage de
    l’historique, chaque semaine.
  - `Weekly digest` : un résumé d’usage chaque semaine.

## Plan de la documentation

| Document | Contenu |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Le guide de travail complet : commandes, architecture, conventions, scripts de maintenance |
| [`DESIGN.md`](DESIGN.md) | Le langage visuel : la métaphore de la gare, couleurs, typographie, espacement, animation, mise en page |
| [`CONTEXT.md`](CONTEXT.md) | Le glossaire : ce que *card*, *deck*, *mode*, *sentence* et *passage* veulent dire ici |
| [`docs/adr/`](docs/adr/) | 18 décisions d’architecture |
| [`docs/design/`](docs/design/) | Notes sur les mises en page mobile et ordinateur |
| [`docs/release.md`](docs/release.md) | Comment publier une version web, Android et iOS |
| [`docs/oauth.md`](docs/oauth.md) | Comment fonctionne la connexion Google sur le web et dans les apps natives |
| [`docs/llm-commercial-plan.md`](docs/llm-commercial-plan.md) | Le choix des fournisseurs d’IA et la maîtrise des coûts |
| [`docs/content-audit/PLAYBOOK.md`](docs/content-audit/PLAYBOOK.md) | Le fonctionnement de l’audit de contenu bihebdomadaire |
| [`backend/content/grammar/README.md`](backend/content/grammar/README.md) | Le format et le guide de style du catalogue de grammaire |
| [`frontend/README.md`](frontend/README.md) | Les commandes du frontend, les apps natives et les garde-fous de design |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Les licences des données et polices tierces |

La documentation interne est rédigée en anglais.

## Auteur

<!-- TODO : remplacer les champs ci-dessous -->
**[Your Name]**, étudiant en troisième année de bachelier en intelligence
artificielle à l’Hénallux (Namur, Belgique), et apprenant le japonais.

Je cherche un **stage de février à mai 2027, en Belgique**, en
**développement logiciel assisté par IA** ou en **développement
full-stack**. Tsuji montre ma façon de travailler : je mène un produit de
l’idée à la production en dirigeant un agent de code IA. Concrètement, je
définis le travail, j’écris les règles, je relis le résultat et je le teste
en conditions réelles.

- LinkedIn : [LinkedIn URL] <!-- TODO -->
- Portfolio : [Portfolio URL] <!-- TODO -->
- GitHub : [@Foloutdono](https://github.com/Foloutdono)

## Crédits et licence

Le dictionnaire et les données de référence de Tsuji proviennent de projets
ouverts, utilisés selon leurs propres licences :

- **JMdict / JMnedict**, **KANJIDIC2** et **RADKFILE**, de
  l’[Electronic Dictionary Research and Development Group](https://www.edrdg.org/) :
  CC BY-SA 4.0.
- **[KanjiVG](https://kanjivg.tagaini.net/)**, d’Ulrich Apel, pour les
  schémas d’ordre des traits : CC BY-SA 3.0.
- **[Tatoeba](https://tatoeba.org)**, pour une partie des phrases
  d’exemple : CC BY 2.0 FR.
- **VOICEVOX:春日部つむぎ**, pour les annonces en gare.
- **Noto Sans JP**, **Noto Serif JP** et **Space Grotesk** : SIL Open Font
  License 1.1.

Les mentions complètes figurent dans
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

© 2026 [Your Name]. Tous droits réservés. Le code source de ce projet n’est
pas sous licence de réutilisation. Les données tierces ci-dessus restent
sous leurs propres licences.
