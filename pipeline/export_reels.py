#!/usr/bin/env python3
"""Export reels from MongoDB to reel.js for the frontend."""
import json
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from config import Config
from pymongo import MongoClient


def export(db_name=None, domain_filter=None, lang="ru", out_path=None):
    cfg = Config()
    client = MongoClient(cfg.mongodb_uri)
    db = client[db_name or cfg.db_name]

    query = {"status": {"$in": ["pending", "published"]}}
    if domain_filter:
        query["tags.domains"] = domain_filter

    reels = list(db.reels.find(query).sort("created_at", 1))
    print(f"Found {len(reels)} reels", file=sys.stderr)

    cards = []
    for r in reels:
        loc = r.get("locales", {}).get(lang, {})
        expressions = []
        for e in r.get("expressions", []):
            eloc = e.get("locales", {}).get(lang, {})
            expressions.append({
                "phrase": e.get("phrase", ""),
                "literal": eloc.get("literal", ""),
                "explanation": eloc.get("explanation", ""),
            })
        words = []
        for w in r.get("words", []):
            wloc = w.get("locales", {}).get(lang, {})
            words.append({
                "word": w.get("word", ""),
                "level": w.get("level", ""),
                "translation": wloc.get("translation", ""),
            })
        src = r.get("source", {})
        cards.append({
            "id": str(r["_id"]),
            "quote_en": r.get("quote_en", ""),
            "context": loc.get("context", ""),
            "quote_ru": loc.get("quote", ""),
            "show": src.get("show", ""),
            "season": src.get("season"),
            "episode": src.get("episode"),
            "tags": r.get("tags", {}),
            "expressions": expressions,
            "words": words,
        })

    out = out_path or Path(__file__).parent.parent / "reel.js"
    with open(out, "w", encoding="utf-8") as f:
        f.write("window.REEL_DECK = ")
        json.dump(cards, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"Written {len(cards)} cards → {out}", file=sys.stderr)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--db", default=None)
    p.add_argument("--domain", default=None)
    p.add_argument("--lang", default="ru")
    p.add_argument("--out", default=None)
    args = p.parse_args()
    export(args.db, args.domain, args.lang, args.out)
