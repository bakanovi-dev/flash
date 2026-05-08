from pymongo import MongoClient
from pymongo.database import Database
import os

_client: MongoClient | None = None


def get_db() -> Database:
    global _client
    if _client is None:
        _client = MongoClient(os.environ["MONGODB_URI"])
    return _client[os.environ["DB_NAME"]]
