import hmac
import logging
import time
from typing import Optional

from fastapi import Header, HTTPException

from config import settings

log = logging.getLogger("marcus.auth")

# shortcut: counters live in this process and cover every caller together (nginx hides client addresses), one uvicorn worker only;
# a second worker would need a shared store. A lockout also blocks Victor for 15 minutes, which is the price of the limit.
FAIL_LIMIT = 5
LOCK_SECONDS = 15 * 60
_fails = 0
_locked_until = 0.0


def reset_pin_guard() -> None:
    global _fails, _locked_until
    _fails, _locked_until = 0, 0.0


async def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), settings.API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")


async def require_approval_pin(x_approval_pin: Optional[str] = Header(default=None)) -> None:
    """Fail closed: with no PIN configured nothing can pass. After FAIL_LIMIT wrong PINs every attempt is refused, the right one too."""
    global _fails, _locked_until
    refused = HTTPException(status_code=403, detail="approval pin required")
    if time.monotonic() < _locked_until:
        raise HTTPException(status_code=429, detail="approval pin locked")
    pin = settings.APPROVAL_PIN
    if pin and x_approval_pin and hmac.compare_digest(x_approval_pin.encode(), pin.encode()):
        _fails = 0
        return
    if pin and x_approval_pin:  # a guess; a missing header is not one
        _fails += 1
        log.warning("approval pin failure %d", _fails)
        if _fails >= FAIL_LIMIT:
            _fails, _locked_until = 0, time.monotonic() + LOCK_SECONDS
            log.error("approval pin locked for %d minutes", LOCK_SECONDS // 60)
    raise refused
