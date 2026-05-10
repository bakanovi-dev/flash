#!/usr/bin/env python3
"""
One-time migration: adds a monotonic 'rand' field to all reels and creates
an index on it for cursor-based feed pagination.
"""

import os
from pymongo import MongoClient, ASCENDING

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.environ.get("DB_NAME", "flashcards_deepseek")


def main():
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]

    total = db.reels.count_documents({})
    missing = db.reels.count_documents({"rand": {"$exists": False}})
    print(f"Total reels: {total}, missing rand: {missing}")

    if missing > 0:
        print("Adding rand field...")
        last = db.reels.find_one(
            {"rand": {"$exists": True}},
            {"rand": 1},
            sort=[("rand", -1)],
        )
        next_rand = (last or {}).get("rand", 0) + 1
        cursor = db.reels.find({"rand": {"$exists": False}}, {"_id": 1}).sort("created_at", ASCENDING)
        ops = 0
        for doc in cursor:
            db.reels.update_one({"_id": doc["_id"]}, {"$set": {"rand": next_rand}})
            next_rand += 1
            ops += 1
            if ops % 100 == 0:
                print(f"  {ops}/{missing}")
        print(f"Done: {ops} documents updated")

    print("Creating index on rand...")
    db.reels.create_index([("rand", ASCENDING)], name="rand_1")
    print("Index created")


if __name__ == "__main__":
    main()
