"""Approvals made before the PIN existed must never be usable, once."""
from sqlalchemy import update

import database
from models import Approval
from services.settings_store import get_setting, set_setting

FLAG = "approvals_pre_pin_retired"


async def retire_pre_pin_approvals() -> bool:
    """Mark every unused approval used, one time only. Returns True if it ran."""
    async with database.AsyncSessionLocal() as db:
        if await get_setting(db, FLAG):
            return False
        await db.execute(update(Approval).where(Approval.used == False).values(used=True))  # noqa: E712
        await set_setting(db, FLAG, "1")  # commits both changes together
        return True
