import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Header, HTTPException, status

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_BLOCK_MINUTES = 15

# In-memory rate limiter: ip -> list of timestamps
_otp_send_log: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(ip: str) -> bool:
    now = time.time()
    window = 300  # 5 minutes
    recent = [t for t in _otp_send_log[ip] if now - t < window]
    _otp_send_log[ip] = recent
    if len(recent) >= 3:
        return True
    _otp_send_log[ip].append(now)
    return False


def generate_otp() -> str:
    return str(secrets.randbelow(1_000_000)).zfill(6)


def hash_otp(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def verify_otp_hash(code: str, hashed: str) -> bool:
    return bcrypt.checkpw(code.encode(), hashed.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )
    return decode_token(authorization.removeprefix("Bearer "))
