#!/usr/bin/env python3
"""
Find (and optionally delete) reel records where a locale's context
was written in the wrong language (English instead of the target language).

Detection heuristics:
  ru  — Cyrillic char ratio < 0.5 (context is mostly Latin/English)
  zh  — CJK char ratio < 0.3 (context is mostly Latin/English)
  fr/de/it — contains standalone English "the" or other English-only markers

Usage:
  python3 find_wrong_language.py           # count only
  python3 find_wrong_language.py --delete  # delete flagged records
"""
import argparse
import re
import sys

from config import Config
from db import _collection


# ── language detectors ──────────────────────────────────────────────────────

def _cyrillic_word_ratio(text: str) -> float:
    """Ratio of words that contain at least one Cyrillic character."""
    words = text.split()
    if not words:
        return 1.0
    cyrillic_words = [w for w in words if any('Ѐ' <= c <= 'ӿ' for c in w)]
    return len(cyrillic_words) / len(words)


def _cjk_ratio(text: str) -> float:
    alpha = [c for c in text if c.isalpha() or '一' <= c <= '鿿']
    if not alpha:
        return 1.0
    cjk = [c for c in alpha if '一' <= c <= '鿿']
    return len(cjk) / len(alpha)


# English function words / verb forms that do NOT appear in fr/de/it
_EN_MARKERS = re.compile(
    r'\b(the|because|although|however|despite|confronts|questions|decides|'
    r'realizes|notices|tells|asks|says|replies|responds|looks|seems|'
    r'when she|when he|when they|after she|after he|after they|'
    r'she is|he is|they are|she has|he has)\b',
    re.IGNORECASE,
)


def is_wrong_language(lang: str, context: str) -> bool:
    if not context or len(context.strip()) < 10:
        return False
    if lang == "ru":
        return _cyrillic_word_ratio(context) < 0.5
    if lang == "zh":
        return _cjk_ratio(context) < 0.05
    if lang in ("fr", "de", "it"):
        return bool(_EN_MARKERS.search(context))
    return False


# ── main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true", help="Delete flagged records")
    parser.add_argument("--lang", default=None, help="Check only this language (e.g. ru)")
    parser.add_argument("--show", action="store_true", help="Print offending context snippets")
    args = parser.parse_args()

    config = Config()
    col = _collection(config)

    total = col.count_documents({})
    print(f"Total records in DB: {total}\n")

    # Count per language
    langs_to_check = [args.lang] if args.lang else ["ru", "zh", "fr", "de", "it"]

    flagged_ids = set()
    counts: dict[str, int] = {}

    for lang in langs_to_check:
        field = f"locales.{lang}.context"
        # Only load records that have this locale
        cursor = col.find(
            {field: {"$exists": True, "$ne": ""}},
            {"_id": 1, field: 1, "quote_en": 1},
        )
        bad = []
        for doc in cursor:
            ctx = doc.get("locales", {}).get(lang, {}).get("context", "")
            if is_wrong_language(lang, ctx):
                bad.append(doc)
                flagged_ids.add(doc["_id"])

        counts[lang] = len(bad)
        print(f"  [{lang}]  {len(bad)} wrong-language records")

        if args.show:
            for doc in bad[:5]:
                ctx = doc.get("locales", {}).get(lang, {}).get("context", "")
                print(f"    quote: {doc.get('quote_en', '')[:60]}")
                print(f"    ctx:   {ctx[:120]}")
                print()

    print(f"\nTotal flagged (unique): {len(flagged_ids)}")

    if args.delete:
        if not flagged_ids:
            print("Nothing to delete.")
            return
        confirm = input(f"\nDelete {len(flagged_ids)} records? [yes/no]: ").strip().lower()
        if confirm == "yes":
            result = col.delete_many({"_id": {"$in": list(flagged_ids)}})
            print(f"Deleted {result.deleted_count} records.")
        else:
            print("Aborted.")


if __name__ == "__main__":
    main()
