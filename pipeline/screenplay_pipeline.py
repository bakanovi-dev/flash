#!/usr/bin/env python3
"""
Screenplay PDF pipeline — parses Hollywood-format screenplays and extracts flashcard quotes.

Screenplay format: CHARACTER NAME (ALL CAPS, centered line) followed by dialogue lines.
Produces NAME: dialogue pairs → extraction with speaker_certain=True.

Usage:
  python screenplay_pipeline.py --file "Billions S01E01.pdf" --source "Billions" \
      --type series --season 1 --episode 1 --languages ru
"""
import argparse
import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("pdfplumber is required: pip install pdfplumber")
    sys.exit(1)

from config import Config
from db import reel_exists, save_reel
from embedder import generate_embedding
from enricher import enrich_reel
from extractor import extract_quotes
from vocabulary import SUPPORTED_LANGUAGES

WINDOW_SIZE = 20
STEP = 15


def _extract_page_lines(pdf_path: Path) -> list[tuple[float, str]]:
    """Return (x0, text) pairs for every non-empty text line in the PDF."""
    lines: list[tuple[float, str]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if not words:
                continue
            # Group words into lines by rounded top-y position
            groups: dict[float, list] = {}
            for w in words:
                y = round(w["top"])
                groups.setdefault(y, []).append(w)
            for y in sorted(groups):
                row = sorted(groups[y], key=lambda w: w["x0"])
                text = " ".join(w["text"] for w in row).strip()
                x0 = row[0]["x0"]
                if text:
                    lines.append((x0, text))
    return lines


def _parse_screenplay_lines(raw_lines: list[tuple[float, str]]) -> list[str]:
    """Convert (x0, text) pairs into 'CHARACTER: dialogue' strings.

    Strategy:
    - Compute the left margin (5th-percentile x0 = action/description baseline).
    - Character names are ALL CAPS lines indented > left_margin + 100 pts.
    - Dialogue lines follow immediately after a character name.
    - Action/description lines (at or near left margin) reset the current speaker.
    """
    if not raw_lines:
        return []

    x0_values = sorted(x for x, _ in raw_lines)
    left_margin = x0_values[max(0, len(x0_values) // 20)]  # ~5th percentile
    char_threshold = left_margin + 100  # character names are well-indented

    result: list[str] = []
    current_speaker: str | None = None
    current_dialogue: list[str] = []

    def flush():
        nonlocal current_speaker, current_dialogue
        if current_speaker and current_dialogue:
            dialogue = " ".join(current_dialogue).strip()
            if dialogue:
                result.append(f"{current_speaker}: {dialogue}")
        current_speaker = None
        current_dialogue = []

    for x0, text in raw_lines:
        # Strip revision asterisks (e.g. "CHUCK *" → "CHUCK", "line of dialogue *" → "line of dialogue")
        text = re.sub(r"\s*\*+\s*$", "", text).strip()
        # Skip pure page numbers
        if re.fullmatch(r"\d{1,3}\.?", text):
            continue
        if not text:
            continue

        is_all_caps = text == text.upper() and any(c.isalpha() for c in text)

        # Scene headings and transitions at left margin — reset speaker
        if is_all_caps and x0 <= char_threshold and re.match(
            r"^(INT[\. ]|EXT[\. ]|INT/EXT|FADE|SMASH|CUT TO|DISSOLVE|BACK TO|TITLE|THE END)",
            text,
        ):
            flush()
            continue

        # Parenthetical stage direction — skip without resetting speaker
        if text.startswith("(") and text.endswith(")"):
            continue

        # Character name: ALL CAPS, highly indented, short
        if is_all_caps and x0 > char_threshold and len(text) <= 50:
            flush()
            # Strip annotations like (V.O.) (O.S.) (CONT'D)
            speaker = re.sub(r"\s*\(.*?\)\s*$", "", text).strip()
            current_speaker = speaker
            continue

        # Dialogue: indented (not at left margin), speaker is set
        if current_speaker is not None and x0 > left_margin + 20:
            current_dialogue.append(text)
            continue

        # Action/description line — flush and wait for next character name
        flush()

    flush()
    return result


def build_windows(dialogue_lines: list[str]) -> list[str]:
    windows = []
    for i in range(0, len(dialogue_lines), STEP):
        chunk = dialogue_lines[i : i + WINDOW_SIZE]
        if len(chunk) >= 3:
            windows.append("\n".join(chunk))
    return windows


def process_screenplay(pdf_path: Path, args: argparse.Namespace, config: Config):
    print(f"\n--- {pdf_path.name} ---")

    raw_lines = _extract_page_lines(pdf_path)
    dialogue_lines = _parse_screenplay_lines(raw_lines)
    print(f"  Extracted {len(dialogue_lines)} dialogue lines from PDF")

    if not dialogue_lines:
        print("  No dialogue found — check PDF format.")
        return

    # Show a preview of the first few lines
    for line in dialogue_lines[:5]:
        print(f"  {line[:90]}")
    if len(dialogue_lines) > 5:
        print(f"  ... and {len(dialogue_lines) - 5} more")

    windows = build_windows(dialogue_lines)
    print(f"  {len(windows)} text windows (screenplay with speaker labels)")

    episode = args.episode or 1
    source: dict = {"show": args.source, "type": args.type, "episode": episode}
    if args.season:
        source["season"] = args.season

    saved = skipped = errors = 0

    for wi, window in enumerate(windows, 1):
        print(f"  window {wi}/{len(windows)} ...", end=" ", flush=True)
        try:
            quotes = extract_quotes(
                window, config,
                show=args.source,
                characters=args.characters,
                has_labels=True,  # speaker names are explicit in NAME: dialogue format
            )
            print(f"{len(quotes)} quote(s)")
        except Exception as e:
            print("ERROR")
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
            enriched["speaker_certain"] = True  # screenplay format = always certain
            save_reel(enriched, source, quote_en, config)
            saved += 1
            speaker_label = q.get("speaker") or "?"
            print(f"  + [{speaker_label}] {quote_en[:75]}")

    print(f"  saved={saved}  skipped(dup)={skipped}  errors={errors}")


def main():
    parser = argparse.ArgumentParser(
        description="Screenplay PDF → MongoDB flashcard pipeline"
    )
    parser.add_argument("--file", required=True, help="Path to screenplay PDF file")
    parser.add_argument("--source", required=True, help="Show or movie name")
    parser.add_argument(
        "--type", required=True, choices=["series", "book", "podcast", "article", "movie"]
    )
    parser.add_argument("--season", type=int, help="Season number (series only)")
    parser.add_argument("--episode", type=int, help="Episode number")
    parser.add_argument(
        "--languages",
        default="ru",
        help="Comma-separated target languages (default: ru)",
    )
    parser.add_argument(
        "--characters",
        default=None,
        type=lambda s: [c.strip() for c in s.split(",")],
        help="Comma-separated character names (e.g. 'Axe,Wags,Chuck')",
    )
    parser.add_argument(
        "--embedding",
        action="store_true",
        help="Generate embeddings via OpenAI (off by default)",
    )
    parser.add_argument(
        "--parse-only",
        action="store_true",
        help="Only parse and print dialogue lines — do not run extraction",
    )
    args = parser.parse_args()

    args.languages = [lang.strip() for lang in args.languages.split(",")]
    invalid = [l for l in args.languages if l not in SUPPORTED_LANGUAGES]
    if invalid:
        print(f"Unsupported languages: {invalid}. Supported: {SUPPORTED_LANGUAGES}")
        sys.exit(1)

    pdf_path = Path(args.file)
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        print(f"Expected a .pdf file, got: {pdf_path.suffix}")
        sys.exit(1)

    if args.parse_only:
        raw_lines = _extract_page_lines(pdf_path)
        dialogue_lines = _parse_screenplay_lines(raw_lines)
        print(f"Parsed {len(dialogue_lines)} dialogue lines:\n")
        for line in dialogue_lines:
            print(line)
        return

    config = Config()
    process_screenplay(pdf_path, args, config)
    print("\nDone.")


if __name__ == "__main__":
    main()
