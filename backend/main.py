from datetime import datetime, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from db import get_db
from models import FeedResponse, ReelCard, Expression, Word, Tags, EventIn

app = FastAPI(title="Flashcards API", version="1.0.0")
FRESH_RAND_START = 1.0
FRESH_BATCH_SIZE = 3

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_card(r: dict, lang: str) -> ReelCard:
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
    )


@app.get("/api/v1/feed", response_model=FeedResponse)
async def get_feed(
    limit: int = Query(default=15, ge=1, le=100),
    cursor: float | None = Query(default=None),
    fresh_cursor: float | None = Query(default=None),
    lang: str = Query(default="ru"),
    domain: str | None = Query(default=None),
    cefr: str | None = Query(default=None),
    user_id: str = Query(default="1"),
):
    db = get_db()

    state = db.feed_state.find_one({"user_id": user_id}, {"cursor": 1, "fresh_cursor": 1})
    start_cursor = cursor if cursor is not None else (state or {}).get("cursor")
    start_fresh_cursor = (
        fresh_cursor
        if fresh_cursor is not None
        else (state or {}).get("fresh_cursor", FRESH_RAND_START)
    )

    base_query: dict = {"status": {"$in": ["published", "pending"]}}

    if domain:
        base_query["tags.domains"] = domain

    if cefr:
        base_query["tags.cefr"] = cefr

    fresh_limit = min(FRESH_BATCH_SIZE, limit)
    fresh_query = {
        **base_query,
        "rand": {"$gt": max(start_fresh_cursor, FRESH_RAND_START)},
    }
    fresh_reels = list(db.reels.find(fresh_query).sort("rand", 1).limit(fresh_limit))

    regular_limit = limit - len(fresh_reels)
    regular_query = {
        **base_query,
        "rand": {"$lt": FRESH_RAND_START},
    }
    if start_cursor is not None:
        regular_query["rand"]["$gt"] = start_cursor
    else:
        regular_query["rand"]["$gte"] = 0

    regular_reels = list(db.reels.find(regular_query).sort("rand", 1).limit(regular_limit))
    reels = fresh_reels + regular_reels

    next_cursor = regular_reels[-1]["rand"] if regular_reels else start_cursor
    next_fresh_cursor = fresh_reels[-1]["rand"] if fresh_reels else start_fresh_cursor
    has_more = len(reels) == limit

    return FeedResponse(
        items=[_to_card(r, lang) for r in reels],
        next_cursor=next_cursor,
        next_fresh_cursor=next_fresh_cursor,
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
        reel = db.reels.find_one({"_id": card_id}, {"rand": 1})
        if reel and reel.get("rand") is not None:
            cursor_field = "fresh_cursor" if reel["rand"] > FRESH_RAND_START else "cursor"
            db.feed_state.update_one(
                {"user_id": body.user_id},
                {
                    "$max": {cursor_field: reel["rand"]},
                    "$set": {"updated_at": now},
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )

    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok"}
