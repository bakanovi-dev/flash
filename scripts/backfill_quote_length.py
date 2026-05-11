#!/usr/bin/env python3
"""Backfill quote_length for existing reels that don't have it."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "pipeline"))

from pymongo import MongoClient
from config import Config

config = Config()
client = MongoClient(config.mongodb_uri)
db = client[config.db_name]

reels = db.reels.find({"quote_length": {"$exists": False}}, {"_id": 1, "quote_en": 1})

updated = 0
for reel in reels:
    length = len(reel.get("quote_en", "").split())
    db.reels.update_one({"_id": reel["_id"]}, {"$set": {"quote_length": length}})
    updated += 1

print(f"Updated {updated} reels.")
