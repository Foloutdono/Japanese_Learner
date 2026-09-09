# 0010 — Learner rows are reconciled against Supabase auth, not cascaded from it

- **Status**: accepted
- **Date**: 2026-09-09

## Context

Deleting a user in the Supabase dashboard leaves every one of their app rows
behind. Their profile stays on the leaderboard, their review history goes on
counting toward the 番付, their decks and transcripts sit in the tables
forever — and nothing in the app will ever show it, because the account that
would have displayed it is gone.

`DELETE /api/account` (`backend/routes/account.py`) does this properly: it
erases the rows first, then the Supabase user. But it is only one of the ways
a user can disappear. The dashboard's Users page, a direct call to GoTrue's
admin API and a project restore all remove the auth row alone, and the
database has no way to notice.

The obvious fix is a foreign key to `auth.users` with `ON DELETE CASCADE`.
Four independent things rule it out, any one of which would be enough:

1. **The card-scoped tables have no user column to constrain.** `review_log`,
   `card_modes`, `cards` and `card_first_review` key on a card id that
   *starts with* `"{user_id}:"` — the namespacing in `core/auth.py`'s
   `prefixed()`. A row belongs to a learner by string prefix. There is no
   column a foreign key could point at, and these are exactly the tables that
   hold the XP, the streak and the schedule.
2. **The types do not match.** `user_id` is `TEXT` throughout; `auth.users.id`
   is a `uuid`. A foreign key needs matching types, so this would mean
   rewriting the column type of every table that has one.
3. **`DEV_USER_ID` has no auth row at all.** Local development and CI run with
   a free-text user id and no Supabase project (`core/auth.py`). A foreign key
   to `auth.users` would make every write fail in both.
4. **The schema is deliberately independent of the auth schema.**
   `srs/data_structure.sql` says so where `user_profiles` is declared: the app
   keeps its own identity table rather than reading Supabase's, so the DB role
   never needs access to `auth`. A foreign key would reverse that on purpose.

## Decision

Do not couple the schema to `auth.users`. Reconcile the two sides after the
fact instead, with `backend/scripts/purge_orphans.py`: list the users Supabase
still has, list the user ids that still have rows, and erase the difference.

Three properties make that safe to run unattended:

- **Discovery is derived from `PLAN`.** `routes/account.py`'s
  `user_ids_present()` walks the same table list `DELETE /api/account` deletes
  from, reading the prefix-scoped tables by `split_part(card_id, ':', 1)` and
  the rest by their `user_id` column. A table added to the deletion plan is
  discovered here too, so the two cannot drift. It also finds learners with no
  `user_profiles` row at all — a real case, since the profile row is seeded
  lazily on first visit.
- **Erasure reuses `delete_user_rows()`.** The purge performs exactly the
  in-app deletion, in the same order, rather than a second implementation of
  it that could fall behind.
- **An uncertain user list deletes nothing.** If the admin API call fails the
  script stops. If it succeeds but returns *no* users — which would make every
  learner an orphan — it still refuses until `--allow-empty-auth` is passed
  explicitly. `DEV_USER_ID` is always spared.

`DELETE /api/account` remains the path that should be used. This is the repair
for deletions that bypassed it.

## Consequences

- Cascade is not automatic. An out-of-band deletion leaves orphaned rows until
  someone runs the script, so it wants a place in the operational routine
  (alongside `prune_logs.py` and `compact_review_log.py`) rather than being
  run once and forgotten.
- The window is unbounded but harmless: orphaned rows are unreachable through
  the API, since every route resolves a user from a verified token first. The
  visible cost is leaderboard entries for departed learners, and storage.
- Local development and CI are unaffected, which was the point of ruling out
  the foreign key.
- If the card-id prefix scheme is ever replaced by a real `user_id` column on
  the card tables, reason 1 disappears and this decision is worth revisiting —
  though 2, 3 and 4 would still stand.
