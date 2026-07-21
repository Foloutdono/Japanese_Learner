import hashlib
import random

_batches: dict[str, list[str]] = {}
_initialized: set[str] = set()
_initialization_versions: dict[str, object] = {}


def key(*parts: object) -> str:
    return ":".join(str(part) for part in parts if part is not None)


def _normalize_version(version: object | None) -> object | None:
    if isinstance(version, (list, tuple)):
        if not version:
            return "empty"
        digest = hashlib.blake2b(digest_size=16)
        for item in version:
            digest.update(str(item).encode("utf-8"))
            digest.update(b"\x00")
        return digest.hexdigest()
    return version


def ensure_initialized(cache_key: str, init_fn, version: object | None = None) -> None:
    normalized_version = _normalize_version(version)
    previous_version = _initialization_versions.get(cache_key)
    if cache_key in _initialized and previous_version == normalized_version:
        return

    init_fn()
    _initialized.add(cache_key)
    _initialization_versions[cache_key] = normalized_version


def take_batch(cache_key: str, fetch_fn, count: int, limit: int = 10) -> list[str]:
    """
    Pop up to `count` ids from the cached "new card" batch for
    `cache_key`, transparently refilling from `fetch_fn(limit=...)`
    whenever the cached batch runs dry. Returns fewer than `count`
    items (possibly zero) once the underlying pool is exhausted —
    callers should treat a short result as "no more new cards to hand
    out", not retry.

    Shares its underlying storage with `take_next`, so the two can be
    called against the same cache_key without ever handing out the
    same id twice.
    """
    if count <= 0:
        return []

    batch = _batches.get(cache_key)
    result: list[str] = []

    while len(result) < count:
        if not batch:
            batch = list(fetch_fn(limit=max(limit, count)))
            _batches[cache_key] = batch
            if not batch:
                break  # pool exhausted — fetch_fn has nothing left to give

        take = min(count - len(result), len(batch))
        result.extend(batch[:take])
        del batch[:take]

    return result


def take_next(cache_key: str, fetch_fn, limit: int = 10) -> str | None:
    result = take_batch(cache_key, fetch_fn, count=1, limit=limit)
    return result[0] if result else None


def pick_ids(cache_key: str, due_ids: list[str], new_fetch_fn, count: int,
             exclude_ids: set[str] | None = None) -> list[str]:
    """
    Select up to `count` card ids for one card/batch response: due ids
    first (already-reviewed cards whose next_review has passed),
    shuffled for presentation variety, topped up with new ids popped
    from the shared new-card batch cache for `cache_key`.

    `exclude_ids` should be whatever's already sitting unreviewed in a
    client's queue — due status doesn't change until a card is
    actually reviewed, so without this a due card could be handed out
    again before the client has even answered it once. New ids don't
    need the same treatment: take_batch already removes them from the
    shared pool the moment they're popped, whether or not the client
    has reviewed them yet.
    """
    exclude_ids = exclude_ids or set()
    pool = [c for c in due_ids if c not in exclude_ids]
    random.shuffle(pool)
    picked = pool[:count]

    remaining = count - len(picked)
    if remaining > 0:
        picked += take_batch(cache_key, new_fetch_fn, count=remaining)

    return picked