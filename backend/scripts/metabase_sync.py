"""
Build the 足跡 dashboards in Metabase from docs/analytics/metabase/*.sql.

    python -m scripts.metabase_sync              # report: what would be built
    python -m scripts.metabase_sync --check      # run every question, report errors and rows
    python -m scripts.metabase_sync --yes        # create or update collection, cards, dashboards

-- Why this exists ---------------------------------------------
Metabase keeps its questions in its own application database, which is
not this repository and is not backed up with it. Plan 215 wrote every
question as SQL in docs/analytics/metabase/, one file per dashboard, so
the dashboards can be read in review, diffed, and rebuilt on a fresh
Metabase in one command. This script is that command. It talks to
Metabase's REST API only -- never to the app's database -- and the only
things it writes are Metabase objects: a collection, a SQL snippet, the
cards and the dashboards.

-- The file format ---------------------------------------------
    -- dashboard: <name>
    -- description: <one line>

    -- ==== question
    -- title: <card name>
    -- display: scalar | line | bar | pie | funnel | table | row | area
    -- size: <width>x<height>     (the grid is 24 wide)
    -- dims: <n>                  (line/bar: the first n columns are dimensions; default 1)
    -- viz: <json>                (extra visualization settings, merged in)
    -- description: <one line>
    SELECT ...;

Two placeholders are understood. `{{days}}` becomes a number variable,
wired to the dashboard's "Jours" filter (default 30). `{{snippet:
internal_users}}` is a Metabase SQL snippet holding the accounts to leave
out -- the owner's and the test accounts -- as a parenthesised list, so
it is edited once in Metabase's UI rather than in nine files. The script
creates it when missing, from MB_INTERNAL_USERS (comma-separated ids; an
empty list excludes nobody), and never overwrites one that exists.

-- Environment -------------------------------------------------
    MB_URL             default http://localhost:3000
    MB_API_KEY         required (Admin › Authentication › API keys)
    MB_DATABASE        the database's name in Metabase, default "Tsuji"
    MB_COLLECTION      default "Tsuji — 足跡"
    MB_INTERNAL_USERS  ids for a NEW snippet only

Safe by default: without --yes it writes nothing.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "docs" / "analytics" / "metabase"
SNIPPET = "internal_users"
DAYS_DEFAULT = 30
GRID = 24


# ── Parsing ───────────────────────────────────────────────────────

def parse(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    head, *blocks = re.split(r"^-- ==== question\s*$", text, flags=re.MULTILINE)
    meta = dict(re.findall(r"^-- (\w+): (.*)$", head, flags=re.MULTILINE))
    questions = []
    for block in blocks:
        lines = block.strip("\n").split("\n")
        q = {"display": "table", "size": "12x6", "dims": "1", "viz": "{}", "description": ""}
        body = []
        for line in lines:
            m = re.match(r"^-- (\w+): (.*)$", line)
            if m and not body:
                q[m.group(1)] = m.group(2).strip()
            else:
                body.append(line)
        q["sql"] = "\n".join(body).strip().rstrip(";")
        w, h = (int(x) for x in q["size"].split("x"))
        q["w"], q["h"] = w, h
        q["dims"] = int(q["dims"])
        q["viz"] = json.loads(q["viz"])
        questions.append(q)
    return {"file": path.name, "name": meta["dashboard"], "description": meta.get("description", ""),
            "questions": questions}


def dashboards() -> list[dict]:
    return [parse(p) for p in sorted(ROOT.glob("[0-9][0-9]-*.sql"))]


# ── Metabase ──────────────────────────────────────────────────────

class Metabase:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def call(self, method: str, path: str, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, method=method, headers={
            "X-API-Key": self.key, "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path}: {e.code} {e.read()[:300]!r}") from None
        return json.loads(raw) if raw else None

    def database_id(self, name: str) -> int:
        dbs = self.call("GET", "/api/database")
        dbs = dbs.get("data", dbs) if isinstance(dbs, dict) else dbs
        for db in dbs:
            if db["name"] == name or str(db["id"]) == name:
                return db["id"]
        raise SystemExit(f"no database named {name!r} in Metabase")

    def snippet(self):
        for s in self.call("GET", "/api/native-query-snippet"):
            if s["name"] == SNIPPET and not s.get("archived"):
                return s
        return None


def snippet_content(ids: list[str]) -> str:
    if not ids:
        return "(SELECT NULL::text WHERE FALSE)"
    quoted = ", ".join("'" + i.replace("'", "") + "'" for i in ids)
    return f"({quoted})"


def template_tags(sql: str, snippet_id) -> dict:
    tags = {}
    if "{{days}}" in sql:
        tags["days"] = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "tsuji/days")), "name": "days",
                        "display-name": "Jours", "type": "number", "default": str(DAYS_DEFAULT),
                        "required": True}
    if "{{snippet: internal_users}}" in sql:
        tags[f"snippet: {SNIPPET}"] = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, "tsuji/snippet")), "name": f"snippet: {SNIPPET}",
            "display-name": f"Snippet: {SNIPPET}", "type": "snippet",
            "snippet-name": SNIPPET, "snippet-id": snippet_id,
        }
    return tags


def runnable(sql: str, snippet_sql: str) -> str:
    """The question as plain SQL: the variable at its default, the snippet inlined."""
    return sql.replace("{{days}}", str(DAYS_DEFAULT)).replace("{{snippet: internal_users}}", snippet_sql)


def run(mb: Metabase, db: int, sql: str) -> tuple[list[str], int]:
    out = mb.call("POST", "/api/dataset", {"database": db, "type": "native", "native": {"query": sql}})
    if out.get("error"):
        raise RuntimeError(str(out["error"])[:400])
    data = out["data"]
    return [c["name"] for c in data["cols"]], len(data["rows"])


def viz_for(q: dict, cols: list[str]) -> dict:
    viz = {}
    d = q["display"]
    if d in ("line", "bar", "area", "row", "combo"):
        n = q["dims"]
        viz = {"graph.dimensions": cols[:n], "graph.metrics": cols[n:] if n == 1 else cols[n:n + 1]}
    elif d == "pie":
        viz = {"pie.dimension": cols[0], "pie.metric": cols[1]}
    elif d == "funnel":
        viz = {"funnel.dimension": cols[0], "funnel.metric": cols[1]}
    viz.update(q["viz"])
    return viz


def layout(questions: list[dict]) -> list[tuple[int, int]]:
    """Left to right, wrapping at the grid's width, rows as tall as their tallest."""
    pos, row, col, tallest = [], 0, 0, 0
    for q in questions:
        if col + q["w"] > GRID:
            row, col, tallest = row + tallest, 0, 0
        pos.append((row, col))
        col += q["w"]
        tallest = max(tallest, q["h"])
    return pos


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the 足跡 Metabase dashboards from docs/analytics/metabase.")
    ap.add_argument("--check", action="store_true", help="run every question and report")
    ap.add_argument("--yes", action="store_true", help="create or update in Metabase")
    args = ap.parse_args()
    # The names carry 足跡 and accents; a Windows console's code page
    # must not be the reason a build stops.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    boards = dashboards()
    total = sum(len(b["questions"]) for b in boards)
    print(f"{len(boards)} dashboards, {total} questions, from {ROOT}")
    for b in boards:
        print(f"  {b['file']}: {b['name']} ({len(b['questions'])})")
    if not (args.check or args.yes):
        print("Report only. --check runs them; --yes builds them.")
        return 0

    key = os.environ.get("MB_API_KEY")
    if not key:
        raise SystemExit("MB_API_KEY is not set")
    mb = Metabase(os.environ.get("MB_URL", "http://localhost:3000"), key)
    db = mb.database_id(os.environ.get("MB_DATABASE", "Tsuji"))
    ids = [i.strip() for i in os.environ.get("MB_INTERNAL_USERS", "").split(",") if i.strip()]
    snip = mb.snippet()
    snippet_sql = snip["content"] if snip else snippet_content(ids)

    # Every question runs first, --yes included: its columns are what the
    # charts are wired to, and a question that fails is not built.
    failed = 0
    for b in boards:
        for q in b["questions"]:
            try:
                q["cols"], rows = run(mb, db, runnable(q["sql"], snippet_sql))
                print(f"  ok   {rows:5d} rows  {b['file']} · {q['title']}")
            except RuntimeError as e:
                failed += 1
                q["cols"] = None
                print(f"  FAIL            {b['file']} · {q['title']}\n         {e}")
    if failed:
        print(f"{failed} question(s) failed.")
    if not args.yes:
        return 1 if failed else 0

    if not snip:
        snip = mb.call("POST", "/api/native-query-snippet", {
            "name": SNIPPET, "content": snippet_content(ids),
            "description": "足跡 (plan 215): accounts the dashboards leave out, as a SQL list of user ids.",
        })
        print(f"snippet {SNIPPET} created ({len(ids)} ids)")

    name = os.environ.get("MB_COLLECTION", "Tsuji — 足跡")
    coll = next((c for c in mb.call("GET", "/api/collection")
                 if c.get("name") == name and not c.get("archived")), None)
    if not coll:
        coll = mb.call("POST", "/api/collection", {"name": name, "description":
                       "Plan 215. Built by backend/scripts/metabase_sync.py from docs/analytics/metabase/."})
    items = mb.call("GET", f"/api/collection/{coll['id']}/items")
    items = items.get("data", items)
    cards = {i["name"]: i["id"] for i in items if i["model"] == "card"}
    boards_by_name = {i["name"]: i["id"] for i in items if i["model"] == "dashboard"}

    for b in boards:
        placed = []
        for q, (row, col) in zip(b["questions"], layout(b["questions"])):
            if q["cols"] is None:
                continue
            title = q["title"]
            body = {
                "name": title, "description": q["description"] or None, "display": q["display"],
                "collection_id": coll["id"],
                "visualization_settings": viz_for(q, q["cols"]),
                "dataset_query": {"database": db, "type": "native", "native": {
                    "query": q["sql"], "template-tags": template_tags(q["sql"], snip["id"])}},
            }
            # Card names are unique per dashboard, not per collection; the
            # dashboard's file prefix keeps two "Visites par jour" apart.
            key_name = f"{title} · {b['file'][:2]}"
            body["name"] = key_name
            if key_name in cards:
                card = mb.call("PUT", f"/api/card/{cards[key_name]}", body)
            else:
                card = mb.call("POST", "/api/card", body)
                cards[key_name] = card["id"]
            mapping = ([{"parameter_id": "days", "card_id": card["id"],
                         "target": ["variable", ["template-tag", "days"]]}]
                       if "{{days}}" in q["sql"] else [])
            placed.append({"id": -(len(placed) + 1), "card_id": card["id"], "row": row, "col": col,
                           "size_x": q["w"], "size_y": q["h"], "parameter_mappings": mapping,
                           "visualization_settings": {"card.title": title}})
        params = [{"id": "days", "name": "Jours", "slug": "jours", "type": "number/=",
                   "sectionId": "number", "default": [DAYS_DEFAULT]}]
        if b["name"] in boards_by_name:
            dash_id = boards_by_name[b["name"]]
        else:
            dash_id = mb.call("POST", "/api/dashboard", {
                "name": b["name"], "description": b["description"], "collection_id": coll["id"],
            })["id"]
        mb.call("PUT", f"/api/dashboard/{dash_id}", {
            "description": b["description"], "parameters": params, "dashcards": placed,
        })
        print(f"dashboard {dash_id}: {b['name']} ({len(placed)} cards)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
