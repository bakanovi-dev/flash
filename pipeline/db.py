import hashlib
from datetime import datetime, timezone

from pymongo import MongoClient
from config import Config

_client: MongoClient | None = None


def _collection(config: Config):
    global _client
    if _client is None:
        _client = MongoClient(config.mongodb_uri)
    return _client[config.db_name]["reels"]


def _fingerprint(quote_en: str) -> str:
    normalized = " ".join(quote_en.lower().split())
    return hashlib.md5(normalized.encode()).hexdigest()


def reel_exists(quote_en: str, config: Config) -> bool:
    return _collection(config).find_one(
        {"quote_fingerprint": _fingerprint(quote_en)},
        {"_id": 1},
    ) is not None


def save_reel(enriched: dict, source: dict, quote_en: str, config: Config) -> str:
    now = datetime.now(timezone.utc)
    doc = {
        "quote_en": quote_en,
        "source": source,
        "frequency_score": 0.0,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "quote_fingerprint": _fingerprint(quote_en),
        **enriched,
    }
    result = _collection(config).insert_one(doc)
    return str(result.inserted_id)
