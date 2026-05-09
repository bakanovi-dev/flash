#!/usr/bin/env python3
"""
Verify and correct speaker + context_hint for all reels using OpenAI.
Passes real SRT context around the quote so the model sees actual dialogue flow.

Usage:
    python verify_reels.py --srt-dir ../sub
    python verify_reels.py --srt-dir ../sub --dry-run
"""
import argparse
import re
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from config import Config
from db import _collection
from llm_utils import call_llm
from srt_parser import parse_srt, wide_context
from openai import OpenAI


def get_openai_client(config: Config) -> OpenAI:
    return OpenAI(api_key=config.openai_api_key)


def find_srt(srt_dir: Path, season: int | None, episode: int | None) -> Path | None:
    """Find SRT file matching season/episode numbers."""
    if not srt_dir:
        return None
    for f in srt_dir.glob("*.srt"):
        name = f.name.lower()
        if season and episode:
            if re.search(rf"s{season:02d}e{episode:02d}", name):
                return f
        elif episode:
            if re.search(rf"e{episode:02d}\b|ep\.?{episode:02d}", name):
                return f
    return None


# Cache parsed SRT lines per file to avoid re-parsing
_srt_cache: dict[Path, list[str]] = {}

def get_srt_lines(srt_path: Path) -> list[str]:
    if srt_path not in _srt_cache:
        _, lines = parse_srt(srt_path)
        _srt_cache[srt_path] = lines
    return _srt_cache[srt_path]


def translate_context(context_hint: str, languages: list[str], client: OpenAI) -> dict[str, str]:
    """Translate updated context_hint into target languages. Returns {lang: translated_text}."""
    if not context_hint or not languages:
        return {}
    lang_list = ", ".join(languages)
    prompt = f"""Translate this scene description into the following languages: {lang_list}.

Scene description: "{context_hint}"

Return JSON only:
{{
  {", ".join(f'"{lang}": "translation in {lang}"' for lang in languages)}
}}"""
    result = call_llm(client, "gpt-4o", prompt)
    return {lang: result.get(lang, "") for lang in languages}


def verify(reel: dict, client: OpenAI, srt_dir: Path | None) -> dict:
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

    current_speaker = reel.get("speaker") or "unknown"

    # Get real SRT context around the quote
    srt_context = ""
    if srt_dir:
        srt_path = find_srt(srt_dir, season, episode)
        if srt_path:
            lines = get_srt_lines(srt_path)
            srt_context = wide_context(lines, quote_en, radius=8)

    prompt = f"""You are a fact-checker for "{show}" TV show dialogue cards.

Show: {source_str}
Quote: "{quote_en}"
Current speaker: {current_speaker}

Surrounding subtitle lines from the actual episode:
---
{srt_context or "not available"}
---

Your task: identify who says this quote based on the subtitle context above and your knowledge of {show}.

Rules:
- The subtitle lines above are ground truth — use them as the primary signal
- Follow the dialogue flow: look at who responds to this line and what was said before
- Set speaker_certain=true ONLY if unambiguous
- If still unclear, set speaker=null and speaker_certain=false
- Write context_hint based only on what you can see in the subtitles — do NOT invent details
- Do NOT use specific character names in context_hint — vary the wording freely: "one of the characters", "a character", "the speaker", "someone", "one of the heroes", "a participant", "one of the leads", "a member of the group"
- Use character first name only for the speaker field

Return JSON only:
{{
  "speaker": "first name or null",
  "speaker_certain": true or false,
  "context_hint": "one sentence description based on the subtitle context, or empty string if uncertain"
}}"""

    return call_llm(client, "gpt-4o", prompt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--srt-dir", help="Directory with SRT files for context")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    srt_dir = Path(args.srt_dir) if args.srt_dir else None

    config = Config()
    col = _collection(config)

    records = list(col.find({}))
    print(f"Found {len(records)} records to verify\n")

    if not records:
        print("Nothing to verify.")
        return

    client = get_openai_client(config)
    corrected = unchanged = errors = 0

    for reel in records:
        rid = reel["_id"]
        quote_en = reel.get("quote_en", "")
        source = reel.get("source", {})
        show = source.get("show", "")
        s = source.get("season", "")
        e = source.get("episode", "")
        current_speaker = reel.get("speaker") or "?"
        print(f"  [{show} S{s}E{e}] [{current_speaker}] {quote_en[:65]}")

        try:
            result = verify(reel, client, srt_dir)
        except Exception as err:
            print(f"    [error] {err}", file=sys.stderr)
            errors += 1
            continue

        new_speaker = result.get("speaker")
        new_certain = result.get("speaker_certain", False)
        new_context = result.get("context_hint", "")

        speaker_changed = new_speaker != reel.get("speaker")
        context_changed = new_context != reel.get("context_hint", "")

        if speaker_changed or context_changed:
            print(f"    speaker: {current_speaker} → {new_speaker or 'null'}")
            if context_changed:
                print(f"    context: {new_context[:70]}")
            if not args.dry_run:
                update = {
                    "speaker": new_speaker,
                    "speaker_certain": new_certain,
                    "context_hint": new_context,
                }
                if context_changed and new_context:
                    languages = list(reel.get("locales", {}).keys())
                    translations = translate_context(new_context, languages, client)
                    for lang, text in translations.items():
                        if text:
                            update[f"locales.{lang}.context"] = text
                col.update_one({"_id": rid}, {"$set": update})
            corrected += 1
        else:
            print(f"    ✓ ok")
            unchanged += 1

    print(f"\ncorrected={corrected}  unchanged={unchanged}  errors={errors}")
    if args.dry_run:
        print("(dry-run: no changes written)")


if __name__ == "__main__":
    main()
