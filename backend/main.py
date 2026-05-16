import os
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from db import get_db
from models import (
    FeedResponse, SavesCardsResponse, ReelCard, Expression, Word, Tags, EventIn,
    OtpSendRequest, OtpVerifyRequest, OtpVerifyResponse,
    UserProfile, UserUpdate, UserDomainsResponse, UserDomainsUpdate,
    UserLevelsResponse, UserLevelsUpdate,
)
from auth import (
    is_rate_limited, generate_otp, hash_otp, verify_otp_hash,
    create_token, get_current_user,
    OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, OTP_BLOCK_MINUTES,
)

log = logging.getLogger("uvicorn.error")

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
        d = domain["domain"] if isinstance(domain, dict) else domain
        keys.append(f"domain:{d}")
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


def _ck(domain: str) -> str:
    return domain.replace(".", "__")


def _advance_cursors(db, user_id: str, reel: dict, now) -> None:
    rand = reel.get("rand")
    if rand is None:
        return
    raw_domains = reel.get("tags", {}).get("domains", [])
    card_domains = set(d["domain"] if isinstance(d, dict) else d for d in raw_domains)
    profile = db.user_profiles.find_one({"user_id": user_id}, {"selected_domains": 1}) or {}
    selected_set = set(profile.get("selected_domains", []))
    domains_to_update = card_domains & selected_set
    if domains_to_update:
        for domain in domains_to_update:
            db.feed_state.update_one(
                {"user_id": user_id},
                {"$max": {f"cursors.{_ck(domain)}.cursor": rand}, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
    else:
        db.feed_state.update_one(
            {"user_id": user_id},
            {"$max": {"cursors.__.cursor": rand}, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

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
    raw_domains = raw_tags.get("domains", [])
    domains = [d["domain"] if isinstance(d, dict) else d for d in raw_domains]
    tags = Tags(
        domains=domains,
        emotion=raw_tags.get("emotion", ""),
        register=raw_tags.get("register", ""),
        type=raw_tags.get("type", ""),
        cefr=raw_tags.get("cefr", ""),
        region=raw_tags.get("region", ""),
        era=raw_tags.get("era", ""),
    )

    return ReelCard(
        id=str(r["_id"]),
        rand=r.get("rand", 0.0),
        quote_en=r.get(f"quote_{r.get('source_lang', 'en')}", r.get("quote_en", "")),
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
    lang: str = Query(default="ru"),
    cefr: str | None = Query(default=None),
    resume: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    db = get_db()
    now = datetime.now(timezone.utc)

    profile = db.user_profiles.find_one({"user_id": user_id}) or {}
    selected = profile.get("selected_domains", [])
    like_count = profile.get("like_count", 0)

    state = db.feed_state.find_one({"user_id": user_id}, {"cursors": 1, "position_rand": 1}) or {}
    stored_cursors = state.get("cursors", {})
    position_rand = state.get("position_rand", None)

    personalized = like_count >= PERSONALIZATION_THRESHOLD and not resume
    fetch_limit = limit * 3 if personalized else limit
    rand_op = "$gte" if resume else "$gt"

    status_filter = {"status": {"$in": ["published", "pending"]}}
    if cefr:
        status_filter["tags.cefr"] = cefr
    else:
        cefr_levels = profile.get("cefr_levels") or []
        if not cefr_levels and profile.get("cefr_level"):
            cefr_levels = [profile["cefr_level"]]
        if cefr_levels:
            status_filter["tags.cefr"] = {"$in": cefr_levels}

    all_candidates: dict = {}
    any_wrapped = False

    if not selected:
        domain_cursor = stored_cursors.get("__", {}).get("cursor", 0.0)
        batch = list(db.reels.find(
            {**status_filter, "rand": {rand_op: domain_cursor}}
        ).sort("rand", 1).limit(fetch_limit))
        if not batch:
            any_wrapped = True
            db.feed_state.update_one(
                {"user_id": user_id},
                {"$set": {"cursors.__.cursor": 0.0, "updated_at": now}, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            batch = list(db.reels.find(
                {**status_filter, "rand": {"$gte": 0.0}}
            ).sort("rand", 1).limit(fetch_limit))
        for r in batch:
            all_candidates[r["_id"]] = r
    else:
        import re as _re
        for domain in selected:
            # top-level domain (e.g. "adult") → match all subdomains ("adult.sexuality", etc.)
            if "." in domain:
                domain_filter = {
                    "tags.domains": {
                        "$elemMatch": {
                            "domain": domain,
                            "confidence": {"$gt": 80},
                        }
                    }
                }
            else:
                domain_filter = {"tags.domains.domain": {"$regex": f"^{_re.escape(domain)}(\\..+)?$"}}
            domain_cursor = stored_cursors.get(_ck(domain), {}).get("cursor", 0.0)
            batch = list(db.reels.find(
                {**status_filter, **domain_filter, "rand": {rand_op: domain_cursor}}
            ).sort("rand", 1).limit(fetch_limit))
            if not batch:
                any_wrapped = True
                db.feed_state.update_one(
                    {"user_id": user_id},
                    {"$set": {f"cursors.{_ck(domain)}.cursor": 0.0, "updated_at": now}, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )
                batch = list(db.reels.find(
                    {**status_filter, **domain_filter, "rand": {"$gte": 0.0}}
                ).sort("rand", 1).limit(fetch_limit))
            elif len(batch) < fetch_limit:
                existing_ids = {r["_id"] for r in batch}
                extra = list(db.reels.find(
                    {**status_filter, **domain_filter, "rand": {"$gte": 0.0}}
                ).sort("rand", 1).limit(fetch_limit))
                batch.extend(r for r in extra if r["_id"] not in existing_ids)
            for r in batch:
                all_candidates[r["_id"]] = r

    candidates = sorted(all_candidates.values(), key=lambda r: r["rand"])

    if personalized and candidates:
        weights = profile.get("interest_weights", {})
        candidates.sort(key=lambda r: _score_reel(r, weights), reverse=True)

    reels = candidates[:limit]
    next_cursor = reels[-1]["rand"] if reels else 0.0
    has_more = bool(reels)  # feed always wraps, more available whenever any cards exist

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


@app.post("/api/v1/feed/reset")
async def reset_feed(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    now = datetime.now(timezone.utc)
    db.feed_state.update_one(
        {"user_id": user_id},
        {"$set": {"cursors": {}, "position_rand": None, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True}


@app.get("/api/v1/feed/state")
async def get_feed_state(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    state = db.feed_state.find_one({"user_id": user_id}, {"position_rand": 1})
    cursor = (state or {}).get("position_rand", None)
    return {"cursor": cursor}


@app.post("/api/v1/feed/position")
async def save_position(prev_rand: float = Query(...), current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    now = datetime.now(timezone.utc)
    db.feed_state.update_one(
        {"user_id": user_id},
        {"$set": {"position_rand": prev_rand, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True}


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
async def toggle_like(card_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
    _advance_cursors(db, user_id, reel, now)
    return {"liked": True}


@app.post("/api/v1/events")
async def post_event(body: EventIn, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    now = datetime.now(timezone.utc)
    card_id = ObjectId(body.card_id) if ObjectId.is_valid(body.card_id) else body.card_id

    db.events.insert_one({
        "card_id": card_id,
        "event": body.event.value,
        "user_id": user_id,
        "ts": now,
    })

    if isinstance(card_id, ObjectId):
        reel = db.reels.find_one({"_id": card_id}, {"rand": 1, "tags": 1, "quote_length": 1})
        if reel:
            _advance_cursors(db, user_id, reel, now)
            delta = WEIGHT_DELTAS.get(body.event.value)
            if delta is not None:
                keys = _weight_keys(reel)
                weight_delta = {f"interest_weights.{k}": delta for k in keys}
                db.user_profiles.update_one(
                    {"user_id": user_id},
                    {"$inc": weight_delta, "$set": {"updated_at": now}, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )

    return {"ok": True}


@app.get("/api/v1/saves")
async def get_saves(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    saved = db.saves.find({"user_id": user_id}, {"card_id": 1})
    return {"ids": [str(s["card_id"]) for s in saved]}


@app.get("/api/v1/saves/cards", response_model=SavesCardsResponse)
async def get_saves_cards(
    lang: str = Query(default="ru"),
    limit: int = Query(default=15, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    db = get_db()

    total = db.saves.count_documents({"user_id": user_id})

    save_records = list(
        db.saves.find({"user_id": user_id}, {"card_id": 1})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    card_ids = [s["card_id"] for s in save_records]

    if not card_ids:
        return SavesCardsResponse(items=[], total=total)

    reels_by_id = {
        r["_id"]: r
        for r in db.reels.find({"_id": {"$in": card_ids}})
    }

    liked_ids = {
        l["card_id"] for l in db.likes.find(
            {"user_id": user_id, "card_id": {"$in": card_ids}},
            {"card_id": 1},
        )
    }

    items = [
        _to_card(reels_by_id[cid], lang, saved=True, liked=cid in liked_ids)
        for cid in card_ids
        if cid in reels_by_id
    ]

    return SavesCardsResponse(items=items, total=total)


@app.get("/api/v1/saves/count")
async def get_saves_count(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    count = db.saves.count_documents({"user_id": user_id})
    return {"count": count}


@app.post("/api/v1/saves/{card_id}")
async def toggle_save(card_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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


# ── Catalog ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/catalog/domains")
async def get_domains():
    """Каталог всех доменов и поддоменов с количеством карточек."""
    db = get_db()
    pipeline = [
        {"$unwind": "$tags.domains"},
        {"$match": {"$or": [
            {"tags.domains.confidence": {"$exists": False}},
            {"tags.domains.confidence": {"$gt": 80}},
        ]}},
        {"$group": {"_id": {"$ifNull": ["$tags.domains.domain", "$tags.domains"]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    raw = list(db.reels.aggregate(pipeline))

    tree: dict[str, list[dict]] = {}
    for item in raw:
        d = item["_id"]
        if not isinstance(d, str) or not d or d == "other":
            continue
        parts = d.split(".", 1)
        domain = parts[0]
        subdomain = parts[1] if len(parts) > 1 else None
        tree.setdefault(domain, [])
        if subdomain:
            tree[domain].append({
                "name": subdomain,
                "full_name": d,
                "count": item["count"],
            })

    domains = [
        {
            "name": name,
            "subdomains": sorted(subs, key=lambda x: -x["count"]),
        }
        for name, subs in sorted(tree.items())
    ]

    return {"domains": domains}


@app.get("/api/v1/users/me/domains", response_model=UserDomainsResponse)
async def get_user_domains(current_user: dict = Depends(get_current_user)):
    db = get_db()
    profile = db.user_profiles.find_one({"user_id": current_user["user_id"]}) or {}
    return UserDomainsResponse(domains=profile.get("selected_domains", []))


@app.put("/api/v1/users/me/domains", response_model=UserDomainsResponse)
async def update_user_domains(
    body: UserDomainsUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    now = datetime.now(timezone.utc)
    db.user_profiles.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {"selected_domains": body.domains, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return UserDomainsResponse(domains=body.domains)


@app.get("/api/v1/users/me/levels", response_model=UserLevelsResponse)
async def get_user_levels(current_user: dict = Depends(get_current_user)):
    db = get_db()
    profile = db.user_profiles.find_one({"user_id": current_user["user_id"]}) or {}
    return UserLevelsResponse(levels=profile.get("cefr_levels", []))


@app.put("/api/v1/users/me/levels", response_model=UserLevelsResponse)
async def update_user_levels(
    body: UserLevelsUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not body.levels:
        raise HTTPException(status_code=400, detail="levels must not be empty")

    unknown = [l for l in body.levels if l not in CEFR_LEVELS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown levels: {unknown}")

    sorted_levels = sorted(body.levels, key=lambda l: CEFR_LEVELS.index(l))
    indices = [CEFR_LEVELS.index(l) for l in sorted_levels]
    for i in range(1, len(indices)):
        if indices[i] != indices[i - 1] + 1:
            missing = CEFR_LEVELS[indices[i - 1] + 1]
            raise HTTPException(
                status_code=400,
                detail=f"Levels must be contiguous: {sorted_levels[i-1]} and {sorted_levels[i]} selected but {missing} is missing",
            )

    db = get_db()
    now = datetime.now(timezone.utc)
    db.user_profiles.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {"cefr_levels": sorted_levels, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return UserLevelsResponse(levels=sorted_levels)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _print_otp(email: str, code: str) -> None:
    print(f"\n{'='*40}\nOTP для {email}: {code}\n{'='*40}\n", flush=True)


_OTP_EMAIL_COPY = {
    "ru": {
        "subject": "Ваш код входа",
        "html": lambda code, ttl: f"<p>Код: <strong>{code}</strong></p><p>Действителен {ttl} минут.</p>",
    },
    "en": {
        "subject": "Your login code",
        "html": lambda code, ttl: f"<p>Code: <strong>{code}</strong></p><p>Valid for {ttl} minutes.</p>",
    },
}


async def _send_otp_email(email: str, code: str, lang: str = "en") -> None:
    copy = _OTP_EMAIL_COPY.get(lang, _OTP_EMAIL_COPY["en"])
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        _print_otp(email, code)
        return
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": "onboarding@resend.dev",
                    "to": [email],
                    "subject": copy["subject"],
                    "html": copy["html"](code, OTP_TTL_MINUTES),
                },
            )
            resp.raise_for_status()
    except Exception as e:
        log.warning(f"Resend failed ({e}) — fallback to terminal")
        _print_otp(email, code)


@app.post("/auth/otp/send", status_code=200)
async def otp_send(body: OtpSendRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if is_rate_limited(ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    db = get_db()
    now = datetime.now(timezone.utc)
    code = generate_otp()
    code_hash = hash_otp(code)
    expires_at = now + timedelta(minutes=OTP_TTL_MINUTES)

    db.users.update_one(
        {"email": body.email},
        {
            "$set": {
                "otp_code_hash": code_hash,
                "otp_expires_at": expires_at,
                "otp_attempts": 0,
                "otp_blocked_until": None,
            },
            "$setOnInsert": {
                "email": body.email,
                "name": None,
                "avatar_url": None,
                "language": "ru",
                "created_at": now,
            },
        },
        upsert=True,
    )

    await _send_otp_email(body.email, code, body.lang)
    return {"ok": True}


@app.post("/auth/otp/verify", response_model=OtpVerifyResponse)
async def otp_verify(body: OtpVerifyRequest):
    db = get_db()
    now = datetime.now(timezone.utc)
    user = db.users.find_one({"email": body.email})

    if not user or not user.get("otp_code_hash"):
        raise HTTPException(status_code=400, detail="Invalid code")

    blocked_until = user.get("otp_blocked_until")
    if blocked_until and blocked_until.replace(tzinfo=timezone.utc) > now:
        raise HTTPException(status_code=400, detail="Too many attempts, try later")

    expires_at = user.get("otp_expires_at")
    if not expires_at or expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Code expired")

    if not verify_otp_hash(body.code, user["otp_code_hash"]):
        attempts = user.get("otp_attempts", 0) + 1
        update: dict = {"$set": {"otp_attempts": attempts}}
        if attempts >= OTP_MAX_ATTEMPTS:
            update["$set"]["otp_blocked_until"] = now + timedelta(minutes=OTP_BLOCK_MINUTES)
        db.users.update_one({"_id": user["_id"]}, update)
        raise HTTPException(status_code=400, detail="Invalid code")

    is_new_user = not user.get("name")
    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"otp_code_hash": None, "otp_expires_at": None, "otp_attempts": 0, "otp_blocked_until": None}},
    )

    token = create_token(str(user["_id"]), user["email"])
    return OtpVerifyResponse(token=token, is_new_user=is_new_user)


@app.post("/auth/logout", status_code=200)
async def logout(_: dict = Depends(get_current_user)):
    return {"ok": True}


# ── Users ─────────────────────────────────────────────────────────────────────

@app.get("/api/v1/users/me", response_model=UserProfile)
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfile(
        id=str(user["_id"]),
        email=user["email"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
        language=user.get("language", "ru"),
    )


@app.patch("/api/v1/users/me", response_model=UserProfile)
async def update_me(body: UserUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    oid = ObjectId(current_user["user_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        db.users.update_one({"_id": oid}, {"$set": updates})
    user = db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfile(
        id=str(user["_id"]),
        email=user["email"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
        language=user.get("language", "ru"),
    )
