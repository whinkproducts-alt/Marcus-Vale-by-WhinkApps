"""Turn a stream of text deltas into whole sentences for speech."""
import re
from typing import AsyncIterator, Iterable, Iterator

MAX_LEN = 300
_ABBR = {"mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e", "inc", "ltd", "no"}
_FENCE = "```"


def _cut(buf: str, final: bool) -> int:
    """Index just past the first complete sentence in buf, or 0 if none yet."""
    in_code = False
    i = 0
    while i < len(buf):
        if buf.startswith(_FENCE, i):
            in_code = not in_code
            i += 3
            continue
        c = buf[i]
        if in_code:
            i += 1
            continue
        if c == "\n":
            if buf[:i].strip():
                return i + 1
        elif c in ".!?":
            j = i
            while j + 1 < len(buf) and buf[j + 1] in ".!?\"')]":
                j += 1
            if j + 1 >= len(buf):
                # Cannot judge the next char yet; at the very end it is a boundary.
                return len(buf) if final else 0
            nxt = buf[j + 1]
            if nxt.isspace():
                word = re.search(r"([A-Za-z.]+)$", buf[:i])
                prev = word.group(1).lower().rstrip(".") if word else ""
                # "Dr. Smith", "e.g. this" and a lone capital initial ("J. Smith") are not ends.
                if c == "." and (prev in _ABBR or (word and len(prev) == 1 and word.group(1).isupper())):
                    pass
                else:
                    return j + 1
            i = j
        i += 1
    return 0


def _split_long(s: str) -> Iterator[str]:
    # shortcut: splits only at comma or space, a code-like blob with neither is cut hard at MAX_LEN.
    while len(s) > MAX_LEN:
        k = s.rfind(",", 0, MAX_LEN)
        if k < MAX_LEN // 3:
            k = s.rfind(" ", 0, MAX_LEN)
        k = k + 1 if k > 0 else MAX_LEN
        yield s[:k].strip()
        s = s[k:]
    if s.strip():
        yield s.strip()


def _drain(buf: str, final: bool) -> tuple[list[str], str]:
    out: list[str] = []
    while True:
        k = _cut(buf, final)
        if k == 0:
            if len(buf) > MAX_LEN:  # no boundary in sight: speak the head rather than wait
                head = list(_split_long(buf))
                out += head[:-1]
                buf = head[-1] if head else ""
            break
        out += [x for x in _split_long(buf[:k].strip())]
        buf = buf[k:]
    if final:
        out += list(_split_long(buf.strip()))
        buf = ""
    return out, buf


def split_sentences(deltas: Iterable[str]) -> Iterator[str]:
    buf = ""
    for d in deltas:
        buf += d
        out, buf = _drain(buf, False)
        yield from out
    out, _ = _drain(buf, True)
    yield from out


async def split_sentences_async(deltas: AsyncIterator[str]) -> AsyncIterator[str]:
    buf = ""
    async for d in deltas:
        buf += d
        out, buf = _drain(buf, False)
        for s in out:
            yield s
    out, _ = _drain(buf, True)
    for s in out:
        yield s
