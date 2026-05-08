from datetime import datetime, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from db import get_db
from models import FeedResponse, ReelCard, Expression, Word, Tags, EventIn

app = FastAPI(title="Flashcards API", version="1.0.0")

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
    limit: int = Query(default=20, ge=1, le=100),
    exclude_ids: list[str] = Query(default=[]),
    lang: str = Query(default="ru"),
    domain: str | None = Query(default=None),
    cefr: str | None = Query(default=None),
):
    db = get_db()

    query: dict = {"status": {"$in": ["published", "pending"]}}

    if exclude_ids:
        try:
            query["_id"] = {"$nin": [ObjectId(i) for i in exclude_ids if ObjectId.is_valid(i)]}
        except Exception:
            pass

    if domain:
        query["tags.domains"] = domain

    if cefr:
        query["tags.cefr"] = cefr

    total = db.reels.count_documents(query)

    pipeline = [
        {"$match": query},
        {"$sample": {"size": limit}},
    ]
    reels = list(db.reels.aggregate(pipeline))

    return FeedResponse(
        items=[_to_card(r, lang) for r in reels],
        total=total,
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
    db.events.insert_one({
        "card_id": ObjectId(body.card_id) if ObjectId.is_valid(body.card_id) else body.card_id,
        "event": body.event.value,
        "ts": datetime.now(timezone.utc),
    })
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok"}
