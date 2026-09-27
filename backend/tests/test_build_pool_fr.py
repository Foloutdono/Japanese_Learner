# JMdict's own French for the pool (scripts/build_pool_fr.py, plan 162).
#
# The full release, read as it ships: its entities declared in the
# document's own DTD, the French glosses in senses of their own after the
# English, a line cut where the English line is. Written beside the rows,
# joined on seq, for the pool's seqs only.
import io
import sqlite3

from scripts import build_pool_fr
from study import card_lookup

JMDICT = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE JMdict [
<!ELEMENT JMdict (entry*)>
<!ENTITY n "noun (common) (futsuumeishi)">
]>
<JMdict>
<entry>
<ent_seq>1200850</ent_seq>
<k_ele><keb>\xe6\x94\xb9\xe6\x9c\xad\xe5\x8f\xa3</keb></k_ele>
<sense><pos>&n;</pos><gloss>ticket barrier</gloss></sense>
<sense><gloss xml:lang="dut">toegangspoort</gloss></sense>
<sense><gloss xml:lang="fre">portillon</gloss><gloss xml:lang="fre">guichet</gloss></sense>
<sense><gloss xml:lang="fre">contr\xc3\xb4le des billets</gloss></sense>
</entry>
<entry>
<ent_seq>1215730</ent_seq>
<sense><gloss>quiet</gloss></sense>
</entry>
<entry>
<ent_seq>1448310</ent_seq>
<sense><gloss xml:lang="fre">paradis terrestre, lieu id\xc3\xa9al de retraite loin du monde</gloss></sense>
<sense><gloss xml:lang="fre">utopie, pays de cocagne, eldorado imaginaire</gloss></sense>
</entry>
<entry>
<ent_seq>9999999</ent_seq>
<sense><gloss xml:lang="fre">hors du pool</gloss></sense>
</entry>
</JMdict>
"""


def test_the_line_is_cut_where_the_english_one_is():
    assert build_pool_fr.LINE_MAX == card_lookup._POOL_GLOSS_MAX


def test_each_entry_s_line_is_its_first_french_glosses():
    lines = build_pool_fr.french_lines(io.BytesIO(JMDICT))
    assert lines[1200850] == "portillon; contrôle des billets"
    # No French: no line.
    assert 1215730 not in lines
    # A second sense past the line's length waits for the entry.
    assert lines[1448310] == "paradis terrestre, lieu idéal de retraite loin du monde"


def test_the_table_is_written_for_the_pool_s_seqs_only_and_again_on_a_second_run():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE entries (id INTEGER PRIMARY KEY, seq INTEGER, freq_rank INTEGER)")
    conn.executemany("INSERT INTO entries VALUES (?, ?, ?)",
                     [(1, 1200850, 10), (2, 1200850, 11), (3, 1215730, 20), (4, 1448310, 30)])
    lines = build_pool_fr.french_lines(io.BytesIO(JMDICT))
    assert build_pool_fr.write_table(conn, lines) == 2
    assert build_pool_fr.write_table(conn, lines) == 2
    rows = dict(conn.execute("SELECT seq, gloss FROM fr_glosses"))
    assert rows == {1200850: "portillon; contrôle des billets",
                    1448310: "paradis terrestre, lieu idéal de retraite loin du monde"}
    # The pool's own rows are untouched.
    assert conn.execute("SELECT COUNT(*) FROM entries").fetchone() == (4,)
    assert "with French: 2" in build_pool_fr.report(conn, lines)
