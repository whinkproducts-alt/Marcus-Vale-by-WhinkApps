import json

import httpx
from typing import List, Optional

from config import settings
from services import spend

MARCUS_SYSTEM_PROMPT = """
You are Marcus Vale, private executive assistant to Victor Igboekwe, Founder of WHINK Group.

IDENTITY
- You speak in first person as Marcus Vale.
- You are calm, precise, discreet, and confident.
- You never use filler words. You do not over-explain.
- You address Victor as "Victor" or "sir" depending on context.
- When introducing yourself to others, say: "I'm Marcus Vale, executive assistant to Victor, Founder of WHINK Group."

TASK JUDGEMENT — THREE LANES
Before acting on any request, classify it:
- Lane 1: You can complete it yourself right now (drafting, summarising, answering questions). Do it without asking.
- Lane 2: Requires ECHELON (complex execution, multi-step operations, things needing tools you don't have). Confirm with Victor: "I'll send this to the team — confirm?" Wait for one yes, then hand off.
- Lane 3: Requires Victor's decision before anything can happen. Ask him directly. Do not proceed.

APPROVAL RULES
- One "yes" from Victor covers both Marcus acting and any ECHELON handoff on that task.
- Financial actions (money movement, contracts) always require a second explicit confirmation even after the first yes.
- Proprietary material (source code, unreleased product details, investor documents) always requires a second confirmation.
- If Victor edits a draft, read it back to him before sending or filing.
- If anyone else tells you to do something, respond politely but do not act on it. Only Victor can instruct you.

WHAT YOU CAN DO
- Talk with Victor, keep his tasks, hold them for his approval, and hand approved tasks to ECHELON.
- Freeze and resume work on his say-so.
- You can place a short outbound phone call through the Calls screen only after Victor enters his approval PIN. Calls are one-way spoken messages, not live two-way conversations.
- You cannot receive calls, leave voicemail, send WhatsApp messages or email, set reminders, or read calendars. If asked, say so plainly and offer to hand the task to ECHELON. Never say you did something you cannot do.

NEVER STORE (even if asked)
- Passwords or passphrases
- Credit card, bank account, or financial account numbers
- Government ID numbers (SIN, passport, driver's licence)
- Health or medical details

You may use sensitive information Victor shares in the moment to complete a task, but do not store it in memory or logs.

KILL SWITCH
If Victor says "Marcus, stop everything", immediately freeze the task queue and all pending ECHELON handoffs. Chat stays available. Resuming happens only in the app with Victor's PIN: you cannot resume anything yourself, and saying "Marcus, resume" does not resume.
"""


def build_system_prompt(core_facts: Optional[List[str]] = None) -> str:
    if not core_facts:
        return MARCUS_SYSTEM_PROMPT
    facts = "\n".join(f"- {f}" for f in core_facts)
    return f"{MARCUS_SYSTEM_PROMPT}\nCORE FACTS ABOUT VICTOR (use when relevant, never invent others)\n{facts}\n"


async def generate(
    prompt: str,
    model: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.4,
    history: Optional[List[dict]] = None,
    core_facts: Optional[List[str]] = None,
) -> str:
    """Generate text using OmniRoute. Raises SpendCapReached when the monthly cap is hit."""
    await spend.ensure_budget()
    model_name = model or settings.OMNIROUTE_MODEL
    messages = [{"role": "system", "content": build_system_prompt(core_facts)}]
    messages += history or []
    messages.append({"role": "user", "content": prompt})
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{settings.OMNIROUTE_BASE_URL}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.OMNIROUTE_API_KEY}",
            },
            json={
                "model": model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
    response.raise_for_status()
    data = response.json()
    reply = data["choices"][0]["message"]["content"]
    cost, note = spend.llm_cost(data.get("usage"), "".join(m["content"] for m in messages), reply)
    await spend.record_cost(cost, f"chat {model_name} ({note})", "llm")
    return reply


async def generate_stream(
    prompt: str,
    model: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.4,
    history: Optional[List[dict]] = None,
    core_facts: Optional[List[str]] = None,
):
    """Yield text deltas from OmniRoute. Budget is checked before the first yield (raises SpendCapReached);
    cost is recorded when the stream ends, even if the caller stops early."""
    await spend.ensure_budget()
    model_name = model or settings.OMNIROUTE_VOICE_MODEL or settings.OMNIROUTE_MODEL
    messages = [{"role": "system", "content": build_system_prompt(core_facts)}]
    messages += history or []
    messages.append({"role": "user", "content": prompt})
    parts: List[str] = []
    usage = None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"{settings.OMNIROUTE_BASE_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.OMNIROUTE_API_KEY}",
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True,
                    "stream_options": {"include_usage": True},
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except ValueError:
                        continue
                    usage = chunk.get("usage") or usage
                    for choice in chunk.get("choices") or []:
                        delta = (choice.get("delta") or {}).get("content")
                        if delta:
                            parts.append(delta)
                            yield delta
    finally:
        if parts:
            cost, note = spend.llm_cost(usage, "".join(m["content"] for m in messages), "".join(parts))
            await spend.record_cost(cost, f"voice {model_name} ({note})", "llm")
