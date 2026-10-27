"""
Sets up the owner's bell (plan 276, core/bell.py): checks the forum's
webhook, finds the forum's tags, creates the ones it lacks, and prints
the DISCORD_FEEDBACK_TAGS line the backend needs.

    python -m scripts.discord_bell           # the webhook, its forum and its tags: report
    python -m scripts.discord_bell --yes     # ... and create the tags the forum lacks
    python -m scripts.discord_bell --test    # post a trial thread through the webhook

Reports and changes nothing without --yes. No database.

-- What it needs ---------------------------------------------------
DISCORD_FEEDBACK_WEBHOOK, the webhook of a forum channel in the private
server: the forum's settings › Integrations › Webhooks › New Webhook ›
Copy Webhook URL. Anyone holding that URL can post in the forum, so it
lives in the backend's environment (Render › Environment, and
backend/.env to run this), never in the repository.

DISCORD_BOT_TOKEN, once, to read the tags. A webhook applies a tag by
its id, and only a bot can read the ids (or create the tags): make an
application at discord.com/developers, give it a bot, invite the bot to
the server with View Channels and, for --yes, Manage Channels, and run
this with its token. The backend never needs the token: once the line
below is set, the bot can leave the server and its token be reset.
"""
import argparse
import os
import sys

import scripts._env  # noqa: F401  -- loads backend/.env
import httpx

from core import bell

API = "https://discord.com/api/v10"
BOT_ENV = "DISCORD_BOT_TOKEN"
FORUM_TYPES = (15, 16)  # GUILD_FORUM, GUILD_MEDIA: the channels a webhook can open a thread in
TAGS_MAX = 20  # Discord's bound on a forum's tags


def _get(url: str, headers: dict) -> httpx.Response:
    return httpx.get(url, headers={"User-Agent": bell.USER_AGENT, **headers}, timeout=bell.TIMEOUT)


def match(available: list[dict]) -> tuple[dict[str, str], list[str]]:
    """The forum's tags by key (TAGS' names, case and spacing aside), and
    the keys the forum has no tag for."""
    by_name = {t["name"].strip().casefold(): str(t["id"]) for t in available}
    found = {k: by_name[n.casefold()] for k, n in bell.TAGS.items() if n.casefold() in by_name}
    return found, [k for k in bell.TAGS if k not in found]


def env_line(found: dict[str, str]) -> str:
    return f"{bell.TAGS_ENV}=" + ",".join(f"{k}={found[k]}" for k in bell.TAGS if k in found)


def trial() -> int:
    payload = bell.post(
        "Essai · la sonnette de Tsuji",
        ["La sonnette est branchée : chaque message d'un apprenant ouvrira un fil ici, "
         "avec sa sorte et son numéro, jamais ses mots.",
         "`python -m scripts.read_feedback`"],
        ["problem"],
    )
    status = bell.send(payload)
    if status is None:
        print("The trial could not be posted: no webhook, or Discord unreachable.")
        return 1
    print(f"Trial posted: Discord answered {status}." if status < 300 else f"Trial refused: Discord answered {status}.")
    return 0 if status < 300 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Set up the owner's Discord bell (plan 276).")
    ap.add_argument("--yes", action="store_true", help="create the tags the forum lacks (needs Manage Channels)")
    ap.add_argument("--test", action="store_true", help="post a trial thread through the webhook")
    args = ap.parse_args()

    url = os.environ.get(bell.WEBHOOK_ENV, "").strip()
    if not url:
        print(f"{bell.WEBHOOK_ENV} is not set: copy the forum's webhook URL into backend/.env.")
        return 1
    r = _get(url, {})
    if r.status_code != 200:
        print(f"The webhook answered {r.status_code}: copy its URL again from the forum's settings.")
        return 1
    hook = r.json()
    print(f"Webhook « {hook.get('name')} », channel {hook.get('channel_id')}, server {hook.get('guild_id')}")

    if args.test:
        return trial()

    token = os.environ.get(BOT_ENV, "").strip()
    if not token:
        print(f"\nA webhook cannot read the forum's tags: set {BOT_ENV} (see this script's notes) and run again.")
        return 0
    auth = {"Authorization": f"Bot {token}"}
    r = _get(f"{API}/channels/{hook['channel_id']}", auth)
    if r.status_code != 200:
        print(f"The bot cannot read the channel ({r.status_code}): is it in the server, with View Channels?")
        return 1
    channel = r.json()
    if channel.get("type") not in FORUM_TYPES:
        print(f"#{channel.get('name')} is not a forum: the webhook must belong to a forum channel.")
        return 1
    available = channel.get("available_tags") or []
    found, missing = match(available)

    if missing and args.yes:
        if len(available) + len(missing) > TAGS_MAX:
            print(f"The forum holds {len(available)} tags and Discord allows {TAGS_MAX}: make room first.")
            return 1
        tags = [{"id": t["id"], "name": t["name"]} for t in available] + [{"name": bell.TAGS[k]} for k in missing]
        r = httpx.patch(f"{API}/channels/{channel['id']}", json={"available_tags": tags},
                        headers={"User-Agent": bell.USER_AGENT, **auth}, timeout=bell.TIMEOUT)
        if r.status_code != 200:
            print(f"The tags could not be created ({r.status_code}): the bot needs Manage Channels.")
            return 1
        found, missing = match(r.json().get("available_tags") or [])
        print("Created the missing tags.")

    print(f"\nForum #{channel.get('name')}:")
    for key, name in bell.TAGS.items():
        print(f"  {name:<12} {found.get(key, '— missing')}")
    if missing:
        print(f"\n{len(missing)} missing: create them in the forum's settings, or run again with --yes.")
    line = env_line(found)
    current = os.environ.get(bell.TAGS_ENV, "").strip()
    print("\nOn the backend (Render › Environment):\n")
    print(f"  {line}\n")
    if current:
        print("Already set here." if current == line.split("=", 1)[1] else f"The {bell.TAGS_ENV} set here differs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
