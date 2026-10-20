# ── A podcast's feed and its episodes (plan 265) ──────────────────
# The one place this server fetches a URL a learner typed. A podcast is
# published to be downloaded: its RSS feed lists each episode with the
# address of its audio file (the <enclosure>), and every podcast app
# fetches both. So the feed is read here, and an episode's audio is
# handed to the learner's browser (relay), which keeps the sound,
# transcribes it through study/transcribe.py like any recording they
# hold, and plays the episode from its own address beside the lines --
# a media element needs no CORS to play, only to be read.
#
# A URL from a learner, fetched from inside Render's private network, is
# the classic server-side request forgery: the voice engine there has no
# auth (render.yaml), and a cloud's metadata address answers whoever
# asks. So every fetch here, and every redirect it follows, resolves the
# host first, refuses any address that is not a public one, and then
# connects to THAT address (the Host header and TLS name kept), so a DNS
# answer that changes between the check and the connection cannot move
# it (a rebinding).
import ipaddress
import logging
import re
import socket
import time
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from study.captions import CaptionParseError, safe_xml

logger = logging.getLogger(__name__)

MAX_URL = 2000
_MAX_FEED_BYTES = 5 * 1024 * 1024
# An episode's audio, relayed whole: two hours at 128 kbps is ~115 MB.
MAX_AUDIO_BYTES = 200 * 1024 * 1024
MAX_EPISODES = 60
_MAX_REDIRECTS = 5
_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
_USER_AGENT = "Tsuji/1.0 (podcast reader; +https://tsuji.app)"


class PodcastError(Exception):
    """A feed or an episode that could not be read, with a stable code
    the client words in the learner's language (as CaptionFetchError)."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


# ── The guarded fetch ────────────────────────────────────────
def _public_address(host: str, port: int) -> str:
    """The first address `host` resolves to, when every one of them is a
    public unicast address; PodcastError otherwise."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (OSError, UnicodeError) as e:
        raise PodcastError(f"Cannot resolve {host}", "feed_unreachable") from e
    addresses = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if getattr(ip, "ipv4_mapped", None):
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise PodcastError(f"{host} is not a public address", "feed_refused")
        addresses.append(str(ip))
    if not addresses:
        raise PodcastError(f"Cannot resolve {host}", "feed_unreachable")
    return addresses[0]


def check_url(url: str) -> str:
    """A learner's URL, as one this module may fetch: http(s), a host, no
    credentials, bounded. Returned stripped; PodcastError otherwise."""
    url = (url or "").strip()
    if not url or len(url) > MAX_URL:
        raise PodcastError("A feed address is required", "feed_bad_url")
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
        raise PodcastError("Not a web address", "feed_bad_url")
    return url


def _pinned(url: str):
    """(the URL with its host replaced by a checked address, the headers
    and extensions that keep the original name for HTTP and TLS)."""
    parts = urlsplit(url)
    host = parts.hostname
    port = parts.port or (443 if parts.scheme == "https" else 80)
    ip = _public_address(host, port)
    netloc = f"[{ip}]" if ":" in ip else ip
    if parts.port:
        netloc += f":{parts.port}"
    pinned = urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
    host_header = host if not parts.port else f"{host}:{parts.port}"
    return pinned, {"Host": host_header, "User-Agent": _USER_AGENT}, {"sni_hostname": host}


def open_stream(client: httpx.Client, url: str) -> httpx.Response:
    """GET `url`, following redirects by hand (each one checked again),
    as an open streaming response the caller closes."""
    url = check_url(url)
    for _ in range(_MAX_REDIRECTS + 1):
        pinned, headers, extensions = _pinned(url)
        request = client.build_request("GET", pinned, headers=headers, extensions=extensions)
        try:
            response = client.send(request, stream=True)
        except httpx.HTTPError as e:
            raise PodcastError(f"Fetch failed: {e}", "feed_unreachable") from e
        if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
            response.close()
            url = check_url(urljoin(url, response.headers["location"]))
            continue
        if response.status_code >= 400:
            response.close()
            raise PodcastError(f"HTTP {response.status_code}", "feed_unreachable")
        return response
    raise PodcastError("Too many redirects", "feed_unreachable")


def client() -> httpx.Client:
    # No environment proxy: a learner's URL never rides the residential
    # proxy the link fetch pays for by the gigabyte.
    return httpx.Client(timeout=_TIMEOUT, follow_redirects=False, trust_env=False)


def _read_bounded(response: httpx.Response, limit: int) -> bytes:
    body = bytearray()
    for chunk in response.iter_bytes():
        body += chunk
        if len(body) > limit:
            raise PodcastError("The feed is too large", "feed_too_large")
    return bytes(body)


# ── The feed ─────────────────────────────────────────────────
def _text(el, name: str) -> str:
    for child in el:
        if child.tag.rsplit("}", 1)[-1] == name and (child.text or "").strip():
            return child.text.strip()
    return ""


def _child(el, name: str):
    return next((c for c in el if c.tag.rsplit("}", 1)[-1] == name), None)


def _duration(raw: str) -> int | None:
    """itunes:duration, as "1:02:03", "62:03" or seconds."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        if ":" in raw:
            total = 0
            for part in raw.split(":"):
                total = total * 60 + int(float(part))
            return total
        return int(float(raw))
    except ValueError:
        return None


def _date(raw: str) -> str | None:
    try:
        return parsedate_to_datetime(raw).date().isoformat() if raw else None
    except (TypeError, ValueError):
        return None


def _image(el) -> str | None:
    for child in el:
        name = child.tag.rsplit("}", 1)[-1]
        if name == "image":
            href = child.attrib.get("href") or _text(child, "url")
            if href and re.match(r"^https?://", href) and len(href) <= MAX_URL:
                return href
    return None


def parse_feed(content: str | bytes) -> dict:
    """An RSS feed's title, picture and episodes (newest first, at most
    MAX_EPISODES), each with its audio's address. PodcastError when it
    is no feed, or a feed with no episode we can play."""
    try:
        root = safe_xml(content)
    except CaptionParseError as e:
        raise PodcastError(str(e), "feed_unreadable") from e
    channel = _child(root, "channel")
    if root.tag.rsplit("}", 1)[-1] != "rss" or channel is None:
        raise PodcastError("Not an RSS feed", "feed_unreadable")
    show_image = _image(channel)
    episodes = []
    for item in channel:
        if item.tag.rsplit("}", 1)[-1] != "item":
            continue
        enclosure = _child(item, "enclosure")
        audio = (enclosure.attrib.get("url") or "").strip() if enclosure is not None else ""
        kind = (enclosure.attrib.get("type") or "") if enclosure is not None else ""
        if not re.match(r"^https?://", audio) or len(audio) > MAX_URL:
            continue
        if kind and not kind.startswith(("audio/", "video/")):
            continue
        episodes.append({
            "title": _text(item, "title")[:300] or audio.rsplit("/", 1)[-1][:120],
            "published": _date(_text(item, "pubDate")),
            "duration": _duration(_text(item, "duration")),
            "audioUrl": audio,
            "image": _image(item) or show_image,
        })
        if len(episodes) >= MAX_EPISODES:
            break
    if not episodes:
        raise PodcastError("The feed lists no episode with audio", "feed_no_episodes")
    return {"title": _text(channel, "title")[:300], "image": show_image, "episodes": episodes}


# A feed is read a few times while a learner picks an episode; ten
# minutes of memory saves the refetches. Bounded, and keyed by the URL
# alone: a feed is public, the same for everyone who asks.
_FEED_CACHE: dict[str, tuple[float, dict]] = {}
_FEED_TTL_SECONDS = 600
_FEED_CACHE_SIZE = 64


def read_feed(url: str) -> dict:
    url = check_url(url)
    hit = _FEED_CACHE.get(url)
    if hit and time.monotonic() - hit[0] < _FEED_TTL_SECONDS:
        return hit[1]
    with client() as c:
        response = open_stream(c, url)
        try:
            raw = _read_bounded(response, _MAX_FEED_BYTES)
        except httpx.HTTPError as e:
            raise PodcastError(f"The feed was cut: {e}", "feed_unreachable") from e
        finally:
            response.close()
    feed = parse_feed(raw)
    if len(_FEED_CACHE) >= _FEED_CACHE_SIZE:
        _FEED_CACHE.pop(next(iter(_FEED_CACHE)))
    _FEED_CACHE[url] = (time.monotonic(), feed)
    return feed


# ── An episode's audio ───────────────────────────────────────
_AUDIO_TYPES = ("audio/", "video/", "application/octet-stream", "binary/octet-stream")


def open_audio(url: str):
    """(the client, the open response, its content type) for an
    episode's audio, for the route to stream and close. Refused when the
    answer is not a recording or says it is larger than the relay
    carries; the route stops a body that lied about its length."""
    c = client()
    try:
        response = open_stream(c, url)
    except Exception:
        c.close()
        raise
    kind = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    length = response.headers.get("content-length")
    if kind and not kind.startswith(_AUDIO_TYPES):
        response.close()
        c.close()
        raise PodcastError(f"Not audio: {kind}", "episode_not_audio")
    if length and length.isdigit() and int(length) > MAX_AUDIO_BYTES:
        response.close()
        c.close()
        raise PodcastError("The episode is too large to relay", "episode_too_large")
    return c, response, kind or "application/octet-stream"
