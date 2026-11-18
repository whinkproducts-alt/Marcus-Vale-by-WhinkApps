import hmac
from typing import Optional

from fastapi import Header, HTTPException

from config import settings


async def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), settings.API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")


async def require_approval_pin(x_approval_pin: Optional[str] = Header(default=None)) -> None:
    """Fail closed: with no PIN configured nothing can pass."""
    pin = settings.APPROVAL_PIN
    if not pin or not x_approval_pin or not hmac.compare_digest(x_approval_pin.encode(), pin.encode()):
        raise HTTPException(status_code=403, detail="approval pin required")
