#!/usr/bin/env python3
"""
Resolve uncertain speakers using OpenAI.
Finds records where speaker is null or speaker_certain=False,
asks OpenAI to identify the character, updates DB if 99%+ certain.

Usage:
    python resolve_speakers.py
    python resolve_speakers.py --dry-run   # preview without writing
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from config import Config
from db import _collection
from llm_utils import call_llm
from openai import OpenAI


def get_openai_client(config: Config) -> OpenAI:
    return OpenAI(api_key=config.openai_api_key)


def resolve(reel: dict, client: OpenAI) -> dict:
    quote_en = reel.get("quote_en", "")
    source = reel.get("source", {})
    show = source.get("show", "")
    season = source.get("season")
    episode = source.get("episode")

    source_str = show
    if season:
        source_str += f" S{season:02d}"
    if episode:
        source_str += f"E{episode:02d}"

    # gather context from locales (may be in any language)
    locales = reel.get("locales", {})
    context_parts = []
    for lang_data in locales.values():
        ctx = lang_data.get("context", "").strip()
        if ctx:
            context_parts.append(ctx)
    context = " / ".join(context_parts[:2]) if context_parts else ""

    prompt = f"""You are identifying which character says a specific line in "{show}".

Show: {source_str}
Line: "{quote_en}"
Scene context: {context or "not available"}
Current guess: {reel.get("speaker") or "unknown"}

Using your knowledge of {show} and the context above, identify who says this line.

Rules:
- Set certain=true ONLY if you are absolutely sure — no other character could plausibly say this line
- "Absolutely sure" means: the line is iconic, the phrasing/vocabulary/situation is unique to one character, OR the context makes it unambiguous
- If there is ANY doubt — even slight — return speaker=null and certain=false
- Do NOT guess. Do NOT pick the most likely character. Only confirm what you know for certain.
- Use the character's first name only (e.g. "Ted", "Marshall", "Lily")

Return JSON only:
{{
  "speaker": "first name or null",
  "certain": true,
  "context_hint": "one sentence: Name says this when/because ..."
}}"""

    return call_llm(client, "gpt-4o", prompt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    config = Config()
    col = _collection(config)

    query = {"$or": [
        {"speaker": None},
        {"speaker_certain": False},
        {"speaker": {"$exists": False}},
    ]}
    records = list(col.find(query))
    print(f"Found {len(records)} records with uncertain/missing speaker\n")

    if not records:
        print("Nothing to resolve.")
        return

    client = get_openai_client(config)
    resolved = skipped = errors = 0

    for reel in records:
        rid = reel["_id"]
        quote_en = reel.get("quote_en", "")
        source = reel.get("source", {})
        show = source.get("show", "")
        s = source.get("season", "")
        e = source.get("episode", "")
        print(f"  [{show} S{s}E{e}] {quote_en[:70]}")

        try:
            result = resolve(reel, client)
        except Exception as err:
            print(f"    [error] {err}", file=sys.stderr)
            errors += 1
            continue

        speaker = result.get("speaker")
        certain = result.get("certain", False)
        hint = result.get("context_hint", "")

        if speaker and certain:
            print(f"    → {speaker} ✓  {hint[:60]}")
            if not args.dry_run:
                col.update_one({"_id": rid}, {"$set": {
                    "speaker": speaker,
                    "speaker_certain": True,
                    "context_hint": hint,
                }})
            resolved += 1
        else:
            print(f"    → still uncertain")
            skipped += 1

    print(f"\nresolved={resolved}  still_uncertain={skipped}  errors={errors}")
    if args.dry_run:
        print("(dry-run: no changes written)")


if __name__ == "__main__":
    main()
