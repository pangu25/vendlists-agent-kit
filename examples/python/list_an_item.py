#!/usr/bin/env python3
"""The whole path, in Python with the standard library only.

    export VENDLISTS_KEY=vl_agent_your_key_here
    python3 examples/python/list_an_item.py ./photos/*.jpg

It stops before publishing. Publishing puts a real item in front of real
buyers on the person's own eBay account, so it stays an explicit step.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("VENDLISTS_API", "https://api.vendlists.com")
KEY = os.environ.get("VENDLISTS_KEY")
CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
POLL_SECONDS = 6
GIVE_UP_AFTER_MINUTES = 10


def call(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}{path}", method=method, data=data)
    req.add_header("Authorization", f"Bearer {KEY}")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        if err.code == 429:
            # The API says how long to wait; waiting less is how you stay throttled.
            wait = int(err.headers.get("Retry-After", "30"))
            print(f"  rate limited; waiting {wait}s")
            time.sleep(wait)
            return call(method, path, body)
        raise SystemExit(f"{method} {path} -> {err.code} {err.read().decode()[:400]}")


def content_type_of(file: str) -> str:
    suffix = Path(file).suffix.lower()
    if suffix not in CONTENT_TYPES:
        raise SystemExit(f"{Path(file).name}: photos must be jpeg, png or webp.")
    return CONTENT_TYPES[suffix]


def main(files: list[str]) -> None:
    if not KEY:
        raise SystemExit("Set VENDLISTS_KEY to your vl_agent_... key.")
    if not files:
        raise SystemExit("Pass one or more photo paths.")

    # 0. Where does this person stand, before anything is spent.
    me = call("GET", "/agent/me")
    allowance = me["allowance"]
    print(f"account: {me['plan']['name']}, {allowance['remaining']} of {allowance['included']} listings left")
    if not me["ebay"]["connected"]:
        print("eBay is not connected yet. The person connects it themselves at vendlists.com.")
    if allowance["nextListing"]["kind"] == "blocked":
        raise SystemExit(f"No listing available: {allowance['nextListing'].get('reason')}. See {API}/agent/guide")

    # 1. The draft, with everything the person said that a photo cannot show.
    listing_id = call("POST", "/listings", {
        "additionalContext": os.environ.get("ITEM_NOTES", "Listed from the Vendlists agent kit example."),
        "quantity": 1,
    })["listingId"]
    print(f"draft: {listing_id}")

    # 2. One upload URL per photo; PUT the bytes with the same content type.
    urls = call("POST", "/listings/upload-url", {
        "listingId": listing_id,
        "files": [{"contentType": content_type_of(f), "index": i} for i, f in enumerate(files)],
    })
    for file, entry in zip(files, urls):
        put = urllib.request.Request(entry["uploadUrl"], method="PUT", data=Path(file).read_bytes())
        put.add_header("Content-Type", content_type_of(file))
        with urllib.request.urlopen(put, timeout=60):
            print(f"  uploaded {Path(file).name}")

    # 3. The call that uses one of the month's listings.
    call("POST", f"/listings/{listing_id}/generate", {})
    print("writing the listing...")

    # 4. Poll only while it is being written, and never forever.
    deadline = time.time() + GIVE_UP_AFTER_MINUTES * 60
    listing = {"status": "processing"}
    while listing["status"] == "processing" and time.time() < deadline:
        time.sleep(POLL_SECONDS)
        listing = call("GET", f"/listings/{listing_id}")
        print(f"  {listing['status']}", end="\r")

    if listing["status"] == "failed":
        raise SystemExit(f"\n{listing.get('processingErrorCode', 'FAILED')}: {listing.get('processingError')}")
    if listing["status"] != "pending_review":
        raise SystemExit(f"\nStill {listing['status']} after {GIVE_UP_AFTER_MINUTES} minutes.")

    # 5. Show the person what was written; they decide what happens next.
    print(f"\n{listing.get('title')}")
    print(f"  price:     {(listing.get('price') or listing.get('suggestedPrice') or 0) / 100} {listing.get('currency', '')}")
    print(f"  category:  {listing.get('categoryName', '-')}")
    print(f"  condition: {listing.get('condition', '-')}")
    print(f"  specifics: {', '.join((listing.get('itemSpecifics') or {}).keys()) or '-'}")

    # 6. eBay's fee is eBay's, not Vendlists'. Show it before publishing.
    try:
        fees = call("POST", f"/listings/{listing_id}/channels/fees", {"action": "quote"})
        print(f"  eBay fee:  {json.dumps(fees)[:200]}")
    except SystemExit as err:
        print(f"  eBay fee:  not quoted ({err})")

    print(f"""
Review it at https://vendlists.com/dashboard/listings/{listing_id}

When the person says yes, publish with:
  curl -X POST {API}/ebay/publish/{listing_id} \\
    -H "Authorization: Bearer $VENDLISTS_KEY" -H 'Content-Type: application/json' -d '{{}}'
""")


if __name__ == "__main__":
    main(sys.argv[1:])
