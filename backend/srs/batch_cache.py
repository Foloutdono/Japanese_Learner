_batches: dict[str, list[str]] = {}
_initialized: set[str] = set()


def key(*parts: object) -> str:
    return ":".join(str(part) for part in parts if part is not None)


def ensure_initialized(cache_key: str, init_fn) -> None:
    if cache_key not in _initialized:
        init_fn()
        _initialized.add(cache_key)


def take_next(cache_key: str, fetch_fn, limit: int = 10) -> str | None:
    batch = _batches.get(cache_key)
    if not batch:
        batch = list(fetch_fn(limit=limit))
        _batches[cache_key] = batch
    if batch:
        return batch.pop(0)
    return None
