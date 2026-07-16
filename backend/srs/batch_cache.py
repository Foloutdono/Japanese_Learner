import hashlib

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


def take_next(cache_key: str, fetch_fn, limit: int = 10) -> str | None:
    batch = _batches.get(cache_key)
    if not batch:
        batch = list(fetch_fn(limit=limit))
        _batches[cache_key] = batch
    if batch:
        return batch.pop(0)
    return None
