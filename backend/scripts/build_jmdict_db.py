"""
Construit datas/vocab/vocab_jmdict.sqlite3 à partir de vocab_jmdict.json +
vocab_jmdict_meanings.json (déjà purgé de match_type/term/reading, voir
optimize_vocab_data.py) + vocab_jmdict_frequency.json.

Pourquoi : le vrai problème mémoire n'est pas la taille des .json sur
disque, c'est que vocab_jmdict_data.py et vocab_extras.py les chargent
INTÉGRALEMENT en objets Python au démarrage. 293k entrées x (dict +
strings + listes imbriquées) explose largement au-delà des ~80 Mo/49 Mo
de JSON une fois parsé (overhead CPython par objet). Une base SQLite
lue à la demande garde une empreinte mémoire ~constante quelle que soit
la taille du pool, au prix d'une requête disque au lieu d'un accès dict
en RAM — largement gagnant pour un pool qui n'est consulté que pour
quelques mots à la fois (recherche dictionnaire, cartes de fréquence).

Schéma :
  entries(id PK, seq, kanji, kana, meaning, freq_rank)
    - id : identifiant interne = position de la paire kanji/kana dans
      vocab_jmdict.json (garanti unique). C'est CE champ qui sert de clé
      de tri (freq_rank) et de jointure avec senses — PAS "seq".
    - seq : le numéro de séquence JMdict d'origine, gardé pour
      vocab_jmdict_to_id(). /!\ ATTENTION, bug préexistant repéré au
      passage : seq n'est pas unique par paire kanji/kana (un même
      headword avec plusieurs lectures partage le même seq — 59 206 cas
      sur 292 848). vocab_jmdict_to_id() actuel (f"vocab_jmdict_{seq}")
      peut donc générer le MÊME id de carte SRS pour deux mots
      différents et faire fusionner leur progression. Ce n'est pas
      introduit par cette migration, mais ça vaut la peine d'être
      corrigé séparément (utiliser l'"id" interne à la place de seq).
    - meaning : gardé tel quel (1er gloss) pour que dictionary.py liste/
      cherche sans jamais toucher la table senses (le "meaning" recopié
      reste redondant avec senses.blob mais évite de charger les senses
      -souvent bien plus lourdes avec examples/tags- pour un simple
      affichage de liste)
    - freq_rank : position dans l'ordre de fréquence -> permet à
      frequency_data.py de faire un "WHERE freq_rank BETWEEN ? AND ?"
      indexé au lieu de charger + trier 293k clés en Python
  senses(id PK, blob)  -- blob = JSON des senses (tags/term_tags/
      glossary/examples), déjà purgé. ~130 octets en moyenne : un
      SELECT par mot consulté coûte quasi rien, contre ~49 Mo si on
      les garde tous en RAM.

Index : kanji, kana, (kanji, kana), freq_rank, seq.
"""
import json
import os
import sqlite3

IN_DIR = "/home/claude/optimized"   # sortie de optimize_vocab_data.py
OUT_PATH = "/home/claude/optimized/vocab_jmdict.sqlite3"

if os.path.exists(OUT_PATH):
    os.remove(OUT_PATH)

with open(os.path.join(IN_DIR, "vocab_jmdict.json"), encoding="utf-8") as f:
    entries = json.load(f)
with open(os.path.join(IN_DIR, "vocab_jmdict_meanings.json"), encoding="utf-8") as f:
    meanings = json.load(f)
with open(os.path.join(IN_DIR, "vocab_jmdict_frequency.json"), encoding="utf-8") as f:
    freq_order = json.load(f)  # liste d'index dans `entries`, voir optimize_vocab_data.py

# id interne = position dans vocab_jmdict.json (unique par construction,
# contrairement à seq — voir docstring).
id_to_rank = {entry_id: rank for rank, entry_id in enumerate(freq_order)}

conn = sqlite3.connect(OUT_PATH)
conn.execute("""
    CREATE TABLE entries (
        id        INTEGER PRIMARY KEY,
        seq       INTEGER NOT NULL,
        kanji     TEXT NOT NULL,
        kana      TEXT NOT NULL,
        meaning   TEXT NOT NULL,
        freq_rank INTEGER NOT NULL
    )
""")
conn.execute("""
    CREATE TABLE senses (
        id   INTEGER PRIMARY KEY REFERENCES entries(id),
        blob TEXT NOT NULL
    )
""")

entry_rows = []
sense_rows = []
for entry_id, e in enumerate(entries):
    key = f"{e.get('kanji', '')}::{e.get('kana', '')}"
    entry_rows.append((entry_id, e["seq"], e.get("kanji", ""), e.get("kana", ""), e.get("meaning", ""), id_to_rank[entry_id]))
    senses = meanings.get(key)
    if senses:
        sense_rows.append((entry_id, json.dumps(senses, ensure_ascii=False, separators=(",", ":"))))

conn.executemany("INSERT INTO entries VALUES (?,?,?,?,?,?)", entry_rows)
conn.executemany("INSERT INTO senses VALUES (?,?)", sense_rows)

conn.execute("CREATE INDEX idx_entries_kanji ON entries(kanji)")
conn.execute("CREATE INDEX idx_entries_kana ON entries(kana)")
conn.execute("CREATE UNIQUE INDEX idx_entries_key ON entries(kanji, kana)")
conn.execute("CREATE INDEX idx_entries_seq ON entries(seq)")
conn.execute("CREATE UNIQUE INDEX idx_entries_freq_rank ON entries(freq_rank)")
conn.execute("ANALYZE")
conn.commit()
conn.close()

print("entries:", len(entry_rows), "  senses rows:", len(sense_rows))
print("db size:", os.path.getsize(OUT_PATH), "bytes")
