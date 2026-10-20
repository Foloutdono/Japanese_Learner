"""A podcast's feed and its episodes (plan 265, study/podcast.py): the
one URL a learner types that this server fetches, so the guard comes
first -- a private address refused before and after every redirect,
the connection pinned to the address that was checked -- then the
feed's episodes, then the two routes."""
import socket

import httpx
import pytest

import routes.video as video_module
import study.podcast as podcast
import study.transcribe as transcribe

FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>ゆっくり日本語</title>
    <itunes:image href="https://cdn.example/show.jpg"/>
    <item>
      <title>第2回 旅の話</title>
      <pubDate>Tue, 13 Oct 2026 08:00:00 +0900</pubDate>
      <itunes:duration>12:34</itunes:duration>
      <enclosure url="https://cdn.example/ep2.mp3" type="audio/mpeg" length="123"/>
    </item>
    <item>
      <title>A blog post with no audio</title>
    </item>
    <item>
      <title>A PDF</title>
      <enclosure url="https://cdn.example/notes.pdf" type="application/pdf"/>
    </item>
    <item>
      <title>第1回 自己紹介</title>
      <itunes:duration>3605</itunes:duration>
      <itunes:image href="https://cdn.example/ep1.jpg"/>
      <enclosure url="https://cdn.example/ep1.m4a" type="audio/x-m4a"/>
    </item>
  </channel>
</rss>"""


class TestTheFeed:
    def test_its_episodes_with_audio_are_listed_in_its_order(self):
        feed = podcast.parse_feed(FEED)
        assert feed["title"] == "ゆっくり日本語"
        assert feed["image"] == "https://cdn.example/show.jpg"
        assert feed["episodes"] == [
            {"title": "第2回 旅の話", "published": "2026-10-13", "duration": 754,
             "audioUrl": "https://cdn.example/ep2.mp3", "image": "https://cdn.example/show.jpg"},
            {"title": "第1回 自己紹介", "published": None, "duration": 3605,
             "audioUrl": "https://cdn.example/ep1.m4a", "image": "https://cdn.example/ep1.jpg"},
        ]

    def test_bytes_are_read_in_the_encoding_the_feed_declares(self):
        sjis = FEED.replace('encoding="UTF-8"', 'encoding="Shift_JIS"').encode("shift_jis")
        assert podcast.parse_feed(sjis)["title"] == "ゆっくり日本語"

    def test_a_feed_with_no_audio_or_no_feed_at_all_is_refused_by_name(self):
        with pytest.raises(podcast.PodcastError) as caught:
            podcast.parse_feed("<rss><channel><title>x</title><item><title>y</title></item></channel></rss>")
        assert caught.value.code == "feed_no_episodes"
        with pytest.raises(podcast.PodcastError) as caught:
            podcast.parse_feed("<html><body>hello</body></html>")
        assert caught.value.code == "feed_unreadable"

    def test_a_feed_with_a_dtd_is_refused(self):
        bomb = '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaa">]><rss><channel/></rss>'
        with pytest.raises(podcast.PodcastError) as caught:
            podcast.parse_feed(bomb)
        assert caught.value.code == "feed_unreadable"


class TestTheGuard:
    def test_only_a_web_address_is_fetched(self):
        for bad in ("", "ftp://example.com/feed", "file:///etc/passwd", "https://user:pw@example.com/",
                    "javascript:alert(1)", "https://" + "a" * 2001):
            with pytest.raises(podcast.PodcastError) as caught:
                podcast.check_url(bad)
            assert caught.value.code == "feed_bad_url"
        assert podcast.check_url(" https://example.com/feed.xml ") == "https://example.com/feed.xml"

    @pytest.mark.parametrize("address", [
        "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1",
        "fc00::1", "::ffff:10.0.0.1", "100.64.0.1",
    ])
    def test_a_host_that_resolves_anywhere_private_is_refused(self, monkeypatch, address):
        family = socket.AF_INET6 if ":" in address else socket.AF_INET
        monkeypatch.setattr(podcast.socket, "getaddrinfo",
                            lambda host, port, type=0: [(family, socket.SOCK_STREAM, 6, "", (address, port))])
        with pytest.raises(podcast.PodcastError) as caught:
            podcast._public_address("evil.example", 443)
        assert caught.value.code == "feed_refused"

    def test_the_connection_goes_to_the_address_that_was_checked(self, monkeypatch):
        monkeypatch.setattr(podcast, "_public_address", lambda host, port: "93.184.216.34")
        url, headers, extensions = podcast._pinned("https://feeds.example/show.xml?x=1")
        assert url == "https://93.184.216.34/show.xml?x=1"
        assert headers["Host"] == "feeds.example"
        assert extensions == {"sni_hostname": "feeds.example"}

    def test_a_redirect_to_a_private_address_is_refused(self, monkeypatch):
        def resolve(host, port):
            if host == "internal.example":
                raise podcast.PodcastError("private", "feed_refused")
            return "93.184.216.34"

        monkeypatch.setattr(podcast, "_public_address", resolve)
        seen = []

        def handler(request):
            seen.append((request.url.host, request.headers["host"]))
            return httpx.Response(302, headers={"location": "http://internal.example:50121/synthesis"})

        with httpx.Client(transport=httpx.MockTransport(handler)) as c:
            with pytest.raises(podcast.PodcastError) as caught:
                podcast.open_stream(c, "https://feeds.example/show.xml")
        assert caught.value.code == "feed_refused"
        assert seen == [("93.184.216.34", "feeds.example")]

    def test_a_feed_larger_than_its_bound_is_refused(self, monkeypatch):
        monkeypatch.setattr(podcast, "_public_address", lambda host, port: "93.184.216.34")
        monkeypatch.setattr(podcast, "_MAX_FEED_BYTES", 100)
        monkeypatch.setattr(podcast, "client", lambda: httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 1000))))
        podcast._FEED_CACHE.clear()
        with pytest.raises(podcast.PodcastError) as caught:
            podcast.read_feed("https://feeds.example/big.xml")
        assert caught.value.code == "feed_too_large"


# ── The routes ───────────────────────────────────────────────
@pytest.fixture
def can_transcribe(monkeypatch):
    monkeypatch.setenv("TRANSCRIBE_API_KEY", "test-key")


def test_the_feed_route_lists_the_episodes(client, can_transcribe, monkeypatch):
    monkeypatch.setattr(podcast, "read_feed", lambda url: podcast.parse_feed(FEED))
    response = client.get("/api/video/podcast", params={"url": "https://feeds.example/show.xml"})
    assert response.status_code == 200
    assert response.json()["episodes"][0]["audioUrl"] == "https://cdn.example/ep2.mp3"


def test_the_feed_route_words_a_refusal_by_its_code(client, can_transcribe, monkeypatch):
    def refuse(url):
        raise podcast.PodcastError("private", "feed_refused")

    monkeypatch.setattr(podcast, "read_feed", refuse)
    response = client.get("/api/video/podcast", params={"url": "https://feeds.example/show.xml"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "feed_refused"


def test_the_feed_route_is_dark_where_nothing_can_be_heard(client, monkeypatch):
    monkeypatch.delenv("TRANSCRIBE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.get("/api/video/podcast", params={"url": "https://feeds.example/show.xml"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "transcribe_disabled"


def test_the_feed_routes_address_is_bounded(client, can_transcribe):
    assert client.get("/api/video/podcast", params={"url": "https://x/" + "a" * 2000}).status_code == 422
    assert client.get("/api/video/podcast/audio", params={"url": "https://x/" + "a" * 2000}).status_code == 422


def test_an_episode_is_relayed_whole_and_closed(client, can_transcribe, monkeypatch):
    closed = []

    class Response:
        headers = {"content-length": "6"}

        def iter_bytes(self, size):
            yield b"ID3"
            yield b"abc"

        def close(self):
            closed.append("response")

    class Client:
        def close(self):
            closed.append("client")

    monkeypatch.setattr(video_module, "_relays", {})
    monkeypatch.setattr(podcast, "open_audio", lambda url: (Client(), Response(), "audio/mpeg"))
    response = client.get("/api/video/podcast/audio", params={"url": "https://cdn.example/ep2.mp3"})
    assert response.status_code == 200
    assert response.content == b"ID3abc"
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["cache-control"] == "private, no-store"
    assert closed == ["response", "client"]


def test_the_relay_has_a_day_of_episodes(client, can_transcribe, monkeypatch):
    monkeypatch.setattr(video_module, "_relays", {})
    monkeypatch.setattr(video_module, "_RELAYS_PER_DAY", 0)
    monkeypatch.setattr(podcast, "open_audio", lambda url: pytest.fail("relayed past the allowance"))
    response = client.get("/api/video/podcast/audio", params={"url": "https://cdn.example/ep2.mp3"})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "relay_allowance_mine"


def test_an_answer_that_is_not_audio_is_not_relayed(monkeypatch):
    monkeypatch.setattr(podcast, "_public_address", lambda host, port: "93.184.216.34")
    monkeypatch.setattr(podcast, "client", lambda: httpx.Client(transport=httpx.MockTransport(
        lambda r: httpx.Response(200, headers={"content-type": "text/html"}, content=b"<html>"))))
    with pytest.raises(podcast.PodcastError) as caught:
        podcast.open_audio("https://cdn.example/ep2.mp3")
    assert caught.value.code == "episode_not_audio"
    assert transcribe  # the module the relay serves, imported for the reader
