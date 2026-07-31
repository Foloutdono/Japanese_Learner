"""
Migration one-shot : régénère les fichiers datas/vocab/ en supprimant la
redondance repérée dans les données actuelles, sans perdre la moindre
information réellement utilisée par le code (dictionary.py, vocab_extras.py,
frequency_data.py, vocab_data.py, vocab_jmdict_data.py).

Trois optimisations, par ordre d'impact :

1. vocab_meanings.json / vocab_jmdict_meanings.json
   Chaque "sense" transporte match_type / term / reading. Vérifié sur les
   358 551 senses des deux fichiers : vocab_extras.py ne lit jamais ces
   3 champs (get_vocab_extras ne construit que number/primary/glossary/tags
   pour les senses, et jp/en/segments/sense_number/sense_glossary pour les
   examples). Et dans vocab_jmdict_meanings.json ils sont 100% déductibles
   de la clé "kanji::kana" elle-même (match_type toujours "exact", reading
   toujours == kana, term toujours == kanji si présent sinon == kana) :
   zéro exception sur les 341 154 senses vérifiées. Suppression pure,
   aucune info perdue, aucun autre fichier ne s'appuie dessus.
   -> vocab_meanings.json       : -58 %
   -> vocab_jmdict_meanings.json: -39 %

2. vocab_jmdict_frequency.json
   Liste des 292 848 clés "kanji::kana" réordonnée par fréquence — soit
   une permutation de clés déjà présentes telles quelles dans
   vocab_jmdict.json. On stocke l'ordre via le "seq" JMdict (déjà l'id
   unique de chaque entrée) au lieu de recopier le kanji+kana en toutes
   lettres : -74 %, et frequency_data.py retraduit seq -> clé au chargement
   avec VOCAB_JMDICT déjà en mémoire (aucun autre module n'est concerné,
   le format public de standard_order()/tier_keys() ne change pas).

3. Reserialisation compacte (pas d'indentation) des fichiers restants —
   gain gratuit, notamment vocab_deck.json (-31 %) et vocab_tags.json.

Volontairement NON fait : supprimer "meaning" de vocab_jmdict.json (bien
que 100% redondant avec le premier gloss de vocab_jmdict_meanings.json,
vérifié sur 2000 entrées) — cela forcerait dictionary.py à charger le
fichier meanings (49 Mo même optimisé) juste pour lister/chercher dans
la catégorie "jmdict", alors que ce chemin ne touche aujourd'hui jamais
ce fichier. C'est une dénormalisation délibérée pour la performance, pas
un oubli — voir le commentaire à la fin de ce script si tu veux quand
même la faire sauter.
"""
import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IN_DIR = os.path.join(BASE_DIR, "datas", "vocab")
OUT_DIR = os.path.join(BASE_DIR, "datas", "vocab_optimized")

os.makedirs(OUT_DIR, exist_ok=True)


def load(name):
    with open(os.path.join(IN_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def dump(name, data):
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return path


def size(path):
    return os.path.getsize(path)


report = []


def track(label, in_path, out_path):
    b, a = size(in_path), size(out_path)
    report.append((label, b, a))


# ── 1. Purge match_type / term / reading (100% inutilisés ou déductibles) ──
for name in ("vocab_meanings.json", "vocab_jmdict_meanings.json"):
    data = load(name)
    for senses in data.values():
        for s in senses:
            s.pop("match_type", None)
            s.pop("term", None)
            s.pop("reading", None)
    out = dump(name, data)
    track(name, os.path.join(IN_DIR, name), out)

# ── 2. vocab_jmdict_frequency.json : clés -> seq JMdict ──
jmdict = load("vocab_jmdict.json")
key_to_seq = {f"{e.get('kanji', '')}::{e.get('kana', '')}": e["seq"] for e in jmdict}
freq_keys = load("vocab_jmdict_frequency.json")
freq_seqs = [key_to_seq[k] for k in freq_keys]  # KeyError volontaire si une
                                                  # clé de l'ordre n'existe
                                                  # plus dans le pool -> bug
                                                  # à corriger, pas à masquer
out = dump("vocab_jmdict_frequency.json", freq_seqs)
track("vocab_jmdict_frequency.json", os.path.join(IN_DIR, "vocab_jmdict_frequency.json"), out)

# ── 3. Reserialisation compacte, contenu inchangé ──
for name in ("vocab_deck.json", "vocab_fr.json", "vocab_tags.json", "vocab_jmdict.json", "vocab_frequency.json"):
    data = load(name)
    out = dump(name, data)
    track(name, os.path.join(IN_DIR, name), out)

print(f"{'fichier':38s} {'avant':>12s} {'après':>12s}   gain")
total_b = total_a = 0
for label, b, a in report:
    total_b += b
    total_a += a
    print(f"{label:38s} {b:12,d} {a:12,d}   -{100*(1-a/b):4.1f}%")
print("-" * 78)
print(f"{'TOTAL':38s} {total_b:12,d} {total_a:12,d}   -{100*(1-total_a/total_b):4.1f}%")
