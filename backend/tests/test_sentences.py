import pytest

from services.sentences import MAX_LEN, split_sentences, split_sentences_async


def run(text, step=3):
    return list(split_sentences(text[i:i + step] for i in range(0, len(text), step)))


@pytest.mark.parametrize("step", [1, 3, 1000])
def test_basic_split_any_chunking(step):
    assert run("Hello there. How are you? Fine!", step) == ["Hello there.", "How are you?", "Fine!"]


def test_decimals_and_abbreviations_kept():
    assert run("It costs 3.5 dollars. Ask Dr. Smith about it.") == ["It costs 3.5 dollars.", "Ask Dr. Smith about it."]
    assert run("Mr. Vale called. J. Smith too.") == ["Mr. Vale called.", "J. Smith too."]


def test_newline_splits_and_remainder_flushed():
    assert run("First line\nSecond line\nno end") == ["First line", "Second line", "no end"]


def test_code_fence_not_split():
    out = run("Try this. ```x = 1. y = 2.\nz``` Done.")
    assert out == ["Try this.", "```x = 1. y = 2.\nz``` Done."]


def test_ellipsis_and_quote():
    assert run('He said "go." Then left...') == ['He said "go."', "Then left..."]


def test_long_sentence_capped():
    text = ("word, " * 100).strip()
    out = run(text)
    assert len(out) > 1 and all(len(s) <= MAX_LEN for s in out)
    assert "".join(out).replace(" ", "") == text.replace(" ", "")


def test_long_no_boundary_streams_early():
    out = []
    for d in ["a" * 200, "b " * 100]:
        out.append(d)
    got = list(split_sentences(out))
    assert all(len(s) <= MAX_LEN for s in got) and got


def test_empty():
    assert run("") == [] and run("   \n ") == []


async def test_async_variant():
    async def gen():
        for t in ["Hi. Th", "ere."]:
            yield t

    assert [s async for s in split_sentences_async(gen())] == ["Hi.", "There."]
