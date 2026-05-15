from pydantic import BaseModel, EmailStr
from typing import Any
from enum import Enum


class EventType(str, Enum):
    like = "like"
    dislike = "dislike"
    flip = "flip"
    skip = "skip"


class EventIn(BaseModel):
    card_id: str
    event: EventType


class Expression(BaseModel):
    phrase: str
    literal: str
    explanation: str


class Word(BaseModel):
    word: str
    level: str
    translation: str


class Tags(BaseModel):
    domains: list[str] = []
    emotion: str = ""
    register: str = ""
    type: str = ""
    cefr: str = ""
    region: str = ""
    era: str = ""


class ReelCard(BaseModel):
    id: str
    rand: float
    quote_en: str
    context: str
    quote_translated: str
    show: str
    season: int | None
    episode: int | None
    speaker: str | None
    tags: Tags
    expressions: list[Expression]
    words: list[Word]
    saved: bool = False
    liked: bool = False


class FeedResponse(BaseModel):
    items: list[ReelCard]
    next_cursor: float | None
    has_more: bool


class SavesCardsResponse(BaseModel):
    items: list[ReelCard]
    total: int


# ── Auth ──────────────────────────────────────────────────────────────────────

class OtpSendRequest(BaseModel):
    email: EmailStr
    lang: str = 'en'


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class OtpVerifyResponse(BaseModel):
    token: str
    is_new_user: bool


# ── User ─────────────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    email: str
    name: str | None
    avatar_url: str | None
    language: str


class UserUpdate(BaseModel):
    name: str | None = None
    language: str | None = None


class UserDomainsResponse(BaseModel):
    domains: list[str]


class UserDomainsUpdate(BaseModel):
    domains: list[str]


class UserLevelsResponse(BaseModel):
    levels: list[str]


class UserLevelsUpdate(BaseModel):
    levels: list[str]
