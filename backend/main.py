from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from db import get_db
from models import FeedResponse, ReelCard, Expression, Word, Tags, EventIn

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
PERSONALIZATION_THRESHOLD = 10
WEIGHT_DELTAS = {"dislike": -0.1, "skip": -0.05}


def _length_bucket(n: int) -> str:
    if n <= 10: return "short"
    if n <= 20: return "medium"
    return "long"


def _weight_keys(r: dict) -> list[str]:
    keys = []
    for domain in r.get("tags", {}).get("domains", []):
        keys.append(f"domain:{domain}")
    emotion = r.get("tags", {}).get("emotion", "")
    if emotion: keys.append(f"emotion:{emotion}")
    register = r.get("tags", {}).get("register", "")
    if register: keys.append(f"register:{register}")
    cefr = r.get("tags", {}).get("cefr", "")
    if cefr: keys.append(f"cefr:{cefr}")
    length = r.get("quote_length", 0)
    if length: keys.append(f"length:{_length_bucket(length)}")
    return keys


def _score_reel(r: dict, weights: dict) -> float:
    return sum(weights.get(k, 0.0) for k in _weight_keys(r))

app = FastAPI(title="Flashcards API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_card(r: dict, lang: str, saved: bool = False, liked: bool = False) -> ReelCard:
    loc = r.get("locales", {}).get(lang, {})
    src = r.get("source", {})

    expressions = [
        Expression(
            phrase=e.get("phrase", ""),
            literal=e.get("locales", {}).get(lang, {}).get("literal", ""),
            explanation=e.get("locales", {}).get(lang, {}).get("explanation", ""),
        )
        for e in r.get("expressions", [])
    ]

    words = [
        Word(
            word=w.get("word", ""),
            level=w.get("level", ""),
            translation=w.get("locales", {}).get(lang, {}).get("translation", ""),
        )
        for w in r.get("words", [])
    ]

    raw_tags = r.get("tags", {})
    tags = Tags(
        domains=raw_tags.get("domains", []),
        emotion=raw_tags.get("emotion", ""),
        register=raw_tags.get("register", ""),
        type=raw_tags.get("type", ""),
        cefr=raw_tags.get("cefr", ""),
        region=raw_tags.get("region", ""),
        era=raw_tags.get("era", ""),
    )

    return ReelCard(
        id=str(r["_id"]),
        quote_en=r.get("quote_en", ""),
        context=loc.get("context", ""),
        quote_translated=loc.get("quote", ""),
        show=src.get("show", ""),
        season=src.get("season"),
        episode=src.get("episode"),
        speaker=r.get("speaker"),
        tags=tags,
        expressions=expressions,
        words=words,
        saved=saved,
        liked=liked,
    )


@app.get("/api/v1/feed", response_model=FeedResponse)
async def get_feed(
    limit: int = Query(default=15, ge=1, le=100),
    cursor: float | None = Query(default=None),
    lang: str = Query(default="ru"),
    domain: str | None = Query(default=None),
    cefr: str | None = Query(default=None),
    user_id: str = Query(default="1"),
):
    db = get_db()

    state = db.feed_state.find_one({"user_id": user_id}, {"cursor": 1})
    start_cursor = cursor if cursor is not None else (state or {}).get("cursor", 0.0)

    base_query: dict = {"status": {"$in": ["published", "pending"]}}
    if domain:
        # prefix match (e.g. "business" matches "business.finance") or exact match
        if "." in domain:
            base_query["tags.domains"] = domain
        else:
            base_query["tags.domains"] = {"$regex": f"^{domain}(\\..*)?$"}
    if cefr:
        base_query["tags.cefr"] = cefr

    profile = db.user_profiles.find_one({"user_id": user_id}) or {}
    like_count = profile.get("like_count", 0)
    personalized = like_count >= PERSONALIZATION_THRESHOLD
    fetch_limit = limit * 3 if personalized else limit

    candidates = list(
        db.reels.find({**base_query, "rand": {"$gt": start_cursor}})
        .sort("rand", 1)
        .limit(fetch_limit)
    )

    wrapped = False
    if not candidates:
        start_cursor = 0.0
        wrapped = True
        candidates = list(
            db.reels.find({**base_query, "rand": {"$gte": 0.0}})
            .sort("rand", 1)
            .limit(fetch_limit)
        )

    if personalized and candidates:
        weights = profile.get("interest_weights", {})
        candidates.sort(key=lambda r: _score_reel(r, weights), reverse=True)

    reels = candidates[:limit]
    next_cursor = candidates[-1]["rand"] if candidates else start_cursor
    has_more = bool(candidates) and (wrapped or len(candidates) == fetch_limit)

    reel_ids = [r["_id"] for r in reels]
    saved_ids = {
        s["card_id"] for s in db.saves.find(
            {"user_id": user_id, "card_id": {"$in": reel_ids}},
            {"card_id": 1},
        )
    }
    liked_ids = {
        l["card_id"] for l in db.likes.find(
            {"user_id": user_id, "card_id": {"$in": reel_ids}},
            {"card_id": 1},
        )
    }

    return FeedResponse(
        items=[_to_card(r, lang, saved=r["_id"] in saved_ids, liked=r["_id"] in liked_ids) for r in reels],
        next_cursor=next_cursor,
        has_more=has_more,
    )


@app.get("/api/v1/reels/{reel_id}", response_model=ReelCard)
async def get_reel(
    reel_id: str,
    lang: str = Query(default="ru"),
):
    db = get_db()
    if not ObjectId.is_valid(reel_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")

    r = db.reels.find_one({"_id": ObjectId(reel_id), "status": {"$in": ["published", "pending"]}})
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")

    return _to_card(r, lang)


@app.post("/api/v1/likes/{card_id}")
async def toggle_like(card_id: str, user_id: str = Query(default="1")):
    db = get_db()
    now = datetime.now(timezone.utc)
    oid = ObjectId(card_id) if ObjectId.is_valid(card_id) else card_id

    reel = db.reels.find_one({"_id": oid}, {"tags": 1, "quote_length": 1, "rand": 1})
    if not reel:
        raise HTTPException(status_code=404, detail="Not found")

    keys = _weight_keys(reel)
    existing = db.likes.find_one({"user_id": user_id, "card_id": oid})

    if existing:
        db.likes.delete_one({"_id": existing["_id"]})
        weight_delta = {f"interest_weights.{k}": -0.1 for k in keys}
        db.user_profiles.update_one(
            {"user_id": user_id},
            {"$inc": {**weight_delta, "like_count": -1}, "$set": {"updated_at": now}},
            upsert=True,
        )
        return {"liked": False}

    db.likes.insert_one({"user_id": user_id, "card_id": oid, "created_at": now})
    weight_delta = {f"interest_weights.{k}": 0.1 for k in keys}
    db.user_profiles.update_one(
        {"user_id": user_id},
        {
            "$inc": {**weight_delta, "like_count": 1},
            "$set": {"updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    if reel.get("rand") is not None:
        db.feed_state.update_one(
            {"user_id": user_id},
            {"$max": {"cursor": reel["rand"]}, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    return {"liked": True}


@app.post("/api/v1/events")
async def post_event(body: EventIn):
    db = get_db()
    now = datetime.now(timezone.utc)
    card_id = ObjectId(body.card_id) if ObjectId.is_valid(body.card_id) else body.card_id

    db.events.insert_one({
        "card_id": card_id,
        "event": body.event.value,
        "user_id": body.user_id,
        "ts": now,
    })

    if isinstance(card_id, ObjectId):
        reel = db.reels.find_one({"_id": card_id}, {"rand": 1, "tags": 1, "quote_length": 1})
        if reel:
            if reel.get("rand") is not None:
                db.feed_state.update_one(
                    {"user_id": body.user_id},
                    {"$max": {"cursor": reel["rand"]}, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )
            delta = WEIGHT_DELTAS.get(body.event.value)
            if delta is not None:
                keys = _weight_keys(reel)
                weight_delta = {f"interest_weights.{k}": delta for k in keys}
                db.user_profiles.update_one(
                    {"user_id": body.user_id},
                    {"$inc": weight_delta, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )

    return {"ok": True}


@app.get("/api/v1/saves")
async def get_saves(user_id: str = Query(default="1")):
    db = get_db()
    saved = db.saves.find({"user_id": user_id}, {"card_id": 1})
    return {"ids": [str(s["card_id"]) for s in saved]}


@app.post("/api/v1/saves/{card_id}")
async def toggle_save(card_id: str, user_id: str = Query(default="1")):
    db = get_db()
    oid = ObjectId(card_id) if ObjectId.is_valid(card_id) else card_id
    existing = db.saves.find_one({"user_id": user_id, "card_id": oid})
    if existing:
        db.saves.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    db.saves.insert_one({
        "user_id": user_id,
        "card_id": oid,
        "created_at": datetime.now(timezone.utc),
    })
    return {"saved": True}


@app.get("/health")
async def health():
    return {"status": "ok"}
