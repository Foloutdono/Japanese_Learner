# Stratégie de monétisation

État au 27 octobre 2026 : les décisions du propriétaire, les propositions
encore à valider (marquées **proposition**) et ce qu'il faut mesurer. Les
chiffres sont dans `tsuji-costs.xlsx` (même dossier), qui fait foi pour les
prix, les plafonds IA, la boutique et l'objectif.

## Le principe

Tsuji est la gare où toutes les lignes du japonais se croisent : un seul
plan, à bas prix ou gratuit, au lieu de cinq applications. Tout se paie en
crédits, et tout reste accessible gratuitement : le crédit rythme l'usage,
il ne ferme aucune porte. La croissance vient de la recommandation, pas de
la publicité. On récompense l'étude, jamais le farming.

Objectifs, dans l'ordre : la rétention, le bouche-à-oreille, puis une grosse
base d'utilisateurs avec un taux de conversion bas.

## L'offre

| | Free | Pro | Max |
|---|---|---|---|
| Prix | 0 € | 4,99 €/mois · 49,99 €/an | 7,99 €/mois · 69,99 €/an |
| Recharge continue | 90/jour, arrêt à 120 | 180/jour, arrêt à 250 | illimité |
| Révisions dues | 1 crédit | gratuites | gratuites |
| Nouvelles cartes (kana compris) | 1 crédit | 1 crédit | incluses |
| Pratique | 1 par phrase (lecture, dictée, traduction, composition), 2 par texte de compréhension, 2 par conversation | idem | incluse |
| Examen blanc | 2 crédits par examen | idem | inclus |
| Duel | entre amis gratuit, sinon 2 crédits | idem | inclus |
| Jeux solo | selon le jeu | idem | inclus |
| IA | petites limites/jour | limites/jour | usage raisonnable |
| Récompenses | crédits + XP | crédits + XP | XP + cosmétiques de statut |

- Kana : 1 crédit par nouvelle carte, révisions gratuites.
- Un Pro dépense ses crédits en nouvelles cartes, pratique, jeux et duels.
- Un exercice demandé par une mission ne coûte rien.
- Le plafond n'arrête que la recharge. Les crédits gagnés ou achetés passent
  au-dessus et n'expirent jamais.
- À l'arrivée, la carte est remplie jusqu'à sa limite ; 200 crédits sont
  donnés à la fin du tutoriel.
- « Illimité » (Max) vaut pour tout ce qui se paie en crédits. Les fonctions
  IA gardent une politique d'usage raisonnable, publiée.
- **Max annuel est le choix évident, par construction.** Pro annuel ne
  coûte que 20 €/an de moins : il sert de leurre.
- Essai de 7 jours sur les deux formules annuelles.
- Prévu : abonnements cadeaux (vendus sur le web, activés par code dans
  l'app) et une offre classes pour les enseignants (prix par place à fixer).
- Noms sur le thème du rail (**proposition**) : 普通 Local, 快速 Rapid,
  特急 Limited express. Les crédits s'appellent déjà 回数券.

### L'offre fondateur

**Décidé :**

- −25 % sur la première année, en mensuel comme en annuel, plus un mois de
  Max offert d'office ;
- sur toutes les plateformes ;
- pour tout compte créé avant l'ouverture des ventes (fin de l'early
  access, vers le 9 novembre 2026).

Prix fondateur : Pro 3,99 €/mois ou 37,99 €/an, Max 5,99 €/mois ou
52,99 €/an. Ils sont arrondis vers le haut au palier .99 des stores : Pro
mensuel fait −20 %, un choix assumé.

Acheté dans l'app, un abonnement annuel fondateur fait perdre de l'argent
si l'abonné utilise toutes ses limites IA chaque jour. Le risque est accepté
parce qu'il est borné : la cohorte est fermée. Avec environ 100 comptes,
dont 10 % qui s'abonnent, le pire cas coûte environ 2 € par mois. Le mois de
Max offert coûte environ 14 € en usage normal, 157 € au pire. Le détail est
dans « Pricing ».

À écrire dans les conditions : la date à partir de laquelle court le mois de
Max, la remise limitée à la première année, puis le prix normal, avec un
rappel 30 jours avant le renouvellement.

### L'IA : limites et plafond, mais rien n'est bloqué

Chaque fonction IA a sa limite par jour et par plan (onglet « AI worst
case »). S'y ajoute un plafond global de coût par jour et par apprenant
(Free 0,01 $, Pro 0,08 $, Max 0,10 $), que l'apprenant ne voit jamais : il
n'arrête qu'un abus, et c'est lui qui garantit qu'aucun abonné ne coûte plus
qu'il ne rapporte.

Atteindre une limite ne bloque jamais la traduction, la conversation ni
l'analyseur : chacun continue dans sa version sans modèle. Le code le fait
déjà.

| Fonction | Après la limite |
|---|---|
| Traduction | l'apprenant compare à la réponse modèle et se note |
| Conversation | les modes Choisir et Traduire continuent ; seule la conversation libre attend le lendemain |
| Analyseur | la décomposition locale reste ; seule une nouvelle explication approfondie attend |
| Composition | la session continue sans le tuteur |

Des crédits achetés n'augmentent jamais les limites IA d'un plan.

La génération de nouveaux examens blancs et de nouveaux textes de
compréhension est retirée : les examens et les textes écrits à l'avance
restent, et se paient en crédits. Les apprenants de l'early access utilisent
peu l'IA : le coût attendu a été baissé en conséquence (Pro 0,15 $, Max
0,25 $, Free 0,01 $ par mois), à confirmer avec `llm_usage_report`.

### Les decks : usage raisonnable

Les limites de decks servent à empêcher deux choses : saturer le stockage,
et accumuler des decks privés jamais utilisés.

- Un deck publié qui a au moins 5 abonnés ne compte dans aucune limite.
- Max peut demander plus via « Nous écrire » ; la demande est acceptée
  quand le deck est étudié ou publié, refusée quand il ne sert qu'à stocker.
- Rien n'est jamais supprimé à la rétrogradation : 30 jours de grâce, puis
  les decks en trop passent en lecture seule.

## Missions, quêtes et succès

Elles font tenir le plan Free, poussent l'apprenant à se dépasser et lui
font découvrir l'app. Un exercice demandé par une mission ne coûte rien :
le but est que l'apprenant s'exerce et gagne des crédits en le faisant.

**La cible** : un apprenant gratuit qui fait ses missions dispose d'environ
**125 crédits par jour** : 100 révisions, et environ 25 phrases ou quelques
textes dans les autres modes.
La recharge en donne 90 ; les missions doivent donc apporter environ 35 par
jour.

**Proposition de répartition** : trois missions journalières de 8 crédits,
un bonus de 6 quand les trois sont faites (30 par jour), et des missions
hebdomadaires d'environ 35 crédits au total (5 par jour). Ces montants sont
à ajuster avec les données de l'early access.

**Journalières** (trois par jour, choisies selon le profil) :

- finir ses révisions dues ;
- apprendre N nouvelles cartes, N étant sa moyenne des 7 derniers jours
  +10 %, jamais au-delà de la ration du jour (plan 222) ;
- un exercice de pratique, d'un mode différent chaque jour (gratuit) ;
- faire mieux que sa précision moyenne sur une session ;
- une dictée ou une phrase en composition.

**Hebdomadaires** :

- étudier 5 jours sur 7 ;
- dépasser de 10 % son total de révisions de la semaine précédente ;
- essayer un mode jamais utilisé, ou passer au niveau au-dessus dans un mode
  déjà connu ;
- terminer une section d'examen blanc ;
- jouer 5 duels ;
- écrire 10 phrases en composition.

**Découverte** (une seule fois chacune) : la première dictée, la première
photo analysée, la première conversation, le premier examen blanc, le
premier deck créé puis publié, le premier ami, le premier duel, une date
d'arrivée fixée, un import Anki/WaniKani, une première vidéo ou chanson.
Chacune rapporte des crédits et montre une fonction.

**Succès** (paliers) : kana complets, 100 / 500 / 1 000 mots, la grammaire
N5 complète, 7 / 30 / 100 jours d'étude, premier examen blanc réussi,
première victoire classée. Ils rapportent de l'XP et une plaque de station
(cosmétique) ; peu de crédits.

**Règles anti-farming** :

- un objectif « se dépasser » se calcule sur l'historique de l'apprenant,
  et il est plafonné ;
- l'XP de missions comptée au 番付 est plafonnée par jour, et elle ne
  récompense que de l'étude (révisions, exercices réussis) ;
- le parrainage et les récompenses d'auteur donnent des crédits, jamais de
  l'XP de classement ;
- rien d'aléatoire n'est payant : la Belgique traite les loot boxes payantes
  comme des jeux de hasard ;
- aucune mission ne récompense une publication sur les réseaux (pas d'UGC
  rémunéré) ;
- pour Max : XP et cosmétiques à la place des crédits.

## Parrainage

**Décidé :**

- pendant ses 3 premiers jours, un apprenant peut désigner un parrain ;
- un parrain a au plus 3 filleuls ;
- un filleul devenu inactif peut être abandonné, pour libérer la place ;
  un filleul abandonné ne peut pas se choisir un nouveau parrain ;
- **le filleul reçoit 300 crédits** à sa conversion ;
- **le parrain reçoit** des crédits à la conversion, puis chaque semaine
  où le filleul est actif, pendant **8 semaines** ;
- **si le filleul s'abonne, le parrain reçoit une semaine de Max.**
  Elle est accordée par Tsuji, pas par les stores, comme un avantage
  offert ;
- un parrain Max reçoit de l'XP et des cosmétiques.

**Définitions :**

- « converti » : 3 jours d'étude dans les 14 premiers jours, avec un e-mail
  vérifié ;
- « actif » : au moins 3 jours d'étude dans la semaine.

Le parrainage passe par le pseudo, saisi dans l'app, sans aucun SDK de suivi
tiers.

Garde-fous contre la fraude : un compte qui n'étudie pas ne convertit
jamais ; une limite mensuelle de récompenses ; une revue manuelle quand
plusieurs comptes naissent du même appareil.

## Récompenser les auteurs de decks

Décidé dans le principe, à ajuster. On récompense l'étude, pas
l'abonnement, qui ne coûte rien à simuler.

- **Le fait générateur** : un autre apprenant révise au moins 20 cartes du
  deck sur au moins 2 jours. L'auteur reçoit alors des crédits, une seule
  fois par apprenant.
- **Les conditions** : le deck est publié, a au moins 20 cartes et n'est
  pas une copie d'un autre deck. Un deck signalé est suspendu, et ne
  rapporte rien tant qu'il l'est.
- **Les limites** : un plafond par semaine, et les mêmes garde-fous que le
  parrainage.
- **Le statut** : des paliers d'auteur visibles sur le profil et dans la
  bibliothèque (駅員 → 駅長, cosmétiques).

## PvP et classements

**Décidé :**

- des duels asynchrones, du temps réel entre amis, un système d'amis, pas
  de chat ;
- **un duel entre amis est gratuit** (pour tisser des liens entre
  apprenants) ; un duel avec quelqu'un d'autre coûte 2 crédits ;
- les deux joueurs voient leur score et celui de l'adversaire ; le détail
  et les corrections coûtent 1 crédit ;
- les questions sont au **niveau le plus bas des deux joueurs** ; la
  rapidité ajoute des points, pour départager ;
- on trouve un ami en cherchant son pseudo (unique), même s'il se cache du
  番付 ; avant qu'une demande soit acceptée, on ne voit que le pseudo ;
- un bouton « signaler » sur chaque profil ; pas d'âge minimum ;
- **deux classements séparés** : l'Elo juge le niveau de japonais, le 番付
  le sérieux de l'apprenant. Pas de saisons pour l'instant.

**Elo** :

- point de départ : le résultat du test de placement, pas le niveau
  déclaré ;
- 10 à 20 premiers duels « provisoires », avec un facteur K élevé ;
- **détection des smurfs** : quand la performance des derniers duels
  dépasse nettement l'Elo (par exemple +300, avec plus de 80 % de victoires
  après 5 duels), le facteur K reste élevé, pour que le joueur monte plus
  vite.

**Test de placement** :

- des questions tirées dans une banque plus large, sous une graine
  aléatoire par tentative (le test reste rejouable depuis sa graine, plan
  224) ;
- un temps limite par question ;
- un délai avant de le repasser ;
- la détection des réponses incohérentes : échouer le facile et réussir le
  difficile, c'est deviner.

**À prévoir dès la bêta** :

- chaque nouvelle table (amis, duels, Elo, signalements) est effacée avec
  le compte (`DELETE /api/account`) et fermée à la Data API ;
- sans âge minimum, la fiche des stores doit déclarer que les utilisateurs
  interagissent (amis, duels, signalements). Ce qui repose sur le
  consentement demande celui d'un parent sous l'âge du consentement
  numérique (13 ans en Belgique).

## Boutique de crédits

- Quatre packs, plus le pack est gros, plus le bonus est grand
  (**proposition** : 100 crédits pour 0,99 €, 330 pour 2,99 €, 600 pour
  4,99 €, 1 300 pour 9,99 €).
- Des offres limitées dans le temps, qui ajoutent des crédits sans jamais
  baisser le prix.
- La règle, vérifiée dans le tableur : acheter en packs ce qu'un mois Pro
  apporte coûte au moins 1,5 fois le Pro mensuel, même pendant une promo.
  Avec la grille proposée, c'est 6,9 fois (4,6 fois avec une promo à +50 %).
- Le prix en euros est affiché à côté de chaque montant en crédits, sans
  pression à l'achat (pas de faux compte à rebours). Ce sont les principes
  des autorités européennes de consommation sur les monnaies virtuelles
  (mars 2025).
- La boutique est masquée pour Max.

## L'objectif, ajusté

L'objectif du propriétaire est plus ambitieux que la première proposition
(mi-2027) : couvrir les coûts fixes au **31 mars 2027**.

| Étape | Date | Repère |
|---|---|---|
| Ouverture des ventes | vers le 9 novembre 2026 | paiements actifs dès la validation des stores ; crédits en mode fantôme |
| Premiers revenus | fin 2026 | premiers abonnés fondateurs, mesures calibrées, crédits activés |
| Coûts fixes couverts | 31 mars 2027 | environ 1 330 actifs, environ 74 payants |

Partir de 35 actifs (au moins 2 jours d'étude sur 30, mesurés le 27 octobre)
pour en avoir 1 330 fin mars, c'est **un peu plus que doubler chaque mois**
(×2,2). En doublant tout juste, le seuil tombe en avril. Le business plan
détaille les trois rythmes. Cela ne tient que si les vidéos courtes et le parrainage tournent à
plein : le format « Can you read it? » a déjà dépassé 20 000 vues.

Les outils de développement sont un coût de l'activité. Ils représentent
environ 45 % des coûts fixes, et leur baisse est prévue fin 2026 : à 20 $ par
mois au lieu de 100, le seuil tomberait à environ 850 actifs. Le nouveau
montant est à saisir dans « Fixed costs » quand il sera connu.

## Acquisition payante

Le but : acheter vite un noyau dur d'apprenants convaincus, puis réduire la
publicité quand le bouche-à-oreille et le contenu organique (SEO, vidéos
courtes, YouTube) prennent le relais. Les chiffres sont dans l'onglet
« Paid acquisition » du tableur ; le business plan détaille les canaux.

| Phase | Quand | Budget | Porte pour passer à la suivante |
|---|---|---|---|
| Avant le premier euro | novembre 2026 | 0 € | compte après le premier trajet, démarrage fiable, source demandée à l'inscription, fiches des stores optimisées |
| Test | décembre 2026 | 400 € | un canal à 4 € ou moins par apprenant engagé ; rétention à J7 des apprenants venus par la pub au moins à 70 % de celle des organiques |
| Montée | janvier à mars 2027 | 700 €/mois | les canaux qui tiennent 4 € ; un canal à plus de 8 € deux semaines de suite est coupé |
| Décroissance | avril à juin 2027 | 300 → 125 €/mois | divisée par deux chaque mois dès que l'organique et le parrainage font 60 % des inscriptions |

Les canaux : TikTok Spark Ads (les vidéos organiques qui marchent,
boostées), Google App campaigns, Apple Ads, micro-influenceurs avec un code
créateur. Instagram reste coupé tant que TikTok ne sature pas.

Aucun pixel ni SDK publicitaire : chaque canal se mesure en agrégat (sa
console, l'attribution AdServices d'Apple, le referrer d'installation de
Google Play, le code créateur, une valeur fermée `source` à l'inscription,
à ajouter dans `events.VALUES` et `track.js`). Un post d'influenceur payé
porte la mention « publicité ».

Un apprenant engagé vaut environ 2 € avec ses filleuls et en coûte environ
5,80 € avec les hypothèses actuelles : la publicité achète de la vitesse,
pas du revenu. Elle est donc arrêtée dès que l'organique suffit.

## Mesures

Tout passe par le 足跡 : les événements forment un ensemble fermé (une
nouvelle valeur est ajoutée dans `events.VALUES` et dans `track.js`), et rien
de ce qu'un apprenant tape n'est enregistré. La lecture se fait dans le
digest hebdomadaire et dans un tableau de bord Metabase « Monétisation »
écrit en code.

### Ce qu'il faut mesurer

**Acquisition**

- Les inscriptions par jour et par source : Instagram, TikTok, parrainage,
  recherche, store, autre. C'est une valeur fermée, demandée à l'inscription
  ou tirée du lien de la landing.
- Chaque semaine, à la main : les vues, les visites de profil et les clics
  sur le lien, relevés dans les statistiques d'Instagram et de TikTok.

**Activation**

- Le tutoriel terminé, la première réponse.
- Le retour à J1, et à J3 (la fin de la fenêtre de parrainage).

**Engagement**

- Les actifs par jour, par semaine et par mois, et le nombre de sessions
  par jour.
- La part des révisions dues faites, et les missions faites par jour (0 à
  3).

**Crédits**

- Les crédits gagnés, par origine : recharge, mission, parrainage, auteur,
  achat, bonus. Le ledger a déjà ses raisons (`REASONS`) : il suffit de les
  étendre.
- Les crédits dépensés, par usage : révision, nouvelle carte, pratique, jeu,
  duel, correction.
- La part des actifs gratuits qui tombent à zéro dans la journée, et ce
  qu'ils font ensuite : partir, faire une mission, acheter, voir l'offre,
  revenir le lendemain.
- Les « would have blocked » du mode fantôme, avant l'activation.

**Monétisation**

- Les vues de l'offre, par déclencheur.
- Les essais lancés, et la part qui devient payante.
- La conversion de gratuit à payant par cohorte, à J7 et à J30.
- La répartition Pro/Max, mensuel/annuel, store/web.
- Le revenu moyen par payant, les achats de packs (taux, pack moyen).
- Pour les fondateurs : l'usage du mois offert, puis la conversion.
- Les remboursements, et les résiliations avec leur raison (une valeur
  fermée).

**Rétention**

- J1, J7 et J30, par cohorte, par source et par plan.
- La résiliation mensuelle des abonnements, et les réactivations.

**Viralité**

- Le facteur viral : les filleuls convertis par actif.
- La part de filleuls actifs pendant leurs 8 semaines.
- Les semaines de Max offertes, les récompenses d'auteur versées.

**Coûts**

- Le coût IA par fonction, par plan et par jour (`llm_usage_report`).
- Le nombre d'apprenants qui atteignent chaque limite et le plafond global,
  et ce qu'ils font ensuite dans la version sans modèle.
- Le coût IA d'un gratuit, par utilisateur actif.

**PvP et jeux**

- Les duels lancés et terminés (entre amis / autres), le délai d'un duel
  asynchrone.
- La distribution de l'Elo, les signalements de smurfs, les signalements
  de profils.
- Les corrections achetées par duel, les parties jouées et les crédits
  dépensés par partie.

**Qualité**

- Les erreurs d'API, les pages lentes, les messages reçus, la note dans les
  stores.

### Seuils de décision

| Si… | alors… |
|---|---|
| plus de 30 % des gratuits actifs tombent à zéro avant d'avoir fini leurs révisions dues | augmenter les récompenses des missions |
| un gratuit qui fait ses missions n'atteint pas 125 crédits par jour | revoir la répartition des missions |
| moins de 5 % tombent un jour à zéro | le plan Free est trop large : baisser la recharge |
| la rétention à J7 perd plus de 5 points après l'activation des crédits | revenir à l'étape précédente et comprendre pourquoi |
| un gratuit coûte plus de 0,05 €/mois d'IA en moyenne | baisser les limites IA du Free |
| le p99 du coût IA d'un plan dépasse la moitié de son pire cas | revoir les limites de ce plan |
| moins de 25 % des essais deviennent payants | revoir l'essai (moment, durée) |
| un parrain ou un auteur cumule des récompenses sans étude derrière | geler ses récompenses et vérifier à la main |
| les achats de packs font baisser les abonnements Pro | remonter le prix des packs |
| les actifs ne doublent pas d'un mois sur l'autre deux mois de suite | décaler l'objectif ou ouvrir une acquisition payante |

### L'ordre de mise en place

1. Le mode fantôme : les crédits sont comptés mais ne bloquent rien.
2. Les missions et les nouvelles recharges, toujours en mode fantôme.
3. L'activation pour les nouveaux comptes.
4. L'activation pour tous, après une annonce.

Chaque étape doit tenir les seuils ci-dessus avant de passer à la suivante.
Les paiements arrivent dès que les stores ont validé l'app.
