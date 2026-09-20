"""Total the usage lines study/llm_shared.py writes, per task and model.

    python -m scripts.llm_usage_report app.log
    ssh render 'cat /var/log/app.log' | python -m scripts.llm_usage_report
    python -m scripts.llm_usage_report app.log --days 30

This is the other half of the accounting: llm_shared logs one line per
billed response, this adds them up. It reads plain text (stdin or a
path), ignores everything that is not an `llm-usage` line, and needs no
database, no network and no .env -- the log is the store.

What it is FOR is replacing the estimates in scripts/llm_cost_model.py
with measurements. Run it over a month of logs, divide by the paying
subscribers in that month, and the CALLS/IN/OUT columns of the model
stop being an argument. Until then the two disagree, and the log wins.

Two columns deserve a second look every time:

  ok=0   a response that was paid for and could not be used. Every one
         of these is a retry that billed twice for one answer.
  cached a prompt prefix served from the provider's cache, at a
         fraction of the price. Both providers cache automatically, from
         a prefix of about 1,024 tokens, so this column is the only
         evidence that a prompt is actually shaped to be cached. It is
         expected to be 0 on every task but `comprehension`, whose
         prompt is the only one long enough to be eligible (see
         study/exam_gen_utils.py, "Why the generators are not split this
         way"). If it is 0 on `comprehension` too, while `in` is around
         2,000, the split in routes/reading.py is not being reused and
         bought nothing.
"""
import argparse
import re
import sys
from collections import defaultdict

from scripts.llm_cost_model import MODEL_IDS, PRICES

_LINE = re.compile(r"llm-usage\s+(?P<fields>(?:\w+=\S+\s*)+)")


def parse(stream):
    """Yields one dict per usage line. Anything else in the log -- and
    any line whose fields are malformed -- is skipped in silence: this
    runs over whole application logs, where most lines are not ours."""
    for line in stream:
        m = _LINE.search(line)
        if not m:
            continue
        fields = dict(
            pair.split("=", 1) for pair in m.group("fields").split() if "=" in pair
        )
        for key in ("in", "out", "cached", "reasoning", "ms", "ok"):
            try:
                fields[key] = int(fields.get(key, 0))
            except ValueError:
                fields[key] = 0
        yield fields


class Bucket:
    __slots__ = ("calls", "failed", "tin", "tout", "cached", "ms", "unreported")

    def __init__(self):
        self.calls = self.failed = self.tin = self.tout = 0
        self.cached = self.ms = self.unreported = 0

    def add(self, f):
        self.calls += 1
        self.failed += 0 if f["ok"] else 1
        self.tin += f["in"]
        self.tout += f["out"]
        self.cached += f["cached"]
        self.ms += f["ms"]
        self.unreported += 1 if "unreported" in f else 0

    def cost(self, model_id):
        """Dollars, or None when nothing here knows this model's price."""
        row = MODEL_IDS.get(model_id)
        if row is None:
            return None
        pin, pout = PRICES[row]
        # `cached` is a subset of `in`, billed at about a tenth. Close
        # enough for a bill-sized number; the invoice is the authority.
        billed_in = (self.tin - self.cached) + self.cached * 0.1
        return (billed_in * pin + self.tout * pout) / 1e6


def _table(title, buckets, price_by_key=None):
    print(f"\n{title}")
    print(f"  {'':34s} {'calls':>7s} {'failed':>7s} {'in':>12s} {'out':>12s} "
          f"{'cached':>10s} {'avg ms':>7s} {'$':>9s}")
    total = 0.0
    priced = True
    for key, b in sorted(buckets.items(), key=lambda kv: -kv[1].tout):
        cost = b.cost(price_by_key(key) if price_by_key else key)
        if cost is None:
            priced = False
        total += cost or 0.0
        shown = f"{cost:9.3f}" if cost is not None else f"{'?':>9s}"
        print(f"  {key[:34]:34s} {b.calls:7,} {b.failed:7,} {b.tin:12,} {b.tout:12,} "
              f"{b.cached:10,} {b.ms // max(b.calls, 1):7,} {shown}")
    note = "" if priced else "  (+ models with no published price here)"
    print(f"  {'TOTAL':34s} {'':7s} {'':7s} {'':12s} {'':12s} {'':10s} {'':7s} "
          f"{total:9.3f}{note}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("logfile", nargs="?", help="log file; omit to read stdin")
    ap.add_argument("--days", type=float,
                    help="the period these logs cover, to scale to a month")
    ap.add_argument("--users", type=int,
                    help="paying subscribers in that period, for a per-user figure")
    args = ap.parse_args()

    stream = open(args.logfile) if args.logfile else sys.stdin
    by_task, by_model = defaultdict(Bucket), defaultdict(Bucket)
    model_of_task = {}
    rows = 0
    for f in parse(stream):
        rows += 1
        by_model[f.get("model", "?")].add(f)
        task = f.get("task", "unlabelled")
        by_task[task].add(f)
        # A task is usually served by one model; when it is not, the
        # per-task dollar column is priced at whichever served it last
        # and the per-model table is the one to trust.
        model_of_task[task] = f.get("model", "?")

    if not rows:
        raise SystemExit("no llm-usage lines found -- is the log from a process "
                         "running study/llm_shared.py, at INFO?")
    print(f"{rows:,} billed responses")
    _table("By model", by_model)
    _table("By task", by_task, price_by_key=model_of_task.get)

    grand = sum(b.cost(m) or 0.0 for m, b in by_model.items())
    unreported = sum(b.unreported for b in by_model.values())
    if unreported:
        print(f"\n{unreported:,} responses reported no usage block; their tokens "
              "are missing from every figure above.")
    if args.days:
        monthly = grand / args.days * 30
        print(f"\n${grand:.2f} over {args.days:g} days -> ${monthly:.2f}/month")
        if args.users:
            print(f"  ${monthly / args.users:.4f} per paying subscriber per month "
                  f"({args.users:,} subscribers)")
            print("  Compare with: python -m scripts.llm_cost_model")


if __name__ == "__main__":
    main()
