#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path

from config import Config
from db import reel_exists, save_reel
from embedder import generate_embedding
from enricher import enrich_reel
from extractor import extract_quotes
from srt_parser import parse_srt, parse_script
from vocabulary import SUPPORTED_LANGUAGES


def detect_episode(filename: str) -> int | None:
    """Extract episode number from filename patterns like s01e03, 1x03, e03."""
    patterns = [
        r"s\d+e(\d+)",
        r"\d+x(\d+)",
        r"\be(\d+)\b",
        r"ep\.?(\d+)",
        r"episode[.\s_-]?(\d+)",
    ]
    name = filename.lower()
    for pattern in patterns:
        m = re.search(pattern, name)
        if m:
            return int(m.group(1))
    return None


def process_file(srt_path: Path, args: argparse.Namespace, config: Config, index: int):
    episode = detect_episode(srt_path.name) or index
    print(f"\n--- {srt_path.name}  (episode {episode}) ---")

    source: dict = {"show": args.source, "type": args.type, "episode": episode}
    if args.season:
        source["season"] = args.season

    has_labels = srt_path.suffix.lower() == ".txt"
    if has_labels:
        windows, _ = parse_script(srt_path)
    else:
        windows, _ = parse_srt(srt_path)
    print(f"  {len(windows)} text windows {'(script with speaker labels)' if has_labels else ''}")

    saved = skipped = errors = 0

    for wi, window in enumerate(windows, 1):
        print(f"  window {wi}/{len(windows)} ...", end=" ", flush=True)
        try:
            quotes = extract_quotes(window, config, show=args.source, characters=args.characters, has_labels=has_labels)
            print(f"{len(quotes)} quote(s)")
        except Exception as e:
            print(f"ERROR")
            print(f"  [extraction error] {e}", file=sys.stderr)
            errors += 1
            continue

        for q in quotes:
            quote_en = q.get("quote_en", "").strip()
            if not quote_en:
                continue

            if reel_exists(quote_en, config):
                skipped += 1
                continue

            # If speaker uncertain — leave as null, enrich will handle it
            if not q.get("speaker_certain", True):
                q["speaker"] = None

            try:
                enriched = enrich_reel(q, args.languages, source, config)
            except Exception as e:
                print(f"  [enrichment error] {quote_en[:60]}: {e}", file=sys.stderr)
                errors += 1
                continue

            if args.embedding:
                try:
                    enriched["embedding"] = generate_embedding(
                        {"quote_en": quote_en, **enriched}, config
                    )
                except Exception as e:
                    print(f"  [embedding error] {e}", file=sys.stderr)

            enriched["speaker"] = q.get("speaker")
            enriched["speaker_certain"] = q.get("speaker_certain", True)
            save_reel(enriched, source, quote_en, config)
            saved += 1
            speaker_label = q.get("speaker") or "?"
            print(f"  + [{speaker_label}] {quote_en[:75]}")

    print(f"  saved={saved}  skipped(dup)={skipped}  errors={errors}")


def main():
    parser = argparse.ArgumentParser(description="SRT → MongoDB content pipeline")
    parser.add_argument("--dir", required=True, help="Directory containing .srt files")
    parser.add_argument("--source", required=True, help="Show or book name")
    parser.add_argument(
        "--type", required=True, choices=["series", "book", "podcast", "article"]
    )
    parser.add_argument("--season", type=int, help="Season number (series only)")
    parser.add_argument(
        "--languages",
        default="ru",
        help="Comma-separated target languages (default: ru). Supported: ru, fr, de, it, zh",
    )
    parser.add_argument(
        "--characters",
        default=None,
        type=lambda s: [c.strip() for c in s.split(",")],
        help="Comma-separated list of character names (e.g. 'Sheldon,Leonard,Penny')",
    )
    parser.add_argument(
        "--embedding",
        action="store_true",
        help="Generate embeddings via OpenAI (Phase 2, off by default)",
    )
    args = parser.parse_args()

    args.languages = [lang.strip() for lang in args.languages.split(",")]
    invalid = [l for l in args.languages if l not in SUPPORTED_LANGUAGES]
    if invalid:
        print(f"Unsupported languages: {invalid}. Supported: {SUPPORTED_LANGUAGES}")
        sys.exit(1)

    config = Config()

    srt_files = sorted([
        *Path(args.dir).glob("*.srt"),
        *Path(args.dir).glob("*.txt"),
    ])
    if not srt_files:
        print(f"No .srt or .txt files found in: {args.dir}")
        sys.exit(1)

    print(f"Found {len(srt_files)} file(s) in {args.dir}")
    print(f"Languages: {args.languages}  |  Embeddings: {args.embedding}")

    for i, srt_path in enumerate(srt_files, start=1):
        process_file(srt_path, args, config, index=i)

    print("\nDone.")


if __name__ == "__main__":
    main()
