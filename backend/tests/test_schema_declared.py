"""Every table the app creates in code must be declared in
srs/data_structure.sql -- see that file's own header comment. Each
module is free to self-migrate its own tables at import time; this
test is the only thing that keeps the reference file from silently
drifting out of sync with what the code actually creates.

Scope: routes/, srs/, and study/ -- not just routes/+srs/, because
study/exam_schema.py and study/grammar_sentence_store.py also create
tables (exam_papers, exam_attempts, exam_generation_jobs,
grammar_sentences) that would otherwise be invisible to this check.
"""
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = BACKEND_ROOT / "srs" / "data_structure.sql"
SCANNED_DIRS = ["routes", "srs", "study"]

CREATE_IF_NOT_EXISTS_RE = re.compile(
    r"CREATE TABLE IF NOT EXISTS\s+(\w+)", re.IGNORECASE
)
DECLARED_RE = re.compile(r"CREATE TABLE\s+(\w+)", re.IGNORECASE)


def _tables_created_in_code() -> set[str]:
    tables = set()
    for dirname in SCANNED_DIRS:
        for path in (BACKEND_ROOT / dirname).glob("*.py"):
            content = path.read_text(encoding="utf-8")
            tables.update(m.group(1) for m in CREATE_IF_NOT_EXISTS_RE.finditer(content))
    return tables


def _tables_declared_in_schema_file() -> set[str]:
    content = SCHEMA_FILE.read_text(encoding="utf-8")
    return {m.group(1) for m in DECLARED_RE.finditer(content)}


def test_every_code_created_table_is_declared_in_schema_file():
    created = _tables_created_in_code()
    declared = _tables_declared_in_schema_file()
    missing = created - declared
    assert not missing, (
        f"Table(s) {sorted(missing)} are created in code (CREATE TABLE IF NOT "
        f"EXISTS) but not declared in {SCHEMA_FILE.relative_to(BACKEND_ROOT)}. "
        "Add them there so the file stays a true reference for the schema."
    )


def test_a_new_table_cannot_be_invisible_to_this_check(tmp_path, monkeypatch):
    """Negative control: a table created only in a scanned dir and never
    declared in the schema file must actually fail the check above --
    otherwise this test suite would be silently useless."""
    probe_dir = BACKEND_ROOT / "routes"
    probe_file = probe_dir / "zzz_probe_schema_test.py"
    probe_file.write_text(
        'SQL = "CREATE TABLE IF NOT EXISTS zzz_probe_table_never_declared (id TEXT)"\n',
        encoding="utf-8",
    )
    try:
        created = _tables_created_in_code()
        declared = _tables_declared_in_schema_file()
        assert "zzz_probe_table_never_declared" in created
        assert "zzz_probe_table_never_declared" not in declared
        assert (created - declared)
    finally:
        probe_file.unlink()
