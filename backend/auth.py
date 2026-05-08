from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth, credentials
import os

_initialized = False


def _init():
    global _initialized
    if not _initialized:
        cred_path = os.getenv("FIREBASE_CREDENTIALS")
        if cred_path:
            firebase_admin.initialize_app(credentials.Certificate(cred_path))
        else:
            firebase_admin.initialize_app()  # uses GOOGLE_APPLICATION_CREDENTIALS
        _initialized = True


async def get_current_user(authorization: str = Header(...)) -> dict:
    _init()
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    token = authorization.removeprefix("Bearer ")
    try:
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
